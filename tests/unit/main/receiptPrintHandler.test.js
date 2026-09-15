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
// The Windows helper, or null when it is not available
let mockHelper = null;

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
const { ReceiptPrinterUnavailableError } = require('../../../src/main/receiptPrinter');
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
      reinitializeRepositoryMirror: jest.fn(),
      receiptPrinter: () => mockHelper
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
    mockHelper = null;
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

  test('should keep the 80 x 297 mm page of the roll driver', async () => {
    // A page cut to the receipt's height was centred on the driver's 297 mm
    // page, and the Epson fed blank paper before the logo
    await print();

    expect(mockPrintWindows[0].printOptions.pageSize).toEqual({ width: 80000, height: 297000 });
  });

  describe('with the Windows helper', () => {
    const helper = (print) => ({ isAvailable: () => true, print: jest.fn(print) });

    test('should print through it and not through Chromium', async () => {
      saveGlobalConfig({
        printer: { name: 'TM-T20', displayName: 'Epson TM-T20' },
        centerName: 'IES Prueba',
        receiptConfig: { subtitle: 'Reserva de orla', price: 0, footerText: 'Primera línea.\n\n  Segunda línea.  ' }
      });
      mockHelper = helper(async () => ({ success: true }));

      await expect(print()).resolves.toEqual({ success: true });

      expect(mockPrintWindows).toHaveLength(0);
      expect(mockHelper.print).toHaveBeenCalledWith(expect.objectContaining({
        printer: 'TM-T20',
        centerName: 'IES Prueba',
        subtitle: 'Reserva de orla',
        userName: 'ANA GARCIA',
        groupName: '1º ESO A',
        price: '0.00',
        footerLines: ['Primera línea.', 'Segunda línea.'],
        logoPath: ''
      }));
      expect(mockHelper.print.mock.calls[0][0].date).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/);
    });

    test('should use the default centre name and the default printer when none is set', async () => {
      mockHelper = helper(async () => ({ success: true }));

      await print();

      expect(mockHelper.print).toHaveBeenCalledWith(expect.objectContaining({ printer: '', centerName: 'IES La Marxadella', price: '18.00' }));
    });

    test('should report a printer failure without printing again through Chromium', async () => {
      // Printing again another way could give two receipts
      saveGlobalConfig({ printer: { name: 'TM-T20', displayName: 'Epson TM-T20' } });
      mockHelper = helper(async () => ({ success: false, error: 'La impresora «TM-T20» no está instalada en este equipo' }));

      const result = await print();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Epson TM-T20');
      expect(result.error).toContain('no está instalada');
      expect(mockPrintWindows).toHaveLength(0);
    });

    test('should fall back to Chromium when the helper cannot be used', async () => {
      saveGlobalConfig({ printer: { name: 'TM-T20', displayName: 'Epson TM-T20' } });
      mockHelper = helper(async () => { throw new ReceiptPrinterUnavailableError('The receipt printer helper stopped'); });

      await expect(print()).resolves.toEqual({ success: true });

      expect(mockPrintWindows).toHaveLength(1);
      expect(mockPrintWindows[0].printOptions.deviceName).toBe('TM-T20');
    });

    test('should use Chromium when the helper is not built', async () => {
      mockHelper = { isAvailable: () => false, print: jest.fn() };

      await print();

      expect(mockHelper.print).not.toHaveBeenCalled();
      expect(mockPrintWindows).toHaveLength(1);
    });
  });

  test('should close the hidden print window either way', async () => {
    mockPrintOutcome = { success: false, errorType: 'Print job failed' };

    await print();

    expect(mockPrintWindows[0].close).toHaveBeenCalled();
  });
});
