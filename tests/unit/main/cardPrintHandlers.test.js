/**
 * Card print and publication request tests
 *
 * These move real files around inside the shared repository, and the folders
 * they write to are what other systems and other people act on. A request that
 * is silently not created means a card never gets printed.
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
  },
  dialog: { showOpenDialog: jest.fn(), showSaveDialog: jest.fn(), showMessageBox: jest.fn() },
  shell: { openPath: jest.fn(), openExternal: jest.fn() },
  app: {
    getPath: jest.fn(() => require('os').tmpdir()),
    getVersion: jest.fn(() => '0.0.0-test')
  },
  BrowserWindow: jest.fn()
}));

const { registerMiscHandlers } = require('../../../src/main/ipc/miscHandlers');

const logger = {
  info: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  section: jest.fn()
};

describe('card print and publication requests', () => {
  const fixturesPath = path.join(os.tmpdir(), 'edu-capture-cardprint-tests');
  let testId = 0;
  let projectPath;
  let repositoryPath;
  let db;
  let state;
  let users;

  const folder = (name) => path.join(repositoryPath, name);
  const listFolder = (name) =>
    fs.existsSync(folder(name)) ? fs.readdirSync(folder(name)).sort() : [];

  const addRepositoryPhoto = (identifier) => {
    fs.writeFileSync(path.join(repositoryPath, `${identifier}.jpg`), 'photo bytes');
  };

  const call = (channel, ...args) => mockHandlers.get(channel)({}, ...args);

  beforeAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    fs.mkdirSync(fixturesPath, { recursive: true });

    state = { dbManager: null, projectPath: null };

    registerMiscHandlers({
      mainWindow: () => null,
      logger,
      state,
      imageGridWindow: () => null,
      repositoryGridWindow: () => null,
      createMenu: jest.fn(),
      reinitializeRepositoryMirror: jest.fn()
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
    repositoryPath = path.join(fixturesPath, `repository-${testId}`);
    fs.mkdirSync(projectPath, { recursive: true });
    fs.mkdirSync(repositoryPath, { recursive: true });

    db = new DatabaseManager(path.join(projectPath, 'users.db'));
    await db.initialize();
    await db.setProjectSetting('imageRepositoryPath', repositoryPath);

    state.dbManager = db;
    state.projectPath = projectPath;

    await db.importUsers({
      groups: [{ code: '1ESOA', name: 'Primero ESO A' }],
      students: [
        { first_name: 'ANA', last_name1: 'GARCIA', last_name2: '', nia: '1001', group_code: '1ESOA', document: '', birth_date: '2008-01-01' },
        { first_name: 'LUIS', last_name1: 'PEREZ', last_name2: '', nia: '1002', group_code: '1ESOA', document: '', birth_date: '2008-02-02' }
      ],
      teachers: [
        { first_name: 'MARIA', last_name1: 'RUIZ', last_name2: '', document: 'D100', birth_date: '1975-01-01' }
      ],
      nonTeachingStaff: []
    });

    users = await db.getUsers({});
  });

  afterEach(async () => {
    await db.close();
  });

  const idOf = (nia) => users.find(u => u.nia === nia).id;
  const staffId = (document) => users.find(u => u.document === document).id;

  describe('request-card-print', () => {
    test('should refuse to run without an open project', async () => {
      state.dbManager = null;

      const result = await call('request-card-print', [1]);

      expect(result.success).toBe(false);
      state.dbManager = db;
    });

    test('should create the folder and a file named after the student NIA', async () => {
      addRepositoryPhoto('1001');

      const result = await call('request-card-print', [idOf('1001')]);

      expect(result.count).toBe(1);
      expect(listFolder('To-Print-ID')).toEqual(['1001']);
    });

    test('should name a staff request after the document', async () => {
      addRepositoryPhoto('D100');

      await call('request-card-print', [staffId('D100')]);

      expect(listFolder('To-Print-ID')).toEqual(['D100']);
    });

    test('should write the request without an extension', async () => {
      // The indicator in the list looks for a file named exactly the identifier
      addRepositoryPhoto('1001');

      await call('request-card-print', [idOf('1001')]);

      expect(listFolder('To-Print-ID')[0]).not.toContain('.');
    });

    test('should skip a user with no photo in the repository', async () => {
      addRepositoryPhoto('1001');

      const result = await call('request-card-print', [idOf('1001'), idOf('1002')]);

      expect(result.count).toBe(1);
      expect(result.skipped).toBe(1);
      expect(listFolder('To-Print-ID')).toEqual(['1001']);
    });

    test('should handle several users at once', async () => {
      addRepositoryPhoto('1001');
      addRepositoryPhoto('1002');

      const result = await call('request-card-print', [idOf('1001'), idOf('1002')]);

      expect(result.count).toBe(2);
      expect(listFolder('To-Print-ID')).toEqual(['1001', '1002']);
    });

    test('should report when none of the users exist', async () => {
      const result = await call('request-card-print', [9999]);

      expect(result.success).toBe(false);
    });
  });

  describe('get-card-print-requests', () => {
    test('should list the pending identifiers', async () => {
      addRepositoryPhoto('1001');
      await call('request-card-print', [idOf('1001')]);

      const result = await call('get-card-print-requests');

      expect(result.success).toBe(true);
      expect(result.userIds).toContain('1001');
    });

    test('should return nothing when the folder does not exist', async () => {
      const result = await call('get-card-print-requests');

      expect(result.success).toBe(true);
      expect(result.userIds).toEqual([]);
    });

    test('should not report another repository requests after switching', async () => {
      // The listing is cached for half a minute. Keyed only by time, opening a
      // second project would show the first one's requests on its users.
      addRepositoryPhoto('1001');
      await call('request-card-print', [idOf('1001')]);
      expect((await call('get-card-print-requests')).userIds).toContain('1001');

      const otherRepository = path.join(fixturesPath, `repository-${testId}-other`);
      fs.mkdirSync(otherRepository, { recursive: true });
      await db.setProjectSetting('imageRepositoryPath', otherRepository);

      const result = await call('get-card-print-requests');

      expect(result.userIds).toEqual([]);
    });
  });

  describe('requests the open project cannot act on', () => {
    // The repository is shared and outlives each course's project
    const leftBehind = (folderName, fileName) => {
      fs.mkdirSync(folder(folderName), { recursive: true });
      fs.writeFileSync(path.join(folder(folderName), fileName), '');
    };

    test('should not report card requests for people outside the project', async () => {
      addRepositoryPhoto('1001');
      await call('request-card-print', [idOf('1001')]);
      leftBehind('To-Print-ID', '9999');

      const result = await call('get-card-print-requests');

      expect(result.userIds).toEqual(['1001']);
      expect(result.otherCount).toBe(1);
    });

    test('should not take a student document for a staff request', async () => {
      // Students are requested by NIA; a file named like some student's
      // document is not that student's request
      await db.importUsers({
        groups: [],
        students: [{ first_name: 'EVA', last_name1: 'SOLER', last_name2: '', nia: '1003', group_code: '1ESOA', document: 'X55', birth_date: '2008-03-03' }],
        teachers: [],
        nonTeachingStaff: []
      });
      leftBehind('To-Print-ID', 'X55');

      const result = await call('get-card-print-requests');

      expect(result.userIds).toEqual([]);
      expect(result.otherCount).toBe(1);
    });

    test('should not report publications for people outside the project', async () => {
      addRepositoryPhoto('D100');
      await call('request-publication', [staffId('D100')]);
      leftBehind('To-Publish', '9999.jpg');

      const result = await call('get-publication-requests');

      expect(result.userIds).toEqual(['D100']);
      expect(result.otherCount).toBe(1);
    });
  });

  describe('review-pending-requests and archive-pending-requests', () => {
    test('should refuse to run without a repository', async () => {
      await db.setProjectSetting('imageRepositoryPath', '');

      const result = await call('review-pending-requests');

      expect(result.success).toBe(false);
    });

    test('should stop counting an archived request straight away', async () => {
      // The listing is cached for half a minute; archiving must not wait for it
      addRepositoryPhoto('1001');
      await call('request-card-print', [idOf('1001')]);
      expect((await call('get-card-print-requests')).userIds).toEqual(['1001']);

      const result = await call('archive-pending-requests', { cards: ['1001'], publications: [] });

      expect(result.success).toBe(true);
      expect(result.cards.moved).toBe(1);
      expect((await call('get-card-print-requests')).userIds).toEqual([]);
    });

    test('should list what the review found', async () => {
      fs.mkdirSync(folder('To-Print-ID'), { recursive: true });
      fs.writeFileSync(path.join(folder('To-Print-ID'), '9999'), '');

      const result = await call('review-pending-requests');

      expect(result.success).toBe(true);
      expect(result.cards.others.map(entry => entry.id)).toEqual(['9999']);
    });
  });

  describe('requests from before the course started', () => {
    test('should mark them when they predate the project course', async () => {
      // A course that has not started yet: everything made so far predates it
      await db.setProjectSetting('academicYear', '2999');
      addRepositoryPhoto('1001');
      await call('request-card-print', [idOf('1001')]);

      const result = await call('get-card-print-requests');

      expect(result.userIds).toEqual(['1001']);
      expect(result.previousCourseIds).toEqual(['1001']);
    });

    test('should not mark the ones made during the course', async () => {
      await db.setProjectSetting('academicYear', '2000');
      addRepositoryPhoto('1001');
      await call('request-card-print', [idOf('1001')]);

      const result = await call('get-card-print-requests');

      expect(result.previousCourseIds).toEqual([]);
    });

    test('should use the running course for a project that never recorded one', async () => {
      addRepositoryPhoto('1001');
      await call('request-card-print', [idOf('1001')]);

      const result = await call('get-card-print-requests');

      expect(result.previousCourseIds).toEqual([]);
    });

    test('should mark publications too', async () => {
      await db.setProjectSetting('academicYear', '2999');
      addRepositoryPhoto('1001');
      await call('request-publication', [idOf('1001')]);

      const result = await call('get-publication-requests');

      expect(result.previousCourseIds).toEqual(['1001']);
    });
  });

  describe('the date a request carries', () => {
    const LONG_AGO = new Date(2020, 0, 1);
    const isRecent = (filePath) => Date.now() - fs.statSync(filePath).mtimeMs < 60 * 1000;

    test('should move to now when a card is requested again', async () => {
      addRepositoryPhoto('1001');
      await call('request-card-print', [idOf('1001')]);
      const request = path.join(folder('To-Print-ID'), '1001');
      fs.utimesSync(request, LONG_AGO, LONG_AGO);

      await call('request-card-print', [idOf('1001')]);

      expect(isRecent(request)).toBe(true);
    });

    test('should be when a publication was requested, not when the photo was taken', async () => {
      addRepositoryPhoto('1001');
      const photo = path.join(repositoryPath, '1001.jpg');
      fs.utimesSync(photo, LONG_AGO, LONG_AGO);

      await call('request-publication', [idOf('1001')]);

      expect(isRecent(path.join(folder('To-Publish'), '1001.jpg'))).toBe(true);
    });
  });

  describe('check-card-print-requests', () => {
    test('should say which of the given users have a request pending', async () => {
      addRepositoryPhoto('1001');
      await call('request-card-print', [idOf('1001')]);

      const result = await call('check-card-print-requests', ['1001', '1002']);

      expect(result.usersWithRequests).toEqual(['1001']);
    });

    test('should report none when there are no requests', async () => {
      const result = await call('check-card-print-requests', ['1001']);

      expect(result.usersWithRequests).toEqual([]);
    });
  });

  describe('mark-cards-as-printed', () => {
    test('should move the request into Printed-ID', async () => {
      addRepositoryPhoto('1001');
      await call('request-card-print', [idOf('1001')]);

      const result = await call('mark-cards-as-printed', ['1001']);

      expect(result.movedCount).toBe(1);
      expect(listFolder('To-Print-ID')).toEqual([]);
      expect(listFolder('Printed-ID')).toEqual(['1001']);
    });

    test('should leave the requests it was not asked about', async () => {
      addRepositoryPhoto('1001');
      addRepositoryPhoto('1002');
      await call('request-card-print', [idOf('1001'), idOf('1002')]);

      await call('mark-cards-as-printed', ['1001']);

      expect(listFolder('To-Print-ID')).toEqual(['1002']);
      expect(listFolder('Printed-ID')).toEqual(['1001']);
    });

    test('should not count an identifier with no pending request', async () => {
      addRepositoryPhoto('1001');
      await call('request-card-print', [idOf('1001')]);

      const result = await call('mark-cards-as-printed', ['1001', 'nope']);

      expect(result.movedCount).toBe(1);
    });

    test('should not lose the photo itself', async () => {
      addRepositoryPhoto('1001');
      await call('request-card-print', [idOf('1001')]);

      await call('mark-cards-as-printed', ['1001']);

      expect(fs.existsSync(path.join(repositoryPath, '1001.jpg'))).toBe(true);
    });
  });

  describe('get-printed-cards', () => {
    test('should resolve each printed file back to its user', async () => {
      addRepositoryPhoto('1001');
      addRepositoryPhoto('D100');
      await call('request-card-print', [idOf('1001'), staffId('D100')]);
      await call('mark-cards-as-printed', ['1001', 'D100']);

      const result = await call('get-printed-cards');

      expect(result.success).toBe(true);
      expect(result.users.map(u => u.first_name).sort()).toEqual(['ANA', 'MARIA']);
    });

    test('should date the card when it was printed, not when it was requested', async () => {
      addRepositoryPhoto('1001');
      await call('request-card-print', [idOf('1001')]);
      // A request made weeks ago: moving the file kept this date
      const requested = new Date('2026-01-10T10:00:00Z');
      fs.utimesSync(path.join(folder('To-Print-ID'), '1001'), requested, requested);
      const before = Date.now();

      await call('mark-cards-as-printed', ['1001']);
      const result = await call('get-printed-cards');

      expect(new Date(result.users[0].printed_date).getTime()).toBeGreaterThanOrEqual(before - 2000);
    });

    test('should stamp each one with when it was printed', async () => {
      addRepositoryPhoto('1001');
      await call('request-card-print', [idOf('1001')]);
      await call('mark-cards-as-printed', ['1001']);

      const result = await call('get-printed-cards');

      expect(result.users[0].printed_date).toEqual(expect.any(String));
    });

    test('should return nothing when none have been printed', async () => {
      const result = await call('get-printed-cards');

      expect(result.users).toEqual([]);
    });
  });

  describe('request-publication', () => {
    test('should copy the photo into To-Publish', async () => {
      addRepositoryPhoto('1001');

      const result = await call('request-publication', [idOf('1001')]);

      expect(result.count).toBe(1);
      expect(listFolder('To-Publish')).toEqual(['1001.jpg']);
    });

    test('should keep the image contents', async () => {
      addRepositoryPhoto('1001');

      await call('request-publication', [idOf('1001')]);

      const copied = fs.readFileSync(path.join(folder('To-Publish'), '1001.jpg'), 'utf8');
      expect(copied).toBe('photo bytes');
    });

    test('should leave the original in place', async () => {
      addRepositoryPhoto('1001');

      await call('request-publication', [idOf('1001')]);

      expect(fs.existsSync(path.join(repositoryPath, '1001.jpg'))).toBe(true);
    });

    test('should skip a user with no photo', async () => {
      addRepositoryPhoto('1001');

      const result = await call('request-publication', [idOf('1001'), idOf('1002')]);

      expect(result.count).toBe(1);
      expect(result.skipped).toBe(1);
    });

    test('should list the pending publications afterwards', async () => {
      addRepositoryPhoto('1001');
      await call('request-publication', [idOf('1001')]);

      const result = await call('get-publication-requests');

      expect(result.userIds).toContain('1001');
    });
  });
});
