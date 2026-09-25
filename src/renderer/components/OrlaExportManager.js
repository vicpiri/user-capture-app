/**
 * OrlaExportManager - Exports of the graduation orla service
 *
 * The orla is the graduation class photo people pay for. This manager exports
 * who has paid, as a PDF list. The photo roster PDF, an administrative
 * document with everyone's photo, is PhotoRosterExportManager.
 */

(function(global) {
  'use strict';

  class OrlaExportManager {
    constructor(config = {}) {
      // Required dependencies
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
     * Export PDF list for paid users only
     */
    async exportPaidOrlaPDF() {
      if (!this.checkProjectOpen()) return;

      try {
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

        // Filter only paid users (orla_paid === 1)
        const paidUsers = allUsers.filter(user => user.orla_paid === 1);

        if (paidUsers.length === 0) {
          this.showInfoModal('Aviso', 'No hay usuarios con orla pagada en el proyecto');
          return;
        }

        // Group paid users by group_code
        const usersByGroup = {};
        paidUsers.forEach(user => {
          const groupCode = user.group_code;
          if (!usersByGroup[groupCode]) {
            usersByGroup[groupCode] = [];
          }
          usersByGroup[groupCode].push(user);
        });

        // Check if there are any users at all
        if (Object.keys(usersByGroup).length === 0) {
          this.showInfoModal('Aviso', 'No hay usuarios con orla pagada en el proyecto');
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
        this.showProgressModal('Exportando listado de alumnos pagados en PDF...', 'Preparando exportación...');

        // Call IPC handler to generate PDFs (paid users list)
        const result = await this.electronAPI.exportPaidUsersListPDF({
          exportPath,
          usersByGroup
        });

        // Close progress modal
        this.closeProgressModal();

        if (result.success) {
          this.showInfoModal(
            'Exportación Completada',
            `Se ha generado el archivo ${result.fileName} correctamente con el listado de alumnos de orla pagada.`
          );
          this.onExportComplete();
        } else {
          this.showInfoModal('Error', result.error || 'Error desconocido al exportar listado PDF');
        }
      } catch (error) {
        console.error('[OrlaExportManager] Error exporting paid users list PDF:', error);
        this.closeProgressModal();
        this.showInfoModal('Error', error.message || 'Error al exportar listado PDF de alumnos pagados');
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
