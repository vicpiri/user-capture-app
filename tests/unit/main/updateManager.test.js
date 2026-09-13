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

    test('refuses to overlap two checks', async () => {
      const first = manager.checkForUpdates({ manual: true });
      await expect(manager.checkForUpdates({ manual: true })).resolves.toEqual({ status: 'already-checking', manual: true });
      autoUpdater.emit('update-not-available', { version: '1.7.0' });
      await first;
      expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
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
});
