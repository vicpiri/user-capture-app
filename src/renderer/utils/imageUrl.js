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

  // A captured photo keeps its name when it is turned, so its URL has to
  // change for the views to load it again: each turned photo gets a version.
  // Kept in localStorage, which every window of the app shares, so it
  // survives a reload while the page's image cache still holds the old one.
  const VERSIONS_KEY = 'edu-user-capture:image-versions';
  const MAX_VERSIONS = 500;
  const BACKSLASH = String.fromCharCode(92);
  let versions = null;

  function pathKey(filePath) {
    return String(filePath).split(BACKSLASH).join('/').toLowerCase();
  }

  function storage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (error) {
      return null;
    }
  }

  function loadVersions() {
    if (!versions) {
      try {
        versions = JSON.parse((storage() && storage().getItem(VERSIONS_KEY)) || '{}') || {};
      } catch (error) {
        versions = {};
      }
    }
    return versions;
  }

  if (typeof window !== 'undefined' && window.addEventListener) {
    // Another window turned a photo
    window.addEventListener('storage', (event) => {
      if (event.key === VERSIONS_KEY) versions = null;
    });
  }

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

    const version = options.version !== undefined && options.version !== null
      ? options.version
      : loadVersions()[pathKey(filePath)];
    if (version !== undefined && version !== null) {
      params.set('v', String(version));
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
    },

    /**
     * A photo changed without changing its name (it was turned): its URLs
     * change from now on, in every window, so the views load it again
     * @param {string} filePath
     * @returns {number} the new version
     */
    bumpVersion(filePath) {
      versions = null; // another window may have written since
      const all = loadVersions();
      all[pathKey(filePath)] = Date.now();
      const keys = Object.keys(all);
      if (keys.length > MAX_VERSIONS) {
        keys.sort((a, b) => all[a] - all[b])
          .slice(0, keys.length - MAX_VERSIONS)
          .forEach((key) => { delete all[key]; });
      }
      try {
        if (storage()) storage().setItem(VERSIONS_KEY, JSON.stringify(all));
      } catch (error) {
        // Full or unavailable: the version still holds in this window
      }
      return all[pathKey(filePath)];
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { imageUrl, buildImageUrl };
  } else {
    global.imageUrl = imageUrl;
  }
})(typeof window !== 'undefined' ? window : global);
