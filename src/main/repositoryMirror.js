const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const chokidar = require('chokidar');

/**
 * Repository Mirror Manager
 *
 * Creates a local mirror of the repository folder to avoid blocking on network drives.
 * Synchronizes files in small batches to keep the UI responsive.
 * Watches for changes in the repository and automatically syncs them.
 */
class RepositoryMirror extends EventEmitter {
  constructor(repositoryPath, mirrorPath, logger) {
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
    this.watcher = null;
    this.watchEnabled = false;
    this.syncDebounceTimer = null;
    this.SYNC_DEBOUNCE_DELAY = 2000; // Wait 2 seconds after last change before syncing
    this.forceResyncFiles = new Set(); // Files that must be re-synced regardless of metadata
    this.pollingTimer = null; // Periodic polling timer
    this.POLLING_INTERVAL = 5000; // Check for changes every 5 seconds

    // Batch configuration
    this.BATCH_SIZE = 50;  // Process 50 files at a time
    this.YIELD_INTERVAL = 100;  // Yield to event loop every 100ms
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
   */
  async determineFilesToSync(repositoryFiles) {
    const filesToSync = [];

    for (let i = 0; i < repositoryFiles.length; i += this.BATCH_SIZE) {
      if (this.syncAborted) break;

      const batch = repositoryFiles.slice(i, i + this.BATCH_SIZE);

      for (const file of batch) {
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

        // Check if file has changed (size or mtime)
        try {
          const sourcePath = path.join(this.repositoryPath, file);
          const stats = await fs.promises.stat(sourcePath);

          if (stats.size !== mirrorEntry.size || stats.mtimeMs !== mirrorEntry.mtime) {
            // File has changed
            filesToSync.push(file);
          }
        } catch (error) {
          // File might not exist anymore, skip it
          this.logger.warning(`Could not stat repository file: ${file}`);
        }
      }

      // Yield to event loop between batches
      if (i + this.BATCH_SIZE < repositoryFiles.length) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    return filesToSync;
  }

  /**
   * Sync files from repository to mirror in batches
   */
  async syncFiles(filesToSync) {
    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < filesToSync.length; i++) {
      if (this.syncAborted) break;

      const file = filesToSync[i];
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

      // Yield to event loop periodically
      if (i % 10 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }

      // Emit progress
      this.emit('sync-progress', {
        phase: 'syncing',
        current: i + 1,
        total: filesToSync.length,
        synced,
        errors
      });
    }

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

      // Create chokidar watcher
      this.watcher = chokidar.watch(this.repositoryPath, {
        persistent: true,
        ignoreInitial: true, // Don't trigger events for existing files
        usePolling: true, // Use polling for better compatibility with network drives and certain file systems
        interval: 1000, // Poll every second
        awaitWriteFinish: {
          stabilityThreshold: 500, // Wait 500ms for file to finish writing
          pollInterval: 100
        },
        // Only watch jpg/jpeg files
        ignored: (filePath) => {
          const ext = path.extname(filePath).toLowerCase();
          return ext !== '.jpg' && ext !== '.jpeg';
        }
      });

      // File added
      this.watcher.on('add', (filePath) => {
        const filename = path.basename(filePath);
        this.logger.info(`Repository file added: ${filename}`);
        this.forceResyncFiles.add(filename.toLowerCase());
        this.emit('repository-changed', { type: 'add', filename });
        this.scheduleDebouncedSync();
      });

      // File changed
      this.watcher.on('change', (filePath) => {
        const filename = path.basename(filePath);
        this.logger.info(`Repository file changed: ${filename}`);
        this.forceResyncFiles.add(filename.toLowerCase());
        this.emit('repository-changed', { type: 'change', filename });
        this.scheduleDebouncedSync();
      });

      // File removed
      this.watcher.on('unlink', (filePath) => {
        const filename = path.basename(filePath);
        this.logger.info(`Repository file removed: ${filename}`);
        this.forceResyncFiles.add(filename.toLowerCase());
        this.emit('repository-changed', { type: 'unlink', filename });
        this.scheduleDebouncedSync();
      });

      // Error handling
      this.watcher.on('error', (error) => {
        this.logger.error('Repository watcher error:', error);
      });

      // Wait for watcher to be ready
      await new Promise((resolve) => {
        this.watcher.on('ready', () => {
          this.watchEnabled = true;
          this.logger.success('Repository folder watch started');
          resolve();
        });
      });

      // Also start periodic polling as a fallback for detecting changes
      this.startPeriodicPolling();

      return true;
    } catch (error) {
      this.logger.error('Error starting repository watch:', error);
      return false;
    }
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

      this.logger.info(`[Polling] Checking repository: ${jpgFiles.length} JPG files, ${this.mirrorIndex.size} in mirror index`);

      // Quick check: if file count changed, trigger sync immediately
      if (jpgFiles.length !== this.mirrorIndex.size) {
        this.logger.info(`[Polling] File count mismatch detected (${jpgFiles.length} vs ${this.mirrorIndex.size}) - triggering sync`);
        return true;
      }

      // Get file stats for all JPG files to sort by modification time
      const fileStats = [];
      for (const file of jpgFiles) {
        try {
          const sourcePath = path.join(this.repositoryPath, file);
          const stats = await fs.promises.stat(sourcePath);
          fileStats.push({ file, stats, sourcePath });
        } catch (error) {
          // File might have been deleted
          this.logger.info(`[Polling] File inaccessible: ${file}`);
        }
      }

      // Sort by modification time (most recent first)
      fileStats.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

      // Strategy: Check a random sample of 50 files with hash verification
      // This catches file replacements regardless of when they were modified
      const sampleSize = Math.min(50, fileStats.length);
      const step = Math.floor(fileStats.length / sampleSize);

      this.logger.info(`[Polling] Checking ${sampleSize} random files with hash verification (step: ${step})`);

      for (let i = 0; i < sampleSize; i++) {
        const index = i * step;
        const { file, stats, sourcePath } = fileStats[index];
        const filenameLower = file.toLowerCase();
        const mirrorEntry = this.mirrorIndex.get(filenameLower);

        if (!mirrorEntry) {
          // New file found
          this.logger.info(`[Polling] New file detected: ${file}`);
          // Mark it for force resync
          this.forceResyncFiles.add(filenameLower);
          this.emit('repository-changed', { type: 'add', filename: file });
          return true;
        }

        // First quick check: mtime or size changed
        const mtimeChanged = stats.mtimeMs !== mirrorEntry.mtime;
        const sizeChanged = stats.size !== mirrorEntry.size;

        if (mtimeChanged || sizeChanged) {
          this.logger.info(`[Polling] Change detected in file: ${file} (mtime: ${mirrorEntry.mtime} -> ${stats.mtimeMs}, size: ${mirrorEntry.size} -> ${stats.size})`);
          // Mark it for force resync
          this.forceResyncFiles.add(filenameLower);
          this.emit('repository-changed', { type: 'change', filename: file });
          return true;
        }

        // Always check hash for sampled files to catch Windows copy-over behavior
        try {
          const sourceHash = await this.calculateFileHash(sourcePath);
          const mirrorPath = path.join(this.mirrorPath, file);

          if (fs.existsSync(mirrorPath)) {
            const mirrorHash = await this.calculateFileHash(mirrorPath);

            // Log first 3 files for debugging
            if (i < 3) {
              this.logger.info(`[Polling] Hash check: ${file} - source: ${sourceHash.substring(0, 8)}, mirror: ${mirrorHash.substring(0, 8)}, match: ${sourceHash === mirrorHash}`);
            }

            if (sourceHash !== mirrorHash) {
              this.logger.info(`[Polling] Content change detected in file (hash mismatch): ${file}`);
              this.forceResyncFiles.add(filenameLower);
              this.emit('repository-changed', { type: 'change', filename: file });
              return true;
            }
          } else {
            // Mirror file doesn't exist
            this.logger.info(`[Polling] Mirror file missing: ${file}`);
            this.forceResyncFiles.add(filenameLower);
            this.emit('repository-changed', { type: 'change', filename: file });
            return true;
          }
        } catch (error) {
          this.logger.error(`[Polling] Error checking hash for ${file}:`, error.message);
        }
      }

      this.logger.info('[Polling] No changes detected');
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
   */
  stopWatch() {
    if (this.watcher) {
      this.logger.info('Stopping repository folder watch...');
      this.watcher.close();
      this.watcher = null;
      this.watchEnabled = false;

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
