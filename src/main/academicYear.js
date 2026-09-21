/**
 * Academic year of a project
 *
 * The XML names the course by the year it starts: curso="2026" is 2026-2027.
 * A project records it on creation and on every XML update, under the
 * `academicYear` project setting. Card print and publication requests made
 * before the course started are marked as left over from the previous one:
 * the repository, and the request folders in it, carry over between courses.
 */

// Courses start on 1 September (month index 8)
const COURSE_START_MONTH = 8;

/**
 * Course start year from the XML attribute or the stored setting
 * @param {*} value
 * @returns {number|null} null when missing or not a plausible year
 */
function parseAcademicYear(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  if (!/^\d{4}$/.test(text)) {
    return null;
  }
  const year = Number(text);
  return year >= 2000 && year <= 2999 ? year : null;
}

/**
 * Course running on a given day, for projects that never recorded theirs
 * @param {Date} date
 * @returns {number}
 */
function academicYearOn(date) {
  return date.getMonth() >= COURSE_START_MONTH ? date.getFullYear() : date.getFullYear() - 1;
}

/**
 * First moment of the course, local time
 * @param {number} year - Course start year
 * @returns {Date}
 */
function academicYearStart(year) {
  return new Date(year, COURSE_START_MONTH, 1);
}

/**
 * How the interface names a course: 2026 → "2026-2027"
 * @param {number} year
 * @returns {string}
 */
function formatAcademicYear(year) {
  return `${year}-${year + 1}`;
}

/**
 * When a request file was last made, from its stats
 *
 * The modification time is when it was requested, and requesting again
 * refreshes it. But a publication request is a copy of the photo, and before
 * requests were stamped a copy kept the photo's own date, so the creation time
 * is taken when later. On a computer that received the file through the sync
 * client, creation is when it arrived: later than the request, never earlier.
 * Either way the error can only make an old request look current, never the
 * reverse, so nothing current is marked as left over.
 *
 * @param {import('fs').Stats} stats
 * @returns {number} milliseconds since the epoch
 */
function requestTime(stats) {
  return Math.max(stats.mtimeMs || 0, stats.birthtimeMs || 0);
}

module.exports = {
  parseAcademicYear,
  academicYearOn,
  academicYearStart,
  formatAcademicYear,
  requestTime
};
