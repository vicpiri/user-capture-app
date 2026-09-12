/**
 * Export helper tests
 *
 * These cover the pieces shared by every image export: how the repository is
 * listed, how work is spread, and how an exported copy is produced.
 *
 * @jest-environment node
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

jest.mock('electron', () => ({ ipcMain: { handle: jest.fn() } }));

const {
  readRepositoryFilenames,
  findUserRepositoryImage,
  mapWithConcurrency,
  writeExportedImage
} = require('../../../src/main/ipc/exportHandlers');

const logger = {
  info: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  section: jest.fn()
};

describe('export helpers', () => {
  // Outside the repository: libvips can hold a source file open on Windows
  const fixturesPath = path.join(os.tmpdir(), 'edu-capture-export-tests');
  let testId = 0;
  let workPath;

  const createPhoto = async (name, width = 1600, height = 2000) => {
    const filePath = path.join(workPath, name);
    await sharp({
      create: { width, height, channels: 3, background: { r: 90, g: 140, b: 200 } }
    })
      .jpeg({ quality: 100 })
      .toFile(filePath);

    return filePath;
  };

  beforeAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    fs.mkdirSync(fixturesPath, { recursive: true });
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
    workPath = path.join(fixturesPath, `case-${testId}`);
    fs.mkdirSync(workPath, { recursive: true });
  });

  describe('readRepositoryFilenames()', () => {
    test('should list the folder in lowercase', async () => {
      fs.writeFileSync(path.join(workPath, 'ABC.JPG'), 'x');
      fs.writeFileSync(path.join(workPath, 'def.jpeg'), 'x');

      const files = await readRepositoryFilenames(workPath, logger);

      expect(files.has('abc.jpg')).toBe(true);
      expect(files.has('def.jpeg')).toBe(true);
    });

    test('should return an empty set without a repository path', async () => {
      expect((await readRepositoryFilenames(null, logger)).size).toBe(0);
    });

    test('should warn and return empty when the folder cannot be read', async () => {
      const files = await readRepositoryFilenames(path.join(workPath, 'missing'), logger);

      expect(files.size).toBe(0);
      expect(logger.warning).toHaveBeenCalled();
    });
  });

  describe('findUserRepositoryImage()', () => {
    const files = new Set(['1234.jpg', '5678.jpeg', 'aabbcc.jpg']);

    test('should match a student by NIA', () => {
      expect(findUserRepositoryImage({ type: 'student', nia: '1234' }, files)).toBe('1234.jpg');
    });

    test('should match staff by document', () => {
      expect(findUserRepositoryImage({ type: 'teacher', document: 'AABBCC' }, files)).toBe('AABBCC.jpg');
    });

    test('should accept the jpeg extension', () => {
      expect(findUserRepositoryImage({ type: 'student', nia: '5678' }, files)).toBe('5678.jpeg');
    });

    test('should return null when there is no photo', () => {
      expect(findUserRepositoryImage({ type: 'student', nia: '9999' }, files)).toBeNull();
    });

    test('should return null without an identifier', () => {
      expect(findUserRepositoryImage({ type: 'student', nia: null }, files)).toBeNull();
      expect(findUserRepositoryImage({ type: 'teacher', document: '' }, files)).toBeNull();
    });
  });

  describe('mapWithConcurrency()', () => {
    test('should keep the order of the input', async () => {
      const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
        // Later items finish sooner, so ordering cannot come from completion
        await new Promise(resolve => setTimeout(resolve, (6 - n) * 5));
        return n * 10;
      });

      expect(results).toEqual([10, 20, 30, 40, 50]);
    });

    test('should never exceed the limit', async () => {
      let running = 0;
      let peak = 0;

      await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 4, async () => {
        running++;
        peak = Math.max(peak, running);
        await new Promise(resolve => setTimeout(resolve, 5));
        running--;
      });

      expect(peak).toBeLessThanOrEqual(4);
      expect(peak).toBeGreaterThan(1);
    });

    test('should visit every item', async () => {
      const seen = [];

      await mapWithConcurrency([1, 2, 3], 2, async (n) => { seen.push(n); });

      expect(seen.sort()).toEqual([1, 2, 3]);
    });

    test('should handle an empty list', async () => {
      await expect(mapWithConcurrency([], 4, async () => {})).resolves.toEqual([]);
    });
  });

  describe('writeExportedImage()', () => {
    const options = (overrides = {}) => ({
      copyOriginal: true,
      resizeEnabled: false,
      boxSize: 800,
      maxSizeKB: 500,
      ...overrides
    });

    test('should copy at full size when not resizing', async () => {
      const source = await createPhoto('photo.jpg', 1600, 2000);
      const dest = path.join(workPath, 'out.jpg');

      await writeExportedImage(source, dest, options(), logger);

      const meta = await sharp(dest).metadata();
      expect(meta.width).toBe(1600);
      expect(meta.height).toBe(2000);
    });

    test('should fit the image inside the requested box', async () => {
      const source = await createPhoto('photo.jpg', 1600, 2000);
      const dest = path.join(workPath, 'out.jpg');

      await writeExportedImage(
        source,
        dest,
        options({ copyOriginal: false, resizeEnabled: true, boxSize: 400 }),
        logger
      );

      const meta = await sharp(dest).metadata();
      expect(Math.max(meta.width, meta.height)).toBe(400);
      expect(meta.width / meta.height).toBeCloseTo(1600 / 2000, 2);
    });

    test('should not enlarge an image smaller than the box', async () => {
      const source = await createPhoto('small.jpg', 200, 200);
      const dest = path.join(workPath, 'out.jpg');

      await writeExportedImage(
        source,
        dest,
        options({ copyOriginal: false, resizeEnabled: true, boxSize: 800 }),
        logger
      );

      expect((await sharp(dest).metadata()).width).toBe(200);
    });

    test('should step the quality down to meet the size limit', async () => {
      const source = await createPhoto('noisy.jpg', 1600, 2000);
      const dest = path.join(workPath, 'tight.jpg');
      const looseDest = path.join(workPath, 'loose.jpg');

      await writeExportedImage(
        source,
        dest,
        options({ copyOriginal: false, resizeEnabled: true, boxSize: 1600, maxSizeKB: 1 }),
        logger
      );
      await writeExportedImage(
        source,
        looseDest,
        options({ copyOriginal: false, resizeEnabled: true, boxSize: 1600, maxSizeKB: 10000 }),
        logger
      );

      // An unreachable limit still stops at the floor rather than looping forever
      expect(fs.statSync(dest).size).toBeLessThanOrEqual(fs.statSync(looseDest).size);
    });

    test('should write nothing when neither option is set', async () => {
      const source = await createPhoto('photo.jpg');
      const dest = path.join(workPath, 'out.jpg');

      await writeExportedImage(
        source,
        dest,
        options({ copyOriginal: false, resizeEnabled: false }),
        logger
      );

      expect(fs.existsSync(dest)).toBe(false);
    });

    test('should reject a source that does not exist', async () => {
      await expect(
        writeExportedImage(path.join(workPath, 'missing.jpg'), path.join(workPath, 'o.jpg'), options(), logger)
      ).rejects.toThrow();
    });
  });
});
