/**
 * BaseModal - Base class for modals with lifecycle management
 *
 * Provides init/destroy lifecycle to prevent memory leaks.
 * All modals should extend this class and call super methods.
 *
 * @module core/BaseModal
 */

class BaseModal {
  /**
   * @param {string} modalId - DOM id of the modal element
   * @param {object} options - Configuration options
   * @param {string} options.defaultButtonSelector - CSS selector for default button (activated on Enter)
   */
  constructor(modalId, options = {}) {
    this.modalId = modalId;
    this.modal = document.getElementById(modalId);

    if (!this.modal) {
      console.warn(`[BaseModal] Modal with id '${modalId}' not found in DOM`);
    }

    // Track event listeners for cleanup
    this.listeners = [];

    // Track store subscriptions for cleanup
    this.storeSubscriptions = [];

    // Modal state
    this.isInitialized = false;
    this.isOpen = false;

    // Default button configuration (can be overridden by subclasses)
    this.defaultButtonSelector = options.defaultButtonSelector || null;

    // Bind Enter key handler
    this.handleEnterKey = this.handleEnterKey.bind(this);

    this._log('Modal constructed');
  }

  /**
   * Handle Enter key press
   * @private
   */
  handleEnterKey(event) {
    // Only handle Enter key if this modal is open
    if (event.key === 'Enter' && this.isOpen && this.defaultButtonSelector) {
      const button = this.modal.querySelector(this.defaultButtonSelector);
      if (button && !button.disabled) {
        event.preventDefault();
        button.click();
      }
    }
  }

  /**
   * Initialize modal (override in subclasses)
   * Call super.init() first in subclass implementation
   */
  init() {
    if (this.isInitialized) {
      this._log('Already initialized', 'warn');
      return;
    }

    if (!this.modal) {
      this._log('Cannot initialize - modal element not found', 'error');
      return;
    }

    this.isInitialized = true;
    this._log('Initialized');
  }

  /**
   * Open modal
   */
  open() {
    if (!this.modal) {
      this._log('Cannot open - modal element not found', 'error');
      return;
    }

    if (!this.isInitialized) {
      this._log('Cannot open - modal not initialized', 'warn');
      return;
    }

    this.modal.style.display = 'flex';
    this.modal.classList.add('show');
    this.isOpen = true;
    this._log('Opened');

    // Add Enter key listener to document if default button configured
    if (this.defaultButtonSelector) {
      this.addEventListener(document, 'keydown', this.handleEnterKey);
    }

    // Trigger onOpen hook if exists
    if (typeof this.onOpen === 'function') {
      this.onOpen();
    }
  }

  /**
   * Close modal
   */
  close() {
    if (!this.modal) return;

    this.modal.classList.remove('show');

    // Wait for animation before hiding
    setTimeout(() => {
      if (this.modal) {
        this.modal.style.display = 'none';
      }
    }, 300);

    this.isOpen = false;
    this._log('Closed');

    // Trigger onClose hook if exists
    if (typeof this.onClose === 'function') {
      this.onClose();
    }
  }

  /**
   * Add event listener with automatic tracking for cleanup
   * @param {HTMLElement} element - DOM element
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {object} options - Event listener options
   */
  addEventListener(element, event, handler, options = {}) {
    if (!element) {
      this._log(`Cannot add listener - element is null`, 'warn');
      return;
    }

    element.addEventListener(event, handler, options);
    this.listeners.push({ element, event, handler, options });
    this._log(`Listener added: ${event}`);
  }

  /**
   * Subscribe to store changes (tracked for cleanup)
   * @param {object} store - Store instance
   * @param {string|string[]} keys - State keys to subscribe to
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribeToStore(store, keys, callback) {
    const unsubscribe = store.subscribe(keys, callback);
    this.storeSubscriptions.push(unsubscribe);
    this._log(`Subscribed to store keys: ${Array.isArray(keys) ? keys.join(', ') : keys}`);
    return unsubscribe;
  }

  /**
   * Destroy modal and cleanup all resources
   * CRITICAL for preventing memory leaks
   *
   * Call this when:
   * - Modal is no longer needed
   * - Before page navigation
   * - In cleanup/teardown code
   */
  destroy() {
    this._log('Destroying...');

    // Close if open
    if (this.isOpen) {
      this.close();
    }

    // Remove all event listeners
    this.listeners.forEach(({ element, event, handler, options }) => {
      if (element) {
        element.removeEventListener(event, handler, options);
      }
    });
    const listenerCount = this.listeners.length;
    this.listeners = [];

    // Unsubscribe from store
    this.storeSubscriptions.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    const subscriptionCount = this.storeSubscriptions.length;
    this.storeSubscriptions = [];

    // Clear references
    this.modal = null;
    this.isInitialized = false;

    this._log(`Destroyed - Cleaned ${listenerCount} listeners, ${subscriptionCount} subscriptions`);

    // Trigger onDestroy hook if exists
    if (typeof this.onDestroy === 'function') {
      this.onDestroy();
    }
  }

  /**
   * Check if modal is currently open
   * @returns {boolean}
   */
  isModalOpen() {
    return this.isOpen;
  }

  /**
   * Internal logging
   * @private
   */
  _log(message, level = 'info') {
    const prefix = `[BaseModal:${this.modalId}]`;
    if (level === 'warn') {
      console.warn(prefix, message);
    } else if (level === 'error') {
      console.error(prefix, message);
    } else {
      console.log(prefix, message);
    }
  }
}

// CommonJS export (for tests)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BaseModal };
} else if (typeof window !== 'undefined') {
  // Browser global export
  window.BaseModal = BaseModal;
}
