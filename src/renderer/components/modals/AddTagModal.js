/**
 * AddTagModal - Modal for adding tags to images
 *
 * Allows user to enter a tag text for selected image.
 *
 * @extends BaseModal
 */

const { BaseModal } = require('../../core/BaseModal');
const { imageService } = require('../../services');

class AddTagModal extends BaseModal {
  constructor() {
    super('add-tag-modal');

    // Form elements
    this.tagInput = null;
    this.confirmBtn = null;
    this.cancelBtn = null;

    // State
    this.currentImageId = null;
    this.resolvePromise = null;
    this.rejectPromise = null;
  }

  /**
   * Initialize modal
   */
  init() {
    super.init();

    if (!this.modal) return;

    // Find elements
    this.tagInput = this.modal.querySelector('#tag-input');
    this.confirmBtn = this.modal.querySelector('#add-tag-confirm-btn');
    this.cancelBtn = this.modal.querySelector('#add-tag-cancel-btn');

    // Setup event listeners
    this.addEventListener(this.confirmBtn, 'click', () => this.handleConfirm());
    this.addEventListener(this.cancelBtn, 'click', () => this.handleCancel());

    // Enter key to confirm
    this.addEventListener(this.tagInput, 'keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleConfirm();
      }
    });

    this._log('AddTagModal initialized');
  }

  /**
   * Show add tag dialog
   * @param {number} imageId - Image ID to tag
   * @returns {Promise<object|null>} Promise that resolves with tag result or null if cancelled
   */
  show(imageId) {
    return new Promise((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
      this.currentImageId = imageId;

      // Reset input
      if (this.tagInput) {
        this.tagInput.value = '';
      }

      // Open modal
      this.open();

      // Focus input
      setTimeout(() => {
        if (this.tagInput) {
          this.tagInput.focus();
        }
      }, 100);
    });
  }

  /**
   * Handle confirm button
   */
  async handleConfirm() {
    const tagText = this.tagInput ? this.tagInput.value.trim() : '';

    if (!tagText) {
      this._log('No tag text entered', 'warn');
      return;
    }

    if (!this.currentImageId) {
      this._log('No image ID set', 'error');
      return;
    }

    // Disable button
    this.confirmBtn.disabled = true;
    this.confirmBtn.textContent = 'Agregando...';

    try {
      this._log(`Adding tag "${tagText}" to image ${this.currentImageId}`);

      const result = await imageService.addImageTag(this.currentImageId, tagText);

      if (result.success) {
        this._log('Tag added successfully');
        this.close();

        if (this.resolvePromise) {
          this.resolvePromise({
            success: true,
            imageId: this.currentImageId,
            tag: tagText
          });
          this.resolvePromise = null;
          this.rejectPromise = null;
        }
      } else {
        this._log('Failed to add tag', 'error');
        throw new Error(result.error || 'Failed to add tag');
      }
    } catch (error) {
      console.error('[AddTagModal] Error adding tag:', error);
      alert('Error al agregar etiqueta: ' + error.message);
    } finally {
      this.confirmBtn.disabled = false;
      this.confirmBtn.textContent = 'Agregar';
    }
  }

  /**
   * Handle cancel button
   */
  handleCancel() {
    this._log('Tag addition cancelled');
    this.close();

    if (this.resolvePromise) {
      this.resolvePromise(null);
      this.resolvePromise = null;
      this.rejectPromise = null;
    }
  }

  /**
   * Override close to handle cancellation
   */
  close() {
    super.close();

    // If closed without action, resolve as null (cancelled)
    if (this.resolvePromise) {
      this.resolvePromise(null);
      this.resolvePromise = null;
      this.rejectPromise = null;
    }

    this.currentImageId = null;
  }

  /**
   * Internal logging
   * @private
   */
  _log(message, level = 'info') {
    const prefix = '[AddTagModal]';
    if (level === 'error') {
      console.error(prefix, message);
    } else if (level === 'warn') {
      console.warn(prefix, message);
    } else {
      console.log(prefix, message);
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AddTagModal };
}
