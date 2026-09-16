/**
 * Turning a captured photo from the viewer
 *
 * What must hold: only the project's captured photos can be turned, the turn
 * is written to the file, and every window is told so it loads it again.
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

const { registerUserGroupImageHandlers } = require('../../../src/main/ipc/userGroupImageHandlers');
const { readOrientation } = require('../../../src/main/imageOrientation');

describe('rotate-captured-image', () => {
  const fixtures = path.join(os.tmpdir(), 'edu-capture-rotate-tests');
  const logger = { info: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn(), section: jest.fn() };
  let testId = 0;
  let state;
  let mainWindow;
  let gridWindow;
  let importsPath;

  const rotate = (imagePath, degrees) => mockHandlers.get('rotate-captured-image')({}, imagePath, degrees);
  const photo = () => sharp({ create: { width: 40, height: 20, channels: 3, background: 'red' } }).jpeg().toBuffer();
  const window = () => ({ isDestroyed: () => false, webContents: { send: jest.fn() } });

  beforeAll(() => {
    fs.rmSync(fixtures, { recursive: true, force: true });
    state = { dbManager: null, projectPath: null, incomingRotation: 0 };
    registerUserGroupImageHandlers({
      mainWindow: () => mainWindow,
      imageGridWindow: () => gridWindow,
      logger,
      state,
      repositoryCacheManager: { loadRepositoryFileList: async () => new Set(), findRepositoryFile: () => null },
      repositoryMirror: () => null
    });
  });

  afterAll(() => {
    fs.rmSync(fixtures, { recursive: true, force: true });
  });

  beforeEach(async () => {
    jest.useRealTimers();
    jest.clearAllMocks();
    testId++;
    state.projectPath = path.join(fixtures, `project-${testId}`);
    importsPath = path.join(state.projectPath, 'imports');
    fs.mkdirSync(importsPath, { recursive: true });
    fs.writeFileSync(path.join(importsPath, '20260915120000.jpg'), await photo());
    mainWindow = window();
    gridWindow = window();
  });

  test('turns the photo in the file', async () => {
    const file = path.join(importsPath, '20260915120000.jpg');

    await expect(rotate(file, 90)).resolves.toEqual({ success: true, orientation: 6 });
    await expect(rotate(file, 90)).resolves.toEqual({ success: true, orientation: 3 });
    await expect(rotate(file, -90)).resolves.toEqual({ success: true, orientation: 6 });

    expect(readOrientation(fs.readFileSync(file))).toBe(6);
  });

  test('tells the main window and the captured images grid', async () => {
    const file = path.join(importsPath, '20260915120000.jpg');

    await rotate(file, 90);

    const message = ['captured-image-rotated', { imagePath: file, orientation: 6 }];
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(...message);
    expect(gridWindow.webContents.send).toHaveBeenCalledWith(...message);
  });

  test('works with the grid closed', async () => {
    gridWindow = null;
    await expect(rotate(path.join(importsPath, '20260915120000.jpg'), 90)).resolves.toMatchObject({ success: true });
  });

  test('refuses a photo outside the project\'s imports folder', async () => {
    const outside = path.join(state.projectPath, 'otra.jpg');
    fs.writeFileSync(outside, await photo());

    const result = await rotate(outside, 90);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/capturadas/);
    expect(readOrientation(fs.readFileSync(outside))).toBe(1);
  });

  test('refuses a path that climbs out of imports', async () => {
    const result = await rotate(path.join(importsPath, '..', '..', 'x.jpg'), 90);
    expect(result.success).toBe(false);
  });

  test('refuses anything but a quarter or half turn', async () => {
    const result = await rotate(path.join(importsPath, '20260915120000.jpg'), 45);
    expect(result).toEqual({ success: false, error: 'Giro no válido: 45' });
  });

  test('reports a photo that is gone', async () => {
    const result = await rotate(path.join(importsPath, 'no-existe.jpg'), 90);
    expect(result.error).toMatch(/ya no está/);
  });

  test('refuses without a project', async () => {
    state.projectPath = null;
    const result = await rotate('C:/x.jpg', 90);
    expect(result.success).toBe(false);
  });

  test('get-incoming-rotation answers the project\'s choice', async () => {
    state.dbManager = { getProjectSetting: jest.fn() };
    state.incomingRotation = 180;

    await expect(mockHandlers.get('get-incoming-rotation')({})).resolves.toEqual({ degrees: 180 });

    state.dbManager = null;
    await expect(mockHandlers.get('get-incoming-rotation')({})).resolves.toEqual({ degrees: 0 });
  });
});
