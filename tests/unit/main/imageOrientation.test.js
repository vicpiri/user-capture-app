/**
 * Image orientation tests
 *
 * Photos are turned by rewriting the EXIF orientation tag, never the pixels.
 * What must hold: sharp (and so thumbnails, exports and the orla) reads the
 * new orientation, the image data is untouched, every other EXIF tag survives,
 * and quarter turns add up.
 *
 * @jest-environment node
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const {
  readOrientation,
  setOrientation,
  rotateOrientation,
  rotateImageFile
} = require('../../../src/main/imageOrientation');

// A landscape JPEG, 40 x 20
const photo = (options = {}) => {
  let pipeline = sharp({ create: { width: 40, height: 20, channels: 3, background: { r: 200, g: 30, b: 30 } } }).jpeg();
  if (options.orientation) pipeline = pipeline.withMetadata({ orientation: options.orientation });
  if (options.exif) pipeline = pipeline.withExif(options.exif);
  return pipeline.toBuffer();
};

// Everything from the start of scan on: the compressed image itself
const imageData = (buffer) => buffer.slice(buffer.indexOf(Buffer.from([0xff, 0xda])));

// A JPEG whose EXIF is big-endian ("MM"), with one tag and no orientation
const bigEndianPhoto = async () => {
  const plain = await photo();
  const tiff = Buffer.alloc(8 + 2 + 12 + 4);
  tiff.write('MM', 0, 'latin1');
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(1, 8);
  tiff.writeUInt16BE(0x0131, 10); // Software, as a short ASCII value
  tiff.writeUInt16BE(2, 12);
  tiff.writeUInt32BE(4, 14);
  tiff.write('app', 18, 'latin1');
  tiff.writeUInt32BE(0, 22);
  const exif = Buffer.concat([Buffer.from([0x45, 0x78, 0x69, 0x66, 0, 0]), tiff]);
  const header = Buffer.alloc(4);
  header.writeUInt16BE(0xffe1, 0);
  header.writeUInt16BE(2 + exif.length, 2);
  return Buffer.concat([plain.slice(0, 2), header, exif, plain.slice(2)]);
};

describe('image orientation', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  describe('rotateOrientation', () => {
    test('adds quarter turns to the right', () => {
      expect([1, 6, 3, 8].map((o) => rotateOrientation(o, 90))).toEqual([6, 3, 8, 1]);
    });

    test('turns to the left with negative degrees', () => {
      expect(rotateOrientation(1, -90)).toBe(8);
      expect(rotateOrientation(6, -90)).toBe(1);
    });

    test('half turns', () => {
      expect(rotateOrientation(1, 180)).toBe(3);
      expect(rotateOrientation(8, 180)).toBe(6);
    });

    test('keeps a mirrored photo mirrored', () => {
      expect(rotateOrientation(2, 90)).toBe(7);
      expect(rotateOrientation(5, 90)).toBe(2);
    });

    test('treats an unknown orientation as upright', () => {
      expect(rotateOrientation(0, 90)).toBe(6);
      expect(rotateOrientation(undefined, 270)).toBe(8);
    });

    test('refuses anything but quarter turns', () => {
      expect(() => rotateOrientation(1, 45)).toThrow(/quarter/);
    });
  });

  describe('a photo without EXIF', () => {
    test('reads as upright', async () => {
      expect(readOrientation(await photo())).toBe(1);
    });

    test('gets the orientation sharp then reads', async () => {
      const turned = setOrientation(await photo(), 6);

      const metadata = await sharp(turned).metadata();
      expect(metadata.orientation).toBe(6);
      expect(readOrientation(turned)).toBe(6);
      // Shown upright it is now a portrait
      const { info } = await sharp(turned).rotate().toBuffer({ resolveWithObject: true });
      expect([info.width, info.height]).toEqual([20, 40]);
    });

    test('keeps the image data byte for byte', async () => {
      const original = await photo();
      expect(imageData(setOrientation(original, 8)).equals(imageData(original))).toBe(true);
    });

    test('does not change the buffer it was given', async () => {
      const original = await photo();
      const copy = Buffer.from(original);
      setOrientation(original, 3);
      expect(original.equals(copy)).toBe(true);
    });
  });

  describe('a photo with an orientation tag', () => {
    test('reads it', async () => {
      expect(readOrientation(await photo({ orientation: 3 }))).toBe(3);
    });

    test('changes it in place, keeping the size', async () => {
      const original = await photo({ orientation: 3 });
      const turned = setOrientation(original, 8);

      expect(turned.length).toBe(original.length);
      expect((await sharp(turned).metadata()).orientation).toBe(8);
      expect(imageData(turned).equals(imageData(original))).toBe(true);
    });
  });

  describe('a photo with EXIF but no orientation tag', () => {
    test('gets the tag and keeps the rest of its EXIF', async () => {
      const original = await photo({ exif: { IFD0: { Copyright: 'IES La Marxadella' } } });
      expect(readOrientation(original)).toBe(1);

      const turned = setOrientation(original, 6);

      const metadata = await sharp(turned).metadata();
      expect(metadata.orientation).toBe(6);
      expect(metadata.exif.includes(Buffer.from('IES La Marxadella'))).toBe(true);
      expect(imageData(turned).equals(imageData(original))).toBe(true);
    });

    test('works with big-endian EXIF too', async () => {
      const original = await bigEndianPhoto();

      const turned = setOrientation(original, 6);

      expect(readOrientation(turned)).toBe(6);
      expect((await sharp(turned).metadata()).orientation).toBe(6);
    });

    test('can be turned again afterwards', async () => {
      const once = setOrientation(await photo({ exif: { IFD0: { Copyright: 'x' } } }), 6);
      const twice = setOrientation(once, 3);
      expect((await sharp(twice).metadata()).orientation).toBe(3);
    });
  });

  test('refuses anything that is not a JPEG', async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'white' } }).png().toBuffer();
    expect(() => setOrientation(png, 6)).toThrow(/JPG/);
    expect(() => readOrientation(Buffer.from('hola'))).toThrow(/JPG/);
  });

  test('refuses an invalid orientation', async () => {
    expect(() => setOrientation(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), 9)).toThrow(/Invalid/);
  });

  describe('rotateImageFile', () => {
    const folder = path.join(os.tmpdir(), 'edu-capture-orientation-tests');

    beforeAll(() => fs.mkdirSync(folder, { recursive: true }));
    afterAll(() => fs.rmSync(folder, { recursive: true, force: true }));

    test('turns the photo on disk and returns its new orientation', async () => {
      const file = path.join(folder, '20260915120000.jpg');
      fs.writeFileSync(file, await photo());

      await expect(rotateImageFile(file, 90)).resolves.toBe(6);
      await expect(rotateImageFile(file, 90)).resolves.toBe(3);
      await expect(rotateImageFile(file, -90)).resolves.toBe(6);

      expect((await sharp(file).metadata()).orientation).toBe(6);
      expect(fs.readdirSync(folder).filter((name) => name.endsWith('.tmp'))).toEqual([]);
    });

    test('leaves a file that is not a JPEG untouched', async () => {
      const file = path.join(folder, 'nota.jpg');
      fs.writeFileSync(file, 'no es una foto');

      await expect(rotateImageFile(file, 90)).rejects.toThrow(/JPG/);
      expect(fs.readFileSync(file, 'utf8')).toBe('no es una foto');
    });
  });
});
