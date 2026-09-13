/**
 * Update IPC handlers tests
 *
 * @jest-environment node
 */

const mockHandlers = new Map();
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn((channel, handler) => mockHandlers.set(channel, handler))
  }
}));

const { registerUpdateHandlers } = require('../../../src/main/ipc/updateHandlers');

describe('update handlers', () => {
  let updateManager;
  let logger;

  const call = (channel, ...args) => mockHandlers.get(channel)({}, ...args);

  beforeEach(() => {
    mockHandlers.clear();
    updateManager = {
      checkForUpdates: jest.fn(async () => ({ status: 'available', manual: true, version: '1.8.0' })),
      skipVersion: jest.fn(),
      openReleasePage: jest.fn(async () => {})
    };
    logger = { info: jest.fn(), error: jest.fn() };
    registerUpdateHandlers({ updateManager: () => updateManager, logger });
  });

  test('registers the three channels', () => {
    expect([...mockHandlers.keys()].sort()).toEqual(['check-for-updates', 'open-release-page', 'skip-update-version']);
  });

  test('check-for-updates runs a manual check and returns its outcome', async () => {
    await expect(call('check-for-updates')).resolves.toMatchObject({ status: 'available', version: '1.8.0' });
    expect(updateManager.checkForUpdates).toHaveBeenCalledWith({ manual: true });
  });

  test('check-for-updates reports unsupported when there is no manager', async () => {
    mockHandlers.clear();
    registerUpdateHandlers({ updateManager: () => null, logger });
    await expect(call('check-for-updates')).resolves.toEqual({ status: 'unsupported', manual: true });
  });

  test('check-for-updates turns an exception into an error outcome', async () => {
    updateManager.checkForUpdates.mockRejectedValue(new Error('boom'));
    await expect(call('check-for-updates')).resolves.toEqual({ status: 'error', manual: true, message: 'boom' });
    expect(logger.error).toHaveBeenCalled();
  });

  test('skip-update-version forwards the version', async () => {
    await expect(call('skip-update-version', '1.8.0')).resolves.toEqual({ success: true });
    expect(updateManager.skipVersion).toHaveBeenCalledWith('1.8.0');
  });

  test('open-release-page forwards the version', async () => {
    await expect(call('open-release-page', '1.8.0')).resolves.toEqual({ success: true });
    expect(updateManager.openReleasePage).toHaveBeenCalledWith('1.8.0');
  });

  test('open-release-page reports failures', async () => {
    updateManager.openReleasePage.mockRejectedValue(new Error('no browser'));
    await expect(call('open-release-page', '1.8.0')).resolves.toEqual({ success: false, error: 'no browser' });
  });
});
