const fs = require('fs');
const path = require('path');

class ImageManager {
  constructor(importsPath) {
    this.importsPath = importsPath;
  }

  async getImages() {
    try {
      if (!fs.existsSync(this.importsPath)) {
        return [];
      }

      const files = fs.readdirSync(this.importsPath);

      // Filter for JPG files only
      const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ext === '.jpg' || ext === '.jpeg';
      });

      // Sort by filename (which includes timestamp)
      imageFiles.sort();

      // Return full paths
      return imageFiles.map(file => path.join(this.importsPath, file));
    } catch (error) {
      console.error('Error getting images:', error);
      return [];
    }
  }

  async deleteImage(imagePath) {
    try {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting image:', error);
      return false;
    }
  }

  async getImageInfo(imagePath) {
    try {
      if (!fs.existsSync(imagePath)) {
        return null;
      }

      const stats = fs.statSync(imagePath);
      return {
        path: imagePath,
        filename: path.basename(imagePath),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
    } catch (error) {
      console.error('Error getting image info:', error);
      return null;
    }
  }
}

module.exports = ImageManager;
