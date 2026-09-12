/**
 * Image protocol tests
 *
 * The handler reads files off disk on behalf of the renderer, so the check that
 * confines it to project folders is the part worth pinning down.
 *
 * @jest-environment node
 */

const path = require('path');

// The module pulls in electron, which is not available under Jest
jest.mock('electron', () => ({
  protocol: {
    registerSchemesAsPrivileged: jest.fn(),
    handle: jest.fn()
  }
}));

const { isInsideAllowedRoot, SCHEME } = require('../../../src/main/protocol/imageProtocol');

describe('image protocol', () => {
  const imports = path.join('D:', 'Proyecto', 'imports');
  const mirror = path.join('C:', 'Users', 'someone', 'AppData', 'repository-mirror');
  const roots = [imports, mirror];

  test('should use a dedicated scheme', () => {
    expect(SCHEME).toBe('app-img');
  });

  describe('isInsideAllowedRoot()', () => {
    test('should allow a file directly inside a root', () => {
      expect(isInsideAllowedRoot(path.join(imports, '1234.jpg'), roots)).toBe(true);
    });

    test('should allow a file in a nested folder', () => {
      expect(isInsideAllowedRoot(path.join(imports, '1ESO', '1234.jpg'), roots)).toBe(true);
    });

    test('should allow any of the roots', () => {
      expect(isInsideAllowedRoot(path.join(mirror, '1234.jpg'), roots)).toBe(true);
    });

    test('should ignore case, as Windows paths do', () => {
      expect(isInsideAllowedRoot(path.join(imports.toUpperCase(), '1234.JPG'), roots)).toBe(true);
    });

    test('should refuse a path outside every root', () => {
      expect(isInsideAllowedRoot(path.join('C:', 'Windows', 'secret.jpg'), roots)).toBe(false);
    });

    test('should refuse an escape through a parent segment', () => {
      const escaped = path.join(imports, '..', '..', 'private', 'secret.jpg');

      expect(isInsideAllowedRoot(escaped, roots)).toBe(false);
    });

    test('should refuse a sibling folder sharing the root prefix', () => {
      // "imports-backup" starts with "imports" but is a different folder
      expect(isInsideAllowedRoot(`${imports}-backup\\1234.jpg`, roots)).toBe(false);
    });

    test('should refuse everything when no project is open', () => {
      expect(isInsideAllowedRoot(path.join(imports, '1234.jpg'), [])).toBe(false);
    });

    test('should skip roots that are not set', () => {
      expect(isInsideAllowedRoot(path.join(imports, '1234.jpg'), [null, undefined, imports])).toBe(true);
      expect(isInsideAllowedRoot(path.join(imports, '1234.jpg'), [null, undefined])).toBe(false);
    });
  });
});
