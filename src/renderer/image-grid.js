// Image Grid functionality
let allUsers = [];
let currentGroups = [];
let selectedGroupCode = '';
let imageObserver = null;

// DOM Elements
const gridContainer = document.getElementById('grid-container');
const loadingElement = document.getElementById('loading');
const statsElement = document.getElementById('stats');
const groupFilter = document.getElementById('group-filter');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadGroups();
  await loadUsers();
  initLazyLoading();
  displayGrid();

  // Add event listener for group filter
  groupFilter.addEventListener('change', async () => {
    selectedGroupCode = groupFilter.value;
    await loadUsers();
    displayGrid();
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

// Load users from main process
async function loadUsers() {
  try {
    // Build filters based on selected group
    const filters = {};
    if (selectedGroupCode) {
      filters.group = selectedGroupCode;
    }

    const result = await window.electronAPI.getUsers(filters);

    if (result.success) {
      allUsers = result.users;
    } else {
      console.error('Error loading users:', result.error);
      loadingElement.textContent = 'Error al cargar usuarios';
    }
  } catch (error) {
    console.error('Error loading users:', error);
    loadingElement.textContent = 'Error al cargar usuarios';
  }
}

// Display grid
function displayGrid() {
  if (allUsers.length === 0) {
    loadingElement.textContent = 'No hay usuarios para mostrar';
    return;
  }

  // Hide loading, show grid
  loadingElement.style.display = 'none';
  gridContainer.style.display = 'grid';

  // Update stats
  const usersWithImages = allUsers.filter(u => u.image_path).length;
  statsElement.textContent = `${allUsers.length} usuarios (${usersWithImages} con imagen)`;

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

  if (user.image_path) {
    // User has an image - use lazy loading
    const img = document.createElement('img');
    img.className = 'grid-item-image lazy-image';
    // Store the actual path in data attribute
    img.dataset.src = `file://${user.image_path}`;
    img.alt = `${user.first_name} ${user.last_name1}`;

    // Show placeholder initially
    img.style.backgroundColor = '#f0f0f0';

    // Handle image load errors
    img.onerror = () => {
      imageContainer.innerHTML = createPlaceholderSVG();
    };

    imageContainer.appendChild(img);
  } else {
    // User has no image - show placeholder
    imageContainer.innerHTML = createPlaceholderSVG();
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
function createPlaceholderSVG() {
  return `
    <div class="grid-item-placeholder">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    </div>
  `;
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
