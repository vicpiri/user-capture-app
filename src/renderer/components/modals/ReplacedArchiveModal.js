/**
 * ReplacedArchiveModal - Purge window for the repository's replaced photos
 *
 * Shows what the `Reemplazadas` folder holds and offers a few cuts by age, each
 * with what it would delete, so the choice is made seeing the consequence. It
 * only returns the chosen cut: confirming and deleting is the caller's job.
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

  // Every cut is "older than this", from the most conservative to the one that
  // empties the folder. `months: null` means everything.
  const CUTS = [
    { id: 'year', months: 12, label: 'Más de un año' },
    { id: 'six', months: 6, label: 'Más de seis meses' },
    { id: 'three', months: 3, label: 'Más de tres meses' },
    { id: 'all', months: null, label: 'Todas las fotos reemplazadas' }
  ];

  class ReplacedArchiveModal extends BaseModal {
    constructor() {
      super('replaced-archive-modal');

      this.summary = document.getElementById('replaced-archive-summary');
      this.cutsList = document.getElementById('replaced-archive-cuts');
      this.emptyMessage = document.getElementById('replaced-archive-empty');
      this.purgeBtn = document.getElementById('purge-replaced-archive-btn');
      this.cancelBtn = document.getElementById('cancel-replaced-archive-btn');

      this.cuts = [];
      this.selected = null;
      this.resolvePromise = null;

      this.handlePurge = this.handlePurge.bind(this);
      this.handleCancel = this.handleCancel.bind(this);
    }

    init() {
      super.init();
      this.setupEventListeners();
    }

    setupEventListeners() {
      if (this.purgeBtn) {
        this.purgeBtn.addEventListener('click', this.handlePurge);
      }

      if (this.cancelBtn) {
        this.cancelBtn.addEventListener('click', this.handleCancel);
      }
    }

    /**
     * @returns {Promise<Object|null>} The chosen cut, or null if cancelled
     */
    async show() {
      this.cuts = [];
      this.selected = null;
      this.renderLoading();
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
        result = await window.electronAPI.scanReplacedArchive();
      } catch (error) {
        result = { success: false, error: error.message };
      }

      // Cancelled while the folder was being read
      if (!this.resolvePromise) {
        return;
      }

      if (!result.success) {
        this.renderProblem(result.error);
        return;
      }

      this.cuts = ReplacedArchiveModal.buildCuts(result.runs);
      this.render(result);
    }

    /**
     * What each cut would delete
     *
     * @param {Array} runs - Export runs, with an ISO `date`, `photos`, `bytes`
     * @param {Date} [now]
     * @returns {Array} one entry per cut, with its totals
     */
    static buildCuts(runs, now = new Date()) {
      const parsed = (runs || []).map((run) => ({ ...run, at: new Date(run.date) }));

      return CUTS.map((cut) => {
        const before = cut.months === null ? null : monthsBefore(now, cut.months);
        const inside = before === null ? parsed : parsed.filter((run) => run.at < before);

        return {
          id: cut.id,
          label: cut.label,
          before: before ? before.toISOString() : null,
          runs: inside.length,
          photos: inside.reduce((total, run) => total + run.photos, 0),
          bytes: inside.reduce((total, run) => total + run.bytes, 0)
        };
      });
    }

    /**
     * @private
     */
    renderLoading() {
      if (this.summary) {
        this.summary.textContent = 'Leyendo el depósito...';
      }
      if (this.cutsList) {
        this.cutsList.innerHTML = '';
      }
      if (this.emptyMessage) {
        this.emptyMessage.style.display = 'none';
      }
      if (this.purgeBtn) {
        this.purgeBtn.disabled = true;
      }
    }

    /**
     * @private
     */
    renderProblem(message) {
      if (this.summary) {
        this.summary.textContent = message || 'No se pudo leer el depósito.';
      }
      if (this.cutsList) {
        this.cutsList.innerHTML = '';
      }
      if (this.purgeBtn) {
        this.purgeBtn.disabled = true;
      }
    }

    /**
     * @private
     */
    render(scan) {
      const total = this.cuts.find((cut) => cut.id === 'all');

      if (this.summary) {
        this.summary.innerHTML = '';
        this.summary.appendChild(document.createTextNode(
          `${describe(total.runs, 'exportación', 'exportaciones')}, `
          + `${describe(scan.photos, 'foto', 'fotos')} (${formatSize(scan.bytes)}).`
        ));

        if (scan.folder) {
          const folder = document.createElement('span');
          folder.className = 'replaced-archive-folder';
          folder.textContent = scan.folder;
          this.summary.appendChild(folder);
        }
      }

      if (total.runs === 0) {
        this.renderEmpty();
        return;
      }

      if (this.emptyMessage) {
        this.emptyMessage.style.display = 'none';
      }

      this.renderCuts();
    }

    /**
     * @private
     */
    renderEmpty() {
      if (this.cutsList) {
        this.cutsList.innerHTML = '';
      }
      if (this.emptyMessage) {
        this.emptyMessage.style.display = 'block';
      }
      if (this.purgeBtn) {
        this.purgeBtn.disabled = true;
      }
    }

    /**
     * @private
     */
    renderCuts() {
      if (!this.cutsList) {
        return;
      }

      this.cutsList.innerHTML = '';

      this.cuts.forEach((cut) => {
        const item = document.createElement('div');
        item.className = cut.photos === 0 ? 'replaced-cut empty' : 'replaced-cut';
        item.dataset.cutId = cut.id;

        const label = document.createElement('div');
        label.className = 'replaced-cut-label';
        label.textContent = cut.label;

        const info = document.createElement('div');
        info.className = 'replaced-cut-info';
        info.textContent = cut.photos === 0
          ? 'Nada que borrar'
          : `${describe(cut.photos, 'foto', 'fotos')} de `
            + `${describe(cut.runs, 'exportación', 'exportaciones')} · ${formatSize(cut.bytes)}`;

        item.appendChild(label);
        item.appendChild(info);

        if (cut.photos > 0) {
          item.addEventListener('click', () => this.selectCut(cut.id));
        }

        this.cutsList.appendChild(item);
      });

      // The most conservative cut with something in it, so the safest choice is
      // the one already made
      const first = this.cuts.find((cut) => cut.photos > 0);
      if (first) {
        this.selectCut(first.id);
      }
    }

    /**
     * @private
     */
    selectCut(id) {
      this.selected = this.cuts.find((cut) => cut.id === id) || null;

      if (this.cutsList) {
        this.cutsList.querySelectorAll('.replaced-cut').forEach((item) => {
          item.classList.toggle('selected', item.dataset.cutId === id);
        });
      }

      if (this.purgeBtn) {
        this.purgeBtn.disabled = !this.selected || this.selected.photos === 0;
      }
    }

    handlePurge() {
      if (!this.selected || this.selected.photos === 0) {
        return;
      }

      const chosen = this.selected;

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

    close() {
      super.close();
      this.selected = null;
    }
  }

  /**
   * The same day and time, so many months back
   */
  function monthsBefore(now, months) {
    const date = new Date(now.getTime());
    date.setMonth(date.getMonth() - months);
    return date;
  }

  function describe(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function formatSize(bytes) {
    if (!bytes) {
      return '0 MB';
    }

    const megabytes = bytes / (1024 * 1024);

    if (megabytes >= 1024) {
      return `${(megabytes / 1024).toFixed(1)} GB`;
    }

    return megabytes >= 1 ? `${megabytes.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ReplacedArchiveModal };
  } else if (typeof window !== 'undefined') {
    global.ReplacedArchiveModal = ReplacedArchiveModal;
  }
})(typeof window !== 'undefined' ? window : global);
