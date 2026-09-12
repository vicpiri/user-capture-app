const fs = require('fs');
const path = require('path');

class Logger {
  constructor(logPath) {
    this.logPath = logPath;
    this.logFile = null;
    this.stream = null;
  }

  initialize(projectPath) {
    // Opening another project must not keep writing to the previous log
    this.closeStream();

    if (!projectPath) {
      return;
    }

    this.logFile = path.join(projectPath, 'app.log');

    // A stream buffers writes instead of hitting the disk once per line, which
    // matters because logging happens inside per-image and per-user loops.
    // 'a' creates the file when it does not exist.
    this.stream = fs.createWriteStream(this.logFile, { flags: 'a' });
    this.stream.on('error', (error) => {
      console.error('Error writing to log file:', error.message);
      this.stream = null;
    });

    this.log('INFO', '========================================');
    this.log('INFO', 'Logger initialized');
    this.log('INFO', `Project path: ${projectPath}`);
    this.log('INFO', '========================================');
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

    // File output
    if (this.stream) {
      this.stream.write(logEntry);
    }
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
    const stream = this.stream;
    this.stream = null;
    this.logFile = null;

    if (!stream) {
      return Promise.resolve();
    }

    return new Promise((resolve) => stream.end(resolve));
  }

  close() {
    if (this.stream) {
      this.log('INFO', '========================================');
      this.log('INFO', 'Logger closed');
      this.log('INFO', '========================================\n');
    }

    return this.closeStream();
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
