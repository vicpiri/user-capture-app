/**
 * Project Information Modal
 *
 * Read-only summary of the open project: where its folders are and what it
 * holds. The figures come from the main process in one call, so the modal
 * never counts anything itself.
 *
 * @module components/modals/ProjectInfoModal
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

  // Labels for the user types the XML import produces
  const TYPE_LABELS = {
    student: 'Alumnado',
    teacher: 'Docentes',
    non_teaching_staff: 'No docentes'
  };

  const NOT_SET = 'No configurado';

  class ProjectInfoModal extends BaseModal {
    constructor(config = {}) {
      super('project-info-modal', {
        defaultButtonSelector: '#project-info-modal-close-btn'
      });

      this.getProjectDetails = config.getProjectDetails
        || (() => window.electronAPI.getProjectDetails());

      // Elements
      this.nameEl = null;
      this.pathsEl = null;
      this.countsEl = null;
      this.errorEl = null;
      this.closeBtn = null;
    }

    /**
     * Initialize the modal
     */
    init() {
      super.init();

      if (!this.modal) return;

      this.nameEl = this.modal.querySelector('#project-info-modal-name');
      this.pathsEl = this.modal.querySelector('#project-info-modal-paths');
      this.countsEl = this.modal.querySelector('#project-info-modal-counts');
      this.errorEl = this.modal.querySelector('#project-info-modal-error');
      this.closeBtn = this.modal.querySelector('#project-info-modal-close-btn');

      this.addEventListener(this.closeBtn, 'click', () => this.close());

      this._log('ProjectInfoModal initialized');
    }

    /**
     * Fetch the details and show them
     * @returns {Promise<boolean>} Whether the details could be read
     */
    async show() {
      if (!this.modal) return false;

      this.render(null);
      this.open();

      let result;
      try {
        result = await this.getProjectDetails();
      } catch (error) {
        this._log(`Error reading project details: ${error.message}`, 'error');
        result = { success: false, error: error.message };
      }

      if (!result || !result.success) {
        this.renderError((result && result.error) || 'No se pudo leer la información del proyecto');
        return false;
      }

      this.render(result.info);
      return true;
    }

    /**
     * Paint the details, or the loading state when given nothing
     * @param {Object|null} info
     */
    render(info) {
      if (!this.modal) return;

      if (this.errorEl) {
        this.errorEl.textContent = '';
        this.errorEl.style.display = 'none';
      }

      if (!info) {
        if (this.nameEl) this.nameEl.textContent = 'Cargando...';
        if (this.pathsEl) this.pathsEl.replaceChildren();
        if (this.countsEl) this.countsEl.replaceChildren();
        return;
      }

      if (this.nameEl) {
        this.nameEl.textContent = info.name || '';
      }

      this.renderRows(this.pathsEl, [
        ['Carpeta del proyecto', info.projectPath],
        ['Archivo XML', info.xmlFilePath],
        ['Capturas pendientes (ingest)', info.ingestPath],
        ['Imágenes capturadas (imports)', info.importsPath],
        ['Base de datos', info.databasePath],
        ['Depósito de imágenes', info.repositoryPath],
        ['Copia local del depósito', info.mirrorPath]
      ]);

      // Presented in the order of TYPE_LABELS rather than the one the query
      // happened to return, with any unknown type kept at the end
      const byType = info.usersByType || {};
      const knownTypes = Object.keys(TYPE_LABELS).filter((type) => type in byType);
      const otherTypes = Object.keys(byType).filter((type) => !(type in TYPE_LABELS));
      const typeRows = [...knownTypes, ...otherTypes]
        .map((type) => [TYPE_LABELS[type] || type, byType[type]]);

      this.renderRows(this.countsEl, [
        ['Usuarios', info.totalUsers],
        ...typeRows,
        ['Grupos', info.totalGroups],
        ['Fotos enlazadas', info.usersWithImage],
        ['Usuarios sin foto', info.usersWithoutImage],
        ['Imágenes en la carpeta imports', info.capturedImages],
        ['Imágenes con etiquetas', info.taggedImages]
      ]);
    }

    /**
     * Replace a section with one row per label/value pair
     * @param {HTMLElement} container
     * @param {Array<Array>} rows
     * @private
     */
    renderRows(container, rows) {
      if (!container) return;

      const fragment = document.createDocumentFragment();

      rows.forEach(([label, value]) => {
        const row = document.createElement('div');
        row.className = 'about-info-row';

        const labelEl = document.createElement('span');
        labelEl.className = 'about-label';
        labelEl.textContent = label;

        const valueEl = document.createElement('span');
        valueEl.className = 'about-value project-info-value';
        const hasValue = value !== null && value !== undefined && value !== '';
        valueEl.textContent = hasValue ? String(value) : NOT_SET;
        if (!hasValue) {
          valueEl.classList.add('project-info-value-empty');
        } else {
          // Paths are routinely wider than the modal
          valueEl.title = String(value);
        }

        row.appendChild(labelEl);
        row.appendChild(valueEl);
        fragment.appendChild(row);
      });

      container.replaceChildren(fragment);
    }

    /**
     * @param {string} message
     * @private
     */
    renderError(message) {
      if (this.nameEl) this.nameEl.textContent = '';
      if (this.pathsEl) this.pathsEl.replaceChildren();
      if (this.countsEl) this.countsEl.replaceChildren();

      if (this.errorEl) {
        this.errorEl.textContent = message;
        this.errorEl.style.display = 'block';
      }
    }

    /**
     * @param {string} message
     * @param {string} level
     * @private
     */
    _log(message, level = 'log') {
      const prefix = '[ProjectInfoModal]';
      if (level === 'error') {
        console.error(`${prefix} ${message}`);
      } else {
        console.log(`${prefix} ${message}`);
      }
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProjectInfoModal };
  } else if (typeof window !== 'undefined') {
    global.ProjectInfoModal = ProjectInfoModal;
  }
})(typeof window !== 'undefined' ? window : global);
