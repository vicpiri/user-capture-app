// State management
let currentUsers = [];
let allUsers = []; // All users from database for duplicate checking
let currentGroups = [];
let selectedUser = null;
let currentImages = [];
let currentImageIndex = 0;
let projectOpen = false;
let showDuplicatesOnly = false;
let showCapturedPhotos = true;
let showRepositoryPhotos = true;
let showRepositoryIndicators = true;
let imageObserver = null;

// Virtual scrolling state
const ITEM_HEIGHT = 40; // Height of each row in pixels
const BUFFER_SIZE = 10; // Extra rows to render above/below viewport
let visibleStartIndex = 0;
let visibleEndIndex = 0;
let displayedUsers = []; // Currently displayed users (filtered/duplicates)
let isVirtualScrolling = false;

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

// Modals
const newProjectModal = document.getElementById('new-project-modal');
const confirmModal = document.getElementById('confirm-modal');
const progressModal = document.getElementById('progress-modal');
const infoModal = document.getElementById('info-modal');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  setupProgressListener();
  setupMenuListeners();
  detectAvailableCameras();
});

// Event Listeners
function initializeEventListeners() {
  // Search and filter
  searchInput.addEventListener('input', () => {
    toggleClearButton();
    filterUsers();
  });
  clearSearchBtn.addEventListener('click', clearSearch);
  groupFilter.addEventListener('change', filterUsers);
  duplicatesFilter.addEventListener('change', () => {
    showDuplicatesOnly = duplicatesFilter.checked;
    displayUsers(currentUsers, allUsers);
  });

  // Action buttons
  linkBtn.addEventListener('click', handleLinkImage);

  // Image navigation
  prevImageBtn.addEventListener('click', () => navigateImages(-1));
  nextImageBtn.addEventListener('click', () => navigateImages(1));

  // Modal buttons
  document.getElementById('select-folder-btn').addEventListener('click', selectProjectFolder);
  document.getElementById('select-xml-btn').addEventListener('click', selectXMLFile);
  document.getElementById('create-project-btn').addEventListener('click', createProject);
  document.getElementById('cancel-new-project-btn').addEventListener('click', closeNewProjectModal);

  // Confirmation modal
  document.getElementById('confirm-no-btn').addEventListener('click', closeConfirmModal);

  // Listen for new images
  window.electronAPI.onNewImageDetected(async (filename) => {
    await loadImages();
    if (currentImages.length > 0) {
      showImagePreview();
    }
  });

  // Drag and drop for image preview
  setupDragAndDrop();

  // Setup virtual scrolling
  setupVirtualScroll();

  // Keyboard navigation for images and users
  document.addEventListener('keydown', (event) => {
    // Don't handle keyboard events if a modal is open
    if (newProjectModal.classList.contains('show') ||
        confirmModal.classList.contains('show') ||
        progressModal.classList.contains('show') ||
        infoModal.classList.contains('show')) return;

    // Don't prevent default behavior if user is typing in an input field
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return; // Allow normal typing in inputs
    }

    // Left arrow key - previous image
    if (event.key === 'ArrowLeft' && currentImages.length > 0) {
      event.preventDefault();
      navigateImages(-1);
    }
    // Right arrow key - next image
    else if (event.key === 'ArrowRight' && currentImages.length > 0) {
      event.preventDefault();
      navigateImages(1);
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
function openNewProjectModal() {
  newProjectModal.classList.add('show');
}

function closeNewProjectModal() {
  newProjectModal.classList.remove('show');
  document.getElementById('project-folder').value = '';
  document.getElementById('xml-file').value = '';
}

async function selectProjectFolder() {
  const result = await window.electronAPI.showOpenDialog({
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    document.getElementById('project-folder').value = result.filePaths[0];
  }
}

async function selectXMLFile() {
  const result = await window.electronAPI.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'XML Files', extensions: ['xml'] }]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    document.getElementById('xml-file').value = result.filePaths[0];
  }
}

async function createProject() {
  const folderPath = document.getElementById('project-folder').value;
  const xmlPath = document.getElementById('xml-file').value;

  if (!folderPath || !xmlPath) {
    showInfoModal('Error', 'Por favor, selecciona la carpeta del proyecto y el archivo XML');
    return;
  }

  closeNewProjectModal();
  showProgressModal('Creando Proyecto', 'Inicializando...');

  const result = await window.electronAPI.createProject({ folderPath, xmlPath });

  closeProgressModal();

  if (result.success) {
    projectOpen = true;
    await loadProjectData();
  } else {
    showInfoModal('Error', 'Error al crear el proyecto: ' + result.error);
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
  await loadUsers();
  await loadImages();

  // Re-enable search input after data load
  searchInput.disabled = false;
  searchInput.readOnly = false;
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
  userTableBody.innerHTML = '';

  try {
    // Determine what data needs to be loaded based on menu settings
    const loadOptions = {
      loadCapturedImages: showCapturedPhotos,
      loadRepositoryImages: showRepositoryPhotos || showRepositoryIndicators
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
    }
  } finally {
    // Hide loading spinner
    loadingSpinner.style.display = 'none';
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

  // Enable virtual scrolling if more than 50 users
  if (displayedUsers.length > 50) {
    isVirtualScrolling = true;
    renderVirtualizedUsers();
  } else {
    isVirtualScrolling = false;
    renderAllUsers(displayedUsers, imageCount);
  }
}

// Render all users (for small lists < 50 users)
function renderAllUsers(usersToDisplay, imageCount) {
  const topSpacer = document.getElementById('top-spacer');
  const bottomSpacer = document.getElementById('bottom-spacer');

  // Hide spacers for non-virtual mode
  topSpacer.style.height = '0px';
  bottomSpacer.style.height = '0px';

  // Clear existing rows (except spacers)
  const existingRows = Array.from(userTableBody.querySelectorAll('tr:not(#top-spacer):not(#bottom-spacer)'));
  existingRows.forEach(row => row.remove());

  // Render all users
  usersToDisplay.forEach(user => {
    const row = createUserRow(user, imageCount);
    bottomSpacer.parentNode.insertBefore(row, bottomSpacer);
  });

  // Observe lazy images after rendering
  observeLazyImages();
}

// Render virtualized users (for large lists >= 50 users)
function renderVirtualizedUsers() {
  const container = document.getElementById('table-container');
  const containerHeight = container.clientHeight;
  const scrollTop = container.scrollTop;

  // Calculate visible range
  const visibleCount = Math.ceil(containerHeight / ITEM_HEIGHT);
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
  const endIndex = Math.min(displayedUsers.length, startIndex + visibleCount + (BUFFER_SIZE * 2));

  // Only re-render if range changed significantly
  if (startIndex === visibleStartIndex && endIndex === visibleEndIndex) {
    return;
  }

  visibleStartIndex = startIndex;
  visibleEndIndex = endIndex;

  // Update spacers
  const topSpacer = document.getElementById('top-spacer');
  const bottomSpacer = document.getElementById('bottom-spacer');

  topSpacer.style.height = `${startIndex * ITEM_HEIGHT}px`;
  bottomSpacer.style.height = `${(displayedUsers.length - endIndex) * ITEM_HEIGHT}px`;

  // Clear existing rows (except spacers)
  const existingRows = Array.from(userTableBody.querySelectorAll('tr:not(#top-spacer):not(#bottom-spacer)'));
  existingRows.forEach(row => row.remove());

  // Render visible rows
  const visibleUsers = displayedUsers.slice(startIndex, endIndex);
  const imageCount = window._imageCountCache || {};

  visibleUsers.forEach(user => {
    const row = createUserRow(user, imageCount);
    bottomSpacer.parentNode.insertBefore(row, bottomSpacer);
  });

  // Observe lazy images after rendering
  observeLazyImages();
}

// Create a user row element
function createUserRow(user, imageCount) {
  const row = document.createElement('tr');
  row.dataset.userId = user.id;

  const hasDuplicateImage = user.image_path && imageCount[user.image_path] > 1;
  const duplicateClass = hasDuplicateImage ? 'duplicate-image' : '';

  // Show or hide captured photo based on menu option (with lazy loading)
  const photoIndicator = showCapturedPhotos
    ? (user.image_path
      ? `<img data-src="file://${user.image_path}" class="photo-indicator lazy-image ${duplicateClass}" alt="Foto" style="background-color: #f0f0f0">`
      : `<div class="photo-placeholder">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
             <circle cx="12" cy="7" r="4"></circle>
           </svg>
         </div>`)
    : '';

  // Show or hide repository photo based on menu option (with lazy loading)
  const repositoryIndicator = showRepositoryPhotos
    ? (user.repository_image_path
      ? `<img data-src="file://${user.repository_image_path}" class="repository-indicator lazy-image" alt="Foto Depósito" style="background-color: #f0f0f0">`
      : `<div class="repository-placeholder">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
             <circle cx="12" cy="7" r="4"></circle>
           </svg>
         </div>`)
    : '';

  // Show repository check indicator if enabled (always reserve space for alignment)
  const repositoryCheckIndicator = showRepositoryIndicators
    ? (user.repository_image_path
      ? `<svg class="repository-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
           <polyline points="22 4 12 14.01 9 11.01"></polyline>
         </svg>`
      : `<div class="repository-check-placeholder"></div>`)
    : '';

  row.innerHTML = `
    <td class="name">${user.first_name}</td>
    <td>${user.last_name1} ${user.last_name2 || ''}</td>
    <td>${user.nia || '-'}</td>
    <td>${user.group_code}</td>
    <td style="display: flex; align-items: center; gap: 4px;">${photoIndicator}${repositoryIndicator}${repositoryCheckIndicator}</td>
  `;

  row.addEventListener('click', () => selectUserRow(row, user));

  // Add double-click event to photo indicator to show full image
  if (user.image_path) {
    const photoIndicatorElement = row.querySelector('.photo-indicator');
    if (photoIndicatorElement) {
      photoIndicatorElement.addEventListener('dblclick', (e) => {
        e.stopPropagation(); // Prevent row selection
        showUserImageModal(user, 'captured');
      });
    }
  }

  // Add double-click event to repository indicator to show full image
  if (user.repository_image_path) {
    const repositoryIndicatorElement = row.querySelector('.repository-indicator');
    if (repositoryIndicatorElement) {
      repositoryIndicatorElement.addEventListener('dblclick', (e) => {
        e.stopPropagation(); // Prevent row selection
        showUserImageModal(user, 'repository');
      });
    }
  }

  return row;
}

// Setup virtual scrolling event listener
function setupVirtualScroll() {
  const container = document.getElementById('table-container');
  let scrollTimeout = null;

  container.addEventListener('scroll', () => {
    // Only handle scroll if virtualization is active
    if (!isVirtualScrolling || displayedUsers.length === 0) {
      return;
    }

    // Debounce scroll events for better performance
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }

    scrollTimeout = setTimeout(() => {
      renderVirtualizedUsers();
    }, 10); // 10ms debounce
  });
}

function selectUserRow(row, user) {
  // Remove previous selection
  document.querySelectorAll('.user-table tbody tr').forEach(tr => {
    tr.classList.remove('selected');
  });

  // Select new row
  row.classList.add('selected');
  selectedUser = user;

  // Update selected user info
  const fullName = `${user.first_name} ${user.last_name1} ${user.last_name2 || ''}`;
  selectedUserInfo.textContent = fullName;

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
async function loadImages() {
  const result = await window.electronAPI.getImages();

  if (result.success) {
    const previousLength = currentImages.length;
    currentImages = result.images;

    if (currentImages.length > 0) {
      // If new image was added, show the latest one
      if (currentImages.length > previousLength) {
        currentImageIndex = 0; // Newest image is first
      }
      showImagePreview();
    }
  }
}

async function showImagePreview() {
  if (currentImages.length === 0) return;

  imagePreviewContainer.classList.add('active');
  currentImage.src = `file://${currentImages[currentImageIndex]}`;
  updateLinkButtonState();

  // Load and display tags for current image
  await loadImageTags();
}

async function navigateImages(direction) {
  if (currentImages.length === 0) return;

  currentImageIndex += direction;

  if (currentImageIndex < 0) {
    currentImageIndex = currentImages.length - 1;
  } else if (currentImageIndex >= currentImages.length) {
    currentImageIndex = 0;
  }

  currentImage.src = `file://${currentImages[currentImageIndex]}`;

  // Load and display tags for current image
  await loadImageTags();
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

  if (currentImages.length === 0 || !imagePreviewContainer.classList.contains('active')) {
    showInfoModal('Aviso', 'Debes seleccionar una imagen');
    return;
  }

  const imagePath = currentImages[currentImageIndex];

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

    showConfirmationModal(message, async () => {
      const confirmResult = await window.electronAPI.confirmLinkImage({
        userId: selectedUser.id,
        imagePath
      });

      if (confirmResult.success) {
        await loadUsers(getCurrentFilters());
      } else {
        showInfoModal('Error', 'Error al enlazar la imagen: ' + confirmResult.error);
      }
    });
  } else if (result.needsConfirmation) {
    showConfirmationModal(
      'El usuario ya tiene una imagen asignada. ¿Deseas reemplazarla?',
      async () => {
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
    );
  } else {
    showInfoModal('Error', 'Error al enlazar la imagen: ' + result.error);
  }
}

function updateLinkButtonState() {
  const hasImageSelected = imagePreviewContainer.classList.contains('active') && currentImages.length > 0;
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

  showConfirmationModal(
    `¿Estás seguro de que deseas eliminar la fotografía vinculada a ${userName}?`,
    async () => {
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
  );
}

// Confirmation modal
function showConfirmationModal(message, onConfirm) {
  document.getElementById('confirm-message').textContent = message;
  confirmModal.classList.add('show');

  const confirmYesBtn = document.getElementById('confirm-yes-btn');
  const newConfirmYesBtn = confirmYesBtn.cloneNode(true);
  confirmYesBtn.parentNode.replaceChild(newConfirmYesBtn, confirmYesBtn);

  newConfirmYesBtn.addEventListener('click', () => {
    closeConfirmModal();
    onConfirm();
  });
}

function closeConfirmModal() {
  confirmModal.classList.remove('show');
}

// Info/Alert modal
function showInfoModal(title, message, onClose) {
  document.getElementById('info-modal-title').textContent = title;
  document.getElementById('info-modal-message').textContent = message;
  infoModal.classList.add('show');

  const okBtn = document.getElementById('info-modal-ok-btn');
  const newOkBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOkBtn, okBtn);

  newOkBtn.addEventListener('click', () => {
    closeInfoModal();
    if (onClose) onClose();
  });
}

function closeInfoModal() {
  infoModal.classList.remove('show');
  // Restore focus to search input after closing
  searchInput.focus();
}

// Progress modal functions
function setupProgressListener() {
  window.electronAPI.onProgress((data) => {
    updateProgress(data.percentage, data.message, data.details);
  });
}

function showProgressModal(title = 'Procesando...', message = 'Por favor, espera...') {
  document.getElementById('progress-title').textContent = title;
  document.getElementById('progress-message').textContent = message;
  document.getElementById('progress-bar').style.width = '0%';
  document.getElementById('progress-percentage').textContent = '0%';
  document.getElementById('progress-details').textContent = '';
  progressModal.classList.add('show');
}

function updateProgress(percentage, message = '', details = '') {
  const progressBar = document.getElementById('progress-bar');
  const progressPercentage = document.getElementById('progress-percentage');
  const progressMessage = document.getElementById('progress-message');
  const progressDetails = document.getElementById('progress-details');

  progressBar.style.width = percentage + '%';
  progressPercentage.textContent = Math.round(percentage) + '%';

  if (message) {
    progressMessage.textContent = message;
  }

  if (details) {
    progressDetails.textContent = details;
  }
}

function closeProgressModal() {
  progressModal.classList.remove('show');
}

// Menu listeners
function setupMenuListeners() {
  // Load initial display preferences from main process
  window.electronAPI.onInitialDisplayPreferences((prefs) => {
    showDuplicatesOnly = prefs.showDuplicatesOnly;
    showCapturedPhotos = prefs.showCapturedPhotos;
    showRepositoryPhotos = prefs.showRepositoryPhotos;
    showRepositoryIndicators = prefs.showRepositoryIndicators;
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

  window.electronAPI.onMenuToggleCapturedPhotos((enabled) => {
    showCapturedPhotos = enabled;
    displayUsers(currentUsers, allUsers);
  });

  window.electronAPI.onMenuToggleRepositoryPhotos((enabled) => {
    showRepositoryPhotos = enabled;
    displayUsers(currentUsers, allUsers);
  });

  window.electronAPI.onMenuToggleRepositoryIndicators((enabled) => {
    showRepositoryIndicators = enabled;
    displayUsers(currentUsers, allUsers);
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

// Export CSV
async function handleExportCSV() {
  if (!projectOpen) {
    showInfoModal('Aviso', 'Debes abrir o crear un proyecto primero');
    return;
  }

  // Get users to export based on current view
  let usersToExport = currentUsers;

  // If showing duplicates only, get all duplicates from database
  if (showDuplicatesOnly && allUsers) {
    const imageCount = {};
    allUsers.forEach(user => {
      if (user.image_path) {
        imageCount[user.image_path] = (imageCount[user.image_path] || 0) + 1;
      }
    });
    usersToExport = allUsers.filter(user => user.image_path && imageCount[user.image_path] > 1);
  }

  const result = await window.electronAPI.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Seleccionar carpeta para guardar el CSV'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const folderPath = result.filePaths[0];
    const exportResult = await window.electronAPI.exportCSV(folderPath, usersToExport);

    if (exportResult.success) {
      let message = `CSV exportado correctamente: ${exportResult.filename}\n\n`;
      message += `${exportResult.exported} usuarios exportados`;

      if (exportResult.ignored > 0) {
        message += `\n${exportResult.ignored} usuarios ignorados (sin imagen en el depósito)`;
      }

      showInfoModal('Exportación exitosa', message);
    } else {
      showInfoModal('Error', 'Error al exportar el CSV: ' + exportResult.error);
    }
  }
}

// Export images
async function handleExportImages() {
  if (!projectOpen) {
    showInfoModal('Aviso', 'Debes abrir o crear un proyecto primero');
    return;
  }

  // Get users to export based on current view (only those with images)
  let usersToExport = currentUsers;

  // If showing duplicates only, get all duplicates from database
  if (showDuplicatesOnly && allUsers) {
    const imageCount = {};
    allUsers.forEach(user => {
      if (user.image_path) {
        imageCount[user.image_path] = (imageCount[user.image_path] || 0) + 1;
      }
    });
    usersToExport = allUsers.filter(user => user.image_path && imageCount[user.image_path] > 1);
  }

  const result = await window.electronAPI.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Seleccionar carpeta para exportar las imágenes'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const folderPath = result.filePaths[0];

    // Show export options modal
    showExportOptionsModal(folderPath, usersToExport);
  }
}

// Export images by name
async function handleExportImagesName() {
  if (!projectOpen) {
    showInfoModal('Aviso', 'Debes abrir o crear un proyecto primero');
    return;
  }

  // Get users to export based on current view (only those with images)
  let usersToExport = currentUsers;

  // If showing duplicates only, get all duplicates from database
  if (showDuplicatesOnly && allUsers) {
    const imageCount = {};
    allUsers.forEach(user => {
      if (user.image_path) {
        imageCount[user.image_path] = (imageCount[user.image_path] || 0) + 1;
      }
    });
    usersToExport = allUsers.filter(user => user.image_path && imageCount[user.image_path] > 1);
  }

  const result = await window.electronAPI.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Seleccionar carpeta para exportar las imágenes'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const folderPath = result.filePaths[0];

    // Show export options modal
    showExportOptionsModalName(folderPath, usersToExport);
  }
}

// Show export options modal
function showExportOptionsModal(folderPath, usersToExport) {
  const exportOptionsModal = document.getElementById('export-options-modal');
  const exportConfirmBtn = document.getElementById('export-confirm-btn');
  const exportCancelBtn = document.getElementById('export-cancel-btn');

  // Setup event listeners (remove old ones first)
  const newExportConfirmBtn = exportConfirmBtn.cloneNode(true);
  exportConfirmBtn.parentNode.replaceChild(newExportConfirmBtn, exportConfirmBtn);

  const newExportCancelBtn = exportCancelBtn.cloneNode(true);
  exportCancelBtn.parentNode.replaceChild(newExportCancelBtn, exportCancelBtn);

  // Confirm button handler
  newExportConfirmBtn.addEventListener('click', async () => {
    // Collect export options
    const options = {
      copyOriginal: document.getElementById('export-copy-original').checked,
      resizeEnabled: document.getElementById('export-resize-enabled').checked,
      boxSize: parseInt(document.getElementById('export-box-size').value),
      maxSizeKB: parseInt(document.getElementById('export-max-size').value)
    };

    // Close modal
    exportOptionsModal.classList.remove('show');

    // Show progress modal
    showProgressModal('Exportando Imágenes', 'Procesando archivos...');

    // Perform export
    const exportResult = await window.electronAPI.exportImages(folderPath, usersToExport, options);

    closeProgressModal();

    // Only show error if export failed
    if (!exportResult.success) {
      showInfoModal('Error', 'Error al exportar imágenes: ' + exportResult.error);
    }
  });

  // Cancel button handler
  newExportCancelBtn.addEventListener('click', () => {
    exportOptionsModal.classList.remove('show');
  });

  // Reset to default state (copy original selected)
  document.getElementById('export-copy-original').checked = true;
  document.getElementById('export-resize-enabled').checked = false;

  // Show modal
  exportOptionsModal.classList.add('show');
}

// Export to repository
async function handleExportToRepository() {
  if (!projectOpen) {
    showInfoModal('Aviso', 'Debes abrir o crear un proyecto primero');
    return;
  }

  // Get users to export based on current view (only those with images)
  let usersToExport = currentUsers;

  // If showing duplicates only, get all duplicates from database
  if (showDuplicatesOnly && allUsers) {
    const imageCount = {};
    allUsers.forEach(user => {
      if (user.image_path) {
        imageCount[user.image_path] = (imageCount[user.image_path] || 0) + 1;
      }
    });
    usersToExport = allUsers.filter(user => user.image_path && imageCount[user.image_path] > 1);
  }

  // Show export options modal
  showExportToRepositoryModal(usersToExport);
}

// Show export to repository options modal
function showExportToRepositoryModal(usersToExport) {
  const exportOptionsModal = document.getElementById('export-options-modal');
  const exportConfirmBtn = document.getElementById('export-confirm-btn');
  const exportCancelBtn = document.getElementById('export-cancel-btn');

  // Setup event listeners (remove old ones first)
  const newExportConfirmBtn = exportConfirmBtn.cloneNode(true);
  exportConfirmBtn.parentNode.replaceChild(newExportConfirmBtn, exportConfirmBtn);

  const newExportCancelBtn = exportCancelBtn.cloneNode(true);
  exportCancelBtn.parentNode.replaceChild(newExportCancelBtn, exportCancelBtn);

  // Confirm button handler
  newExportConfirmBtn.addEventListener('click', async () => {
    // Collect export options
    const options = {
      copyOriginal: document.getElementById('export-copy-original').checked,
      resizeEnabled: document.getElementById('export-resize-enabled').checked,
      boxSize: parseInt(document.getElementById('export-box-size').value),
      maxSizeKB: parseInt(document.getElementById('export-max-size').value)
    };

    // Close modal
    exportOptionsModal.classList.remove('show');

    // Show progress modal
    showProgressModal('Exportando al Depósito', 'Procesando archivos...');

    // Perform export
    const exportResult = await window.electronAPI.exportToRepository(usersToExport, options);

    closeProgressModal();

    if (exportResult.success) {
      const results = exportResult.results;
      let message = `Exportación completada:\n\n`;
      message += `Total de usuarios con imágenes: ${results.total}\n`;
      message += `Imágenes exportadas correctamente: ${results.exported}\n`;

      if (results.errors.length > 0) {
        message += `\nErrores (${results.errors.length}):\n`;
        message += results.errors.slice(0, 5).map(e => `${e.user}: ${e.error}`).join('\n');
        if (results.errors.length > 5) {
          message += `\n... y ${results.errors.length - 5} más`;
        }
      }

      showInfoModal('Exportación completada', message, async () => {
        // Reload users to refresh the repository check indicators
        await loadUsers(getCurrentFilters());
      });
    } else {
      showInfoModal('Error', 'Error al exportar imágenes: ' + exportResult.error);
    }
  });

  // Cancel button handler
  newExportCancelBtn.addEventListener('click', () => {
    exportOptionsModal.classList.remove('show');
  });

  // Reset to default state (copy original selected)
  document.getElementById('export-copy-original').checked = true;
  document.getElementById('export-resize-enabled').checked = false;

  // Show modal
  exportOptionsModal.classList.add('show');
}

// Show export options modal for name-based export
function showExportOptionsModalName(folderPath, usersToExport) {
  const exportOptionsModal = document.getElementById('export-options-modal');
  const exportConfirmBtn = document.getElementById('export-confirm-btn');
  const exportCancelBtn = document.getElementById('export-cancel-btn');

  // Setup event listeners (remove old ones first)
  const newExportConfirmBtn = exportConfirmBtn.cloneNode(true);
  exportConfirmBtn.parentNode.replaceChild(newExportConfirmBtn, exportConfirmBtn);

  const newExportCancelBtn = exportCancelBtn.cloneNode(true);
  exportCancelBtn.parentNode.replaceChild(newExportCancelBtn, exportCancelBtn);

  // Confirm button handler
  newExportConfirmBtn.addEventListener('click', async () => {
    // Collect export options
    const options = {
      copyOriginal: document.getElementById('export-copy-original').checked,
      resizeEnabled: document.getElementById('export-resize-enabled').checked,
      boxSize: parseInt(document.getElementById('export-box-size').value),
      maxSizeKB: parseInt(document.getElementById('export-max-size').value)
    };

    // Close modal
    exportOptionsModal.classList.remove('show');

    // Show progress modal
    showProgressModal('Exportando Imágenes', 'Procesando archivos...');

    // Perform export
    const exportResult = await window.electronAPI.exportImagesName(folderPath, usersToExport, options);

    closeProgressModal();

    // Only show error if export failed
    if (!exportResult.success) {
      showInfoModal('Error', 'Error al exportar imágenes: ' + exportResult.error);
    }
  });

  // Cancel button handler
  newExportCancelBtn.addEventListener('click', () => {
    exportOptionsModal.classList.remove('show');
  });

  // Reset to default state (copy original selected)
  document.getElementById('export-copy-original').checked = true;
  document.getElementById('export-resize-enabled').checked = false;

  // Show modal
  exportOptionsModal.classList.add('show');
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

// Setup drag and drop for image preview
function setupDragAndDrop() {
  const imageContainer = document.querySelector('.image-container');

  // Prevent default behavior for drag events
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    imageContainer.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Highlight drop area when dragging over
  ['dragenter', 'dragover'].forEach(eventName => {
    imageContainer.addEventListener(eventName, () => {
      imageContainer.classList.add('drag-over');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    imageContainer.addEventListener(eventName, () => {
      imageContainer.classList.remove('drag-over');
    }, false);
  });

  // Handle drop
  imageContainer.addEventListener('drop', async (e) => {
    const files = Array.from(e.dataTransfer.files);

    // Filter only image files (jpg, jpeg)
    const imageFiles = files.filter(file => {
      const ext = file.name.toLowerCase();
      return ext.endsWith('.jpg') || ext.endsWith('.jpeg');
    });

    if (imageFiles.length === 0) {
      showInfoModal('Aviso', 'Por favor, arrastra solo archivos de imagen JPG/JPEG');
      return;
    }

    // Process each image file
    for (const file of imageFiles) {
      const result = await window.electronAPI.moveImageToIngest(file.path);
      if (!result.success) {
        showInfoModal('Error', `Error al mover ${file.name}: ${result.error}`);
      }
    }

    // Show success message
    if (imageFiles.length > 0) {
      // Images will be detected automatically by the folder watcher
      console.log(`${imageFiles.length} imagen(es) movida(s) a la carpeta ingest`);
    }
  }, false);
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

  showConfirmationModal(message, async () => {
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
  });
}

// Add image tag
async function handleAddImageTag() {
  if (currentImages.length === 0 || !imagePreviewContainer.classList.contains('active')) {
    showInfoModal('Aviso', 'Debes seleccionar una imagen primero');
    return;
  }

  showAddTagModal();
}

function showAddTagModal() {
  const addTagModal = document.getElementById('add-tag-modal');
  const tagInput = document.getElementById('tag-input');
  const addTagConfirmBtn = document.getElementById('add-tag-confirm-btn');
  const addTagCancelBtn = document.getElementById('add-tag-cancel-btn');

  // Clear input
  tagInput.value = '';

  // Show modal
  addTagModal.classList.add('show');
  tagInput.focus();

  // Setup event listeners (remove old ones first)
  const newAddTagConfirmBtn = addTagConfirmBtn.cloneNode(true);
  addTagConfirmBtn.parentNode.replaceChild(newAddTagConfirmBtn, addTagConfirmBtn);

  const newAddTagCancelBtn = addTagCancelBtn.cloneNode(true);
  addTagCancelBtn.parentNode.replaceChild(newAddTagCancelBtn, addTagCancelBtn);

  // Confirm button handler
  newAddTagConfirmBtn.addEventListener('click', async () => {
    const tag = tagInput.value.trim();

    if (!tag) {
      showInfoModal('Aviso', 'Por favor, ingresa un texto para la etiqueta');
      return;
    }

    // Get current image path
    const imagePath = currentImages[currentImageIndex];

    // Close modal
    addTagModal.classList.remove('show');

    // Add tag to image
    const result = await window.electronAPI.addImageTag({ imagePath, tag });

    if (result.success) {
      // Reload tags to show the new tag immediately
      await loadImageTags();
      showInfoModal('Éxito', 'Etiqueta agregada correctamente');
    } else {
      showInfoModal('Error', 'Error al agregar la etiqueta: ' + result.error);
    }
  });

  // Cancel button handler
  newAddTagCancelBtn.addEventListener('click', () => {
    addTagModal.classList.remove('show');
  });

  // Handle Enter key in input
  tagInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      newAddTagConfirmBtn.click();
    }
  });
}

// Load and display image tags
async function loadImageTags() {
  if (currentImages.length === 0) return;

  const imagePath = currentImages[currentImageIndex];
  const result = await window.electronAPI.getImageTags(imagePath);

  const tagsContainer = document.getElementById('image-tags-container');
  const tagsList = document.getElementById('image-tags-list');

  if (result.success && result.tags.length > 0) {
    // Show tags container
    tagsContainer.style.display = 'block';

    // Clear existing tags
    tagsList.innerHTML = '';

    // Add tags
    result.tags.forEach(tag => {
      const tagElement = document.createElement('div');
      tagElement.className = 'image-tag';

      const tagText = document.createElement('span');
      tagText.className = 'image-tag-text';
      tagText.textContent = tag.tag;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'image-tag-delete';
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;

      deleteBtn.addEventListener('click', async () => {
        const confirmDelete = confirm(`¿Deseas eliminar la etiqueta "${tag.tag}"?`);
        if (confirmDelete) {
          const deleteResult = await window.electronAPI.deleteImageTag(tag.id);
          if (deleteResult.success) {
            // Reload tags
            await loadImageTags();
          } else {
            showInfoModal('Error', 'Error al eliminar la etiqueta: ' + deleteResult.error);
          }
        }
      });

      tagElement.appendChild(tagText);
      tagElement.appendChild(deleteBtn);
      tagsList.appendChild(tagElement);
    });
  } else {
    // Hide tags container if no tags
    tagsContainer.style.display = 'none';
  }
}

// Show tagged images modal
async function handleShowTaggedImages() {
  if (!projectOpen) {
    showInfoModal('Aviso', 'Debes abrir o crear un proyecto primero');
    return;
  }

  const taggedImagesModal = document.getElementById('tagged-images-modal');
  const taggedImagesContainer = document.getElementById('tagged-images-container');
  const taggedImagesCloseBtn = document.getElementById('tagged-images-close-btn');

  // Show loading state
  taggedImagesContainer.innerHTML = '<div class="loading">Cargando imágenes con etiquetas...</div>';
  taggedImagesModal.classList.add('show');

  // Fetch all images with tags
  const result = await window.electronAPI.getAllImagesWithTags();

  if (!result.success) {
    taggedImagesContainer.innerHTML = `<div class="tagged-images-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <p>Error al cargar las imágenes: ${result.error}</p>
    </div>`;
    return;
  }

  // Clear container
  taggedImagesContainer.innerHTML = '';

  if (result.images.length === 0) {
    // Show empty state
    taggedImagesContainer.innerHTML = `<div class="tagged-images-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
      <p>No hay imágenes con etiquetas</p>
    </div>`;
  } else {
    // Display images with tags
    result.images.forEach(imageData => {
      const imageItem = document.createElement('div');
      imageItem.className = 'tagged-image-item';

      // Image preview
      const imagePreview = document.createElement('img');
      imagePreview.className = 'tagged-image-preview';
      imagePreview.src = `file://${imageData.path}`;
      imagePreview.alt = 'Imagen con etiquetas';

      // Tags container
      const tagsContainer = document.createElement('div');
      tagsContainer.className = 'tagged-image-tags';

      imageData.tags.forEach(tag => {
        const tagElement = document.createElement('div');
        tagElement.className = 'tagged-image-tag';
        tagElement.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
          <span>${tag.tag}</span>
        `;
        tagsContainer.appendChild(tagElement);
      });

      // Add elements to item
      imageItem.appendChild(imagePreview);
      imageItem.appendChild(tagsContainer);

      // Add click handler to show full image
      imageItem.addEventListener('click', () => {
        // Find the image in currentImages
        const imageIndex = currentImages.indexOf(imageData.path);
        if (imageIndex !== -1) {
          currentImageIndex = imageIndex;
          showImagePreview();
          taggedImagesModal.classList.remove('show');
        }
      });

      taggedImagesContainer.appendChild(imageItem);
    });
  }

  // Setup close button
  const newCloseBtn = taggedImagesCloseBtn.cloneNode(true);
  taggedImagesCloseBtn.parentNode.replaceChild(newCloseBtn, taggedImagesCloseBtn);

  newCloseBtn.addEventListener('click', () => {
    taggedImagesModal.classList.remove('show');
  });
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
