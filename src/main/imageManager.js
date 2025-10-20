const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

class ImageManager {
  constructor(importsPath) {
    this.importsPath = importsPath;
    this.imageCache = null;
    this.cacheTimestamp = null;
  }

  /**
   * Invalidate the image cache
   * Should be called when the folder watcher detects changes
   */
  invalidateCache() {
    this.imageCache = null;
    this.cacheTimestamp = null;
  }

  async getImages(useCache = true) {
    try {
      // Return cached images if available and caching is enabled
      if (useCache && this.imageCache !== null) {
        return this.imageCache;
      }

      // Check if directory exists using sync for simplicity (fast operation)
      if (!fsSync.existsSync(this.importsPath)) {
        this.imageCache = [];
        this.cacheTimestamp = Date.now();
        return [];
      }

      // Use async readdir instead of sync
      const files = await fs.readdir(this.importsPath);

      // Filter for JPG files only
      const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ext === '.jpg' || ext === '.jpeg';
      });

      // Sort by filename descending (newest first)
      imageFiles.sort().reverse();

      // Return full paths
      const imagePaths = imageFiles.map(file => path.join(this.importsPath, file));

      // Update cache
      this.imageCache = imagePaths;
      this.cacheTimestamp = Date.now();

      return imagePaths;
    } catch (error) {
      console.error('Error getting images:', error);
      return [];
    }
  }

  async deleteImage(imagePath) {
    try {
      // Use async unlink instead of sync
      await fs.unlink(imagePath);

      // Invalidate cache after deletion
      this.invalidateCache();

      return true;
    } catch (error) {
      // If file doesn't exist, ENOENT error is thrown
      if (error.code === 'ENOENT') {
        return false;
      }
      console.error('Error deleting image:', error);
      return false;
    }
  }

  async getImageInfo(imagePath) {
    try {
      // Use async stat instead of sync
      const stats = await fs.stat(imagePath);
      return {
        path: imagePath,
        filename: path.basename(imagePath),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
    } catch (error) {
      // If file doesn't exist, ENOENT error is thrown
      if (error.code === 'ENOENT') {
        return null;
      }
      console.error('Error getting image info:', error);
      return null;
    }
  }
}

module.exports = ImageManager;
