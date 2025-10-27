/**
 * AddTagModal - Modal for adding tags to images
 *
 * Allows user to enter a tag text for selected image.
 *
 * @extends BaseModal
 */

(function(global) {
  'use strict';

  // Dependencies: BaseModal (loaded from core in browser, or via require in Node.js)
  let BaseModal;
  if (typeof window !== 'undefined' && window.BaseModal) {
    BaseModal = window.BaseModal;
  } else if (typeof require !== 'undefined') {
    ({ BaseModal } = require('../../core/BaseModal'));
  }

  class AddTagModal extends BaseModal {
  constructor() {
    super('add-tag-modal', {
      defaultButtonSelector: '#add-tag-confirm-btn'
    });

    // Form elements
    this.tagInput = null;
    this.confirmBtn = null;
    this.cancelBtn = null;

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
   * @returns {Promise<string|null>} Promise that resolves with tag text or null if cancelled
   */
  show() {
    return new Promise((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;

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
  handleConfirm() {
    const tagText = this.tagInput ? this.tagInput.value.trim() : '';

    this._log('Confirm clicked, tag:', tagText);

    if (this.resolvePromise) {
      const resolve = this.resolvePromise;
      this.resolvePromise = null;
      this.rejectPromise = null;
      this.close();
      resolve(tagText || null); // Return null if empty
    } else {
      this.close();
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
    }
  }

  /**
   * Internal logging
   * @private
   */
  _log(message, data = null, level = 'info') {
    const prefix = '[AddTagModal]';
    if (level === 'error') {
      console.error(prefix, message, data || '');
    } else if (level === 'warn') {
      console.warn(prefix, message, data || '');
    } else {
      console.log(prefix, message, data || '');
    }
  }
}

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AddTagModal };
  } else if (typeof window !== 'undefined') {
    global.AddTagModal = AddTagModal;
  }
})(typeof window !== 'undefined' ? window : global);
