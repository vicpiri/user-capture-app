/**
 * ExportScopeModal - Which users an export covers
 *
 * Every export used to take whatever the list was showing without saying so,
 * which is right most of the time and surprising the rest: with a group filter
 * or a selection on, what leaves the app is not what the person had in mind.
 * This asks first, and only when there is something to ask: the caller skips it
 * when every possible answer is the same set of people.
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

  class ExportScopeModal extends BaseModal {
    constructor() {
      super('export-scope-modal');

      this.optionsEl = document.getElementById('export-scope-options');
      this.confirmBtn = document.getElementById('export-scope-confirm-btn');
      this.cancelBtn = document.getElementById('export-scope-cancel-btn');

      this.scopes = [];
      this.selectedId = null;
      this.resolvePromise = null;

      this.handleConfirm = this.handleConfirm.bind(this);
      this.handleCancel = this.handleCancel.bind(this);
    }

    init() {
      super.init();

      if (this.confirmBtn) {
        this.confirmBtn.addEventListener('click', this.handleConfirm);
      }

      if (this.cancelBtn) {
        this.cancelBtn.addEventListener('click', this.handleCancel);
      }
    }

    /**
     * @param {Array<{id: string, label: string, count: number}>} scopes
     * @param {string} [selectedId] - The one marked on opening
     * @returns {Promise<string|null>} The chosen id, or null if cancelled
     */
    show(scopes, selectedId = null) {
      this.scopes = Array.isArray(scopes) ? scopes : [];

      // The scope asked for may not be on offer: with the list empty under a
      // filter, "lo que muestra la lista" is not one of the answers. Leaving
      // nothing marked would turn Continuar into a silent Cancelar.
      const asked = this.scopes.some((scope) => scope.id === selectedId);
      this.selectedId = asked ? selectedId : (this.scopes[0] && this.scopes[0].id) || null;

      this.render();
      this.open();

      return new Promise((resolve) => {
        this.resolvePromise = resolve;
      });
    }

    /**
     * @private
     */
    render() {
      if (!this.optionsEl) {
        return;
      }

      this.optionsEl.replaceChildren();

      this.scopes.forEach((scope) => {
        const label = document.createElement('label');
        label.className = 'checkbox-label';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'export-scope';
        radio.value = scope.id;
        radio.checked = scope.id === this.selectedId;
        radio.addEventListener('change', () => {
          this.selectedId = scope.id;
        });

        const text = document.createElement('span');
        text.textContent = scope.label + ' ';

        const count = document.createElement('strong');
        count.textContent = `(${scope.count})`;
        text.appendChild(count);

        label.appendChild(radio);
        label.appendChild(text);
        this.optionsEl.appendChild(label);
      });
    }

    handleConfirm() {
      const chosen = this.selectedId;

      this.close();
      this.settle(chosen);
    }

    handleCancel() {
      this.close();
      this.settle(null);
    }

    /**
     * @private
     */
    settle(value) {
      if (this.resolvePromise) {
        const resolve = this.resolvePromise;
        this.resolvePromise = null;
        resolve(value);
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ExportScopeModal };
  } else if (typeof window !== 'undefined') {
    global.ExportScopeModal = ExportScopeModal;
  }
})(typeof window !== 'undefined' ? window : global);
