/**
 * get-preferences and save-preferences handler tests
 *
 * The preferences window owns the institution and receipt data. The display
 * options it once had moved to the Ver menu, but saving the window kept
 * writing them from values it no longer sent, which turned them off. Saving
 * must now leave every setting it does not own as it was.
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

const { registerMiscHandlers } = require('../../../src/main/ipc/miscHandlers');
const { loadGlobalConfig, saveGlobalConfig, saveDisplayPreferences } = require('../../../src/main/utils/config');

const logger = {
  info: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  section: jest.fn()
};

describe('preferences handlers', () => {
  const fixturesPath = path.join(os.tmpdir(), 'edu-capture-preferences-tests');
  let testId = 0;

  // Exactly what the preferences window sends when saving
  const FORM = {
    centerName: 'IES Ejemplo',
    logoPath: 'C:\\logos\\centro.png',
    receiptSubtitle: 'Orla 2025-2026',
    receiptPrice: 20,
    receiptFooter: 'Gracias'
  };

  // The Ver options, set to the opposite of every default
  const DISPLAY = {
    showDuplicatesOnly: true,
    showCardPrintRequestsOnly: false,
    showCapturedPhotos: false,
    showRepositoryPhotos: true,
    showRepositoryIndicators: true,
    showAdditionalActions: false,
    showCaptureHistory: true
  };

  const call = (channel, ...args) => mockHandlers.get(channel)({}, ...args);

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
    mockUserDataPath = path.join(fixturesPath, `userData-${testId}`);
    fs.mkdirSync(mockUserDataPath, { recursive: true });
  });

  describe('save-preferences', () => {
    test('should keep the Ver options exactly as they were', async () => {
      saveDisplayPreferences(DISPLAY);

      await call('save-preferences', FORM);

      expect(loadGlobalConfig()).toEqual(expect.objectContaining(DISPLAY));
    });

    test('should not write the Ver options when they were never set', async () => {
      await call('save-preferences', FORM);

      const config = loadGlobalConfig();
      expect(config).not.toHaveProperty('showCapturedPhotos');
      expect(config).not.toHaveProperty('showAdditionalActions');
    });

    test('should keep settings from elsewhere in the application', async () => {
      saveGlobalConfig({ lastExportFolder: 'D:\\Exportaciones', recentProjects: ['D:\\Proyecto'] });

      await call('save-preferences', FORM);

      expect(loadGlobalConfig()).toEqual(expect.objectContaining({
        lastExportFolder: 'D:\\Exportaciones',
        recentProjects: ['D:\\Proyecto']
      }));
    });

    test('should save the institution and receipt data', async () => {
      const result = await call('save-preferences', FORM);

      expect(result).toEqual({ success: true });
      expect(loadGlobalConfig()).toEqual(expect.objectContaining({
        centerName: 'IES Ejemplo',
        logoPath: 'C:\\logos\\centro.png',
        receiptConfig: { subtitle: 'Orla 2025-2026', price: 20, footerText: 'Gracias' }
      }));
    });
  });

  describe('get-preferences', () => {
    test('should return what the preferences window edits, and nothing else', async () => {
      saveDisplayPreferences(DISPLAY);
      await call('save-preferences', FORM);

      const result = await call('get-preferences');

      expect(result).toEqual({ success: true, preferences: FORM });
    });

    test('should fill in defaults before anything is saved', async () => {
      const result = await call('get-preferences');

      expect(result.preferences).toEqual({
        centerName: '',
        logoPath: '',
        receiptSubtitle: '',
        receiptPrice: 18,
        receiptFooter: ''
      });
    });
  });
});
