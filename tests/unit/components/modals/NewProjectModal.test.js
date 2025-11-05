/**
 * @jest-environment jsdom
 */

const { NewProjectModal } = require('../../../../src/renderer/components/modals/NewProjectModal');
const { BaseModal } = require('../../../../src/renderer/core/BaseModal');
const { store } = require('../../../../src/renderer/core/store');

describe('NewProjectModal', () => {
  let modal;
  let mockElectronAPI;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="new-project-modal" class="modal">
        <div class="modal-content">
          <input id="project-folder" />
          <button id="select-folder-btn">Seleccionar carpeta</button>
          <input id="xml-file" />
          <button id="select-xml-btn">Seleccionar XML</button>
          <button id="create-project-btn">Crear</button>
          <button id="cancel-new-project-btn">Cancelar</button>
        </div>
      </div>
    `;

    // Mock electronAPI
    mockElectronAPI = {
      showOpenDialog: jest.fn(),
      createProject: jest.fn()
    };
    window.electronAPI = mockElectronAPI;

    // Create modal instance with mocked callbacks
    modal = new NewProjectModal({
      showProgressModal: jest.fn(),
      closeProgressModal: jest.fn()
    });
    modal.init();
  });

  afterEach(() => {
    if (modal) {
      modal.destroy();
    }
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should extend BaseModal', () => {
      expect(modal).toBeInstanceOf(BaseModal);
    });

    it('should initialize state properties', () => {
      expect(modal.selectedFolder).toBeNull();
      expect(modal.selectedXmlFile).toBeNull();
    });
  });

  describe('init', () => {
    it('should find all form elements', () => {
      expect(modal.projectFolderInput).toBeTruthy();
      expect(modal.xmlFileInput).toBeTruthy();
      expect(modal.selectFolderBtn).toBeTruthy();
      expect(modal.selectXmlBtn).toBeTruthy();
      expect(modal.createBtn).toBeTruthy();
      expect(modal.cancelBtn).toBeTruthy();
    });

    it('should setup event listeners', () => {
      const selectFolderBtn = document.getElementById('select-folder-btn');
      const selectXmlBtn = document.getElementById('select-xml-btn');
      const createBtn = document.getElementById('create-project-btn');
      const cancelBtn = document.getElementById('cancel-new-project-btn');

      expect(selectFolderBtn).toBeTruthy();
      expect(selectXmlBtn).toBeTruthy();
      expect(createBtn).toBeTruthy();
      expect(cancelBtn).toBeTruthy();
    });
  });

  describe('handleSelectFolder', () => {
    it('should call showOpenDialog with correct options', async () => {
      mockElectronAPI.showOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['C:\\test\\folder']
      });

      await modal.handleSelectFolder();

      expect(mockElectronAPI.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openDirectory'],
        title: 'Seleccionar carpeta del proyecto'
      });
    });

    it('should update state and input when folder selected', async () => {
      const testPath = 'C:\\test\\folder';
      mockElectronAPI.showOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: [testPath]
      });

      await modal.handleSelectFolder();

      expect(modal.selectedFolder).toBe(testPath);
      expect(modal.projectFolderInput.value).toBe(testPath);
    });

    it('should not update state when dialog cancelled', async () => {
      mockElectronAPI.showOpenDialog.mockResolvedValue({
        canceled: true,
        filePaths: []
      });

      await modal.handleSelectFolder();

      expect(modal.selectedFolder).toBeNull();
      expect(modal.projectFolderInput.value).toBe('');
    });

    it('should handle errors gracefully', async () => {
      mockElectronAPI.showOpenDialog.mockRejectedValue(new Error('Test error'));
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

      await modal.handleSelectFolder();

      expect(alertSpy).toHaveBeenCalledWith('Error al seleccionar carpeta');
      alertSpy.mockRestore();
    });
  });

  describe('handleSelectXml', () => {
    it('should call showOpenDialog with correct options', async () => {
      mockElectronAPI.showOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['C:\\test\\file.xml']
      });

      await modal.handleSelectXml();

      expect(mockElectronAPI.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openFile'],
        filters: [{ name: 'XML Files', extensions: ['xml'] }],
        title: 'Seleccionar archivo XML'
      });
    });

    it('should update state and input when XML file selected', async () => {
      const testPath = 'C:\\test\\file.xml';
      mockElectronAPI.showOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: [testPath]
      });

      await modal.handleSelectXml();

      expect(modal.selectedXmlFile).toBe(testPath);
      expect(modal.xmlFileInput.value).toBe(testPath);
    });

    it('should not update state when dialog cancelled', async () => {
      mockElectronAPI.showOpenDialog.mockResolvedValue({
        canceled: true,
        filePaths: []
      });

      await modal.handleSelectXml();

      expect(modal.selectedXmlFile).toBeNull();
      expect(modal.xmlFileInput.value).toBe('');
    });

    it('should handle errors gracefully', async () => {
      mockElectronAPI.showOpenDialog.mockRejectedValue(new Error('Test error'));
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

      await modal.handleSelectXml();

      expect(alertSpy).toHaveBeenCalledWith('Error al seleccionar archivo XML');
      alertSpy.mockRestore();
    });
  });

  describe('handleCreate', () => {
    beforeEach(() => {
      modal.selectedFolder = 'C:\\test\\folder';
      modal.selectedXmlFile = 'C:\\test\\file.xml';
    });

    it('should validate folder selection', async () => {
      modal.selectedFolder = null;
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

      await modal.handleCreate();

      expect(alertSpy).toHaveBeenCalledWith('Por favor, selecciona la carpeta del proyecto');
      alertSpy.mockRestore();
    });

    it('should validate XML file selection', async () => {
      modal.selectedXmlFile = null;
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

      await modal.handleCreate();

      expect(alertSpy).toHaveBeenCalledWith('Por favor, selecciona el archivo XML');
      alertSpy.mockRestore();
    });

    it('should call createProject with correct parameters', async () => {
      mockElectronAPI.createProject.mockResolvedValue({
        success: true,
        project: {
          folderPath: 'C:\\test\\folder',
          xmlFilePath: 'C:\\test\\file.xml'
        }
      });

      await modal.handleCreate();

      expect(mockElectronAPI.createProject).toHaveBeenCalledWith({
        folderPath: 'C:\\test\\folder',
        xmlPath: 'C:\\test\\file.xml'
      });
    });

    it('should disable create button during creation', async () => {
      let capturedButtonState = { disabled: false, text: '' };

      mockElectronAPI.createProject.mockImplementation(() => {
        // Capture button state during creation
        capturedButtonState = {
          disabled: modal.createBtn.disabled,
          text: modal.createBtn.textContent
        };
        return Promise.resolve({ success: true, project: {} });
      });

      await modal.handleCreate();

      // Verify button was disabled during creation
      expect(capturedButtonState.disabled).toBe(true);
      expect(capturedButtonState.text).toBe('Creando...');

      // Verify button is re-enabled after creation
      expect(modal.createBtn.disabled).toBe(false);
      expect(modal.createBtn.textContent).toBe('Crear');
    });

    it('should close modal on success', async () => {
      mockElectronAPI.createProject.mockResolvedValue({
        success: true,
        project: {}
      });

      const closeSpy = jest.spyOn(modal, 'close');

      await modal.handleCreate();

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should show error on failure', async () => {
      mockElectronAPI.createProject.mockResolvedValue({
        success: false,
        error: 'Test error message'
      });

      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

      await modal.handleCreate();

      expect(alertSpy).toHaveBeenCalledWith('Test error message');
      alertSpy.mockRestore();
    });

    it('should handle exceptions', async () => {
      mockElectronAPI.createProject.mockRejectedValue(new Error('Test exception'));
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

      await modal.handleCreate();

      expect(alertSpy).toHaveBeenCalledWith('Error al crear proyecto: Test exception');
      alertSpy.mockRestore();
    });
  });

  describe('handleCancel', () => {
    it('should close the modal', () => {
      const closeSpy = jest.spyOn(modal, 'close');

      modal.handleCancel();

      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('show', () => {
    it('should return a promise', () => {
      const result = modal.show();
      expect(result).toBeInstanceOf(Promise);

      // Clean up
      modal.handleCancel();
    });

    it('should resolve with null on cancel', async () => {
      const promise = modal.show();

      modal.handleCancel();

      const result = await promise;
      expect(result).toBeNull();
    });

    it('should reset form before showing', () => {
      modal.selectedFolder = 'old';
      modal.selectedXmlFile = 'old';
      modal.projectFolderInput.value = 'old';
      modal.xmlFileInput.value = 'old';

      modal.show();

      expect(modal.selectedFolder).toBeNull();
      expect(modal.selectedXmlFile).toBeNull();
      expect(modal.projectFolderInput.value).toBe('');
      expect(modal.xmlFileInput.value).toBe('');

      // Clean up
      modal.handleCancel();
    });
  });

  describe('resetForm', () => {
    it('should clear all form values', () => {
      modal.selectedFolder = 'test';
      modal.selectedXmlFile = 'test';
      modal.projectFolderInput.value = 'test';
      modal.xmlFileInput.value = 'test';

      modal.resetForm();

      expect(modal.selectedFolder).toBeNull();
      expect(modal.selectedXmlFile).toBeNull();
      expect(modal.projectFolderInput.value).toBe('');
      expect(modal.xmlFileInput.value).toBe('');
    });

    it('should reset create button state', () => {
      modal.createBtn.disabled = true;
      modal.createBtn.textContent = 'Creando...';

      modal.resetForm();

      expect(modal.createBtn.disabled).toBe(false);
      expect(modal.createBtn.textContent).toBe('Crear');
    });
  });
});
