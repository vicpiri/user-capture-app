/**
 * ImageGridManager - Manages the image preview panel
 *
 * Handles loading, displaying, and navigating through captured images.
 * Provides callbacks for image selection and tag loading.
 *
 * Features:
 * - Load images from filesystem
 * - Navigate between images (prev/next)
 * - Display image preview
 * - Track current image selection
 * - Notify when image changes (for tag loading)
 */

(function(global) {
  'use strict';

  class ImageGridManager {
    constructor(config = {}) {
      // Required DOM elements
      this.imagePreviewContainer = config.imagePreviewContainer;
      this.currentImage = config.currentImage;

      // Required callbacks
      this.getImages = config.getImages; // Function to fetch images from backend
      this.onImageChange = config.onImageChange || (() => {}); // Called when image changes (for tag loading)

      // State
      this.images = [];
      this.currentIndex = 0;
      this.isActive = false;
    }

    /**
     * Load images from backend
     * @param {boolean} showLatest - If true, show the latest (newest) image
     * @returns {Promise<boolean>} Success status
     */
    async loadImages(showLatest = true) {
      if (!this.getImages) {
        console.warn('[ImageGridManager] getImages callback not configured');
        return false;
      }

      try {
        const result = await this.getImages();

        if (result.success) {
          const previousLength = this.images.length;
          this.images = result.images;

          if (this.images.length > 0) {
            // If new image was added and showLatest is true, show the latest one
            if (showLatest && this.images.length > previousLength) {
              this.currentIndex = 0; // Newest image is first
            }
            this.showPreview();
            return true;
          }
        }

        return false;
      } catch (error) {
        console.error('[ImageGridManager] Error loading images:', error);
        return false;
      }
    }

    /**
     * Show preview of current image
     */
    showPreview() {
      if (this.images.length === 0) return;

      if (!this.imagePreviewContainer || !this.currentImage) {
        console.warn('[ImageGridManager] DOM elements not configured');
        return;
      }

      // Show container and update image
      this.imagePreviewContainer.classList.add('active');
      this.currentImage.src = `file://${this.images[this.currentIndex]}`;
      this.isActive = true;

      // Notify about image change (for tag loading, etc.)
      this.onImageChange(this.getCurrentImagePath());
    }

    /**
     * Navigate to next or previous image
     * @param {number} direction - 1 for next, -1 for previous
     */
    navigate(direction) {
      if (this.images.length === 0) return;

      this.currentIndex += direction;

      // Wrap around
      if (this.currentIndex < 0) {
        this.currentIndex = this.images.length - 1;
      } else if (this.currentIndex >= this.images.length) {
        this.currentIndex = 0;
      }

      // Update image
      if (this.currentImage) {
        this.currentImage.src = `file://${this.images[this.currentIndex]}`;
      }

      // Notify about image change
      this.onImageChange(this.getCurrentImagePath());
    }

    /**
     * Navigate to next image
     */
    next() {
      this.navigate(1);
    }

    /**
     * Navigate to previous image
     */
    previous() {
      this.navigate(-1);
    }

    /**
     * Hide image preview
     */
    hide() {
      if (this.imagePreviewContainer) {
        this.imagePreviewContainer.classList.remove('active');
        this.isActive = false;
      }
    }

    /**
     * Show image at specific index
     * @param {number} index - Image index to show
     * @returns {boolean} Success status
     */
    showImageAtIndex(index) {
      if (index < 0 || index >= this.images.length) {
        return false;
      }

      this.currentIndex = index;
      this.showPreview();
      return true;
    }

    /**
     * Find and show specific image by path
     * @param {string} imagePath - Path of image to show
     * @returns {boolean} Success status
     */
    showImageByPath(imagePath) {
      const index = this.images.indexOf(imagePath);
      if (index !== -1) {
        return this.showImageAtIndex(index);
      }
      return false;
    }

    /**
     * Get current image path
     * @returns {string|null} Current image path or null if no image
     */
    getCurrentImagePath() {
      if (this.images.length === 0) return null;
      return this.images[this.currentIndex];
    }

    /**
     * Get current image index
     * @returns {number} Current index
     */
    getCurrentIndex() {
      return this.currentIndex;
    }

    /**
     * Get total number of images
     * @returns {number} Total images
     */
    getImageCount() {
      return this.images.length;
    }

    /**
     * Check if preview is active (image selected)
     * @returns {boolean} True if active
     */
    isPreviewActive() {
      return this.isActive && this.images.length > 0;
    }

    /**
     * Get all image paths
     * @returns {string[]} Array of image paths
     */
    getAllImages() {
      return [...this.images];
    }

    /**
     * Set detecting state (show spinner/loading indicator)
     * @param {boolean} isDetecting - Whether detection is in progress
     */
    setDetecting(isDetecting) {
      if (this.imagePreviewContainer) {
        if (isDetecting) {
          this.imagePreviewContainer.classList.add('detecting-image');
        } else {
          this.imagePreviewContainer.classList.remove('detecting-image');
        }
      }
    }

    /**
     * Clear all images
     */
    clear() {
      this.images = [];
      this.currentIndex = 0;
      this.hide();
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ImageGridManager };
  } else if (typeof window !== 'undefined') {
    global.ImageGridManager = ImageGridManager;
  }
})(typeof window !== 'undefined' ? window : global);
