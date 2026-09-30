/**
 * Cropping a captured photo, keeping its original
 *
 * What must hold: the photo keeps its name and gets the rectangle asked for,
 * measured on the photo as shown; the original is kept the first time and
 * never overwritten, so every crop starts from it; restoring puts it back.
 *
 * @jest-environment node
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

const {
  ORIGINALS_FOLDER,
  originalPathFor,
  hasOriginal,
  displaySize,
  checkRect,
  cropImageFile,
  restoreOriginal
} = require('../../../src/main/imageCrop');
const { setOrientation, readOrientation } = require('../../../src/main/imageOrientation');
const ImageManager = require('../../../src/main/imageManager');

describe('imageCrop', () => {
  const fixtures = path.join(os.tmpdir(), 'edu-capture-crop-tests');
  let testId = 0;
  let importsPath;
  let photoPath;

  // 60 wide x 20 high: left half red, right half blue
  const photo = async () => sharp({ create: { width: 60, height: 20, channels: 3, background: { r: 0, g: 0, b: 255 } } })
    .composite([{
      input: await sharp({ create: { width: 30, height: 20, channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toBuffer(),
      left: 0,
      top: 0
    }])
    .jpeg({ quality: 95 })
    .toBuffer();

  // Colour of the pixel at (x, y), roughly
  const pixel = async (file, x, y) => {
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    const i = (y * info.width + x) * info.channels;
    return data[i] > 128 ? 'red' : data[i + 2] > 128 ? 'blue' : 'other';
  };

  beforeAll(() => {
    fs.rmSync(fixtures, { recursive: true, force: true });
  });

  afterAll(() => {
    fs.rmSync(fixtures, { recursive: true, force: true });
  });

  beforeEach(async () => {
    jest.useRealTimers();
    testId++;
    importsPath = path.join(fixtures, `project-${testId}`, 'imports');
    fs.mkdirSync(importsPath, { recursive: true });
    photoPath = path.join(importsPath, '20260930100000.jpg');
    fs.writeFileSync(photoPath, await photo());
  });

  test('keeps the original next to the photo, in Originales', () => {
    expect(originalPathFor(photoPath)).toBe(path.join(importsPath, ORIGINALS_FOLDER, '20260930100000.jpg'));
    expect(hasOriginal(photoPath)).toBe(false);
  });

  test('crops the photo in place to the rectangle', async () => {
    const before = fs.readFileSync(photoPath);

    await expect(cropImageFile(photoPath, { left: 35, top: 2, width: 20, height: 16 }))
      .resolves.toEqual({ width: 20, height: 16 });

    const metadata = await sharp(photoPath).metadata();
    expect([metadata.width, metadata.height]).toEqual([20, 16]);
    expect(await pixel(photoPath, 10, 8)).toBe('blue');
    expect(fs.readFileSync(originalPathFor(photoPath))).toEqual(before);
  });

  test('always starts from the original, never from the last crop', async () => {
    await cropImageFile(photoPath, { left: 0, top: 0, width: 10, height: 10 });

    // Wider than the first crop: only possible from the original
    await cropImageFile(photoPath, { left: 20, top: 0, width: 40, height: 20 });

    const metadata = await sharp(photoPath).metadata();
    expect([metadata.width, metadata.height]).toEqual([40, 20]);
    expect(await pixel(photoPath, 2, 10)).toBe('red');
    expect(await pixel(photoPath, 38, 10)).toBe('blue');
  });

  test('never overwrites the original once kept', async () => {
    const before = fs.readFileSync(photoPath);

    await cropImageFile(photoPath, { left: 0, top: 0, width: 30, height: 20 });
    await cropImageFile(photoPath, { left: 10, top: 5, width: 20, height: 10 });

    expect(fs.readFileSync(originalPathFor(photoPath))).toEqual(before);
  });

  test('measures the rectangle on the photo as shown, and writes it upright', async () => {
    // Turned a quarter to the right by its EXIF tag: shown 20 wide x 60 high,
    // red on top
    fs.writeFileSync(photoPath, setOrientation(fs.readFileSync(photoPath), 6));
    await expect(displaySize(photoPath)).resolves.toEqual({ width: 20, height: 60 });

    await cropImageFile(photoPath, { left: 0, top: 0, width: 20, height: 25 });

    const metadata = await sharp(photoPath).metadata();
    expect([metadata.width, metadata.height]).toEqual([20, 25]);
    expect(readOrientation(fs.readFileSync(photoPath))).toBe(1);
    expect(await pixel(photoPath, 10, 5)).toBe('red');
  });

  test.each([
    [{ left: -1, top: 0, width: 10, height: 10 }, /se sale/],
    [{ left: 55, top: 0, width: 10, height: 10 }, /se sale/],
    [{ left: 0, top: 0, width: 0, height: 10 }, /se sale/],
    [{ left: 0, top: 0, width: 'a', height: 10 }, /no válido/],
    [null, /no válido/]
  ])('refuses the rectangle %p and leaves the photo as it was', async (rect, message) => {
    const before = fs.readFileSync(photoPath);

    await expect(cropImageFile(photoPath, rect)).rejects.toThrow(message);

    expect(fs.readFileSync(photoPath)).toEqual(before);
  });

  test('rounds a rectangle to whole pixels', () => {
    expect(checkRect({ left: 0.4, top: 1.6, width: 9.5, height: 10.2 }, { width: 60, height: 20 }))
      .toEqual({ left: 0, top: 2, width: 10, height: 10 });
  });

  test('restores the original and removes the empty folder', async () => {
    const before = fs.readFileSync(photoPath);
    await cropImageFile(photoPath, { left: 0, top: 0, width: 10, height: 10 });

    await restoreOriginal(photoPath);

    expect(fs.readFileSync(photoPath)).toEqual(before);
    expect(hasOriginal(photoPath)).toBe(false);
    expect(fs.existsSync(path.join(importsPath, ORIGINALS_FOLDER))).toBe(false);
  });

  test('keeps the folder while other photos have their originals there', async () => {
    const other = path.join(importsPath, '20260930100001.jpg');
    fs.writeFileSync(other, await photo());
    await cropImageFile(photoPath, { left: 0, top: 0, width: 10, height: 10 });
    await cropImageFile(other, { left: 0, top: 0, width: 10, height: 10 });

    await restoreOriginal(photoPath);

    expect(hasOriginal(other)).toBe(true);
  });

  test('refuses to restore a photo that was never cropped', async () => {
    await expect(restoreOriginal(photoPath)).rejects.toThrow(/no tiene un original/);
  });

  test('the originals never show up among the captured photos', async () => {
    await cropImageFile(photoPath, { left: 0, top: 0, width: 10, height: 10 });

    await expect(new ImageManager(importsPath).getImages(false)).resolves.toEqual([photoPath]);
  });
});
