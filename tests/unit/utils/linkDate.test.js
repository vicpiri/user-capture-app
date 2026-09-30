/**
 * Tests for the link date helpers
 *
 * Ver > Ordenar por fecha de enlace is for reviewing whoever just got a photo,
 * so the most recent has to come first and the old links, which have no
 * date, must not push in front of them.
 */

const { linkDate } = require('../../../src/renderer/utils/linkDate');

const user = (id, linkedAt) => ({ id, image_linked_at: linkedAt });
const local = (...parts) => new Date(...parts).toISOString();

describe('linkDate', () => {
  describe('sortUsers()', () => {
    test('should put the most recent link first', () => {
      const users = [
        user(1, '2026-09-20T08:00:00.000Z'),
        user(2, '2026-09-28T10:00:00.000Z'),
        user(3, '2026-09-25T09:30:00.000Z')
      ];

      expect(linkDate.sortUsers(users).map(u => u.id)).toEqual([2, 3, 1]);
    });

    test('should leave the users without a date last, in the order they came', () => {
      const users = [user(1, null), user(2, '2026-09-28T10:00:00.000Z'), user(3, undefined), user(4, '')];

      expect(linkDate.sortUsers(users).map(u => u.id)).toEqual([2, 1, 3, 4]);
    });

    test('should not reorder the array it is given', () => {
      const users = [user(1, null), user(2, '2026-09-28T10:00:00.000Z')];

      linkDate.sortUsers(users);

      expect(users.map(u => u.id)).toEqual([1, 2]);
    });
  });

  describe('format()', () => {
    const now = new Date(2026, 8, 29, 12, 0);

    test('should say "hoy" with the time for a link made today', () => {
      expect(linkDate.format(local(2026, 8, 29, 9, 5), now)).toBe('hoy 09:05');
    });

    test('should say "ayer" for a link made yesterday', () => {
      expect(linkDate.format(local(2026, 8, 28, 17, 45), now)).toBe('ayer 17:45');
    });

    test('should give day, month and time within the same year', () => {
      expect(linkDate.format(local(2026, 1, 3, 8, 0), now)).toBe('03/02 08:00');
    });

    test('should give the full date for another year', () => {
      expect(linkDate.format(local(2025, 11, 31, 23, 59), now)).toBe('31/12/2025');
    });

    test('should work across the turn of the month', () => {
      const firstOfOctober = new Date(2026, 9, 1, 10, 0);

      expect(linkDate.format(local(2026, 8, 30, 18, 0), firstOfOctober)).toBe('ayer 18:00');
    });

    test('should return nothing without a valid date', () => {
      expect(linkDate.format(null, now)).toBe('');
      expect(linkDate.format('', now)).toBe('');
      expect(linkDate.format('not a date', now)).toBe('');
    });
  });

  describe('describe()', () => {
    test('should give the full local date and time', () => {
      expect(linkDate.describe(local(2026, 8, 28, 7, 3))).toBe('Último enlace: 28/09/2026 07:03');
    });

    test('should return nothing without a date', () => {
      expect(linkDate.describe(null)).toBe('');
    });
  });
});
