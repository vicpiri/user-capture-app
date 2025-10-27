/**
 * UserDataManager - Manages user and group data loading
 *
 * Centralized manager for loading and managing user/group data.
 * Handles initial load, filtering, and repository data loading.
 *
 * Features:
 * - Load groups and populate filter dropdown
 * - Load users with filtering options
 * - Load repository data in background (non-blocking)
 * - Loading state management (spinners)
 * - Duplicate checking across all users
 * - Configurable callbacks for data updates
 */

(function(global) {
  'use strict';

  class UserDataManager {
    constructor(config = {}) {
      // State setters
      this.setCurrentUsers = config.setCurrentUsers || ((users) => {});
      this.setAllUsers = config.setAllUsers || ((users) => {});
      this.setCurrentGroups = config.setCurrentGroups || ((groups) => {});
      this.setIsLoadingRepositoryPhotos = config.setIsLoadingRepositoryPhotos || ((value) => {});
      this.setIsLoadingRepositoryIndicators = config.setIsLoadingRepositoryIndicators || ((value) => {});
      this.setRepositorySyncCompleted = config.setRepositorySyncCompleted || ((value) => {});

      // State getters
      this.getCurrentUsers = config.getCurrentUsers || (() => []);
      this.getAllUsers = config.getAllUsers || (() => []);
      this.getCurrentGroups = config.getCurrentGroups || (() => []);
      this.getShowCapturedPhotos = config.getShowCapturedPhotos || (() => false);
      this.getShowRepositoryPhotos = config.getShowRepositoryPhotos || (() => false);
      this.getShowRepositoryIndicators = config.getShowRepositoryIndicators || (() => false);

      // Callbacks
      this.onDisplayUsers = config.onDisplayUsers || (() => {});
      this.onUpdateUserCount = config.onUpdateUserCount || (() => {});

      // DOM elements
      this.groupFilter = config.groupFilter;
      this.loadingSpinner = config.loadingSpinner;
      this.userTableBody = config.userTableBody;

      // IPC API
      this.electronAPI = config.electronAPI || window.electronAPI;

      // Config
      this.minSpinnerDisplayTime = config.minSpinnerDisplayTime || 300; // ms
    }

    /**
     * Load groups from database
     * @returns {Promise<void>}
     */
    async loadGroups() {
      const result = await this.electronAPI.getGroups();

      if (result.success) {
        this.setCurrentGroups(result.groups);
        this.populateGroupFilter(result.groups);
      }
    }

    /**
     * Populate group filter dropdown
     * @param {Array} groups - Groups to populate
     */
    populateGroupFilter(groups) {
      if (!this.groupFilter) return;

      this.groupFilter.innerHTML = '<option value="">Todos los grupos</option>';
      groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.code;
        option.textContent = `${group.code} - ${group.name}`;
        this.groupFilter.appendChild(option);
      });
    }

    /**
     * Load users with filters
     * @param {Object} filters - Filter options
     * @returns {Promise<void>}
     */
    async loadUsers(filters = {}) {
      // Show loading spinner
      if (this.loadingSpinner) {
        this.loadingSpinner.style.display = 'flex';
      }

      // Clear rows but preserve spacers
      if (this.userTableBody) {
        const existingRows = Array.from(
          this.userTableBody.querySelectorAll('tr:not(#top-spacer):not(#bottom-spacer)')
        );
        existingRows.forEach(row => row.remove());
      }

      try {
        // Load users WITHOUT repository images for fast initial display
        const loadOptions = {
          loadCapturedImages: this.getShowCapturedPhotos(),
          loadRepositoryImages: false // Always false for initial load
        };

        const result = await this.electronAPI.getUsers(filters, loadOptions);

        if (result.success) {
          this.setCurrentUsers(result.users);

          // Always reload all users for accurate duplicate checking
          // Only load image_path for duplicate checking, no need for repository images
          const allLoadOptions = {
            loadCapturedImages: true,
            loadRepositoryImages: false
          };
          const allResult = await this.electronAPI.getUsers({}, allLoadOptions);
          if (allResult.success) {
            this.setAllUsers(allResult.users);
          }

          this.onDisplayUsers(this.getCurrentUsers(), this.getAllUsers());
          this.onUpdateUserCount();

          // Load repository data in background if needed
          if (this.getShowRepositoryPhotos() || this.getShowRepositoryIndicators()) {
            // Check if repository data is actually loaded
            const hasRepositoryData = this.getCurrentUsers().some(u => u.repository_image_path);
            if (!hasRepositoryData) {
              this.loadRepositoryDataInBackground(this.getCurrentUsers());
            } else {
              // Data already loaded, stop loading state
              this.setIsLoadingRepositoryPhotos(false);
              this.setIsLoadingRepositoryIndicators(false);
              this.setRepositorySyncCompleted(true);
            }
          }
        }
      } finally {
        // Hide loading spinner
        if (this.loadingSpinner) {
          this.loadingSpinner.style.display = 'none';
        }
      }
    }

    /**
     * Load repository data in background (non-blocking)
     * @param {Array} users - Users to load repository data for
     * @returns {Promise<void>}
     */
    async loadRepositoryDataInBackground(users) {
      const startTime = Date.now();

      try {
        const result = await this.electronAPI.loadRepositoryImages(users);

        if (result.success) {
          // Merge repository data into currentUsers
          const currentUsers = this.getCurrentUsers();
          currentUsers.forEach(user => {
            const repoData = result.repositoryData[user.id];
            if (repoData) {
              user.has_repository_image = repoData.has_repository_image;
              user.repository_image_path = repoData.repository_image_path;
            }
          });

          // Ensure spinners are visible for at least minSpinnerDisplayTime
          const elapsedTime = Date.now() - startTime;
          const remainingTime = Math.max(0, this.minSpinnerDisplayTime - elapsedTime);

          setTimeout(() => {
            // Update the display with repository data
            this.updateRepositoryDataInDisplay();
          }, remainingTime);
        } else {
          console.error('Error loading repository data:', result.error);
          // Stop loading states even on error
          this.updateRepositoryDataInDisplay();
        }
      } catch (error) {
        console.error('Error loading repository data in background:', error);
        // Stop loading states even on error
        this.updateRepositoryDataInDisplay();
      }
    }

    /**
     * Update repository data in the displayed rows
     */
    updateRepositoryDataInDisplay() {
      // Stop loading states first
      this.setIsLoadingRepositoryPhotos(false);
      this.setIsLoadingRepositoryIndicators(false);
      this.setRepositorySyncCompleted(true);

      // Re-render users to update spinners and show actual data
      this.onDisplayUsers(this.getCurrentUsers(), this.getAllUsers());
    }

    /**
     * Update state setters
     * @param {Object} setters - New state setters
     */
    updateSetters(setters = {}) {
      if (setters.setCurrentUsers) this.setCurrentUsers = setters.setCurrentUsers;
      if (setters.setAllUsers) this.setAllUsers = setters.setAllUsers;
      if (setters.setCurrentGroups) this.setCurrentGroups = setters.setCurrentGroups;
      if (setters.setIsLoadingRepositoryPhotos) {
        this.setIsLoadingRepositoryPhotos = setters.setIsLoadingRepositoryPhotos;
      }
      if (setters.setIsLoadingRepositoryIndicators) {
        this.setIsLoadingRepositoryIndicators = setters.setIsLoadingRepositoryIndicators;
      }
      if (setters.setRepositorySyncCompleted) {
        this.setRepositorySyncCompleted = setters.setRepositorySyncCompleted;
      }
    }

    /**
     * Update state getters
     * @param {Object} getters - New state getters
     */
    updateGetters(getters = {}) {
      if (getters.getCurrentUsers) this.getCurrentUsers = getters.getCurrentUsers;
      if (getters.getAllUsers) this.getAllUsers = getters.getAllUsers;
      if (getters.getCurrentGroups) this.getCurrentGroups = getters.getCurrentGroups;
      if (getters.getShowCapturedPhotos) {
        this.getShowCapturedPhotos = getters.getShowCapturedPhotos;
      }
      if (getters.getShowRepositoryPhotos) {
        this.getShowRepositoryPhotos = getters.getShowRepositoryPhotos;
      }
      if (getters.getShowRepositoryIndicators) {
        this.getShowRepositoryIndicators = getters.getShowRepositoryIndicators;
      }
    }

    /**
     * Update callbacks
     * @param {Object} callbacks - New callbacks
     */
    updateCallbacks(callbacks = {}) {
      if (callbacks.onDisplayUsers) this.onDisplayUsers = callbacks.onDisplayUsers;
      if (callbacks.onUpdateUserCount) this.onUpdateUserCount = callbacks.onUpdateUserCount;
    }

    /**
     * Refresh only repository indicators without reloading the entire user list
     * This preserves scroll position and DOM state
     * @param {Function} userRowRendererUpdateCallback - Callback to update row renderer
     * @returns {Promise<void>}
     */
    async refreshRepositoryIndicators(userRowRendererUpdateCallback) {
      console.log('[UserDataManager] Refreshing repository indicators without full reload');

      try {
        // Get current users to refresh their repository data
        const currentUsers = this.getCurrentUsers();
        if (!currentUsers || currentUsers.length === 0) {
          console.log('[UserDataManager] No users loaded, skipping refresh');
          return;
        }

        // Set loading state
        this.setIsLoadingRepositoryPhotos(true);
        this.setIsLoadingRepositoryIndicators(true);

        // Load repository data for current users
        const result = await this.electronAPI.loadRepositoryImages(currentUsers);

        if (result.success) {
          // Update repository data in the existing user objects
          currentUsers.forEach(user => {
            const repoData = result.repositoryData[user.id];
            if (repoData) {
              user.has_repository_image = repoData.has_repository_image;
              user.repository_image_path = repoData.repository_image_path;
            }
          });

          // Update the current users state
          this.setCurrentUsers(currentUsers);

          // Stop loading states
          this.setIsLoadingRepositoryPhotos(false);
          this.setIsLoadingRepositoryIndicators(false);
          this.setRepositorySyncCompleted(true);

          // Call the callback to update the UI (without full re-render)
          if (userRowRendererUpdateCallback) {
            userRowRendererUpdateCallback(currentUsers);
          }

          console.log('[UserDataManager] Repository indicators refreshed successfully');
        } else {
          console.error('[UserDataManager] Error refreshing repository data:', result.error);
          // Stop loading states even on error
          this.setIsLoadingRepositoryPhotos(false);
          this.setIsLoadingRepositoryIndicators(false);
        }
      } catch (error) {
        console.error('[UserDataManager] Error refreshing repository indicators:', error);
        // Stop loading states even on error
        this.setIsLoadingRepositoryPhotos(false);
        this.setIsLoadingRepositoryIndicators(false);
      }
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UserDataManager };
  } else if (typeof window !== 'undefined') {
    global.UserDataManager = UserDataManager;
  }
})(typeof window !== 'undefined' ? window : global);
