/**
 * SelectionModeManager - Manages multi-user selection mode
 *
 * Handles all selection mode functionality:
 * - Enabling/disabling selection mode
 * - Managing selected users Set
 * - Context menu for selection actions
 * - Table header checkbox column
 * - Selection info display
 * - Select all / deselect all
 *
 * Features:
 * - Right-click context menu to enter selection mode
 * - Checkbox column in table header when active
 * - Select all checkbox in header
 * - Auto-exit when no users selected
 */

(function(global) {
  'use strict';

  class SelectionModeManager {
    constructor(config = {}) {
      // Required callbacks
      this.onSelectionChange = config.onSelectionChange || (() => {}); // Called when selection state changes
      this.getDisplayedUsers = config.getDisplayedUsers || (() => []); // Get currently displayed users
      this.reRenderUsers = config.reRenderUsers || (() => {}); // Re-render user list
      this.onRequestCardPrint = config.onRequestCardPrint || (() => {}); // Called when requesting card print
      this.onRequestPublication = config.onRequestPublication || (() => {}); // Called when requesting publication
      this.onUnpayOrla = config.onUnpayOrla || (() => {}); // Called when unpaying orla from context menu
      this.onUnprintReceipt = config.onUnprintReceipt || (() => {}); // Called when unprinting receipt from context menu

      // DOM elements
      this.selectedUserInfo = config.selectedUserInfo; // Element to display selection info
      this.tableHeader = config.tableHeader; // Table header element

      // State
      this.isActive = false;
      this.selectedUsers = new Set(); // Set of selected user IDs
      this.currentSelectedUser = null; // Currently selected single user (when not in selection mode)
    }

    /**
     * Check if selection mode is active
     * @returns {boolean} True if active
     */
    isSelectionMode() {
      return this.isActive;
    }

    /**
     * Get set of selected user IDs
     * @returns {Set} Set of user IDs
     */
    getSelectedUsers() {
      return this.selectedUsers;
    }

    /**
     * Show context menu for selection actions
     * @param {Event} event - Mouse event
     * @param {object} user - User object
     */
    showContextMenu(event, user) {
      // Remove any existing context menu
      const existingMenu = document.querySelector('.context-menu');
      if (existingMenu) {
        existingMenu.remove();
      }

      // Create context menu
      const menu = document.createElement('div');
      menu.className = 'context-menu';
      menu.style.position = 'fixed';
      menu.style.left = `${event.clientX}px`;
      menu.style.top = `${event.clientY}px`;

      // If not in selection mode, show "Seleccionar" option and payment/printing options
      if (!this.isActive) {
        const selectOption = document.createElement('div');
        selectOption.className = 'context-menu-item';
        selectOption.textContent = 'Seleccionar';
        selectOption.addEventListener('click', () => {
          this.enable(user.id);
          menu.remove();
        });
        menu.appendChild(selectOption);

        // Add separator if there are payment/printing options
        if (user.orla_paid === 1 || user.receipt_printed === 1) {
          const separator = document.createElement('div');
          separator.className = 'context-menu-separator';
          menu.appendChild(separator);
        }

        // Option: Desmarcar recibo impreso (only if printed)
        if (user.receipt_printed === 1) {
          const unprintOption = document.createElement('div');
          unprintOption.className = 'context-menu-item';
          unprintOption.textContent = 'Desmarcar recibo impreso';
          unprintOption.addEventListener('click', async () => {
            menu.remove();
            if (this.onUnprintReceipt) {
              await this.onUnprintReceipt(user.id);
            }
          });
          menu.appendChild(unprintOption);
        }

        // Option: Desmarcar orla pagada (only if paid AND receipt is not printed)
        if (user.orla_paid === 1 && user.receipt_printed !== 1) {
          const unpayOption = document.createElement('div');
          unpayOption.className = 'context-menu-item';
          unpayOption.textContent = 'Desmarcar orla pagada';
          unpayOption.addEventListener('click', async () => {
            menu.remove();
            if (this.onUnpayOrla) {
              await this.onUnpayOrla(user.id);
            }
          });
          menu.appendChild(unpayOption);
        }
      } else {
        // If in selection mode, show selection options

        // Option: Solicitar impresión de carnet
        const requestCardPrintOption = document.createElement('div');
        requestCardPrintOption.className = 'context-menu-item';
        requestCardPrintOption.textContent = 'Solicitar impresión de carnet';
        requestCardPrintOption.addEventListener('click', () => {
          this.onRequestCardPrint(Array.from(this.selectedUsers));
          menu.remove();
        });
        menu.appendChild(requestCardPrintOption);

        // Option: Solicitar publicación oficial
        const requestPublicationOption = document.createElement('div');
        requestPublicationOption.className = 'context-menu-item';
        requestPublicationOption.textContent = 'Solicitar publicación oficial';
        requestPublicationOption.addEventListener('click', () => {
          this.onRequestPublication(Array.from(this.selectedUsers));
          menu.remove();
        });
        menu.appendChild(requestPublicationOption);

        // Separator
        const separator = document.createElement('div');
        separator.className = 'context-menu-separator';
        menu.appendChild(separator);

        // Option: Deseleccionar todo
        const deselectAllOption = document.createElement('div');
        deselectAllOption.className = 'context-menu-item';
        deselectAllOption.textContent = 'Deseleccionar todo';
        deselectAllOption.addEventListener('click', () => {
          this.disable();
          menu.remove();
        });
        menu.appendChild(deselectAllOption);
      }

      document.body.appendChild(menu);

      // Close menu when clicking outside
      const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      };

      // Use setTimeout to avoid immediate removal
      setTimeout(() => {
        document.addEventListener('click', closeMenu);
      }, 0);
    }

    /**
     * Enable selection mode
     * @param {number|null} initialUserId - Initial user ID to select
     */
    enable(initialUserId = null) {
      this.isActive = true;
      this.selectedUsers.clear();

      // Add the initial user to selection
      if (initialUserId) {
        this.selectedUsers.add(initialUserId);
      }

      // Notify change BEFORE re-rendering to update global state
      // This ensures that when createUserRow() is called during re-render,
      // the selectionMode flag is already set to true
      this.onSelectionChange(this.isActive, this.selectedUsers);

      // Update table header to include checkbox column
      this.updateTableHeader();

      // Re-render users to show checkboxes
      this.reRenderUsers();

      // Update selection info
      this.updateSelectionInfo();
    }

    /**
     * Disable selection mode
     */
    disable() {
      this.isActive = false;
      this.selectedUsers.clear();

      // Notify change BEFORE re-rendering to update global state
      // This ensures that when createUserRow() is called during re-render,
      // the selectionMode flag is already set to false
      this.onSelectionChange(this.isActive, this.selectedUsers);

      // Update table header to remove checkbox column
      this.updateTableHeader();

      // Re-render users to hide checkboxes
      this.reRenderUsers();

      // Update selection info
      this.updateSelectionInfo();
    }

    /**
     * Toggle user selection
     * @param {number} userId - User ID to toggle
     * @param {boolean} isChecked - Whether to select or deselect
     */
    toggleSelection(userId, isChecked) {
      if (isChecked) {
        this.selectedUsers.add(userId);
      } else {
        this.selectedUsers.delete(userId);
      }

      // Update selection info
      this.updateSelectionInfo();

      // Exit selection mode if no users are selected
      if (this.selectedUsers.size === 0) {
        this.disable();
      } else {
        // Notify change
        this.onSelectionChange(this.isActive, this.selectedUsers);
      }
    }

    /**
     * Select all displayed users
     */
    selectAll() {
      const displayedUsers = this.getDisplayedUsers();
      displayedUsers.forEach(user => this.selectedUsers.add(user.id));
      this.reRenderUsers();
      this.updateSelectionInfo();
      this.onSelectionChange(this.isActive, this.selectedUsers);
    }

    /**
     * Deselect all users
     */
    deselectAll() {
      this.selectedUsers.clear();
      this.reRenderUsers();
      this.updateSelectionInfo();
      // Don't call onSelectionChange here, let toggleSelection or disable handle it
    }

    /**
     * Update selection info display
     */
    updateSelectionInfo() {
      if (!this.selectedUserInfo) return;

      if (this.isActive && this.selectedUsers.size > 0) {
        this.selectedUserInfo.textContent = `${this.selectedUsers.size} usuario(s) seleccionado(s)`;
      } else if (this.currentSelectedUser) {
        const fullName = `${this.currentSelectedUser.first_name} ${this.currentSelectedUser.last_name1} ${this.currentSelectedUser.last_name2 || ''}`;
        this.selectedUserInfo.textContent = fullName;
      } else {
        this.selectedUserInfo.textContent = '-';
      }
    }

    /**
     * Set current selected user (for single selection display)
     * @param {object|null} user - User object or null
     */
    setCurrentSelectedUser(user) {
      this.currentSelectedUser = user;
      if (!this.isActive) {
        this.updateSelectionInfo();
      }
    }

    /**
     * Update table header based on selection mode
     */
    updateTableHeader() {
      if (!this.tableHeader) return;

      const existingCheckboxTh = this.tableHeader.querySelector('.checkbox-header');

      if (this.isActive && !existingCheckboxTh) {
        // Add checkbox column header
        const checkboxTh = document.createElement('th');
        checkboxTh.className = 'checkbox-header';
        checkboxTh.innerHTML = `<input type="checkbox" id="select-all-checkbox">`;
        this.tableHeader.insertBefore(checkboxTh, this.tableHeader.firstChild);

        // Handle select all checkbox
        const selectAllCheckbox = document.getElementById('select-all-checkbox');
        if (selectAllCheckbox) {
          selectAllCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
              this.selectAll();
            } else {
              this.deselectAll();
            }
          });
        }
      } else if (!this.isActive && existingCheckboxTh) {
        // Remove checkbox column header
        existingCheckboxTh.remove();
      }
    }

    /**
     * Clear all state
     */
    clear() {
      this.isActive = false;
      this.selectedUsers.clear();
      this.currentSelectedUser = null;
      this.updateTableHeader();
      this.updateSelectionInfo();
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SelectionModeManager };
  } else if (typeof window !== 'undefined') {
    global.SelectionModeManager = SelectionModeManager;
  }
})(typeof window !== 'undefined' ? window : global);
