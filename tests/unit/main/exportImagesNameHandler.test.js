/**
 * export-images-name handler tests
 *
 * Exports each captured photo as "Apellido1 Apellido2, Nombre" in a folder per
 * group. It shares the per-group loop with the exports named by ID, so what is
 * checked here is the naming and what the results report.
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

describe('export-images-name handler', () => {
  const fixturesPath = path.join(os.tmpdir(), 'edu-capture-export-name-tests');
  let testId = 0;
  let projectPath;
  let importsPath;
  let exportPath;
  let state;

  const user = (id, overrides = {}) => ({
    id,
    type: 'student',
    nia: String(1000 + id),
    first_name: 'ANA',
    last_name1: 'GARCIA',
    last_name2: 'LOPEZ',
    group_code: '1ESOA',
    image_path: `foto${id}.jpg`,
    ...overrides
  });

  const createPhoto = async (name) => {
    await sharp({ create: { width: 300, height: 400, channels: 3, background: { r: 10, g: 90, b: 160 } } })
      .jpeg()
      .toFile(path.join(importsPath, name));
  };

  const runExport = (users) => mockHandlers.get('export-images-name')({}, exportPath, users, {});
  const exported = (group) => fs.readdirSync(path.join(exportPath, group)).sort();

  beforeAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    fs.mkdirSync(fixturesPath, { recursive: true });

    state = { dbManager: null, projectPath: null };
    registerExportHandlers({ mainWindow: () => null, logger, state, repositoryMirror: () => null });
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
    testId++;
    projectPath = path.join(fixturesPath, `project-${testId}`);
    importsPath = path.join(projectPath, 'imports');
    exportPath = path.join(fixturesPath, `export-${testId}`);
    fs.mkdirSync(importsPath, { recursive: true });
    fs.mkdirSync(exportPath, { recursive: true });
    state.dbManager = {};
    state.projectPath = projectPath;
  });

  test('should name each photo "Apellido1 Apellido2, Nombre" in its group folder', async () => {
    await createPhoto('foto1.jpg');

    const result = await runExport([user(1)]);

    expect(result.results.exported).toBe(1);
    expect(exported('1ESOA')).toEqual(['Garcia Lopez, Ana.jpg']);
  });

  test('should leave out a missing second surname', async () => {
    await createPhoto('foto1.jpg');

    await runExport([user(1, { first_name: 'LUIS', last_name1: 'PEREZ', last_name2: '' })]);

    expect(exported('1ESOA')).toEqual(['Perez, Luis.jpg']);
  });

  test('should count users with no group instead of dropping them silently', async () => {
    await createPhoto('foto1.jpg');
    await createPhoto('foto2.jpg');

    const result = await runExport([user(1), user(2, { first_name: 'EVA', group_code: null })]);

    expect(result.results.exported).toBe(1);
    expect(result.results.withoutGroup).toBe(1);
  });

  test('should report a missing photo without stopping the rest', async () => {
    await createPhoto('foto2.jpg');

    const result = await runExport([user(1), user(2, { first_name: 'EVA' })]);

    expect(result.results.exported).toBe(1);
    expect(result.results.errors).toEqual([{ user: 'ANA GARCIA', error: 'Imagen no encontrada' }]);
  });

  test('should report a user with no name', async () => {
    await createPhoto('foto1.jpg');

    const result = await runExport([user(1, { first_name: '', last_name1: '', last_name2: '' })]);

    expect(result.results.errors).toEqual([{ user: ' ', error: 'Usuario sin nombre completo' }]);
  });
});
