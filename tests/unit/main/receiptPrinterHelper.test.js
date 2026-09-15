/**
 * The real receipt printer helper
 *
 * Runs build/receipt-printer/ReceiptPrinter.exe through the service, so the
 * protocol, the accents and the drawing are checked end to end. Only on
 * Windows with the helper built (npm install builds it); skipped elsewhere.
 * Nothing is printed: the receipt is drawn into a PNG, and the printer that
 * is tried does not exist.
 *
 * @jest-environment node
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const { ReceiptPrinter } = require('../../../src/main/receiptPrinter');

const exePath = path.join(__dirname, '../../../build/receipt-printer/ReceiptPrinter.exe');
const describeWithHelper = process.platform === 'win32' && fs.existsSync(exePath) ? describe : describe.skip;

describeWithHelper('the receipt printer helper', () => {
  const logger = { info: jest.fn(), warning: jest.fn(), error: jest.fn() };
  const folder = path.join(os.tmpdir(), 'edu-capture-receipt-helper');
  let printer;

  const receipt = {
    centerName: 'IES La Marxadella',
    subtitle: 'Reserva de una copia de Orla',
    userName: 'MARÍA NÚÑEZ PEÑA',
    groupName: '1º ESO A',
    date: '15/09/2026 20:30:00',
    price: '18.00',
    footerLines: ['Este resguardo es personal e intransferible.', 'Por favor, entrégalo en la dirección del centro.'],
    logoPath: ''
  };

  beforeAll(() => {
    fs.mkdirSync(folder, { recursive: true });
    printer = new ReceiptPrinter({ exePath, logger, startTimeoutMs: 15000, jobTimeoutMs: 15000 });
  });

  afterAll(() => {
    printer.dispose();
    fs.rmSync(folder, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.useRealTimers();
  });

  test('draws a receipt 72 mm wide at 203 dpi', async () => {
    const file = path.join(folder, 'recibo.png');

    await expect(printer.print({ ...receipt, previewFile: file })).resolves.toEqual({ success: true });

    const { width, height } = await sharp(file).metadata();
    expect(width).toBe(Math.ceil(72 / 25.4 * 203));
    expect(height).toBeGreaterThan(400);
  }, 20000);

  test('a longer footer makes a longer receipt', async () => {
    const short = path.join(folder, 'corto.png');
    const long = path.join(folder, 'largo.png');

    await printer.print({ ...receipt, previewFile: short });
    await printer.print({ ...receipt, footerLines: [...receipt.footerLines, 'Una línea más de pie para el recibo, lo bastante larga para ocupar dos.'], previewFile: long });

    const heightOf = async (file) => (await sharp(file).metadata()).height;
    expect(await heightOf(long)).toBeGreaterThan(await heightOf(short));
  }, 20000);

  test('reports a printer that is not installed, with its name', async () => {
    const result = await printer.print({ ...receipt, printer: 'Impresora que no existe 4815162342' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Impresora que no existe 4815162342');
    expect(result.error).toContain('no está instalada');
  }, 20000);
});
