/**
 * Whether exporting to the repository files card and publication requests
 *
 * Kept per project in project_settings. Projects from before it existed have
 * no key and must open with both off, as must a value nobody can read.
 *
 * @jest-environment node
 */

const mockHandlers = new Map();
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn((channel, handler) => mockHandlers.set(channel, handler))
  }
}));

const {
  registerExportHandlers,
  parseRepositoryExportRequests
} = require('../../../src/main/ipc/exportHandlers');

const logger = {
  info: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  section: jest.fn()
};

function fakeDatabase(initial = {}) {
  const settings = new Map(Object.entries(initial));
  return {
    settings,
    getProjectSetting: jest.fn(async key => (settings.has(key) ? settings.get(key) : null)),
    setProjectSetting: jest.fn(async (key, value) => { settings.set(key, value); })
  };
}

describe('repository export requests setting', () => {
  let state;

  const get = () => mockHandlers.get('get-repository-export-requests')({});
  const set = requests => mockHandlers.get('set-repository-export-requests')({}, requests);

  beforeAll(() => {
    state = { dbManager: null, projectPath: null };
    registerExportHandlers({
      mainWindow: () => null,
      logger,
      state,
      repositoryMirror: () => null
    });
  });

  beforeEach(() => {
    jest.useRealTimers();
    state.dbManager = fakeDatabase();
  });

  test('should start with both off in a project that never set it', async () => {
    await expect(get()).resolves.toEqual({
      success: true,
      requests: { cards: false, publications: false }
    });
  });

  test('should give back what was saved', async () => {
    await set({ cards: true, publications: false });

    await expect(get()).resolves.toEqual({
      success: true,
      requests: { cards: true, publications: false }
    });
    expect(state.dbManager.settings.get('repositoryExportRequests'))
      .toBe('{"cards":true,"publications":false}');
  });

  test('should save only true as on', async () => {
    await set({ cards: 'yes', publications: 1, extra: true });

    expect(JSON.parse(state.dbManager.settings.get('repositoryExportRequests')))
      .toEqual({ cards: false, publications: false });
  });

  test('should refuse without an open project', async () => {
    state.dbManager = null;

    await expect(get()).resolves.toEqual(expect.objectContaining({ success: false }));
    await expect(set({ cards: true })).resolves.toEqual(expect.objectContaining({ success: false }));
  });

  test.each([
    [null],
    [''],
    ['not json'],
    ['null'],
    ['[]'],
    ['{"cards":"true"}']
  ])('should read %p as both off', value => {
    expect(parseRepositoryExportRequests(value)).toEqual({ cards: false, publications: false });
  });
});
