/**
 * Capture History Manager
 *
 * Vertical strip of thumbnails to the right of the large viewer, listing every
 * capture of the project newest first. It is a visual index of the very same
 * array the viewer navigates, so clicking a thumbnail just moves the viewer's
 * cursor; it never loads images of its own.
 *
 * Thumbnails are reused across renders instead of being rebuilt: a new capture
 * only prepends one node, and re-creating the whole strip would ask the main
 * process for every thumbnail again.
 *
 * @module components/CaptureHistoryManager
 */

(function(global) {
  'use strict';

  const imageUrlUtil = (typeof module !== 'undefined' && module.exports)
    ? require('../utils/imageUrl').imageUrl
    : global.imageUrl;

  // folderWatcher names every capture YYYYMMDDHHMMSS, adding _1, _2... when
  // several land in the same second. Images brought in by the bulk ID import
  // keep their original name and will not match.
  const CAPTURE_NAME = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:_\d+)?$/;

  const UNDATED_KEY = 'sin-fecha';
  const UNDATED_LABEL = 'Sin fecha en el nombre';

  /**
   * @param {string} imagePath
   * @returns {string} Name of the file, without its folders
   */
  function fileNameOf(imagePath) {
    return String(imagePath).split(/[\\/]/).pop() || '';
  }

  /**
   * Read the capture time out of the file name
   *
   * The name is the only record of when a capture was taken, so this is what
   * lets the strip be scanned by day and hour.
   *
   * @param {string} imagePath
   * @returns {{dayKey: string, dayLabel: string, time: string}|null}
   */
  function parseCaptureName(imagePath) {
    const baseName = fileNameOf(imagePath).replace(/\.[^.]*$/, '');
    const match = CAPTURE_NAME.exec(baseName);

    if (!match) {
      return null;
    }

    const [, year, month, day, hours, minutes, seconds] = match;

    return {
      dayKey: `${year}${month}${day}`,
      dayLabel: `${day}/${month}/${year}`,
      time: `${hours}:${minutes}:${seconds}`
    };
  }

  class CaptureHistoryManager {
    /**
     * @param {Object} config
     * @param {HTMLElement} config.panel - Strip container, toggled as a whole
     * @param {HTMLElement} config.list - Scrollable list the thumbnails go into
     * @param {HTMLElement} [config.empty] - Shown when there are no captures
     * @param {Function} [config.onSelect] - Called with the index of the clicked thumbnail
     * @param {number} [config.thumbnailSize] - Longest side requested, in device pixels
     */
    constructor(config = {}) {
      this.panel = config.panel || null;
      this.list = config.list || null;
      this.empty = config.empty || null;
      this.onSelect = config.onSelect || (() => {});
      this.thumbnailSize = config.thumbnailSize
        || (imageUrlUtil && imageUrlUtil.INDICATOR_SIZE)
        || 128;

      this.images = [];
      this.currentIndex = -1;
      this.visible = false;
      this.observer = null;
      // Path -> thumbnail element, so a re-render can reuse what is on screen
      this.itemsByPath = new Map();
    }

    /**
     * Start observing for lazy loading
     */
    init() {
      if (!this.list || typeof IntersectionObserver === 'undefined') {
        return;
      }

      this.observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.loadThumbnail(entry.target);
            this.observer.unobserve(entry.target);
          }
        });
      }, {
        root: this.list,
        // Start a little before the thumbnail scrolls in, so it is ready by then
        rootMargin: '200px',
        threshold: 0.01
      });
    }

    /**
     * Show or hide the whole strip
     * @param {boolean} visible
     */
    setVisible(visible) {
      this.visible = !!visible;

      if (this.panel) {
        this.panel.classList.toggle('visible', this.visible);
      }

      // Nothing was rendered while hidden, so catch up on becoming visible
      if (this.visible) {
        this.render(this.images, this.currentIndex);
      }
    }

    /**
     * @returns {boolean}
     */
    isVisible() {
      return this.visible;
    }

    /**
     * Render the strip
     * @param {string[]} images - Absolute image paths, newest first
     * @param {number} [currentIndex] - Index shown in the large viewer
     */
    render(images, currentIndex = this.currentIndex) {
      this.images = Array.isArray(images) ? images : [];
      this.currentIndex = currentIndex;

      if (this.empty) {
        this.empty.classList.toggle('visible', this.images.length === 0);
      }

      // Building thumbnails nobody can see would generate them for nothing
      if (!this.list || !this.visible) {
        return;
      }

      const fragment = document.createDocumentFragment();
      const reused = new Map();
      let currentDayKey = null;

      this.images.forEach((imagePath, index) => {
        // A heading every time the day changes, so the strip can be scanned
        // for the session a wrong link was made in
        const capture = parseCaptureName(imagePath);
        const dayKey = capture ? capture.dayKey : UNDATED_KEY;
        if (dayKey !== currentDayKey) {
          currentDayKey = dayKey;
          fragment.appendChild(
            this.createDaySeparator(capture ? capture.dayLabel : UNDATED_LABEL)
          );
        }

        const item = this.itemsByPath.get(imagePath) || this.createItem(imagePath);
        item.dataset.index = String(index);
        reused.set(imagePath, item);
        fragment.appendChild(item);
      });

      // Whatever was not reused is gone from the project
      this.itemsByPath.forEach((item, imagePath) => {
        if (!reused.has(imagePath) && this.observer) {
          this.observer.unobserve(item);
        }
      });

      this.itemsByPath = reused;
      this.list.replaceChildren(fragment);
      this.highlightCurrent(false);
    }

    /**
     * Build a thumbnail, with its image left unloaded
     * @param {string} imagePath
     * @returns {HTMLElement}
     * @private
     */
    createItem(imagePath) {
      const capture = parseCaptureName(imagePath);
      const fileName = fileNameOf(imagePath);

      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'capture-history-item';
      item.dataset.path = imagePath;
      // The name is what identifies a capture when a wrong link is chased down
      item.title = capture
        ? `${fileName}\n${capture.dayLabel} ${capture.time}`
        : fileName;

      const frame = document.createElement('span');
      frame.className = 'capture-history-thumb';

      const img = document.createElement('img');
      img.alt = '';
      img.dataset.src = imageUrlUtil
        ? imageUrlUtil.thumbnail(imagePath, this.thumbnailSize)
        : imagePath;
      img.addEventListener('load', () => img.classList.add('loaded'));
      frame.appendChild(img);
      item.appendChild(frame);

      const caption = document.createElement('span');
      caption.className = 'capture-history-caption';
      // Without a timestamp in the name the file name is all there is to go on
      caption.textContent = capture ? capture.time : fileName;
      if (!capture) {
        caption.classList.add('capture-history-caption-name');
      }
      item.appendChild(caption);

      item.addEventListener('click', () => {
        this.onSelect(Number(item.dataset.index));
      });

      if (this.observer) {
        this.observer.observe(item);
      } else {
        // No observer means no lazy loading is possible; show it right away
        this.loadThumbnail(item);
      }

      return item;
    }

    /**
     * Heading marking the start of a day's captures
     * @param {string} label
     * @returns {HTMLElement}
     * @private
     */
    createDaySeparator(label) {
      const separator = document.createElement('div');
      separator.className = 'capture-history-day';
      separator.textContent = label;
      separator.title = label;
      return separator;
    }

    /**
     * Point the thumbnail's img at its real source
     * @param {HTMLElement} item
     * @private
     */
    loadThumbnail(item) {
      const img = item.querySelector('img');
      if (img && img.dataset.src && !img.src) {
        img.src = img.dataset.src;
      }
    }

    /**
     * Mark which thumbnail the viewer is showing
     * @param {number} index
     */
    setCurrentIndex(index) {
      this.currentIndex = index;
      this.highlightCurrent(true);
    }

    /**
     * @param {boolean} scrollIntoView
     * @private
     */
    highlightCurrent(scrollIntoView) {
      if (!this.list) return;

      let current = null;

      this.itemsByPath.forEach((item) => {
        const isCurrent = Number(item.dataset.index) === this.currentIndex;
        item.classList.toggle('current', isCurrent);
        if (isCurrent) {
          current = item;
        }
      });

      // Only scroll when the thumbnail is actually out of view: nudging the
      // strip on every capture would fight whatever the user is browsing
      if (scrollIntoView && current && !this.isItemVisible(current)) {
        current.scrollIntoView({ block: 'nearest' });
      }
    }

    /**
     * @param {HTMLElement} item
     * @returns {boolean}
     * @private
     */
    isItemVisible(item) {
      if (typeof item.getBoundingClientRect !== 'function') {
        return true;
      }

      const itemRect = item.getBoundingClientRect();
      const listRect = this.list.getBoundingClientRect();

      return itemRect.top >= listRect.top && itemRect.bottom <= listRect.bottom;
    }

    /**
     * Empty the strip
     */
    clear() {
      if (this.observer) {
        this.itemsByPath.forEach((item) => this.observer.unobserve(item));
      }

      this.itemsByPath.clear();
      this.images = [];
      this.currentIndex = -1;

      if (this.list) {
        this.list.replaceChildren();
      }

      if (this.empty) {
        this.empty.classList.toggle('visible', this.visible);
      }
    }

    /**
     * Release the observer
     */
    destroy() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      this.itemsByPath.clear();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CaptureHistoryManager };
  } else if (typeof window !== 'undefined') {
    global.CaptureHistoryManager = CaptureHistoryManager;
  }
})(typeof window !== 'undefined' ? window : global);
