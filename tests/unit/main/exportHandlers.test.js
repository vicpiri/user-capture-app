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
  writeExportedImage,
  buildOriginalCopy,
  writeFileAtomically,
  renameWithRetry,
  removeOrphanTempExports
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

    test('should leave no temporary file behind', async () => {
      const source = await createPhoto('leftovers.jpg', 400, 400);

      await writeExportedImage(source, path.join(workPath, 'out.jpg'), options(), logger);

      const leftovers = fs.readdirSync(workPath).filter((name) => name.endsWith('.tmp'));
      expect(leftovers).toEqual([]);
    });
  });

  /**
   * "Copy the original" used to go through sharp's toFile(), which re-encodes
   * at quality 80 and drops the metadata: the option promised a copy and
   * delivered a second generation of the photo.
   */
  describe('buildOriginalCopy()', () => {
    test('should return the very bytes of an upright jpeg', async () => {
      const source = await createPhoto('upright.jpg', 500, 400);
      const sourceBuffer = fs.readFileSync(source);

      const copy = await buildOriginalCopy(sourceBuffer);

      expect(copy.equals(sourceBuffer)).toBe(true);
    });

    test('should rotate a photo whose EXIF says it is sideways', async () => {
      const source = path.join(workPath, 'sideways.jpg');
      await sharp({
        create: { width: 600, height: 300, channels: 3, background: { r: 10, g: 20, b: 30 } }
      })
        .withMetadata({ orientation: 6 })
        .jpeg()
        .toFile(source);
      const sourceBuffer = fs.readFileSync(source);

      const copy = await buildOriginalCopy(sourceBuffer);

      expect(copy.equals(sourceBuffer)).toBe(false);
      const metadata = await sharp(copy).metadata();
      // Orientation 6 means a quarter turn, so the sides swap over
      expect(metadata.width).toBe(300);
      expect(metadata.height).toBe(600);
    });

    test('should re-encode a source that is not a jpeg', async () => {
      const source = path.join(workPath, 'actually.png');
      await sharp({
        create: { width: 120, height: 120, channels: 3, background: { r: 1, g: 2, b: 3 } }
      })
        .png()
        .toFile(source);

      const copy = await buildOriginalCopy(fs.readFileSync(source));

      expect((await sharp(copy).metadata()).format).toBe('jpeg');
    });

    test('should reject a truncated image before it reaches the repository', async () => {
      const source = await createPhoto('cut.jpg', 300, 300);
      const truncated = fs.readFileSync(source).subarray(0, 40);

      await expect(buildOriginalCopy(truncated)).rejects.toThrow();
    });
  });

  describe('writeFileAtomically()', () => {
    test('should write the bytes to the destination', async () => {
      const destPath = path.join(workPath, 'written.jpg');

      await writeFileAtomically(destPath, Buffer.from('contenido nuevo'));

      expect(fs.readFileSync(destPath, 'utf8')).toBe('contenido nuevo');
    });

    test('should replace an existing destination', async () => {
      const destPath = path.join(workPath, 'replaced.jpg');
      fs.writeFileSync(destPath, 'anterior');

      await writeFileAtomically(destPath, Buffer.from('nuevo'));

      expect(fs.readFileSync(destPath, 'utf8')).toBe('nuevo');
    });

    test('should name the temporary so no mirror would index it', async () => {
      const destPath = path.join(workPath, 'named.jpg');
      const seen = [];
      const rename = fs.promises.rename;
      jest.spyOn(fs.promises, 'rename').mockImplementation(async (from, to) => {
        seen.push(path.basename(from));
        return rename(from, to);
      });

      await writeFileAtomically(destPath, Buffer.from('x'));

      expect(seen).toHaveLength(1);
      expect(seen[0].endsWith('.tmp')).toBe(true);
      expect(seen[0].startsWith('named.jpg.')).toBe(true);
      fs.promises.rename.mockRestore();
    });

    /**
     * The point of the whole exercise: a write that dies half way must not
     * leave the destination truncated, because every other instance's mirror
     * would pick the broken file up as if it were good.
     */
    test('should leave the previous file untouched when the rename fails', async () => {
      const destPath = path.join(workPath, 'kept.jpg');
      fs.writeFileSync(destPath, 'la buena');
      jest.spyOn(fs.promises, 'rename').mockRejectedValue(Object.assign(new Error('boom'), { code: 'EIO' }));

      await expect(writeFileAtomically(destPath, Buffer.from('a medias'))).rejects.toThrow('boom');

      expect(fs.readFileSync(destPath, 'utf8')).toBe('la buena');
      fs.promises.rename.mockRestore();
    });

    test('should clean the temporary up when the rename fails', async () => {
      const destPath = path.join(workPath, 'cleaned.jpg');
      jest.spyOn(fs.promises, 'rename').mockRejectedValue(Object.assign(new Error('boom'), { code: 'EIO' }));

      await expect(writeFileAtomically(destPath, Buffer.from('x'))).rejects.toThrow();

      expect(fs.readdirSync(workPath)).toEqual([]);
      fs.promises.rename.mockRestore();
    });
  });

  describe('renameWithRetry()', () => {
    test('should retry while the destination is briefly locked', async () => {
      const rename = fs.promises.rename;
      let calls = 0;
      jest.spyOn(fs.promises, 'rename').mockImplementation(async (from, to) => {
        calls++;
        if (calls < 3) {
          throw Object.assign(new Error('locked'), { code: 'EBUSY' });
        }
        return rename(from, to);
      });

      const from = path.join(workPath, 'a.tmp');
      fs.writeFileSync(from, 'x');
      await renameWithRetry(from, path.join(workPath, 'b.jpg'), { delay: 1 });

      expect(calls).toBe(3);
      expect(fs.existsSync(path.join(workPath, 'b.jpg'))).toBe(true);
      fs.promises.rename.mockRestore();
    });

    test('should give up after the last attempt', async () => {
      jest.spyOn(fs.promises, 'rename').mockRejectedValue(Object.assign(new Error('locked'), { code: 'EBUSY' }));

      await expect(
        renameWithRetry('a', 'b', { attempts: 2, delay: 1 })
      ).rejects.toThrow('locked');

      expect(fs.promises.rename).toHaveBeenCalledTimes(2);
      fs.promises.rename.mockRestore();
    });

    test('should not retry an error that will not clear', async () => {
      jest.spyOn(fs.promises, 'rename').mockRejectedValue(Object.assign(new Error('nope'), { code: 'ENOENT' }));

      await expect(renameWithRetry('a', 'b', { delay: 1 })).rejects.toThrow('nope');

      expect(fs.promises.rename).toHaveBeenCalledTimes(1);
      fs.promises.rename.mockRestore();
    });
  });

  describe('removeOrphanTempExports()', () => {
    test('should drop temporaries left by a dead export', async () => {
      fs.writeFileSync(path.join(workPath, '1234.jpg.PC-AULA3-4812-1.tmp'), 'x');
      fs.writeFileSync(path.join(workPath, '5678.jpg.OTRO_PC-9-27.tmp'), 'x');

      const removed = await removeOrphanTempExports(workPath, logger);

      expect(removed).toBe(2);
      expect(fs.readdirSync(workPath)).toEqual([]);
    });

    test('should leave photos and unrelated temporaries alone', async () => {
      fs.writeFileSync(path.join(workPath, '1234.jpg'), 'x');
      fs.writeFileSync(path.join(workPath, 'algo.tmp'), 'x');
      fs.writeFileSync(path.join(workPath, 'informe.docx.tmp'), 'x');

      const removed = await removeOrphanTempExports(workPath, logger);

      expect(removed).toBe(0);
      expect(fs.readdirSync(workPath).sort()).toEqual(['1234.jpg', 'algo.tmp', 'informe.docx.tmp']);
    });

    test('should warn rather than fail when the folder cannot be read', async () => {
      const removed = await removeOrphanTempExports(path.join(workPath, 'missing'), logger);

      expect(removed).toBe(0);
      expect(logger.warning).toHaveBeenCalled();
    });
  });
});
