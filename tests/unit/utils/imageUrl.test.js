/**
 * Tests for the image URL builder
 *
 * These pin down the property that motivated the custom scheme: a path survives
 * the round trip intact, including the characters that silently broke file://
 * URLs before (# truncated the path, % resolved somewhere else).
 */

const { imageUrl } = require('../../../src/renderer/utils/imageUrl');

const pathOf = (url) => new URL(url).searchParams.get('path');
const paramOf = (url, name) => new URL(url).searchParams.get(name);

describe('imageUrl', () => {
  describe('original()', () => {
    test('should build a URL on the app-img scheme', () => {
      const url = imageUrl.original('D:\\Fotos\\1234.jpg');

      expect(url.startsWith('app-img://img/')).toBe(true);
    });

    test('should not request a size', () => {
      expect(paramOf(imageUrl.original('D:\\Fotos\\1234.jpg'), 'size')).toBeNull();
    });

    test('should return an empty string without a path', () => {
      expect(imageUrl.original(null)).toBe('');
      expect(imageUrl.original('')).toBe('');
      expect(imageUrl.original(undefined)).toBe('');
    });
  });

  describe('thumbnail()', () => {
    test('should carry the requested size', () => {
      const url = imageUrl.thumbnail('D:\\Fotos\\1234.jpg', 128);

      expect(paramOf(url, 'size')).toBe('128');
    });

    test('should carry a version when given one', () => {
      expect(paramOf(imageUrl.thumbnail('D:\\Fotos\\1234.jpg', 128, 7), 'v')).toBe('7');
    });

    test('should omit the version when not given one', () => {
      expect(paramOf(imageUrl.thumbnail('D:\\Fotos\\1234.jpg', 128), 'v')).toBeNull();
    });

    test('should produce the same URL for the same inputs', () => {
      const first = imageUrl.thumbnail('D:\\Fotos\\1234.jpg', 128, 2);
      const second = imageUrl.thumbnail('D:\\Fotos\\1234.jpg', 128, 2);

      expect(first).toBe(second);
    });

    test('should change the URL when the version changes', () => {
      const before = imageUrl.thumbnail('D:\\Fotos\\1234.jpg', 128, 1);
      const after = imageUrl.thumbnail('D:\\Fotos\\1234.jpg', 128, 2);

      expect(after).not.toBe(before);
    });
  });

  describe('path encoding', () => {
    // Each of these used to break, or worse resolve to a different file
    const awkwardPaths = [
      ['a hash in a folder name', 'D:\\Curso 2024#2025\\1234.jpg'],
      ['a percent sign', 'D:\\Descuento 50%\\1234.jpg'],
      ['an encoded-looking name', 'D:\\Backup 100%25\\1234.jpg'],
      ['spaces and accents', 'D:\\Colegio Ñuño\\José.jpg'],
      ['a question mark', 'D:/Fotos ?raras/1234.jpg'],
      ['an ampersand', 'D:\\A&B Colegio\\1234.jpg']
    ];

    test.each(awkwardPaths)('should round-trip %s', (_label, filePath) => {
      expect(pathOf(imageUrl.thumbnail(filePath, 128))).toBe(filePath);
    });

    test('should keep a path with a hash from being truncated', () => {
      const url = imageUrl.original('D:\\Curso 2024#2025\\1234.jpg');

      expect(new URL(url).hash).toBe('');
      expect(pathOf(url)).toContain('#2025');
    });

    test('should not confuse a path with the query it travels in', () => {
      const url = imageUrl.thumbnail('D:\\Fotos ?size=999\\1234.jpg', 128);

      expect(paramOf(url, 'size')).toBe('128');
      expect(pathOf(url)).toBe('D:\\Fotos ?size=999\\1234.jpg');
    });
  });

  describe('sizes', () => {
    test('should expose sizes large enough for a scaled display', () => {
      // 32px indicators and 150px grid items, with room for a 2x display
      expect(imageUrl.INDICATOR_SIZE).toBeGreaterThanOrEqual(64);
      expect(imageUrl.GRID_SIZE).toBeGreaterThanOrEqual(300);
    });
  });
});
