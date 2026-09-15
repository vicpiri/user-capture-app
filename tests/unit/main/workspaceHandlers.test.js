/**
 * Workspace handler tests
 *
 * The window of Ver > Espacios de trabajo works through these channels. What
 * matters here: changes use the current view, the menu is rebuilt after a
 * change that worked (and only then), and failures come back as answers.
 *
 * @jest-environment node
 */

const mockHandlers = new Map();
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn((channel, handler) => mockHandlers.set(channel, handler))
  }
}));

const { registerWorkspaceHandlers } = require('../../../src/main/ipc/workspaceHandlers');
const { WorkspaceStore } = require('../../../src/main/workspaces');

describe('workspace handlers', () => {
  let stored;
  let currentView;
  let applyWorkspace;
  let refreshWorkspaces;
  let logger;
  let store;

  const call = (channel, ...args) => mockHandlers.get(channel)({}, ...args);

  beforeEach(() => {
    mockHandlers.clear();
    stored = {};
    store = new WorkspaceStore({ load: () => stored, save: (settings) => { stored = settings; } });
    currentView = {
      showCapturedPhotos: true,
      showRepositoryPhotos: true,
      showRepositoryIndicators: true,
      showAdditionalActions: false,
      showCaptureHistory: false,
      showThumbnailGrid: false
    };
    applyWorkspace = jest.fn(async () => ({ success: true }));
    refreshWorkspaces = jest.fn();
    logger = { info: jest.fn(), error: jest.fn() };
    registerWorkspaceHandlers({
      workspaceStore: store,
      getCurrentView: () => currentView,
      applyWorkspace,
      refreshWorkspaces,
      logger
    });
  });

  test('registers its channels', () => {
    expect([...mockHandlers.keys()].sort()).toEqual([
      'apply-workspace', 'create-workspace', 'delete-workspace', 'get-workspaces',
      'overwrite-workspace', 'rename-workspace', 'set-workspace-hidden'
    ]);
  });

  test('get-workspaces lists them with the one the view matches', async () => {
    const result = await call('get-workspaces');
    expect(result.workspaces).toHaveLength(3);
    // The current view is exactly Revisión
    expect(result.activeId).toBe('revision');
    expect(result.currentView).toEqual(currentView);
  });

  test('create-workspace saves the current view and refreshes the menu', async () => {
    currentView.showCaptureHistory = true;

    const result = await call('create-workspace', 'Tarde');

    expect(result.success).toBe(true);
    expect(store.get(result.workspace.id).view.showCaptureHistory).toBe(true);
    expect(refreshWorkspaces).toHaveBeenCalledTimes(1);
  });

  test('a change that fails leaves the menu alone', async () => {
    const result = await call('create-workspace', '');
    expect(result.success).toBe(false);
    expect(refreshWorkspaces).not.toHaveBeenCalled();
  });

  test('overwrite-workspace takes the current view', async () => {
    const { workspace } = store.create('Tarde', { showCapturedPhotos: false });

    await call('overwrite-workspace', workspace.id);

    expect(store.get(workspace.id).view).toEqual(currentView);
  });

  test('rename-workspace, delete-workspace and set-workspace-hidden reach the store', async () => {
    const { workspace } = store.create('Tarde', currentView);

    await expect(call('rename-workspace', workspace.id, 'Noche')).resolves.toMatchObject({ success: true });
    await expect(call('set-workspace-hidden', 'carnets', true)).resolves.toEqual({ success: true });
    await expect(call('delete-workspace', workspace.id)).resolves.toEqual({ success: true });

    expect(store.get(workspace.id)).toBeNull();
    expect(store.get('carnets').hidden).toBe(true);
    expect(refreshWorkspaces).toHaveBeenCalledTimes(3);
  });

  test('apply-workspace applies it and refreshes the menu', async () => {
    await expect(call('apply-workspace', 'captura')).resolves.toEqual({ success: true });
    expect(applyWorkspace).toHaveBeenCalledWith('captura');
    expect(refreshWorkspaces).toHaveBeenCalledTimes(1);
  });

  test('turns an exception into an answer', async () => {
    applyWorkspace.mockRejectedValue(new Error('broken'));
    await expect(call('apply-workspace', 'captura')).resolves.toEqual({ success: false, error: 'broken' });
    expect(logger.error).toHaveBeenCalled();
  });
});
