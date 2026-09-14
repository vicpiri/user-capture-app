/**
 * Exports given an empty list of users
 *
 * The exports used to replace an empty list with every user in the project,
 * so a search with no results or an empty group exported everyone instead of
 * nobody. For the repository export that meant overwriting photos nobody
 * meant to touch. Each export must now refuse, without reading the project's
 * users and without writing anything.
 *
 * @jest-environment node
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const mockHandlers = new Map();
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn((channel, handler) => mockHandlers.set(channel, handler))
  }
}));

const { registerExportHandlers } = require('../../../src/main/ipc/exportHandlers');

const logger = {
  info: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  section: jest.fn()
};

describe('exports given no users', () => {
  const fixturesPath = path.join(os.tmpdir(), 'edu-capture-export-empty-tests');
  let testId = 0;
  let projectPath;
  let repositoryPath;
  let exportPath;
  let state;

  // Every user in the project has everything an export could want, so any
  // fallback to "all users" would show up as files written
  const everyone = [
    { id: 1, type: 'student', nia: '1001', document: '', first_name: 'ANA', last_name1: 'GARCIA', last_name2: '', group_code: '1ESOA', image_path: '1001.jpg', birth_date: '2010-01-01' },
    { id: 2, type: 'teacher', nia: '', document: '11111111H', first_name: 'MARIA', last_name1: 'RUIZ', last_name2: '', group_code: 'DOCENTES', image_path: '11111111H.jpg', birth_date: '1980-01-01' }
  ];

  const handlers = {
    'export-csv': (users) => mockHandlers.get('export-csv')({}, exportPath, users),
    'export-images': (users) => mockHandlers.get('export-images')({}, exportPath, users, {}),
    'export-images-name': (users) => mockHandlers.get('export-images-name')({}, exportPath, users, {}),
    'export-inventory-csv': (users) => mockHandlers.get('export-inventory-csv')({}, exportPath, users),
    'export-to-repository': (users) => mockHandlers.get('export-to-repository')({}, users, {})
  };

  const listRepository = () => fs.readdirSync(repositoryPath).sort();

  beforeAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    fs.mkdirSync(fixturesPath, { recursive: true });

    state = { dbManager: null, projectPath: null };

    registerExportHandlers({
      mainWindow: () => null,
      logger,
      state,
      repositoryMirror: () => null
    });
  });

  afterAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();

    testId++;
    projectPath = path.join(fixturesPath, `project-${testId}`);
    repositoryPath = path.join(fixturesPath, `repository-${testId}`);
    exportPath = path.join(fixturesPath, `export-${testId}`);
    fs.mkdirSync(path.join(projectPath, 'imports'), { recursive: true });
    fs.mkdirSync(repositoryPath, { recursive: true });
    fs.mkdirSync(exportPath, { recursive: true });

    for (const user of everyone) {
      fs.writeFileSync(path.join(projectPath, 'imports', user.image_path), 'captured');
      fs.writeFileSync(path.join(repositoryPath, user.image_path), 'repository');
    }

    state.projectPath = projectPath;
    state.dbManager = {
      getUsers: jest.fn(async () => everyone),
      getGroups: jest.fn(async () => [{ code: '1ESOA', name: '1º ESO A' }, { code: 'DOCENTES', name: 'Docentes' }]),
      getProjectSetting: jest.fn(async (key) => (key === 'imageRepositoryPath' ? repositoryPath : null))
    };
  });

  describe.each(Object.keys(handlers))('%s', (channel) => {
    test.each([
      ['an empty list', []],
      ['no list at all', undefined]
    ])('should refuse %s instead of exporting the whole project', async (label, users) => {
      const repositoryBefore = listRepository();

      const result = await handlers[channel](users);

      expect(result).toEqual({
        success: false,
        error: 'No hay usuarios que exportar con la selección y los filtros actuales'
      });
      expect(state.dbManager.getUsers).not.toHaveBeenCalled();
      expect(fs.readdirSync(exportPath)).toEqual([]);
      expect(listRepository()).toEqual(repositoryBefore);
    });
  });
});
