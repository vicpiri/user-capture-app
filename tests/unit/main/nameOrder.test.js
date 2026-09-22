/**
 * Alphabetical order of people
 *
 * @jest-environment node
 */

const { compareText, compareUsersByName } = require('../../../src/main/utils/nameOrder');

describe('nameOrder', () => {
  const sortText = (list) => [...list].sort(compareText);

  describe('compareText()', () => {
    test('should treat accented letters as plain ones', () => {
      expect(sortText(['Zapata', 'Álvarez', 'Alba', 'Ortiz', 'Óscar'])).toEqual(
        ['Alba', 'Álvarez', 'Ortiz', 'Óscar', 'Zapata']
      );
      expect(compareText('Álvarez', 'Alvarez')).toBe(0);
    });

    test('should ignore case', () => {
      expect(compareText('GARCÍA', 'garcia')).toBe(0);
      expect(sortText(['beltrán', 'ALBA'])).toEqual(['ALBA', 'beltrán']);
    });

    test('should put Ñ as a letter of its own between N and O', () => {
      expect(sortText(['Muoz', 'Muñoz', 'Munzón', 'Muñiz', 'Munoz'])).toEqual(
        ['Munoz', 'Munzón', 'Muñiz', 'Muñoz', 'Muoz']
      );
      expect(sortText(['Ortiz', 'Ñúñez', 'Nuñez'])).toEqual(['Nuñez', 'Ñúñez', 'Ortiz']);
    });

    test('should skip spaces and hyphens', () => {
      expect(compareText('De la Fuente', 'Delafuente')).toBe(0);
      expect(compareText('García-Pérez', 'Garcia Perez')).toBe(0);
      expect(sortText(['Delgado', 'de la Fuente', 'Dea'])).toEqual(['Dea', 'de la Fuente', 'Delgado']);
    });

    test('should put an empty value first', () => {
      expect(sortText(['Ruiz', '', null, 'Abad'])).toEqual(['', null, 'Abad', 'Ruiz']);
    });
  });

  describe('compareUsersByName()', () => {
    const user = (last_name1, last_name2, first_name) => ({ last_name1, last_name2, first_name });
    const names = (users) => [...users].sort(compareUsersByName).map(u => u.first_name);

    test('should go by first surname, then second surname, then name', () => {
      expect(names([
        user('Pérez', 'Ruiz', 'Carlos'),
        user('Pérez', 'López', 'Zoe'),
        user('Abad', 'Zamora', 'Luis'),
        user('Pérez', 'Ruiz', 'Álex')
      ])).toEqual(['Luis', 'Zoe', 'Álex', 'Carlos']);
    });

    test('should not let a longer surname jump ahead', () => {
      // Each field is compared on its own, not the full name joined together
      expect(names([user('Garcia', 'Zapata', 'A'), user('Garciaa', 'Abad', 'B')])).toEqual(['A', 'B']);
    });
  });
});
