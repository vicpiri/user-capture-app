/**
 * OrlaExportManager - Manages PDF orla (class photo grid) export
 *
 * Handles export functionality including:
 * - Display modal to select photo source (captured vs repository)
 * - Generate one PDF per group containing users with selected photo type
 * - Display photos in grid layout with user names
 * - Show placeholder for users without photos
 *
 * Features:
 * - Uses OrlaExportModal for user input
 * - Shows progress during PDF generation
 * - Handles results and errors
 */

(function(global) {
  'use strict';

  class OrlaExportManager {
    constructor(config = {}) {
      // Required dependencies
      this.orlaExportModal = config.orlaExportModal; // OrlaExportModal instance
      this.showProgressModal = config.showProgressModal; // Function to show progress
      this.closeProgressModal = config.closeProgressModal; // Function to close progress
      this.showInfoModal = config.showInfoModal; // Function to show info/error
      this.showOpenDialog = config.showOpenDialog; // Function to show folder picker

      // Required state getters
      this.getProjectOpen = config.getProjectOpen; // Function returning projectOpen boolean
      this.getAllUsers = config.getAllUsers; // Function returning all users array
      this.getAllGroups = config.getAllGroups; // Function returning all groups array

      // Required callbacks
      this.onExportComplete = config.onExportComplete || (() => {}); // Called after successful export

      // Required Electron API methods
      this.electronAPI = config.electronAPI; // window.electronAPI reference
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
     * Export PDF orla
     */
    async exportOrlaPDF() {
      if (!this.checkProjectOpen()) return;

      try {
        // Show modal to select photo source
        const options = await this.orlaExportModal.show();

        if (!options) {
          return; // User cancelled
        }

        const { photoSource, imageQuality } = options; // 'captured' or 'repository', quality 0-100

        // Get all users and groups
        const allUsers = this.getAllUsers();
        const allGroups = this.getAllGroups();

        if (!allUsers || allUsers.length === 0) {
          this.showInfoModal('Aviso', 'No hay usuarios en el proyecto');
          return;
        }

        if (!allGroups || allGroups.length === 0) {
          this.showInfoModal('Aviso', 'No hay grupos en el proyecto');
          return;
        }

        // Group ALL users by group_code (including those without photos)
        const usersByGroup = {};
        allUsers.forEach(user => {
          const groupCode = user.group_code;
          if (!usersByGroup[groupCode]) {
            usersByGroup[groupCode] = [];
          }
          usersByGroup[groupCode].push(user);
        });

        // Check if there are any users at all
        if (Object.keys(usersByGroup).length === 0) {
          this.showInfoModal('Aviso', 'No hay usuarios en el proyecto');
          return;
        }

        // Ask user to select export folder
        const dialogResult = await this.showOpenDialog({
          title: 'Seleccionar carpeta de exportación',
          buttonLabel: 'Exportar',
          properties: ['openDirectory', 'createDirectory']
        });

        if (!dialogResult || dialogResult.canceled || !dialogResult.filePaths || dialogResult.filePaths.length === 0) {
          return; // User cancelled
        }

        const exportPath = dialogResult.filePaths[0];

        // Show progress modal
        this.showProgressModal('Exportando orla en PDF...', 'Preparando exportación...');

        // Call IPC handler to generate PDFs
        const result = await this.electronAPI.exportOrlaPDF({
          exportPath,
          photoSource,
          imageQuality,
          usersByGroup
        });

        // Close progress modal
        this.closeProgressModal();

        if (result.success) {
          const fileCount = result.generatedFiles?.length || 0;
          this.showInfoModal(
            'Exportación Completada',
            `Se ${fileCount === 1 ? 'ha generado' : 'han generado'} ${fileCount} archivo${fileCount !== 1 ? 's' : ''} PDF correctamente.`
          );
          this.onExportComplete();
        } else {
          this.showInfoModal('Error', result.error || 'Error desconocido al exportar orla PDF');
        }
      } catch (error) {
        console.error('[OrlaExportManager] Error exporting orla PDF:', error);
        this.closeProgressModal();
        this.showInfoModal('Error', error.message || 'Error al exportar orla PDF');
      }
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OrlaExportManager };
  } else if (typeof window !== 'undefined') {
    global.OrlaExportManager = OrlaExportManager;
  }
})(typeof window !== 'undefined' ? window : global);
