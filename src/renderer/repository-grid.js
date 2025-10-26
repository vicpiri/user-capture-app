// Repository Grid functionality - Shows users with images from repository
let allUsers = [];
let currentGroups = [];
let selectedGroupCode = '';
let imageObserver = null;
let isSyncing = false;  // Track if repository is currently syncing
let initialSyncCompleted = false;  // Track if initial mirror sync has completed

// DOM Elements
const gridContainer = document.getElementById('grid-container');
const loadingElement = document.getElementById('loading');
const statsElement = document.getElementById('stats');
const groupFilter = document.getElementById('group-filter');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[SYNC] DOM loaded, starting initialization...');
  const startTime = performance.now();

  await loadGroups();
  console.log(`[SYNC] loadGroups() took ${(performance.now() - startTime).toFixed(2)}ms`);

  // Load saved group filter
  const filterStart = performance.now();
  const filterResult = await window.electronAPI.getSelectedGroupFilter();
  console.log(`[SYNC] getSelectedGroupFilter() took ${(performance.now() - filterStart).toFixed(2)}ms`);
  if (filterResult.success && filterResult.groupCode) {
    selectedGroupCode = filterResult.groupCode;
    groupFilter.value = filterResult.groupCode;
  }

  // Load users immediately to show the grid structure
  console.log('[SYNC] Loading users for initial display...');
  const usersStart = performance.now();
  await loadUsers();
  console.log(`[SYNC] loadUsers() took ${(performance.now() - usersStart).toFixed(2)}ms`);

  // Check current sync status
  console.log('[SYNC] Checking initial sync status...');
  const syncStatusStart = performance.now();
  const syncStatus = await window.electronAPI.getSyncStatus();
  console.log(`[SYNC] getSyncStatus() took ${(performance.now() - syncStatusStart).toFixed(2)}ms`, syncStatus);

  if (syncStatus.success) {
    // If sync has already completed, load repository data immediately
    if (syncStatus.hasCompleted && !syncStatus.isSyncing) {
      console.log('[SYNC] Sync already completed, loading repository data immediately...');
      initialSyncCompleted = true;
      isSyncing = true; // Set to true temporarily while loading
      updateSyncStatus('Cargando imágenes del depósito...');
      initLazyLoading();
      displayGrid();
      await loadRepositoryDataInBackground(allUsers);
    } else {
      // Sync is still in progress, show spinners
      console.log('[SYNC] Sync still in progress, showing spinners...');
      isSyncing = true;
      updateSyncStatus('Cargando imágenes del depósito...');
      initLazyLoading();
      displayGrid();
    }
  } else {
    // Couldn't get sync status, assume syncing
    console.log('[SYNC] Could not get sync status, assuming syncing...');
    isSyncing = true;
    updateSyncStatus('Cargando imágenes del depósito...');
    initLazyLoading();
    displayGrid();
  }

  console.log(`[SYNC] Total init time: ${(performance.now() - startTime).toFixed(2)}ms`);

  // Add event listener for group filter
  groupFilter.addEventListener('change', async () => {
    selectedGroupCode = groupFilter.value;
    // Save filter selection and broadcast to other windows
    await window.electronAPI.setSelectedGroupFilter(selectedGroupCode);
    await loadUsers();
    displayGrid();
  });

  // Listen for group filter changes from other windows
  window.electronAPI.onGroupFilterChanged(async (groupCode) => {
    selectedGroupCode = groupCode;
    groupFilter.value = groupCode;
    await loadUsers();
    displayGrid();
  });

  // Listen for repository changes
  window.electronAPI.onRepositoryChanged(async () => {
    await loadUsers();
    displayGrid();
  });

  // Listen for sync progress events
  window.electronAPI.onSyncProgress((data) => {
    if (data.phase === 'syncing') {
      isSyncing = true;
      updateSyncStatus(`Sincronizando: ${data.current}/${data.total} archivos`);
    }
  });

  // Listen for sync completion
  window.electronAPI.onSyncCompleted(async (result) => {
    console.log('[SYNC] sync-completed event received:', result);

    if (result.success) {
      if (!initialSyncCompleted) {
        // First sync completed - now load repository images
        console.log('[SYNC] Initial sync completed, loading repository images...');
        initialSyncCompleted = true;

        // Load repository data now that mirror is ready
        isSyncing = true;
        updateSyncStatus('Cargando imágenes del depósito...');
        await loadRepositoryDataInBackground(allUsers);
      } else {
        // Subsequent syncs - just reload repository data
        console.log('[SYNC] Reloading repository images after sync completed');
        isSyncing = true;
        updateSyncStatus('Actualizando imágenes...');
        await loadRepositoryDataInBackground(allUsers);
      }
    } else {
      isSyncing = false;
      updateSyncStatus(`Error en sincronización: ${result.error}`);
      if (!initialSyncCompleted) {
        updateSyncStatus('Error al cargar el depósito');
      }
    }
  });
});

// Load groups from main process
async function loadGroups() {
  try {
    const result = await window.electronAPI.getGroups();

    if (result.success) {
      currentGroups = result.groups;
      populateGroupFilter();
    } else {
      console.error('Error loading groups:', result.error);
    }
  } catch (error) {
    console.error('Error loading groups:', error);
  }
}

// Populate group filter dropdown
function populateGroupFilter() {
  groupFilter.innerHTML = '<option value="">Todos los grupos</option>';
  currentGroups.forEach(group => {
    const option = document.createElement('option');
    option.value = group.code;
    option.textContent = `${group.code} - ${group.name}`;
    groupFilter.appendChild(option);
  });
}

// Load users from main process (WITHOUT repository images)
async function loadUsers() {
  try {
    // Build filters based on selected group
    const filters = {};
    if (selectedGroupCode) {
      filters.group = selectedGroupCode;
    }

    // Load users WITHOUT repository images for fast initial display
    const result = await window.electronAPI.getUsers(filters, {
      loadRepositoryImages: false, // Always false - repository data loaded separately
      loadCapturedImages: false
    });

    if (result.success) {
      // Show ALL users (with or without repository image)
      allUsers = result.users;
      console.log(`[SYNC] Loaded ${allUsers.length} users`);
    } else {
      console.error('Error loading users:', result.error);
      loadingElement.textContent = 'Error al cargar usuarios';
    }
  } catch (error) {
    console.error('Error loading users:', error);
    loadingElement.textContent = 'Error al cargar usuarios';
  }
}

// Load repository data in background (non-blocking)
async function loadRepositoryDataInBackground(users) {
  try {
    console.log('[SYNC] Loading repository data in background...');

    const result = await window.electronAPI.loadRepositoryImages(users);

    console.log('[SYNC] loadRepositoryImages finished');
    if (result.success) {
      console.log(`[SYNC] Repository data loaded for ${Object.keys(result.repositoryData).length} users`);

      // Merge repository data into allUsers
      allUsers.forEach(user => {
        const repoData = result.repositoryData[user.id];
        if (repoData) {
          user.has_repository_image = repoData.has_repository_image;
          user.repository_image_path = repoData.repository_image_path;
        }
      });

      console.log('[SYNC] Setting isSyncing = false');
      isSyncing = false;
      updateSyncStatus(null);

      // Re-display grid with repository data
      displayGrid();
    } else {
      console.error('Error loading repository data:', result.error);
      isSyncing = false;
      updateSyncStatus(null);
    }
  } catch (error) {
    console.error('Error loading repository data in background:', error);
    isSyncing = false;
    updateSyncStatus(null);
  }
}

// Display grid
function displayGrid() {
  console.log('[SYNC] displayGrid() called, isSyncing =', isSyncing);

  if (allUsers.length === 0) {
    loadingElement.textContent = 'No hay usuarios para mostrar';
    return;
  }

  // Hide loading, show grid
  loadingElement.style.display = 'none';
  gridContainer.style.display = 'grid';

  // Update stats only if not syncing (otherwise keep the sync status message)
  console.log('[SYNC] Checking if should update stats, isSyncing =', isSyncing);
  if (!isSyncing) {
    const usersWithImages = allUsers.filter(u => u.repository_image_path).length;
    statsElement.textContent = `${allUsers.length} usuarios (${usersWithImages} con imagen en depósito)`;
  }

  // Clear grid
  gridContainer.innerHTML = '';

  // Create grid items
  allUsers.forEach(user => {
    const gridItem = createGridItem(user);
    gridContainer.appendChild(gridItem);
  });

  // Observe new lazy images after rendering
  observeLazyImages();
}

// Create a single grid item
function createGridItem(user) {
  const item = document.createElement('div');
  item.className = 'grid-item';

  // Image container
  const imageContainer = document.createElement('div');
  imageContainer.className = 'grid-item-image-container';

  // Check if user has repository image
  if (user.repository_image_path) {
    // User has an image in repository - use lazy loading
    const img = document.createElement('img');
    img.className = 'grid-item-image lazy-image';
    // Store the actual path in data attribute
    img.dataset.src = `file://${user.repository_image_path}`;
    img.alt = `${user.first_name} ${user.last_name1}`;

    // Show placeholder initially
    img.style.backgroundColor = '#f0f0f0';

    // Handle image load errors
    img.onerror = () => {
      imageContainer.innerHTML = createPlaceholderSVG(false);
    };

    imageContainer.appendChild(img);
  } else {
    // User has no image in repository - show placeholder or spinner
    const showSpinner = isSyncing;
    imageContainer.innerHTML = createPlaceholderSVG(showSpinner);
  }

  // User info
  const infoDiv = document.createElement('div');
  infoDiv.className = 'grid-item-info';

  const nameDiv = document.createElement('div');
  nameDiv.className = 'grid-item-name';
  nameDiv.textContent = user.first_name;
  nameDiv.title = user.first_name; // Show full name on hover

  const detailsDiv = document.createElement('div');
  detailsDiv.className = 'grid-item-details';
  const lastName = `${user.last_name1} ${user.last_name2 || ''}`.trim();
  detailsDiv.textContent = lastName;
  detailsDiv.title = lastName; // Show full name on hover

  const extraDetailsDiv = document.createElement('div');
  extraDetailsDiv.className = 'grid-item-details';
  if (user.type === 'student' && user.nia) {
    extraDetailsDiv.textContent = `NIA: ${user.nia}`;
  } else if (user.document) {
    extraDetailsDiv.textContent = `DNI: ${user.document}`;
  } else {
    extraDetailsDiv.textContent = user.group_code || '';
  }

  infoDiv.appendChild(nameDiv);
  infoDiv.appendChild(detailsDiv);
  infoDiv.appendChild(extraDetailsDiv);

  item.appendChild(imageContainer);
  item.appendChild(infoDiv);

  return item;
}

// Create placeholder SVG for users without images
function createPlaceholderSVG(showSpinner = false) {
  if (showSpinner) {
    // Show spinner during sync
    return `
      <div class="grid-item-spinner">
        <div class="spinner"></div>
      </div>
    `;
  } else {
    // Show static user icon
    return `
      <div class="grid-item-placeholder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
    `;
  }
}

// Update sync status in the header
function updateSyncStatus(message) {
  const statsElement = document.getElementById('stats');

  if (message) {
    // Show sync status with spinner
    statsElement.innerHTML = `
      <div class="sync-status">
        <div class="spinner-small"></div>
        <span>${message}</span>
      </div>
    `;
  } else {
    // Show normal stats
    const usersWithImages = allUsers.filter(u => u.repository_image_path).length;
    statsElement.textContent = `${allUsers.length} usuarios (${usersWithImages} con imagen en depósito)`;
  }
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

  // Observe all lazy images
  observeLazyImages();
}

// Observe all images with lazy-image class
function observeLazyImages() {
  const lazyImages = document.querySelectorAll('.lazy-image');
  lazyImages.forEach(img => {
    imageObserver.observe(img);
  });
}