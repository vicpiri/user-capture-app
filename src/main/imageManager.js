const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

class ImageManager {
  constructor(importsPath) {
    this.importsPath = importsPath;
  }

  async getImages() {
    try {
      // Check if directory exists using sync for simplicity (fast operation)
      if (!fsSync.existsSync(this.importsPath)) {
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
      return imageFiles.map(file => path.join(this.importsPath, file));
    } catch (error) {
      console.error('Error getting images:', error);
      return [];
    }
  }

  async deleteImage(imagePath) {
    try {
      // Use async unlink instead of sync
      await fs.unlink(imagePath);
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
