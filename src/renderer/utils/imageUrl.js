/**
 * Image URL builder
 *
 * Every user photo is requested through the app-img scheme instead of file://.
 * Two reasons:
 *
 * - The path travels percent-encoded in a query parameter, so folder names
 *   containing # or % no longer truncate the URL or resolve somewhere else.
 * - A size can be asked for, and the main process answers with a cached
 *   thumbnail rather than a full resolution photo.
 *
 * @module utils/imageUrl
 */

(function(global) {
  'use strict';

  const SCHEME = 'app-img';

  // Requested in device pixels. A 32px indicator on a 200% display needs 64
  // real pixels, and 150px grid items need 300: asking for a couple of fixed
  // sizes keeps the thumbnail cache small instead of one entry per zoom level.
  const INDICATOR_SIZE = 128;
  const GRID_SIZE = 384;

  /**
   * @param {string} filePath - Absolute path of the image
   * @param {Object} [options]
   * @param {number} [options.size] - Longest side; omit for the original
   * @param {number|string} [options.version] - Changes the URL when the file is
   *   replaced in place, which repository photos are
   * @returns {string} URL, or an empty string when there is no path
   */
  function buildImageUrl(filePath, options = {}) {
    if (!filePath) {
      return '';
    }

    const params = new URLSearchParams();
    params.set('path', filePath);

    if (options.size) {
      params.set('size', String(options.size));
    }

    if (options.version !== undefined && options.version !== null) {
      params.set('v', String(options.version));
    }

    return `${SCHEME}://img/?${params.toString()}`;
  }

  const imageUrl = {
    SCHEME,
    INDICATOR_SIZE,
    GRID_SIZE,

    /**
     * URL of a thumbnail
     * @param {string} filePath
     * @param {number} size
     * @param {number|string} [version]
     * @returns {string}
     */
    thumbnail(filePath, size, version) {
      return buildImageUrl(filePath, { size, version });
    },

    /**
     * URL of the image at full resolution
     * @param {string} filePath
     * @param {number|string} [version]
     * @returns {string}
     */
    original(filePath, version) {
      return buildImageUrl(filePath, { version });
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { imageUrl, buildImageUrl };
  } else {
    global.imageUrl = imageUrl;
  }
})(typeof window !== 'undefined' ? window : global);
