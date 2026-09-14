/**
 * export-repository-images and count-repository-images handler tests
 *
 * The export works like "Imágenes capturadas como ID" but takes each photo
 * from the repository. What must hold: it finds the photo from the repository itself,
 * whatever the list happens to know; it names and folders the files like the
 * captured export; an empty list exports nothing; and the local mirror is
 * only read when it holds the same file as the repository.
 *
 * @jest-environment node
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

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

describe('repository image export handlers', () => {
  const fixturesPath = path.join(os.tmpdir(), 'edu-capture-export-repository-images-tests');
  let testId = 0;
  let repositoryPath;
  let mirrorPath;
  let exportPath;
  let state;
  let mirror;

  const student = (nia, group = '1ESOA', overrides = {}) => ({
    id: Number(nia),
    type: 'student',
    nia: String(nia),
    document: '',
    first_name: `Nombre${nia}`,
    last_name1: `Apellido${nia}`,
    group_code: group,
    image_path: null,
    ...overrides
  });

  const teacher = (document, overrides = {}) => ({
    id: 9000,
    type: 'teacher',
    nia: '',
    document,
    first_name: 'MARIA',
    last_name1: 'RUIZ',
    group_code: 'DOCENTES',
    image_path: null,
    ...overrides
  });

  const photo = (color) => sharp({
    create: { width: 600, height: 800, channels: 3, background: color }
  }).jpeg().toBuffer();

  const addRepositoryPhoto = async (filename, color = { r: 10, g: 90, b: 160 }) => {
    const file = path.join(repositoryPath, filename);
    fs.writeFileSync(file, await photo(color));
    return file;
  };

  const exported = (...segments) => path.join(exportPath, ...segments);

  const runExport = (users, options) =>
    mockHandlers.get('export-repository-images')({}, exportPath, users, options);

  const runCount = (users) => mockHandlers.get('count-repository-images')({}, users);

  beforeAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    fs.mkdirSync(fixturesPath, { recursive: true });

    state = { dbManager: null, projectPath: null };

    registerExportHandlers({
      mainWindow: () => null,
      logger,
      state,
      repositoryMirror: () => mirror
    });
  });

  afterAll(() => {
    try {
      fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch (error) {
      // Still locked by libvips
    }
  });

  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();

    testId++;
    repositoryPath = path.join(fixturesPath, `repository-${testId}`);
    mirrorPath = path.join(fixturesPath, `mirror-${testId}`);
    exportPath = path.join(fixturesPath, `export-${testId}`);
    fs.mkdirSync(repositoryPath, { recursive: true });
    fs.mkdirSync(mirrorPath, { recursive: true });
    fs.mkdirSync(exportPath, { recursive: true });

    mirror = null;
    state.projectPath = path.join(fixturesPath, `project-${testId}`);
    state.dbManager = {
      getProjectSetting: jest.fn(async (key) => (key === 'imageRepositoryPath' ? repositoryPath : null)),
      getUsers: jest.fn(async () => [student(1), student(2)])
    };
  });

  describe('export-repository-images', () => {
    test('should refuse to run without an open project', async () => {
      state.dbManager = null;

      const result = await runExport([student(1)]);

      expect(result.success).toBe(false);
    });

    test('should explain where to configure a missing repository', async () => {
      state.dbManager.getProjectSetting.mockResolvedValue(null);

      const result = await runExport([student(1)]);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Proyecto > Configurar depósito de imágenes/);
    });

    test('should refuse a repository folder that does not exist', async () => {
      fs.rmSync(repositoryPath, { recursive: true, force: true });

      const result = await runExport([student(1)]);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/no existe/);
    });

    test('should name each photo after the NIA or DNI, in a folder per group', async () => {
      await addRepositoryPhoto('1001.jpg');
      await addRepositoryPhoto('11111111H.jpg');

      const result = await runExport([student(1001), teacher('11111111H')]);

      expect(result.success).toBe(true);
      expect(result.results.exported).toBe(2);
      expect(fs.existsSync(exported('1ESOA', '1001.jpg'))).toBe(true);
      expect(fs.existsSync(exported('DOCENTES', '11111111H.jpg'))).toBe(true);
    });

    test('should export a .jpeg from the repository as .jpg', async () => {
      await addRepositoryPhoto('1001.JPEG');

      await runExport([student(1001)]);

      expect(fs.readdirSync(exported('1ESOA'))).toEqual(['1001.jpg']);
    });

    test('should copy the repository photo unchanged by default', async () => {
      const source = await addRepositoryPhoto('1001.jpg');

      await runExport([student(1001)], { copyOriginal: true, resizeEnabled: false });

      expect(fs.readFileSync(exported('1ESOA', '1001.jpg'))).toEqual(fs.readFileSync(source));
    });

    test('should resize when asked', async () => {
      await addRepositoryPhoto('1001.jpg');

      await runExport([student(1001)], { copyOriginal: false, resizeEnabled: true, boxSize: 200, maxSizeKB: 500 });

      const { width, height } = await sharp(exported('1ESOA', '1001.jpg')).metadata();
      expect(Math.max(width, height)).toBe(200);
    });

    test('should count, and not export, users with no photo in the repository', async () => {
      await addRepositoryPhoto('1001.jpg');

      const result = await runExport([student(1001), student(1002), student(1003)]);

      expect(result.results.exported).toBe(1);
      expect(result.results.withoutRepositoryImage).toBe(2);
      expect(fs.readdirSync(exported('1ESOA'))).toEqual(['1001.jpg']);
    });

    test('should not depend on the captured photo', async () => {
      await addRepositoryPhoto('1001.jpg');

      const result = await runExport([
        student(1001, '1ESOA', { image_path: null }),
        student(1002, '1ESOA', { image_path: '20260914101010.jpg' })
      ]);

      expect(result.results.exported).toBe(1);
      expect(fs.readdirSync(exported('1ESOA'))).toEqual(['1001.jpg']);
    });

    test('should export nothing for an empty list, not the whole project', async () => {
      await addRepositoryPhoto('1.jpg');
      await addRepositoryPhoto('2.jpg');

      const result = await runExport([]);

      expect(result.success).toBe(true);
      expect(result.results.exported).toBe(0);
      expect(state.dbManager.getUsers).not.toHaveBeenCalled();
      expect(fs.readdirSync(exportPath)).toEqual([]);
    });

    test('should report users with no group instead of dropping them silently', async () => {
      await addRepositoryPhoto('1001.jpg');
      await addRepositoryPhoto('1002.jpg');

      const result = await runExport([student(1001), student(1002, null)]);

      expect(result.results.exported).toBe(1);
      expect(result.results.withoutGroup).toBe(1);
    });

    describe('local copy of the repository', () => {
      // Different colours in the repository and the mirror tell which was read
      const RED = { r: 200, g: 0, b: 0 };
      const BLUE = { r: 0, g: 0, b: 200 };

      const mirrorOf = (filename, entryFor) => {
        const mirrorFile = path.join(mirrorPath, filename);
        return {
          mirrorFile,
          instance: {
            getIndexEntry: jest.fn(() => entryFor()),
            getMirrorPath: jest.fn(() => mirrorFile)
          }
        };
      };

      const exportedBytes = () => fs.readFileSync(exported('1ESOA', '1001.jpg'));

      test('should read the mirror when it holds the same file', async () => {
        const repositoryFile = await addRepositoryPhoto('1001.jpg', RED);
        const { mirrorFile, instance } = mirrorOf('1001.jpg', () => {
          const stats = fs.statSync(repositoryFile);
          return { size: stats.size, mtime: stats.mtimeMs, synced: true };
        });
        fs.writeFileSync(mirrorFile, await photo(BLUE));
        mirror = instance;

        await runExport([student(1001)]);

        expect(exportedBytes()).toEqual(fs.readFileSync(mirrorFile));
      });

      test('should read the repository when the mirror is behind', async () => {
        const repositoryFile = await addRepositoryPhoto('1001.jpg', RED);
        const { mirrorFile, instance } = mirrorOf('1001.jpg', () => ({ size: 1, mtime: 1, synced: true }));
        fs.writeFileSync(mirrorFile, await photo(BLUE));
        mirror = instance;

        await runExport([student(1001)]);

        expect(exportedBytes()).toEqual(fs.readFileSync(repositoryFile));
      });

      test('should read the repository when the mirror does not have the file', async () => {
        const repositoryFile = await addRepositoryPhoto('1001.jpg', RED);
        mirror = { getIndexEntry: jest.fn(() => null), getMirrorPath: jest.fn(() => null) };

        await runExport([student(1001)]);

        expect(exportedBytes()).toEqual(fs.readFileSync(repositoryFile));
      });
    });
  });

  describe('count-repository-images', () => {
    test('should count who has a photo in the repository', async () => {
      await addRepositoryPhoto('1001.jpg');
      await addRepositoryPhoto('11111111H.jpeg');

      const result = await runCount([student(1001), student(1002), teacher('11111111H')]);

      expect(result).toEqual({ success: true, withPhoto: 2, withoutPhoto: 1 });
    });

    test('should count nothing for an empty list', async () => {
      await addRepositoryPhoto('1001.jpg');

      await expect(runCount([])).resolves.toEqual({ success: true, withPhoto: 0, withoutPhoto: 0 });
    });

    test('should fail when the repository is not configured', async () => {
      state.dbManager.getProjectSetting.mockResolvedValue(null);

      const result = await runCount([student(1001)]);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Configurar depósito de imágenes/);
    });
  });
});
