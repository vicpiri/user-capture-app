/**
 * Store Observable - Centralized State Management
 *
 * Manages application state with reactive subscriptions.
 * Components subscribe to specific state keys and get notified of changes.
 *
 * @module core/store
 */

class Store {
  constructor() {
    // Application state
    this.state = {
      // Project state
      project: {
        isOpen: false,
        folderPath: null,
        xmlFilePath: null,
        ingestFolderPath: null,
        importsFolderPath: null
      },

      // Users state
      users: {
        allUsers: [],
        filteredUsers: [],
        selectedUser: null,
        selectedUserId: null,
        duplicatesMap: new Map()
      },

      // Groups state
      groups: {
        allGroups: [],
        selectedGroup: null
      },

      // Images state
      images: {
        capturedImages: [],
        selectedImageId: null,
        selectedImagePath: null,
        tags: new Map()
      },

      // Repository state
      repository: {
        path: null,
        availableImages: new Set(),
        isLoading: false,
        lastSync: null
      },

      // Camera state
      camera: {
        isEnabled: false,
        deviceId: null,
        availableDevices: []
      },

      // UI state
      ui: {
        showDuplicatesOnly: false,
        showCapturedPhotos: true,
        showRepositoryPhotos: true,
        showRepositoryIndicators: true,
        showAdditionalActions: false,
        currentView: 'table' // 'table', 'grid', etc.
      },

      // App state
      app: {
        isReady: false,
        version: null,
        lastError: null
      }
    };

    // Map of listeners: key -> Set of callbacks
    this.listeners = new Map();

    // Debug mode
    this.debug = false;
  }

  /**
   * Get state (immutable copy)
   * @param {string} key - Specific key or undefined for entire state
   * @returns {object} State copy
   */
  getState(key) {
    if (key) {
      if (!this.state.hasOwnProperty(key)) {
        this._log(`Warning: Accessing non-existent state key '${key}'`, 'warn');
        return undefined;
      }

      // Deep clone for complex objects
      const value = this.state[key];
      if (value instanceof Map || value instanceof Set) {
        return value; // Return as-is (Maps/Sets are already mutable references)
      }
      return { ...value };
    }

    return { ...this.state };
  }

  /**
   * Update state and notify subscribers
   * @param {object} updates - Object with keys to update
   */
  setState(updates) {
    const changedKeys = [];

    // Update each key
    Object.keys(updates).forEach(key => {
      if (!this.state.hasOwnProperty(key)) {
        this._log(`Warning: Setting non-existent state key '${key}'`, 'warn');
      }

      // Merge update with existing state
      this.state[key] = { ...this.state[key], ...updates[key] };
      changedKeys.push(key);
    });

    this._log('State updated:', updates);

    // Notify subscribers
    this.notify(changedKeys);
  }

  /**
   * Subscribe to changes in specific keys
   * @param {string|string[]} keys - Key or array of keys
   * @param {Function} callback - Function to call when state changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(keys, callback) {
    if (!Array.isArray(keys)) {
      keys = [keys];
    }

    // Validate callback
    if (typeof callback !== 'function') {
      throw new Error('[Store] Callback must be a function');
    }

    // Add callback to each key
    keys.forEach(key => {
      if (!this.listeners.has(key)) {
        this.listeners.set(key, new Set());
      }
      this.listeners.get(key).add(callback);
    });

    this._log(`New subscription to: ${keys.join(', ')}`);

    // Return cleanup function
    return () => {
      keys.forEach(key => {
        const callbacks = this.listeners.get(key);
        if (callbacks) {
          callbacks.delete(callback);
          this._log(`Unsubscribed from: ${key}`);
        }
      });
    };
  }

  /**
   * Notify subscribers of specific keys
   * @param {string[]} keys - Keys that changed
   */
  notify(keys) {
    keys.forEach(key => {
      const callbacks = this.listeners.get(key);
      if (callbacks && callbacks.size > 0) {
        const partialState = this.state[key];
        const fullState = this.state;

        this._log(`Notifying ${callbacks.size} listener(s) of '${key}'`);

        callbacks.forEach(callback => {
          try {
            callback(partialState, fullState);
          } catch (error) {
            console.error(`[Store] Error in callback for '${key}':`, error);
          }
        });
      }
    });
  }

  /**
   * Enable/disable debug logging
   * @param {boolean} enabled
   */
  setDebug(enabled) {
    this.debug = enabled;
    this._log(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get number of subscribers for a key
   * @param {string} key
   * @returns {number}
   */
  getSubscriberCount(key) {
    const callbacks = this.listeners.get(key);
    return callbacks ? callbacks.size : 0;
  }

  /**
   * Clear all subscriptions (for testing/cleanup)
   */
  clearSubscriptions() {
    this.listeners.clear();
    this._log('All subscriptions cleared');
  }

  /**
   * Internal logging
   * @private
   */
  _log(message, level = 'info') {
    if (this.debug || level === 'warn' || level === 'error') {
      const prefix = '[Store]';
      if (level === 'warn') {
        console.warn(prefix, message);
      } else if (level === 'error') {
        console.error(prefix, message);
      } else {
        console.log(prefix, message);
      }
    }
  }
}

// Export singleton instance
const store = new Store();

// Expose to window for debugging (development only)
if (typeof window !== 'undefined' && process.argv && process.argv.includes('--dev')) {
  window.__store__ = store;
  console.log('[Store] Available at window.__store__ (dev mode)');
}

// CommonJS export (for tests)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Store, store };
} else if (typeof window !== 'undefined') {
  // Browser global export
  window.Store = Store;
  window.store = store;
}
