const fs = require('fs');
const path = require('path');

// Every opening of a project added to the same app.log and nothing ever cut
// it: a project in use went past 8 MB. The log is cut when it reaches this
// size, keeping the previous ones as app.1.log and app.2.log.
const DEFAULT_MAX_SIZE = 5 * 1024 * 1024;
const DEFAULT_KEPT_FILES = 2;

class Logger {
  /**
   * @param {Object} [options]
   * @param {number} [options.maxSize] - Bytes a log file may reach
   * @param {number} [options.keptFiles] - How many older logs to keep
   */
  constructor(options = {}) {
    this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
    this.keptFiles = options.keptFiles ?? DEFAULT_KEPT_FILES;

    this.logFile = null;
    this.stream = null;
    // What the file in use holds, to know when to cut it
    this.written = 0;
    // Entries arriving while the file is being swapped
    this.rotating = false;
    this.waiting = [];
    // Tells a swap in flight that the log it belongs to was left behind
    this.generation = 0;

    // Flush of the previous project's log, still in progress
    this.pendingFlush = Promise.resolve();
  }

  initialize(projectPath) {
    // Opening another project must not keep writing to the previous log.
    // Closing flushes asynchronously, so the promise is kept: anything that
    // needs the previous entries to be on disk can wait for it.
    this.pendingFlush = this.closeStream();

    if (!projectPath) {
      return;
    }

    this.logFile = path.join(projectPath, 'app.log');
    this.rotating = false;
    this.waiting = [];

    // A log that is already full is cut before adding this session to it
    if (this.sizeOf(this.logFile) >= this.maxSize) {
      this.rotateFiles();
    }

    this.open();

    this.log('INFO', '========================================');
    this.log('INFO', 'Logger initialized');
    this.log('INFO', `Project path: ${projectPath}`);
    this.log('INFO', '========================================');
  }

  /**
   * Open the log file to add to it
   * @private
   */
  open() {
    this.written = this.sizeOf(this.logFile);

    // A stream buffers writes instead of hitting the disk once per line, which
    // matters because logging happens inside per-image and per-user loops.
    // 'a' creates the file when it does not exist.
    this.stream = fs.createWriteStream(this.logFile, { flags: 'a' });
    this.stream.on('error', (error) => {
      console.error('Error writing to log file:', error.message);
      this.stream = null;
    });
  }

  /**
   * @private
   * @returns {number} bytes, 0 when there is no file
   */
  sizeOf(filePath) {
    try {
      return filePath ? fs.statSync(filePath).size : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Move the logs along: app.1.log becomes app.2.log, the log in use becomes
   * app.1.log, and the oldest one is dropped. The stream must be closed.
   * @private
   */
  rotateFiles(logFile = this.logFile) {
    const older = (index) => logFile.replace(/\.log$/, `.${index}.log`);
    try {
      fs.rmSync(older(this.keptFiles), { force: true });
      for (let index = this.keptFiles - 1; index >= 1; index--) {
        if (fs.existsSync(older(index))) {
          fs.renameSync(older(index), older(index + 1));
        }
      }
      if (fs.existsSync(logFile)) {
        fs.renameSync(logFile, older(1));
      }
    } catch (error) {
      // Another window of the app may hold one of them: the log goes on
      // growing, which is better than losing what it says
      console.error('Could not rotate the log file:', error.message);
    }
  }

  /**
   * Cut the log without losing what is written while it is swapped
   * @private
   */
  rotate() {
    const stream = this.stream;
    const logFile = this.logFile;
    const generation = this.generation;
    // Its own queue, so a later swap of another log does not take these
    const queue = [];
    this.rotating = true;
    this.stream = null;
    this.waiting = queue;

    this.pendingFlush = new Promise((resolve) => stream.end(resolve)).then(() => {
      if (this.waiting === queue) {
        this.waiting = [];
      }

      // The project may have been closed, or another one opened, while the
      // file was being swapped: reopening it would write to the wrong log, so
      // what was waiting goes at the end of the log it belonged to
      if (generation !== this.generation) {
        this.writeWithoutStream(logFile, queue);
        this.rotateFiles(logFile);
        return;
      }

      this.rotateFiles(logFile);
      this.open();
      this.rotating = false;
      queue.forEach((entry) => this.write(entry));
    });
  }

  /**
   * Last entries of a log that is being left behind
   * @private
   */
  writeWithoutStream(logFile, entries) {
    if (entries.length === 0) {
      return;
    }
    try {
      fs.appendFileSync(logFile, entries.join(''));
    } catch (error) {
      console.error('Error writing to log file:', error.message);
    }
  }

  /**
   * @private
   */
  write(entry) {
    if (this.rotating) {
      this.waiting.push(entry);
      return;
    }
    if (!this.stream) {
      return;
    }

    this.stream.write(entry);
    this.written += Buffer.byteLength(entry);
    if (this.written >= this.maxSize) {
      this.rotate();
    }
  }

  log(level, message, details = null) {
    const timestamp = new Date().toISOString();
    let logEntry = `[${timestamp}] [${level}] ${message}`;

    if (details) {
      if (typeof details === 'object') {
        logEntry += '\n' + JSON.stringify(details, null, 2);
      } else {
        logEntry += '\n' + details;
      }
    }

    logEntry += '\n';

    // Console output
    console.log(logEntry);

    // File output, cut when it grows past its size
    this.write(logEntry);
  }

  info(message, details = null) {
    this.log('INFO', message, details);
  }

  success(message, details = null) {
    this.log('SUCCESS', message, details);
  }

  warning(message, details = null) {
    this.log('WARNING', message, details);
  }

  error(message, error = null) {
    let details = null;

    if (error) {
      details = {
        message: error.message || error,
        stack: error.stack || null
      };
    }

    this.log('ERROR', message, details);
  }

  section(title) {
    this.log('INFO', `\n>>> ${title} <<<`);
  }

  /**
   * Flush and release the log file
   * @returns {Promise<void>} Resolves once buffered entries reach disk
   */
  closeStream() {
    // A swap in flight must not reopen the log that is being left behind.
    // Its queue is left alone: it holds entries of that log, and the swap
    // writes them to it before putting it aside.
    this.generation++;
    this.rotating = false;

    const stream = this.stream;
    this.stream = null;
    this.logFile = null;
    this.written = 0;

    if (!stream) {
      return Promise.resolve();
    }

    return new Promise((resolve) => stream.end(resolve));
  }

  async close() {
    if (this.stream) {
      this.log('INFO', '========================================');
      this.log('INFO', 'Logger closed');
      this.log('INFO', '========================================\n');
    }

    await this.closeStream();

    // A previous project's log may still be flushing
    await this.pendingFlush;
  }
}

// Singleton instance
let loggerInstance = null;

function getLogger() {
  if (!loggerInstance) {
    loggerInstance = new Logger();
  }
  return loggerInstance;
}

module.exports = { Logger, getLogger };
