/**
 * ConfirmModal - Reusable confirmation dialog
 *
 * Shows a Yes/No confirmation dialog with custom message.
 * Returns a promise that resolves with user's choice.
 *
 * @extends BaseModal
 */

const { BaseModal } = require('../../core/BaseModal');

class ConfirmModal extends BaseModal {
  constructor() {
    super('confirm-modal');

    // Elements
    this.messageEl = null;
    this.yesBtn = null;
    this.noBtn = null;

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
    this.messageEl = this.modal.querySelector('#confirm-message');
    this.yesBtn = this.modal.querySelector('#confirm-yes-btn');
    this.noBtn = this.modal.querySelector('#confirm-no-btn');

    // Setup event listeners
    this.addEventListener(this.yesBtn, 'click', () => this.handleYes());
    this.addEventListener(this.noBtn, 'click', () => this.handleNo());

    this._log('ConfirmModal initialized');
  }

  /**
   * Show confirmation dialog
   * @param {string} message - Message to display
   * @returns {Promise<boolean>} Promise that resolves with true (yes) or false (no)
   */
  show(message) {
    return new Promise((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;

      // Set message
      if (this.messageEl) {
        this.messageEl.textContent = message;
      }

      // Open modal
      this.open();
    });
  }

  /**
   * Handle Yes button
   */
  handleYes() {
    this._log('User selected: Yes');

    if (this.resolvePromise) {
      const resolve = this.resolvePromise;
      this.resolvePromise = null;
      this.rejectPromise = null;
      this.close();
      resolve(true);
    } else {
      this.close();
    }
  }

  /**
   * Handle No button
   */
  handleNo() {
    this._log('User selected: No');

    if (this.resolvePromise) {
      const resolve = this.resolvePromise;
      this.resolvePromise = null;
      this.rejectPromise = null;
      this.close();
      resolve(false);
    } else {
      this.close();
    }
  }

  /**
   * Override close to handle rejection if user closes without choosing
   */
  close() {
    super.close();

    // If closed without choosing, resolve as false
    if (this.resolvePromise) {
      this.resolvePromise(false);
      this.resolvePromise = null;
      this.rejectPromise = null;
    }
  }

  /**
   * Internal logging
   * @private
   */
  _log(message, level = 'info') {
    const prefix = '[ConfirmModal]';
    if (level === 'error') {
      console.error(prefix, message);
    } else {
      console.log(prefix, message);
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ConfirmModal };
}
