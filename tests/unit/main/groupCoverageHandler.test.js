/**
 * get-group-photo-coverage handler tests
 *
 * Ver > Fotografías por grupo counts either the captured photos linked in the
 * project or the photos in the repository, matched by NIA or document like
 * the exports do.
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

describe('get-group-photo-coverage handler', () => {
  const fixturesPath = path.join(os.tmpdir(), 'edu-capture-group-coverage-tests');
  let testId = 0;
  let projectPath;
  let repositoryPath;
  let db;
  let state;
  let mirror;

  const getCoverage = (source) => mockHandlers.get('get-group-photo-coverage')({}, source);

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
      repositoryMirror: () => mirror
    });
  });

  afterAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  beforeEach(async () => {
    jest.useRealTimers();
    jest.clearAllMocks();
    mirror = null;

    testId++;
    projectPath = path.join(fixturesPath, `project-${testId}`);
    repositoryPath = path.join(projectPath, 'repository');
    fs.mkdirSync(path.join(projectPath, 'imports'), { recursive: true });
    fs.mkdirSync(repositoryPath, { recursive: true });

    db = new DatabaseManager(path.join(projectPath, 'users.db'));
    await db.initialize();

    state.dbManager = db;
    state.projectPath = projectPath;

    await db.importUsers({
      groups: [
        { code: '1ESOA', name: 'Primero ESO A' },
        { code: '2ESOA', name: 'Segundo ESO A' }
      ],
      students: [
        { first_name: 'ANA', last_name1: 'GARCIA', last_name2: '', nia: '1001', group_code: '1ESOA', document: '', birth_date: '2008-01-01' },
        { first_name: 'LUIS', last_name1: 'PEREZ', last_name2: '', nia: '1002', group_code: '1ESOA', document: '', birth_date: '2008-02-02' },
        { first_name: 'EVA', last_name1: 'RUIZ', last_name2: '', nia: '2001', group_code: '2ESOA', document: '', birth_date: '2007-03-03' }
      ],
      teachers: [
        { first_name: 'PEPE', last_name1: 'LOPEZ', last_name2: '', document: '12345678Z', birth_date: '1980-01-01' }
      ],
      nonTeachingStaff: []
    });

    const [ana] = (await db.getUsers({})).filter(user => user.nia === '1001');
    await db.linkImageToUser(ana.id, '20260914101010.jpg');
  });

  afterEach(async () => {
    await db.close();
  });

  const byCode = (groups, code) => groups.find(group => group.code === code);

  test('should count linked captured photos by default', async () => {
    const result = await getCoverage();

    expect(result.success).toBe(true);
    expect(byCode(result.groups, '1ESOA')).toMatchObject({ total: 2, withImage: 1, withoutImage: 1 });
    expect(byCode(result.groups, '2ESOA')).toMatchObject({ total: 1, withImage: 0 });
  });

  test('should count repository photos by NIA or document, whatever the case of the extension', async () => {
    await db.setProjectSetting('imageRepositoryPath', repositoryPath);
    fs.writeFileSync(path.join(repositoryPath, '1002.JPG'), '');
    fs.writeFileSync(path.join(repositoryPath, '2001.jpeg'), '');
    fs.writeFileSync(path.join(repositoryPath, '12345678Z.jpg'), '');
    fs.writeFileSync(path.join(repositoryPath, '9999.jpg'), '');

    const result = await getCoverage('repository');

    expect(result.success).toBe(true);
    // Ana has a captured photo but none in the repository
    expect(byCode(result.groups, '1ESOA')).toMatchObject({ total: 2, withImage: 1, withoutImage: 1 });
    expect(byCode(result.groups, '2ESOA')).toMatchObject({ total: 1, withImage: 1, withoutImage: 0 });
    expect(byCode(result.groups, 'DOCENTES')).toMatchObject({ total: 1, withImage: 1 });
  });

  test('should use the mirror index once it has loaded', async () => {
    await db.setProjectSetting('imageRepositoryPath', repositoryPath);
    fs.writeFileSync(path.join(repositoryPath, '1001.jpg'), '');
    mirror = {
      mirrorIndex: new Map([['1002.jpg', {}]]),
      getAllFiles: () => ['1002.jpg']
    };

    const result = await getCoverage('repository');

    expect(byCode(result.groups, '1ESOA').withImage).toBe(1);
  });

  test('should fail when no repository is configured', async () => {
    const result = await getCoverage('repository');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Configurar depósito de imágenes/);
  });

  test('should fail when the repository folder is missing', async () => {
    await db.setProjectSetting('imageRepositoryPath', path.join(projectPath, 'missing'));

    const result = await getCoverage('repository');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no está disponible/);
  });
});
