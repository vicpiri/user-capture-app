/**
 * Tests for WorkspacesModal
 */

const { WorkspacesModal } = require('../../../../src/renderer/components/modals/WorkspacesModal');
const { installModalEscape } = require('../../../../src/renderer/core/modalEscape');

describe('WorkspacesModal', () => {
  let modal;
  let api;
  let confirm;
  let data;
  let uninstallEscape;

  const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };
  const rows = () => [...document.querySelectorAll('#workspaces-list .workspace-row')];
  const row = (id) => rows().find((r) => r.dataset.id === id);
  const action = (id, name) => row(id).querySelector(`[data-action="${name}"]`);
  const error = () => document.getElementById('workspaces-error');
  const key = (target, name) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));

  const view = (overrides = {}) => ({
    showCapturedPhotos: false,
    showRepositoryPhotos: false,
    showRepositoryIndicators: false,
    showAdditionalActions: false,
    showCaptureHistory: false,
    ...overrides
  });

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="workspaces-modal" class="modal">
        <ul id="workspaces-list"></ul>
        <p id="workspaces-current-view"></p>
        <input id="workspaces-new-name">
        <button id="workspaces-new-btn">Guardar</button>
        <div id="workspaces-error" hidden></div>
        <button id="workspaces-close-btn" data-modal-cancel>Cerrar</button>
      </div>
    `;

    data = {
      workspaces: [
        { id: 'captura', name: 'Captura', builtIn: true, hidden: false, view: view({ showCapturedPhotos: true, showCaptureHistory: true }) },
        { id: 'revision', name: 'Revisión', builtIn: true, hidden: true, view: view({ showCapturedPhotos: true, showRepositoryPhotos: true }) },
        { id: 'carnets', name: 'Carnets', builtIn: true, hidden: false, view: view({ showRepositoryPhotos: true }) },
        { id: 'custom-1', name: 'Tarde', builtIn: false, hidden: false, view: view() }
      ],
      activeId: 'captura',
      currentView: view({ showCapturedPhotos: true, showCaptureHistory: true })
    };

    api = {
      getWorkspaces: jest.fn(async () => data),
      applyWorkspace: jest.fn(async () => ({ success: true })),
      createWorkspace: jest.fn(async () => ({ success: true })),
      overwriteWorkspace: jest.fn(async () => ({ success: true })),
      renameWorkspace: jest.fn(async () => ({ success: true })),
      deleteWorkspace: jest.fn(async () => ({ success: true })),
      setWorkspaceHidden: jest.fn(async () => ({ success: true }))
    };
    confirm = jest.fn(async () => true);

    modal = new WorkspacesModal({ api, confirm });
    modal.init();
    uninstallEscape = installModalEscape(document);
    await modal.show();
  });

  afterEach(() => {
    uninstallEscape();
    modal.destroy();
    document.body.innerHTML = '';
  });

  describe('the list', () => {
    test('shows every workspace with what it shows', () => {
      expect(rows().map((r) => r.querySelector('.workspace-name').textContent)).toEqual(['Captura', 'Revisión', 'Carnets', 'Tarde']);
      expect(row('captura').querySelector('.workspace-view').textContent).toBe('Fotografías capturadas · Historial de capturas');
      expect(row('custom-1').querySelector('.workspace-view').textContent).toBe('Sin fotos ni paneles');
    });

    test('marks the one in use', () => {
      expect(row('captura').classList.contains('is-active')).toBe(true);
      expect(row('captura').textContent).toContain('En uso');
      expect(row('carnets').classList.contains('is-active')).toBe(false);
    });

    test('numbers the shortcuts as the menu does, skipping the hidden ones', () => {
      const shortcut = (id) => row(id).querySelector('.workspace-shortcut')?.textContent || null;
      expect([shortcut('captura'), shortcut('revision'), shortcut('carnets'), shortcut('custom-1')])
        .toEqual(['Ctrl+1', null, 'Ctrl+2', 'Ctrl+3']);
    });

    test('offers to hide the built-in ones and to change only the user\'s', () => {
      expect(row('captura').querySelector('[data-action="show-in-menu"]').checked).toBe(true);
      expect(row('revision').querySelector('[data-action="show-in-menu"]').checked).toBe(false);
      expect(action('captura', 'delete')).toBeNull();
      expect(action('custom-1', 'delete')).not.toBeNull();
      expect(action('custom-1', 'rename')).not.toBeNull();
      expect(action('custom-1', 'overwrite')).not.toBeNull();
    });

    test('describes the current view next to the name field', () => {
      expect(document.getElementById('workspaces-current-view').textContent)
        .toBe('Vista actual: Fotografías capturadas · Historial de capturas');
    });
  });

  describe('actions', () => {
    test('Aplicar applies the workspace and closes the window', async () => {
      action('carnets', 'apply').click();
      await flush();
      expect(api.applyWorkspace).toHaveBeenCalledWith('carnets');
      expect(modal.isModalOpen()).toBe(false);
    });

    test('shows why a workspace could not be applied', async () => {
      api.applyWorkspace.mockResolvedValue({ success: false, error: 'Ese espacio de trabajo ya no existe.' });
      action('carnets', 'apply').click();
      await flush();
      expect(error().hidden).toBe(false);
      expect(error().textContent).toBe('Ese espacio de trabajo ya no existe.');
      expect(modal.isModalOpen()).toBe(true);
    });

    test('the En el menú box hides a built-in workspace', async () => {
      const box = row('captura').querySelector('[data-action="show-in-menu"]');
      box.checked = false;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      expect(api.setWorkspaceHidden).toHaveBeenCalledWith('captura', true);
    });

    test('Borrar asks first', async () => {
      action('custom-1', 'delete').click();
      await flush();
      expect(confirm).toHaveBeenCalledWith('¿Borrar el espacio de trabajo «Tarde»?');
      expect(api.deleteWorkspace).toHaveBeenCalledWith('custom-1');
    });

    test('Borrar does nothing when the answer is no', async () => {
      confirm.mockResolvedValue(false);
      action('custom-1', 'delete').click();
      await flush();
      expect(api.deleteWorkspace).not.toHaveBeenCalled();
    });

    test('Guardar vista actual asks before replacing the options', async () => {
      action('custom-1', 'overwrite').click();
      await flush();
      expect(confirm).toHaveBeenCalledWith(expect.stringContaining('«Tarde»'));
      expect(api.overwriteWorkspace).toHaveBeenCalledWith('custom-1');
    });
  });

  describe('saving the current view', () => {
    const nameInput = () => document.getElementById('workspaces-new-name');

    test('Enter in the name field saves it and empties the field', async () => {
      nameInput().value = 'Recepción';
      key(nameInput(), 'Enter');
      await flush();
      expect(api.createWorkspace).toHaveBeenCalledWith('Recepción');
      expect(nameInput().value).toBe('');
    });

    test('shows the error of a name that is not valid and keeps it', async () => {
      api.createWorkspace.mockResolvedValue({ success: false, error: 'Ya hay un espacio de trabajo llamado «Captura».' });
      nameInput().value = 'Captura';
      document.getElementById('workspaces-new-btn').click();
      await flush();
      expect(error().textContent).toContain('Ya hay');
      expect(nameInput().value).toBe('Captura');
    });

    test('opening it to save puts the cursor on the name', async () => {
      modal.close();
      await modal.show('save');
      expect(document.activeElement).toBe(nameInput());
    });
  });

  describe('renaming', () => {
    const startRename = async () => {
      action('custom-1', 'rename').click();
      await flush();
      return row('custom-1').querySelector('.workspace-rename');
    };

    test('turns the name into a field', async () => {
      const input = await startRename();
      expect(input.value).toBe('Tarde');
      expect(document.activeElement).toBe(input);
    });

    test('Enter saves the new name once', async () => {
      const input = await startRename();
      input.value = 'Noche';
      key(input, 'Enter');
      await flush();
      expect(api.renameWorkspace).toHaveBeenCalledTimes(1);
      expect(api.renameWorkspace).toHaveBeenCalledWith('custom-1', 'Noche');
    });

    test('Escape cancels the rename without closing the window', async () => {
      const input = await startRename();
      input.value = 'Noche';
      key(input, 'Escape');
      await flush();
      expect(api.renameWorkspace).not.toHaveBeenCalled();
      expect(modal.isModalOpen()).toBe(true);
      expect(row('custom-1').querySelector('.workspace-name').textContent).toBe('Tarde');
    });

    test('keeps the field open with the error when the name is refused', async () => {
      api.renameWorkspace.mockResolvedValue({ success: false, error: 'Ya hay un espacio de trabajo llamado «Captura».' });
      const input = await startRename();
      input.value = 'Captura';
      key(input, 'Enter');
      await flush();
      expect(error().textContent).toContain('Ya hay');
      expect(row('custom-1').querySelector('.workspace-rename')).toBe(input);
    });

    test('a refresh from outside waits until the rename is done', async () => {
      await startRename();
      api.getWorkspaces.mockClear();
      await modal.refresh();
      expect(api.getWorkspaces).not.toHaveBeenCalled();
    });
  });
});
