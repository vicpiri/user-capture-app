/**
 * Ingest folder tests
 *
 * A project can take its photos from a folder other than its own 'ingest', so
 * other programs can feed it. What must hold: the choice survives in the
 * project, the watcher follows it without reopening the project, a missing
 * folder does not stop the project from opening, and the folders the watcher
 * would empty by mistake (imports, the repository) are refused.
 *
 * Drives the real watcher and database against temporary folders.
 *
 * @jest-environment node
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('electron', () => ({
  dialog: {
    showOpenDialog: jest.fn()
  },
  app: { getPath: jest.fn(() => require('os').tmpdir()) }
}));

// Messages and questions go to the main window's own modals
jest.mock('../../../src/main/appDialogs', () => ({
  showAppMessage: jest.fn(async () => {}),
  askAppQuestion: jest.fn(async () => 0),
  CANCELLED: -1
}));

const { dialog } = require('electron');
const { showAppMessage, askAppQuestion } = require('../../../src/main/appDialogs');
const DatabaseManager = require('../../../src/main/database');
const FolderWatcher = require('../../../src/main/folderWatcher');
const {
  INGEST_SETTING,
  getDefaultIngestPath,
  getActiveIngestPath,
  getConfiguredIngestPath,
  setConfiguredIngestPath,
  resolveWatchPath,
  validateIngestPath,
  startIngestWatcher,
  configureIngestFolder
} = require('../../../src/main/ingestFolder');

const logger = {
  info: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn()
};

// Buttons of the question asked when a custom folder is already configured
const CHOOSE_OTHER = 0;
const USE_DEFAULT = 1;
const CANCEL = -1;

describe('Ingest folder', () => {
  const fixturesPath = path.join(os.tmpdir(), 'edu-capture-ingest-tests');
  let testId = 0;
  let workPath;
  let projectPath;
  let externalPath;
  let state;
  let mainWindow;
  let getMainWindow;

  const mkdir = (...segments) => {
    const folder = path.join(...segments);
    fs.mkdirSync(folder, { recursive: true });
    return folder;
  };

  const waitForImage = (watcher) => new Promise((resolve) => watcher.once('image-added', resolve));

  beforeAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    fs.mkdirSync(fixturesPath, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  beforeEach(async () => {
    // Real timers: the shared setup enables fake ones, and the watcher works
    // against the real filesystem
    jest.useRealTimers();
    jest.clearAllMocks();

    testId++;
    workPath = mkdir(fixturesPath, `case-${testId}`);
    projectPath = mkdir(workPath, 'project');
    mkdir(projectPath, 'imports');
    mkdir(projectPath, 'ingest');
    mkdir(projectPath, 'data');
    externalPath = mkdir(workPath, 'tethering');

    const dbManager = new DatabaseManager(path.join(projectPath, 'data', 'users.db'));
    await dbManager.initialize();

    state = {
      projectPath,
      dbManager,
      folderWatcher: null,
      imageManager: { invalidateCache: jest.fn() }
    };

    mainWindow = { webContents: { send: jest.fn() } };
    getMainWindow = () => mainWindow;

    askAppQuestion.mockResolvedValue(CHOOSE_OTHER);
    dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
  });

  afterEach(async () => {
    if (state.folderWatcher) {
      await state.folderWatcher.stop();
    }
    await state.dbManager.close();
  });

  describe('validateIngestPath()', () => {
    const validate = (candidate, extra = {}) => validateIngestPath(candidate, { projectPath, ...extra });

    test('should accept a folder outside the project', () => {
      expect(validate(externalPath)).toBeNull();
    });

    test('should accept another subfolder of the project', () => {
      expect(validate(mkdir(projectPath, 'camara'))).toBeNull();
    });

    test('should refuse a folder that does not exist', () => {
      expect(validate(path.join(workPath, 'missing'))).toMatch(/no existe/);
    });

    test('should refuse the project folder and any folder holding it', () => {
      expect(validate(projectPath)).toMatch(/carpeta del proyecto/);
      expect(validate(workPath)).toMatch(/carpeta del proyecto/);
    });

    test('should refuse imports and anything inside it', () => {
      expect(validate(path.join(projectPath, 'imports'))).toMatch(/imports/);
      expect(validate(mkdir(projectPath, 'imports', 'sub'))).toMatch(/imports/);
    });

    test('should refuse the repository, a folder inside it and one holding it', () => {
      const drive = mkdir(workPath, 'drive');
      const repositoryPath = mkdir(drive, 'Fotos');
      const inside = mkdir(repositoryPath, 'To-Publish');

      expect(validate(repositoryPath, { repositoryPath })).toMatch(/depósito/);
      expect(validate(inside, { repositoryPath })).toMatch(/depósito/);
      expect(validate(drive, { repositoryPath })).toMatch(/depósito/);
    });

    test('should refuse the local copy of the repository', () => {
      const mirrorPath = mkdir(workPath, 'repository-mirror');

      expect(validate(mirrorPath, { mirrorPath })).toMatch(/depósito/);
    });

    test('should not mistake a sibling with a similar name for the repository', () => {
      const repositoryPath = mkdir(workPath, 'Fotos');
      const sibling = mkdir(workPath, 'Fotos nuevas');

      expect(validate(sibling, { repositoryPath })).toBeNull();
    });

    (process.platform === 'win32' ? test : test.skip)('should compare paths ignoring case on Windows', () => {
      expect(validate(path.join(projectPath, 'IMPORTS'))).toMatch(/imports/);
    });
  });

  describe('resolveWatchPath()', () => {
    test('should watch the default folder when nothing is configured', () => {
      expect(resolveWatchPath(projectPath, null)).toEqual({
        path: getDefaultIngestPath(projectPath),
        configuredPath: null,
        isCustom: false,
        unavailable: false
      });
    });

    test('should watch the configured folder when it exists', () => {
      expect(resolveWatchPath(projectPath, externalPath)).toEqual({
        path: externalPath,
        configuredPath: externalPath,
        isCustom: true,
        unavailable: false
      });
    });

    test('should fall back to the default folder when the configured one is missing', () => {
      const missing = path.join(workPath, 'unplugged');

      expect(resolveWatchPath(projectPath, missing)).toEqual({
        path: getDefaultIngestPath(projectPath),
        configuredPath: missing,
        isCustom: true,
        unavailable: true
      });
    });
  });

  describe('stored setting', () => {
    test('should have nothing configured for a new project', async () => {
      await expect(getConfiguredIngestPath(state.dbManager)).resolves.toBeNull();
    });

    test('should keep the chosen folder in the project database', async () => {
      await setConfiguredIngestPath(state.dbManager, externalPath);

      await expect(state.dbManager.getProjectSetting(INGEST_SETTING)).resolves.toBe(externalPath);
      await expect(getConfiguredIngestPath(state.dbManager)).resolves.toBe(externalPath);
    });

    test('should forget it when going back to the default', async () => {
      await setConfiguredIngestPath(state.dbManager, externalPath);

      await setConfiguredIngestPath(state.dbManager, null);

      await expect(getConfiguredIngestPath(state.dbManager)).resolves.toBeNull();
    });

    test('should report nothing when there is no project', async () => {
      await expect(getConfiguredIngestPath(null)).resolves.toBeNull();
    });
  });

  describe('startIngestWatcher()', () => {
    const start = () => startIngestWatcher({ state, logger, getMainWindow });

    test('should watch the default folder of the project', async () => {
      await start();

      expect(state.folderWatcher.ingestPath).toBe(getDefaultIngestPath(projectPath));
      expect(getActiveIngestPath(state)).toBe(getDefaultIngestPath(projectPath));
    });

    test('should create the default folder when it is missing', async () => {
      fs.rmSync(getDefaultIngestPath(projectPath), { recursive: true, force: true });

      await start();

      expect(fs.existsSync(getDefaultIngestPath(projectPath))).toBe(true);
    });

    test('should move photos from a custom folder into imports', async () => {
      await setConfiguredIngestPath(state.dbManager, externalPath);
      await start();
      const added = waitForImage(state.folderWatcher);

      fs.writeFileSync(path.join(externalPath, 'IMG_0001.jpg'), 'content');
      const filename = await added;

      expect(fs.existsSync(path.join(projectPath, 'imports', filename))).toBe(true);
      expect(fs.existsSync(path.join(externalPath, 'IMG_0001.jpg'))).toBe(false);
      expect(state.imageManager.invalidateCache).toHaveBeenCalled();
      expect(mainWindow.webContents.send).toHaveBeenCalledWith('new-image-detected', filename);
    });

    test('should tell the viewer when a photo over 5 MB is not imported', async () => {
      await start();
      const rejected = new Promise((resolve) => state.folderWatcher.once('image-rejected', resolve));
      const big = path.join(getDefaultIngestPath(projectPath), 'enorme.jpg');

      fs.writeFileSync(big, Buffer.alloc(5 * 1024 * 1024 + 1));
      await rejected;

      expect(mainWindow.webContents.send).toHaveBeenCalledWith('image-rejected', {
        filename: 'enorme.jpg',
        message: expect.stringContaining('más de 5 MB')
      });
      // Left where it was, so it can be made smaller and dropped in again
      expect(fs.existsSync(big)).toBe(true);
      expect(fs.readdirSync(path.join(projectPath, 'imports'))).toEqual([]);
    });

    test('should watch the default folder and warn when the custom one is missing', async () => {
      const missing = path.join(workPath, 'unplugged');
      await setConfiguredIngestPath(state.dbManager, missing);

      const watch = await start();

      expect(watch.unavailable).toBe(true);
      expect(state.folderWatcher.ingestPath).toBe(getDefaultIngestPath(projectPath));
      expect(showAppMessage).toHaveBeenCalledWith(mainWindow, expect.objectContaining({
        title: 'Carpeta de entrada no disponible',
        detail: expect.stringContaining(missing)
      }));
      // Kept, so the folder is used again once it is back
      await expect(getConfiguredIngestPath(state.dbManager)).resolves.toBe(missing);
    });
  });

  describe('configureIngestFolder()', () => {
    const configure = () => configureIngestFolder({ state, logger, getMainWindow });
    const pick = (folder) => dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [folder] });

    beforeEach(async () => {
      await startIngestWatcher({ state, logger, getMainWindow });
      jest.clearAllMocks();
    });

    test('should refuse to run without a project', async () => {
      state.projectPath = null;

      const result = await configure();

      expect(result).toEqual(expect.objectContaining({ success: false, changed: false }));
      expect(dialog.showOpenDialog).not.toHaveBeenCalled();
      expect(showAppMessage).toHaveBeenCalledWith(mainWindow, expect.objectContaining({
        message: expect.stringContaining('ningún proyecto')
      }));
    });

    test('should confirm the new folder in the app\'s own dialog', async () => {
      pick(externalPath);

      await configure();

      expect(showAppMessage).toHaveBeenCalledWith(mainWindow, expect.objectContaining({
        title: 'Configuración guardada',
        detail: expect.stringContaining(externalPath)
      }));
    });

    test('should go straight to the folder picker when the default is in use', async () => {
      await configure();

      expect(askAppQuestion).not.toHaveBeenCalled();
      expect(dialog.showOpenDialog).toHaveBeenCalledTimes(1);
    });

    test('should save the chosen folder and start watching it right away', async () => {
      const previousWatcher = state.folderWatcher;
      pick(externalPath);

      const result = await configure();

      expect(result).toEqual({ success: true, changed: true, ingestPath: externalPath });
      await expect(getConfiguredIngestPath(state.dbManager)).resolves.toBe(externalPath);
      expect(state.folderWatcher).not.toBe(previousWatcher);
      expect(previousWatcher.watcher).toBeNull();
      expect(getActiveIngestPath(state)).toBe(externalPath);
    });

    test('should import from the new folder without reopening the project', async () => {
      pick(externalPath);
      await configure();
      const added = waitForImage(state.folderWatcher);

      fs.writeFileSync(path.join(externalPath, 'from-other-program.jpg'), 'content');

      await expect(added).resolves.toMatch(/^\d{14}(_\d+)?\.jpg$/);
    });

    test('should stop taking photos from the previous folder', async () => {
      pick(externalPath);
      await configure();

      const leftBehind = path.join(getDefaultIngestPath(projectPath), 'left-behind.jpg');
      fs.writeFileSync(leftBehind, 'content');
      await new Promise(resolve => setTimeout(resolve, 700));

      expect(fs.existsSync(leftBehind)).toBe(true);
    });

    test('should change nothing when the picker is cancelled', async () => {
      const previousWatcher = state.folderWatcher;

      const result = await configure();

      expect(result).toEqual({ success: true, changed: false });
      expect(state.folderWatcher).toBe(previousWatcher);
      await expect(getConfiguredIngestPath(state.dbManager)).resolves.toBeNull();
    });

    test('should refuse an unsafe folder and keep the current one', async () => {
      const previousWatcher = state.folderWatcher;
      pick(path.join(projectPath, 'imports'));

      const result = await configure();

      expect(result.success).toBe(false);
      expect(showAppMessage).toHaveBeenCalledWith(mainWindow, {
        title: 'Carpeta de entrada',
        message: expect.stringMatching(/imports/)
      });
      expect(state.folderWatcher).toBe(previousWatcher);
      await expect(getConfiguredIngestPath(state.dbManager)).resolves.toBeNull();
    });

    test('should refuse the configured repository', async () => {
      const repositoryPath = mkdir(workPath, 'repositorio');
      await state.dbManager.setProjectSetting('imageRepositoryPath', repositoryPath);
      pick(repositoryPath);

      const result = await configure();

      expect(result.success).toBe(false);
      expect(showAppMessage).toHaveBeenCalledWith(mainWindow, {
        title: 'Carpeta de entrada',
        message: expect.stringMatching(/depósito/)
      });
    });

    describe('with a custom folder configured', () => {
      beforeEach(async () => {
        pick(externalPath);
        await configure();
        jest.clearAllMocks();
      });

      test('should offer going back to the default before the picker', async () => {
        askAppQuestion.mockResolvedValueOnce(CANCEL);

        await configure();

        expect(askAppQuestion).toHaveBeenCalledWith(mainWindow, expect.objectContaining({
          choices: ['Elegir otra carpeta...', 'Usar la carpeta por defecto']
        }));
        expect(dialog.showOpenDialog).not.toHaveBeenCalled();
      });

      test('should go back to the default folder', async () => {
        askAppQuestion.mockResolvedValueOnce(USE_DEFAULT);

        const result = await configure();

        expect(result).toEqual({ success: true, changed: true, ingestPath: getDefaultIngestPath(projectPath) });
        await expect(getConfiguredIngestPath(state.dbManager)).resolves.toBeNull();
        expect(getActiveIngestPath(state)).toBe(getDefaultIngestPath(projectPath));
      });

      test('should treat picking the default folder as going back to it', async () => {
        askAppQuestion.mockResolvedValueOnce(CHOOSE_OTHER);
        pick(getDefaultIngestPath(projectPath));

        await configure();

        await expect(getConfiguredIngestPath(state.dbManager)).resolves.toBeNull();
      });

      test('should report no change when the same folder is picked again', async () => {
        const previousWatcher = state.folderWatcher;
        askAppQuestion.mockResolvedValueOnce(CHOOSE_OTHER);
        pick(externalPath);

        const result = await configure();

        expect(result).toEqual({ success: true, changed: false });
        expect(state.folderWatcher).toBe(previousWatcher);
      });
    });
  });

  describe('FolderWatcher ignore rules', () => {
    const watcherOn = (folder) => new FolderWatcher(folder, path.join(projectPath, 'imports'));

    test('should not treat a folder under a dot-prefixed parent as hidden', () => {
      const folder = mkdir(workPath, '.config', 'camara');

      expect(watcherOn(folder).isIgnored(path.join(folder, 'IMG_0001.jpg'))).toBe(false);
      expect(watcherOn(folder).isIgnored(folder)).toBe(false);
    });

    test('should still ignore hidden and temporary files inside the folder', () => {
      const watcher = watcherOn(externalPath);

      expect(watcher.isIgnored(path.join(externalPath, '.IMG_0001.jpg'))).toBe(true);
      expect(watcher.isIgnored(path.join(externalPath, 'IMG_0001.jpg.crdownload'))).toBe(true);
      expect(watcher.isIgnored(path.join(externalPath, '.sync', 'IMG_0001.jpg'))).toBe(true);
    });

    test('should import photos from a folder under a dot-prefixed parent', async () => {
      const folder = mkdir(workPath, '.config', 'camara');
      await setConfiguredIngestPath(state.dbManager, folder);
      await startIngestWatcher({ state, logger, getMainWindow });
      const added = waitForImage(state.folderWatcher);

      fs.writeFileSync(path.join(folder, 'IMG_0001.jpg'), 'content');

      await expect(added).resolves.toMatch(/^\d{14}(_\d+)?\.jpg$/);
    });
  });

  describe('FolderWatcher.moveFile()', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should copy and delete when the rename cannot cross drives', () => {
      const source = path.join(externalPath, 'photo.jpg');
      const destination = path.join(projectPath, 'imports', 'photo.jpg');
      fs.writeFileSync(source, 'content');
      jest.spyOn(fs, 'renameSync').mockImplementation(() => {
        throw Object.assign(new Error('cross-device link not permitted'), { code: 'EXDEV' });
      });

      new FolderWatcher(externalPath, path.join(projectPath, 'imports')).moveFile(source, destination);

      expect(fs.readFileSync(destination, 'utf8')).toBe('content');
      expect(fs.existsSync(source)).toBe(false);
    });

    test('should not hide any other rename failure', () => {
      const source = path.join(externalPath, 'photo.jpg');
      fs.writeFileSync(source, 'content');
      jest.spyOn(fs, 'renameSync').mockImplementation(() => {
        throw Object.assign(new Error('busy'), { code: 'EBUSY' });
      });

      const watcher = new FolderWatcher(externalPath, path.join(projectPath, 'imports'));

      expect(() => watcher.moveFile(source, path.join(projectPath, 'imports', 'photo.jpg'))).toThrow('busy');
      expect(fs.existsSync(source)).toBe(true);
    });
  });
});
