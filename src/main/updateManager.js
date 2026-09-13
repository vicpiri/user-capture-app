/**
 * UpdateManager - checks GitHub Releases for a newer version of the app
 *
 * Wraps electron-updater's autoUpdater and is the only module that touches it.
 * Phase 1: it only finds out whether a newer release exists and tells the
 * renderer, which offers to open the release page. Nothing is downloaded.
 *
 * Every dependency is injected so the manager can be tested with a fake
 * autoUpdater and without Electron.
 */

const DEFAULT_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_STARTUP_DELAY_MS = 15 * 1000;
// A safety net, not the usual path: electron-updater has its own HTTP timeouts
// and normally answers long before this. It exists because a check that never
// answers would leave `checking` set and silently disable every later check.
const DEFAULT_CHECK_TIMEOUT_MS = 60 * 1000;
const MAX_ERROR_LENGTH = 300;

/**
 * electron-updater errors carry the whole HTTP response (headers, the
 * releases feed...). One line is all the user or the log can use.
 * @param {Error|string} error
 * @returns {string}
 */
function shortMessage(error) {
  const raw = (error && error.message) || String(error);
  const firstLine = raw.split(/\r?\n/)[0].trim();
  return firstLine.length > MAX_ERROR_LENGTH ? `${firstLine.slice(0, MAX_ERROR_LENGTH)}…` : firstLine;
}

class UpdateManager {
  /**
   * @param {Object} options
   * @param {Object} options.autoUpdater - electron-updater's autoUpdater (or a fake)
   * @param {boolean} options.isPackaged - app.isPackaged
   * @param {string} options.platform - process.platform
   * @param {Object} options.logger - application logger
   * @param {Function} options.loadPreferences - () => { autoCheck, lastCheck, skippedVersion }
   * @param {Function} options.savePreferences - (partial) => void
   * @param {Function} options.getMainWindow - () => BrowserWindow|null
   * @param {Function} options.openExternal - (url) => Promise
   * @param {string} options.releasesUrl - base URL of the GitHub releases page
   * @param {boolean} [options.forceDevConfig] - use dev-app-update.yml in development
   * @param {number} [options.checkIntervalMs] - minimum time between automatic checks
   * @param {number} [options.checkTimeoutMs] - how long to wait for an answer
   *   before giving the check up for lost
   */
  constructor(options) {
    this.autoUpdater = options.autoUpdater;
    this.isPackaged = options.isPackaged;
    this.platform = options.platform;
    this.logger = options.logger;
    this.loadPreferences = options.loadPreferences;
    this.savePreferences = options.savePreferences;
    this.getMainWindow = options.getMainWindow;
    this.openExternal = options.openExternal;
    this.releasesUrl = options.releasesUrl;
    this.forceDevConfig = options.forceDevConfig === true;
    this.checkIntervalMs = options.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS;
    this.checkTimeoutMs = options.checkTimeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS;

    this.checking = false;
    this.manual = false;
    this.pending = null;
    this.startupTimer = null;
    this.timeoutTimer = null;
    this.initialized = false;
  }

  /**
   * Whether updates can be checked at all in this process
   *
   * Only Windows installers are published, and electron-updater needs the
   * app-update.yml that only exists inside a packaged build.
   * @returns {boolean}
   */
  isSupported() {
    if (this.platform !== 'win32') return false;
    return this.isPackaged || this.forceDevConfig;
  }

  /**
   * Configure autoUpdater and subscribe to its events
   */
  init() {
    if (this.initialized || !this.isSupported()) return;

    const updater = this.autoUpdater;
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;
    updater.logger = {
      info: (message) => this.logger.info(`[Updates] ${shortMessage(message)}`),
      warn: (message) => this.logger.warning(`[Updates] ${shortMessage(message)}`),
      error: (message) => this.logger.error(`[Updates] ${shortMessage(message)}`),
      debug: () => {}
    };
    if (this.forceDevConfig) {
      updater.forceDevUpdateConfig = true;
    }

    updater.on('checking-for-update', () => {
      this._send({ status: 'checking', manual: this.manual });
    });

    updater.on('update-available', (info) => {
      const version = info.version;
      const preferences = this.loadPreferences();
      this.savePreferences({ lastCheck: new Date().toISOString() });
      this.logger.info(`[Updates] Version ${version} available`);

      if (!this.manual && preferences.skippedVersion === version) {
        this.logger.info(`[Updates] Version ${version} was skipped by the user`);
        this._resolve({ status: 'skipped-version', version });
        return;
      }

      const payload = {
        status: 'available',
        manual: this.manual,
        version,
        releaseDate: info.releaseDate || null,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '',
        releaseUrl: this.releaseUrlFor(version)
      };
      this._send(payload);
      this._resolve(payload);
    });

    updater.on('update-not-available', (info) => {
      this.savePreferences({ lastCheck: new Date().toISOString() });
      this.logger.info(`[Updates] No update available (latest is ${info?.version})`);
      const payload = { status: 'not-available', manual: this.manual, version: info?.version };
      if (this.manual) this._send(payload);
      this._resolve(payload);
    });

    updater.on('error', (error) => {
      const message = shortMessage(error);
      // An automatic check that fails must stay silent: school networks may
      // block GitHub, and that is not something to show at every startup
      if (this.manual) {
        this.logger.error(`[Updates] Check failed: ${message}`);
        this._send({ status: 'error', manual: true, message });
      } else {
        this.logger.warning(`[Updates] Automatic check failed: ${message}`);
      }
      this._resolve({ status: 'error', manual: this.manual, message });
    });

    this.initialized = true;
  }

  /**
   * Check whether a newer release exists
   *
   * @param {Object} [options]
   * @param {boolean} [options.manual] - started by the user, so every outcome is shown
   * @returns {Promise<Object>} outcome: { status, ... }
   */
  checkForUpdates({ manual = false } = {}) {
    if (!this.isSupported()) {
      return Promise.resolve({ status: 'unsupported', manual });
    }
    if (this.checking) {
      return Promise.resolve({ status: 'already-checking', manual });
    }

    this.init();
    this.checking = true;
    this.manual = manual;

    return new Promise((resolve) => {
      this.pending = resolve;
      this.timeoutTimer = setTimeout(() => this._giveUp(), this.checkTimeoutMs);

      Promise.resolve()
        .then(() => this.autoUpdater.checkForUpdates())
        .catch((error) => {
          // The 'error' event usually fires too, but not for every failure
          this._resolve({ status: 'error', manual, message: shortMessage(error) });
        });
    });
  }

  /**
   * Run the automatic startup check, if it is due
   *
   * @param {number} [delayMs] - wait so the check does not compete with the
   *   project opening and the repository sync
   * @returns {boolean} whether a check was scheduled
   */
  scheduleStartupCheck(delayMs = DEFAULT_STARTUP_DELAY_MS) {
    if (!this.isSupported()) return false;

    const preferences = this.loadPreferences();
    if (preferences.autoCheck === false) {
      this.logger.info('[Updates] Automatic check disabled in preferences');
      return false;
    }
    if (!this.isCheckDue(preferences.lastCheck)) {
      this.logger.info(`[Updates] Last check was at ${preferences.lastCheck}, not due yet`);
      return false;
    }

    this.startupTimer = setTimeout(() => {
      this.startupTimer = null;
      this.checkForUpdates({ manual: false });
    }, delayMs);
    return true;
  }

  /**
   * @param {string|null} lastCheck - ISO date of the last completed check
   * @returns {boolean}
   */
  isCheckDue(lastCheck) {
    if (!lastCheck) return true;
    const elapsed = Date.now() - new Date(lastCheck).getTime();
    return Number.isNaN(elapsed) || elapsed >= this.checkIntervalMs;
  }

  /**
   * Stop asking about a version until a different one comes out
   * @param {string} version
   */
  skipVersion(version) {
    this.savePreferences({ skippedVersion: version });
    this.logger.info(`[Updates] Version ${version} will not be offered again`);
  }

  /**
   * @param {string} version
   * @returns {string} URL of that version's GitHub release
   */
  releaseUrlFor(version) {
    return `${this.releasesUrl}/tag/v${version}`;
  }

  /**
   * Open a release page in the default browser
   * @param {string} version
   */
  openReleasePage(version) {
    return this.openExternal(this.releaseUrlFor(version));
  }

  /**
   * Cancel a pending startup check (on shutdown)
   */
  dispose() {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  /**
   * Abandon a check that never answered
   *
   * Without this the check would stay open for the rest of the session and
   * every later one, including the manual one from the menu, would bail out
   * with 'already-checking' and look like a menu entry that does nothing.
   * @private
   */
  _giveUp() {
    this.timeoutTimer = null;
    const message = 'La comprobación de actualizaciones ha tardado demasiado.';
    this.logger.warning(`[Updates] Check gave no answer in ${this.checkTimeoutMs} ms`);

    // Same rule as any other failure: an automatic check stays quiet
    if (this.manual) {
      this._send({ status: 'error', manual: true, message });
    }

    this._resolve({ status: 'error', manual: this.manual, message, timedOut: true });
  }

  /**
   * Push a status to the renderer
   * @private
   */
  _send(payload) {
    const window = this.getMainWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send('update-status', payload);
    }
  }

  /**
   * Finish the current check
   * @private
   */
  _resolve(outcome) {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }

    this.checking = false;
    const resolve = this.pending;
    this.pending = null;
    if (resolve) resolve(outcome);
  }
}

module.exports = UpdateManager;
module.exports.DEFAULT_CHECK_INTERVAL_MS = DEFAULT_CHECK_INTERVAL_MS;
module.exports.DEFAULT_STARTUP_DELAY_MS = DEFAULT_STARTUP_DELAY_MS;
module.exports.DEFAULT_CHECK_TIMEOUT_MS = DEFAULT_CHECK_TIMEOUT_MS;
module.exports.shortMessage = shortMessage;
