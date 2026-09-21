/**
 * PendingRequestsModal - Review of the repository's card and publication requests
 *
 * The request folders carry over from one course to the next and are shared
 * between projects. This window lists, for cards and publications, the
 * requests of people who are not in the project and the project's own made
 * before its course started, and lets the user tick the ones to archive. It
 * only returns the ticked files: confirming and archiving is the caller's job.
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

  const KINDS = {
    cards: { label: 'Carnets' },
    publications: { label: 'Publicaciones' }
  };

  const SECTIONS = [
    {
      key: 'others',
      title: 'De personas que no están en el proyecto',
      note: 'Pueden ser de quien ya no está en el centro o de otro proyecto que use el mismo depósito.'
    },
    {
      key: 'previousCourse',
      title: 'Del curso anterior',
      note: 'Se pidieron antes de empezar el curso del proyecto. Si alguna todavía hace falta, déjala sin marcar.'
    }
  ];

  class PendingRequestsModal extends BaseModal {
    constructor() {
      super('pending-requests-modal');

      this.summary = document.getElementById('pending-requests-summary');
      this.kindSwitch = document.getElementById('pending-requests-kind');
      this.lists = document.getElementById('pending-requests-lists');
      this.archiveBtn = document.getElementById('archive-pending-requests-btn');
      this.cancelBtn = document.getElementById('cancel-pending-requests-btn');

      this.review = null;
      this.kind = 'cards';
      this.selected = { cards: new Set(), publications: new Set() };
      this.resolvePromise = null;

      this.handleArchive = this.handleArchive.bind(this);
      this.handleCancel = this.handleCancel.bind(this);
    }

    init() {
      super.init();
      this.setupEventListeners();
    }

    setupEventListeners() {
      if (this.archiveBtn) {
        this.archiveBtn.addEventListener('click', this.handleArchive);
      }

      if (this.cancelBtn) {
        this.cancelBtn.addEventListener('click', this.handleCancel);
      }

      if (this.kindSwitch) {
        this.kindSwitch.addEventListener('click', (event) => {
          const button = event.target.closest('[data-kind]');
          if (button && this.review) {
            this.showKind(button.dataset.kind);
          }
        });
      }
    }

    /**
     * @returns {Promise<Object|null>} `{ cards, publications }` with the file
     *   names to archive, or null if cancelled
     */
    async show() {
      this.review = null;
      this.kind = 'cards';
      this.selected = { cards: new Set(), publications: new Set() };
      this.renderMessage('Leyendo el depósito...');
      this.open();

      const promise = new Promise((resolve) => {
        this.resolvePromise = resolve;
      });

      await this.load();

      return promise;
    }

    /**
     * @private
     */
    async load() {
      let result;

      try {
        result = await window.electronAPI.reviewPendingRequests();
      } catch (error) {
        result = { success: false, error: error.message };
      }

      // Closed while the folders were being read
      if (!this.resolvePromise) {
        return;
      }

      if (!result.success) {
        this.renderMessage(result.error || 'No se pudo leer el depósito.');
        return;
      }

      this.review = result;
      this.renderSummary();

      // Open on the kind that has something to review
      const first = Object.keys(KINDS).find((kind) => PendingRequestsModal.countFor(result[kind]) > 0);
      this.showKind(first || 'cards');
    }

    /**
     * Requests listed for review in one kind
     * @param {Object} review - `{ others, previousCourse }`
     * @returns {number}
     */
    static countFor(review) {
      if (!review) {
        return 0;
      }
      return (review.others || []).length + (review.previousCourse || []).length;
    }

    /**
     * @private
     */
    renderMessage(message) {
      if (this.summary) {
        this.summary.textContent = message;
      }
      if (this.lists) {
        this.lists.innerHTML = '';
      }
      if (this.kindSwitch) {
        this.kindSwitch.hidden = true;
      }
      this.updateArchiveButton();
    }

    /**
     * @private
     */
    renderSummary() {
      if (!this.summary) {
        return;
      }

      const year = this.review.academicYear;
      this.summary.textContent = `Curso del proyecto: ${year}-${year + 1}. `
        + `Las solicitudes anteriores al 1 de septiembre de ${year} se consideran del curso anterior.`;
    }

    /**
     * @private
     */
    showKind(kind) {
      if (!KINDS[kind]) {
        return;
      }

      this.kind = kind;

      if (this.kindSwitch) {
        this.kindSwitch.hidden = false;
        this.kindSwitch.querySelectorAll('[data-kind]').forEach((button) => {
          const buttonKind = button.dataset.kind;
          const count = PendingRequestsModal.countFor(this.review[buttonKind]);
          button.textContent = `${KINDS[buttonKind].label} (${count})`;
          button.classList.toggle('is-active', buttonKind === kind);
        });
      }

      this.renderLists();
      this.updateArchiveButton();
    }

    /**
     * @private
     */
    renderLists() {
      if (!this.lists) {
        return;
      }

      this.lists.innerHTML = '';

      const review = this.review[this.kind];
      const selected = this.selected[this.kind];

      SECTIONS.forEach((section) => {
        const entries = review[section.key] || [];

        const block = document.createElement('section');
        block.className = 'pending-requests-section';
        block.dataset.section = section.key;

        const head = document.createElement('label');
        head.className = 'pending-requests-section-head';

        const all = document.createElement('input');
        all.type = 'checkbox';
        all.disabled = entries.length === 0;
        all.className = 'pending-requests-select-all';

        const title = document.createElement('span');
        title.textContent = `${section.title} (${entries.length})`;

        head.appendChild(all);
        head.appendChild(title);
        block.appendChild(head);

        const note = document.createElement('p');
        note.className = 'pending-requests-note';
        note.textContent = entries.length === 0 ? 'Ninguna.' : section.note;
        block.appendChild(note);

        const list = document.createElement('ul');
        list.className = 'pending-requests-list';

        const boxes = entries.map((entry) => {
          const item = document.createElement('li');
          const label = document.createElement('label');

          const box = document.createElement('input');
          box.type = 'checkbox';
          box.dataset.file = entry.file;
          box.checked = selected.has(entry.file);
          box.addEventListener('change', () => {
            if (box.checked) {
              selected.add(entry.file);
            } else {
              selected.delete(entry.file);
            }
            syncAll();
            this.updateArchiveButton();
          });

          const who = document.createElement('span');
          who.className = 'pending-requests-who';
          who.textContent = entry.name ? `${entry.name}` : entry.id;

          const meta = document.createElement('span');
          meta.className = 'pending-requests-meta';
          meta.textContent = [
            entry.name ? entry.id : null,
            entry.group || null,
            `solicitada el ${formatDate(entry.requestedAt)}`
          ].filter(Boolean).join(' · ');

          label.appendChild(box);
          label.appendChild(who);
          label.appendChild(meta);
          item.appendChild(label);
          list.appendChild(item);

          return box;
        });

        const syncAll = () => {
          const ticked = boxes.filter((box) => box.checked).length;
          all.checked = boxes.length > 0 && ticked === boxes.length;
          all.indeterminate = ticked > 0 && ticked < boxes.length;
        };

        all.addEventListener('change', () => {
          boxes.forEach((box) => {
            box.checked = all.checked;
            if (all.checked) {
              selected.add(box.dataset.file);
            } else {
              selected.delete(box.dataset.file);
            }
          });
          syncAll();
          this.updateArchiveButton();
        });

        syncAll();

        if (entries.length > 0) {
          block.appendChild(list);
        }

        this.lists.appendChild(block);
      });
    }

    /**
     * Ticked requests, both kinds together
     * @returns {number}
     */
    selectedCount() {
      return this.selected.cards.size + this.selected.publications.size;
    }

    /**
     * @private
     */
    updateArchiveButton() {
      if (!this.archiveBtn) {
        return;
      }

      const count = this.selectedCount();
      this.archiveBtn.disabled = count === 0;
      this.archiveBtn.textContent = count === 0 ? 'Archivar' : `Archivar (${count})`;
    }

    handleArchive() {
      if (this.selectedCount() === 0) {
        return;
      }

      const chosen = {
        cards: [...this.selected.cards],
        publications: [...this.selected.publications]
      };

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

  function formatDate(time) {
    return new Date(time).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PendingRequestsModal };
  } else if (typeof window !== 'undefined') {
    global.PendingRequestsModal = PendingRequestsModal;
  }
})(typeof window !== 'undefined' ? window : global);
