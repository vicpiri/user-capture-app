/**
 * InfoModal - Reusable info/alert dialog
 *
 * Shows an informational message with OK button.
 * Can be used for success messages, errors, or general info.
 *
 * @extends BaseModal
 */

// Dependencies: BaseModal (loaded from core)

class InfoModal extends BaseModal {
  constructor() {
    super('info-modal');

    // Elements
    this.titleEl = null;
    this.messageEl = null;
    this.okBtn = null;

    // State
    this.resolvePromise = null;
  }

  /**
   * Initialize modal
   */
  init() {
    super.init();

    if (!this.modal) return;

    // Find elements
    this.titleEl = this.modal.querySelector('#info-modal-title');
    this.messageEl = this.modal.querySelector('#info-modal-message');
    this.okBtn = this.modal.querySelector('#info-modal-ok-btn');

    // Setup event listeners
    this.addEventListener(this.okBtn, 'click', () => this.handleOk());

    this._log('InfoModal initialized');
  }

  /**
   * Show info dialog
   * @param {string} title - Dialog title
   * @param {string} message - Message to display
   * @returns {Promise<void>} Promise that resolves when user clicks OK
   */
  show(title, message) {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;

      // Set title and message
      if (this.titleEl) {
        this.titleEl.textContent = title;
      }

      if (this.messageEl) {
        this.messageEl.textContent = message;
      }

      // Open modal
      this.open();
    });
  }

  /**
   * Show success message (convenience method)
   * @param {string} message - Success message
   * @returns {Promise<void>}
   */
  showSuccess(message) {
    return this.show('Éxito', message);
  }

  /**
   * Show error message (convenience method)
   * @param {string} message - Error message
   * @returns {Promise<void>}
   */
  showError(message) {
    return this.show('Error', message);
  }

  /**
   * Show info message (convenience method)
   * @param {string} message - Info message
   * @returns {Promise<void>}
   */
  showInfo(message) {
    return this.show('Información', message);
  }

  /**
   * Handle OK button
   */
  handleOk() {
    this._log('User clicked OK');
    this.close();

    if (this.resolvePromise) {
      this.resolvePromise();
      this.resolvePromise = null;
    }
  }

  /**
   * Override close to resolve promise
   */
  close() {
    super.close();

    // Resolve if closed without clicking OK
    if (this.resolvePromise) {
      this.resolvePromise();
      this.resolvePromise = null;
    }
  }

  /**
   * Internal logging
   * @private
   */
  _log(message, level = 'info') {
    const prefix = '[InfoModal]';
    if (level === 'error') {
      console.error(prefix, message);
    } else {
      console.log(prefix, message);
    }
  }
}

// Export (for tests and browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { InfoModal };
} else if (typeof window !== 'undefined') {
  window.InfoModal = InfoModal;
}
