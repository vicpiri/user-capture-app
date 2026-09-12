/**
 * ThumbnailService tests
 *
 * Uses real sharp against real files: the point of the service is that the
 * output is a genuinely smaller image, which a mock could not show.
 *
 * @jest-environment node
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const ThumbnailService = require('../../../src/main/thumbnailService');

const logger = {
  info: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  section: jest.fn()
};

describe('ThumbnailService', () => {
  // Kept outside the repository: libvips can hold a source file open for the
  // life of the process on Windows, so these are not always deletable on the
  // way out and must not be left in the working tree
  const fixturesPath = path.join(os.tmpdir(), 'edu-capture-thumbnail-tests');
  let testId = 0;
  let workPath;
  let cacheDir;
  let service;

  const createPhoto = async (name, width = 1200, height = 1600) => {
    const filePath = path.join(workPath, name);
    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 200, g: 120, b: 60 }
      }
    })
      .jpeg()
      .toFile(filePath);

    return filePath;
  };

  beforeAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    fs.mkdirSync(fixturesPath, { recursive: true });
  });

  afterAll(() => {
    // Best effort: whatever survives is cleaned by the next run's beforeAll
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
    cacheDir = path.join(workPath, 'cache');
    fs.mkdirSync(workPath, { recursive: true });

    service = new ThumbnailService(cacheDir, logger);
  });

  describe('isSupported()', () => {
    test('should accept jpg and jpeg', () => {
      expect(service.isSupported('a.jpg')).toBe(true);
      expect(service.isSupported('a.JPEG')).toBe(true);
    });

    test('should reject anything else', () => {
      expect(service.isSupported('a.png')).toBe(false);
      expect(service.isSupported('a.txt')).toBe(false);
      expect(service.isSupported('a')).toBe(false);
    });
  });

  describe('getThumbnail()', () => {
    test('should produce an image scaled down to the requested size', async () => {
      const source = await createPhoto('photo.jpg');

      const thumbPath = await service.getThumbnail(source, 128);
      const meta = await sharp(thumbPath).metadata();

      expect(Math.max(meta.width, meta.height)).toBe(128);
    });

    test('should keep the aspect ratio', async () => {
      const source = await createPhoto('portrait.jpg', 1200, 1600);

      const meta = await sharp(await service.getThumbnail(source, 128)).metadata();

      expect(meta.width / meta.height).toBeCloseTo(1200 / 1600, 2);
    });

    test('should produce a far smaller file than the original', async () => {
      const source = await createPhoto('photo.jpg');

      const thumbPath = await service.getThumbnail(source, 128);

      const originalSize = fs.statSync(source).size;
      const thumbSize = fs.statSync(thumbPath).size;
      expect(thumbSize).toBeLessThan(originalSize / 2);
    });

    test('should not enlarge an image that is already smaller', async () => {
      const source = await createPhoto('small.jpg', 64, 64);

      const meta = await sharp(await service.getThumbnail(source, 128)).metadata();

      expect(meta.width).toBe(64);
    });

    test('should reuse the cached file on a second request', async () => {
      const source = await createPhoto('photo.jpg');

      const first = await service.getThumbnail(source, 128);
      const before = fs.statSync(first).mtimeMs;

      const second = await service.getThumbnail(source, 128);

      expect(second).toBe(first);
      expect(fs.statSync(second).mtimeMs).toBe(before);
    });

    test('should build one file per requested size', async () => {
      const source = await createPhoto('photo.jpg');

      const small = await service.getThumbnail(source, 128);
      const large = await service.getThumbnail(source, 384);

      expect(small).not.toBe(large);
    });

    test('should generate once when asked concurrently', async () => {
      const source = await createPhoto('photo.jpg');
      const generate = jest.spyOn(service, 'generate');

      const results = await Promise.all(
        Array.from({ length: 8 }, () => service.getThumbnail(source, 128))
      );

      expect(new Set(results).size).toBe(1);
      expect(generate).toHaveBeenCalledTimes(1);
    });

    test('should rebuild when the source is replaced', async () => {
      const source = await createPhoto('photo.jpg', 1200, 1600);
      const first = await service.getThumbnail(source, 128);

      // Replacing a photo keeps its name but moves its timestamp, and that is
      // what has to invalidate the cached copy
      const later = new Date(Date.now() + 5000);
      fs.utimesSync(source, later, later);

      const second = await service.getThumbnail(source, 128);

      expect(second).not.toBe(first);
      expect(fs.existsSync(second)).toBe(true);
    });

    test('should reject a source that does not exist', async () => {
      await expect(
        service.getThumbnail(path.join(workPath, 'missing.jpg'), 128)
      ).rejects.toThrow();
    });

    test('should leave no temporary files behind on failure', async () => {
      const broken = path.join(workPath, 'broken.jpg');
      fs.writeFileSync(broken, 'this is not a jpeg');

      await expect(service.getThumbnail(broken, 128)).rejects.toThrow();

      const leftovers = fs.existsSync(cacheDir)
        ? fs.readdirSync(cacheDir).filter(name => name.endsWith('.tmp'))
        : [];
      expect(leftovers).toEqual([]);
    });
  });

  describe('clearCache()', () => {
    test('should remove generated thumbnails', async () => {
      const source = await createPhoto('photo.jpg');
      await service.getThumbnail(source, 128);

      await service.clearCache();

      expect(fs.existsSync(cacheDir)).toBe(false);
    });

    test('should still work after being cleared', async () => {
      const source = await createPhoto('photo.jpg');
      await service.getThumbnail(source, 128);
      await service.clearCache();

      const rebuilt = await service.getThumbnail(source, 128);

      expect(fs.existsSync(rebuilt)).toBe(true);
    });
  });
});
