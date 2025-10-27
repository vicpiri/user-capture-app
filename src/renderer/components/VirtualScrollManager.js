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
    this.scrollTimeout = null;

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

    // Setup scroll listener
    this.container.addEventListener('scroll', this.handleScroll);

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

    // Render items
    this.render();
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
    this.render(true);
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

    // Render all items
    this.items.forEach(item => {
      const row = this.createRowCallback(item);
      this.bottomSpacer.parentNode.insertBefore(row, this.bottomSpacer);
    });

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

    // Clear existing rows (except spacers)
    const existingRows = Array.from(
      this.tbody.querySelectorAll('tr:not(#top-spacer):not(#bottom-spacer)')
    );
    existingRows.forEach(row => row.remove());

    // Render visible rows
    const visibleItems = this.items.slice(startIndex, endIndex);

    visibleItems.forEach(item => {
      const row = this.createRowCallback(item);
      this.bottomSpacer.parentNode.insertBefore(row, this.bottomSpacer);
    });

    // Observe lazy images
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

    // Debounce scroll events for better performance
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    this.scrollTimeout = setTimeout(() => {
      this.renderVirtualized();
    }, 10); // 10ms debounce
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

    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
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
