/**
 * ExportManager - Manages export operations for users, CSV, and images
 *
 * Handles all export functionality including:
 * - CSV export
 * - Image export by ID
 * - Image export by name
 * - Export to repository (Google Drive)
 * - Determining which users to export (selection, view, duplicates)
 *
 * Features:
 * - Uses ExportOptionsModal for user input
 * - Shows progress during operations
 * - Handles results and errors
 */

(function(global) {
  'use strict';

  class ExportManager {
    constructor(config = {}) {
      // Required dependencies
      this.exportOptionsModal = config.exportOptionsModal; // ExportOptionsModal instance
      this.showProgressModal = config.showProgressModal; // Function to show progress
      this.closeProgressModal = config.closeProgressModal; // Function to close progress
      this.showInfoModal = config.showInfoModal; // Function to show info/error
      this.showOpenDialog = config.showOpenDialog; // Function to show folder picker

      // Required state getters
      this.getProjectOpen = config.getProjectOpen; // Function returning projectOpen boolean
      this.getSelectionMode = config.getSelectionMode; // Function returning selectionMode boolean
      this.getSelectedUsers = config.getSelectedUsers; // Function returning Set of selected user IDs
      this.getDisplayedUsers = config.getDisplayedUsers; // Function returning displayed users array
      this.getCurrentUsers = config.getCurrentUsers; // Function returning current users array
      this.getShowDuplicatesOnly = config.getShowDuplicatesOnly; // Function returning showDuplicatesOnly boolean
      this.getAllUsers = config.getAllUsers; // Function returning all users array

      // Required callbacks
      this.onExportComplete = config.onExportComplete || (() => {}); // Called after successful export

      // Required Electron API methods
      this.electronAPI = config.electronAPI; // window.electronAPI reference
    }

    /**
     * Get users to export based on current selection/view
     * @returns {Array} Users to export
     */
    getUsersToExport() {
      const selectionMode = this.getSelectionMode();
      const selectedUsers = this.getSelectedUsers();
      const displayedUsers = this.getDisplayedUsers();
      const currentUsers = this.getCurrentUsers();
      const showDuplicatesOnly = this.getShowDuplicatesOnly();
      const allUsers = this.getAllUsers();

      // If in selection mode and there are selected users, export only those
      if (selectionMode && selectedUsers && selectedUsers.size > 0) {
        return displayedUsers.filter(user => selectedUsers.has(user.id));
      }

      // Otherwise, use current view
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

      return usersToExport;
    }

    /**
     * Check if project is open
     * @returns {boolean} True if project is open
     */
    checkProjectOpen() {
      if (!this.getProjectOpen()) {
        this.showInfoModal('Aviso', 'Debes abrir o crear un proyecto primero');
        return false;
      }
      return true;
    }

    /**
     * Export CSV file
     */
    async exportCSV() {
      if (!this.checkProjectOpen()) return;

      // Get users to export
      const usersToExport = this.getUsersToExport();

      // Show folder picker
      const result = await this.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Seleccionar carpeta para guardar el CSV'
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];
        const exportResult = await this.electronAPI.exportCSV(folderPath, usersToExport);

        if (exportResult.success) {
          let message = `CSV exportado correctamente: ${exportResult.filename}\n\n`;
          message += `${exportResult.exported} usuarios exportados`;

          if (exportResult.ignored > 0) {
            message += `\n${exportResult.ignored} usuarios ignorados (sin imagen en el depósito)`;
          }

          this.showInfoModal('Exportación exitosa', message);
        } else {
          this.showInfoModal('Error', 'Error al exportar el CSV: ' + exportResult.error);
        }
      }
    }

    /**
     * Export images by ID
     */
    async exportImagesByID() {
      if (!this.checkProjectOpen()) return;

      // Get users to export
      const usersToExport = this.getUsersToExport();

      // Show folder picker
      const result = await this.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Seleccionar carpeta para exportar las imágenes'
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];

        // Show export options modal and wait for user choice
        const options = await this.exportOptionsModal.show();

        if (!options) {
          // User cancelled
          return;
        }

        // Convert modal format to API format
        const apiOptions = this.convertOptionsToAPI(options);

        // Show progress
        this.showProgressModal('Exportando Imágenes', 'Procesando archivos...');

        // Perform export
        const exportResult = await this.electronAPI.exportImages(folderPath, usersToExport, apiOptions);

        // Wait a moment to show 100% progress
        await new Promise(resolve => setTimeout(resolve, 500));
        this.closeProgressModal();

        // Only show error if export failed
        if (!exportResult.success) {
          this.showInfoModal('Error', 'Error al exportar imágenes: ' + exportResult.error);
        }
      }
    }

    /**
     * Export images by name
     */
    async exportImagesByName() {
      if (!this.checkProjectOpen()) return;

      // Get users to export
      const usersToExport = this.getUsersToExport();

      // Show folder picker
      const result = await this.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Seleccionar carpeta para exportar las imágenes'
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];

        // Show export options modal and wait for user choice
        const options = await this.exportOptionsModal.show();

        if (!options) {
          // User cancelled
          return;
        }

        // Convert modal format to API format
        const apiOptions = this.convertOptionsToAPI(options);

        // Show progress
        this.showProgressModal('Exportando Imágenes', 'Procesando archivos...');

        // Perform export
        const exportResult = await this.electronAPI.exportImagesName(folderPath, usersToExport, apiOptions);

        // Wait a moment to show 100% progress
        await new Promise(resolve => setTimeout(resolve, 500));
        this.closeProgressModal();

        // Only show error if export failed
        if (!exportResult.success) {
          this.showInfoModal('Error', 'Error al exportar imágenes: ' + exportResult.error);
        }
      }
    }

    /**
     * Export images to repository (Google Drive)
     */
    async exportToRepository() {
      if (!this.checkProjectOpen()) return;

      // Get users to export
      const usersToExport = this.getUsersToExport();

      // Show export options modal and wait for user choice
      const options = await this.exportOptionsModal.show();

      if (!options) {
        // User cancelled
        return;
      }

      // Convert modal format to API format
      const apiOptions = this.convertOptionsToAPI(options);

      // Show progress
      this.showProgressModal('Exportando al Depósito', 'Procesando archivos...');

      // Perform export
      const exportResult = await this.electronAPI.exportToRepository(usersToExport, apiOptions);

      // Wait a moment to show 100% progress
      await new Promise(resolve => setTimeout(resolve, 500));
      this.closeProgressModal();

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

        this.showInfoModal('Exportación completada', message);

        // Notify completion (for reloading users, etc.)
        this.onExportComplete();
      } else {
        this.showInfoModal('Error', 'Error al exportar imágenes: ' + exportResult.error);
      }
    }

    /**
     * Convert modal options format to API format
     * @param {object} options - Options from ExportOptionsModal
     * @returns {object} Options in API format
     */
    convertOptionsToAPI(options) {
      return {
        copyOriginal: options.mode === 'copy',
        resizeEnabled: options.mode === 'resize',
        boxSize: options.resize ? options.resize.boxSize : null,
        maxSizeKB: options.resize ? options.resize.maxSize : null
      };
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ExportManager };
  } else if (typeof window !== 'undefined') {
    global.ExportManager = ExportManager;
  }
})(typeof window !== 'undefined' ? window : global);
