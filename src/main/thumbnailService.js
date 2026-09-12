const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg']);

/**
 * Thumbnail Service
 *
 * Builds and caches small copies of user photos.
 *
 * Photos are full resolution ID pictures, but most of the interface shows them
 * at 32 or 150 pixels. Pointing an <img> at the original makes the browser
 * decode megapixels to paint a thumbnail, once per image and again whenever the
 * row is recycled, which is the single largest cost in the user list.
 */
class ThumbnailService {
  /**
   * @param {string} cacheDir - Folder to keep generated thumbnails in
   * @param {Object} logger - Logger instance
   */
  constructor(cacheDir, logger) {
    this.cacheDir = cacheDir;
    this.logger = logger;

    // Generations in flight, so a screenful of rows asking for the same photo
    // at once produces one resize instead of many
    this.pending = new Map();
    this.cacheDirReady = null;
  }

  /**
   * @param {string} filePath
   * @returns {boolean} True if the file is a format we can resize
   */
  isSupported(filePath) {
    return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
  }

  /**
   * @private
   */
  ensureCacheDir() {
    if (!this.cacheDirReady) {
      this.cacheDirReady = fs.promises.mkdir(this.cacheDir, { recursive: true });
    }

    return this.cacheDirReady;
  }

  /**
   * Name a cached thumbnail after the source it came from
   *
   * The modification time is part of the key, so replacing a photo produces a
   * different name and the stale thumbnail is simply never asked for again.
   *
   * @private
   */
  cacheKey(sourcePath, mtimeMs, size) {
    const hash = crypto
      .createHash('sha1')
      .update(`${sourcePath.toLowerCase()}|${mtimeMs}|${size}`)
      .digest('hex');

    return `${hash}.jpg`;
  }

  /**
   * Path to a cached thumbnail, building it if it does not exist yet
   *
   * @param {string} sourcePath - Absolute path of the original image
   * @param {number} size - Longest side, in pixels
   * @returns {Promise<string>} Path of the thumbnail on disk
   */
  async getThumbnail(sourcePath, size) {
    const stats = await fs.promises.stat(sourcePath);
    const cachePath = path.join(this.cacheDir, this.cacheKey(sourcePath, stats.mtimeMs, size));

    try {
      await fs.promises.access(cachePath);
      return cachePath;
    } catch (error) {
      // Not built yet
    }

    const inFlight = this.pending.get(cachePath);
    if (inFlight) {
      return inFlight;
    }

    const work = this.generate(sourcePath, cachePath, size).finally(() => {
      this.pending.delete(cachePath);
    });

    this.pending.set(cachePath, work);
    return work;
  }

  /**
   * @private
   */
  async generate(sourcePath, cachePath, size) {
    await this.ensureCacheDir();

    // Required here rather than at the top of the file: sharp is a native
    // module and loading it is slow enough to be worth deferring until an
    // image actually needs resizing
    const sharp = require('sharp');

    // Written under a temporary name first, so an interrupted write cannot
    // leave a truncated file that later reads would accept as a thumbnail
    const tempPath = `${cachePath}.${process.pid}.tmp`;

    try {
      await sharp(sourcePath)
        .rotate()
        .resize(size, size, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(tempPath);

      await fs.promises.rename(tempPath, cachePath);
      return cachePath;
    } catch (error) {
      await fs.promises.rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }
  }

  /**
   * Delete every cached thumbnail
   * @returns {Promise<void>}
   */
  async clearCache() {
    this.cacheDirReady = null;

    try {
      await fs.promises.rm(this.cacheDir, { recursive: true, force: true });
      this.logger.info('Thumbnail cache cleared');
    } catch (error) {
      this.logger.warning(`Could not clear the thumbnail cache: ${error.message}`);
    }
  }
}

module.exports = ThumbnailService;
