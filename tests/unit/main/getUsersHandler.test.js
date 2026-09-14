/**
 * get-users handler tests
 *
 * The path of each user's captured photo used to be cleared whenever the Ver
 * menu hid captured photos. Exports, unlinking and duplicate detection read
 * that path too, so with the thumbnails hidden they all believed nobody had a
 * photo. The path must now come back whatever the caller asks for.
 *
 * @jest-environment node
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const DatabaseManager = require('../../../src/main/database');

const mockHandlers = new Map();
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn((channel, handler) => mockHandlers.set(channel, handler))
  }
}));

const { registerUserGroupImageHandlers } = require('../../../src/main/ipc/userGroupImageHandlers');

const logger = {
  info: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  section: jest.fn()
};

describe('get-users handler', () => {
  const fixturesPath = path.join(os.tmpdir(), 'edu-capture-get-users-tests');
  let testId = 0;
  let projectPath;
  let db;
  let state;

  const getUsers = (filters = {}, options) => mockHandlers.get('get-users')({}, filters, options);
  const byNia = (users, nia) => users.find(user => user.nia === nia);

  beforeAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    fs.mkdirSync(fixturesPath, { recursive: true });

    state = { dbManager: null, projectPath: null };

    registerUserGroupImageHandlers({
      mainWindow: () => null,
      logger,
      state,
      repositoryCacheManager: {
        loadRepositoryFileList: async () => new Set(),
        findRepositoryFile: () => null
      },
      repositoryMirror: () => null
    });
  });

  afterAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  beforeEach(async () => {
    jest.useRealTimers();
    jest.clearAllMocks();

    testId++;
    projectPath = path.join(fixturesPath, `project-${testId}`);
    fs.mkdirSync(path.join(projectPath, 'imports'), { recursive: true });

    db = new DatabaseManager(path.join(projectPath, 'users.db'));
    await db.initialize();

    state.dbManager = db;
    state.projectPath = projectPath;

    await db.importUsers({
      groups: [{ code: '1ESOA', name: 'Primero ESO A' }],
      students: [
        { first_name: 'ANA', last_name1: 'GARCIA', last_name2: '', nia: '1001', group_code: '1ESOA', document: '', birth_date: '2008-01-01' },
        { first_name: 'LUIS', last_name1: 'PEREZ', last_name2: '', nia: '1002', group_code: '1ESOA', document: '', birth_date: '2008-02-02' }
      ],
      teachers: [],
      nonTeachingStaff: []
    });

    const [ana] = (await db.getUsers({})).filter(user => user.nia === '1001');
    await db.linkImageToUser(ana.id, '20260914101010.jpg');
  });

  afterEach(async () => {
    await db.close();
  });

  test('should return the absolute path of the captured photo', async () => {
    const { users } = await getUsers();

    expect(byNia(users, '1001').image_path).toBe(path.join(projectPath, 'imports', '20260914101010.jpg'));
    expect(byNia(users, '1002').image_path).toBeNull();
  });

  test('should return it even when the caller does not want repository data', async () => {
    const { users } = await getUsers({}, { loadRepositoryImages: false });

    expect(byNia(users, '1001').image_path).toBe(path.join(projectPath, 'imports', '20260914101010.jpg'));
  });

  test('should ignore the old request to leave captured photos out', async () => {
    // What the list asked for when Ver > Fotografías capturadas was off
    const { users } = await getUsers({}, { loadCapturedImages: false, loadRepositoryImages: false });

    expect(byNia(users, '1001').image_path).toBe(path.join(projectPath, 'imports', '20260914101010.jpg'));
  });

  test('should still leave repository data out when asked', async () => {
    const { users } = await getUsers({}, { loadRepositoryImages: false });

    expect(byNia(users, '1001').has_repository_image).toBe(false);
    expect(byNia(users, '1001').repository_image_path).toBeNull();
  });
});
