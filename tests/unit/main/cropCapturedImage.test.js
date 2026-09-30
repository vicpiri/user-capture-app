/**
 * Cropping a captured photo from the viewer, and restoring its original
 *
 * What must hold: only the project's captured photos can be cropped (not
 * the originals kept by a crop), the dialog is given the original to start
 * from, and every window is told so it loads the photo again.
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
const { originalPathFor } = require('../../../src/main/imageCrop');
const { readOrientation } = require('../../../src/main/imageOrientation');

describe('crop-captured-image and restore-captured-image', () => {
  const fixtures = path.join(os.tmpdir(), 'edu-capture-crop-handler-tests');
  const logger = { info: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn(), section: jest.fn() };
  let testId = 0;
  let state;
  let mainWindow;
  let gridWindow;
  let importsPath;
  let file;

  const call = (channel, ...args) => mockHandlers.get(channel)({}, ...args);
  const photo = () => sharp({ create: { width: 40, height: 30, channels: 3, background: 'red' } }).jpeg().toBuffer();
  const window = () => ({ isDestroyed: () => false, webContents: { send: jest.fn() } });
  const size = async (target) => {
    const { width, height } = await sharp(target).metadata();
    return [width, height];
  };

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
    file = path.join(importsPath, '20260930120000.jpg');
    fs.writeFileSync(file, await photo());
    mainWindow = window();
    gridWindow = window();
  });

  describe('get-captured-image-crop-source', () => {
    test('offers the photo itself until it is cropped', async () => {
      await expect(call('get-captured-image-crop-source', file)).resolves.toEqual({
        success: true, sourcePath: file, hasOriginal: false, width: 40, height: 30
      });
    });

    test('offers the original once it is cropped', async () => {
      await call('crop-captured-image', file, { left: 0, top: 0, width: 20, height: 20 });

      await expect(call('get-captured-image-crop-source', file)).resolves.toEqual({
        success: true, sourcePath: originalPathFor(file), hasOriginal: true, width: 40, height: 30
      });
    });
  });

  describe('crop-captured-image', () => {
    test('crops the photo and tells the main window and the captured images grid', async () => {
      await expect(call('crop-captured-image', file, { left: 5, top: 5, width: 30, height: 20 }))
        .resolves.toEqual({ success: true, width: 30, height: 20 });

      expect(await size(file)).toEqual([30, 20]);
      const message = ['captured-image-rewritten', { imagePath: file }];
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(...message);
      expect(gridWindow.webContents.send).toHaveBeenCalledWith(...message);
    });

    test('reports a rectangle that does not fit, without telling anyone', async () => {
      const result = await call('crop-captured-image', file, { left: 30, top: 0, width: 20, height: 10 });

      expect(result).toEqual({ success: false, error: 'El recorte se sale de la foto' });
      expect(mainWindow.webContents.send).not.toHaveBeenCalled();
    });

    test('refuses a photo outside the project\'s imports folder', async () => {
      const outside = path.join(state.projectPath, 'otra.jpg');
      fs.writeFileSync(outside, await photo());

      const result = await call('crop-captured-image', outside, { left: 0, top: 0, width: 10, height: 10 });

      expect(result.error).toMatch(/Solo se pueden recortar las fotos capturadas/);
      expect(await size(outside)).toEqual([40, 30]);
    });

    test('refuses the original kept by a crop', async () => {
      await call('crop-captured-image', file, { left: 0, top: 0, width: 20, height: 20 });

      const result = await call('crop-captured-image', originalPathFor(file), { left: 0, top: 0, width: 10, height: 10 });

      expect(result.success).toBe(false);
      expect(await size(originalPathFor(file))).toEqual([40, 30]);
    });

    test('reports a photo that is gone', async () => {
      const result = await call('crop-captured-image', path.join(importsPath, 'no-existe.jpg'), { left: 0, top: 0, width: 1, height: 1 });
      expect(result.error).toMatch(/ya no está/);
    });

    test('refuses without a project', async () => {
      state.projectPath = null;
      const result = await call('crop-captured-image', file, { left: 0, top: 0, width: 1, height: 1 });
      expect(result).toEqual({ success: false, error: 'No hay ningún proyecto abierto' });
    });
  });

  describe('restore-captured-image', () => {
    test('puts the original back and tells every window', async () => {
      await call('crop-captured-image', file, { left: 0, top: 0, width: 20, height: 20 });
      jest.clearAllMocks();

      await expect(call('restore-captured-image', file)).resolves.toEqual({ success: true });

      expect(await size(file)).toEqual([40, 30]);
      expect(fs.existsSync(originalPathFor(file))).toBe(false);
      expect(mainWindow.webContents.send).toHaveBeenCalledWith('captured-image-rewritten', { imagePath: file });
    });

    test('reports a photo that was never cropped', async () => {
      const result = await call('restore-captured-image', file);
      expect(result.error).toMatch(/no tiene un original/);
    });
  });

  describe('turning a cropped photo', () => {
    test('turns its original too, so the next crop keeps the turn', async () => {
      await call('crop-captured-image', file, { left: 0, top: 0, width: 20, height: 20 });

      await call('rotate-captured-image', file, 90);

      expect(readOrientation(fs.readFileSync(file))).toBe(6);
      expect(readOrientation(fs.readFileSync(originalPathFor(file)))).toBe(6);
      await expect(call('get-captured-image-crop-source', file)).resolves.toMatchObject({ width: 30, height: 40 });
    });
  });
});
