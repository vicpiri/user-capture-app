/**
 * ChoiceModal - A question with several answers and a way out
 *
 * For what ConfirmModal's Sí/No cannot express, such as "Elegir otra
 * carpeta... / Usar la carpeta por defecto / Cancelar". The choice buttons
 * are built for each question; the cancel button is part of the page, so
 * Escape always has something to press.
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

  // Answer of the cancel button, of Escape and of a modal closed any other way
  const CANCELLED = -1;

  class ChoiceModal extends BaseModal {
    constructor() {
      super('choice-modal', {
        defaultButtonSelector: '.choice-modal-default'
      });

      this.titleEl = null;
      this.messageEl = null;
      this.buttonsEl = null;
      this.cancelBtn = null;

      this.resolvePromise = null;
    }

    init() {
      super.init();

      if (!this.modal) return;

      this.titleEl = this.modal.querySelector('#choice-modal-title');
      this.messageEl = this.modal.querySelector('#choice-modal-message');
      this.buttonsEl = this.modal.querySelector('#choice-modal-buttons');
      this.cancelBtn = this.modal.querySelector('#choice-modal-cancel-btn');

      // One listener for the buttons of every question
      this.addEventListener(this.buttonsEl, 'click', (event) => {
        const button = event.target.closest('button[data-choice]');
        if (button) {
          this.answer(Number(button.dataset.choice));
        }
      });

      this._log('ChoiceModal initialized');
    }

    /**
     * @param {Object} question
     * @param {string} question.title
     * @param {string} question.message - line breaks are kept
     * @param {string[]} question.choices - the first one is the default (Enter)
     * @param {string} [question.cancel] - label of the cancel button
     * @returns {Promise<number>} index of the choice, or CANCELLED
     */
    show({ title, message, choices = [], cancel = 'Cancelar' }) {
      // A question still open is answered as cancelled rather than left waiting
      this._settle(CANCELLED);

      return new Promise((resolve) => {
        this.resolvePromise = resolve;

        if (this.titleEl) this.titleEl.textContent = title;
        if (this.messageEl) this.messageEl.textContent = message;
        if (this.cancelBtn) this.cancelBtn.textContent = cancel;

        if (this.buttonsEl) {
          this.buttonsEl.querySelectorAll('.choice-modal-choice').forEach((button) => button.remove());
          // Secondary answers first and the default last, where the eye
          // ends, as in the other dialogs
          choices.map((label, index) => ({ label, index })).reverse().forEach(({ label, index }) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `btn choice-modal-choice ${index === 0 ? 'btn-primary choice-modal-default' : 'btn-secondary'}`;
            button.dataset.choice = String(index);
            button.textContent = label;
            this.buttonsEl.appendChild(button);
          });
        }

        this.open();
      });
    }

    /**
     * @param {number} choice
     */
    answer(choice) {
      const resolve = this.resolvePromise;
      this.resolvePromise = null;
      super.close();
      if (resolve) resolve(choice);
    }

    /**
     * Closing without answering is cancelling
     */
    close() {
      super.close();
      this._settle(CANCELLED);
    }

    /**
     * @private
     */
    _settle(choice) {
      if (this.resolvePromise) {
        const resolve = this.resolvePromise;
        this.resolvePromise = null;
        resolve(choice);
      }
    }

    /**
     * @private
     */
    _log(message) {
      console.log('[ChoiceModal]', message);
    }
  }

  ChoiceModal.CANCELLED = CANCELLED;

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ChoiceModal };
  } else if (typeof window !== 'undefined') {
    global.ChoiceModal = ChoiceModal;
  }
})(typeof window !== 'undefined' ? window : global);
