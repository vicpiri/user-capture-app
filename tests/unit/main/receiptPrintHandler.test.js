/**
 * print-orla-receipt handler tests
 *
 * The receipt used to be reported as printed as soon as it was sent, before
 * the printer answered, so the main window marked it as printed even when
 * the printer failed or there was none. The handler must now wait for the
 * printer and pass its failure on.
 *
 * @jest-environment node
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const mockHandlers = new Map();
let mockUserDataPath;
let mockPrintOutcome;
let mockPrintWindows;

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
  // A hidden window whose printer answers with mockPrintOutcome
  BrowserWindow: jest.fn().mockImplementation(() => {
    const win = {
      loadURL: jest.fn().mockResolvedValue(),
      close: jest.fn(),
      webContents: {
        print: jest.fn((options, callback) => {
          win.printOptions = options;
          setImmediate(() => callback(mockPrintOutcome.success, mockPrintOutcome.errorType));
        })
      }
    };
    mockPrintWindows.push(win);
    return win;
  })
}));

const { registerMiscHandlers } = require('../../../src/main/ipc/miscHandlers');
const { saveGlobalConfig } = require('../../../src/main/utils/config');

const logger = {
  info: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  section: jest.fn()
};

describe('print-orla-receipt', () => {
  const fixturesPath = path.join(os.tmpdir(), 'edu-capture-receipt-tests');
  let testId = 0;

  const print = () => mockHandlers.get('print-orla-receipt')({}, { userName: 'ANA GARCIA', groupName: '1º ESO A' });

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
    jest.useRealTimers();
    testId++;
    mockUserDataPath = path.join(fixturesPath, `userData-${testId}`);
    fs.mkdirSync(mockUserDataPath, { recursive: true });
    mockPrintWindows = [];
    mockPrintOutcome = { success: true, errorType: '' };
  });

  test('should report success once the printer has printed', async () => {
    saveGlobalConfig({ printer: { name: 'TM-T20', displayName: 'Epson TM-T20' } });

    await expect(print()).resolves.toEqual({ success: true });
    expect(mockPrintWindows[0].printOptions.deviceName).toBe('TM-T20');
  });

  test('should report the failure when the printer fails', async () => {
    saveGlobalConfig({ printer: { name: 'TM-T20', displayName: 'Epson TM-T20' } });
    mockPrintOutcome = { success: false, errorType: 'Print job failed' };

    const result = await print();

    expect(result.success).toBe(false);
    expect(result.error).toContain('Epson TM-T20');
    expect(result.error).toContain('Print job failed');
  });

  test('should point to the printer settings when none is configured', async () => {
    mockPrintOutcome = { success: false, errorType: 'Invalid printer settings' };

    const result = await print();

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no hay impresora configurada/);
    expect(result.error).toMatch(/Archivo > Preferencias/);
  });

  test('should close the hidden print window either way', async () => {
    mockPrintOutcome = { success: false, errorType: 'Print job failed' };

    await print();

    expect(mockPrintWindows[0].close).toHaveBeenCalled();
  });
});
