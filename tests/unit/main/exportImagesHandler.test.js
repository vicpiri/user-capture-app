/**
 * export-images handler tests
 *
 * Drives the registered IPC handler end to end against real files, which is
 * what covers the parts a helper test cannot: the per-group loop, the bounded
 * concurrency around it, and the counting of results.
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

describe('export-images handler', () => {
  const fixturesPath = path.join(os.tmpdir(), 'edu-capture-export-images-tests');
  let testId = 0;
  let projectPath;
  let importsPath;
  let exportPath;
  let state;

  const student = (id, group, imageName) => ({
    id,
    type: 'student',
    nia: `NIA${id}`,
    first_name: `Nombre${id}`,
    last_name1: `Apellido${id}`,
    group_code: group,
    image_path: imageName
  });

  const createPhoto = async (name) => {
    await sharp({
      create: { width: 900, height: 1200, channels: 3, background: { r: 10, g: 90, b: 160 } }
    })
      .jpeg()
      .toFile(path.join(importsPath, name));
  };

  const runExport = (users, options) =>
    mockHandlers.get('export-images')({}, exportPath, users, options);

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
    projectPath = path.join(fixturesPath, `project-${testId}`);
    importsPath = path.join(projectPath, 'imports');
    exportPath = path.join(fixturesPath, `export-${testId}`);
    fs.mkdirSync(importsPath, { recursive: true });
    fs.mkdirSync(exportPath, { recursive: true });

    state.dbManager = {};
    state.projectPath = projectPath;
  });

  test('should refuse to run without an open project', async () => {
    state.dbManager = null;

    const result = await runExport([]);

    expect(result.success).toBe(false);
  });

  test('should write one file per user, named after their id', async () => {
    await createPhoto('a.jpg');
    await createPhoto('b.jpg');

    const result = await runExport([
      student(1, '1ESO', 'a.jpg'),
      student(2, '1ESO', 'b.jpg')
    ]);

    expect(result.success).toBe(true);
    expect(result.results.exported).toBe(2);
    expect(fs.existsSync(path.join(exportPath, '1ESO', 'NIA1.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(exportPath, '1ESO', 'NIA2.jpg'))).toBe(true);
  });

  test('should put each group in its own folder', async () => {
    await createPhoto('a.jpg');
    await createPhoto('b.jpg');

    await runExport([
      student(1, '1ESO', 'a.jpg'),
      student(2, '2BAC', 'b.jpg')
    ]);

    expect(fs.existsSync(path.join(exportPath, '1ESO', 'NIA1.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(exportPath, '2BAC', 'NIA2.jpg'))).toBe(true);
  });

  test('should export every user of a group larger than the concurrency limit', async () => {
    // More users than run at once, so nothing may be skipped or double counted
    const users = [];
    for (let i = 1; i <= 25; i++) {
      await createPhoto(`photo${i}.jpg`);
      users.push(student(i, '1ESO', `photo${i}.jpg`));
    }

    const result = await runExport(users);

    expect(result.results.exported).toBe(25);
    expect(result.results.errors).toEqual([]);
    expect(fs.readdirSync(path.join(exportPath, '1ESO')).length).toBe(25);
  });

  test('should resize when asked', async () => {
    await createPhoto('a.jpg');

    await runExport([student(1, '1ESO', 'a.jpg')], {
      copyOriginal: false,
      resizeEnabled: true,
      boxSize: 300,
      maxSizeKB: 500
    });

    const meta = await sharp(path.join(exportPath, '1ESO', 'NIA1.jpg')).metadata();
    expect(Math.max(meta.width, meta.height)).toBe(300);
  });

  test('should report a missing source image without stopping the rest', async () => {
    await createPhoto('a.jpg');

    const result = await runExport([
      student(1, '1ESO', 'a.jpg'),
      student(2, '1ESO', 'gone.jpg')
    ]);

    expect(result.results.exported).toBe(1);
    expect(result.results.errors).toHaveLength(1);
    expect(result.results.errors[0].error).toBe('Imagen no encontrada');
  });

  test('should report a user with no identifier without stopping the rest', async () => {
    await createPhoto('a.jpg');
    await createPhoto('b.jpg');

    const withoutNia = { ...student(2, '1ESO', 'b.jpg'), nia: null };

    const result = await runExport([student(1, '1ESO', 'a.jpg'), withoutNia]);

    expect(result.results.exported).toBe(1);
    expect(result.results.errors[0].error).toContain('identificador');
  });

  test('should ignore users with no photo', async () => {
    await createPhoto('a.jpg');

    const result = await runExport([
      student(1, '1ESO', 'a.jpg'),
      { ...student(2, '1ESO', null) }
    ]);

    expect(result.results.total).toBe(1);
    expect(result.results.exported).toBe(1);
  });
});
