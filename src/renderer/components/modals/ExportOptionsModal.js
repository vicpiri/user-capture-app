/**
 * ExportOptionsModal - Modal for configuring image export options
 *
 * Allows user to choose between:
 * - Copy original images
 * - Resize images with custom dimensions and file size
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

  // What the dialog offered before the defaults could be set in Preferencias
  const BUILT_IN_DEFAULTS = { mode: 'copy', boxSize: 800, maxSize: 500 };

  class ExportOptionsModal extends BaseModal {
  /**
   * @param {Object} [config]
   * @param {function(): Promise<Object>} [config.getDefaults] - What the form
   *   starts with ({ mode, boxSize, maxSize }), read each time it opens so a
   *   change in Preferencias applies to the next export
   */
  constructor({ getDefaults } = {}) {
    super('export-options-modal', {
      defaultButtonSelector: '#export-confirm-btn'
    });

    this.getDefaults = getDefaults || null;
    this.defaults = mergeDefaults();

    // Form elements
    this.copyOriginalRadio = null;
    this.resizeRadio = null;
    this.resizeOptionsContainer = null;
    this.boxSizeInput = null;
    this.maxSizeInput = null;
    this.confirmBtn = null;
    this.cancelBtn = null;
    this.summaryEl = null;
    this.noteEl = null;
    this.requestsEl = null;
    this.requestCardsInput = null;
    this.requestPublicationsInput = null;

    // State
    this.requestsShown = false;
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
    this.summaryEl = this.modal.querySelector('#export-options-modal-summary');
    this.noteEl = this.modal.querySelector('#export-options-modal-note');
    this.requestsEl = this.modal.querySelector('#export-request-options');
    this.requestCardsInput = this.modal.querySelector('#export-request-cards');
    this.requestPublicationsInput = this.modal.querySelector('#export-request-publications');

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
   *
   * @param {Array<{label: string, value: string}>} [summary] - What is about to
   *   be exported. Shown above the options so the scope is visible before
   *   confirming; omit it and the section stays hidden.
   * @param {string} [note] - Caveat shown under the summary, for figures that
   *   cannot be promised to be exact
   * @param {Object} [extra]
   * @param {{cards: boolean, publications: boolean}} [extra.requests] - Offer
   *   to request the cards and the publication of the exported photos, ticked
   *   as given. Only the repository export passes it; without it the section
   *   stays hidden and the options carry no requests.
   * @returns {Promise<object|null>} Promise that resolves with export options or null if cancelled
   */
  show(summary, note, { requests } = {}) {
    return new Promise((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;

      // Reset to defaults
      this.resetForm();
      this.renderSummary(summary);
      this.renderNote(note);
      this.renderRequests(requests);

      if (!this.getDefaults) {
        this.open();
        return;
      }

      // Opened once the saved defaults are in, so the form never changes
      // under the pointer. If they cannot be read, the built-in ones stay.
      Promise.resolve()
        .then(() => this.getDefaults())
        .catch((error) => {
          this._log('Could not read the export defaults', error, 'error');
          return null;
        })
        .then((defaults) => {
          this.resetForm(defaults);
          this.open();
        });
    });
  }

  /**
   * Paint the summary rows, or hide the section when there is nothing to say
   * @param {Array<{label: string, value: string}>} [summary]
   */
  renderSummary(summary) {
    if (!this.summaryEl) return;

    const rows = Array.isArray(summary) ? summary : [];

    this.summaryEl.replaceChildren();
    this.summaryEl.style.display = rows.length > 0 ? 'block' : 'none';

    const fragment = document.createDocumentFragment();

    rows.forEach(({ label, value }) => {
      const row = document.createElement('div');
      row.className = 'about-info-row';

      const labelEl = document.createElement('span');
      labelEl.className = 'about-label';
      labelEl.textContent = label;

      const valueEl = document.createElement('span');
      valueEl.className = 'about-value export-summary-value';
      valueEl.textContent = String(value);
      valueEl.title = String(value);

      row.appendChild(labelEl);
      row.appendChild(valueEl);
      fragment.appendChild(row);
    });

    this.summaryEl.appendChild(fragment);
  }

  /**
   * Show the caveat under the summary, or hide it when there is none
   * @param {string} [note]
   */
  renderNote(note) {
    if (!this.noteEl) return;

    this.noteEl.textContent = note || '';
    this.noteEl.style.display = note ? 'block' : 'none';
  }

  /**
   * Show the request checkboxes ticked as given, or hide them
   * @param {{cards: boolean, publications: boolean}} [requests]
   */
  renderRequests(requests) {
    this.requestsShown = Boolean(requests && this.requestsEl);

    if (this.requestsEl) {
      this.requestsEl.style.display = this.requestsShown ? 'block' : 'none';
    }

    if (!this.requestsShown) return;

    if (this.requestCardsInput) {
      this.requestCardsInput.checked = requests.cards === true;
    }

    if (this.requestPublicationsInput) {
      this.requestPublicationsInput.checked = requests.publications === true;
    }
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

    const options = {
      mode: isResizeMode ? 'resize' : 'copy',
      resize: isResizeMode ? {
        boxSize: parseInt(this.boxSizeInput.value, 10) || this.defaults.boxSize,
        maxSize: parseInt(this.maxSizeInput.value, 10) || this.defaults.maxSize
      } : null
    };

    if (this.requestsShown) {
      options.requests = {
        cards: Boolean(this.requestCardsInput && this.requestCardsInput.checked),
        publications: Boolean(this.requestPublicationsInput && this.requestPublicationsInput.checked)
      };
    }

    return options;
  }

  /**
   * Reset form to defaults
   * @param {Object} [defaults] - { mode, boxSize, maxSize }; what is missing
   *   or not a number keeps the built-in value
   */
  resetForm(defaults) {
    this.defaults = mergeDefaults(defaults);

    if (this.copyOriginalRadio) {
      this.copyOriginalRadio.checked = this.defaults.mode !== 'resize';
    }

    if (this.resizeRadio) {
      this.resizeRadio.checked = this.defaults.mode === 'resize';
    }

    if (this.boxSizeInput) {
      this.boxSizeInput.value = String(this.defaults.boxSize);
    }

    if (this.maxSizeInput) {
      this.maxSizeInput.value = String(this.defaults.maxSize);
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

  function mergeDefaults(defaults) {
    const given = defaults || {};
    const positive = (value, fallback) => (Number.isFinite(value) && value > 0 ? value : fallback);

    return {
      mode: given.mode === 'resize' ? 'resize' : BUILT_IN_DEFAULTS.mode,
      boxSize: positive(given.boxSize, BUILT_IN_DEFAULTS.boxSize),
      maxSize: positive(given.maxSize, BUILT_IN_DEFAULTS.maxSize)
    };
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ExportOptionsModal };
  } else if (typeof window !== 'undefined') {
    global.ExportOptionsModal = ExportOptionsModal;
  }
})(typeof window !== 'undefined' ? window : global);
