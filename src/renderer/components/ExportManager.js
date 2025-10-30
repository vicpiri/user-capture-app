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
      this.inventoryExportOptionsModal = config.inventoryExportOptionsModal; // InventoryExportOptionsModal instance
      this.confirmModal = config.confirmModal; // ConfirmModal instance
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
      this.getCurrentFilters = config.getCurrentFilters; // Function returning current filters object

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
          // Check if any of the exported users have card print requests BEFORE showing success modal
          // Use the exportedUserIds from the backend (users that actually were exported)
          if (exportResult.exportedUserIds && exportResult.exportedUserIds.length > 0) {
            await this.checkAndMarkCardsAsPrinted(exportResult.exportedUserIds);
          }

          // Show success message after card print check
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
     * Check if exported users have card print requests and ask to mark as printed
     * @param {Array} exportedUserIds - IDs of users that were exported
     */
    async checkAndMarkCardsAsPrinted(exportedUserIds) {
      try {
        if (!exportedUserIds || exportedUserIds.length === 0) {
          return;
        }

        // Check which users have card print requests
        const checkResult = await this.electronAPI.checkCardPrintRequests(exportedUserIds);

        if (!checkResult.success) {
          console.error('Error checking card print requests:', checkResult.error);
          return;
        }

        const usersWithRequests = checkResult.usersWithRequests || [];

        if (usersWithRequests.length === 0) {
          // No users with pending card print requests
          return;
        }

        // Ask user if they want to mark cards as printed
        const shouldMarkAsPrinted = await this.confirmModal.show(
          `${usersWithRequests.length} de los usuarios exportados tienen solicitud de carnet pendiente.\n\n¿Desea marcarlos como impresos?`
        );

        if (shouldMarkAsPrinted) {
          // Mark cards as printed (move from To-Print-ID to Printed-ID)
          const markResult = await this.electronAPI.markCardsAsPrinted(usersWithRequests);

          if (markResult.success) {
            this.showInfoModal(
              'Carnets marcados como impresos',
              `Se han movido ${markResult.movedCount} solicitud(es) de carnet a la carpeta 'Printed-ID'`
            );

            // Trigger a refresh of the user list to update indicators
            if (this.onExportComplete) {
              this.onExportComplete();
            }
          } else {
            this.showInfoModal('Error', 'Error al marcar carnets como impresos: ' + markResult.error);
          }
        }
      } catch (error) {
        console.error('Error in checkAndMarkCardsAsPrinted:', error);
      }
    }

    /**
     * Export inventory CSV files (3 files: Alumnado, Personal, Grupos)
     */
    async exportInventoryCSV() {
      if (!this.checkProjectOpen()) return;

      // Get current group information
      const filters = this.getCurrentFilters();
      const selectedGroupCode = filters.group || null;

      // Get group name if a group is selected
      let selectedGroupName = null;
      if (selectedGroupCode) {
        try {
          const groupsResult = await this.electronAPI.getGroups();
          if (groupsResult.success) {
            const group = groupsResult.groups.find(g => g.code === selectedGroupCode);
            if (group) {
              selectedGroupName = group.name;
            }
          }
        } catch (error) {
          console.error('Error getting group info:', error);
        }
      }

      // Show inventory export options modal
      const options = await this.inventoryExportOptionsModal.show({
        selectedGroupCode,
        selectedGroupName
      });

      // User cancelled
      if (!options) return;

      // Determine which users to export
      let usersToExport;
      if (options.scope === 'all') {
        // Export all users - no filters
        const result = await this.electronAPI.getUsers({}, {});
        if (result.success) {
          usersToExport = result.users;
        } else {
          this.showInfoModal('Error', 'Error al cargar los usuarios');
          return;
        }
      } else {
        // Export selected group only
        const result = await this.electronAPI.getUsers({ group: selectedGroupCode }, {});
        if (result.success) {
          usersToExport = result.users;
        } else {
          this.showInfoModal('Error', 'Error al cargar los usuarios del grupo');
          return;
        }
      }

      // Show folder picker
      const dialogResult = await this.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Seleccionar carpeta para guardar los CSV de inventario'
      });

      if (!dialogResult.canceled && dialogResult.filePaths.length > 0) {
        const folderPath = dialogResult.filePaths[0];

        // Export CSV files
        const exportResult = await this.electronAPI.exportInventoryCSV(folderPath, usersToExport);

        if (exportResult.success) {
          const results = exportResult.results;
          let message = `CSV de inventario exportados correctamente\n\n`;
          message += `${results.filesCreated} archivos creados\n\n`;

          if (results.files.length > 0) {
            message += 'Archivos generados:\n';
            results.files.forEach(file => {
              message += `  • ${file.filename} (${file.userCount} registros)\n`;
            });
          }

          // Export images if enabled
          if (options.exportImages) {
            message += '\n';

            // Convert modal format to API format
            const imageOptions = {
              copyOriginal: options.imageOptions.copyOriginal,
              resizeEnabled: options.imageOptions.resizeEnabled,
              boxSize: options.imageOptions.boxSize,
              maxSizeKB: options.imageOptions.maxSizeKB,
              zipEnabled: options.zipEnabled || false,
              zipMaxSizeMB: options.zipMaxSizeMB || 25
            };

            // Show progress
            this.showProgressModal('Exportando Imágenes', 'Procesando archivos...');

            // Perform image export
            const imageExportResult = await this.electronAPI.exportInventoryImages(folderPath, usersToExport, imageOptions);

            // Wait a moment to show 100% progress
            await new Promise(resolve => setTimeout(resolve, 500));
            this.closeProgressModal();

            if (imageExportResult.success) {
              const imageResults = imageExportResult.results;
              message += `\nImágenes exportadas:\n`;
              message += `  • Total procesadas: ${imageResults.total}\n`;
              message += `  • Exportadas correctamente: ${imageResults.exported}\n`;
              message += `  • Sin imagen en depósito: ${imageResults.skipped}\n`;

              if (imageResults.errors > 0) {
                message += `  • Errores: ${imageResults.errors}\n`;
              }

              // Add ZIP file information if applicable
              if (imageOptions.zipEnabled && imageResults.zipFiles && imageResults.zipFiles.length > 0) {
                message += `\nArchivos ZIP creados:\n`;
                imageResults.zipFiles.forEach(zipFile => {
                  message += `  • ${zipFile.name} (${zipFile.count} imágenes)\n`;
                });
              }
            } else {
              message += `\nError al exportar imágenes: ${imageExportResult.error}`;
            }
          }

          this.showInfoModal('Exportación exitosa', message);
        } else {
          this.showInfoModal('Error', 'Error al exportar los CSV de inventario: ' + exportResult.error);
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
