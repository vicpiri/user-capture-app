/**
 * Academic year tests
 *
 * The course decides which card print and publication requests are shown as
 * left over from the previous one. Getting the year or its first day wrong
 * would mark a whole course of requests, or none of them.
 *
 * @jest-environment node
 */

const {
  parseAcademicYear,
  academicYearOn,
  academicYearStart,
  formatAcademicYear,
  requestTime
} = require('../../../src/main/academicYear');

describe('academicYear', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  describe('parseAcademicYear', () => {
    test('should read the year the XML gives', () => {
      expect(parseAcademicYear('2026')).toBe(2026);
      expect(parseAcademicYear(' 2026 ')).toBe(2026);
      expect(parseAcademicYear(2026)).toBe(2026);
    });

    test('should give nothing for a missing or unusable value', () => {
      expect(parseAcademicYear(undefined)).toBeNull();
      expect(parseAcademicYear(null)).toBeNull();
      expect(parseAcademicYear('')).toBeNull();
      expect(parseAcademicYear('2026-2027')).toBeNull();
      expect(parseAcademicYear('26')).toBeNull();
      expect(parseAcademicYear('1066')).toBeNull();
    });
  });

  describe('academicYearOn', () => {
    test('should start the course in September', () => {
      expect(academicYearOn(new Date(2026, 8, 1))).toBe(2026);
      expect(academicYearOn(new Date(2026, 11, 31))).toBe(2026);
    });

    test('should keep the previous course until the end of August', () => {
      expect(academicYearOn(new Date(2026, 7, 31))).toBe(2025);
      expect(academicYearOn(new Date(2027, 0, 15))).toBe(2026);
    });
  });

  test('academicYearStart should be 1 September of the start year', () => {
    const start = academicYearStart(2026);

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(8);
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
  });

  test('formatAcademicYear should name the course by both years', () => {
    expect(formatAcademicYear(2026)).toBe('2026-2027');
  });

  describe('requestTime', () => {
    test('should take the later of modification and creation', () => {
      expect(requestTime({ mtimeMs: 100, birthtimeMs: 50 })).toBe(100);
      expect(requestTime({ mtimeMs: 50, birthtimeMs: 100 })).toBe(100);
    });

    test('should cope with a file system that does not report creation', () => {
      expect(requestTime({ mtimeMs: 100 })).toBe(100);
    });
  });
});
