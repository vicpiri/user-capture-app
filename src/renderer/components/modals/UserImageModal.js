/**
 * UserImageModal - Modal for displaying user image preview
 *
 * Displays a large preview of a user's captured or repository image.
 * Extends BaseModal for consistent modal behavior.
 *
 * Features:
 * - Shows user's full name in title
 * - Displays captured or repository image
 * - Labels repository images with "- Depósito"
 * - Simple close functionality
 */

(function(global) {
  'use strict';

  // Import BaseModal
  let BaseModal;
  if (typeof window !== 'undefined' && window.BaseModal) {
    BaseModal = window.BaseModal;
  } else if (typeof require !== 'undefined') {
    ({ BaseModal } = require('../../core/BaseModal'));
  }

  class UserImageModal extends BaseModal {
    constructor(modalId = 'user-image-modal') {
      super(modalId);

      // Get DOM elements
      this.titleElement = document.getElementById('user-image-modal-title');
      this.imageElement = document.getElementById('user-image-preview');
      this.closeBtn = document.getElementById('user-image-close-btn');

      this.init();
    }

    init() {
      if (!this.modal || !this.closeBtn) {
        console.warn('[UserImageModal] Required elements not found');
        return;
      }

      // Setup close button
      this.closeBtn.addEventListener('click', () => this.close());

      console.log('[UserImageModal] Initialized');
    }

    /**
     * Show modal with user image
     * @param {Object} user - User object
     * @param {string} imageType - 'captured' or 'repository'
     */
    show(user, imageType = 'captured') {
      if (!this.modal) {
        console.warn('[UserImageModal] Modal element not found');
        return;
      }

      // Set title with user's name and image type
      this.setTitle(user, imageType);

      // Set image based on type
      this.setImage(user, imageType);

      // Show modal
      this.modal.classList.add('show');

      console.log(`[UserImageModal] Showing ${imageType} image for ${user.first_name}`);
    }

    /**
     * Set modal title with user's name
     * @param {Object} user - User object
     * @param {string} imageType - 'captured' or 'repository'
     */
    setTitle(user, imageType) {
      if (!this.titleElement) return;

      const fullName = `${user.first_name} ${user.last_name1} ${user.last_name2 || ''}`.trim();
      const imageLabel = imageType === 'repository' ? ' - Depósito' : '';

      this.titleElement.textContent = fullName + imageLabel;
    }

    /**
     * Set image source
     * @param {Object} user - User object
     * @param {string} imageType - 'captured' or 'repository'
     */
    setImage(user, imageType) {
      if (!this.imageElement) return;

      const imagePath = imageType === 'repository'
        ? user.repository_image_path
        : user.image_path;

      if (imagePath) {
        this.imageElement.src = `file://${imagePath}`;
      } else {
        console.warn('[UserImageModal] No image path found');
        this.imageElement.src = '';
      }
    }

    /**
     * Close modal
     */
    close() {
      if (this.modal) {
        this.modal.classList.remove('show');
        console.log('[UserImageModal] Closed');
      }
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UserImageModal };
  } else if (typeof window !== 'undefined') {
    global.UserImageModal = UserImageModal;
  }
})(typeof window !== 'undefined' ? window : global);
