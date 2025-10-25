/**
 * NewProjectModal - Modal for creating a new project
 *
 * Allows user to select project folder and XML file.
 * Uses BaseModal lifecycle and project service.
 *
 * @extends BaseModal
 */

const { BaseModal } = require('../../core/BaseModal');
const { store } = require('../../core/store');
const { projectService } = require('../../services');

class NewProjectModal extends BaseModal {
  constructor() {
    super('new-project-modal');

    // Form elements
    this.projectFolderInput = null;
    this.xmlFileInput = null;
    this.selectFolderBtn = null;
    this.selectXmlBtn = null;
    this.createBtn = null;
    this.cancelBtn = null;

    // State
    this.selectedFolder = null;
    this.selectedXmlFile = null;
  }

  /**
   * Initialize modal
   */
  init() {
    super.init();

    if (!this.modal) return;

    // Find form elements
    this.projectFolderInput = this.modal.querySelector('#project-folder');
    this.xmlFileInput = this.modal.querySelector('#xml-file');
    this.selectFolderBtn = this.modal.querySelector('#select-folder-btn');
    this.selectXmlBtn = this.modal.querySelector('#select-xml-btn');
    this.createBtn = this.modal.querySelector('#create-project-btn');
    this.cancelBtn = this.modal.querySelector('#cancel-new-project-btn');

    // Setup event listeners
    this.addEventListener(this.selectFolderBtn, 'click', () => this.handleSelectFolder());
    this.addEventListener(this.selectXmlBtn, 'click', () => this.handleSelectXml());
    this.addEventListener(this.createBtn, 'click', () => this.handleCreate());
    this.addEventListener(this.cancelBtn, 'click', () => this.handleCancel());

    this._log('NewProjectModal initialized');
  }

  /**
   * Open modal and reset form
   */
  open() {
    this.resetForm();
    super.open();
  }

  /**
   * Handle folder selection
   */
  async handleSelectFolder() {
    try {
      const result = await window.electronAPI.selectFolder();

      if (result.success && result.path) {
        this.selectedFolder = result.path;
        this.projectFolderInput.value = result.path;
        this._log('Folder selected:', result.path);
      }
    } catch (error) {
      console.error('[NewProjectModal] Error selecting folder:', error);
      this._showError('Error al seleccionar carpeta');
    }
  }

  /**
   * Handle XML file selection
   */
  async handleSelectXml() {
    try {
      const result = await window.electronAPI.selectXmlFile();

      if (result.success && result.path) {
        this.selectedXmlFile = result.path;
        this.xmlFileInput.value = result.path;
        this._log('XML file selected:', result.path);
      }
    } catch (error) {
      console.error('[NewProjectModal] Error selecting XML:', error);
      this._showError('Error al seleccionar archivo XML');
    }
  }

  /**
   * Handle create project
   */
  async handleCreate() {
    // Validate
    if (!this.selectedFolder) {
      this._showError('Por favor, selecciona la carpeta del proyecto');
      return;
    }

    if (!this.selectedXmlFile) {
      this._showError('Por favor, selecciona el archivo XML');
      return;
    }

    // Disable button
    this.createBtn.disabled = true;
    this.createBtn.textContent = 'Creando...';

    try {
      this._log('Creating project...');

      const result = await projectService.createProject({
        folderPath: this.selectedFolder,
        xmlFilePath: this.selectedXmlFile
      });

      if (result.success) {
        this._log('Project created successfully');

        // Update store
        store.setState({
          project: {
            isOpen: true,
            folderPath: result.project.folderPath,
            xmlFilePath: result.project.xmlFilePath,
            ingestFolderPath: result.project.ingestFolderPath,
            importsFolderPath: result.project.importsFolderPath
          },
          users: {
            allUsers: result.users || [],
            filteredUsers: result.users || [],
            selectedUser: null,
            selectedUserId: null,
            duplicatesMap: new Map()
          },
          groups: {
            allGroups: result.groups || [],
            selectedGroup: null
          }
        });

        this.close();
      } else {
        this._showError(result.error || 'Error al crear proyecto');
      }
    } catch (error) {
      console.error('[NewProjectModal] Error creating project:', error);
      this._showError('Error al crear proyecto: ' + error.message);
    } finally {
      this.createBtn.disabled = false;
      this.createBtn.textContent = 'Crear';
    }
  }

  /**
   * Handle cancel
   */
  handleCancel() {
    this._log('Create project cancelled');
    this.close();
  }

  /**
   * Reset form
   */
  resetForm() {
    this.selectedFolder = null;
    this.selectedXmlFile = null;

    if (this.projectFolderInput) this.projectFolderInput.value = '';
    if (this.xmlFileInput) this.xmlFileInput.value = '';

    if (this.createBtn) {
      this.createBtn.disabled = false;
      this.createBtn.textContent = 'Crear';
    }
  }

  /**
   * Show error message
   * @private
   */
  _showError(message) {
    // TODO: Show error in modal or use InfoModal
    console.error('[NewProjectModal]', message);
    alert(message); // Temporary
  }

  /**
   * Internal logging
   * @private
   */
  _log(message, level = 'info') {
    const prefix = '[NewProjectModal]';
    if (level === 'error') {
      console.error(prefix, message);
    } else {
      console.log(prefix, message);
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NewProjectModal };
}
