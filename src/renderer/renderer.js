// State management
let currentUsers = [];
let allUsers = []; // All users from database for duplicate checking
let currentGroups = [];
let selectedUser = null;
let currentImages = [];
let currentImageIndex = 0;
let projectOpen = false;
let showDuplicatesOnly = false;

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

// Modals
const newProjectModal = document.getElementById('new-project-modal');
const confirmModal = document.getElementById('confirm-modal');
const progressModal = document.getElementById('progress-modal');

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

  // Keyboard navigation for images and users
  document.addEventListener('keydown', (event) => {
    // Don't handle keyboard events if a modal is open
    if (newProjectModal.classList.contains('show') ||
        confirmModal.classList.contains('show') ||
        progressModal.classList.contains('show')) return;

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

    // Always reload all users for accurate duplicate checking
    const allResult = await window.electronAPI.getUsers({});
    if (allResult.success) {
      allUsers = allResult.users;
    }

    displayUsers(currentUsers, allUsers);
    updateUserCount();
  }
}

async function displayUsers(users, allUsers = null) {
  userTableBody.innerHTML = '';

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

  usersToDisplay.forEach(user => {
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

// Delete photo link
async function handleDeletePhoto() {
  if (!selectedUser) {
    alert('Debes seleccionar un usuario');
    return;
  }

  if (!selectedUser.image_path) {
    alert('El usuario seleccionado no tiene una fotografía vinculada');
    return;
  }

  const userName = `${selectedUser.first_name} ${selectedUser.last_name1} ${selectedUser.last_name2 || ''}`.trim();

  showConfirmationModal(
    `¿Estás seguro de que deseas eliminar la fotografía vinculada a ${userName}?`,
    async () => {
      const result = await window.electronAPI.unlinkImageFromUser(selectedUser.id);

      if (result.success) {
        await loadUsers();
        // Update selected user reference
        const updatedUser = currentUsers.find(u => u.id === selectedUser.id);
        if (updatedUser) {
          selectedUser = updatedUser;
        }
      } else {
        alert('Error al eliminar la fotografía: ' + result.error);
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

  window.electronAPI.onMenuImportImagesId(() => {
    handleImportImagesId();
  });

  window.electronAPI.onMenuExportCSV(() => {
    handleExportCSV();
  });
}

// Import images with ID
async function handleImportImagesId() {
  if (!projectOpen) {
    alert('Debes abrir o crear un proyecto primero');
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

      alert(message);

      // Reload users and images to reflect changes
      await loadUsers();
      await loadImages();
    } else {
      alert('Error al importar imágenes: ' + importResult.error);
    }
  }
}

// Export CSV
async function handleExportCSV() {
  if (!projectOpen) {
    alert('Debes abrir o crear un proyecto primero');
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
      alert(`CSV exportado correctamente: ${exportResult.filename}\n${usersToExport.length} usuarios exportados.`);
    } else {
      alert('Error al exportar el CSV: ' + exportResult.error);
    }
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
      alert('Por favor, arrastra solo archivos de imagen JPG/JPEG');
      return;
    }

    // Process each image file
    for (const file of imageFiles) {
      const result = await window.electronAPI.moveImageToIngest(file.path);
      if (!result.success) {
        alert(`Error al mover ${file.name}: ${result.error}`);
      }
    }

    // Show success message
    if (imageFiles.length > 0) {
      // Images will be detected automatically by the folder watcher
      console.log(`${imageFiles.length} imagen(es) movida(s) a la carpeta ingest`);
    }
  }, false);
}
