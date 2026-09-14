/**
 * Image linking tests
 *
 * A photo linked to the wrong person becomes their carnet, so the guards that
 * stop a silent reassignment matter as much as the linking itself.
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

const {
  registerUserGroupImageHandlers
} = require('../../../src/main/ipc/userGroupImageHandlers');

const logger = {
  info: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  section: jest.fn()
};

describe('image linking', () => {
  const fixturesPath = path.join(os.tmpdir(), 'edu-capture-link-tests');
  let testId = 0;
  let projectPath;
  let db;
  let state;
  let users;

  const link = (userId, imagePath) =>
    mockHandlers.get('link-image-user')({}, { userId, imagePath });
  const confirmLink = (userId, imagePath) =>
    mockHandlers.get('confirm-link-image')({}, { userId, imagePath });
  const unlink = (userId) => mockHandlers.get('unlink-image-user')({}, userId);

  const imagePathOf = async (userId) => (await db.getUserById(userId)).image_path;

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
    jest.spyOn(console, 'error').mockImplementation(() => {});

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
        { first_name: 'ANA', last_name1: 'GARCIA', last_name2: 'LOPEZ', nia: '1001', group_code: '1ESOA', document: '', birth_date: '2008-01-01' },
        { first_name: 'LUIS', last_name1: 'PEREZ', last_name2: '', nia: '1002', group_code: '1ESOA', document: '', birth_date: '2008-02-02' }
      ],
      teachers: [],
      nonTeachingStaff: []
    });

    users = await db.getUsers({});
  });

  afterEach(async () => {
    await db.close();
    jest.restoreAllMocks();
  });

  describe('link-image-user', () => {
    test('should refuse to run without an open project', async () => {
      state.dbManager = null;

      const result = await link(1, 'foto.jpg');

      expect(result.success).toBe(false);
      state.dbManager = db;
    });

    test('should link a photo to a user with none', async () => {
      const result = await link(users[0].id, 'foto.jpg');

      expect(result.success).toBe(true);
      expect(await imagePathOf(users[0].id)).toBe('foto.jpg');
    });

    test('should store the file name, not the absolute path', async () => {
      // Paths are stored relative so a project folder can be moved
      const absolute = path.join(projectPath, 'imports', 'foto.jpg');

      await link(users[0].id, absolute);

      expect(await imagePathOf(users[0].id)).toBe('foto.jpg');
    });

    test('should refuse a photo already belonging to somebody else', async () => {
      await link(users[0].id, 'foto.jpg');

      const result = await link(users[1].id, 'foto.jpg');

      expect(result.success).toBe(false);
      expect(result.imageAlreadyAssigned).toBe(true);
    });

    test('should name who already holds the photo', async () => {
      await link(users[0].id, 'foto.jpg');

      const result = await link(users[1].id, 'foto.jpg');

      expect(result.assignedUsers).toHaveLength(1);
      expect(result.assignedUsers[0].name).toBe('ANA GARCIA LOPEZ');
      expect(result.assignedUsers[0].nia).toBe('1001');
    });

    test('should leave the other user untouched when it refuses', async () => {
      await link(users[0].id, 'foto.jpg');

      await link(users[1].id, 'foto.jpg');

      expect(await imagePathOf(users[0].id)).toBe('foto.jpg');
      expect(await imagePathOf(users[1].id)).toBeFalsy();
    });

    test('should also say when the user already has a photo it would replace', async () => {
      // Both at once used to report only the first, and confirming replaced
      // LUIS's own photo without anyone being told
      await link(users[0].id, 'foto.jpg');
      await link(users[1].id, 'propia.jpg');

      const result = await link(users[1].id, 'foto.jpg');

      expect(result.imageAlreadyAssigned).toBe(true);
      expect(result.currentImage).toBe(path.join(projectPath, 'imports', 'propia.jpg'));
    });

    test('should report no photo to replace when the user has none', async () => {
      await link(users[0].id, 'foto.jpg');

      const result = await link(users[1].id, 'foto.jpg');

      expect(result.imageAlreadyAssigned).toBe(true);
      expect(result.currentImage).toBeNull();
    });

    test('should change nobody while that question is pending', async () => {
      await link(users[0].id, 'foto.jpg');
      await link(users[1].id, 'propia.jpg');

      await link(users[1].id, 'foto.jpg');

      expect(await imagePathOf(users[0].id)).toBe('foto.jpg');
      expect(await imagePathOf(users[1].id)).toBe('propia.jpg');
    });

    test('should treat an absolute path as the same photo it already stored', async () => {
      await link(users[0].id, 'foto.jpg');

      const result = await link(users[1].id, path.join(projectPath, 'imports', 'foto.jpg'));

      expect(result.imageAlreadyAssigned).toBe(true);
    });

    test('should ask before replacing a photo the user already has', async () => {
      await link(users[0].id, 'primera.jpg');

      const result = await link(users[0].id, 'segunda.jpg');

      expect(result.success).toBe(false);
      expect(result.needsConfirmation).toBe(true);
    });

    test('should not replace the photo while waiting for that confirmation', async () => {
      await link(users[0].id, 'primera.jpg');

      await link(users[0].id, 'segunda.jpg');

      expect(await imagePathOf(users[0].id)).toBe('primera.jpg');
    });

    test('should report the current photo as a full path for display', async () => {
      await link(users[0].id, 'primera.jpg');

      const result = await link(users[0].id, 'segunda.jpg');

      expect(result.currentImage).toBe(path.join(projectPath, 'imports', 'primera.jpg'));
    });

    test('should accept relinking the same photo to the same user', async () => {
      await link(users[0].id, 'foto.jpg');

      const result = await link(users[0].id, 'foto.jpg');

      // Same user, same photo: nothing is being taken from anyone
      expect(result.imageAlreadyAssigned).toBeUndefined();
    });
  });

  describe('confirm-link-image', () => {
    test('should replace the photo once confirmed', async () => {
      await link(users[0].id, 'primera.jpg');

      const result = await confirmLink(users[0].id, 'segunda.jpg');

      expect(result.success).toBe(true);
      expect(await imagePathOf(users[0].id)).toBe('segunda.jpg');
    });

    test('should store the file name, not the absolute path', async () => {
      await confirmLink(users[0].id, path.join(projectPath, 'imports', 'foto.jpg'));

      expect(await imagePathOf(users[0].id)).toBe('foto.jpg');
    });

    test('should refuse to run without an open project', async () => {
      state.dbManager = null;

      const result = await confirmLink(1, 'foto.jpg');

      expect(result.success).toBe(false);
      state.dbManager = db;
    });
  });

  describe('unlink-image-user', () => {
    test('should clear the photo', async () => {
      await link(users[0].id, 'foto.jpg');

      const result = await unlink(users[0].id);

      expect(result.success).toBe(true);
      expect(await imagePathOf(users[0].id)).toBeFalsy();
    });

    test('should free the photo for another user', async () => {
      await link(users[0].id, 'foto.jpg');
      await unlink(users[0].id);

      const result = await link(users[1].id, 'foto.jpg');

      expect(result.success).toBe(true);
      expect(await imagePathOf(users[1].id)).toBe('foto.jpg');
    });

    test('should leave other users alone', async () => {
      await link(users[0].id, 'ana.jpg');
      await link(users[1].id, 'luis.jpg');

      await unlink(users[0].id);

      expect(await imagePathOf(users[1].id)).toBe('luis.jpg');
    });
  });
});
