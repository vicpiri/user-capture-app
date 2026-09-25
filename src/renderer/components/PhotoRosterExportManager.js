/**
 * PhotoRosterExportManager - Photo roster PDF export
 *
 * One PDF per group with everyone's photo and name, so the management team and
 * the teachers can put a name to a face. It is an administrative document,
 * unrelated to the graduation orla (OrlaExportManager), which is a paid
 * service.
 *
 * - Uses PhotoRosterModal for the groups, photo source and quality
 * - Includes everyone in the group, with a placeholder for missing photos
 */

(function(global) {
  'use strict';

  class PhotoRosterExportManager {
    constructor(config = {}) {
      this.photoRosterModal = config.photoRosterModal;
      this.showProgressModal = config.showProgressModal;
      this.closeProgressModal = config.closeProgressModal;
      this.showInfoModal = config.showInfoModal;
      this.showOpenDialog = config.showOpenDialog;

      this.getProjectOpen = config.getProjectOpen;
      this.getAllUsers = config.getAllUsers;
      this.getAllGroups = config.getAllGroups;

      this.electronAPI = config.electronAPI;
    }

    /**
     * Ask for the options and a folder, and generate the PDFs
     */
    async exportPhotoRosterPDF() {
      if (!this.getProjectOpen()) {
        this.showInfoModal('Aviso', 'Debes abrir o crear un proyecto primero');
        return;
      }

      try {
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

        const options = await this.photoRosterModal.show(allGroups);

        if (!options) {
          return; // User cancelled
        }

        const { groupScope, selectedGroup, photoSource, imageQuality } = options;

        // Everyone in the group, with or without a photo
        const usersByGroup = {};

        if (groupScope === 'single') {
          const groupUsers = allUsers.filter(user => user.group_code === selectedGroup);
          if (groupUsers.length === 0) {
            this.showInfoModal('Aviso', `No hay usuarios en el grupo ${selectedGroup}`);
            return;
          }
          usersByGroup[selectedGroup] = groupUsers;
        } else {
          allUsers.forEach(user => {
            const groupCode = user.group_code;
            if (!usersByGroup[groupCode]) {
              usersByGroup[groupCode] = [];
            }
            usersByGroup[groupCode].push(user);
          });
        }

        const dialogResult = await this.showOpenDialog({
          title: 'Seleccionar carpeta de exportación',
          buttonLabel: 'Exportar',
          properties: ['openDirectory', 'createDirectory']
        });

        if (!dialogResult || dialogResult.canceled || !dialogResult.filePaths || dialogResult.filePaths.length === 0) {
          return; // User cancelled
        }

        const exportPath = dialogResult.filePaths[0];

        this.showProgressModal('Exportando listados con fotografías...', 'Preparando exportación...');

        const result = await this.electronAPI.exportPhotoRosterPDF({
          exportPath,
          photoSource,
          imageQuality,
          usersByGroup
        });

        this.closeProgressModal();

        if (result.success) {
          const fileCount = result.generatedFiles?.length || 0;
          this.showInfoModal(
            'Exportación Completada',
            `Se ${fileCount === 1 ? 'ha generado' : 'han generado'} ${fileCount} archivo${fileCount !== 1 ? 's' : ''} PDF correctamente.`
          );
        } else {
          this.showInfoModal('Error', result.error || 'Error desconocido al exportar el listado con fotografías');
        }
      } catch (error) {
        console.error('[PhotoRosterExportManager] Error exporting photo roster PDF:', error);
        this.closeProgressModal();
        this.showInfoModal('Error', error.message || 'Error al exportar el listado con fotografías');
      }
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PhotoRosterExportManager };
  } else if (typeof window !== 'undefined') {
    global.PhotoRosterExportManager = PhotoRosterExportManager;
  }
})(typeof window !== 'undefined' ? window : global);
