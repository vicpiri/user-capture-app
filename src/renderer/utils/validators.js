/**
 * Validators Utilities
 *
 * Common validation functions for user input, files, etc.
 *
 * @module utils/validators
 */

/**
 * Validate email address
 * @param {string} email - Email address
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate Spanish DNI
 * @param {string} dni - DNI number
 * @returns {boolean}
 */
function isValidDNI(dni) {
  if (!dni) return false;

  const dniRegex = /^[0-9]{8}[A-Z]$/;
  if (!dniRegex.test(dni)) return false;

  const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
  const number = parseInt(dni.substr(0, 8), 10);
  const letter = dni.charAt(8);

  return letters.charAt(number % 23) === letter;
}

/**
 * Validate date string (ISO format YYYY-MM-DD)
 * @param {string} dateString - Date string
 * @returns {boolean}
 */
function isValidISODate(dateString) {
  if (!dateString) return false;

  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDateRegex.test(dateString)) return false;

  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Validate Spanish date format (DD/MM/YYYY)
 * @param {string} dateString - Date string
 * @returns {boolean}
 */
function isValidSpanishDate(dateString) {
  if (!dateString) return false;

  const spanishDateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!spanishDateRegex.test(dateString)) return false;

  const [day, month, year] = dateString.split('/').map(Number);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > 2100) return false;

  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
         date.getMonth() === month - 1 &&
         date.getDate() === day;
}

/**
 * Validate image file extension
 * @param {string} filename - Filename
 * @returns {boolean}
 */
function isValidImageFile(filename) {
  if (!filename) return false;

  const validExtensions = ['.jpg', '.jpeg', '.png'];
  const extension = filename.toLowerCase().slice(filename.lastIndexOf('.'));

  return validExtensions.includes(extension);
}

/**
 * Validate JPG file extension
 * @param {string} filename - Filename
 * @returns {boolean}
 */
function isValidJPGFile(filename) {
  if (!filename) return false;

  const extension = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return extension === '.jpg' || extension === '.jpeg';
}

/**
 * Validate file size (max 5MB)
 * @param {number} sizeInBytes - File size in bytes
 * @param {number} maxSizeMB - Max size in MB (default: 5)
 * @returns {boolean}
 */
function isValidFileSize(sizeInBytes, maxSizeMB = 5) {
  if (typeof sizeInBytes !== 'number') return false;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return sizeInBytes > 0 && sizeInBytes <= maxSizeBytes;
}

/**
 * Validate required fields in object
 * @param {object} obj - Object to validate
 * @param {string[]} requiredFields - Array of required field names
 * @returns {object} { valid: boolean, missing: string[] }
 */
function validateRequiredFields(obj, requiredFields) {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, missing: requiredFields };
  }

  const missing = requiredFields.filter(field => {
    const value = obj[field];
    return value === undefined || value === null || value === '';
  });

  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Validate user object has required fields
 * @param {object} user - User object
 * @returns {object} { valid: boolean, missing: string[] }
 */
function validateUser(user) {
  const requiredFields = ['nombre', 'apellido1', 'documento'];
  return validateRequiredFields(user, requiredFields);
}

/**
 * Validate group object has required fields
 * @param {object} group - Group object
 * @returns {object} { valid: boolean, missing: string[] }
 */
function validateGroup(group) {
  const requiredFields = ['codigo', 'nombre'];
  return validateRequiredFields(group, requiredFields);
}

/**
 * Validate project data
 * @param {object} projectData - Project data
 * @returns {object} { valid: boolean, missing: string[] }
 */
function validateProject(projectData) {
  const requiredFields = ['folderPath', 'xmlFilePath'];
  return validateRequiredFields(projectData, requiredFields);
}

/**
 * Sanitize user input (prevent XSS)
 * @param {string} input - User input
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
  if (!input) return '';

  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate search term (min 2 characters, max 50)
 * @param {string} searchTerm - Search term
 * @returns {boolean}
 */
function isValidSearchTerm(searchTerm) {
  if (!searchTerm) return false;
  const trimmed = searchTerm.trim();
  return trimmed.length >= 2 && trimmed.length <= 50;
}

/**
 * Validate NIA (Número de Identificación del Alumno)
 * @param {string} nia - NIA number
 * @returns {boolean}
 */
function isValidNIA(nia) {
  if (!nia) return false;
  // NIA is typically 8-10 digits
  const niaRegex = /^[0-9]{8,10}$/;
  return niaRegex.test(nia);
}

// Export all functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isValidEmail,
    isValidDNI,
    isValidISODate,
    isValidSpanishDate,
    isValidImageFile,
    isValidJPGFile,
    isValidFileSize,
    validateRequiredFields,
    validateUser,
    validateGroup,
    validateProject,
    sanitizeInput,
    isValidSearchTerm,
    isValidNIA
  };
}
