const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

/**
 * Repository Mirror Manager
 *
 * Creates a local mirror of the repository folder to avoid blocking on network drives.
 * Synchronizes files in small batches to keep the UI responsive.
 * Watches for changes in the repository and automatically syncs them.
 */
class RepositoryMirror extends EventEmitter {
  /**
   * @param {string} repositoryPath - Source folder to mirror
   * @param {string} mirrorPath - Local destination folder
   * @param {Object} logger - Logger instance
   * @param {Object} [options] - Timing overrides, mainly so tests can run fast
   */
  constructor(repositoryPath, mirrorPath, logger, options = {}) {
    super();
    this.repositoryPath = repositoryPath;
    this.mirrorPath = mirrorPath;
    this.logger = logger;

    // In-memory index of mirrored files: filename -> { size, mtime, synced }
    this.mirrorIndex = new Map();

    // Sync state
    this.isSyncing = false;
    this.syncAborted = false;
    this.lastSyncTime = null;

    // Watch state
    this.watchEnabled = false;
    this.watchTimer = null;
    this.watchSnapshot = null; // Last scan: lower-cased filename -> { name, size, mtime }
    this.watchGeneration = 0; // Bumped on stop, so a scan in flight knows to drop its result
    this.syncDebounceTimer = null;
    this.SYNC_DEBOUNCE_DELAY = options.syncDebounceDelay ?? 2000; // Wait after last change before syncing
    this.forceResyncFiles = new Set(); // Files that must be re-synced regardless of metadata
    this.pollingTimer = null; // Periodic polling timer

    // The watcher scans because network drives and Google Drive do not deliver
    // reliable native filesystem events. A scan is one readdir plus a stat per
    // photo, and the pause is measured from the end of one scan to the start
    // of the next, so a slow drive gets a rest between them.
    this.WATCH_POLL_INTERVAL = options.watchPollInterval ?? 10000;
    // A file whose mtime is younger than this is treated as still being
    // written and reported on a later scan
    this.AWAIT_WRITE_FINISH = options.awaitWriteFinish ?? 500;

    // Safety net for the one case the watcher cannot see: a file replaced with
    // identical size and mtime. Only a content comparison detects that, and it
    // reads from the repository, so it runs rarely and on a rotating sample.
    this.POLLING_INTERVAL = options.pollingInterval ?? 60000;
    this.CONTENT_CHECK_SAMPLE_SIZE = options.contentCheckSampleSize ?? 25;
    this.contentCheckCursor = 0;

    // Batch configuration
    this.BATCH_SIZE = 50;  // Process 50 files at a time
    this.YIELD_INTERVAL = 100;  // Yield to event loop every 100ms

    // How many filesystem operations to have in flight. The repository is
    // normally a network or virtual drive, where each call is dominated by
    // waiting, so overlapping them is what makes a large repository tractable.
    // Kept well under the thread pool size on purpose: each one occupies a
    // libuv thread for as long as Google Drive takes to answer, and the same
    // pool serves the thumbnails the interface is waiting for. Sixteen in
    // flight, on top of the old per-file watcher, left none free and the user
    // list showed spinners for twenty seconds after a scroll.
    this.STAT_CONCURRENCY = options.statConcurrency ?? 4;
    this.COPY_CONCURRENCY = options.copyConcurrency ?? 6;

    // Resolves once the index of already mirrored files is loaded. Asking which
    // photos exist before that returns almost nothing, and the answer is what
    // the interface uses to decide whether a user has a repository photo.
    // Created here rather than in initialize(): the instance is reachable as
    // soon as it is constructed, and the first question tends to arrive while
    // the index is still being read.
    this.indexLoaded = new Promise((resolve) => {
      this.markIndexLoaded = resolve;
    });

    this.INDEX_WAIT_TIMEOUT = options.indexWaitTimeout ?? 10000;
  }

  /**
   * Wait until the mirror knows what it already holds
   *
   * Gives up after a while rather than leaving a caller hanging: an incomplete
   * answer is better than a request that never returns.
   *
   * @returns {Promise<void>}
   */
  async whenIndexLoaded() {
    let timer;

    try {
      await Promise.race([
        this.indexLoaded,
        new Promise((resolve) => {
          timer = setTimeout(() => {
            this.logger.warning('Timed out waiting for the mirror index');
            resolve();
          }, this.INDEX_WAIT_TIMEOUT);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Initialize the mirror folder
   */
  async initialize() {
    try {
      // Create mirror directory if it doesn't exist
      if (!fs.existsSync(this.mirrorPath)) {
        await fs.promises.mkdir(this.mirrorPath, { recursive: true });
        this.logger.info(`Created mirror directory: ${this.mirrorPath}`);
      }

      // Load existing mirror index
      await this.loadMirrorIndex();

      this.logger.success('Repository mirror initialized');
      return true;
    } catch (error) {
      this.logger.error('Error initializing repository mirror:', error);
      return false;
    } finally {
      // Released even on failure, so nothing waits for an index that will
      // never arrive
      this.markIndexLoaded();
    }
  }

  /**
   * Load the mirror index from the mirror folder
   */
  async loadMirrorIndex() {
    try {
      const files = await fs.promises.readdir(this.mirrorPath);

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (ext === '.jpg' || ext === '.jpeg') {
          const filePath = path.join(this.mirrorPath, file);
          try {
            const stats = await fs.promises.stat(filePath);
            this.mirrorIndex.set(file.toLowerCase(), {
              size: stats.size,
              mtime: stats.mtimeMs,
              synced: true
            });
          } catch (error) {
            // File might have been deleted, skip it
            this.logger.warning(`Could not stat mirrored file: ${file}`);
          }
        }
      }

      this.logger.info(`Loaded mirror index: ${this.mirrorIndex.size} files`);
    } catch (error) {
      this.logger.warning('Could not load mirror index:', error);
      // Start with empty index
      this.mirrorIndex.clear();
    }
  }

  /**
   * Start synchronization from repository to mirror
   */
  async startSync() {
    if (this.isSyncing) {
      this.logger.warning('Sync already in progress');
      return;
    }

    this.isSyncing = true;
    this.syncAborted = false;
    this.emit('sync-started');

    try {
      // Check if repository path exists
      const exists = await fs.promises.access(this.repositoryPath)
        .then(() => true)
        .catch(() => false);

      if (!exists) {
        this.logger.warning('Repository path does not exist, sync aborted');
        this.emit('sync-completed', { success: false, error: 'Repository path does not exist' });
        this.isSyncing = false;
        return;
      }

      this.logger.info('Starting repository sync...');
      this.logger.info(`Force-resync files: ${this.forceResyncFiles.size > 0 ? Array.from(this.forceResyncFiles).join(', ') : 'none'}`);

      // Phase 1: Discover files in repository (non-blocking)
      const repositoryFiles = await this.discoverRepositoryFiles();

      if (this.syncAborted) {
        this.logger.info('Sync aborted by user');
        this.emit('sync-completed', { success: false, error: 'Aborted' });
        this.isSyncing = false;
        return;
      }

      this.logger.info(`Discovered ${repositoryFiles.length} files in repository`);

      // Phase 2: Determine which files need syncing
      const filesToSync = await this.determineFilesToSync(repositoryFiles);

      if (this.syncAborted) {
        this.logger.info('Sync aborted by user');
        this.emit('sync-completed', { success: false, error: 'Aborted' });
        this.isSyncing = false;
        return;
      }

      this.logger.info(`${filesToSync.length} files need syncing`);

      // Phase 3: Sync files in batches
      const syncResult = await this.syncFiles(filesToSync);

      // Phase 4: Clean up files that no longer exist in repository
      await this.cleanupDeletedFiles(repositoryFiles);

      this.lastSyncTime = Date.now();
      this.isSyncing = false;

      this.emit('sync-completed', {
        success: true,
        synced: syncResult.synced,
        skipped: syncResult.skipped,
        errors: syncResult.errors
      });

      this.logger.success(`Sync completed: ${syncResult.synced} synced, ${syncResult.skipped} skipped, ${syncResult.errors} errors`);
    } catch (error) {
      this.logger.error('Error during sync:', error);
      this.emit('sync-completed', { success: false, error: error.message });
      this.isSyncing = false;
    }
  }

  /**
   * Discover all image files in repository (non-blocking)
   */
  async discoverRepositoryFiles() {
    const files = [];

    try {
      // Read directory asynchronously
      const entries = await fs.promises.readdir(this.repositoryPath);

      // Process in batches to avoid blocking
      for (let i = 0; i < entries.length; i += this.BATCH_SIZE) {
        if (this.syncAborted) break;

        const batch = entries.slice(i, i + this.BATCH_SIZE);

        for (const entry of batch) {
          const ext = path.extname(entry).toLowerCase();
          if (ext === '.jpg' || ext === '.jpeg') {
            files.push(entry);
          }
        }

        // Yield to event loop between batches
        if (i + this.BATCH_SIZE < entries.length) {
          await new Promise(resolve => setImmediate(resolve));
        }

        // Emit progress
        this.emit('sync-progress', {
          phase: 'discovery',
          current: Math.min(i + this.BATCH_SIZE, entries.length),
          total: entries.length
        });
      }
    } catch (error) {
      this.logger.error('Error discovering repository files:', error);
      throw error;
    }

    return files;
  }

  /**
   * Determine which files need to be synced
   *
   * Most files are already mirrored and unchanged, and deciding that needs a
   * stat each. Done one after another over a repository on Google Drive, a few
   * thousand photos take minutes, during which nothing else about the mirror
   * makes progress and the interface has no repository photos to show.
   */
  async determineFilesToSync(repositoryFiles) {
    const filesToSync = [];
    const needsStat = [];

    // Decide what can be settled without touching the disk first
    for (const file of repositoryFiles) {
      const filenameLower = file.toLowerCase();
      const mirrorEntry = this.mirrorIndex.get(filenameLower);

      // Check if this file is marked for force re-sync (detected by watcher)
      if (this.forceResyncFiles.has(filenameLower)) {
        this.logger.info(`Force re-syncing file detected by watcher: ${file}`);
        filesToSync.push(file);
        continue;
      }

      if (!mirrorEntry || !mirrorEntry.synced) {
        // File not in mirror or not synced
        filesToSync.push(file);
        continue;
      }

      needsStat.push({ file, mirrorEntry });
    }

    // The rest only need a size and mtime comparison, several at a time
    const changed = await this.mapWithConcurrency(needsStat, this.STAT_CONCURRENCY, async ({ file, mirrorEntry }) => {
      if (this.syncAborted) {
        return null;
      }

      try {
        const stats = await fs.promises.stat(path.join(this.repositoryPath, file));

        if (stats.size !== mirrorEntry.size || stats.mtimeMs !== mirrorEntry.mtime) {
          return file;
        }
      } catch (error) {
        // File might not exist anymore, skip it
        this.logger.warning(`Could not stat repository file: ${file}`);
      }

      return null;
    });

    filesToSync.push(...changed.filter(Boolean));
    return filesToSync;
  }

  /**
   * Run an async worker over items, a few at a time
   *
   * @param {Array} items
   * @param {number} limit
   * @param {Function} worker - async (item) => result
   * @returns {Promise<Array>} Results, in the order of the input
   * @private
   */
  async mapWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;

    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        results[index] = await worker(items[index]);
      }
    });

    await Promise.all(runners);
    return results;
  }

  /**
   * Sync files from repository to mirror in batches
   */
  async syncFiles(filesToSync) {
    let synced = 0;
    const skipped = 0;
    let errors = 0;
    let processed = 0;

    // Copies overlap for the same reason the stats do: over a network drive
    // each one is mostly waiting
    await this.mapWithConcurrency(filesToSync, this.COPY_CONCURRENCY, async (file) => {
      if (this.syncAborted) {
        return;
      }

      const filenameLower = file.toLowerCase();
      const sourcePath = path.join(this.repositoryPath, file);
      const destPath = path.join(this.mirrorPath, file);

      try {
        // Copy file
        await fs.promises.copyFile(sourcePath, destPath);

        // Update index
        const stats = await fs.promises.stat(destPath);
        this.mirrorIndex.set(filenameLower, {
          size: stats.size,
          mtime: stats.mtimeMs,
          synced: true
        });

        // Remove from force-resync set if present
        this.forceResyncFiles.delete(filenameLower);

        synced++;

        // Emit event for this file
        this.emit('file-synced', file);
      } catch (error) {
        this.logger.error(`Error syncing file ${file}:`, error);
        errors++;
      }

      processed++;

      // Emit progress. Reported in batches: one message per file meant an IPC
      // round trip for every photo in the repository.
      if (processed % 25 === 0 || processed === filesToSync.length) {
        this.emit('sync-progress', {
          phase: 'syncing',
          current: processed,
          total: filesToSync.length,
          synced,
          errors
        });
      }
    });

    return { synced, skipped, errors };
  }

  /**
   * Clean up files in mirror that no longer exist in repository
   */
  async cleanupDeletedFiles(repositoryFiles) {
    const repositoryFilesSet = new Set(repositoryFiles.map(f => f.toLowerCase()));
    const filesToDelete = [];

    // Find files in mirror that don't exist in repository
    for (const [filename, entry] of this.mirrorIndex.entries()) {
      if (!repositoryFilesSet.has(filename)) {
        filesToDelete.push(filename);
      }
    }

    this.logger.info(`Cleaning up ${filesToDelete.length} deleted files from mirror`);

    for (const filename of filesToDelete) {
      try {
        const filePath = path.join(this.mirrorPath, filename);
        await fs.promises.unlink(filePath);
        this.mirrorIndex.delete(filename);
        this.logger.info(`Deleted from mirror: ${filename}`);
      } catch (error) {
        this.logger.warning(`Could not delete mirrored file ${filename}:`, error);
      }

      // Yield to event loop
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  /**
   * Stop ongoing sync
   */
  stopSync() {
    if (this.isSyncing) {
      this.syncAborted = true;
      this.logger.info('Sync stop requested');
    }
  }

  /**
   * Get the local mirror path for a file
   */
  getMirrorPath(filename) {
    const filenameLower = filename.toLowerCase();
    if (this.mirrorIndex.has(filenameLower)) {
      return path.join(this.mirrorPath, filename);
    }
    return null;
  }

  /**
   * Check if a file exists in the mirror
   */
  hasFile(filename) {
    const filenameLower = filename.toLowerCase();
    return this.mirrorIndex.has(filenameLower);
  }

  /**
   * Get all mirrored files
   */
  getAllFiles() {
    return Array.from(this.mirrorIndex.keys());
  }

  /**
   * Get sync statistics
   */
  getStats() {
    return {
      totalFiles: this.mirrorIndex.size,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      isWatching: this.watchEnabled
    };
  }

  /**
   * Start watching the repository folder for changes
   *
   * Implemented as a periodic scan rather than a per-file polling watcher.
   * chokidar's polling mode registers one fs.watchFile per photo, and each of
   * those stats its file on every interval: thousands of stats against Google
   * Drive every few seconds, all queued on the libuv thread pool that the
   * thumbnail service and every other file read also depend on. Measured on
   * the real repository, a thumbnail that takes 9ms alone took up to 30s while
   * that watcher ran. One scan at a time, a few stats in flight, leaves the
   * pool free for the interface.
   */
  async startWatch() {
    if (this.watchEnabled) {
      this.logger.warning('Repository watch already enabled');
      return true;
    }

    try {
      // Check if repository path exists
      const exists = await fs.promises.access(this.repositoryPath)
        .then(() => true)
        .catch(() => false);

      if (!exists) {
        this.logger.warning('Repository path does not exist, cannot start watch');
        return false;
      }

      this.logger.info('Starting repository folder watch...');

      this.watchEnabled = true;
      this.watchGeneration++;

      // The first scan only takes the baseline: what is already there is not
      // a change, the initial sync deals with it
      this.watchSnapshot = await this.scanRepository();

      if (!this.watchEnabled) {
        // Stopped while the baseline was being taken
        return false;
      }

      this.logger.success('Repository folder watch started');
      this.scheduleNextWatchScan();

      // Also start periodic polling as a fallback for detecting changes
      this.startPeriodicPolling();

      return true;
    } catch (error) {
      this.logger.error('Error starting repository watch:', error);
      this.watchEnabled = false;
      return false;
    }
  }

  /**
   * Arrange the next scan once the current one is over
   *
   * Chained with a timeout instead of an interval, so a slow scan over a
   * network drive is never overlapped by the next one.
   * @private
   */
  scheduleNextWatchScan() {
    const generation = this.watchGeneration;

    this.watchTimer = setTimeout(async () => {
      this.watchTimer = null;

      if (!this.watchEnabled || generation !== this.watchGeneration) {
        return;
      }

      // The sync stats and copies the same files; scanning underneath it would
      // double the load and report the very files it is bringing over
      if (!this.isSyncing) {
        try {
          await this.watchScan();
        } catch (error) {
          this.logger.error('Error scanning repository for changes:', error);
        }
      }

      if (this.watchEnabled && generation === this.watchGeneration) {
        this.scheduleNextWatchScan();
      }
    }, this.WATCH_POLL_INTERVAL);
  }

  /**
   * List the repository's images with their size and modification time
   *
   * @returns {Promise<Map<string, {name: string, size: number, mtime: number}>>}
   *   Keyed by lower-cased filename
   * @private
   */
  async scanRepository() {
    const entries = await fs.promises.readdir(this.repositoryPath);
    const images = entries.filter((entry) => {
      const ext = path.extname(entry).toLowerCase();
      return ext === '.jpg' || ext === '.jpeg';
    });

    const stats = await this.mapWithConcurrency(images, this.STAT_CONCURRENCY, async (name) => {
      try {
        const fileStats = await fs.promises.stat(path.join(this.repositoryPath, name));
        return { name, size: fileStats.size, mtime: fileStats.mtimeMs };
      } catch (error) {
        // Removed between readdir and stat: as good as never listed
        return null;
      }
    });

    const snapshot = new Map();
    for (const entry of stats) {
      if (entry) {
        snapshot.set(entry.name.toLowerCase(), entry);
      }
    }

    return snapshot;
  }

  /**
   * Compare the repository against the previous scan and report what differs
   * @private
   */
  async watchScan() {
    const previous = this.watchSnapshot;
    const current = await this.scanRepository();

    if (!this.watchEnabled || !previous) {
      return;
    }

    const now = Date.now();

    for (const [key, entry] of current) {
      const before = previous.get(key);

      if (before && before.size === entry.size && before.mtime === entry.mtime) {
        continue;
      }

      // Still being written: a copy in progress changes size from one scan to
      // the next, and reporting it now would sync a truncated photo. Kept as
      // it was in the snapshot so the next scan looks at it again.
      if (now - entry.mtime < this.AWAIT_WRITE_FINISH) {
        if (before) {
          current.set(key, before);
        } else {
          current.delete(key);
        }
        continue;
      }

      this.reportRepositoryChange(before ? 'change' : 'add', entry.name);
    }

    for (const [key, entry] of previous) {
      if (!current.has(key)) {
        this.reportRepositoryChange('unlink', entry.name);
      }
    }

    this.watchSnapshot = current;
  }

  /**
   * @private
   */
  reportRepositoryChange(type, filename) {
    const described = { add: 'added', change: 'changed', unlink: 'removed' }[type];
    this.logger.info(`Repository file ${described}: ${filename}`);
    this.forceResyncFiles.add(filename.toLowerCase());
    this.emit('repository-changed', { type, filename });
    this.scheduleDebouncedSync();
  }

  /**
   * Schedule a debounced sync after file changes
   */
  scheduleDebouncedSync() {
    // Clear existing timer
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }

    // Schedule new sync after debounce delay
    this.syncDebounceTimer = setTimeout(() => {
      this.syncDebounceTimer = null;

      // Only sync if not already syncing
      if (!this.isSyncing) {
        this.logger.info('Auto-syncing repository after detected changes...');
        this.startSync();
      } else {
        this.logger.info('Sync already in progress, skipping auto-sync');
      }
    }, this.SYNC_DEBOUNCE_DELAY);
  }

  /**
   * Start periodic polling to check for file changes
   */
  startPeriodicPolling() {
    if (this.pollingTimer) {
      return; // Already polling
    }

    this.logger.info(`Starting periodic polling (every ${this.POLLING_INTERVAL / 1000} seconds)`);

    this.pollingTimer = setInterval(async () => {
      if (this.isSyncing) {
        // Skip this poll if already syncing
        return;
      }

      try {
        // Check for changes by comparing timestamps
        const hasChanges = await this.checkForChanges();
        if (hasChanges) {
          this.logger.info('Periodic poll detected changes, triggering sync...');
          this.scheduleDebouncedSync();
        }
      } catch (error) {
        this.logger.error('Error during periodic poll:', error);
      }
    }, this.POLLING_INTERVAL);
  }

  /**
   * Calculate MD5 hash of a file (first 64KB only for performance)
   * @param {string} filePath - Path to file
   * @returns {Promise<string>} - MD5 hash
   */
  async calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath, { start: 0, end: 65535 }); // First 64KB

      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Compare the first 64KB of a repository file against its mirrored copy
   * @param {string} filename - File name, relative to repository and mirror
   * @param {string} sourcePath - Absolute path in the repository
   * @returns {Promise<boolean>} - True if the mirror is missing or out of date
   */
  async hasContentChanged(filename, sourcePath) {
    const mirrorPath = path.join(this.mirrorPath, filename);

    try {
      await fs.promises.access(mirrorPath);
    } catch (error) {
      this.logger.info(`[Polling] Mirror file missing: ${filename}`);
      return true;
    }

    try {
      const [sourceHash, mirrorHash] = await Promise.all([
        this.calculateFileHash(sourcePath),
        this.calculateFileHash(mirrorPath)
      ]);

      if (sourceHash !== mirrorHash) {
        this.logger.info(`[Polling] Content change detected in file (hash mismatch): ${filename}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`[Polling] Error checking hash for ${filename}:`, error.message);
      return false;
    }
  }

  /**
   * Check if there are changes in the repository
   */
  async checkForChanges() {
    try {
      const files = await fs.promises.readdir(this.repositoryPath);

      // Count only JPG files
      const jpgFiles = files.filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ext === '.jpg' || ext === '.jpeg';
      });

      // Quick check: if file count changed, trigger sync immediately
      if (jpgFiles.length !== this.mirrorIndex.size) {
        this.logger.info(`[Polling] File count mismatch detected (${jpgFiles.length} vs ${this.mirrorIndex.size}) - triggering sync`);
        return true;
      }

      if (jpgFiles.length === 0) {
        return false;
      }

      // The watch scan already compares size and mtime on every file, so
      // re-checking all of them here would be redundant. This only samples a
      // slice, advancing the cursor each poll so every file is eventually
      // covered, and compares content to catch replacements that kept their
      // metadata (the copy-over case the watcher cannot detect).
      const sampleSize = Math.min(this.CONTENT_CHECK_SAMPLE_SIZE, jpgFiles.length);

      for (let i = 0; i < sampleSize; i++) {
        const file = jpgFiles[(this.contentCheckCursor + i) % jpgFiles.length];
        const filenameLower = file.toLowerCase();
        const sourcePath = path.join(this.repositoryPath, file);
        const mirrorEntry = this.mirrorIndex.get(filenameLower);

        if (!mirrorEntry) {
          this.logger.info(`[Polling] New file detected: ${file}`);
          this.forceResyncFiles.add(filenameLower);
          this.emit('repository-changed', { type: 'add', filename: file });
          return true;
        }

        let stats;
        try {
          stats = await fs.promises.stat(sourcePath);
        } catch (error) {
          // File disappeared between readdir and stat
          continue;
        }

        if (stats.mtimeMs !== mirrorEntry.mtime || stats.size !== mirrorEntry.size) {
          this.logger.info(`[Polling] Change detected in file: ${file} (mtime: ${mirrorEntry.mtime} -> ${stats.mtimeMs}, size: ${mirrorEntry.size} -> ${stats.size})`);
          this.forceResyncFiles.add(filenameLower);
          this.emit('repository-changed', { type: 'change', filename: file });
          return true;
        }

        if (await this.hasContentChanged(file, sourcePath)) {
          this.forceResyncFiles.add(filenameLower);
          this.emit('repository-changed', { type: 'change', filename: file });
          return true;
        }
      }

      this.contentCheckCursor = (this.contentCheckCursor + sampleSize) % jpgFiles.length;
      return false;
    } catch (error) {
      this.logger.error('Error checking for changes:', error);
      return false;
    }
  }

  /**
   * Stop periodic polling
   */
  stopPeriodicPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      this.logger.info('Periodic polling stopped');
    }
  }

  /**
   * Stop watching the repository folder
   *
   * Takes effect immediately: a scan already in flight finishes but reports
   * nothing, and no further scan is scheduled.
   *
   * @returns {Promise<void>}
   */
  async stopWatch() {
    if (this.watchEnabled || this.watchTimer) {
      this.logger.info('Stopping repository folder watch...');
      this.watchEnabled = false;
      this.watchGeneration++;
      this.watchSnapshot = null;

      if (this.watchTimer) {
        clearTimeout(this.watchTimer);
        this.watchTimer = null;
      }

      // Clear any pending debounced sync
      if (this.syncDebounceTimer) {
        clearTimeout(this.syncDebounceTimer);
        this.syncDebounceTimer = null;
      }

      this.logger.success('Repository folder watch stopped');
    }

    // Also stop periodic polling
    this.stopPeriodicPolling();
  }

  /**
   * Check if watching is enabled
   */
  isWatching() {
    return this.watchEnabled;
  }

  /**
   * Force a full resync of all repository files
   * Used for manual refresh from menu
   */
  async forceFullResync() {
    this.logger.info('[Manual Refresh] Forcing full repository resync');

    try {
      // Start a new sync which will compare all files
      await this.startSync();
      this.logger.success('[Manual Refresh] Repository resync completed');
    } catch (error) {
      this.logger.error('[Manual Refresh] Error during resync:', error);
      throw error;
    }
  }
}

module.exports = RepositoryMirror;
