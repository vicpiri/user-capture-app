/**
 * MenuEventManager - Manages menu event listeners
 *
 * Centralized manager for all IPC menu event handlers.
 * Handles display preferences, project management, and menu actions.
 *
 * Features:
 * - Initial display preferences loading
 * - Project lifecycle events (new, open, loaded)
 * - Display toggle events (duplicates, photos, indicators)
 * - Action events (link, delete, import, export)
 * - State synchronization with global variables
 * - Configurable callbacks for all menu actions
 */

(function(global) {
  'use strict';

  class MenuEventManager {
    constructor(config = {}) {
      // State setters
      this.setShowDuplicatesOnly = config.setShowDuplicatesOnly || ((value) => {});
      this.setShowCapturedPhotos = config.setShowCapturedPhotos || ((value) => {});
      this.setShowRepositoryPhotos = config.setShowRepositoryPhotos || ((value) => {});
      this.setShowRepositoryIndicators = config.setShowRepositoryIndicators || ((value) => {});
      this.setIsLoadingRepositoryPhotos = config.setIsLoadingRepositoryPhotos || ((value) => {});
      this.setIsLoadingRepositoryIndicators = config.setIsLoadingRepositoryIndicators || ((value) => {});
      this.setRepositorySyncCompleted = config.setRepositorySyncCompleted || ((value) => {});
      this.setProjectOpen = config.setProjectOpen || ((value) => {});

      // State getters
      this.getCurrentUsers = config.getCurrentUsers || (() => []);
      this.getAllUsers = config.getAllUsers || (() => []);

      // Action callbacks
      this.onNewProject = config.onNewProject || (() => {});
      this.onOpenProject = config.onOpenProject || (() => {});
      this.onCloseProject = config.onCloseProject || (() => {});
      this.onProjectLoaded = config.onProjectLoaded || (() => {});
      this.onLinkImage = config.onLinkImage || (() => {});
      this.onDeletePhoto = config.onDeletePhoto || (() => {});
      this.onImportImagesId = config.onImportImagesId || (() => {});
      this.onExportCSV = config.onExportCSV || (() => {});
      this.onExportInventoryCSV = config.onExportInventoryCSV || (() => {});
      this.onExportImages = config.onExportImages || (() => {});
      this.onExportImagesName = config.onExportImagesName || (() => {});
      this.onExportToRepository = config.onExportToRepository || (() => {});
      this.onExportOrlaPDF = config.onExportOrlaPDF || (() => {});
      this.onUpdateXML = config.onUpdateXML || (() => {});
      this.onAddImageTag = config.onAddImageTag || (() => {});
      this.onShowTaggedImages = config.onShowTaggedImages || (() => {});

      // Display callbacks
      this.onDisplayUsers = config.onDisplayUsers || (() => {});
      this.onUpdatePhotosColumnVisibility = config.onUpdatePhotosColumnVisibility || (() => {});
      this.onLoadUsers = config.onLoadUsers || (() => {});
      this.onLoadRepositoryData = config.onLoadRepositoryData || (() => {});
      this.getCurrentFilters = config.getCurrentFilters || (() => ({}));

      // DOM elements
      this.duplicatesFilter = config.duplicatesFilter;
      this.additionalActionsSection = config.additionalActionsSection;

      // IPC API
      this.electronAPI = config.electronAPI || window.electronAPI;

      this.isInitialized = false;
    }

    /**
     * Initialize all menu event listeners
     */
    init() {
      if (this.isInitialized) {
        console.warn('[MenuEventManager] Already initialized');
        return;
      }

      this.setupInitialPreferences();
      this.setupProjectListeners();
      this.setupActionListeners();
      this.setupDisplayToggles();
      this.setupExportListeners();
      this.setupImageTagListeners();
      this.setupUIToggles();

      this.isInitialized = true;
      console.log('[MenuEventManager] Initialized');
    }

    /**
     * Setup initial display preferences listener
     */
    setupInitialPreferences() {
      this.electronAPI.onInitialDisplayPreferences((prefs) => {
        this.setShowDuplicatesOnly(prefs.showDuplicatesOnly);
        this.setShowCapturedPhotos(prefs.showCapturedPhotos);
        this.setShowRepositoryPhotos(prefs.showRepositoryPhotos);
        this.setShowRepositoryIndicators(prefs.showRepositoryIndicators);

        // Update photos column visibility based on preferences
        this.onUpdatePhotosColumnVisibility();

        // Mark as loading if repository options are enabled in saved preferences
        if (prefs.showRepositoryPhotos) {
          this.setIsLoadingRepositoryPhotos(true);
          this.setRepositorySyncCompleted(false);
        }
        if (prefs.showRepositoryIndicators) {
          this.setIsLoadingRepositoryIndicators(true);
          this.setRepositorySyncCompleted(false);
        }

        // Set initial visibility of Additional Actions section
        if (this.additionalActionsSection) {
          this.additionalActionsSection.style.display = prefs.showAdditionalActions ? 'block' : 'none';
        }

        // If repository preferences are enabled and users are already loaded,
        // trigger repository data loading (this handles the race condition on startup)
        if ((prefs.showRepositoryPhotos || prefs.showRepositoryIndicators) &&
            this.getCurrentUsers().length > 0) {
          console.log('[MenuEventManager] Repository preferences enabled with users loaded, triggering repository data load');

          // Check if repository data is actually loaded
          const hasRepositoryData = this.getCurrentUsers().some(u => u.repository_image_path);
          if (!hasRepositoryData) {
            this.onLoadRepositoryData(this.getCurrentUsers());
          } else {
            // Data already loaded, stop loading state and mark sync as completed
            this.setIsLoadingRepositoryPhotos(false);
            this.setIsLoadingRepositoryIndicators(false);
            this.setRepositorySyncCompleted(true);
            // Re-display with actual data (no spinners)
            this.onDisplayUsers(this.getCurrentUsers(), this.getAllUsers());
          }
        }
      });
    }

    /**
     * Setup project lifecycle listeners
     */
    setupProjectListeners() {
      this.electronAPI.onMenuNewProject(() => {
        this.onNewProject();
      });

      this.electronAPI.onMenuOpenProject(() => {
        this.onOpenProject();
      });

      this.electronAPI.onMenuCloseProject(() => {
        this.onCloseProject();
      });

      this.electronAPI.onProjectOpened((data) => {
        if (data.success) {
          this.setProjectOpen(true);
          this.onProjectLoaded();
        }
      });

      // Listen for sync completion from repository mirror
      this.electronAPI.onSyncCompleted(async (result) => {
        console.log('[MenuEventManager] Repository mirror sync completed:', result);

        if (result.success) {
          // Load repository data if users are already loaded
          // Check against the actual state getters, not local variables
          if (this.getCurrentUsers().length > 0) {
            console.log('[MenuEventManager] Users loaded, triggering repository data load after sync');
            this.onLoadRepositoryData(this.getCurrentUsers());
          }
        }
      });
    }

    /**
     * Setup action listeners (link, delete)
     */
    setupActionListeners() {
      this.electronAPI.onMenuLinkImage(() => {
        this.onLinkImage();
      });

      this.electronAPI.onMenuDeletePhoto(() => {
        this.onDeletePhoto();
      });

      this.electronAPI.onMenuUpdateXML(() => {
        this.onUpdateXML();
      });
    }

    /**
     * Setup display toggle listeners
     */
    setupDisplayToggles() {
      // Toggle duplicates filter
      this.electronAPI.onMenuToggleDuplicates((enabled) => {
        this.setShowDuplicatesOnly(enabled);
        if (this.duplicatesFilter) {
          this.duplicatesFilter.checked = enabled;
        }
        this.onDisplayUsers(this.getCurrentUsers(), this.getAllUsers());
      });

      // Toggle captured photos
      this.electronAPI.onMenuToggleCapturedPhotos(async (enabled) => {
        this.setShowCapturedPhotos(enabled);
        this.onUpdatePhotosColumnVisibility();

        // If enabling, check if captured photo data is loaded
        if (enabled && this.getCurrentUsers().length > 0) {
          // Check if captured photo data was previously loaded
          // When loadCapturedImages is false, image_path is set to null explicitly
          // So we need to check if ALL users have null image_path (meaning data wasn't loaded)
          const allImagesAreNull = this.getCurrentUsers().every(u => u.image_path === null);
          if (allImagesAreNull) {
            // Reload users with captured images
            await this.onLoadUsers(this.getCurrentFilters());
            return; // loadUsers already calls displayUsers
          }
        }

        this.onDisplayUsers(this.getCurrentUsers(), this.getAllUsers());
      });

      // Toggle repository photos
      this.electronAPI.onMenuToggleRepositoryPhotos((enabled) => {
        this.setShowRepositoryPhotos(enabled);
        this.onUpdatePhotosColumnVisibility();

        if (enabled) {
          // Mark as loading to show spinners and reset sync completed flag
          this.setIsLoadingRepositoryPhotos(true);
          this.setRepositorySyncCompleted(false);
          // Display users immediately with loading spinners
          this.onDisplayUsers(this.getCurrentUsers(), this.getAllUsers());
        }

        // Load repository data if enabling and not already loaded
        if (enabled && this.getCurrentUsers().length > 0) {
          // Check if repository data is actually loaded (not just the property exists)
          const hasRepositoryData = this.getCurrentUsers().some(u => u.repository_image_path);
          if (!hasRepositoryData) {
            this.onLoadRepositoryData(this.getCurrentUsers());
          } else {
            // Data already loaded, stop loading state and mark sync as completed
            this.setIsLoadingRepositoryPhotos(false);
            this.setRepositorySyncCompleted(true);
            // Re-display with actual data (no spinners)
            this.onDisplayUsers(this.getCurrentUsers(), this.getAllUsers());
          }
        } else if (!enabled) {
          // If disabling, stop loading state
          this.setIsLoadingRepositoryPhotos(false);
          this.onDisplayUsers(this.getCurrentUsers(), this.getAllUsers());
        }
      });

      // Toggle repository indicators
      this.electronAPI.onMenuToggleRepositoryIndicators((enabled) => {
        this.setShowRepositoryIndicators(enabled);
        this.onUpdatePhotosColumnVisibility();

        if (enabled) {
          // Mark as loading to show spinners and reset sync completed flag
          this.setIsLoadingRepositoryIndicators(true);
          this.setRepositorySyncCompleted(false);
          // Display users immediately with loading spinners
          this.onDisplayUsers(this.getCurrentUsers(), this.getAllUsers());
        }

        // Load repository data if enabling and not already loaded
        if (enabled && this.getCurrentUsers().length > 0) {
          // Check if repository data is actually loaded (not just the property exists)
          const hasRepositoryData = this.getCurrentUsers().some(u => u.repository_image_path);
          if (!hasRepositoryData) {
            this.onLoadRepositoryData(this.getCurrentUsers());
          } else {
            // Data already loaded, stop loading state and mark sync as completed
            this.setIsLoadingRepositoryIndicators(false);
            this.setRepositorySyncCompleted(true);
            // Re-display with actual data (no spinners)
            this.onDisplayUsers(this.getCurrentUsers(), this.getAllUsers());
          }
        } else if (!enabled) {
          // If disabling, stop loading state
          this.setIsLoadingRepositoryIndicators(false);
          this.onDisplayUsers(this.getCurrentUsers(), this.getAllUsers());
        }
      });
    }

    /**
     * Setup export listeners
     */
    setupExportListeners() {
      this.electronAPI.onMenuImportImagesId(() => {
        this.onImportImagesId();
      });

      this.electronAPI.onMenuExportCSV(() => {
        this.onExportCSV();
      });

      this.electronAPI.onMenuExportInventoryCSV(() => {
        this.onExportInventoryCSV();
      });

      this.electronAPI.onMenuExportImages(() => {
        this.onExportImages();
      });

      this.electronAPI.onMenuExportImagesName(() => {
        this.onExportImagesName();
      });

      this.electronAPI.onMenuExportToRepository(() => {
        this.onExportToRepository();
      });

      this.electronAPI.onMenuExportOrlaPDF(() => {
        this.onExportOrlaPDF();
      });
    }

    /**
     * Setup image tag listeners
     */
    setupImageTagListeners() {
      this.electronAPI.onMenuAddImageTag(() => {
        this.onAddImageTag();
      });

      this.electronAPI.onMenuShowTaggedImages(() => {
        this.onShowTaggedImages();
      });
    }

    /**
     * Setup UI toggle listeners
     */
    setupUIToggles() {
      this.electronAPI.onMenuToggleAdditionalActions((enabled) => {
        if (this.additionalActionsSection) {
          this.additionalActionsSection.style.display = enabled ? 'block' : 'none';
        }
      });
    }

    /**
     * Check if initialized
     * @returns {boolean} True if initialized
     */
    getIsInitialized() {
      return this.isInitialized;
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MenuEventManager };
  } else if (typeof window !== 'undefined') {
    global.MenuEventManager = MenuEventManager;
  }
})(typeof window !== 'undefined' ? window : global);
