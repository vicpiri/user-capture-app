/**
 * select-export-folder handler tests
 *
 * Every export asks for its destination through this handler, so the dialog
 * opens where the previous export went. What must hold: the chosen folder is
 * remembered and only when one is chosen, a folder that no longer exists
 * falls back to the nearest one above it, and the dialog always lets the user
 * pick and create folders.
 *
 * @jest-environment node
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const mockHandlers = new Map();
let mockUserDataPath;

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn((channel, handler) => mockHandlers.set(channel, handler))
  },
  dialog: { showOpenDialog: jest.fn(), showSaveDialog: jest.fn(), showMessageBox: jest.fn() },
  shell: { openPath: jest.fn(), openExternal: jest.fn() },
  app: {
    getPath: jest.fn(() => mockUserDataPath),
    getVersion: jest.fn(() => '0.0.0-test')
  },
  BrowserWindow: jest.fn()
}));

const { dialog } = require('electron');
const { registerMiscHandlers } = require('../../../src/main/ipc/miscHandlers');
const { getLastExportFolder, loadGlobalConfig } = require('../../../src/main/utils/config');

const logger = {
  info: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  section: jest.fn()
};

describe('select-export-folder', () => {
  const fixturesPath = path.join(os.tmpdir(), 'edu-capture-export-folder-tests');
  let testId = 0;
  let workPath;

  const mkdir = (...segments) => {
    const folder = path.join(...segments);
    fs.mkdirSync(folder, { recursive: true });
    return folder;
  };

  const choose = (folder) => dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [folder] });
  const cancel = () => dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
  const select = (options) => mockHandlers.get('select-export-folder')({}, options);
  const lastDialogOptions = () => dialog.showOpenDialog.mock.calls.at(-1)[1];

  beforeAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    fs.mkdirSync(fixturesPath, { recursive: true });

    registerMiscHandlers({
      mainWindow: () => null,
      logger,
      state: { dbManager: null, projectPath: null },
      imageGridWindow: () => null,
      repositoryGridWindow: () => null,
      createMenu: jest.fn(),
      reinitializeRepositoryMirror: jest.fn()
    });
  });

  afterAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    testId++;
    workPath = mkdir(fixturesPath, `case-${testId}`);
    mockUserDataPath = mkdir(workPath, 'userData');
  });

  test('should open without a folder the first time', async () => {
    cancel();

    await select({ title: 'Seleccionar carpeta para guardar el CSV' });

    expect(lastDialogOptions().defaultPath).toBeUndefined();
    expect(lastDialogOptions().title).toBe('Seleccionar carpeta para guardar el CSV');
  });

  test('should open where the last export went', async () => {
    const carnets = mkdir(workPath, 'Carnets');
    choose(carnets);
    await select({ title: 'CSV' });

    cancel();
    await select({ title: 'Imágenes' });

    expect(lastDialogOptions().defaultPath).toBe(carnets);
  });

  test('should share the folder between different exports', async () => {
    const orlas = mkdir(workPath, 'Orlas');
    choose(orlas);
    await select({ title: 'Seleccionar carpeta de exportación', buttonLabel: 'Exportar' });

    cancel();
    await select({ title: 'Seleccionar carpeta para guardar el CSV' });

    expect(lastDialogOptions().defaultPath).toBe(orlas);
  });

  test('should return what the dialog returned', async () => {
    const carnets = mkdir(workPath, 'Carnets');
    choose(carnets);

    await expect(select({})).resolves.toEqual({ canceled: false, filePaths: [carnets] });
  });

  test('should keep the previous folder when the dialog is cancelled', async () => {
    const carnets = mkdir(workPath, 'Carnets');
    choose(carnets);
    await select({});

    cancel();
    await select({});

    expect(getLastExportFolder()).toBe(carnets);
  });

  test('should keep it between sessions, in the application settings', async () => {
    const carnets = mkdir(workPath, 'Carnets');
    choose(carnets);

    await select({});

    expect(loadGlobalConfig().lastExportFolder).toBe(carnets);
  });

  test('should fall back to the nearest folder above one that was deleted', async () => {
    const course = mkdir(workPath, 'Curso 2526');
    const groupFolder = mkdir(course, 'Exportación 1');
    choose(groupFolder);
    await select({});

    fs.rmSync(groupFolder, { recursive: true, force: true });
    cancel();
    await select({});

    expect(lastDialogOptions().defaultPath).toBe(course);
  });

  test('should respect a folder the caller asks for', async () => {
    const carnets = mkdir(workPath, 'Carnets');
    const other = mkdir(workPath, 'Otra');
    choose(carnets);
    await select({});

    cancel();
    await select({ defaultPath: other });

    expect(lastDialogOptions().defaultPath).toBe(other);
  });

  test('should always let the user choose and create folders', async () => {
    cancel();

    await select({ properties: ['openDirectory'] });

    expect(lastDialogOptions().properties.sort()).toEqual(['createDirectory', 'openDirectory']);
  });
});
