/**
 * ExportOptionsModal - Modal for configuring image export options
 *
 * Allows user to choose between:
 * - Copy original images
 * - Resize images with custom dimensions and file size
 *
 * @extends BaseModal
 */

const { BaseModal } = require('../../core/BaseModal');

class ExportOptionsModal extends BaseModal {
  constructor() {
    super('export-options-modal');

    // Form elements
    this.copyOriginalRadio = null;
    this.resizeRadio = null;
    this.resizeOptionsContainer = null;
    this.boxSizeInput = null;
    this.maxSizeInput = null;
    this.confirmBtn = null;
    this.cancelBtn = null;

    // State
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
    this.copyOriginalRadio = this.modal.querySelector('#export-copy-original');
    this.resizeRadio = this.modal.querySelector('#export-resize-enabled');
    this.resizeOptionsContainer = this.modal.querySelector('#resize-options');
    this.boxSizeInput = this.modal.querySelector('#export-box-size');
    this.maxSizeInput = this.modal.querySelector('#export-max-size');
    this.confirmBtn = this.modal.querySelector('#export-confirm-btn');
    this.cancelBtn = this.modal.querySelector('#export-cancel-btn');

    // Setup event listeners
    this.addEventListener(this.copyOriginalRadio, 'change', () => this.handleModeChange());
    this.addEventListener(this.resizeRadio, 'change', () => this.handleModeChange());
    this.addEventListener(this.confirmBtn, 'click', () => this.handleConfirm());
    this.addEventListener(this.cancelBtn, 'click', () => this.handleCancel());

    // Initial state
    this.handleModeChange();

    this._log('ExportOptionsModal initialized');
  }

  /**
   * Show export options dialog
   * @returns {Promise<object|null>} Promise that resolves with export options or null if cancelled
   */
  show() {
    return new Promise((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;

      // Reset to defaults
      this.resetForm();

      // Open modal
      this.open();
    });
  }

  /**
   * Handle mode change (copy vs resize)
   */
  handleModeChange() {
    if (!this.resizeOptionsContainer) return;

    const isResizeMode = this.resizeRadio && this.resizeRadio.checked;

    // Enable/disable resize inputs
    this.resizeOptionsContainer.style.opacity = isResizeMode ? '1' : '0.5';

    if (this.boxSizeInput) {
      this.boxSizeInput.disabled = !isResizeMode;
    }

    if (this.maxSizeInput) {
      this.maxSizeInput.disabled = !isResizeMode;
    }

    this._log(`Mode changed to: ${isResizeMode ? 'resize' : 'copy'}`);
  }

  /**
   * Handle confirm button
   */
  handleConfirm() {
    const options = this.getExportOptions();
    this._log('Export options confirmed:', options);

    if (this.resolvePromise) {
      const resolve = this.resolvePromise;
      this.resolvePromise = null;
      this.rejectPromise = null;
      this.close();
      resolve(options);
    } else {
      this.close();
    }
  }

  /**
   * Handle cancel button
   */
  handleCancel() {
    this._log('Export cancelled');

    if (this.resolvePromise) {
      const resolve = this.resolvePromise;
      this.resolvePromise = null;
      this.rejectPromise = null;
      this.close();
      resolve(null);
    } else {
      this.close();
    }
  }

  /**
   * Get current export options
   * @returns {object} Export options
   */
  getExportOptions() {
    const isResizeMode = this.resizeRadio && this.resizeRadio.checked;

    return {
      mode: isResizeMode ? 'resize' : 'copy',
      resize: isResizeMode ? {
        boxSize: parseInt(this.boxSizeInput.value, 10) || 800,
        maxSize: parseInt(this.maxSizeInput.value, 10) || 500
      } : null
    };
  }

  /**
   * Reset form to defaults
   */
  resetForm() {
    if (this.copyOriginalRadio) {
      this.copyOriginalRadio.checked = true;
    }

    if (this.boxSizeInput) {
      this.boxSizeInput.value = '800';
    }

    if (this.maxSizeInput) {
      this.maxSizeInput.value = '500';
    }

    this.handleModeChange();
  }

  /**
   * Override close to handle cancellation
   */
  close() {
    super.close();

    // If closed without choosing, resolve as null (cancelled)
    if (this.resolvePromise) {
      this.resolvePromise(null);
      this.resolvePromise = null;
      this.rejectPromise = null;
    }
  }

  /**
   * Internal logging
   * @private
   */
  _log(message, data = null, level = 'info') {
    const prefix = '[ExportOptionsModal]';
    if (level === 'error') {
      console.error(prefix, message, data || '');
    } else {
      console.log(prefix, message, data || '');
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ExportOptionsModal };
}
