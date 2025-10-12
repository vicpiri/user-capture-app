// State management
let currentUsers = [];
let currentGroups = [];
let selectedUser = null;
let currentImages = [];
let currentImageIndex = 0;
let projectOpen = false;

// DOM Elements
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const groupFilter = document.getElementById('group-filter');
const userTableBody = document.getElementById('user-table-body');
const selectedUserInfo = document.getElementById('selected-user-info');
const userCount = document.getElementById('user-count');
const linkBtn = document.getElementById('link-btn');
const imagePreviewContainer = document.getElementById('image-preview-container');
const currentImage = document.getElementById('current-image');
const prevImageBtn = document.getElementById('prev-image');
const nextImageBtn = document.getElementById('next-image');

// Modals
const newProjectModal = document.getElementById('new-project-modal');
const confirmModal = document.getElementById('confirm-modal');
const progressModal = document.getElementById('progress-modal');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  setupProgressListener();
  setupMenuListeners();
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
    alert('Por favor, selecciona la carpeta del proyecto y el archivo XML');
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
    alert('Error al crear el proyecto: ' + result.error);
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
      alert('Error al abrir el proyecto: ' + openResult.error);
    }
  }
}

// Load project data
async function loadProjectData() {
  await loadGroups();
  await loadUsers();
  await loadImages();
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
  const result = await window.electronAPI.getUsers(filters);

  if (result.success) {
    currentUsers = result.users;
    displayUsers(currentUsers);
    updateUserCount();
  }
}

async function displayUsers(users) {
  userTableBody.innerHTML = '';

  // Check for duplicate images
  const imageCount = {};
  users.forEach(user => {
    if (user.image_path) {
      imageCount[user.image_path] = (imageCount[user.image_path] || 0) + 1;
    }
  });

  users.forEach(user => {
    const row = document.createElement('tr');
    row.dataset.userId = user.id;

    const hasDuplicateImage = user.image_path && imageCount[user.image_path] > 1;
    const duplicateClass = hasDuplicateImage ? 'duplicate-image' : '';

    const photoIndicator = user.image_path
      ? `<img src="file://${user.image_path}" class="photo-indicator ${duplicateClass}" alt="Foto">`
      : `<div class="photo-placeholder">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
             <circle cx="12" cy="7" r="4"></circle>
           </svg>
         </div>`;

    row.innerHTML = `
      <td class="name">${user.first_name}</td>
      <td>${user.last_name1} ${user.last_name2 || ''}</td>
      <td>${user.nia || '-'}</td>
      <td>${user.group_code}</td>
      <td>${photoIndicator}</td>
    `;

    row.addEventListener('click', () => selectUserRow(row, user));
    userTableBody.appendChild(row);
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

// Filter users
async function filterUsers() {
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

function showImagePreview() {
  if (currentImages.length === 0) return;

  imagePreviewContainer.classList.add('active');
  currentImage.src = `file://${currentImages[currentImageIndex]}`;
  updateLinkButtonState();
}

function navigateImages(direction) {
  if (currentImages.length === 0) return;

  currentImageIndex += direction;

  if (currentImageIndex < 0) {
    currentImageIndex = currentImages.length - 1;
  } else if (currentImageIndex >= currentImages.length) {
    currentImageIndex = 0;
  }

  currentImage.src = `file://${currentImages[currentImageIndex]}`;
}

// Link image to user
async function handleLinkImage() {
  if (!selectedUser) {
    alert('Debes seleccionar un usuario');
    return;
  }

  if (currentImages.length === 0 || !imagePreviewContainer.classList.contains('active')) {
    alert('Debes seleccionar una imagen');
    return;
  }

  const imagePath = currentImages[currentImageIndex];

  const result = await window.electronAPI.linkImageToUser({
    userId: selectedUser.id,
    imagePath
  });

  if (result.success) {
    await loadUsers();
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
        await loadUsers();
      } else {
        alert('Error al enlazar la imagen: ' + confirmResult.error);
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
          await loadUsers();
        } else {
          alert('Error al enlazar la imagen: ' + confirmResult.error);
        }
      }
    );
  } else {
    alert('Error al enlazar la imagen: ' + result.error);
  }
}

function updateLinkButtonState() {
  const hasImageSelected = imagePreviewContainer.classList.contains('active') && currentImages.length > 0;
  const hasUserSelected = selectedUser !== null;

  linkBtn.disabled = !(hasImageSelected && hasUserSelected);
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
}
