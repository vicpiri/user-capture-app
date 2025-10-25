/**
 * Formatters Utilities
 *
 * Common formatting functions for dates, names, files, etc.
 *
 * @module utils/formatters
 */

/**
 * Format ISO date to Spanish format (DD/MM/YYYY)
 * @param {string} isoDate - ISO date string (YYYY-MM-DD)
 * @returns {string} Formatted date
 */
function formatISODateToSpanish(isoDate) {
  if (!isoDate) return '';

  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;

  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

/**
 * Format Spanish date to ISO (YYYY-MM-DD)
 * @param {string} spanishDate - Spanish date (DD/MM/YYYY)
 * @returns {string} ISO date string
 */
function formatSpanishDateToISO(spanishDate) {
  if (!spanishDate) return '';

  const parts = spanishDate.split('/');
  if (parts.length !== 3) return spanishDate;

  const [day, month, year] = parts;
  return `${year}-${month}-${day}`;
}

/**
 * Format date to timestamp filename (YYYYMMDDHHMMSS)
 * @param {Date} date - Date object (default: now)
 * @returns {string} Timestamp string
 */
function formatDateToTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * Format filename for export (remove invalid characters)
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  if (!filename) return '';

  // Remove invalid characters for filenames
  return filename
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

/**
 * Format full name (nombre + apellido1 + apellido2)
 * @param {object} user - User object
 * @returns {string} Full name
 */
function formatFullName(user) {
  if (!user) return '';

  const parts = [
    user.nombre,
    user.apellido1,
    user.apellido2
  ].filter(Boolean);

  return parts.join(' ');
}

/**
 * Format lastname (apellido1 + apellido2)
 * @param {object} user - User object
 * @returns {string} Lastname
 */
function formatLastname(user) {
  if (!user) return '';

  const parts = [
    user.apellido1,
    user.apellido2
  ].filter(Boolean);

  return parts.join(' ');
}

/**
 * Format user ID for export (NIA or DNI)
 * @param {object} user - User object
 * @returns {string} ID
 */
function formatUserId(user) {
  if (!user) return '';
  return user.nia || user.documento || '';
}

/**
 * Calculate age from birth date
 * @param {string} birthDate - Birth date (ISO or Spanish format)
 * @returns {number|null} Age in years
 */
function calculateAge(birthDate) {
  if (!birthDate) return null;

  // Convert to ISO if Spanish format
  if (birthDate.includes('/')) {
    birthDate = formatSpanishDateToISO(birthDate);
  }

  const birth = new Date(birthDate);
  const today = new Date();

  if (isNaN(birth.getTime())) return null;

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

/**
 * Check if user is adult (18+)
 * @param {string} birthDate - Birth date
 * @returns {boolean}
 */
function isAdult(birthDate) {
  const age = calculateAge(birthDate);
  return age !== null && age >= 18;
}

/**
 * Format file size to human readable
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format user type (Alumno, Profesor, No Docente)
 * @param {object} user - User object
 * @returns {string} User type
 */
function formatUserType(user) {
  if (!user) return '';

  if (user.grupo_codigo && user.grupo_codigo.startsWith('Docente')) {
    return 'Profesor';
  }

  if (user.grupo_codigo && user.grupo_codigo.startsWith('No Docente')) {
    return 'Profesor';
  }

  return 'Alumno';
}

/**
 * Format age category for export (mayor.jpg, menor.jpg, profesor.jpg)
 * @param {object} user - User object
 * @returns {string} Age category filename
 */
function formatAgeCategory(user) {
  if (!user) return 'profesor.jpg';

  const userType = formatUserType(user);

  if (userType === 'Profesor') {
    return 'profesor.jpg';
  }

  return isAdult(user.fecha_nac) ? 'mayor.jpg' : 'menor.jpg';
}

/**
 * Format image filename for export (ID.jpg or nombre_apellidos.jpg)
 * @param {object} user - User object
 * @param {string} format - 'id' or 'name'
 * @returns {string} Filename
 */
function formatImageFilename(user, format = 'id') {
  if (!user) return '';

  if (format === 'id') {
    const id = formatUserId(user);
    return id ? `${id}.jpg` : '';
  }

  if (format === 'name') {
    const fullName = formatFullName(user);
    return fullName ? `${sanitizeFilename(fullName)}.jpg` : '';
  }

  return '';
}

// Export all functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
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
  };
}
