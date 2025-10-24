/**
 * Repository file cache management utilities
 */

// Cache configuration
const REPOSITORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const REPOSITORY_BATCH_WINDOW_MS = 600; // 600ms batching window

/**
 * Repository cache state
 */
class RepositoryCacheManager {
  constructor() {
    this.fileCache = new Map();
    this.cacheReady = false;
    this.cacheTimestamp = null;
    this.pendingEvents = new Map();
    this.flushTimer = null;
  }

  /**
   * Invalidate the repository file cache
   */
  invalidateCache() {
    this.fileCache.clear();
    this.cacheReady = false;
    this.cacheTimestamp = null;
  }

  /**
   * Check if cache is still valid
   * @returns {boolean} True if cache is valid
   */
  isCacheValid() {
    if (!this.cacheTimestamp) return false;
    const now = Date.now();
    return (now - this.cacheTimestamp) < REPOSITORY_CACHE_TTL;
  }

  /**
   * Load all files from repository folder asynchronously
   * Uses repository mirror when available to avoid blocking file system operations
   * @param {Object} repositoryMirror - Repository mirror instance
   * @param {Object} logger - Logger instance
   * @returns {Promise<Set<string>>} Set of lowercase filenames
   */
  async loadRepositoryFileList(repositoryMirror, logger) {
    try {
      // Use mirror if available
      if (repositoryMirror && repositoryMirror.mirrorIndex.size > 0) {
        logger.info(`Using repository mirror: ${repositoryMirror.mirrorIndex.size} files`);
        return new Set(repositoryMirror.getAllFiles());
      }

      // Mirror not ready yet - return empty Set
      // The mirror will populate as sync completes
      logger.info('Repository mirror not ready yet, returning empty set');
      return new Set();
    } catch (error) {
      logger.error('Error loading repository file list', error);
      return new Set();
    }
  }

  /**
   * Check if a file exists in the repository using cached file list
   * @param {string} identifier - The user identifier (NIA or document)
   * @param {Set<string>} fileSet - Set of repository filenames
   * @returns {string|null} The actual filename if found, null otherwise
   */
  findRepositoryFile(identifier, fileSet) {
    if (!identifier || !fileSet) {
      return null;
    }

    // Check both .jpg and .jpeg extensions (case-insensitive)
    const jpgFilename = `${identifier}.jpg`.toLowerCase();
    const jpegFilename = `${identifier}.jpeg`.toLowerCase();

    if (fileSet.has(jpgFilename)) {
      return `${identifier}.jpg`;
    } else if (fileSet.has(jpegFilename)) {
      return `${identifier}.jpeg`;
    }

    return null;
  }

  /**
   * Schedule a flush of pending repository events
   * @param {Function} callback - Callback to execute when flushing
   */
  scheduleFlush(callback) {
    if (this.flushTimer) return; // Already scheduled

    this.flushTimer = setTimeout(() => {
      callback();
      this.flushTimer = null;
    }, REPOSITORY_BATCH_WINDOW_MS);
  }

  /**
   * Flush accumulated repository events
   * @param {Object} logger - Logger instance
   * @param {Function} callback - Callback to execute after flushing
   */
  flushEvents(logger, callback) {
    if (this.pendingEvents.size === 0) return;

    logger.info(`Flushing ${this.pendingEvents.size} repository events`);

    // Invalidate cache once for all events
    this.invalidateCache();

    // Execute callback (e.g., send notification to renderer)
    if (callback) {
      callback();
    }

    this.pendingEvents.clear();
  }

  /**
   * Add a pending repository event
   * @param {string} filePath - File path that changed
   * @param {string} eventType - Type of event (add, change, unlink)
   */
  addPendingEvent(filePath, eventType) {
    this.pendingEvents.set(filePath, { eventType, filePath });
  }
}

module.exports = {
  RepositoryCacheManager,
  REPOSITORY_CACHE_TTL,
  REPOSITORY_BATCH_WINDOW_MS
};