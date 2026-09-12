// Architecture modules are loaded via script tags in index.html
// Available globals: store, BaseModal, NewProjectModal, ConfirmModal, InfoModal, UserImageModal, UserRowRenderer, VirtualScrollManager, ImageGridManager, ExportManager, OrlaExportManager, ExportOptionsModal, InventoryExportOptionsModal, AddTagModal, ImageTagsManager, SelectionModeManager, DragDropManager, ProgressManager, LazyImageManager, KeyboardNavigationManager, MenuEventManager, UserDataManager, ProjectManager

// Component instances
let userRowRenderer = null;
let imageGridManager = null;
let exportManager = null;
let orlaExportManager = null;
let imageTagsManager = null;
let selectionModeManager = null;
let dragDropManager = null;
let progressManager = null;
let lazyImageManager = null;
let keyboardNavigationManager = null;
let menuEventManager = null;
let userDataManager = null;
let projectManager = null;

// State management
let currentUsers = [];
let allUsers = []; // All users from database for duplicate checking
let currentGroups = [];
let selectedUser = null;
let projectOpen = false;
let showDuplicatesOnly = false;
let showCardPrintRequestsOnly = false;
let showPublicationRequestsOnly = false;
let showCapturedPhotos = true;
let showRepositoryPhotos = false;  // Default to false to avoid blocking on Google Drive
let showRepositoryIndicators = false;  // Default to false to avoid blocking on Google Drive
let showAdditionalActions = true;  // Show/hide additional actions section and related indicators
let isLoadingRepositoryPhotos = false;  // Track if repository photos are being loaded
let isLoadingRepositoryIndicators = false;  // Track if repository indicators are being loaded
let repositorySyncCompleted = false;  // Track if initial repository sync has completed
// Bumped whenever the repository changes. Repository files keep their name when
// the mirror overwrites them, so this is what makes their image URLs change.
let repositoryImageVersion = 0;

// Selection mode state (deprecated - now managed by SelectionModeManager)
// Kept for backward compatibility during transition
let selectionMode = false;
let selectedUsers = new Set(); // Store selected user IDs

// Card print requests
let cardPrintRequests = new Set(); // Store user IDs with pending card print requests
let publicationRequests = new Set(); // Store user IDs with pending publication requests

// Virtual scrolling
let virtualScrollManager = null;
let displayedUsers = []; // Currently displayed users (filtered/duplicates)

// DOM Elements
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const groupFilter = document.getElementById('group-filter');
const userTableBody = document.getElementById('user-table-body');
const photosColumnHeader = document.getElementById('photos-column-header');
const selectedUserInfo = document.getElementById('selected-user-info');
const userCount = document.getElementById('user-count');
const linkBtn = document.getElementById('link-btn');
const payOrlaBtn = document.getElementById('pay-orla-btn');
const importReceiptBtn = document.getElementById('import-receipt-btn');
const duplicatesAlert = document.getElementById('duplicates-alert');
const duplicatesCount = document.getElementById('duplicates-count');
const cardPrintAlert = document.getElementById('card-print-alert');
const cardPrintCount = document.getElementById('card-print-count');
const publicationAlert = document.getElementById('publication-alert');
const publicationCount = document.getElementById('publication-count');
const imagePreviewContainer = document.getElementById('image-preview-container');
const currentImage = document.getElementById('current-image');
const prevImageBtn = document.getElementById('prev-image');
const nextImageBtn = document.getElementById('next-image');
const loadingSpinner = document.getElementById('loading-spinner');
const noProjectPlaceholder = document.getElementById('no-project-placeholder');

// Modal DOM elements (legacy - will be replaced by modal instances)
const progressModal = document.getElementById('progress-modal');

// Modal instances (new architecture)
let newProjectModalInstance = null;
let confirmModalInstance = null;
let infoModalInstance = null;
let exportOptionsModalInstance = null;
let inventoryExportOptionsModalInstance = null;
let addTagModalInstance = null;
let userImageModalInstance = null;
let orlaExportModalInstance = null;
let restoreBackupModalInstance = null;
let preferencesModalInstance = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Initialize modal instances
  initializeModals();

  // Initialize user row renderer
  initializeUserRowRenderer();

  // Initialize virtual scroll manager
  initializeVirtualScroll();

  // Initialize image grid manager
  initializeImageGridManager();

  // Initialize export manager
  initializeExportManager();

  // Initialize orla export manager
  initializeOrlaExportManager();

  // Initialize image tags manager
  initializeImageTagsManager();

  // Initialize selection mode manager
  initializeSelectionModeManager();

  // Initialize drag and drop manager
  initializeDragDropManager();

  // Initialize progress manager
  initializeProgressManager();

  // Initialize lazy image manager
  initializeLazyImageManager();

  // Initialize keyboard navigation manager
  initializeKeyboardNavigationManager();

  // Initialize menu event manager
  initializeMenuEventManager();

  // Initialize user data manager
  initializeUserDataManager();

  // Initialize project manager
  initializeProjectManager();

  initializeEventListeners();
  // Defer camera detection to not block UI
  setTimeout(() => detectAvailableCameras(), 100);
  // Show no project placeholder initially
  updateNoProjectPlaceholder();
});

// Initialize modal instances
function initializeModals() {
  newProjectModalInstance = new NewProjectModal({
    showProgressModal: showProgressModal,
    closeProgressModal: closeProgressModal
  });
  newProjectModalInstance.init();

  confirmModalInstance = new ConfirmModal();
  confirmModalInstance.init();

  infoModalInstance = new InfoModal();
  infoModalInstance.init();

  exportOptionsModalInstance = new ExportOptionsModal();
  exportOptionsModalInstance.init();

  inventoryExportOptionsModalInstance = new InventoryExportOptionsModal();
  inventoryExportOptionsModalInstance.init();

  addTagModalInstance = new AddTagModal();
  addTagModalInstance.init();

  userImageModalInstance = new UserImageModal();
  // UserImageModal initializes itself in constructor

  orlaExportModalInstance = new OrlaExportModal();
  orlaExportModalInstance.init();

  restoreBackupModalInstance = new RestoreBackupModal();
  restoreBackupModalInstance.init();

  preferencesModalInstance = new PreferencesModal();
  preferencesModalInstance.init();
}

// Initialize user row renderer
function initializeUserRowRenderer() {
  userRowRenderer = new UserRowRenderer({
    showCapturedPhotos: showCapturedPhotos,
    showRepositoryPhotos: showRepositoryPhotos,
    showRepositoryIndicators: showRepositoryIndicators,
    showAdditionalActions: showAdditionalActions,
    isLoadingRepositoryPhotos: isLoadingRepositoryPhotos,
    isLoadingRepositoryIndicators: isLoadingRepositoryIndicators,
    selectionMode: selectionMode,
    selectedUsers: selectedUsers,
    cardPrintRequests: cardPrintRequests,
    publicationRequests: publicationRequests,
    onUserSelect: (row, user) => selectUserRow(row, user),
    onUserContextMenu: (e, user, row) => showContextMenu(e, user, row),
    onImagePreview: (user, type) => showUserImageModal(user, type),
    onCheckboxToggle: (userId, checked) => toggleUserSelection(userId, checked)
  });
}

// Initialize virtual scroll manager
function initializeVirtualScroll() {
  const container = document.getElementById('table-container');
  const tbody = document.getElementById('user-table-body');

  virtualScrollManager = new VirtualScrollManager({
    // Starting estimate only: a row with a photo indicator is 32px plus 12px of
    // padding either side and the bottom border. The manager measures the real
    // height once rows exist, which is what handles rows without indicators.
    itemHeight: 57,
    bufferSize: 10,
    minItemsForVirtualization: 50,
    container: container,
    tbody: tbody,
    createRowCallback: (user) => createUserRow(user, window._imageCountCache || {}),
    observeImagesCallback: () => observeLazyImages()
  });

  virtualScrollManager.init();
}

// Initialize image grid manager
function initializeImageGridManager() {
  imageGridManager = new ImageGridManager({
    imagePreviewContainer: imagePreviewContainer,
    currentImage: currentImage,
    getImages: () => window.electronAPI.getImages(),
    onImageChange: async (imagePath) => {
      // Load and display tags for current image
      await loadImageTags();
      // Update link button state
      updateLinkButtonState();
    }
  });

}

// Initialize export manager
function initializeExportManager() {
  exportManager = new ExportManager({
    exportOptionsModal: exportOptionsModalInstance,
    inventoryExportOptionsModal: inventoryExportOptionsModalInstance,
    confirmModal: confirmModalInstance,
    showProgressModal: showProgressModal,
    closeProgressModal: closeProgressModal,
    showInfoModal: showInfoModal,
    showOpenDialog: (options) => window.electronAPI.showOpenDialog(options),
    getProjectOpen: () => projectOpen,
    getSelectionMode: () => selectionMode,
    getSelectedUsers: () => selectedUsers,
    getDisplayedUsers: () => displayedUsers,
    getCurrentUsers: () => currentUsers,
    getShowDuplicatesOnly: () => showDuplicatesOnly,
    getAllUsers: () => allUsers,
    getCurrentFilters: getCurrentFilters,
    onExportComplete: async () => {
      // Reload users to refresh the repository check indicators
      await loadUsers(getCurrentFilters());
    },
    electronAPI: window.electronAPI
  });

}

// Initialize orla export manager
function initializeOrlaExportManager() {
  orlaExportManager = new OrlaExportManager({
    orlaExportModal: orlaExportModalInstance,
    showProgressModal: showProgressModal,
    closeProgressModal: closeProgressModal,
    showInfoModal: showInfoModal,
    showOpenDialog: (options) => window.electronAPI.showOpenDialog(options),
    getProjectOpen: () => projectOpen,
    getAllUsers: () => allUsers,
    getAllGroups: () => currentGroups,
    onExportComplete: () => {
      // Orla export doesn't need to reload users
    },
    electronAPI: window.electronAPI
  });

}

// Initialize image tags manager
function initializeImageTagsManager() {
  imageTagsManager = new ImageTagsManager({
    addTagModal: addTagModalInstance,
    showInfoModal: showInfoModal,
    imageGridManager: imageGridManager,
    getProjectOpen: () => projectOpen,
    electronAPI: window.electronAPI,
    tagsContainer: document.getElementById('image-tags-container'),
    tagsList: document.getElementById('image-tags-list'),
    taggedImagesModal: document.getElementById('tagged-images-modal'),
    taggedImagesContainer: document.getElementById('tagged-images-container'),
    taggedImagesCloseBtn: document.getElementById('tagged-images-close-btn')
  });

}

// Initialize selection mode manager
function initializeSelectionModeManager() {
  selectionModeManager = new SelectionModeManager({
    onSelectionChange: (isActive, selected) => {
      // Sync with global state for backward compatibility
      selectionMode = isActive;
      selectedUsers = selected;

      // Rows read this from the config, so setting the properties directly
      // would have no effect on what gets rendered
      syncUserRowRendererConfig();
    },
    getDisplayedUsers: () => displayedUsers,
    reRenderUsers: () => {
      // Force re-render to update checkboxes when selection mode changes
      syncUserRowRendererConfig();

      if (virtualScrollManager) {
        virtualScrollManager.forceRerender();
      } else {
        displayUsers(currentUsers, allUsers);
      }

      restoreSelectedRowHighlight();
    },
    syncCheckboxes: (selected) => {
      if (!userTableBody) return;

      // Ticking boxes does not change anything else about a row, so the rows
      // are updated in place instead of being rebuilt
      userTableBody.querySelectorAll('tr[data-user-id]').forEach(row => {
        const checkbox = row.querySelector('.user-checkbox');
        if (checkbox) {
          checkbox.checked = selected.has(Number(row.dataset.userId));
        }
      });
    },
    onRequestCardPrint: handleRequestCardPrint,
    onRequestPublication: handleRequestPublication,
    onUnpayOrla: handleUnpayOrla,
    onUnprintReceipt: handleUnprintReceipt,
    selectedUserInfo: selectedUserInfo,
    tableHeader: document.querySelector('.user-table thead tr')
  });

}

// Initialize drag and drop manager
function initializeDragDropManager() {
  dragDropManager = new DragDropManager({
    dropZone: document.querySelector('.image-container'),
    showInfoModal: showInfoModal,
    moveImageToIngest: (path) => window.electronAPI.moveImageToIngest(path)
  });

  dragDropManager.enable();
}

// Initialize progress manager
function initializeProgressManager() {
  progressManager = new ProgressManager({
    modal: progressModal,
    electronAPI: window.electronAPI
  });

  progressManager.setupListener();
}

// Initialize lazy image manager
function initializeLazyImageManager() {
  lazyImageManager = new LazyImageManager();
  lazyImageManager.init();
}

// Initialize keyboard navigation manager
function initializeKeyboardNavigationManager() {
  keyboardNavigationManager = new KeyboardNavigationManager({
    onNavigateUserPrev: () => navigateUsers(-1),
    onNavigateUserNext: () => navigateUsers(1),
    onNavigateImagePrev: () => {
      if (imageGridManager) {
        imageGridManager.previous();
      }
    },
    onNavigateImageNext: () => {
      if (imageGridManager) {
        imageGridManager.next();
      }
    },
    isModalOpen: () => {
      return (
        (newProjectModalInstance && newProjectModalInstance.modal && newProjectModalInstance.modal.classList.contains('show')) ||
        (confirmModalInstance && confirmModalInstance.modal && confirmModalInstance.modal.classList.contains('show')) ||
        (progressModal && progressModal.classList.contains('show')) ||
        (infoModalInstance && infoModalInstance.modal && infoModalInstance.modal.classList.contains('show'))
      );
    },
    hasImages: () => imageGridManager && imageGridManager.getImageCount() > 0
  });

  keyboardNavigationManager.enable();
}

// Initialize menu event manager
function initializeMenuEventManager() {
  menuEventManager = new MenuEventManager({
    // State setters
    setShowDuplicatesOnly: (value) => {
      showDuplicatesOnly = value;
      updateAlertBadges(); // Update badge visibility when filter changes
    },
    setShowCardPrintRequestsOnly: (value) => {
      showCardPrintRequestsOnly = value;
      updateAlertBadges(); // Update badge visibility when filter changes
    },
    setShowPublicationRequestsOnly: (value) => {
      showPublicationRequestsOnly = value;
      updateAlertBadges(); // Update badge visibility when filter changes
    },
    setShowCapturedPhotos: (value) => { showCapturedPhotos = value; },
    setShowRepositoryPhotos: (value) => { showRepositoryPhotos = value; },
    setShowRepositoryIndicators: (value) => { showRepositoryIndicators = value; },
    setShowAdditionalActions: (value) => { showAdditionalActions = value; },
    setIsLoadingRepositoryPhotos: (value) => { isLoadingRepositoryPhotos = value; },
    setIsLoadingRepositoryIndicators: (value) => { isLoadingRepositoryIndicators = value; },
    setRepositorySyncCompleted: (value) => { repositorySyncCompleted = value; },
    setProjectOpen: (value) => { projectOpen = value; },

    // State getters
    getCurrentUsers: () => currentUsers,
    getAllUsers: () => allUsers,
    getCurrentFilters: getCurrentFilters,

    // Action callbacks
    onNewProject: openNewProjectModal,
    onOpenProject: handleOpenProject,
    onCloseProject: handleCloseProject,
    onProjectLoaded: loadProjectData,
    onLinkImage: handleLinkImage,
    onDeletePhoto: handleDeletePhoto,
    onImportImagesId: handleImportImagesId,
    onExportCSV: handleExportCSV,
    onExportInventoryCSV: handleExportInventoryCSV,
    onExportImages: handleExportImages,
    onExportImagesName: handleExportImagesName,
    onExportToRepository: handleExportToRepository,
    onExportOrlaPDF: handleExportOrlaPDF,
    onExportPaidOrlaPDF: handleExportPaidOrlaPDF,
    onExportPaidUsersCSV: handleExportPaidUsersCSV,
    onUpdateXML: handleUpdateXML,
    onAddImageTag: handleAddImageTag,
    onShowTaggedImages: handleShowTaggedImages,

    // Display callbacks
    onDisplayUsers: displayUsers,
    onUpdatePhotosColumnVisibility: updatePhotosColumnVisibility,
    onUpdateUserRowRenderer: updateUserRowRendererConfig,
    onLoadUsers: loadUsers,
    onLoadRepositoryData: loadRepositoryDataInBackground,

    // DOM elements
    additionalActionsSection: document.querySelector('.additional-actions'),

    // IPC API
    electronAPI: window.electronAPI
  });

  menuEventManager.init();
}

// Initialize user data manager
function initializeUserDataManager() {
  userDataManager = new UserDataManager({
    // State setters
    setCurrentUsers: (users) => { currentUsers = users; },
    setAllUsers: (users) => { allUsers = users; },
    setCurrentGroups: (groups) => { currentGroups = groups; },
    setIsLoadingRepositoryPhotos: (value) => { isLoadingRepositoryPhotos = value; },
    setIsLoadingRepositoryIndicators: (value) => { isLoadingRepositoryIndicators = value; },
    setRepositorySyncCompleted: (value) => { repositorySyncCompleted = value; },

    // State getters
    getCurrentUsers: () => currentUsers,
    getAllUsers: () => allUsers,
    getCurrentGroups: () => currentGroups,
    getShowCapturedPhotos: () => showCapturedPhotos,
    getShowRepositoryPhotos: () => showRepositoryPhotos,
    getShowRepositoryIndicators: () => showRepositoryIndicators,

    // Callbacks
    onDisplayUsers: displayUsers,
    onUpdateUserCount: updateUserCount,
    onUpdateCardPrintRequests: (requests) => {
      cardPrintRequests = requests;
      updateAlertBadges();
    },
    onUpdatePublicationRequests: (requests) => {
      publicationRequests = requests;
      updateAlertBadges();
    },
    onUpdateUserRowRenderer: (config) => {
      if (userRowRenderer) {
        userRowRenderer.updateConfig(config);
      }
    },

    // DOM elements
    groupFilter: groupFilter,
    loadingSpinner: loadingSpinner,
    noProjectPlaceholder: noProjectPlaceholder,
    userTableBody: userTableBody,

    // IPC API
    electronAPI: window.electronAPI
  });

}

function initializeProjectManager() {
  projectManager = new ProjectManager({
    // State setters
    setProjectOpen: (value) => { projectOpen = value; },
    setCurrentUsers: (users) => { currentUsers = users; },
    setAllUsers: (users) => { allUsers = users; },
    setCurrentGroups: (groups) => { currentGroups = groups; },
    setSelectedUser: (user) => { selectedUser = user; },

    // State getters
    getProjectOpen: () => projectOpen,

    // Callbacks
    onLoadGroups: loadGroups,
    onLoadUsers: loadUsers,
    onLoadImages: loadImages,
    onClearImages: clearImages,
    onUpdateStatusBar: updateStatusBar,
    onUpdateWindowTitle: updateWindowTitle,
    onGetCurrentFilters: getCurrentFilters,
    onShowInfoModal: showInfoModal,
    onShowConfirmModal: showConfirmationModal,
    onShowProgressModal: showProgressModal,
    onCloseProgressModal: closeProgressModal,
    onUpdateLastFilterValue: updateLastFilterValue,

    // DOM elements
    searchInput: searchInput,
    groupFilter: groupFilter,
    noProjectPlaceholder: noProjectPlaceholder,

    // Modal instances
    newProjectModal: newProjectModalInstance,

    // IPC API
    electronAPI: window.electronAPI
  });

}

// Group filter state (needs to be accessible from ProjectManager)
let lastFilterValue = groupFilter.value; // Track last value to detect actual changes

// Function to update lastFilterValue when filter is programmatically changed
function updateLastFilterValue(value) {
  lastFilterValue = value;
}

// Search debounce: each search reloads the user list over IPC and repaints the
// table, so keystrokes are coalesced instead of triggering one reload each
const SEARCH_DEBOUNCE_MS = 250;
let searchDebounceTimer = null;

function cancelPendingSearch() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }
}

// Event Listeners
function initializeEventListeners() {
  // Search and filter
  searchInput.addEventListener('input', () => {
    toggleClearButton();
    cancelPendingSearch();
    searchDebounceTimer = setTimeout(() => {
      searchDebounceTimer = null;
      filterUsers();
    }, SEARCH_DEBOUNCE_MS);
  });
  clearSearchBtn.addEventListener('click', clearSearch);

  groupFilter.addEventListener('change', async () => {
    const newValue = groupFilter.value;

    // Only process if value actually changed
    if (newValue === lastFilterValue) {
      return;
    }

    lastFilterValue = newValue;

    // Save filter selection and broadcast to other windows
    await window.electronAPI.setSelectedGroupFilter(newValue);
    cancelPendingSearch();
    await filterUsers();
  });

  // Listen for group filter changes from other windows
  window.electronAPI.onGroupFilterChanged(async (groupCode) => {
    // Only update if the value is actually different to avoid unnecessary reloads
    if (groupFilter.value !== groupCode) {
      lastFilterValue = groupCode;
      groupFilter.value = groupCode;
      await filterUsers();
    }
  });

  // Listen for card print requests filter toggle from menu
  window.electronAPI.onMenuToggleCardPrintRequests((enabled) => {
    showCardPrintRequestsOnly = enabled;
    // Exclusive filter: disable others when this is enabled
    if (enabled) {
      showDuplicatesOnly = false;
      showPublicationRequestsOnly = false;
    }
    updateAlertBadges(); // Update badge visibility based on filter state
    displayUsers(currentUsers, allUsers);
  });

  // Listen for publication requests filter toggle from menu
  window.electronAPI.onMenuTogglePublicationRequests((enabled) => {
    showPublicationRequestsOnly = enabled;
    // Exclusive filter: disable others when this is enabled
    if (enabled) {
      showDuplicatesOnly = false;
      showCardPrintRequestsOnly = false;
    }
    updateAlertBadges(); // Update badge visibility based on filter state
    displayUsers(currentUsers, allUsers);
  });

  // Alert badge click handlers
  // Note: We only send IPC to main, which will update menu and send back the new state
  if (cardPrintAlert) {
    cardPrintAlert.addEventListener('click', () => {
      const newValue = !showCardPrintRequestsOnly;
      if (menuEventManager) {
        menuEventManager.triggerCardPrintRequestsFilter(newValue);
      }
    });
  }

  if (publicationAlert) {
    publicationAlert.addEventListener('click', () => {
      const newValue = !showPublicationRequestsOnly;
      if (menuEventManager) {
        menuEventManager.triggerPublicationRequestsFilter(newValue);
      }
    });
  }

  if (duplicatesAlert) {
    duplicatesAlert.addEventListener('click', () => {
      const newValue = !showDuplicatesOnly;
      if (menuEventManager) {
        menuEventManager.triggerDuplicatesFilter(newValue);
      }
    });
  }

  // Action buttons
  linkBtn.addEventListener('click', handleLinkImage);

  if (payOrlaBtn) {
    payOrlaBtn.addEventListener('click', handlePayOrla);
  }

  if (importReceiptBtn) {
    importReceiptBtn.addEventListener('click', handlePrintReceipt);
  }

  // Image navigation
  prevImageBtn.addEventListener('click', () => {
    if (imageGridManager) {
      imageGridManager.previous();
    }
  });
  nextImageBtn.addEventListener('click', () => {
    if (imageGridManager) {
      imageGridManager.next();
    }
  });

  // Note: Modal buttons (new project, confirm, info) are handled by modal classes

  // Variable to track blinking interval
  let blinkInterval = null;

  // Listen for image being processed (before it's copied)
  window.electronAPI.onImageDetecting((filename) => {
    // Start blinking the image preview container
    if (!blinkInterval) {
      blinkInterval = setInterval(() => {
        if (imageGridManager) {
          imageGridManager.setDetecting(true);
        }
        setTimeout(() => {
          if (imageGridManager) {
            imageGridManager.setDetecting(false);
          }
        }, 150);
      }, 300); // Blink every 300ms
    }
  });

  // Listen for new images (after processing is complete)
  window.electronAPI.onNewImageDetected(async (filename) => {
    // Stop blinking
    if (blinkInterval) {
      clearInterval(blinkInterval);
      blinkInterval = null;
      if (imageGridManager) {
        imageGridManager.setDetecting(false);
      }
    }

    if (imageGridManager) {
      await imageGridManager.loadImages(true);
    }
  });

  // Listen for repository changes
  window.electronAPI.onRepositoryChanged(async (data) => {
    // Mark repository sync as completed
    repositorySyncCompleted = true;

    // Invalidate cached repository images before anything re-renders
    repositoryImageVersion++;
    if (userRowRenderer) {
      userRowRenderer.updateConfig({ repositoryVersion: repositoryImageVersion });
    }

    // Refresh only repository indicators to preserve scroll position
    if (userDataManager && userRowRenderer) {
      await userDataManager.refreshRepositoryIndicators((updatedUsers) => {
        // Update repository indicators in existing rows
        userRowRenderer.updateRepositoryIndicators(userTableBody, updatedUsers);
        // Trigger lazy image observation for new repository images
        if (lazyImageManager) {
          lazyImageManager.observeAll();
        }
      });
    } else {
      // Fallback to full reload if managers not initialized
      const filters = getCurrentFilters();
      await loadUsers(filters);
    }
  });

  // Listen for repository path changes
  window.electronAPI.onRepositoryPathChanged(async () => {
    // Update status bar to reflect the new repository path
    await updateStatusBar();
  });

  // About modal
  const aboutModal = document.getElementById('about-modal');
  const aboutVersionEl = document.getElementById('about-version');
  const aboutCloseBtn = document.getElementById('about-close-btn');

  // Listen for menu event to show about modal
  window.electronAPI.onMenuShowAbout(async () => {
    // Get and display version
    const version = await window.electronAPI.getAppVersion();
    aboutVersionEl.textContent = `Versión ${version}`;

    // Show modal
    aboutModal.classList.add('show');
  });

  // Close about modal
  if (aboutCloseBtn) {
    aboutCloseBtn.addEventListener('click', () => {
      aboutModal.classList.remove('show');
    });
  }

  // Close on escape key
  aboutModal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      aboutModal.classList.remove('show');
    }
  });

  // Close on backdrop click
  aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) {
      aboutModal.classList.remove('show');
    }
  });

  // Listen for restore image links menu event
  window.electronAPI.onMenuRestoreImageLinks(async () => {
    await handleRestoreImageLinks();
  });

  // Listen for preferences menu event
  window.electronAPI.onMenuPreferences(async () => {
    await handlePreferences();
  });

  // Keyboard navigation is now handled by KeyboardNavigationManager
}

// Project management - delegates to ProjectManager
async function openNewProjectModal() {
  if (projectManager) {
    await projectManager.openNewProject();
  }
}

async function handleOpenProject() {
  if (projectManager) {
    await projectManager.openExistingProject();
  }
}

async function handleCloseProject() {
  if (projectManager) {
    await projectManager.closeProject();
  }
}

async function loadProjectData() {
  if (projectManager) {
    await projectManager.loadProjectData();
  }
}

function updateNoProjectPlaceholder() {
  if (projectManager) {
    projectManager.updateNoProjectPlaceholder();
  }
}

async function loadGroups() {
  if (userDataManager) {
    await userDataManager.loadGroups();
  }
}

async function loadUsers(filters = {}, options = {}) {
  if (userDataManager) {
    await userDataManager.loadUsers(filters, options);
    // Update linked photos count after loading users
    await updateCapturedPhotosCount();
  }
}

async function loadRepositoryDataInBackground(users) {
  if (userDataManager) {
    await userDataManager.loadRepositoryDataInBackground(users);
  }
}

function updateRepositoryDataInDisplay() {
  if (userDataManager) {
    userDataManager.updateRepositoryDataInDisplay();
  }
}

async function displayUsers(users, allUsers = null) {
  // If checking for duplicates, we need to count against all users in database
  const usersForCounting = allUsers || users;

  // Check for duplicate images
  const imageCount = {};
  usersForCounting.forEach(user => {
    if (user.image_path) {
      imageCount[user.image_path] = (imageCount[user.image_path] || 0) + 1;
    }
  });

  // Note: Duplicates filter is now managed via badge, not checkbox

  // Apply filters
  let usersToDisplay = users;
  if (showDuplicatesOnly && allUsers) {
    // Show all users with duplicates from the entire database
    usersToDisplay = allUsers.filter(user => user.image_path && imageCount[user.image_path] > 1);
  } else if (showDuplicatesOnly) {
    // Fallback if allUsers not available
    usersToDisplay = users.filter(user => user.image_path && imageCount[user.image_path] > 1);
  } else if (showCardPrintRequestsOnly) {
    // Show only users with pending card print requests (ignore group filter)
    const sourceUsers = allUsers || users;
    usersToDisplay = sourceUsers.filter(user => {
      const userId = user.type === 'student' ? user.nia : user.document;
      return userId && cardPrintRequests.has(userId);
    });
  } else if (showPublicationRequestsOnly) {
    // Show only users with pending publication requests (ignore group filter)
    const sourceUsers = allUsers || users;
    usersToDisplay = sourceUsers.filter(user => {
      const userId = user.type === 'student' ? user.nia : user.document;
      return userId && publicationRequests.has(userId);
    });
  }

  // Store displayed users and image count for virtual scrolling
  displayedUsers = usersToDisplay;

  // Store imageCount globally for row rendering
  window._imageCountCache = imageCount;

  // Once for the whole batch rather than once per row
  syncUserRowRendererConfig();

  // Use virtual scroll manager to render users
  if (virtualScrollManager) {
    virtualScrollManager.setItems(displayedUsers);
  }

  restoreSelectedRowHighlight();
}

/**
 * Push the current display state into the row renderer
 *
 * Rows read this while being built, so it has to be current before a render
 * starts. Doing it here means one object per batch instead of one per row.
 */
function syncUserRowRendererConfig() {
  if (!userRowRenderer) return;

  userRowRenderer.updateConfig({
    showCapturedPhotos: showCapturedPhotos,
    showRepositoryPhotos: showRepositoryPhotos,
    showRepositoryIndicators: showRepositoryIndicators,
    showAdditionalActions: showAdditionalActions,
    isLoadingRepositoryPhotos: isLoadingRepositoryPhotos,
    isLoadingRepositoryIndicators: isLoadingRepositoryIndicators,
    selectionMode: selectionMode,
    selectedUsers: selectedUsers
  });
}

/**
 * Re-mark the selected row after a render
 *
 * Rows are rebuilt from scratch, so the highlight would otherwise disappear
 * whenever anything refreshed the table under the user.
 */
function restoreSelectedRowHighlight() {
  if (!selectedUser || !userTableBody) return;

  const row = userTableBody.querySelector(`tr[data-user-id="${selectedUser.id}"]`);
  if (row) {
    row.classList.add('selected');
    selectedRowElement = row;
  }
}

// Create a user row element (uses UserRowRenderer)
// Config is refreshed once per batch by syncUserRowRendererConfig, not here
function createUserRow(user, imageCount) {
  if (userRowRenderer) {
    return userRowRenderer.createRow(user, imageCount);
  }

  // Fallback if renderer not initialized
  console.warn('[Renderer] UserRowRenderer not initialized');
  const row = document.createElement('tr');
  row.textContent = 'Error: Row renderer not initialized';
  return row;
}

// Row currently carrying the 'selected' class, kept so deselecting does not
// have to walk every row in the table
let selectedRowElement = null;

function updateSelectedUserInfo(user) {
  selectedUser = user;

  if (selectionModeManager) {
    selectionModeManager.setCurrentSelectedUser(user);
  } else {
    // Fallback
    const fullName = `${user.first_name} ${user.last_name1} ${user.last_name2 || ''}`;
    selectedUserInfo.textContent = fullName;
  }

  // Enable link button if image is selected
  updateLinkButtonState();
}

function selectUserRow(row, user) {
  // Remove previous selection
  if (selectedRowElement && selectedRowElement !== row) {
    selectedRowElement.classList.remove('selected');
  }

  // Select new row
  row.classList.add('selected');
  selectedRowElement = row;

  updateSelectedUserInfo(user);
}

function updateUserCount() {
  // Update old status bar (if exists)
  if (userCount) {
    userCount.textContent = `Listo. ${currentUsers.length} usuarios cargados.`;
  }

  // Update new status bar
  const statusUsers = document.getElementById('status-users');
  if (statusUsers) {
    statusUsers.textContent = `${currentUsers.length} usuarios cargados`;
  }

  // Update alert badges
  updateAlertBadges();
}

/**
 * Update alert badges for pending requests
 */
function updateAlertBadges() {
  const cardPrintRequestsCount = cardPrintRequests.size;
  const publicationRequestsCount = publicationRequests.size;

  // Calculate duplicates count. displayUsers already counted image usage over
  // the same set, so reuse it rather than walking every user twice more.
  let duplicatesCountValue = 0;
  if (allUsers && allUsers.length > 0) {
    const imageCount = window._imageCountCache || {};

    duplicatesCountValue = allUsers.reduce(
      (count, user) => count + (user.image_path && imageCount[user.image_path] > 1 ? 1 : 0),
      0
    );
  }

  if (cardPrintCount) {
    cardPrintCount.textContent = cardPrintRequestsCount;
  }
  if (cardPrintAlert) {
    // Show badge if: (count > 0) OR (count is 0 but filter is active)
    const shouldShowCardPrint = cardPrintRequestsCount > 0 || (cardPrintRequestsCount === 0 && showCardPrintRequestsOnly);
    cardPrintAlert.style.display = shouldShowCardPrint ? 'flex' : 'none';
    // Add/remove active class based on filter state
    if (showCardPrintRequestsOnly) {
      cardPrintAlert.classList.add('active');
    } else {
      cardPrintAlert.classList.remove('active');
    }
  }

  if (publicationCount) {
    publicationCount.textContent = publicationRequestsCount;
  }
  if (publicationAlert) {
    // Show badge if: (count > 0) OR (count is 0 but filter is active)
    const shouldShowPublication = publicationRequestsCount > 0 || (publicationRequestsCount === 0 && showPublicationRequestsOnly);
    publicationAlert.style.display = shouldShowPublication ? 'flex' : 'none';
    // Add/remove active class based on filter state
    if (showPublicationRequestsOnly) {
      publicationAlert.classList.add('active');
    } else {
      publicationAlert.classList.remove('active');
    }
  }

  if (duplicatesCount) {
    duplicatesCount.textContent = duplicatesCountValue;
  }
  if (duplicatesAlert) {
    // Show badge if: (count > 0) OR (count is 0 but filter is active)
    const shouldShowDuplicates = duplicatesCountValue > 0 || (duplicatesCountValue === 0 && showDuplicatesOnly);
    duplicatesAlert.style.display = shouldShowDuplicates ? 'flex' : 'none';
    // Add/remove active class based on filter state
    if (showDuplicatesOnly) {
      duplicatesAlert.classList.add('active');
    } else {
      duplicatesAlert.classList.remove('active');
    }
  }
}

/**
 * Update photos column visibility based on display preferences
 */
function updatePhotosColumnVisibility() {
  // Hide column if all three options are disabled
  const shouldShowColumn = showCapturedPhotos || showRepositoryPhotos || showRepositoryIndicators;

  const userTable = document.getElementById('user-table');
  if (userTable) {
    if (shouldShowColumn) {
      userTable.classList.remove('hide-photos-column');
    } else {
      userTable.classList.add('hide-photos-column');
    }
  }
}

/**
 * Update UserRowRenderer configuration with current display preferences
 */
function updateUserRowRendererConfig() {
  if (userRowRenderer) {
    userRowRenderer.updateConfig({
      showCapturedPhotos: showCapturedPhotos,
      showRepositoryPhotos: showRepositoryPhotos,
      showRepositoryIndicators: showRepositoryIndicators,
      showAdditionalActions: showAdditionalActions
    });
  }
}

// Search functions
function toggleClearButton() {
  if (searchInput.value.trim()) {
    clearSearchBtn.style.display = 'flex';
  } else {
    clearSearchBtn.style.display = 'none';
  }
}

async function clearSearch() {
  searchInput.value = '';
  clearSearchBtn.style.display = 'none';
  cancelPendingSearch();
  await filterUsers();
}

// Get current filters
function getCurrentFilters() {
  const searchTerm = searchInput.value.trim();
  const selectedGroup = groupFilter.value;

  const filters = {};

  // If there's a search term, search across all users (ignore group)
  if (searchTerm) {
    filters.search = searchTerm;
  } else if (selectedGroup) {
    // Only apply group filter if there's no search term
    filters.group = selectedGroup;
  }

  return filters;
}

// Filter users
async function filterUsers() {
  const filters = getCurrentFilters();
  // Changing search/group filters never alters user data, so the cached full
  // list used for duplicate detection can be reused instead of refetched
  await loadUsers(filters, { reuseAllUsers: true });
}

// Image management
// Load images - delegates to ImageGridManager
async function loadImages() {
  if (imageGridManager) {
    return await imageGridManager.loadImages(true);
  }
  return false;
}

// Clear images - delegates to ImageGridManager
function clearImages() {
  if (imageGridManager) {
    imageGridManager.clear();
  }
}

// Status Bar
async function updateStatusBar() {
  try {
    const result = await window.electronAPI.getProjectInfo();

    const statusBar = document.getElementById('status-bar');
    const statusProject = document.getElementById('status-project');
    const statusRepository = document.getElementById('status-repository');
    const statusPhotos = document.getElementById('status-photos');

    if (result.success && statusBar && statusProject && statusRepository) {
      // Show the status bar
      statusBar.style.display = 'flex';

      // Update project name (show only folder name)
      const projectName = result.projectPath.split('\\').pop() || result.projectPath.split('/').pop();
      statusProject.textContent = projectName;
      statusProject.title = result.projectPath; // Full path in tooltip

      // Update repository path (show full path)
      if (result.repositoryPath) {
        statusRepository.textContent = result.repositoryPath;
        statusRepository.title = result.repositoryPath; // Full path in tooltip
      } else {
        statusRepository.textContent = 'No configurado';
        statusRepository.title = '';
      }

      // Update captured photos count
      if (statusPhotos) {
        await updateCapturedPhotosCount();
      }
    } else if (statusBar) {
      // Hide if no project is open
      statusBar.style.display = 'none';
    }
  } catch (error) {
    console.error('Error updating status bar:', error);
  }
}

/**
 * Update linked photos count in status bar
 */
async function updateCapturedPhotosCount() {
  try {
    const statusPhotos = document.getElementById('status-photos');
    if (!statusPhotos) return;

    // Count unique linked images from all users
    if (allUsers && allUsers.length > 0) {
      const linkedImages = new Set();
      allUsers.forEach(user => {
        if (user.image_path) {
          linkedImages.add(user.image_path);
        }
      });
      statusPhotos.textContent = linkedImages.size.toString();
    } else {
      statusPhotos.textContent = '0';
    }
  } catch (error) {
    console.error('Error updating linked photos count:', error);
    const statusPhotos = document.getElementById('status-photos');
    if (statusPhotos) {
      statusPhotos.textContent = '-';
    }
  }
}

// Update window title
async function updateWindowTitle() {
  try {
    await window.electronAPI.updateWindowTitle();
  } catch (error) {
    console.error('Error updating window title:', error);
  }
}

// Show image preview - delegates to ImageGridManager
async function showImagePreview() {
  if (imageGridManager && imageGridManager.getImageCount() > 0) {
    imageGridManager.showPreview();
  }
}

// Navigate images - delegates to ImageGridManager
async function navigateImages(direction) {
  if (imageGridManager) {
    imageGridManager.navigate(direction);
  }
}

function navigateUsers(direction) {
  // Walk the list that is actually on display, not the handful of rows the
  // virtual scroll happens to have rendered, so navigation reaches every user
  if (!displayedUsers || displayedUsers.length === 0) return;

  const currentIndex = selectedUser
    ? displayedUsers.findIndex(user => user.id === selectedUser.id)
    : -1;

  let targetIndex;
  if (currentIndex === -1) {
    targetIndex = 0;
  } else {
    targetIndex = currentIndex + direction;

    // Wrap around
    if (targetIndex < 0) {
      targetIndex = displayedUsers.length - 1;
    } else if (targetIndex >= displayedUsers.length) {
      targetIndex = 0;
    }
  }

  const user = displayedUsers[targetIndex];
  if (!user) return;

  let row = userTableBody.querySelector(`tr[data-user-id="${user.id}"]`);

  // Only when the row is not rendered. scrollToIndex puts the target at the top
  // of the viewport, which on every keypress would rebuild the whole visible
  // range and restart every image; moving to the next row must not do that.
  if (!row && virtualScrollManager) {
    virtualScrollManager.scrollToIndex(targetIndex);
    virtualScrollManager.render();
    row = userTableBody.querySelector(`tr[data-user-id="${user.id}"]`);
  }

  if (row) {
    selectUserRow(row, user);
    // Scrolls only if the row is not already fully visible
    row.scrollIntoView({ block: 'nearest' });
  } else {
    // Rendered range did not reach it; keep the selection state in step anyway
    selectedUser = user;
    updateSelectedUserInfo(user);
  }
}

// Link image to user
async function handleLinkImage() {
  if (!selectedUser) {
    showInfoModal('Aviso', 'Debes seleccionar un usuario');
    return;
  }

  if (!imageGridManager || !imageGridManager.isPreviewActive()) {
    showInfoModal('Aviso', 'Debes seleccionar una imagen');
    return;
  }

  const imagePath = imageGridManager.getCurrentImagePath();

  const result = await window.electronAPI.linkImageToUser({
    userId: selectedUser.id,
    imagePath
  });

  if (result.success) {
    await loadUsers(getCurrentFilters());
  } else if (result.imageAlreadyAssigned) {
    // Image is already assigned to other user(s)
    const userList = result.assignedUsers.map(u => `${u.name} (${u.nia || 'Sin NIA'})`).join(', ');
    const message = `Esta imagen ya está asignada a: ${userList}. ¿Deseas continuar y asignarla también a ${selectedUser.first_name} ${selectedUser.last_name1}?`;

    const confirmed = await showConfirmationModal(message);
    if (confirmed) {
      const confirmResult = await window.electronAPI.confirmLinkImage({
        userId: selectedUser.id,
        imagePath
      });

      if (confirmResult.success) {
        await loadUsers(getCurrentFilters());
      } else {
        showInfoModal('Error', 'Error al enlazar la imagen: ' + confirmResult.error);
      }
    }
  } else if (result.needsConfirmation) {
    const confirmed = await showConfirmationModal(
      'El usuario ya tiene una imagen asignada. ¿Deseas reemplazarla?'
    );

    if (confirmed) {
      const confirmResult = await window.electronAPI.confirmLinkImage({
        userId: selectedUser.id,
        imagePath
      });

      if (confirmResult.success) {
        await loadUsers(getCurrentFilters());
      } else {
        showInfoModal('Error', 'Error al enlazar la imagen: ' + confirmResult.error);
      }
    }
  } else {
    showInfoModal('Error', 'Error al enlazar la imagen: ' + result.error);
  }
}

// Handle orla payment
async function handlePayOrla() {
  if (!selectedUser) {
    showInfoModal('Aviso', 'Debes seleccionar un usuario');
    return;
  }

  try {
    // Get current payment status
    const statusResult = await window.electronAPI.getOrlaPaidStatus(selectedUser.id);

    if (!statusResult.success) {
      showInfoModal('Error', statusResult.error || 'Error al obtener el estado de pago');
      return;
    }

    const currentStatus = statusResult.isPaid;
    const newStatus = !currentStatus;
    const action = newStatus ? 'marcar como pagado' : 'desmarcar como pagado';

    // Confirm action
    const confirmed = await showConfirmationModal(
      `¿Deseas ${action} la orla de ${selectedUser.first_name} ${selectedUser.last_name1}?`
    );

    if (!confirmed) {
      return;
    }

    // Mark as paid/unpaid
    const result = await window.electronAPI.markOrlaPaid(selectedUser.id, newStatus);

    if (result.success) {
      // Update the user's paid status in the current data
      selectedUser.orla_paid = newStatus ? 1 : 0;

      // Update the paid status in currentUsers array
      const userIndex = currentUsers.findIndex(u => u.id === selectedUser.id);
      if (userIndex !== -1) {
        currentUsers[userIndex].orla_paid = newStatus ? 1 : 0;
      }

      // Update the paid status in allUsers array
      const allUserIndex = allUsers.findIndex(u => u.id === selectedUser.id);
      if (allUserIndex !== -1) {
        allUsers[allUserIndex].orla_paid = newStatus ? 1 : 0;
      }

      // Re-display the current user list to show the new icon
      displayUsers(currentUsers, allUsers);

      // Success - no need to show confirmation modal
    } else {
      showInfoModal('Error', result.error || 'Error al actualizar el estado de pago');
    }
  } catch (error) {
    console.error('[handlePayOrla] Error:', error);
    showInfoModal('Error', error.message || 'Error al procesar el pago de orla');
  }
}

// Handle receipt printing
async function handlePrintReceipt() {
  if (!selectedUser) {
    showInfoModal('Aviso', 'Debes seleccionar un usuario');
    return;
  }

  try {
    // Get current printed status
    const statusResult = await window.electronAPI.getReceiptPrintedStatus(selectedUser.id);

    if (!statusResult.success) {
      showInfoModal('Error', statusResult.error || 'Error al obtener el estado de impresión');
      return;
    }

    const currentStatus = statusResult.isPrinted;

    // If already printed, show warning and exit
    if (currentStatus) {
      showInfoModal('⚠️ Aviso', 'El recibo ya está marcado como impreso. No se puede volver a imprimir.');
      return;
    }

    // Check if orla is paid first
    const paidStatusResult = await window.electronAPI.getOrlaPaidStatus(selectedUser.id);

    if (!paidStatusResult.success) {
      showInfoModal('Error', paidStatusResult.error || 'Error al verificar el estado de pago');
      return;
    }

    if (!paidStatusResult.isPaid) {
      showInfoModal('Aviso', 'No se puede imprimir el recibo sin que la orla esté pagada previamente');
      return;
    }

    // Find group name from group code
    let groupName = 'Sin grupo';
    if (selectedUser.group_code && currentGroups.length > 0) {
      const group = currentGroups.find(g => g.code === selectedUser.group_code);
      if (group) {
        groupName = group.name;
      }
    }

    // Prepare receipt data
    const receiptData = {
      userName: `${selectedUser.first_name} ${selectedUser.last_name1} ${selectedUser.last_name2 || ''}`.trim(),
      groupName: groupName
    };

    // Print the receipt
    const printResult = await window.electronAPI.printOrlaReceipt(receiptData);

    if (!printResult.success) {
      showInfoModal('Error', 'Error al imprimir el recibo: ' + (printResult.error || 'Error desconocido'));
      return;
    }

    // Mark as printed after successful print
    const result = await window.electronAPI.markReceiptPrinted(selectedUser.id, true);

    if (result.success) {
      // Update the user's printed status in the current data
      selectedUser.receipt_printed = 1;

      // Update the printed status in currentUsers array
      const userIndex = currentUsers.findIndex(u => u.id === selectedUser.id);
      if (userIndex !== -1) {
        currentUsers[userIndex].receipt_printed = 1;
      }

      // Update the printed status in allUsers array
      const allUserIndex = allUsers.findIndex(u => u.id === selectedUser.id);
      if (allUserIndex !== -1) {
        allUsers[allUserIndex].receipt_printed = 1;
      }

      // Re-display the current user list to show the new icon
      displayUsers(currentUsers, allUsers);

      // Success - no need to show confirmation modal
    } else {
      showInfoModal('Error', result.error || 'Error al actualizar el estado de impresión');
    }
  } catch (error) {
    console.error('[handlePrintReceipt] Error:', error);
    showInfoModal('Error', error.message || 'Error al procesar la impresión del recibo');
  }
}

// Handle unpaying orla from context menu
async function handleUnpayOrla(userId) {
  try {
    // Find the user
    const user = allUsers.find(u => u.id === userId);
    if (!user) {
      showInfoModal('Error', 'Usuario no encontrado');
      return;
    }

    // Confirm action
    const confirmed = await showConfirmationModal(
      `¿Deseas desmarcar como pagada la orla de ${user.first_name} ${user.last_name1}?`
    );

    if (!confirmed) {
      return;
    }

    // Mark as unpaid
    const result = await window.electronAPI.markOrlaPaid(userId, false);

    if (result.success) {
      // Update the user's paid status in all arrays
      user.orla_paid = 0;

      const userIndex = currentUsers.findIndex(u => u.id === userId);
      if (userIndex !== -1) {
        currentUsers[userIndex].orla_paid = 0;
      }

      const allUserIndex = allUsers.findIndex(u => u.id === userId);
      if (allUserIndex !== -1) {
        allUsers[allUserIndex].orla_paid = 0;
      }

      // Update selectedUser if it's the current user
      if (selectedUser && selectedUser.id === userId) {
        selectedUser.orla_paid = 0;
      }

      // Re-display the current user list to update the icon
      displayUsers(currentUsers, allUsers);

      showInfoModal('Éxito', 'Orla desmarcada como pagada correctamente');
    } else {
      showInfoModal('Error', result.error || 'Error al actualizar el estado de pago');
    }
  } catch (error) {
    console.error('[handleUnpayOrla] Error:', error);
    showInfoModal('Error', error.message || 'Error al desmarcar el pago de orla');
  }
}

// Handle unprinting receipt from context menu
async function handleUnprintReceipt(userId) {
  try {
    // Find the user
    const user = allUsers.find(u => u.id === userId);
    if (!user) {
      showInfoModal('Error', 'Usuario no encontrado');
      return;
    }

    // Confirm action
    const confirmed = await showConfirmationModal(
      `¿Deseas desmarcar como impreso el recibo de ${user.first_name} ${user.last_name1}?`
    );

    if (!confirmed) {
      return;
    }

    // Mark as unprinted
    const result = await window.electronAPI.markReceiptPrinted(userId, false);

    if (result.success) {
      // Update the user's printed status in all arrays
      user.receipt_printed = 0;

      const userIndex = currentUsers.findIndex(u => u.id === userId);
      if (userIndex !== -1) {
        currentUsers[userIndex].receipt_printed = 0;
      }

      const allUserIndex = allUsers.findIndex(u => u.id === userId);
      if (allUserIndex !== -1) {
        allUsers[allUserIndex].receipt_printed = 0;
      }

      // Update selectedUser if it's the current user
      if (selectedUser && selectedUser.id === userId) {
        selectedUser.receipt_printed = 0;
      }

      // Re-display the current user list to update the icon
      displayUsers(currentUsers, allUsers);

      showInfoModal('Éxito', 'Recibo desmarcado como impreso correctamente');
    } else {
      showInfoModal('Error', result.error || 'Error al actualizar el estado de impresión');
    }
  } catch (error) {
    console.error('[handleUnprintReceipt] Error:', error);
    showInfoModal('Error', error.message || 'Error al desmarcar la impresión del recibo');
  }
}

function updateLinkButtonState() {
  const hasImageSelected = imageGridManager && imageGridManager.isPreviewActive();
  const hasUserSelected = selectedUser !== null;

  linkBtn.disabled = !(hasImageSelected && hasUserSelected);
}

// Delete photo link
async function handleDeletePhoto() {
  if (!selectedUser) {
    showInfoModal('Aviso', 'Debes seleccionar un usuario');
    return;
  }

  if (!selectedUser.image_path) {
    showInfoModal('Aviso', 'El usuario seleccionado no tiene una fotografía vinculada');
    return;
  }

  const userName = `${selectedUser.first_name} ${selectedUser.last_name1} ${selectedUser.last_name2 || ''}`.trim();

  const confirmed = await showConfirmationModal(
    `¿Estás seguro de que deseas eliminar la fotografía vinculada a ${userName}?`
  );

  if (confirmed) {
    const result = await window.electronAPI.unlinkImageFromUser(selectedUser.id);

    if (result.success) {
      await loadUsers(getCurrentFilters());
      // Update selected user reference
      const updatedUser = currentUsers.find(u => u.id === selectedUser.id);
      if (updatedUser) {
        selectedUser = updatedUser;
      }
    } else {
      showInfoModal('Error', 'Error al eliminar la fotografía: ' + result.error);
    }
  }
}

// Confirmation modal - using promise-based ConfirmModal class
async function showConfirmationModal(message) {
  const confirmed = await confirmModalInstance.show(message);
  return confirmed;
}

// Info/Alert modal - using promise-based InfoModal class
async function showInfoModal(title, message) {
  await infoModalInstance.show(title, message);
  // Restore focus to search input after closing
  searchInput.focus();
}

// Progress modal functions (delegated to ProgressManager)
function showProgressModal(title = 'Procesando...', message = 'Por favor, espera...') {
  if (progressManager) {
    progressManager.show(title, message);
  }
}

function updateProgress(percentage, message = '', details = '') {
  if (progressManager) {
    progressManager.update(percentage, message, details);
  }
}

function closeProgressModal() {
  if (progressManager) {
    progressManager.close();
  }
}

// Menu listeners now handled by MenuEventManager

// Import images with ID
async function handleImportImagesId() {
  if (!projectOpen) {
    showInfoModal('Aviso', 'Debes abrir o crear un proyecto primero');
    return;
  }

  const result = await window.electronAPI.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Seleccionar carpeta con imágenes (nombradas con ID)'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const folderPath = result.filePaths[0];

    showProgressModal('Importando Imágenes', 'Procesando archivos...');

    const importResult = await window.electronAPI.importImagesWithId(folderPath);

    // Wait a moment to show 100% progress
    await new Promise(resolve => setTimeout(resolve, 500));
    closeProgressModal();

    if (importResult.success) {
      const results = importResult.results;
      let message = `Importación completada:\n\n`;
      message += `Total de imágenes: ${results.total}\n`;
      message += `Enlazadas correctamente: ${results.linked}\n`;

      if (results.notFound.length > 0) {
        message += `\nUsuarios no encontrados (${results.notFound.length}):\n`;
        message += results.notFound.slice(0, 10).join(', ');
        if (results.notFound.length > 10) {
          message += `\n... y ${results.notFound.length - 10} más`;
        }
      }

      if (results.errors.length > 0) {
        message += `\n\nErrores (${results.errors.length}):\n`;
        message += results.errors.slice(0, 5).map(e => `${e.file}: ${e.error}`).join('\n');
        if (results.errors.length > 5) {
          message += `\n... y ${results.errors.length - 5} más`;
        }
      }

      showInfoModal('Importación completada', message);

      // Reload users and images to reflect changes
      await loadUsers(getCurrentFilters());
      await loadImages();
    } else {
      showInfoModal('Error', 'Error al importar imágenes: ' + importResult.error);
    }
  }
}

// Helper function to get users to export based on selection or current view
// Export handlers (delegated to ExportManager)
async function handleExportCSV() {
  if (exportManager) {
    await exportManager.exportCSV();
  }
}

async function handleExportInventoryCSV() {
  if (exportManager) {
    await exportManager.exportInventoryCSV();
  }
}

async function handleExportImages() {
  if (exportManager) {
    await exportManager.exportImagesByID();
  }
}

async function handleExportImagesName() {
  if (exportManager) {
    await exportManager.exportImagesByName();
  }
}

async function handleExportToRepository() {
  if (exportManager) {
    await exportManager.exportToRepository();
  }
}

// Restore image links from backup
async function handleRestoreImageLinks() {
  console.log('[Renderer] handleRestoreImageLinks called');

  if (!projectOpen) {
    await showInfoModal('Aviso', 'Debes abrir un proyecto primero');
    return;
  }

  try {
    console.log('[Renderer] Showing restore backup modal');
    // Show modal and get selected backup date
    const backupDate = await restoreBackupModalInstance.show();

    console.log('[Renderer] Selected backup date:', backupDate);

    if (!backupDate) {
      // User cancelled
      console.log('[Renderer] User cancelled backup selection');
      return;
    }

    // Show confirmation before restoring
    console.log('[Renderer] Showing confirmation dialog');
    const confirmed = await showConfirmationModal(
      `¿Estás seguro de que deseas restaurar los enlaces desde esta copia de seguridad?\n\n` +
      `Fecha: ${new Date(backupDate).toLocaleString('es-ES')}\n\n` +
      `Esto reemplazará todos los enlaces actuales de imágenes capturadas.`
    );

    console.log('[Renderer] User confirmed:', confirmed);

    if (!confirmed) {
      return;
    }

    // Show progress
    showProgressModal('Restaurando enlaces', 'Restaurando enlaces de imágenes...');

    console.log('[Renderer] Calling restoreImageRelationships with date:', backupDate);
    // Restore from backup
    const result = await window.electronAPI.restoreImageRelationships(backupDate);

    console.log('[Renderer] Restore result:', result);

    closeProgressModal();

    if (result.success) {
      await showInfoModal(
        'Restauración completada',
        `Se han restaurado ${result.restored} enlaces de imágenes capturadas.\n\n` +
        `Fecha de backup: ${new Date(backupDate).toLocaleString('es-ES')}`
      );

      // Reload users to reflect changes
      console.log('[Renderer] Reloading users');
      await loadUsers(getCurrentFilters());
    } else {
      await showInfoModal('Error', 'Error al restaurar enlaces: ' + result.error);
    }
  } catch (error) {
    console.error('[Renderer] Error in handleRestoreImageLinks:', error);
    closeProgressModal();
    await showInfoModal('Error', 'Error inesperado: ' + error.message);
  }
}

// Handle preferences
async function handlePreferences() {
  console.log('[Renderer] handlePreferences called');

  try {
    // Get current preferences
    const prefsResult = await window.electronAPI.getPreferences();

    if (!prefsResult.success) {
      await showInfoModal('Error', 'Error al cargar preferencias: ' + prefsResult.error);
      return;
    }

    // Show preferences modal
    const newPreferences = await preferencesModalInstance.show(prefsResult.preferences);

    if (!newPreferences) {
      // User cancelled
      console.log('[Renderer] User cancelled preferences');
      return;
    }

    // Save new preferences
    const saveResult = await window.electronAPI.savePreferences(newPreferences);

    if (saveResult.success) {
      await showInfoModal('Preferencias guardadas', 'Las preferencias se han guardado correctamente.\n\nAlgunos cambios requieren reiniciar la aplicación para aplicarse.');

      // Apply immediate changes
      showCapturedPhotos = newPreferences.showCapturedPhotos;
      showRepositoryPhotos = newPreferences.showRepositoryPhotos;
      showRepositoryIndicators = newPreferences.showRepositoryIndicators;
      showAdditionalActions = newPreferences.showAdditionalActions;

      // Update additional actions visibility
      const additionalActionsSection = document.querySelector('.additional-actions');
      if (additionalActionsSection) {
        additionalActionsSection.style.display = newPreferences.showAdditionalActions ? 'flex' : 'none';
      }

      // Update UserRowRenderer config BEFORE reloading users
      if (userRowRenderer) {
        userRowRenderer.updateConfig({
          showCapturedPhotos: showCapturedPhotos,
          showRepositoryPhotos: showRepositoryPhotos,
          showRepositoryIndicators: showRepositoryIndicators,
          showAdditionalActions: showAdditionalActions
        });
      }

      // Reload users to apply display changes
      await loadUsers(getCurrentFilters());
    } else {
      await showInfoModal('Error', 'Error al guardar preferencias: ' + saveResult.error);
    }
  } catch (error) {
    console.error('[Renderer] Error in handlePreferences:', error);
    await showInfoModal('Error', 'Error inesperado: ' + error.message);
  }
}

// Export orla PDF
async function handleExportOrlaPDF() {
  if (orlaExportManager) {
    await orlaExportManager.exportOrlaPDF();
  }
}

// Handle paid orla PDF export
async function handleExportPaidOrlaPDF() {
  if (orlaExportManager) {
    await orlaExportManager.exportPaidOrlaPDF();
  }
}

// Handle paid users CSV export
async function handleExportPaidUsersCSV() {
  if (!projectOpen) {
    showInfoModal('Aviso', 'Debes abrir o crear un proyecto primero');
    return;
  }

  try {
    // Filter only paid users (orla_paid === 1)
    const paidUsers = allUsers.filter(user => user.orla_paid === 1);

    if (paidUsers.length === 0) {
      showInfoModal('Aviso', 'No hay usuarios con orla pagada en el proyecto');
      return;
    }

    // Ask user to select export folder
    const dialogResult = await window.electronAPI.showOpenDialog({
      title: 'Seleccionar carpeta de exportación',
      buttonLabel: 'Exportar',
      properties: ['openDirectory', 'createDirectory']
    });

    if (!dialogResult || dialogResult.canceled || !dialogResult.filePaths || dialogResult.filePaths.length === 0) {
      return; // User cancelled
    }

    const exportPath = dialogResult.filePaths[0];

    // Show progress modal
    showProgressModal('Exportando listado CSV...', 'Preparando exportación...');

    // Call IPC handler to generate CSV
    const result = await window.electronAPI.exportPaidUsersCSV({
      exportPath,
      users: paidUsers
    });

    // Close progress modal
    closeProgressModal();

    if (result.success) {
      showInfoModal(
        'Exportación Completada',
        `Se ha generado el archivo ${result.fileName} correctamente con ${paidUsers.length} alumno${paidUsers.length !== 1 ? 's' : ''}.`
      );
    } else {
      showInfoModal('Error', result.error || 'Error desconocido al exportar CSV');
    }
  } catch (error) {
    console.error('[handleExportPaidUsersCSV] Error:', error);
    closeProgressModal();
    showInfoModal('Error', error.message || 'Error al exportar CSV de alumnos pagados');
  }
}

// Detect available cameras
async function detectAvailableCameras() {
  try {
    // Request camera permission to get device labels
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });

    // Get all video input devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices
      .filter(device => device.kind === 'videoinput')
      .map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Cámara ${device.deviceId.substring(0, 8)}`
      }));

    // Stop the stream immediately
    stream.getTracks().forEach(track => track.stop());

    // Send available cameras to main process
    await window.electronAPI.updateAvailableCameras(cameras);
  } catch (error) {
    console.log('No se pudieron detectar las cámaras:', error);
    // Even if camera access fails, try to get devices without labels
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices
        .filter(device => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Cámara ${index + 1}`
        }));
      await window.electronAPI.updateAvailableCameras(cameras);
    } catch (err) {
      console.error('Error al detectar cámaras:', err);
    }
  }
}

async function handleUpdateXML() {
  if (projectManager) {
    await projectManager.handleUpdateXML();
  }
}

// Add image tag
// Image tags handlers (delegated to ImageTagsManager)
async function handleAddImageTag() {
  if (imageTagsManager) {
    await imageTagsManager.handleAddTag();
  }
}

async function loadImageTags() {
  if (imageTagsManager) {
    await imageTagsManager.loadTags();
  }
}

async function handleShowTaggedImages() {
  if (imageTagsManager) {
    await imageTagsManager.showTaggedImages();
  }
}

// Handle card print request for selected users
async function handleRequestCardPrint(userIds) {
  try {
    console.log('[CardPrint] Requesting card print for users:', userIds);

    // Get project info to check if project is open
    const projectInfo = await window.electronAPI.getProjectInfo();
    if (!projectInfo.success || !projectInfo.projectPath) {
      showInfoModal('Aviso', 'Debe abrir un proyecto primero');
      return;
    }

    if (userIds.length === 0) {
      showInfoModal('Aviso', 'No hay usuarios seleccionados');
      return;
    }

    // Show progress modal
    if (progressManager) {
      progressManager.show('Solicitando impresión de carnets', 'Generando archivos...');
    }

    // Request card print via IPC
    const result = await window.electronAPI.requestCardPrint(userIds);

    // Close progress modal
    if (progressManager) {
      progressManager.close();
    }

    if (result.success) {
      // Reload card print requests to update indicators
      if (userDataManager) {
        await userDataManager.loadCardPrintRequests();
      }

      let message = `Se han generado ${result.count} archivo(s) en la carpeta 'To-Print-ID'`;
      if (result.skipped > 0) {
        message += `\n\n${result.skipped} usuario(s) omitido(s) por no tener imagen en el depósito`;
      }

      showInfoModal('Solicitud completada', message);
    } else {
      showInfoModal('Error', `Error al solicitar impresión: ${result.error}`);
    }
  } catch (error) {
    console.error('[CardPrint] Error requesting card print:', error);
    if (progressManager) {
      progressManager.close();
    }
    showInfoModal('Error', `Error al solicitar impresión: ${error.message}`);
  }
}

/**
 * Handle request for official publication
 * @param {number[]} userIds - Array of user IDs to request publication for
 */
async function handleRequestPublication(userIds) {
  try {
    console.log('[Publication] Requesting publication for users:', userIds);

    // Get project info to check if project is open
    const projectInfo = await window.electronAPI.getProjectInfo();
    if (!projectInfo.success || !projectInfo.projectPath) {
      showInfoModal('Aviso', 'Debe abrir un proyecto primero');
      return;
    }

    if (userIds.length === 0) {
      showInfoModal('Aviso', 'No hay usuarios seleccionados');
      return;
    }

    // Show progress modal
    if (progressManager) {
      progressManager.show('Solicitando Petición Oficial', 'Copiando imágenes...');
    }

    // Request publication via IPC
    const result = await window.electronAPI.requestPublication(userIds);

    // Close progress modal
    if (progressManager) {
      progressManager.close();
    }

    if (result.success) {
      // Reload publication requests to update indicators
      if (userDataManager) {
        await userDataManager.loadPublicationRequests();
      }

      let message = `Se han copiado ${result.count} imagen(es) en la carpeta 'To-Publish'`;
      if (result.skipped > 0) {
        message += `\n\n${result.skipped} usuario(s) omitido(s) por no tener imagen en el depósito`;
      }

      showInfoModal('Solicitud completada', message);
    } else {
      showInfoModal('Error', `Error al solicitar publicación: ${result.error}`);
    }
  } catch (error) {
    console.error('[Publication] Error requesting publication:', error);
    if (progressManager) {
      progressManager.close();
    }
    showInfoModal('Error', `Error al solicitar publicación: ${error.message}`);
  }
}

// Show user image modal (delegated to UserImageModal)
function showUserImageModal(user, imageType = 'captured') {
  if (userImageModalInstance) {
    userImageModalInstance.show(user, imageType);
  }
}

// Initialize lazy loading with IntersectionObserver (delegated to LazyImageManager)
function initLazyLoading() {
  if (lazyImageManager) {
    lazyImageManager.init();
  }
}

// Observe all images with lazy-image class (delegated to LazyImageManager)
function observeLazyImages() {
  if (lazyImageManager) {
    lazyImageManager.observeAll();
  }
}

// Selection mode handlers (delegated to SelectionModeManager)
function showContextMenu(event, user, row) {
  if (selectionModeManager) {
    selectionModeManager.showContextMenu(event, user);
  }
}

function enableSelectionMode(initialUserId) {
  if (selectionModeManager) {
    selectionModeManager.enable(initialUserId);
  }
}

function disableSelectionMode() {
  if (selectionModeManager) {
    selectionModeManager.disable();
  }
}

function toggleUserSelection(userId, isChecked) {
  if (selectionModeManager) {
    selectionModeManager.toggleSelection(userId, isChecked);
  }
}

function updateSelectionInfo() {
  if (selectionModeManager) {
    selectionModeManager.updateSelectionInfo();
  }
}

function updateTableHeader() {
  if (selectionModeManager) {
    selectionModeManager.updateTableHeader();
  }
}
