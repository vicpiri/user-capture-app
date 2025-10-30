/**
 * Printed Cards Window - Renderer Process
 * Displays list of users with printed cards
 */

(function() {
  'use strict';

  // DOM elements
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const errorMessageEl = document.getElementById('error-message');
  const emptyEl = document.getElementById('empty');
  const tableWrapperEl = document.getElementById('table-wrapper');
  const tableBodyEl = document.getElementById('table-body');
  const subtitleEl = document.getElementById('subtitle');
  const clearListBtn = document.getElementById('clear-list-btn');

  /**
   * Initialize the window
   */
  async function init() {
    try {
      // Add click handler for clear button
      if (clearListBtn) {
        clearListBtn.addEventListener('click', handleClearList);
      }

      await loadPrintedCards();
    } catch (error) {
      console.error('Error initializing printed cards window:', error);
      showError('Error al inicializar la ventana: ' + error.message);
    }
  }

  /**
   * Handle clear list button click
   */
  async function handleClearList() {
    try {
      // Show confirmation dialog
      const confirmed = await showConfirmDialog(
        '¿Estás seguro de que deseas limpiar la lista de carnets impresos?\n\n' +
        'Esta acción eliminará todos los archivos de la carpeta Printed-ID y no se puede deshacer.'
      );

      if (!confirmed) {
        return;
      }

      // Show loading state
      showLoading();

      // Call backend to clear the list
      const result = await window.electronAPI.clearPrintedCards();

      if (!result.success) {
        showError(result.error || 'Error al limpiar la lista');
        return;
      }

      // Reload the list (should be empty now)
      await loadPrintedCards();

    } catch (error) {
      console.error('Error clearing printed cards list:', error);
      showError('Error al limpiar la lista: ' + error.message);
    }
  }

  /**
   * Show confirmation dialog
   * @param {string} message - Confirmation message
   * @returns {Promise<boolean>}
   */
  function showConfirmDialog(message) {
    return new Promise((resolve) => {
      const result = confirm(message);
      resolve(result);
    });
  }

  /**
   * Load printed cards data
   */
  async function loadPrintedCards() {
    try {
      // Show loading state
      showLoading();

      // Get printed cards from main process
      const result = await window.electronAPI.getPrintedCards();

      if (!result.success) {
        showError(result.error || 'Error desconocido al cargar los carnets impresos');
        return;
      }

      const users = result.users || [];

      // Update subtitle with count
      subtitleEl.textContent = `${users.length} carnet${users.length !== 1 ? 's' : ''} impreso${users.length !== 1 ? 's' : ''}`;

      if (users.length === 0) {
        showEmpty();
        // Hide clear button when list is empty
        if (clearListBtn) {
          clearListBtn.style.display = 'none';
        }
        return;
      }

      // Populate table
      populateTable(users);
      showTable();

      // Show clear button when list has items
      if (clearListBtn) {
        clearListBtn.style.display = 'flex';
      }

    } catch (error) {
      console.error('Error loading printed cards:', error);
      showError('Error al cargar los carnets impresos: ' + error.message);
    }
  }

  /**
   * Populate table with user data
   * @param {Array} users - Array of user objects
   */
  function populateTable(users) {
    // Clear existing rows
    tableBodyEl.innerHTML = '';

    // Users are already sorted by printed date (newest first) from backend
    // Create rows
    users.forEach(user => {
      const row = createUserRow(user);
      tableBodyEl.appendChild(row);
    });
  }

  /**
   * Create a table row for a user
   * @param {Object} user - User object
   * @returns {HTMLTableRowElement}
   */
  function createUserRow(user) {
    const row = document.createElement('tr');

    // Type cell
    const typeCell = document.createElement('td');
    const typeSpan = document.createElement('span');
    typeSpan.className = `user-type ${user.type}`;
    typeSpan.textContent = getUserTypeLabel(user.type);
    typeCell.appendChild(typeSpan);
    row.appendChild(typeCell);

    // ID cell
    const idCell = document.createElement('td');
    idCell.textContent = getUserId(user);
    row.appendChild(idCell);

    // Full name cell
    const nameCell = document.createElement('td');
    nameCell.textContent = getFullName(user);
    row.appendChild(nameCell);

    // Group cell
    const groupCell = document.createElement('td');
    groupCell.textContent = user.group_name || '-';
    row.appendChild(groupCell);

    // Printed date cell
    const printedDateCell = document.createElement('td');
    printedDateCell.textContent = formatDateTime(user.printed_date);
    row.appendChild(printedDateCell);

    return row;
  }

  /**
   * Get user type label in Spanish
   * @param {string} type - User type
   * @returns {string}
   */
  function getUserTypeLabel(type) {
    const labels = {
      student: 'Alumno',
      teacher: 'Docente',
      staff: 'No Docente'
    };
    return labels[type] || type;
  }

  /**
   * Get user ID (NIA for students, document for others)
   * @param {Object} user - User object
   * @returns {string}
   */
  function getUserId(user) {
    if (user.type === 'student' && user.nia) {
      return user.nia;
    }
    return user.document || '-';
  }

  /**
   * Get user's full name
   * @param {Object} user - User object
   * @returns {string}
   */
  function getFullName(user) {
    const parts = [
      user.last_name1,
      user.last_name2,
      user.first_name
    ].filter(Boolean);
    return parts.join(' ') || '-';
  }

  /**
   * Format date from ISO to Spanish format
   * @param {string} dateStr - ISO date string
   * @returns {string}
   */
  function formatDate(dateStr) {
    if (!dateStr) return '-';

    try {
      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      return dateStr;
    }
  }

  /**
   * Format datetime from ISO to Spanish format with time
   * @param {string} dateStr - ISO date string
   * @returns {string}
   */
  function formatDateTime(dateStr) {
    if (!dateStr) return '-';

    try {
      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (error) {
      return dateStr;
    }
  }

  /**
   * Show loading state
   */
  function showLoading() {
    loadingEl.style.display = 'flex';
    errorEl.style.display = 'none';
    emptyEl.style.display = 'none';
    tableWrapperEl.style.display = 'none';
  }

  /**
   * Show error state
   * @param {string} message - Error message
   */
  function showError(message) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'flex';
    emptyEl.style.display = 'none';
    tableWrapperEl.style.display = 'none';
    errorMessageEl.textContent = message;
  }

  /**
   * Show empty state
   */
  function showEmpty() {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'none';
    emptyEl.style.display = 'flex';
    tableWrapperEl.style.display = 'none';
  }

  /**
   * Show table
   */
  function showTable() {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'none';
    emptyEl.style.display = 'none';
    tableWrapperEl.style.display = 'block';
  }

  // Initialize on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
