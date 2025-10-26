/**
 * KeyboardNavigationManager - Manages keyboard navigation
 *
 * Handles keyboard shortcuts for navigating between users and images.
 * Prevents conflicts with modal dialogs and input fields.
 *
 * Features:
 * - Arrow keys for user navigation (up/down)
 * - Arrow keys for image navigation (left/right)
 * - Modal-aware (disabled when modals are open)
 * - Input-aware (disabled when typing in inputs)
 * - Configurable callbacks for navigation actions
 */

(function(global) {
  'use strict';

  class KeyboardNavigationManager {
    constructor(config = {}) {
      // Callbacks
      this.onNavigateUserPrev = config.onNavigateUserPrev || (() => {});
      this.onNavigateUserNext = config.onNavigateUserNext || (() => {});
      this.onNavigateImagePrev = config.onNavigateImagePrev || (() => {});
      this.onNavigateImageNext = config.onNavigateImageNext || (() => {});

      // State getters
      this.isModalOpen = config.isModalOpen || (() => false);
      this.hasImages = config.hasImages || (() => false);

      // Event handler (bound to this)
      this.handleKeyDown = this.handleKeyDown.bind(this);
      this.isEnabled = false;
    }

    /**
     * Enable keyboard navigation
     */
    enable() {
      if (this.isEnabled) return;

      document.addEventListener('keydown', this.handleKeyDown);
      this.isEnabled = true;

      console.log('[KeyboardNavigationManager] Enabled');
    }

    /**
     * Disable keyboard navigation
     */
    disable() {
      if (!this.isEnabled) return;

      document.removeEventListener('keydown', this.handleKeyDown);
      this.isEnabled = false;

      console.log('[KeyboardNavigationManager] Disabled');
    }

    /**
     * Handle keydown events
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyDown(event) {
      // Don't handle if modal is open
      if (this.isModalOpen()) {
        return;
      }

      // Don't prevent default behavior if user is typing in an input field
      if (this.isTypingInInput(event)) {
        return;
      }

      // Handle arrow keys
      switch (event.key) {
        case 'ArrowLeft':
          this.handleArrowLeft(event);
          break;

        case 'ArrowRight':
          this.handleArrowRight(event);
          break;

        case 'ArrowUp':
          this.handleArrowUp(event);
          break;

        case 'ArrowDown':
          this.handleArrowDown(event);
          break;

        default:
          // Not an arrow key, ignore
          break;
      }
    }

    /**
     * Check if user is typing in an input or textarea
     * @param {KeyboardEvent} event - Keyboard event
     * @returns {boolean} True if typing in input/textarea
     */
    isTypingInInput(event) {
      if (!event.target) return false;

      const tagName = event.target.tagName;
      return tagName === 'INPUT' || tagName === 'TEXTAREA';
    }

    /**
     * Handle left arrow key (previous image)
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleArrowLeft(event) {
      if (this.hasImages()) {
        event.preventDefault();
        this.onNavigateImagePrev();
      }
    }

    /**
     * Handle right arrow key (next image)
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleArrowRight(event) {
      if (this.hasImages()) {
        event.preventDefault();
        this.onNavigateImageNext();
      }
    }

    /**
     * Handle up arrow key (previous user)
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleArrowUp(event) {
      event.preventDefault();
      this.onNavigateUserPrev();
    }

    /**
     * Handle down arrow key (next user)
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleArrowDown(event) {
      event.preventDefault();
      this.onNavigateUserNext();
    }

    /**
     * Update callbacks
     * @param {Object} callbacks - New callbacks
     */
    updateCallbacks(callbacks = {}) {
      if (callbacks.onNavigateUserPrev) {
        this.onNavigateUserPrev = callbacks.onNavigateUserPrev;
      }
      if (callbacks.onNavigateUserNext) {
        this.onNavigateUserNext = callbacks.onNavigateUserNext;
      }
      if (callbacks.onNavigateImagePrev) {
        this.onNavigateImagePrev = callbacks.onNavigateImagePrev;
      }
      if (callbacks.onNavigateImageNext) {
        this.onNavigateImageNext = callbacks.onNavigateImageNext;
      }
    }

    /**
     * Update state getters
     * @param {Object} getters - New state getters
     */
    updateGetters(getters = {}) {
      if (getters.isModalOpen) {
        this.isModalOpen = getters.isModalOpen;
      }
      if (getters.hasImages) {
        this.hasImages = getters.hasImages;
      }
    }

    /**
     * Check if enabled
     * @returns {boolean} True if enabled
     */
    getIsEnabled() {
      return this.isEnabled;
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { KeyboardNavigationManager };
  } else if (typeof window !== 'undefined') {
    global.KeyboardNavigationManager = KeyboardNavigationManager;
  }
})(typeof window !== 'undefined' ? window : global);
