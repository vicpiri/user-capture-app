/**
 * UpdateManager tests
 *
 * The manager decides what the user gets to see: an automatic check must stay
 * silent unless there is something new, a manual one must always answer, and a
 * skipped version must not come back. All of that is driven by events from
 * electron-updater, which is replaced here by a plain EventEmitter.
 *
 * @jest-environment node
 */

const { EventEmitter } = require('events');
const UpdateManager = require('../../../src/main/updateManager');

describe('UpdateManager', () => {
  let autoUpdater;
  let logger;
  let preferences;
  let webContents;
  let openExternal;
  let manager;

  const createManager = (overrides = {}) => new UpdateManager({
    autoUpdater,
    isPackaged: true,
    platform: 'win32',
    logger,
    loadPreferences: () => ({ ...preferences }),
    savePreferences: (partial) => { Object.assign(preferences, partial); },
    getMainWindow: () => ({ isDestroyed: () => false, webContents }),
    openExternal,
    releasesUrl: 'https://github.com/vicpiri/user-capture-app/releases',
    ...overrides
  });

  const sentStatuses = () => webContents.send.mock.calls.map(([channel, payload]) => ({ channel, ...payload }));

  beforeEach(() => {
    jest.useRealTimers();
    autoUpdater = new EventEmitter();
    autoUpdater.checkForUpdates = jest.fn(() => Promise.resolve());
    autoUpdater.downloadUpdate = jest.fn(() => new Promise(() => {}));
    autoUpdater.quitAndInstall = jest.fn();
    logger = { info: jest.fn(), warning: jest.fn(), error: jest.fn() };
    preferences = { autoCheck: true, lastCheck: null, skippedVersion: null };
    webContents = { send: jest.fn() };
    openExternal = jest.fn(() => Promise.resolve());
    manager = createManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('support', () => {
    test('is unsupported outside Windows', async () => {
      manager = createManager({ platform: 'darwin' });
      expect(manager.isSupported()).toBe(false);
      await expect(manager.checkForUpdates({ manual: true })).resolves.toEqual({ status: 'unsupported', manual: true });
      expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    });

    test('is unsupported in an unpackaged build unless the dev config is forced', () => {
      expect(createManager({ isPackaged: false }).isSupported()).toBe(false);
      expect(createManager({ isPackaged: false, forceDevConfig: true }).isSupported()).toBe(true);
    });

    test('configures electron-updater to never download or install on its own', () => {
      manager.init();
      expect(autoUpdater.autoDownload).toBe(false);
      expect(autoUpdater.autoInstallOnAppQuit).toBe(false);
      expect(autoUpdater.allowPrerelease).toBe(false);
      expect(autoUpdater.disableWebInstaller).toBe(true);
    });

    test('adapts the application logger to electron-updater (warn -> warning)', () => {
      manager.init();
      autoUpdater.logger.warn('slow network');
      expect(logger.warning).toHaveBeenCalledWith('[Updates] slow network');
    });
  });

  describe('automatic check', () => {
    test('reports an available version to the renderer and records the check', async () => {
      const check = manager.checkForUpdates({ manual: false });
      autoUpdater.emit('checking-for-update');
      autoUpdater.emit('update-available', { version: '1.8.0', releaseDate: '2026-10-01', releaseNotes: '### Features\n* x' });

      await expect(check).resolves.toMatchObject({ status: 'available', version: '1.8.0' });
      const available = sentStatuses().find(s => s.status === 'available');
      expect(available).toMatchObject({
        manual: false,
        version: '1.8.0',
        releaseNotes: '### Features\n* x',
        releaseUrl: 'https://github.com/vicpiri/user-capture-app/releases/tag/v1.8.0'
      });
      expect(preferences.lastCheck).toEqual(expect.any(String));
    });

    test('stays silent when there is nothing new', async () => {
      const check = manager.checkForUpdates({ manual: false });
      autoUpdater.emit('update-not-available', { version: '1.7.0' });

      await expect(check).resolves.toMatchObject({ status: 'not-available' });
      expect(sentStatuses().map(s => s.status)).not.toContain('not-available');
      expect(preferences.lastCheck).toEqual(expect.any(String));
    });

    test('stays silent and only logs a warning when the check fails', async () => {
      const check = manager.checkForUpdates({ manual: false });
      autoUpdater.emit('error', new Error('net::ERR_NAME_NOT_RESOLVED'));

      await expect(check).resolves.toMatchObject({ status: 'error', message: 'net::ERR_NAME_NOT_RESOLVED' });
      expect(sentStatuses().map(s => s.status)).not.toContain('error');
      expect(logger.warning).toHaveBeenCalledWith(expect.stringContaining('ERR_NAME_NOT_RESOLVED'));
      expect(logger.error).not.toHaveBeenCalled();
      expect(preferences.lastCheck).toBeNull();
    });

    test('does not offer a version the user skipped', async () => {
      preferences.skippedVersion = '1.8.0';
      const check = manager.checkForUpdates({ manual: false });
      autoUpdater.emit('update-available', { version: '1.8.0' });

      await expect(check).resolves.toEqual({ status: 'skipped-version', version: '1.8.0' });
      expect(sentStatuses().map(s => s.status)).not.toContain('available');
    });

    test('offers a newer version even if an older one was skipped', async () => {
      preferences.skippedVersion = '1.8.0';
      const check = manager.checkForUpdates({ manual: false });
      autoUpdater.emit('update-available', { version: '1.8.1' });

      await expect(check).resolves.toMatchObject({ status: 'available', version: '1.8.1' });
    });
  });

  describe('manual check', () => {
    test('reports every outcome, including nothing new', async () => {
      const check = manager.checkForUpdates({ manual: true });
      autoUpdater.emit('update-not-available', { version: '1.7.0' });

      await check;
      expect(sentStatuses().find(s => s.status === 'not-available')).toMatchObject({ manual: true });
    });

    test('reports errors with their message', async () => {
      const check = manager.checkForUpdates({ manual: true });
      autoUpdater.emit('error', new Error('HTTP 403'));

      await check;
      expect(sentStatuses().find(s => s.status === 'error')).toMatchObject({ manual: true, message: 'HTTP 403' });
      expect(logger.error).toHaveBeenCalled();
    });

    test('keeps only the first line of electron-updater errors, which carry whole HTTP responses', async () => {
      const check = manager.checkForUpdates({ manual: true });
      const error = new Error('Cannot parse releases feed: HttpError: 406\n"method: GET url: ..."\nHeaders: {\n  "cache-control": "no-cache"\n}\n<feed>...</feed>');
      autoUpdater.emit('error', error);

      await expect(check).resolves.toMatchObject({ message: 'Cannot parse releases feed: HttpError: 406' });
      expect(sentStatuses().find(s => s.status === 'error').message).toBe('Cannot parse releases feed: HttpError: 406');
      expect(logger.error).toHaveBeenCalledWith('[Updates] Check failed: Cannot parse releases feed: HttpError: 406');
    });

    test('caps very long single-line errors', () => {
      const { shortMessage } = require('../../../src/main/updateManager');
      expect(shortMessage(new Error('x'.repeat(500)))).toHaveLength(301);
      expect(shortMessage('plain string')).toBe('plain string');
    });

    test('ignores the skipped version', async () => {
      preferences.skippedVersion = '1.8.0';
      const check = manager.checkForUpdates({ manual: true });
      autoUpdater.emit('update-available', { version: '1.8.0' });

      await expect(check).resolves.toMatchObject({ status: 'available', version: '1.8.0' });
    });

    test('resolves with an error when checkForUpdates rejects without emitting', async () => {
      autoUpdater.checkForUpdates = jest.fn(() => Promise.reject(new Error('no app-update.yml')));
      await expect(manager.checkForUpdates({ manual: true })).resolves.toMatchObject({ status: 'error', message: 'no app-update.yml' });
      expect(manager.checking).toBe(false);
    });

    test('answers a check asked for while another runs with the same outcome, without a second request', async () => {
      const first = manager.checkForUpdates({ manual: true });
      const second = manager.checkForUpdates({ manual: true });

      autoUpdater.emit('update-not-available', { version: '1.7.0' });

      await expect(first).resolves.toMatchObject({ status: 'not-available' });
      await expect(second).resolves.toMatchObject({ status: 'not-available' });
      expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
    });

    test('shows the outcome of the automatic check a manual one joined', async () => {
      // The update window opened by the manual check used to stay on
      // "Buscando actualizaciones": the automatic check reports nothing
      const automatic = manager.checkForUpdates({ manual: false });
      const manual = manager.checkForUpdates({ manual: true });

      autoUpdater.emit('update-not-available', { version: '1.7.0' });
      await Promise.all([automatic, manual]);

      expect(sentStatuses()).toContainEqual(expect.objectContaining({ status: 'not-available', manual: true }));
    });

    test('reports the error of the joined check to the user', async () => {
      const automatic = manager.checkForUpdates({ manual: false });
      const manual = manager.checkForUpdates({ manual: true });

      autoUpdater.emit('error', new Error('net::ERR_CONNECTION_REFUSED'));
      await Promise.all([automatic, manual]);

      expect(sentStatuses()).toContainEqual(expect.objectContaining({ status: 'error', manual: true }));
    });
  });

  describe('startup schedule', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    test('checks after the delay when no check was ever made', async () => {
      expect(manager.scheduleStartupCheck(1000)).toBe(true);
      expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1000);
      // the call itself is queued as a microtask
      await Promise.resolve();
      expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
      expect(manager.manual).toBe(false);
    });

    test('skips the check when the last one is recent', () => {
      preferences.lastCheck = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      expect(manager.scheduleStartupCheck(0)).toBe(false);
    });

    test('checks again once the interval has passed', () => {
      preferences.lastCheck = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      expect(manager.scheduleStartupCheck(0)).toBe(true);
    });

    test('honours the autoCheck preference', () => {
      preferences.autoCheck = false;
      expect(manager.scheduleStartupCheck(0)).toBe(false);
    });

    test('treats an unreadable lastCheck as due', () => {
      expect(manager.isCheckDue('not a date')).toBe(true);
    });

    test('dispose cancels a pending startup check', () => {
      manager.scheduleStartupCheck(1000);
      manager.dispose();
      jest.advanceTimersByTime(5000);
      expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    });
  });

  describe('actions', () => {
    test('skipVersion persists the version', () => {
      manager.skipVersion('1.8.0');
      expect(preferences.skippedVersion).toBe('1.8.0');
    });

    test('openReleasePage opens the tag page of that version', async () => {
      await manager.openReleasePage('1.8.0');
      expect(openExternal).toHaveBeenCalledWith('https://github.com/vicpiri/user-capture-app/releases/tag/v1.8.0');
    });

    test('does not send to a destroyed window', async () => {
      manager = createManager({ getMainWindow: () => ({ isDestroyed: () => true, webContents }) });
      const check = manager.checkForUpdates({ manual: true });
      autoUpdater.emit('update-not-available', { version: '1.7.0' });
      await check;
      expect(webContents.send).not.toHaveBeenCalled();
    });
  });

  /**
   * electron-updater answers through events, and a check that never gets one
   * used to leave `checking` set for the rest of the session: every later
   * check, including the manual one from the menu, bailed out with
   * 'already-checking' and the menu entry looked dead.
   */
  describe('download', () => {
    // A check that found 1.8.0, which is what electron-updater downloads
    const findUpdate = async () => {
      const check = manager.checkForUpdates({ manual: true });
      autoUpdater.emit('update-available', { version: '1.8.0' });
      await check;
      webContents.send.mockClear();
    };

    // Resolves the way electron-updater does: the event first, then the promise
    const finishingDownload = () => {
      autoUpdater.downloadUpdate.mockImplementation(async () => {
        autoUpdater.emit('update-downloaded', { version: '1.8.0' });
        return ['C:/cache/installer.exe'];
      });
    };

    const failingDownload = (message) => {
      autoUpdater.downloadUpdate.mockImplementation(async () => {
        const error = new Error(message);
        autoUpdater.emit('error', error);
        throw error;
      });
    };

    test('downloads only when asked', async () => {
      await findUpdate();
      expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
      expect(autoUpdater.autoDownload).toBe(false);
    });

    test('refuses when no check has found a version', async () => {
      manager.init();
      await expect(manager.downloadUpdate()).resolves.toMatchObject({ status: 'download-error', version: null });
      expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
    });

    test('refuses after a check that found nothing new', async () => {
      await findUpdate();
      const check = manager.checkForUpdates({ manual: true });
      autoUpdater.emit('update-not-available', { version: '1.7.0' });
      await check;

      await expect(manager.downloadUpdate()).resolves.toMatchObject({ status: 'download-error' });
    });

    test('reports the start at 0 % and then each progress event', async () => {
      await findUpdate();
      manager.downloadUpdate();
      await Promise.resolve();

      autoUpdater.emit('download-progress', { percent: 42.5, transferred: 42, total: 100, bytesPerSecond: 7 });

      expect(sentStatuses()).toEqual([
        { channel: 'update-status', status: 'downloading', version: '1.8.0', percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 },
        { channel: 'update-status', status: 'downloading', version: '1.8.0', percent: 42.5, transferred: 42, total: 100, bytesPerSecond: 7 }
      ]);
    });

    test('reports the finished download once and resolves with it', async () => {
      await findUpdate();
      finishingDownload();

      await expect(manager.downloadUpdate()).resolves.toEqual({ status: 'downloaded', version: '1.8.0' });

      expect(sentStatuses().filter(s => s.status === 'downloaded')).toEqual([
        { channel: 'update-status', status: 'downloaded', version: '1.8.0' }
      ]);
      expect(manager.downloadedVersion).toBe('1.8.0');
    });

    test('arms installing on quit before the download finishes, as electron-updater needs', async () => {
      await findUpdate();
      let armedWhenDone = null;
      autoUpdater.downloadUpdate.mockImplementation(async () => {
        armedWhenDone = autoUpdater.autoInstallOnAppQuit;
        autoUpdater.emit('update-downloaded', { version: '1.8.0' });
      });

      await manager.downloadUpdate();

      expect(armedWhenDone).toBe(true);
      expect(autoUpdater.autoInstallOnAppQuit).toBe(true);
    });

    test('reports a failed download once, not as a failed check', async () => {
      await findUpdate();
      failingDownload('net::ERR_CONNECTION_RESET\nHTTP headers...');

      await expect(manager.downloadUpdate()).resolves.toEqual({
        status: 'download-error', version: '1.8.0', message: 'net::ERR_CONNECTION_RESET'
      });

      expect(sentStatuses().filter(s => s.status === 'download-error')).toHaveLength(1);
      expect(sentStatuses().filter(s => s.status === 'error')).toHaveLength(0);
      expect(autoUpdater.autoInstallOnAppQuit).toBe(false);
    });

    test('lets the user try the download again after a failure', async () => {
      await findUpdate();
      failingDownload('offline');
      await manager.downloadUpdate();

      finishingDownload();
      await expect(manager.downloadUpdate()).resolves.toMatchObject({ status: 'downloaded' });
      expect(autoUpdater.downloadUpdate).toHaveBeenCalledTimes(2);
    });

    test('does not start a second download while one runs', async () => {
      await findUpdate();
      manager.downloadUpdate();

      await expect(manager.downloadUpdate()).resolves.toMatchObject({ status: 'downloading' });
      expect(autoUpdater.downloadUpdate).toHaveBeenCalledTimes(1);
    });

    test('a manual check during the download shows its progress instead of checking', async () => {
      await findUpdate();
      autoUpdater.checkForUpdates.mockClear();
      manager.downloadUpdate();
      autoUpdater.emit('download-progress', { percent: 30, transferred: 3, total: 10, bytesPerSecond: 1 });
      webContents.send.mockClear();

      const outcome = await manager.checkForUpdates({ manual: true });

      expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
      expect(outcome).toMatchObject({ status: 'downloading', percent: 30 });
      expect(sentStatuses()).toEqual([expect.objectContaining({ status: 'downloading', percent: 30 })]);
    });

    test('a manual check after the download offers to install it again', async () => {
      await findUpdate();
      finishingDownload();
      await manager.downloadUpdate();
      webContents.send.mockClear();

      await expect(manager.checkForUpdates({ manual: true })).resolves.toMatchObject({ status: 'downloaded', version: '1.8.0' });
      expect(sentStatuses()).toEqual([{ channel: 'update-status', status: 'downloaded', version: '1.8.0' }]);
    });

    test('ignores progress when no download was asked for', () => {
      manager.init();
      autoUpdater.emit('download-progress', { percent: 50 });
      expect(webContents.send).not.toHaveBeenCalled();
    });
  });

  describe('install', () => {
    const download = async () => {
      const check = manager.checkForUpdates({ manual: true });
      autoUpdater.emit('update-available', { version: '1.8.0' });
      await check;
      autoUpdater.downloadUpdate.mockImplementation(async () => {
        autoUpdater.emit('update-downloaded', { version: '1.8.0' });
      });
      await manager.downloadUpdate();
      webContents.send.mockClear();
    };

    test('runs the installer silently and starts the app again', async () => {
      await download();

      expect(manager.installUpdate()).toEqual({ success: true });

      expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(true, true);
    });

    test('refuses with nothing downloaded', () => {
      manager.init();
      expect(manager.installUpdate()).toMatchObject({ success: false });
      expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
    });

    test('reports an installer that cannot start', async () => {
      await download();
      autoUpdater.quitAndInstall.mockImplementation(() => {
        autoUpdater.emit('error', new Error("No update filepath provided, can't quit and install"));
      });

      const result = manager.installUpdate();

      expect(result).toEqual({ success: false, error: "No update filepath provided, can't quit and install" });
      expect(sentStatuses()).toEqual([expect.objectContaining({ status: 'install-error', version: '1.8.0' })]);
    });

    test('cancels a pending startup check, the app is about to quit', async () => {
      await download();
      manager.startupTimer = setTimeout(() => {}, 100000);

      manager.installUpdate();

      expect(manager.startupTimer).toBeNull();
    });
  });

  describe('a check that never answers', () => {
    // Short enough to wait for it in a real-timer test
    const withTimeout = (overrides = {}) => createManager({ checkTimeoutMs: 40, ...overrides });

    test('gives up instead of waiting forever', async () => {
      manager = withTimeout();

      const outcome = await manager.checkForUpdates({ manual: true });

      expect(outcome).toMatchObject({ status: 'error', manual: true, timedOut: true });
    });

    test('lets the next check run', async () => {
      manager = withTimeout();
      await manager.checkForUpdates({ manual: true });

      const second = manager.checkForUpdates({ manual: true });
      autoUpdater.emit('update-not-available', { version: '1.7.1' });

      await expect(second).resolves.toMatchObject({ status: 'not-available' });
      expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);
    });

    test('tells the user when they asked for the check', async () => {
      manager = withTimeout();

      await manager.checkForUpdates({ manual: true });

      expect(sentStatuses().filter(s => s.status === 'error')).toHaveLength(1);
    });

    test('stays quiet when the check was automatic', async () => {
      manager = withTimeout();

      await manager.checkForUpdates({ manual: false });

      expect(sentStatuses().filter(s => s.status === 'error')).toHaveLength(0);
      expect(logger.warning).toHaveBeenCalledWith(expect.stringContaining('gave no answer'));
    });

    test('does not fire after an answer arrived in time', async () => {
      manager = withTimeout();
      const check = manager.checkForUpdates({ manual: true });
      autoUpdater.emit('update-not-available', { version: '1.7.1' });
      await check;

      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(sentStatuses().filter(s => s.status === 'error')).toHaveLength(0);
      expect(manager.timeoutTimer).toBeNull();
    });

    test('dispose cancels a check still in flight', async () => {
      manager = withTimeout();
      manager.checkForUpdates({ manual: true });

      manager.dispose();
      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(sentStatuses().filter(s => s.status === 'error')).toHaveLength(0);
    });
  });
});
