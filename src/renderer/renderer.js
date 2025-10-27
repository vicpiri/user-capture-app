// Architecture modules are loaded via script tags in index.html
// Available globals: store, BaseModal, NewProjectModal, ConfirmModal, InfoModal, UserImageModal, UserRowRenderer, VirtualScrollManager, ImageGridManager, ExportManager, ExportOptionsModal, InventoryExportOptionsModal, AddTagModal, ImageTagsManager, SelectionModeManager, DragDropManager, ProgressManager, LazyImageManager, KeyboardNavigationManager, MenuEventManager, UserDataManager, ProjectManager

// Component instances
let userRowRenderer = null;
let imageGridManager = null;
let exportManager = null;
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
let showCapturedPhotos = true;
let showRepositoryPhotos = false;  // Default to false to avoid blocking on Google Drive
let showRepositoryIndicators = false;  // Default to false to avoid blocking on Google Drive
let isLoadingRepositoryPhotos = false;  // Track if repository photos are being loaded
let isLoadingRepositoryIndicators = false;  // Track if repository indicators are being loaded
let repositorySyncCompleted = false;  // Track if initial repository sync has completed

// Selection mode state (deprecated - now managed by SelectionModeManager)
// Kept for backward compatibility during transition
let selectionMode = false;
let selectedUsers = new Set(); // Store selected user IDs

// Virtual scrolling
let virtualScrollManager = null;
let displayedUsers = []; // Currently displayed users (filtered/duplicates)

// DOM Elements
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const groupFilter = document.getElementById('group-filter');
const duplicatesFilter = document.getElementById('duplicates-filter');
const filterOptions = document.getElementById('filter-options');
const userTableBody = document.getElementById('user-table-body');
const selectedUserInfo = document.getElementById('selected-user-info');
const userCount = document.getElementById('user-count');
const linkBtn = document.getElementById('link-btn');
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
  newProjectModalInstance = new NewProjectModal();
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

  console.log('[Renderer] Modal instances initialized');
}

// Initialize user row renderer
function initializeUserRowRenderer() {
  userRowRenderer = new UserRowRenderer({
    showCapturedPhotos: showCapturedPhotos,
    showRepositoryPhotos: showRepositoryPhotos,
    showRepositoryIndicators: showRepositoryIndicators,
    isLoadingRepositoryPhotos: isLoadingRepositoryPhotos,
    isLoadingRepositoryIndicators: isLoadingRepositoryIndicators,
    selectionMode: selectionMode,
    selectedUsers: selectedUsers,
    onUserSelect: (row, user) => selectUserRow(row, user),
    onUserContextMenu: (e, user, row) => showContextMenu(e, user, row),
    onImagePreview: (user, type) => showUserImageModal(user, type),
    onCheckboxToggle: (userId, checked) => toggleUserSelection(userId, checked)
  });

  console.log('[Renderer] User row renderer initialized');
}

// Initialize virtual scroll manager
function initializeVirtualScroll() {
  const container = document.getElementById('table-container');
  const tbody = document.getElementById('user-table-body');

  virtualScrollManager = new VirtualScrollManager({
    itemHeight: 40,
    bufferSize: 10,
    minItemsForVirtualization: 50,
    container: container,
    tbody: tbody,
    createRowCallback: (user) => createUserRow(user, window._imageCountCache || {}),
    observeImagesCallback: () => observeLazyImages()
  });

  virtualScrollManager.init();
  console.log('[Renderer] Virtual scroll manager initialized');
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

  console.log('[Renderer] Image grid manager initialized');
}

// Initialize export manager
function initializeExportManager() {
  exportManager = new ExportManager({
    exportOptionsModal: exportOptionsModalInstance,
    inventoryExportOptionsModal: inventoryExportOptionsModalInstance,
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

  console.log('[Renderer] Export manager initialized');
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

  console.log('[Renderer] Image tags manager initialized');
}

// Initialize selection mode manager
function initializeSelectionModeManager() {
  selectionModeManager = new SelectionModeManager({
    onSelectionChange: (isActive, selected) => {
      // Sync with global state for backward compatibility
      selectionMode = isActive;
      selectedUsers = selected;

      // Update user row renderer state
      if (userRowRenderer) {
        userRowRenderer.selectionMode = isActive;
        userRowRenderer.selectedUsers = selected;
      }
    },
    getDisplayedUsers: () => displayedUsers,
    reRenderUsers: () => {
      // Force re-render to update checkboxes when selection mode changes
      if (virtualScrollManager) {
        virtualScrollManager.forceRerender();
      } else {
        displayUsers(currentUsers, allUsers);
      }
    },
    selectedUserInfo: selectedUserInfo,
    tableHeader: document.querySelector('.user-table thead tr')
  });

  console.log('[Renderer] Selection mode manager initialized');
}

// Initialize drag and drop manager
function initializeDragDropManager() {
  dragDropManager = new DragDropManager({
    dropZone: document.querySelector('.image-container'),
    showInfoModal: showInfoModal,
    moveImageToIngest: (path) => window.electronAPI.moveImageToIngest(path)
  });

  dragDropManager.enable();
  console.log('[Renderer] Drag drop manager initialized');
}

// Initialize progress manager
function initializeProgressManager() {
  progressManager = new ProgressManager({
    modal: progressModal,
    electronAPI: window.electronAPI
  });

  progressManager.setupListener();
  console.log('[Renderer] Progress manager initialized');
}

// Initialize lazy image manager
function initializeLazyImageManager() {
  lazyImageManager = new LazyImageManager();
  lazyImageManager.init();
  console.log('[Renderer] Lazy image manager initialized');
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
  console.log('[Renderer] Keyboard navigation manager initialized');
}

// Initialize menu event manager
function initializeMenuEventManager() {
  menuEventManager = new MenuEventManager({
    // State setters
    setShowDuplicatesOnly: (value) => { showDuplicatesOnly = value; },
    setShowCapturedPhotos: (value) => { showCapturedPhotos = value; },
    setShowRepositoryPhotos: (value) => { showRepositoryPhotos = value; },
    setShowRepositoryIndicators: (value) => { showRepositoryIndicators = value; },
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
    onProjectLoaded: loadProjectData,
    onLinkImage: handleLinkImage,
    onDeletePhoto: handleDeletePhoto,
    onImportImagesId: handleImportImagesId,
    onExportCSV: handleExportCSV,
    onExportInventoryCSV: handleExportInventoryCSV,
    onExportImages: handleExportImages,
    onExportImagesName: handleExportImagesName,
    onExportToRepository: handleExportToRepository,
    onUpdateXML: handleUpdateXML,
    onAddImageTag: handleAddImageTag,
    onShowTaggedImages: handleShowTaggedImages,

    // Display callbacks
    onDisplayUsers: displayUsers,
    onLoadUsers: loadUsers,
    onLoadRepositoryData: loadRepositoryDataInBackground,

    // DOM elements
    duplicatesFilter: duplicatesFilter,
    additionalActionsSection: document.querySelector('.additional-actions'),

    // IPC API
    electronAPI: window.electronAPI
  });

  menuEventManager.init();
  console.log('[Renderer] Menu event manager initialized');
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

    // DOM elements
    groupFilter: groupFilter,
    loadingSpinner: loadingSpinner,
    userTableBody: userTableBody,

    // IPC API
    electronAPI: window.electronAPI
  });

  console.log('[Renderer] User data manager initialized');
}

function initializeProjectManager() {
  projectManager = new ProjectManager({
    // State setters
    setProjectOpen: (value) => { projectOpen = value; },

    // State getters
    getProjectOpen: () => projectOpen,

    // Callbacks
    onLoadGroups: loadGroups,
    onLoadUsers: loadUsers,
    onLoadImages: loadImages,
    onGetCurrentFilters: getCurrentFilters,
    onShowInfoModal: showInfoModal,
    onShowConfirmModal: showConfirmationModal,
    onShowProgressModal: showProgressModal,
    onCloseProgressModal: closeProgressModal,

    // DOM elements
    searchInput: searchInput,
    groupFilter: groupFilter,
    noProjectPlaceholder: noProjectPlaceholder,

    // Modal instances
    newProjectModal: newProjectModalInstance,

    // IPC API
    electronAPI: window.electronAPI
  });

  console.log('[Renderer] Project manager initialized');
}

// Event Listeners
function initializeEventListeners() {
  // Search and filter
  searchInput.addEventListener('input', () => {
    toggleClearButton();
    filterUsers();
  });
  clearSearchBtn.addEventListener('click', clearSearch);
  groupFilter.addEventListener('change', async () => {
    // Save filter selection and broadcast to other windows
    await window.electronAPI.setSelectedGroupFilter(groupFilter.value);
    await filterUsers();
  });

  // Listen for group filter changes from other windows
  window.electronAPI.onGroupFilterChanged(async (groupCode) => {
    groupFilter.value = groupCode;
    await filterUsers();
  });
  duplicatesFilter.addEventListener('change', () => {
    showDuplicatesOnly = duplicatesFilter.checked;
    displayUsers(currentUsers, allUsers);
  });

  // Action buttons
  linkBtn.addEventListener('click', handleLinkImage);

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
    console.log('[Repository] Repository changed:', data);
    // Mark repository sync as completed
    repositorySyncCompleted = true;

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
      console.log('[Repository] Repository indicators refreshed (scroll preserved)');
    } else {
      // Fallback to full reload if managers not initialized
      const filters = getCurrentFilters();
      await loadUsers(filters);
      console.log('[Repository] Users reloaded after repository change');
    }
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

async function loadUsers(filters = {}) {
  if (userDataManager) {
    await userDataManager.loadUsers(filters);
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

  // Check if there are any duplicates
  const hasDuplicates = Object.values(imageCount).some(count => count > 1);

  // Show/hide duplicates filter based on whether duplicates exist
  if (hasDuplicates) {
    filterOptions.style.display = 'flex';
  } else {
    filterOptions.style.display = 'none';
    // If filter was active and there are no duplicates, deactivate it
    if (showDuplicatesOnly) {
      showDuplicatesOnly = false;
      duplicatesFilter.checked = false;
    }
  }

  // If showing duplicates only, show all duplicates from entire database
  let usersToDisplay = users;
  if (showDuplicatesOnly && allUsers) {
    // Show all users with duplicates from the entire database
    usersToDisplay = allUsers.filter(user => user.image_path && imageCount[user.image_path] > 1);
  } else if (showDuplicatesOnly) {
    // Fallback if allUsers not available
    usersToDisplay = users.filter(user => user.image_path && imageCount[user.image_path] > 1);
  }

  // Store displayed users and image count for virtual scrolling
  displayedUsers = usersToDisplay;

  // Store imageCount globally for row rendering
  window._imageCountCache = imageCount;

  // Use virtual scroll manager to render users
  if (virtualScrollManager) {
    virtualScrollManager.setItems(displayedUsers);
  }
}

// Create a user row element (uses UserRowRenderer)
function createUserRow(user, imageCount) {
  // Update renderer config with current state
  if (userRowRenderer) {
    userRowRenderer.updateConfig({
      showCapturedPhotos: showCapturedPhotos,
      showRepositoryPhotos: showRepositoryPhotos,
      showRepositoryIndicators: showRepositoryIndicators,
      isLoadingRepositoryPhotos: isLoadingRepositoryPhotos,
      isLoadingRepositoryIndicators: isLoadingRepositoryIndicators,
      selectionMode: selectionMode,
      selectedUsers: selectedUsers
    });

    return userRowRenderer.createRow(user, imageCount);
  }

  // Fallback if renderer not initialized
  console.warn('[Renderer] UserRowRenderer not initialized');
  const row = document.createElement('tr');
  row.textContent = 'Error: Row renderer not initialized';
  return row;
}

function selectUserRow(row, user) {
  // Remove previous selection
  document.querySelectorAll('.user-table tbody tr').forEach(tr => {
    tr.classList.remove('selected');
  });

  // Select new row
  row.classList.add('selected');
  selectedUser = user;

  // Update selected user info in selection mode manager
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

function updateUserCount() {
  userCount.textContent = `Listo. ${currentUsers.length} usuarios cargados.`;
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
  await loadUsers(filters);
}

// Image management
// Load images - delegates to ImageGridManager
async function loadImages() {
  if (imageGridManager) {
    return await imageGridManager.loadImages(true);
  }
  return false;
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
  // Get the currently displayed users in the table
  const userRows = Array.from(document.querySelectorAll('.user-table tbody tr'));

  if (userRows.length === 0) return;

  // Find the currently selected row
  let currentIndex = userRows.findIndex(row => row.classList.contains('selected'));

  // If no row is selected, select the first one
  if (currentIndex === -1) {
    currentIndex = 0;
  } else {
    // Move to the next/previous user
    currentIndex += direction;

    // Wrap around
    if (currentIndex < 0) {
      currentIndex = userRows.length - 1;
    } else if (currentIndex >= userRows.length) {
      currentIndex = 0;
    }
  }

  // Get the user data from the row
  const selectedRow = userRows[currentIndex];
  const userId = parseInt(selectedRow.dataset.userId);

  // Find the user in the displayed users list
  const displayedUsers = showDuplicatesOnly && allUsers
    ? allUsers.filter(user => {
        const imageCount = {};
        allUsers.forEach(u => {
          if (u.image_path) {
            imageCount[u.image_path] = (imageCount[u.image_path] || 0) + 1;
          }
        });
        return user.image_path && imageCount[user.image_path] > 1;
      })
    : currentUsers;

  const user = displayedUsers.find(u => u.id === userId);

  if (user) {
    selectUserRow(selectedRow, user);

    // Scroll the row into view if it's not visible
    selectedRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
