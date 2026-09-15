/**
 * WorkspacesModal - Ver > Espacios de trabajo
 *
 * Lists the workspaces with what each one shows, applies one, saves the
 * current view as a new one, and lets the user rename, update or delete
 * their own. The built-in ones can only be hidden from the menu. Everything
 * is stored by the main process, which also rebuilds the menu.
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

  // How each option saved by a workspace is described, in menu order
  const VIEW_LABELS = [
    ['showCapturedPhotos', 'Fotografías capturadas'],
    ['showRepositoryPhotos', 'Fotografías del depósito'],
    ['showRepositoryIndicators', 'Indicadores del depósito'],
    ['showAdditionalActions', 'Acciones adicionales'],
    ['showCaptureHistory', 'Historial de capturas'],
    ['showThumbnailGrid', 'Vista de miniaturas']
  ];

  const SHORTCUTS = 9;

  class WorkspacesModal extends BaseModal {
    /**
     * @param {Object} config
     * @param {Object} config.api - getWorkspaces, applyWorkspace, createWorkspace,
     *   overwriteWorkspace, renameWorkspace, deleteWorkspace, setWorkspaceHidden
     * @param {Function} config.confirm - (message) => Promise<boolean>
     */
    constructor(config = {}) {
      super('workspaces-modal');

      this.api = config.api || {};
      this.confirm = config.confirm || (async () => false);

      this.listEl = null;
      this.currentViewEl = null;
      this.nameInput = null;
      this.createBtn = null;
      this.errorEl = null;
      this.closeBtn = null;

      this.workspaces = [];
      this.activeId = null;
      this.renamingId = null;
    }

    init() {
      super.init();

      if (!this.modal) return;

      this.listEl = this.modal.querySelector('#workspaces-list');
      this.currentViewEl = this.modal.querySelector('#workspaces-current-view');
      this.nameInput = this.modal.querySelector('#workspaces-new-name');
      this.createBtn = this.modal.querySelector('#workspaces-new-btn');
      this.errorEl = this.modal.querySelector('#workspaces-error');
      this.closeBtn = this.modal.querySelector('#workspaces-close-btn');

      this.addEventListener(this.createBtn, 'click', () => this.create());
      this.addEventListener(this.nameInput, 'keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          this.create();
        }
      });
      this.addEventListener(this.nameInput, 'input', () => this.showError(null));
      this.addEventListener(this.closeBtn, 'click', () => this.close());

      // One listener for the buttons of every row
      this.addEventListener(this.listEl, 'click', (event) => {
        const button = event.target.closest('button[data-action]');
        const row = event.target.closest('[data-id]');
        if (button && row) {
          this.handleAction(button.dataset.action, row.dataset.id);
        }
      });
      this.addEventListener(this.listEl, 'change', (event) => {
        const row = event.target.closest('[data-id]');
        if (event.target.matches('input[data-action="show-in-menu"]') && row) {
          this.run(() => this.api.setWorkspaceHidden(row.dataset.id, !event.target.checked));
        }
      });

      this._log('WorkspacesModal initialized');
    }

    /**
     * @param {'manage'|'save'} [mode] - 'save' puts the cursor on the name
     */
    async show(mode = 'manage') {
      this.showError(null);
      this.renamingId = null;
      if (this.nameInput) this.nameInput.value = '';
      await this.refresh();
      this.open();
      if (mode === 'save' && this.nameInput) {
        this.nameInput.focus();
      }
    }

    /**
     * Read the workspaces again and repaint. Skipped while a name is being
     * edited, which a repaint would throw away.
     */
    async refresh() {
      if (this.renamingId) return;
      const data = await this.api.getWorkspaces();
      this.workspaces = data.workspaces || [];
      this.activeId = data.activeId || null;
      this.render(data.currentView || {});
    }

    render(currentView) {
      if (this.currentViewEl) {
        this.currentViewEl.textContent = `Vista actual: ${this.describe(currentView)}`;
      }
      if (!this.listEl) return;

      this.listEl.innerHTML = '';
      let shortcut = 0;
      this.workspaces.forEach((workspace) => {
        const inMenu = !workspace.hidden;
        if (inMenu) shortcut++;
        this.listEl.appendChild(this.renderRow(workspace, inMenu && shortcut <= SHORTCUTS ? shortcut : null));
      });
    }

    /**
     * @private
     */
    renderRow(workspace, shortcut) {
      const row = document.createElement('li');
      row.className = 'workspace-row';
      row.dataset.id = workspace.id;
      row.classList.toggle('is-active', workspace.id === this.activeId);
      row.classList.toggle('is-hidden', workspace.hidden);

      const main = document.createElement('div');
      main.className = 'workspace-main';

      const title = document.createElement('div');
      title.className = 'workspace-title';
      const name = document.createElement('span');
      name.className = 'workspace-name';
      name.textContent = workspace.name;
      title.appendChild(name);
      if (workspace.builtIn) title.appendChild(this.tag('Predefinido', 'workspace-tag'));
      if (workspace.id === this.activeId) title.appendChild(this.tag('En uso', 'workspace-tag is-active'));
      if (shortcut) title.appendChild(this.tag(`Ctrl+${shortcut}`, 'workspace-shortcut'));

      const view = document.createElement('div');
      view.className = 'workspace-view';
      view.textContent = this.describe(workspace.view);

      main.appendChild(title);
      main.appendChild(view);

      const actions = document.createElement('div');
      actions.className = 'workspace-actions';
      actions.appendChild(this.button('Aplicar', 'apply', 'btn-primary'));
      if (workspace.builtIn) {
        const label = document.createElement('label');
        label.className = 'workspace-in-menu';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.action = 'show-in-menu';
        checkbox.checked = !workspace.hidden;
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' En el menú'));
        actions.appendChild(label);
      } else {
        actions.appendChild(this.button('Guardar vista actual', 'overwrite'));
        actions.appendChild(this.button('Renombrar', 'rename'));
        actions.appendChild(this.button('Borrar', 'delete'));
      }

      row.appendChild(main);
      row.appendChild(actions);
      return row;
    }

    /**
     * "Fotografías capturadas · Historial de capturas"
     * @param {Object} view
     * @returns {string}
     */
    describe(view = {}) {
      const shown = VIEW_LABELS.filter(([key]) => view[key]).map(([, label]) => label);
      return shown.length > 0 ? shown.join(' · ') : 'Sin fotos ni paneles';
    }

    async handleAction(action, id) {
      const workspace = this.workspaces.find((candidate) => candidate.id === id);
      if (!workspace) return;
      this.showError(null);

      switch (action) {
        case 'apply': {
          const result = await this.api.applyWorkspace(id);
          if (result && result.success) {
            this.close();
          } else {
            this.showError((result && result.error) || 'No se pudo aplicar el espacio de trabajo.');
          }
          break;
        }
        case 'overwrite':
          if (await this.confirm(`¿Guardar la vista actual en «${workspace.name}»? Se sustituyen las opciones que tenía.`)) {
            await this.run(() => this.api.overwriteWorkspace(id));
          }
          break;
        case 'rename':
          this.startRename(workspace);
          break;
        case 'delete':
          if (await this.confirm(`¿Borrar el espacio de trabajo «${workspace.name}»?`)) {
            await this.run(() => this.api.deleteWorkspace(id));
          }
          break;
        default:
          break;
      }
    }

    /**
     * Save the current view under the name typed
     */
    async create() {
      const name = this.nameInput ? this.nameInput.value : '';
      const result = await this.api.createWorkspace(name);
      if (result && result.success) {
        if (this.nameInput) this.nameInput.value = '';
        await this.refresh();
      } else {
        this.showError((result && result.error) || 'No se pudo guardar el espacio de trabajo.');
        if (this.nameInput) this.nameInput.focus();
      }
    }

    /**
     * Turn the name of a row into a field. Enter or leaving it saves, Escape
     * cancels without closing the window.
     * @private
     */
    startRename(workspace) {
      const row = Array.from(this.listEl.children).find((candidate) => candidate.dataset.id === workspace.id);
      const name = row && row.querySelector('.workspace-name');
      if (!name) return;

      this.renamingId = workspace.id;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-control workspace-rename';
      input.maxLength = 40;
      input.value = workspace.name;
      name.replaceWith(input);
      input.focus();
      input.select();

      let done = false;
      // Enter saves and the repaint that follows removes the field, which
      // fires blur: without this the name would be saved twice
      let saving = false;
      const finish = async (save) => {
        if (done || saving) return;
        if (!save) {
          done = true;
          this.renamingId = null;
          await this.refresh();
          return;
        }
        saving = true;
        const result = await this.api.renameWorkspace(workspace.id, input.value);
        saving = false;
        if (result && result.success) {
          done = true;
          this.renamingId = null;
          await this.refresh();
        } else {
          this.showError((result && result.error) || 'No se pudo cambiar el nombre.');
          input.focus();
        }
      };

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          finish(true);
        } else if (event.key === 'Escape') {
          // Escape would otherwise press Cerrar and close the whole window
          event.preventDefault();
          finish(false);
        }
      });
      input.addEventListener('blur', () => finish(true));
    }

    /**
     * Run a change and repaint, or show why it failed
     * @private
     */
    async run(change) {
      const result = await change();
      if (!result || !result.success) {
        this.showError((result && result.error) || 'No se pudo guardar el cambio.');
      }
      await this.refresh();
      return result;
    }

    showError(message) {
      if (!this.errorEl) return;
      this.errorEl.textContent = message || '';
      this.errorEl.hidden = !message;
    }

    /**
     * @private
     */
    button(label, action, variant = 'btn-secondary') {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `btn btn-small ${variant}`;
      button.dataset.action = action;
      button.textContent = label;
      return button;
    }

    /**
     * @private
     */
    tag(text, className) {
      const tag = document.createElement('span');
      tag.className = className;
      tag.textContent = text;
      return tag;
    }

    /**
     * @private
     */
    _log(message) {
      console.log('[WorkspacesModal]', message);
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WorkspacesModal };
  } else if (typeof window !== 'undefined') {
    global.WorkspacesModal = WorkspacesModal;
  }
})(typeof window !== 'undefined' ? window : global);
