/**
 * Link date of the captured photos
 *
 * Ver > Ordenar por fecha de enlace puts the most recently linked users first,
 * so whoever just got a photo can be reviewed right away: request the card or
 * the publication, or spot a photo linked to the wrong person. The date is
 * users.image_linked_at, an ISO string in UTC written by the main process;
 * links made before it existed have none and go last.
 *
 * @module utils/linkDate
 */

(function(global) {
  'use strict';

  const pad = (value) => String(value).padStart(2, '0');

  function parse(linkedAt) {
    if (!linkedAt) return null;
    const date = new Date(linkedAt);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  const linkDate = {
    /**
     * Most recent link first; users without a date keep their order, which
     * is the alphabetical one of the list, after the rest
     * @param {Array} users
     * @returns {Array} A new array
     */
    sortUsers(users) {
      return users.slice().sort((a, b) => {
        const aDate = a.image_linked_at || '';
        const bDate = b.image_linked_at || '';
        if (aDate === bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        // ISO strings in UTC sort as the moments they stand for
        return aDate < bDate ? 1 : -1;
      });
    },

    /**
     * Short, for the row: "hoy 10:42", "ayer 17:05", "28/09 10:42", or the
     * full date for another year
     * @param {string} linkedAt
     * @param {Date} [now]
     * @returns {string} Empty without a valid date
     */
    format(linkedAt, now = new Date()) {
      const date = parse(linkedAt);
      if (!date) return '';

      const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
      if (sameDay(date, now)) return `hoy ${time}`;

      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      if (sameDay(date, yesterday)) return `ayer ${time}`;

      const day = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
      if (date.getFullYear() === now.getFullYear()) return `${day} ${time}`;
      return `${day}/${date.getFullYear()}`;
    },

    /**
     * Long, for the tooltip: "Último enlace: 28/09/2026 10:42"
     * @param {string} linkedAt
     * @returns {string} Empty without a valid date
     */
    describe(linkedAt) {
      const date = parse(linkedAt);
      if (!date) return '';
      return `Último enlace: ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} `
        + `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { linkDate };
  } else {
    global.linkDate = linkDate;
  }
})(typeof window !== 'undefined' ? window : global);
