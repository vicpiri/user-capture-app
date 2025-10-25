/**
 * Tests for Formatters Utilities
 */

const {
  formatISODateToSpanish,
  formatSpanishDateToISO,
  formatDateToTimestamp,
  sanitizeFilename,
  formatFullName,
  formatLastname,
  formatUserId,
  calculateAge,
  isAdult,
  formatFileSize,
  formatUserType,
  formatAgeCategory,
  formatImageFilename
} = require('../../../src/renderer/utils/formatters');

describe('Formatters Utilities', () => {
  describe('formatISODateToSpanish', () => {
    test('should convert ISO date to Spanish format', () => {
      expect(formatISODateToSpanish('2024-03-15')).toBe('15/03/2024');
      expect(formatISODateToSpanish('2000-01-01')).toBe('01/01/2000');
    });

    test('should return empty string for null/undefined', () => {
      expect(formatISODateToSpanish(null)).toBe('');
      expect(formatISODateToSpanish(undefined)).toBe('');
      expect(formatISODateToSpanish('')).toBe('');
    });

    test('should return original string if invalid format', () => {
      expect(formatISODateToSpanish('invalid')).toBe('invalid');
      expect(formatISODateToSpanish('15/03/2024')).toBe('15/03/2024');
    });
  });

  describe('formatSpanishDateToISO', () => {
    test('should convert Spanish date to ISO format', () => {
      expect(formatSpanishDateToISO('15/03/2024')).toBe('2024-03-15');
      expect(formatSpanishDateToISO('01/01/2000')).toBe('2000-01-01');
    });

    test('should return empty string for null/undefined', () => {
      expect(formatSpanishDateToISO(null)).toBe('');
      expect(formatSpanishDateToISO(undefined)).toBe('');
      expect(formatSpanishDateToISO('')).toBe('');
    });

    test('should return original string if invalid format', () => {
      expect(formatSpanishDateToISO('invalid')).toBe('invalid');
      expect(formatSpanishDateToISO('2024-03-15')).toBe('2024-03-15');
    });
  });

  describe('formatDateToTimestamp', () => {
    test('should format date to timestamp string', () => {
      const date = new Date('2024-03-15T10:30:45');
      const timestamp = formatDateToTimestamp(date);

      expect(timestamp).toMatch(/^\d{14}$/);
      expect(timestamp.length).toBe(14);
    });

    test('should use current date if no date provided', () => {
      const timestamp = formatDateToTimestamp();

      expect(timestamp).toMatch(/^\d{14}$/);
      expect(timestamp.length).toBe(14);
    });
  });

  describe('sanitizeFilename', () => {
    test('should remove invalid filename characters', () => {
      expect(sanitizeFilename('test<file>name')).toBe('testfilename');
      expect(sanitizeFilename('file:name')).toBe('filename');
      expect(sanitizeFilename('file/name')).toBe('filename');
    });

    test('should replace spaces with underscores', () => {
      expect(sanitizeFilename('test file name')).toBe('test_file_name');
    });

    test('should return empty string for null/undefined', () => {
      expect(sanitizeFilename(null)).toBe('');
      expect(sanitizeFilename(undefined)).toBe('');
      expect(sanitizeFilename('')).toBe('');
    });
  });

  describe('formatFullName', () => {
    test('should format full name with all parts', () => {
      const user = {
        nombre: 'Juan',
        apellido1: 'García',
        apellido2: 'López'
      };

      expect(formatFullName(user)).toBe('Juan García López');
    });

    test('should handle missing apellido2', () => {
      const user = {
        nombre: 'Juan',
        apellido1: 'García'
      };

      expect(formatFullName(user)).toBe('Juan García');
    });

    test('should return empty string for null/undefined', () => {
      expect(formatFullName(null)).toBe('');
      expect(formatFullName(undefined)).toBe('');
    });
  });

  describe('formatLastname', () => {
    test('should format lastname with both apellidos', () => {
      const user = {
        apellido1: 'García',
        apellido2: 'López'
      };

      expect(formatLastname(user)).toBe('García López');
    });

    test('should handle missing apellido2', () => {
      const user = {
        apellido1: 'García'
      };

      expect(formatLastname(user)).toBe('García');
    });
  });

  describe('formatUserId', () => {
    test('should return NIA if available', () => {
      const user = {
        nia: '12345678',
        documento: '87654321X'
      };

      expect(formatUserId(user)).toBe('12345678');
    });

    test('should return documento if no NIA', () => {
      const user = {
        documento: '87654321X'
      };

      expect(formatUserId(user)).toBe('87654321X');
    });

    test('should return empty string if no ID', () => {
      expect(formatUserId({})).toBe('');
      expect(formatUserId(null)).toBe('');
    });
  });

  describe('calculateAge', () => {
    test('should calculate age from ISO date', () => {
      const birthDate = '2000-01-01';
      const age = calculateAge(birthDate);

      expect(age).toBeGreaterThanOrEqual(24);
      expect(age).toBeLessThanOrEqual(25);
    });

    test('should calculate age from Spanish date', () => {
      const birthDate = '01/01/2000';
      const age = calculateAge(birthDate);

      expect(age).toBeGreaterThanOrEqual(24);
      expect(age).toBeLessThanOrEqual(25);
    });

    test('should return null for invalid date', () => {
      expect(calculateAge('invalid')).toBeNull();
      expect(calculateAge(null)).toBeNull();
      expect(calculateAge('')).toBeNull();
    });
  });

  describe('isAdult', () => {
    test('should return true for adult (18+)', () => {
      const birthDate = '2000-01-01';
      expect(isAdult(birthDate)).toBe(true);
    });

    test('should return false for minor', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());
      const isoDate = birthDate.toISOString().split('T')[0];

      expect(isAdult(isoDate)).toBe(false);
    });

    test('should return false for invalid date', () => {
      expect(isAdult('invalid')).toBe(false);
      expect(isAdult(null)).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    test('should format bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(500)).toBe('500 Bytes');
    });

    test('should format KB', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(2048)).toBe('2 KB');
    });

    test('should format MB', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
    });

    test('should format GB', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('formatUserType', () => {
    test('should return "Profesor" for docentes', () => {
      const user = {
        grupo_codigo: 'Docentes'
      };

      expect(formatUserType(user)).toBe('Profesor');
    });

    test('should return "Profesor" for no docentes', () => {
      const user = {
        grupo_codigo: 'No Docentes'
      };

      expect(formatUserType(user)).toBe('Profesor');
    });

    test('should return "Alumno" for students', () => {
      const user = {
        grupo_codigo: '1ESO-A'
      };

      expect(formatUserType(user)).toBe('Alumno');
    });

    test('should return empty string for null', () => {
      expect(formatUserType(null)).toBe('');
    });
  });

  describe('formatAgeCategory', () => {
    test('should return "profesor.jpg" for professors', () => {
      const user = {
        grupo_codigo: 'Docentes'
      };

      expect(formatAgeCategory(user)).toBe('profesor.jpg');
    });

    test('should return "mayor.jpg" for adult students', () => {
      const user = {
        grupo_codigo: '1ESO-A',
        fecha_nac: '2000-01-01'
      };

      expect(formatAgeCategory(user)).toBe('mayor.jpg');
    });

    test('should return "menor.jpg" for minor students', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 10, 0, 1);
      const isoDate = birthDate.toISOString().split('T')[0];

      const user = {
        grupo_codigo: '1ESO-A',
        fecha_nac: isoDate
      };

      expect(formatAgeCategory(user)).toBe('menor.jpg');
    });
  });

  describe('formatImageFilename', () => {
    test('should format with ID', () => {
      const user = {
        nia: '12345678',
        nombre: 'Juan',
        apellido1: 'García'
      };

      expect(formatImageFilename(user, 'id')).toBe('12345678.jpg');
    });

    test('should format with name', () => {
      const user = {
        nombre: 'Juan',
        apellido1: 'García',
        apellido2: 'López'
      };

      expect(formatImageFilename(user, 'name')).toBe('Juan_García_López.jpg');
    });

    test('should return empty string for null user', () => {
      expect(formatImageFilename(null, 'id')).toBe('');
      expect(formatImageFilename(null, 'name')).toBe('');
    });
  });
});
