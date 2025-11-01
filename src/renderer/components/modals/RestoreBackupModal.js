/**
 * RestoreBackupModal - Modal for selecting and restoring image relationship backups
 *
 * Features:
 * - Shows list of available backups with date and count
 * - Allows user to select a backup to restore
 * - Returns selected backup date via Promise
 */

(function(global) {
  'use strict';

  // Import BaseModal if available
  const BaseModal = global.BaseModal;

  class RestoreBackupModal extends BaseModal {
    constructor() {
      super('restore-backup-modal');

      // Get modal elements
      this.backupsList = document.getElementById('backups-list');
      this.restoreBtn = document.getElementById('restore-backup-btn');
      this.cancelBtn = document.getElementById('cancel-restore-backup-btn');
      this.noBackupsMessage = document.getElementById('no-backups-message');

      // State
      this.selectedBackupDate = null;
      this.backups = [];

      // Bind methods
      this.handleRestore = this.handleRestore.bind(this);
      this.handleCancel = this.handleCancel.bind(this);
      this.handleBackupSelection = this.handleBackupSelection.bind(this);
    }

    /**
     * Initialize the modal
     */
    init() {
      // Call parent init first
      super.init();

      // Setup event listeners
      this.setupEventListeners();
    }

    setupEventListeners() {
      if (this.restoreBtn) {
        this.restoreBtn.addEventListener('click', this.handleRestore);
      }

      if (this.cancelBtn) {
        this.cancelBtn.addEventListener('click', this.handleCancel);
      }
    }

    /**
     * Show modal with list of available backups
     * @returns {Promise<string|null>} Selected backup date or null if cancelled
     */
    async show() {
      console.log('[RestoreBackupModal] show() called');

      // Load backups from database
      await this.loadBackups();

      console.log('[RestoreBackupModal] Backups loaded:', this.backups.length);

      // Show the modal
      this.open();

      // Return promise that resolves when user makes a choice
      return new Promise((resolve) => {
        this.resolvePromise = resolve;
      });
    }

    /**
     * Load backups from database
     */
    async loadBackups() {
      try {
        const result = await window.electronAPI.getImageBackups();

        if (result.success) {
          this.backups = result.backups;
          this.renderBackupsList();
        } else {
          this.backups = [];
          this.showNoBackupsMessage();
        }
      } catch (error) {
        console.error('Error loading backups:', error);
        this.backups = [];
        this.showNoBackupsMessage();
      }
    }

    /**
     * Render backups list
     */
    renderBackupsList() {
      if (!this.backupsList) return;

      // Clear previous list
      this.backupsList.innerHTML = '';

      if (this.backups.length === 0) {
        this.showNoBackupsMessage();
        this.restoreBtn.disabled = true;
        return;
      }

      // Hide no backups message
      if (this.noBackupsMessage) {
        this.noBackupsMessage.style.display = 'none';
      }

      // Create list items
      this.backups.forEach((backup) => {
        const listItem = document.createElement('div');
        listItem.className = 'backup-item';
        listItem.dataset.backupDate = backup.backup_date;

        const date = new Date(backup.backup_date);
        const formattedDate = date.toLocaleString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });

        listItem.innerHTML = `
          <div class="backup-item-content">
            <div class="backup-date">${formattedDate}</div>
            <div class="backup-info">${backup.count} enlaces respaldados</div>
          </div>
        `;

        listItem.addEventListener('click', () => this.handleBackupSelection(backup.backup_date, listItem));

        this.backupsList.appendChild(listItem);
      });

      // Disable restore button initially
      this.restoreBtn.disabled = true;
    }

    /**
     * Show no backups message
     */
    showNoBackupsMessage() {
      if (this.backupsList) {
        this.backupsList.innerHTML = '';
      }

      if (this.noBackupsMessage) {
        this.noBackupsMessage.style.display = 'block';
      }

      if (this.restoreBtn) {
        this.restoreBtn.disabled = true;
      }
    }

    /**
     * Handle backup selection
     */
    handleBackupSelection(backupDate, listItem) {
      // Remove previous selection
      const previousSelected = this.backupsList.querySelector('.backup-item.selected');
      if (previousSelected) {
        previousSelected.classList.remove('selected');
      }

      // Add selection to clicked item
      listItem.classList.add('selected');

      // Store selected backup date
      this.selectedBackupDate = backupDate;

      // Enable restore button
      this.restoreBtn.disabled = false;
    }

    /**
     * Handle restore button click
     */
    handleRestore() {
      console.log('[RestoreBackupModal] handleRestore called, selectedBackupDate:', this.selectedBackupDate);

      if (!this.selectedBackupDate) return;

      // Save the backup date before closing (close() resets it)
      const backupDate = this.selectedBackupDate;

      this.close();

      if (this.resolvePromise) {
        console.log('[RestoreBackupModal] Resolving with backup date:', backupDate);
        this.resolvePromise(backupDate);
        this.resolvePromise = null;
      }
    }

    /**
     * Handle cancel button click
     */
    handleCancel() {
      console.log('[RestoreBackupModal] handleCancel called');

      this.close();

      if (this.resolvePromise) {
        console.log('[RestoreBackupModal] Resolving with null (cancelled)');
        this.resolvePromise(null);
        this.resolvePromise = null;
      }
    }

    /**
     * Close modal and clean up
     */
    close() {
      super.close();

      // Reset state
      this.selectedBackupDate = null;
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RestoreBackupModal };
  } else if (typeof window !== 'undefined') {
    global.RestoreBackupModal = RestoreBackupModal;
  }
})(typeof window !== 'undefined' ? window : global);
