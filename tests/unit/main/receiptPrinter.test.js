/**
 * ReceiptPrinter tests
 *
 * The service keeps the Windows helper running and talks to it one JSON line
 * at a time. What must hold: receipts reach the helper intact, each answer
 * goes to its receipt, a printer failure is an answer while a helper that
 * cannot be used is an error (the caller falls back to Chromium only then),
 * and a helper that dies or hangs is replaced for the next receipt.
 *
 * @jest-environment node
 */

const { EventEmitter } = require('events');
const {
  ReceiptPrinter,
  ReceiptPrinterUnavailableError,
  asciiJson
} = require('../../../src/main/receiptPrinter');

describe('ReceiptPrinter', () => {
  let children;
  let spawn;
  let logger;

  // A helper process the test answers for
  const createChild = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write: jest.fn(), end: jest.fn() };
    child.kill = jest.fn();
    child.say = (answer) => child.stdout.emit('data', `${JSON.stringify(answer)}\n`);
    child.jobs = () => child.stdin.write.mock.calls.map(([line]) => JSON.parse(line));
    return child;
  };

  const createPrinter = (overrides = {}) => new ReceiptPrinter({
    exePath: 'C:/app/ReceiptPrinter.exe',
    logger,
    spawn,
    platform: 'win32',
    fileExists: () => true,
    startTimeoutMs: 200,
    jobTimeoutMs: 200,
    ...overrides
  });

  // Starts a print and makes the helper ready
  const startPrint = async (printer, job = { userName: 'ANA' }) => {
    const printing = printer.print(job);
    await Promise.resolve();
    const child = children[children.length - 1];
    child.say({ ready: true });
    await new Promise((resolve) => setImmediate(resolve));
    return { printing, child };
  };

  beforeEach(() => {
    jest.useRealTimers();
    children = [];
    spawn = jest.fn(() => {
      const child = createChild();
      children.push(child);
      return child;
    });
    logger = { info: jest.fn(), warning: jest.fn(), error: jest.fn() };
  });

  describe('availability', () => {
    test('is available on Windows with the helper built', () => {
      expect(createPrinter().isAvailable()).toBe(true);
    });

    test('is not available elsewhere', () => {
      expect(createPrinter({ platform: 'darwin' }).isAvailable()).toBe(false);
    });

    test('is not available until the helper is built', () => {
      expect(createPrinter({ fileExists: () => false }).isAvailable()).toBe(false);
    });

    test('print refuses without a helper, so the caller uses Chromium', async () => {
      await expect(createPrinter({ fileExists: () => false }).print({})).rejects.toBeInstanceOf(ReceiptPrinterUnavailableError);
      expect(spawn).not.toHaveBeenCalled();
    });
  });

  describe('printing', () => {
    test('starts the helper hidden and sends the receipt once it is ready', async () => {
      const printer = createPrinter();
      const { printing, child } = await startPrint(printer, { userName: 'ANA', price: '18.00' });

      expect(spawn).toHaveBeenCalledWith('C:/app/ReceiptPrinter.exe', [], expect.objectContaining({ windowsHide: true }));
      expect(child.jobs()).toEqual([{ userName: 'ANA', price: '18.00', id: 1 }]);
      child.say({ id: 1, success: true });
      await printing;
    });

    test('resolves with the helper\'s answer', async () => {
      const printer = createPrinter();
      const { printing, child } = await startPrint(printer);

      child.say({ id: 1, success: true });

      await expect(printing).resolves.toEqual({ success: true });
    });

    test('reports a printer failure as an answer, not an error', async () => {
      const printer = createPrinter();
      const { printing, child } = await startPrint(printer);

      child.say({ id: 1, success: false, error: 'La impresora «X» no está instalada en este equipo' });

      await expect(printing).resolves.toEqual({ success: false, error: 'La impresora «X» no está instalada en este equipo' });
    });

    test('keeps the helper for the next receipt', async () => {
      const printer = createPrinter();
      const { printing, child } = await startPrint(printer);
      child.say({ id: 1, success: true });
      await printing;

      const second = printer.print({ userName: 'LUIS' });
      await new Promise((resolve) => setImmediate(resolve));
      child.say({ id: 2, success: true });

      await expect(second).resolves.toEqual({ success: true });
      expect(spawn).toHaveBeenCalledTimes(1);
    });

    test('gives each answer to its receipt', async () => {
      const printer = createPrinter();
      const { printing: first, child } = await startPrint(printer);
      const second = printer.print({ userName: 'LUIS' });
      await new Promise((resolve) => setImmediate(resolve));

      child.say({ id: 2, success: false, error: 'sin papel' });
      child.say({ id: 1, success: true });

      await expect(first).resolves.toEqual({ success: true });
      await expect(second).resolves.toEqual({ success: false, error: 'sin papel' });
    });

    test('reads answers split across chunks', async () => {
      const printer = createPrinter();
      const { printing, child } = await startPrint(printer);

      child.stdout.emit('data', '{"id":1,"succ');
      child.stdout.emit('data', 'ess":true}\n');

      await expect(printing).resolves.toEqual({ success: true });
    });

    test('warmUp starts the helper before the first receipt', async () => {
      const printer = createPrinter();
      const warming = printer.warmUp();
      children[0].say({ ready: true });
      await warming;

      const printing = printer.print({ userName: 'ANA' });
      await new Promise((resolve) => setImmediate(resolve));
      children[0].say({ id: 1, success: true });

      await expect(printing).resolves.toEqual({ success: true });
      expect(spawn).toHaveBeenCalledTimes(1);
    });
  });

  describe('a helper that cannot be used', () => {
    test('one that never gets ready is an error', async () => {
      const printer = createPrinter();
      await expect(printer.print({})).rejects.toThrow(/did not start/);
    });

    test('one that fails to start is an error', async () => {
      spawn = jest.fn(() => { throw new Error('ENOENT'); });
      const printer = createPrinter();
      await expect(printer.print({})).rejects.toBeInstanceOf(ReceiptPrinterUnavailableError);
    });

    test('one that dies with a receipt pending is an error, and is started again next time', async () => {
      const printer = createPrinter();
      const { printing, child } = await startPrint(printer);

      child.emit('exit', 1);

      await expect(printing).rejects.toThrow(/stopped/);
      const { printing: next, child: second } = await startPrint(printer);
      expect(spawn).toHaveBeenCalledTimes(2);
      second.say({ id: 2, success: true });
      await expect(next).resolves.toEqual({ success: true });
    });

    test('one that does not answer a receipt is an error, and is replaced', async () => {
      const printer = createPrinter();
      const { printing, child } = await startPrint(printer);

      await expect(printing).rejects.toThrow(/did not answer/);
      expect(child.kill).toHaveBeenCalled();
    });

    test('warmUp only logs a failure', async () => {
      spawn = jest.fn(() => { throw new Error('ENOENT'); });
      await expect(createPrinter().warmUp()).resolves.toBeUndefined();
      expect(logger.warning).toHaveBeenCalled();
    });
  });

  test('dispose stops the helper', async () => {
    const printer = createPrinter();
    const { printing, child } = await startPrint(printer);
    child.say({ id: 1, success: true });
    await printing;

    printer.dispose();

    expect(child.stdin.end).toHaveBeenCalled();
    expect(child.kill).toHaveBeenCalled();
  });

  test('asciiJson escapes everything outside ASCII and stays valid JSON', () => {
    const line = asciiJson({ name: 'MARÍA NÚÑEZ', price: '18.00€', group: '1º ESO' });
    expect(line).toMatch(/^[ -~]*$/);
    expect(JSON.parse(line)).toEqual({ name: 'MARÍA NÚÑEZ', price: '18.00€', group: '1º ESO' });
  });
});
