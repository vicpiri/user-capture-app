const fs = require('fs');
const path = require('path');

class Logger {
  constructor(logPath) {
    this.logPath = logPath;
    this.logFile = null;
  }

  initialize(projectPath) {
    if (projectPath) {
      this.logFile = path.join(projectPath, 'app.log');

      // Create log file if it doesn't exist
      if (!fs.existsSync(this.logFile)) {
        fs.writeFileSync(this.logFile, '');
      }

      this.log('INFO', '========================================');
      this.log('INFO', 'Logger initialized');
      this.log('INFO', `Project path: ${projectPath}`);
      this.log('INFO', '========================================');
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

    // File output
    if (this.logFile) {
      try {
        fs.appendFileSync(this.logFile, logEntry);
      } catch (error) {
        console.error('Error writing to log file:', error);
      }
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

  close() {
    if (this.logFile) {
      this.log('INFO', '========================================');
      this.log('INFO', 'Logger closed');
      this.log('INFO', '========================================\n');
    }
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
