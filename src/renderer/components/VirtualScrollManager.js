/**
 * Virtual Scroll Manager
 *
 * Efficiently renders large lists of users by only rendering visible items
 * and using a virtual scrolling technique with top/bottom spacers.
 *
 * @module components/VirtualScrollManager
 */

// IIFE to avoid polluting global scope while making VirtualScrollManager available
(function(global) {
  'use strict';

class VirtualScrollManager {
  constructor(config = {}) {
    // Configuration
    this.itemHeight = config.itemHeight || 40; // Height of each row in pixels
    this.bufferSize = config.bufferSize || 10; // Extra rows to render above/below viewport
    this.minItemsForVirtualization = config.minItemsForVirtualization || 50;

    // Dependencies (provided by caller)
    this.container = config.container;
    this.tbody = config.tbody;
    this.createRowCallback = config.createRowCallback;
    this.observeImagesCallback = config.observeImagesCallback;

    // State
    this.items = [];
    this.visibleStartIndex = 0;
    this.visibleEndIndex = 0;
    this.isActive = false;
    this.scrollFrame = null;

    // Row height depends on CSS and on which indicators are shown, so the
    // configured value is only a starting point until a row can be measured
    this.needsMeasure = true;

    // DOM elements
    this.topSpacer = null;
    this.bottomSpacer = null;

    // Bind methods
    this.handleScroll = this.handleScroll.bind(this);
  }

  /**
   * Initialize virtual scrolling
   */
  init() {
    if (!this.container || !this.tbody) {
      console.error('[VirtualScrollManager] Container or tbody not provided');
      return;
    }

    // Create spacer elements if they don't exist
    this.createSpacers();

    // Passive: the handler never calls preventDefault, and saying so lets the
    // browser scroll without waiting for it
    this.container.addEventListener('scroll', this.handleScroll, { passive: true });

    console.log('[VirtualScrollManager] Initialized');
  }

  /**
   * Create top and bottom spacer elements
   */
  createSpacers() {
    // Check if spacers already exist
    this.topSpacer = this.tbody.querySelector('#top-spacer');
    this.bottomSpacer = this.tbody.querySelector('#bottom-spacer');

    if (!this.topSpacer) {
      this.topSpacer = document.createElement('tr');
      this.topSpacer.id = 'top-spacer';
      this.topSpacer.style.height = '0px';
      this.tbody.insertBefore(this.topSpacer, this.tbody.firstChild);
    }

    if (!this.bottomSpacer) {
      this.bottomSpacer = document.createElement('tr');
      this.bottomSpacer.id = 'bottom-spacer';
      this.bottomSpacer.style.height = '0px';
      this.tbody.appendChild(this.bottomSpacer);
    }
  }

  /**
   * Set items to render
   * @param {Array} items - Array of items to render
   */
  setItems(items) {
    this.items = items || [];

    // The rows about to be built may have a different shape than the last set
    this.needsMeasure = true;

    // Determine if virtual scrolling should be active
    const shouldActivate = this.items.length >= this.minItemsForVirtualization;

    if (shouldActivate !== this.isActive) {
      this.isActive = shouldActivate;

      if (this.isActive) {
        console.log(`[VirtualScrollManager] Activating virtual scrolling for ${this.items.length} items`);
      } else {
        console.log(`[VirtualScrollManager] Using normal rendering for ${this.items.length} items`);
      }
    }

    // Always force render when items change to ensure display is updated
    this.render(true);
  }

  /**
   * Render items (virtual or normal depending on count)
   * @param {boolean} force - Force re-render even if range hasn't changed
   */
  render(force = false) {
    if (this.isActive) {
      this.renderVirtualized(force);
    } else {
      this.renderNormal();
    }
  }

  /**
   * Force a complete re-render of all visible items
   * Use this when the rendering config changes (e.g., selection mode toggle)
   */
  forceRerender() {
    this.needsMeasure = true;
    this.render(true);
  }

  /**
   * Adopt the real rendered row height
   *
   * The configured height is a guess: the actual one depends on CSS and on
   * which indicator columns are visible, and getting it wrong makes the spacers
   * lie about the total height, so the scrollbar and the rendered range drift
   * apart. Reading offsetHeight forces layout, so this only runs when the rows
   * may have changed shape, never on a scroll frame.
   *
   * @returns {boolean} True if the height changed and a re-render is needed
   * @private
   */
  measureItemHeight() {
    this.needsMeasure = false;

    const row = this.topSpacer && this.topSpacer.nextElementSibling;
    if (!row || row === this.bottomSpacer) {
      return false;
    }

    const height = row.offsetHeight;

    // jsdom and hidden containers report 0, which is not a usable measurement
    if (!height || height === this.itemHeight) {
      return false;
    }

    this.itemHeight = height;
    return true;
  }

  /**
   * Render all items normally (for small lists)
   */
  renderNormal() {
    // Reset spacers
    if (this.topSpacer) {
      this.topSpacer.style.height = '0px';
    }
    if (this.bottomSpacer) {
      this.bottomSpacer.style.height = '0px';
    }

    // Clear existing rows (except spacers)
    const existingRows = Array.from(
      this.tbody.querySelectorAll('tr:not(#top-spacer):not(#bottom-spacer)')
    );
    existingRows.forEach(row => row.remove());

    // Build off-document and insert once, so the browser lays out the batch a
    // single time instead of on every row
    const fragment = document.createDocumentFragment();
    this.items.forEach(item => {
      fragment.appendChild(this.createRowCallback(item));
    });
    this.tbody.insertBefore(fragment, this.bottomSpacer);

    if (this.needsMeasure) {
      this.measureItemHeight();
    }

    // Observe lazy images
    if (this.observeImagesCallback) {
      this.observeImagesCallback();
    }
  }

  /**
   * Render only visible items (for large lists)
   * @param {boolean} force - Force re-render even if range hasn't changed
   */
  renderVirtualized(force = false) {
    const containerHeight = this.container.clientHeight;
    const scrollTop = this.container.scrollTop;

    // Calculate visible range
    const visibleCount = Math.ceil(containerHeight / this.itemHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.bufferSize);
    const endIndex = Math.min(
      this.items.length,
      startIndex + visibleCount + (this.bufferSize * 2)
    );

    // Only re-render if range changed significantly (unless forced)
    if (!force && startIndex === this.visibleStartIndex && endIndex === this.visibleEndIndex) {
      return;
    }

    this.visibleStartIndex = startIndex;
    this.visibleEndIndex = endIndex;

    // Update spacers
    this.topSpacer.style.height = `${startIndex * this.itemHeight}px`;
    this.bottomSpacer.style.height = `${(this.items.length - endIndex) * this.itemHeight}px`;

    // If forced (like when changing groups), clear all rows and re-render
    if (force) {
      const existingRows = Array.from(
        this.tbody.querySelectorAll('tr:not(#top-spacer):not(#bottom-spacer)')
      );
      existingRows.forEach(row => row.remove());

      // Build off-document and insert once, so the browser lays out the batch a
      // single time instead of on every row
      const fragment = document.createDocumentFragment();
      this.items.slice(startIndex, endIndex).forEach(item => {
        fragment.appendChild(this.createRowCallback(item));
      });
      this.tbody.insertBefore(fragment, this.bottomSpacer);

      // A corrected height changes both the visible range and the spacers, so
      // the range has to be recomputed with it
      if (this.needsMeasure && this.measureItemHeight()) {
        this.renderVirtualized(true);
        return;
      }

      // Observe lazy images
      if (this.observeImagesCallback) {
        this.observeImagesCallback();
      }
      return;
    }

    // Get existing rows (except spacers)
    const existingRows = Array.from(
      this.tbody.querySelectorAll('tr:not(#top-spacer):not(#bottom-spacer)')
    );

    // Build a map of existing rows by user ID for reuse
    const existingRowsMap = new Map();
    existingRows.forEach(row => {
      const userId = row.dataset.userId;
      if (userId) {
        existingRowsMap.set(userId, row);
      }
    });

    // Get visible items
    const visibleItems = this.items.slice(startIndex, endIndex);
    const visibleUserIds = new Set(visibleItems.map(item => String(item.id)));

    // Remove rows that are no longer visible
    existingRows.forEach(row => {
      const userId = row.dataset.userId;
      if (!visibleUserIds.has(userId)) {
        row.remove();
        existingRowsMap.delete(userId);
      }
    });

    // Add or reuse rows for visible items.
    // Walking the siblings keeps this linear: looking each row up by index
    // meant rebuilding an array of the tbody children on every single item.
    let expectedNode = this.topSpacer.nextSibling;

    visibleItems.forEach(item => {
      const userId = String(item.id);
      const row = existingRowsMap.get(userId) || this.createRowCallback(item);

      if (row === expectedNode) {
        // Already in place, move on to the next slot
        expectedNode = expectedNode.nextSibling;
      } else {
        // Put it in this slot; the node we expected here shifts down and stays
        // the reference for the next item
        this.tbody.insertBefore(row, expectedNode);
      }
    });

    // Observe only NEW lazy images (ones without src attribute set)
    if (this.observeImagesCallback) {
      this.observeImagesCallback();
    }
  }

  /**
   * Handle scroll events
   */
  handleScroll() {
    // Only handle scroll if virtualization is active
    if (!this.isActive || this.items.length === 0) {
      return;
    }

    // One render per frame. A burst of scroll events used to schedule a render
    // every 10ms, which is more often than the screen repaints, so the extra
    // renders were work thrown away while competing with painting.
    if (this.scrollFrame !== null) {
      return;
    }

    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = null;
      this.renderVirtualized();
    });
  }

  /**
   * Scroll to a specific item index
   * @param {number} index - Item index to scroll to
   */
  scrollToIndex(index) {
    if (index < 0 || index >= this.items.length) {
      return;
    }

    const scrollTop = index * this.itemHeight;
    this.container.scrollTop = scrollTop;
  }

  /**
   * Scroll to top
   */
  scrollToTop() {
    this.container.scrollTop = 0;
  }

  /**
   * Get current scroll position info
   * @returns {object} Scroll info
   */
  getScrollInfo() {
    return {
      scrollTop: this.container.scrollTop,
      scrollHeight: this.container.scrollHeight,
      clientHeight: this.container.clientHeight,
      visibleStartIndex: this.visibleStartIndex,
      visibleEndIndex: this.visibleEndIndex,
      totalItems: this.items.length,
      isActive: this.isActive
    };
  }

  /**
   * Cleanup and remove event listeners
   */
  destroy() {
    if (this.container) {
      this.container.removeEventListener('scroll', this.handleScroll);
    }

    if (this.scrollFrame !== null) {
      cancelAnimationFrame(this.scrollFrame);
      this.scrollFrame = null;
    }

    console.log('[VirtualScrollManager] Destroyed');
  }
}

// Export for both browser and Node.js (tests)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VirtualScrollManager };
} else {
  global.VirtualScrollManager = VirtualScrollManager;
}

})(typeof window !== 'undefined' ? window : global);
