/**
 * Alphabetical order of people, shared by every listing
 *
 * First surname, then second surname, then first name. Within each field,
 * accents and case do not count, Ñ is a letter of its own between N and O,
 * and spaces, hyphens and other punctuation are skipped, so "De la Fuente"
 * sorts as "delafuente". SQLite's ORDER BY compares bytes instead, which put
 * "Álvarez" after "Zapata".
 */

const collator = new Intl.Collator('es', { sensitivity: 'base', ignorePunctuation: true });

/**
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 * @returns {number}
 */
function compareText(a, b) {
  return collator.compare(a || '', b || '');
}

/**
 * Comparator for Array.prototype.sort on user rows
 * @param {{last_name1?: string, last_name2?: string, first_name?: string}} a
 * @param {{last_name1?: string, last_name2?: string, first_name?: string}} b
 * @returns {number}
 */
function compareUsersByName(a, b) {
  return compareText(a.last_name1, b.last_name1)
    || compareText(a.last_name2, b.last_name2)
    || compareText(a.first_name, b.first_name);
}

module.exports = { compareText, compareUsersByName };
