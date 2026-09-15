/**
 * ReceiptPrinter - prints the orla receipts through the Windows helper
 *
 * Chromium prints by turning the page into an image, and on the 203 dpi
 * thermal printer its text came out with deformed strokes. The helper,
 * native/receipt-printer/ReceiptPrinter.exe, prints with GDI, the Windows text
 * engine: sharp text, and the receipt reaches the printer in about a second
 * instead of more than one and a half.
 *
 * The helper is started once and kept waiting, so only the first receipt pays
 * for starting it. Jobs go as one JSON line on its stdin and each answer comes
 * back as one line on its stdout, matched by id.
 *
 * print() tells two failures apart:
 * - The printer failed: resolves with { success: false, error }. Printing again
 *   another way could give two receipts, so the caller only reports it.
 * - The helper could not be used (missing, would not start, died, did not
 *   answer): rejects with a ReceiptPrinterUnavailableError, and the caller
 *   falls back to printing through Chromium.
 */

const childProcess = require('child_process');
const fs = require('fs');

const DEFAULT_START_TIMEOUT_MS = 10 * 1000;
// A job answers once it is in the print queue; this only catches a helper
// that hangs, which would otherwise hold the receipt forever
const DEFAULT_JOB_TIMEOUT_MS = 30 * 1000;

const BACKSLASH = String.fromCharCode(92);

class ReceiptPrinterUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ReceiptPrinterUnavailableError';
  }
}

/**
 * JSON with every character outside printable ASCII escaped, so the job
 * reaches the helper intact whatever code page its console reads with
 * @param {Object} value
 * @returns {string}
 */
function asciiJson(value) {
  return JSON.stringify(value).replace(/[^ -~]/g, (char) =>
    `${BACKSLASH}u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

class ReceiptPrinter {
  /**
   * @param {Object} options
   * @param {string} options.exePath - ReceiptPrinter.exe
   * @param {Object} options.logger
   * @param {Function} [options.spawn] - child_process.spawn, replaced in tests
   * @param {string} [options.platform] - process.platform
   * @param {Function} [options.fileExists] - fs.existsSync
   * @param {number} [options.startTimeoutMs]
   * @param {number} [options.jobTimeoutMs]
   */
  constructor(options) {
    this.exePath = options.exePath;
    this.logger = options.logger;
    this.spawn = options.spawn || childProcess.spawn;
    this.platform = options.platform || process.platform;
    this.fileExists = options.fileExists || fs.existsSync;
    this.startTimeoutMs = options.startTimeoutMs ?? DEFAULT_START_TIMEOUT_MS;
    this.jobTimeoutMs = options.jobTimeoutMs ?? DEFAULT_JOB_TIMEOUT_MS;

    this.child = null;
    this.starting = null;
    this.pending = new Map();
    this.nextId = 1;
    this.buffer = '';
  }

  /**
   * Whether the helper can be used here: it only exists on Windows, and in
   * development only once scripts/build-receipt-printer.mjs has built it
   * @returns {boolean}
   */
  isAvailable() {
    return this.platform === 'win32' && Boolean(this.exePath) && this.fileExists(this.exePath);
  }

  /**
   * Start the helper ahead of the first receipt
   * @returns {Promise<void>}
   */
  warmUp() {
    if (!this.isAvailable()) return Promise.resolve();
    return this.start().catch((error) => {
      this.logger.warning(`[Receipt] Could not start the receipt printer helper: ${error.message}`);
    });
  }

  /**
   * Print a receipt
   * @param {Object} job - printer, logoPath, centerName, subtitle, userName,
   *   groupName, date, price, footerLines[]; or previewFile to draw a PNG
   * @returns {Promise<{success: boolean, error?: string}>}
   * @throws {ReceiptPrinterUnavailableError}
   */
  async print(job) {
    if (!this.isAvailable()) {
      throw new ReceiptPrinterUnavailableError('The receipt printer helper is not available');
    }
    await this.start();

    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new ReceiptPrinterUnavailableError(`The receipt printer helper did not answer in ${this.jobTimeoutMs} ms`));
        // It may be stuck; a fresh one is started for the next receipt
        this.stop();
      }, this.jobTimeoutMs);

      this.pending.set(id, {
        resolve: (answer) => {
          clearTimeout(timer);
          resolve(answer.success ? { success: true } : { success: false, error: answer.error || 'error desconocido' });
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        }
      });

      try {
        this.child.stdin.write(`${asciiJson({ ...job, id })}\n`);
      } catch (error) {
        this.fail(new ReceiptPrinterUnavailableError(`Could not send the receipt to the helper: ${error.message}`));
      }
    });
  }

  /**
   * Stop the helper (on quit). It also ends by itself when its stdin closes.
   */
  dispose() {
    this.stop();
  }

  /**
   * @private
   * @returns {Promise<void>} resolves once the helper says it is ready
   */
  start() {
    if (this.child && !this.starting) return Promise.resolve();
    if (this.starting) return this.starting;

    this.starting = new Promise((resolve, reject) => {
      let child;
      try {
        child = this.spawn(this.exePath, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (error) {
        this.starting = null;
        reject(new ReceiptPrinterUnavailableError(`Could not start the receipt printer helper: ${error.message}`));
        return;
      }

      this.child = child;
      this.buffer = '';
      const timer = setTimeout(() => {
        this.fail(new ReceiptPrinterUnavailableError(`The receipt printer helper did not start in ${this.startTimeoutMs} ms`));
      }, this.startTimeoutMs);

      this.onReady = () => {
        clearTimeout(timer);
        this.starting = null;
        this.onStartFailed = null;
        this.logger.info('[Receipt] Receipt printer helper ready');
        resolve();
      };
      this.onStartFailed = (error) => {
        clearTimeout(timer);
        this.starting = null;
        reject(error);
      };

      child.stdout.setEncoding?.('utf8');
      child.stdout.on('data', (data) => this.receive(data));
      child.stderr.on('data', (data) => this.logger.warning(`[Receipt] Helper: ${String(data).trim()}`));
      child.on('error', (error) => {
        this.fail(new ReceiptPrinterUnavailableError(`The receipt printer helper failed: ${error.message}`));
      });
      child.on('exit', (code) => {
        if (this.child === child) {
          this.fail(new ReceiptPrinterUnavailableError(`The receipt printer helper stopped (code ${code})`));
        }
      });
    });
    return this.starting;
  }

  /**
   * @private
   */
  receive(data) {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop();

    lines.map((line) => line.trim()).filter(Boolean).forEach((line) => {
      let answer;
      try {
        answer = JSON.parse(line);
      } catch (error) {
        this.logger.warning(`[Receipt] Unreadable answer from the helper: ${line}`);
        return;
      }
      if (answer.ready) {
        if (this.onReady) this.onReady();
        return;
      }
      const job = this.pending.get(answer.id);
      if (job) {
        this.pending.delete(answer.id);
        job.resolve(answer);
      }
    });
  }

  /**
   * The helper cannot be used any more: every waiting receipt is told, and
   * the next one starts a new helper
   * @private
   */
  fail(error) {
    if (this.onStartFailed) {
      this.onStartFailed(error);
      this.onStartFailed = null;
    }
    this.pending.forEach((job) => job.reject(error));
    this.pending.clear();
    this.stop();
  }

  /**
   * @private
   */
  stop() {
    const child = this.child;
    this.child = null;
    this.starting = null;
    this.onReady = null;
    if (child) {
      try {
        child.stdin.end();
        child.kill();
      } catch (error) {
        // Already gone
      }
    }
  }
}

module.exports = {
  ReceiptPrinter,
  ReceiptPrinterUnavailableError,
  asciiJson
};
