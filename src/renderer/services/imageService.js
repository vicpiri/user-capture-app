/**
 * Image Service
 *
 * Handles all image-related operations (captured images, repository images, linking).
 * Wraps window.electronAPI calls for image management.
 *
 * @module services/imageService
 */

class ImageService {
  constructor() {
    this.electronAPI = window.electronAPI;
  }

  /**
   * Get all captured images
   * @returns {Promise<object>} Result with images array
   */
  async getCapturedImages() {
    try {
      console.log('[ImageService] Getting captured images');
      const result = await this.electronAPI.getCapturedImages();
      console.log(`[ImageService] Got ${result.images?.length || 0} captured images`);
      return result;
    } catch (error) {
      console.error('[ImageService] Error getting captured images:', error);
      throw error;
    }
  }

  /**
   * Get image by ID
   * @param {number} imageId - Image ID
   * @returns {Promise<object>} Result with image data
   */
  async getImageById(imageId) {
    try {
      console.log('[ImageService] Getting image by ID:', imageId);
      const result = await this.electronAPI.getImageById(imageId);
      return result;
    } catch (error) {
      console.error('[ImageService] Error getting image:', error);
      throw error;
    }
  }

  /**
   * Link image to user
   * @param {number} userId - User ID
   * @param {number} imageId - Image ID
   * @returns {Promise<object>} Result
   */
  async linkImageToUser(userId, imageId) {
    try {
      console.log('[ImageService] Linking image to user:', { userId, imageId });
      const result = await this.electronAPI.linkImageToUser(userId, imageId);
      console.log('[ImageService] Image linked to user');
      return result;
    } catch (error) {
      console.error('[ImageService] Error linking image:', error);
      throw error;
    }
  }

  /**
   * Unlink image from user
   * @param {number} userId - User ID
   * @returns {Promise<object>} Result
   */
  async unlinkImageFromUser(userId) {
    try {
      console.log('[ImageService] Unlinking image from user:', userId);
      const result = await this.electronAPI.unlinkImageFromUser(userId);
      console.log('[ImageService] Image unlinked from user');
      return result;
    } catch (error) {
      console.error('[ImageService] Error unlinking image:', error);
      throw error;
    }
  }

  /**
   * Delete captured image
   * @param {number} imageId - Image ID
   * @returns {Promise<object>} Result
   */
  async deleteCapturedImage(imageId) {
    try {
      console.log('[ImageService] Deleting captured image:', imageId);
      const result = await this.electronAPI.deleteCapturedImage(imageId);
      console.log('[ImageService] Image deleted');
      return result;
    } catch (error) {
      console.error('[ImageService] Error deleting image:', error);
      throw error;
    }
  }

  /**
   * Check if image exists in repository
   * @param {string} filename - Image filename
   * @returns {Promise<object>} Result with exists boolean
   */
  async checkRepositoryImage(filename) {
    try {
      const result = await this.electronAPI.checkRepositoryImage(filename);
      return result;
    } catch (error) {
      console.error('[ImageService] Error checking repository image:', error);
      throw error;
    }
  }

  /**
   * Get repository image path
   * @param {string} filename - Image filename
   * @returns {Promise<object>} Result with path
   */
  async getRepositoryImagePath(filename) {
    try {
      const result = await this.electronAPI.getRepositoryImagePath(filename);
      return result;
    } catch (error) {
      console.error('[ImageService] Error getting repository image path:', error);
      throw error;
    }
  }

  /**
   * Add tag to image
   * @param {number} imageId - Image ID
   * @param {string} tag - Tag text
   * @returns {Promise<object>} Result
   */
  async addImageTag(imageId, tag) {
    try {
      console.log('[ImageService] Adding tag to image:', { imageId, tag });
      const result = await this.electronAPI.addImageTag(imageId, tag);
      console.log('[ImageService] Tag added');
      return result;
    } catch (error) {
      console.error('[ImageService] Error adding tag:', error);
      throw error;
    }
  }

  /**
   * Get images with tags
   * @returns {Promise<object>} Result with tagged images
   */
  async getTaggedImages() {
    try {
      console.log('[ImageService] Getting tagged images');
      const result = await this.electronAPI.getTaggedImages();
      console.log(`[ImageService] Got ${result.images?.length || 0} tagged images`);
      return result;
    } catch (error) {
      console.error('[ImageService] Error getting tagged images:', error);
      throw error;
    }
  }

  /**
   * Import images from folder
   * @param {string} folderPath - Source folder path
   * @returns {Promise<object>} Result with import stats
   */
  async importImages(folderPath) {
    try {
      console.log('[ImageService] Importing images from:', folderPath);
      const result = await this.electronAPI.importImages(folderPath);
      console.log('[ImageService] Images imported:', result);
      return result;
    } catch (error) {
      console.error('[ImageService] Error importing images:', error);
      throw error;
    }
  }

  /**
   * Export images
   * @param {object} options - Export options
   * @param {string} options.format - Export format ('id' or 'name')
   * @param {string} options.destination - Destination folder
   * @param {number} options.maxWidth - Max width for resize
   * @param {number} options.maxHeight - Max height for resize
   * @returns {Promise<object>} Result with export stats
   */
  async exportImages(options) {
    try {
      console.log('[ImageService] Exporting images:', options);
      const result = await this.electronAPI.exportImages(options);
      console.log('[ImageService] Images exported:', result);
      return result;
    } catch (error) {
      console.error('[ImageService] Error exporting images:', error);
      throw error;
    }
  }

  /**
   * Export captured images to repository
   * @returns {Promise<object>} Result with export stats
   */
  async exportToRepository() {
    try {
      console.log('[ImageService] Exporting to repository');
      const result = await this.electronAPI.exportToRepository();
      console.log('[ImageService] Exported to repository:', result);
      return result;
    } catch (error) {
      console.error('[ImageService] Error exporting to repository:', error);
      throw error;
    }
  }
}

// Export singleton instance
const imageService = new ImageService();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ImageService, imageService };
}
