/**
 * Image orientation - read and change the EXIF orientation of a JPEG
 *
 * A photo is turned by changing the orientation tag of its EXIF data, not its
 * pixels: nothing is compressed again, so no quality is lost, and it takes no
 * time. Everything in the app already honours the tag (Chromium in the viewer,
 * sharp's rotate() in thumbnails, exports and the orla), and exports write the
 * photos upright.
 *
 * Only the EXIF segment is touched; the image data is copied byte for byte.
 * A JPEG without EXIF gets a minimal one; one with EXIF keeps every other tag.
 *
 * EXIF orientation values, read as "mirror first (or not), then turn clockwise":
 *   1: 0°   6: 90°   3: 180°   8: 270°
 *   2: mirrored 0°   7: mirrored 90°   4: mirrored 180°   5: mirrored 270°
 */

const fs = require('fs');
const path = require('path');

const ORIENTATION_TAG = 0x0112;
const TYPE_SHORT = 3;
const EXIF_HEADER = Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]); // "Exif" and two zero bytes
const MAX_SEGMENT_LENGTH = 0xffff;

// orientation -> [mirrored, clockwise degrees], and back
const TRANSFORMS = {
  1: [false, 0], 6: [false, 90], 3: [false, 180], 8: [false, 270],
  2: [true, 0], 7: [true, 90], 4: [true, 180], 5: [true, 270]
};

/**
 * The orientation after turning a photo further
 * @param {number} orientation - current EXIF orientation (1-8; anything else is 1)
 * @param {number} degrees - clockwise; negative turns to the left
 * @returns {number} the new EXIF orientation
 */
function rotateOrientation(orientation, degrees) {
  const [mirrored, turned] = TRANSFORMS[orientation] || TRANSFORMS[1];
  const total = (((turned + degrees) % 360) + 360) % 360;
  if (total % 90 !== 0) {
    throw new Error(`Only quarter turns are possible, not ${degrees}°`);
  }
  return Number(Object.keys(TRANSFORMS).find((key) => {
    const [m, t] = TRANSFORMS[key];
    return m === mirrored && t === total;
  }));
}

/**
 * @private
 * @returns {{ start: number, end: number, tiff: number, little: boolean }|null}
 *   the APP1 EXIF segment: its marker, its end and the start of its TIFF data
 */
function findExifSegment(buffer) {
  let offset = 2;
  while (offset + 4 <= buffer.length && buffer[offset] === 0xff) {
    const marker = buffer[offset + 1];
    // Start of scan: the image data follows, no more metadata
    if (marker === 0xda || marker === 0xd9) break;
    const length = buffer.readUInt16BE(offset + 2);
    if (marker === 0xe1 && buffer.slice(offset + 4, offset + 10).equals(EXIF_HEADER)) {
      const tiff = offset + 10;
      const order = buffer.toString('latin1', tiff, tiff + 2);
      if (order !== 'II' && order !== 'MM') return null;
      return { start: offset, end: offset + 2 + length, tiff, little: order === 'II' };
    }
    offset += 2 + length;
  }
  return null;
}

function assertJpeg(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error('Solo se pueden girar fotos JPG');
  }
}

/**
 * @private
 * Reader and writer for the TIFF data of an EXIF segment
 */
function tiffAccess(buffer, segment) {
  const { tiff, little } = segment;
  return {
    u16: (at) => (little ? buffer.readUInt16LE(tiff + at) : buffer.readUInt16BE(tiff + at)),
    u32: (at) => (little ? buffer.readUInt32LE(tiff + at) : buffer.readUInt32BE(tiff + at)),
    setU16: (at, value) => (little ? buffer.writeUInt16LE(value, tiff + at) : buffer.writeUInt16BE(value, tiff + at)),
    setU32: (at, value) => (little ? buffer.writeUInt32LE(value, tiff + at) : buffer.writeUInt32BE(value, tiff + at))
  };
}

/**
 * The EXIF orientation of a JPEG; 1 when it has none
 * @param {Buffer} buffer
 * @returns {number}
 */
function readOrientation(buffer) {
  assertJpeg(buffer);
  const segment = findExifSegment(buffer);
  if (!segment) return 1;
  const tiff = tiffAccess(buffer, segment);
  const ifd = tiff.u32(4);
  const count = tiff.u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (tiff.u16(entry) === ORIENTATION_TAG) {
      const value = tiff.u16(entry + 8);
      return TRANSFORMS[value] ? value : 1;
    }
  }
  return 1;
}

/**
 * A copy of the JPEG with the given EXIF orientation
 * @param {Buffer} buffer
 * @param {number} orientation - 1 to 8
 * @returns {Buffer}
 */
function setOrientation(buffer, orientation) {
  assertJpeg(buffer);
  if (!TRANSFORMS[orientation]) {
    throw new Error(`Invalid EXIF orientation: ${orientation}`);
  }

  const segment = findExifSegment(buffer);
  if (!segment) {
    return insertExifSegment(buffer, orientation);
  }

  const output = Buffer.from(buffer);
  const tiff = tiffAccess(output, segment);
  const ifd = tiff.u32(4);
  const count = tiff.u16(ifd);

  // The usual case: the tag is there, and only its value changes
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (tiff.u16(entry) === ORIENTATION_TAG) {
      // A single SHORT, which goes in the first two bytes of the value field
      tiff.setU16(entry + 2, TYPE_SHORT);
      tiff.setU32(entry + 4, 1);
      tiff.setU32(entry + 8, 0);
      tiff.setU16(entry + 8, orientation);
      return output;
    }
  }

  return addOrientationEntry(buffer, segment, orientation);
}

/**
 * EXIF without an orientation tag: a copy of the first directory, with the
 * tag added, goes at the end of the EXIF data and the header points to it.
 * Nothing already there moves, so every offset in it stays valid; the old
 * directory is left unused.
 * @private
 */
function addOrientationEntry(buffer, segment, orientation) {
  const tiff = tiffAccess(buffer, segment);
  const little = segment.little;
  const ifd = tiff.u32(4);
  const count = tiff.u16(ifd);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const at = segment.tiff + ifd + 2 + i * 12;
    entries.push(Buffer.from(buffer.slice(at, at + 12)));
  }
  const next = tiff.u32(ifd + 2 + count * 12);

  const entry = Buffer.alloc(12);
  const u16 = (buf, value, at) => (little ? buf.writeUInt16LE(value, at) : buf.writeUInt16BE(value, at));
  const u32 = (buf, value, at) => (little ? buf.writeUInt32LE(value, at) : buf.writeUInt32BE(value, at));
  u16(entry, ORIENTATION_TAG, 0);
  u16(entry, TYPE_SHORT, 2);
  u32(entry, 1, 4);
  u16(entry, orientation, 8);

  // Tags go in ascending order
  const tagOf = (buf) => (little ? buf.readUInt16LE(0) : buf.readUInt16BE(0));
  const position = entries.findIndex((existing) => tagOf(existing) > ORIENTATION_TAG);
  entries.splice(position === -1 ? entries.length : position, 0, entry);

  const tiffData = buffer.slice(segment.tiff, segment.end);
  const padding = tiffData.length % 2; // directories start on a word boundary
  const newIfdOffset = tiffData.length + padding;
  const directory = Buffer.alloc(2 + entries.length * 12 + 4);
  u16(directory, entries.length, 0);
  entries.forEach((existing, i) => existing.copy(directory, 2 + i * 12));
  u32(directory, next, 2 + entries.length * 12);

  const newTiff = Buffer.concat([tiffData, Buffer.alloc(padding), directory]);
  u32(newTiff, newIfdOffset, 4);

  const segmentLength = 2 + EXIF_HEADER.length + newTiff.length;
  if (segmentLength > MAX_SEGMENT_LENGTH) {
    throw new Error('Los datos EXIF de la foto son demasiado grandes para añadir la orientación');
  }
  const header = Buffer.alloc(4);
  header.writeUInt16BE(0xffe1, 0);
  header.writeUInt16BE(segmentLength, 2);

  return Buffer.concat([
    buffer.slice(0, segment.start),
    header,
    EXIF_HEADER,
    newTiff,
    buffer.slice(segment.end)
  ]);
}

/**
 * A JPEG without EXIF gets a minimal segment holding only the orientation,
 * after the JFIF header if there is one
 * @private
 */
function insertExifSegment(buffer, orientation) {
  const tiff = Buffer.alloc(8 + 2 + 12 + 4);
  tiff.write('II', 0, 'latin1');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(ORIENTATION_TAG, 10);
  tiff.writeUInt16LE(TYPE_SHORT, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt16LE(orientation, 18);
  tiff.writeUInt32LE(0, 22);

  const header = Buffer.alloc(4);
  header.writeUInt16BE(0xffe1, 0);
  header.writeUInt16BE(2 + EXIF_HEADER.length + tiff.length, 2);
  const segment = Buffer.concat([header, EXIF_HEADER, tiff]);

  let insertAt = 2;
  if (buffer[2] === 0xff && buffer[3] === 0xe0) {
    insertAt = 4 + buffer.readUInt16BE(4);
  }
  return Buffer.concat([buffer.slice(0, insertAt), segment, buffer.slice(insertAt)]);
}

/**
 * Turn a photo on disk by a quarter turn, or several
 *
 * Written under a temporary name and renamed over the original, so a failure
 * halfway never leaves a truncated photo. The new modification time is what
 * makes the thumbnail cache draw it again.
 *
 * @param {string} filePath
 * @param {number} degrees - clockwise; negative turns to the left
 * @returns {Promise<number>} the new EXIF orientation
 */
async function rotateImageFile(filePath, degrees) {
  const buffer = await fs.promises.readFile(filePath);
  const orientation = rotateOrientation(readOrientation(buffer), degrees);
  const output = setOrientation(buffer, orientation);

  const temp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.tmp`);
  try {
    await fs.promises.writeFile(temp, output);
    await fs.promises.rename(temp, filePath);
  } catch (error) {
    await fs.promises.rm(temp, { force: true }).catch(() => {});
    throw error;
  }
  return orientation;
}

module.exports = {
  readOrientation,
  setOrientation,
  rotateOrientation,
  rotateImageFile
};
