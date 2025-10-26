const fs = require('fs');
const path = require('path');
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
      const sourcePath = path.join(this.repositoryPath, file);
      const destPath = path.join(this.mirrorPath, file);

      try {
        // Copy file
        await fs.promises.copyFile(sourcePath, destPath);

        // Update index
        const stats = await fs.promises.stat(destPath);
        this.mirrorIndex.set(file.toLowerCase(), {
          size: stats.size,
          mtime: stats.mtimeMs,
          synced: true
        });

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
        this.emit('repository-changed', { type: 'add', filename });
        this.scheduleDebouncedSync();
      });

      // File changed
      this.watcher.on('change', (filePath) => {
        const filename = path.basename(filePath);
        this.logger.info(`Repository file changed: ${filename}`);
        this.emit('repository-changed', { type: 'change', filename });
        this.scheduleDebouncedSync();
      });

      // File removed
      this.watcher.on('unlink', (filePath) => {
        const filename = path.basename(filePath);
        this.logger.info(`Repository file removed: ${filename}`);
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
  }

  /**
   * Check if watching is enabled
   */
  isWatching() {
    return this.watchEnabled;
  }
}

module.exports = RepositoryMirror;
