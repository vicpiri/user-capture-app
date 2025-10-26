// Architecture modules are loaded via script tags in index.html
// Available globals: store, BaseModal, NewProjectModal, ConfirmModal, InfoModal, UserRowRenderer, VirtualScrollManager, ImageGridManager, ExportManager, ExportOptionsModal, AddTagModal, ImageTagsManager, SelectionModeManager, DragDropManager, ProgressManager

// Component instances
let userRowRenderer = null;
let imageGridManager = null;
let exportManager = null;
let imageTagsManager = null;
let selectionModeManager = null;
let dragDropManager = null;
let progressManager = null;

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
let imageObserver = null;

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
let addTagModalInstance = null;

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

  initializeEventListeners();
  setupMenuListeners();
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

  addTagModalInstance = new AddTagModal();
  addTagModalInstance.init();

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
    reRenderUsers: () => displayUsers(currentUsers, allUsers),
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
  window.electronAPI.onRepositoryChanged(async () => {
    // Mark repository sync as completed
    repositorySyncCompleted = true;
    // Reload users to update repository indicators
    const filters = getCurrentFilters();
    await loadUsers(filters);
  });

  // Keyboard navigation for images and users
  document.addEventListener('keydown', (event) => {
    // Don't handle keyboard events if a modal is open
    const isModalOpen = (
      (newProjectModalInstance && newProjectModalInstance.modal && newProjectModalInstance.modal.classList.contains('show')) ||
      (confirmModalInstance && confirmModalInstance.modal && confirmModalInstance.modal.classList.contains('show')) ||
      (progressModal && progressModal.classList.contains('show')) ||
      (infoModalInstance && infoModalInstance.modal && infoModalInstance.modal.classList.contains('show'))
    );
    if (isModalOpen) return;

    // Don't prevent default behavior if user is typing in an input field
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return; // Allow normal typing in inputs
    }

    // Left arrow key - previous image
    if (event.key === 'ArrowLeft' && imageGridManager && imageGridManager.getImageCount() > 0) {
      event.preventDefault();
      imageGridManager.previous();
    }
    // Right arrow key - next image
    else if (event.key === 'ArrowRight' && imageGridManager && imageGridManager.getImageCount() > 0) {
      event.preventDefault();
      imageGridManager.next();
    }
    // Up arrow key - previous user
    else if (event.key === 'ArrowUp') {
      event.preventDefault();
      navigateUsers(-1);
    }
    // Down arrow key - next user
    else if (event.key === 'ArrowDown') {
      event.preventDefault();
      navigateUsers(1);
    }
  });
}

// Project management
async function openNewProjectModal() {
  // NewProjectModal class handles the entire flow
  const result = await newProjectModalInstance.show();

  if (result) {
    // Project created successfully - modal already updated store
    projectOpen = true;
    await loadProjectData();
  }
}

async function handleOpenProject() {
  const result = await window.electronAPI.showOpenDialog({
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const openResult = await window.electronAPI.openProject(result.filePaths[0]);

    if (openResult.success) {
      projectOpen = true;
      await loadProjectData();
    } else {
      showInfoModal('Error', 'Error al abrir el proyecto: ' + openResult.error);
    }
  }
}

// Load project data
async function loadProjectData() {
  await loadGroups();

  // Load saved group filter
  const filterResult = await window.electronAPI.getSelectedGroupFilter();
  if (filterResult.success && filterResult.groupCode) {
    groupFilter.value = filterResult.groupCode;
  }

  await loadUsers(getCurrentFilters());
  await loadImages();

  // Re-enable search input after data load
  searchInput.disabled = false;
  searchInput.readOnly = false;

  // Update placeholder visibility
  updateNoProjectPlaceholder();
}

// Update no project placeholder visibility
function updateNoProjectPlaceholder() {
  if (!noProjectPlaceholder) {
    console.error('No project placeholder element not found');
    return;
  }

  if (projectOpen) {
    noProjectPlaceholder.classList.remove('visible');
  } else {
    noProjectPlaceholder.classList.add('visible');
  }
}

async function loadGroups() {
  const result = await window.electronAPI.getGroups();

  if (result.success) {
    currentGroups = result.groups;
    populateGroupFilter();
  }
}

function populateGroupFilter() {
  groupFilter.innerHTML = '<option value="">Todos los grupos</option>';
  currentGroups.forEach(group => {
    const option = document.createElement('option');
    option.value = group.code;
    option.textContent = `${group.code} - ${group.name}`;
    groupFilter.appendChild(option);
  });
}

async function loadUsers(filters = {}) {
  // Show loading spinner
  loadingSpinner.style.display = 'flex';

  // Clear rows but preserve spacers
  const existingRows = Array.from(userTableBody.querySelectorAll('tr:not(#top-spacer):not(#bottom-spacer)'));
  existingRows.forEach(row => row.remove());

  try {
    // Load users WITHOUT repository images for fast initial display
    const loadOptions = {
      loadCapturedImages: showCapturedPhotos,
      loadRepositoryImages: false // Always false for initial load
    };

    const result = await window.electronAPI.getUsers(filters, loadOptions);

    if (result.success) {
      currentUsers = result.users;

      // Always reload all users for accurate duplicate checking
      // Only load image_path for duplicate checking, no need for repository images
      const allLoadOptions = {
        loadCapturedImages: true,
        loadRepositoryImages: false
      };
      const allResult = await window.electronAPI.getUsers({}, allLoadOptions);
      if (allResult.success) {
        allUsers = allResult.users;
      }

      displayUsers(currentUsers, allUsers);
      updateUserCount();

      // Load repository data in background if needed
      if (showRepositoryPhotos || showRepositoryIndicators) {
        // Check if repository data is actually loaded
        const hasRepositoryData = currentUsers.some(u => u.repository_image_path);
        if (!hasRepositoryData) {
          loadRepositoryDataInBackground(currentUsers);
        } else {
          // Data already loaded, stop loading state
          isLoadingRepositoryPhotos = false;
          isLoadingRepositoryIndicators = false;
          repositorySyncCompleted = true;
        }
      }
    }
  } finally {
    // Hide loading spinner
    loadingSpinner.style.display = 'none';
  }
}

// Load repository data in background (non-blocking)
async function loadRepositoryDataInBackground(users) {
  const startTime = Date.now();
  const minDisplayTime = 300; // Minimum time to show spinners (ms)

  try {
    const result = await window.electronAPI.loadRepositoryImages(users);

    if (result.success) {
      // Merge repository data into currentUsers
      currentUsers.forEach(user => {
        const repoData = result.repositoryData[user.id];
        if (repoData) {
          user.has_repository_image = repoData.has_repository_image;
          user.repository_image_path = repoData.repository_image_path;
        }
      });

      // Ensure spinners are visible for at least minDisplayTime
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

      setTimeout(() => {
        // Update the display with repository data
        updateRepositoryDataInDisplay();
      }, remainingTime);
    } else {
      console.error('Error loading repository data:', result.error);
      // Stop loading states even on error
      updateRepositoryDataInDisplay();
    }
  } catch (error) {
    console.error('Error loading repository data in background:', error);
    // Stop loading states even on error
    updateRepositoryDataInDisplay();
  }
}

// Update repository data in the displayed rows
function updateRepositoryDataInDisplay() {
  // Stop loading states first
  isLoadingRepositoryPhotos = false;
  isLoadingRepositoryIndicators = false;
  repositorySyncCompleted = true;

  // Re-render users to update spinners and show actual data
  displayUsers(currentUsers, allUsers);
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

// Menu listeners
function setupMenuListeners() {
  // Load initial display preferences from main process
  window.electronAPI.onInitialDisplayPreferences((prefs) => {
    showDuplicatesOnly = prefs.showDuplicatesOnly;
    showCapturedPhotos = prefs.showCapturedPhotos;
    showRepositoryPhotos = prefs.showRepositoryPhotos;
    showRepositoryIndicators = prefs.showRepositoryIndicators;

    // Mark as loading if repository options are enabled in saved preferences
    if (prefs.showRepositoryPhotos) {
      isLoadingRepositoryPhotos = true;
      repositorySyncCompleted = false;
    }
    if (prefs.showRepositoryIndicators) {
      isLoadingRepositoryIndicators = true;
      repositorySyncCompleted = false;
    }

    // Set initial visibility of Additional Actions section
    const additionalActionsSection = document.querySelector('.additional-actions');
    if (additionalActionsSection) {
      additionalActionsSection.style.display = prefs.showAdditionalActions ? 'block' : 'none';
    }
  });

  window.electronAPI.onMenuNewProject(() => {
    openNewProjectModal();
  });

  window.electronAPI.onMenuOpenProject(() => {
    handleOpenProject();
  });

  window.electronAPI.onProjectOpened((data) => {
    if (data.success) {
      projectOpen = true;
      loadProjectData();
    }
  });

  window.electronAPI.onMenuLinkImage(() => {
    handleLinkImage();
  });

  window.electronAPI.onMenuDeletePhoto(() => {
    handleDeletePhoto();
  });

  window.electronAPI.onMenuToggleDuplicates((enabled) => {
    showDuplicatesOnly = enabled;
    duplicatesFilter.checked = enabled;
    displayUsers(currentUsers, allUsers);
  });

  window.electronAPI.onMenuToggleCapturedPhotos(async (enabled) => {
    showCapturedPhotos = enabled;
    // If enabling, check if captured photo data is loaded
    if (enabled && currentUsers.length > 0) {
      // Check if captured photo data was previously loaded
      // When loadCapturedImages is false, image_path is set to null explicitly
      // So we need to check if ALL users have null image_path (meaning data wasn't loaded)
      const allImagesAreNull = currentUsers.every(u => u.image_path === null);
      if (allImagesAreNull) {
        // Reload users with captured images
        await loadUsers(getCurrentFilters());
        return; // loadUsers already calls displayUsers
      }
    }
    displayUsers(currentUsers, allUsers);
  });

  window.electronAPI.onMenuToggleRepositoryPhotos((enabled) => {
    showRepositoryPhotos = enabled;
    if (enabled) {
      // Mark as loading to show spinners and reset sync completed flag
      isLoadingRepositoryPhotos = true;
      repositorySyncCompleted = false;
      // Display users immediately with loading spinners
      displayUsers(currentUsers, allUsers);
    }
    // Load repository data if enabling and not already loaded
    if (enabled && currentUsers.length > 0) {
      // Check if repository data is actually loaded (not just the property exists)
      const hasRepositoryData = currentUsers.some(u => u.repository_image_path);
      if (!hasRepositoryData) {
        loadRepositoryDataInBackground(currentUsers);
      } else {
        // Data already loaded, stop loading state and mark sync as completed
        isLoadingRepositoryPhotos = false;
        repositorySyncCompleted = true;
        // Re-display with actual data (no spinners)
        displayUsers(currentUsers, allUsers);
      }
    } else if (!enabled) {
      // If disabling, stop loading state
      isLoadingRepositoryPhotos = false;
      displayUsers(currentUsers, allUsers);
    }
  });

  window.electronAPI.onMenuToggleRepositoryIndicators((enabled) => {
    showRepositoryIndicators = enabled;
    if (enabled) {
      // Mark as loading to show spinners and reset sync completed flag
      isLoadingRepositoryIndicators = true;
      repositorySyncCompleted = false;
      // Display users immediately with loading spinners
      displayUsers(currentUsers, allUsers);
    }
    // Load repository data if enabling and not already loaded
    if (enabled && currentUsers.length > 0) {
      // Check if repository data is actually loaded (not just the property exists)
      const hasRepositoryData = currentUsers.some(u => u.repository_image_path);
      if (!hasRepositoryData) {
        loadRepositoryDataInBackground(currentUsers);
      } else {
        // Data already loaded, stop loading state and mark sync as completed
        isLoadingRepositoryIndicators = false;
        repositorySyncCompleted = true;
        // Re-display with actual data (no spinners)
        displayUsers(currentUsers, allUsers);
      }
    } else if (!enabled) {
      // If disabling, stop loading state
      isLoadingRepositoryIndicators = false;
      displayUsers(currentUsers, allUsers);
    }
  });

  window.electronAPI.onMenuImportImagesId(() => {
    handleImportImagesId();
  });

  window.electronAPI.onMenuExportCSV(() => {
    handleExportCSV();
  });

  window.electronAPI.onMenuExportImages(() => {
    handleExportImages();
  });

  window.electronAPI.onMenuExportImagesName(() => {
    handleExportImagesName();
  });

  window.electronAPI.onMenuExportToRepository(() => {
    handleExportToRepository();
  });

  window.electronAPI.onMenuUpdateXML(() => {
    handleUpdateXML();
  });

  window.electronAPI.onMenuAddImageTag(() => {
    handleAddImageTag();
  });

  window.electronAPI.onMenuShowTaggedImages(() => {
    handleShowTaggedImages();
  });

  window.electronAPI.onMenuToggleAdditionalActions((enabled) => {
    const additionalActionsSection = document.querySelector('.additional-actions');
    if (additionalActionsSection) {
      additionalActionsSection.style.display = enabled ? 'block' : 'none';
    }
  });
}

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

// Update XML file
async function handleUpdateXML() {
  if (!projectOpen) {
    showInfoModal('Aviso', 'Debes abrir o crear un proyecto primero');
    return;
  }

  // Select new XML file
  const result = await window.electronAPI.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'XML Files', extensions: ['xml'] }],
    title: 'Seleccionar nuevo archivo XML'
  });

  if (result.canceled || result.filePaths.length === 0) {
    return;
  }

  const xmlPath = result.filePaths[0];

  // Show progress modal
  showProgressModal('Actualizando XML', 'Analizando cambios...');

  // Call update-xml to analyze changes
  const updateResult = await window.electronAPI.updateXML(xmlPath);

  if (!updateResult.success) {
    closeProgressModal();
    showInfoModal('Error', 'Error al analizar el XML: ' + updateResult.error);
    return;
  }

  closeProgressModal();

  // Show confirmation dialog with summary
  const changes = updateResult.changes;
  let message = 'Se han detectado los siguientes cambios:\n\n';
  message += `Usuarios nuevos: ${changes.toAdd}\n`;
  message += `Usuarios actualizados: ${changes.toUpdate}\n`;
  message += `Usuarios eliminados: ${changes.toDelete}\n\n`;

  if (changes.toDeleteWithImage > 0) {
    message += `- ${changes.toDeleteWithImage} usuario(s) con imagen serán movidos al grupo "¡Eliminados!"\n`;
  }
  if (changes.toDeleteWithoutImage > 0) {
    message += `- ${changes.toDeleteWithoutImage} usuario(s) sin imagen serán eliminados permanentemente\n`;
  }

  message += '\n¿Deseas continuar con la actualización?';

  const confirmed = await showConfirmationModal(message);

  if (confirmed) {
    // Show progress modal
    showProgressModal('Actualizando XML', 'Aplicando cambios...');

    // Apply the update
    const confirmResult = await window.electronAPI.confirmUpdateXML({
      groups: updateResult.groups,
      newUsersMap: updateResult.newUsersMap,
      deletedUsers: updateResult.deletedUsers,
      currentUsers: updateResult.currentUsers
    });

    closeProgressModal();

    if (confirmResult.success) {
      const results = confirmResult.results;
      let successMessage = 'Actualización completada exitosamente:\n\n';
      successMessage += `Usuarios añadidos: ${results.added}\n`;
      successMessage += `Usuarios actualizados: ${results.updated}\n`;
      successMessage += `Usuarios movidos a Eliminados: ${results.movedToDeleted}\n`;
      successMessage += `Usuarios eliminados permanentemente: ${results.permanentlyDeleted}`;

      // Reload project data first
      await loadProjectData();

      // Show info modal instead of alert
      showInfoModal('Actualización completada', successMessage);
    } else {
      showInfoModal('Error', 'Error al actualizar el XML: ' + confirmResult.error);
    }
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

// Show user image modal
function showUserImageModal(user, imageType = 'captured') {
  const userImageModal = document.getElementById('user-image-modal');
  const userImageModalTitle = document.getElementById('user-image-modal-title');
  const userImagePreview = document.getElementById('user-image-preview');
  const userImageCloseBtn = document.getElementById('user-image-close-btn');

  // Set title with user's name and image type
  const fullName = `${user.first_name} ${user.last_name1} ${user.last_name2 || ''}`.trim();
  const imageLabel = imageType === 'repository' ? ' - Depósito' : '';
  userImageModalTitle.textContent = fullName + imageLabel;

  // Set image based on type
  const imagePath = imageType === 'repository' ? user.repository_image_path : user.image_path;
  userImagePreview.src = `file://${imagePath}`;

  // Show modal
  userImageModal.classList.add('show');

  // Setup close button
  const newCloseBtn = userImageCloseBtn.cloneNode(true);
  userImageCloseBtn.parentNode.replaceChild(newCloseBtn, userImageCloseBtn);

  newCloseBtn.addEventListener('click', () => {
    userImageModal.classList.remove('show');
  });
}

// Initialize lazy loading with IntersectionObserver
function initLazyLoading() {
  // Disconnect previous observer if exists
  if (imageObserver) {
    imageObserver.disconnect();
  }

  // Create intersection observer for lazy loading
  const options = {
    root: null, // Use viewport as root
    rootMargin: '50px', // Start loading 50px before entering viewport
    threshold: 0.01 // Trigger when 1% of image is visible
  };

  imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;

        // Load the image
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          img.classList.remove('lazy-image');
          img.classList.add('lazy-loaded');

          // Stop observing this image
          observer.unobserve(img);
        }
      }
    });
  }, options);
}

// Observe all images with lazy-image class
function observeLazyImages() {
  if (!imageObserver) {
    initLazyLoading();
  }

  const lazyImages = document.querySelectorAll('.lazy-image');
  lazyImages.forEach(img => {
    imageObserver.observe(img);
  });
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
