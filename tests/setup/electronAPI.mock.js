const { EventEmitter } = require('events');

/**
 * Mock completo de window.electronAPI
 * Basado en la API expuesta en src/preload/preload.js
 */
class ElectronAPIMock extends EventEmitter {
  constructor() {
    super();

    // === PROJECT MANAGEMENT ===
    this.createProject = jest.fn(async (data) => ({
      success: true,
      data
    }));

    this.openProject = jest.fn(async (folderPath) => ({
      success: true,
      path: folderPath
    }));

    // === USER MANAGEMENT ===
    this.getUsers = jest.fn(async (filters = {}, options = {}) => ({
      success: true,
      users: []
    }));

    this.getGroups = jest.fn(async () => ({
      success: true,
      groups: [
        { code: 'A', name: 'Grupo A' },
        { code: 'B', name: 'Grupo B' }
      ]
    }));

    this.loadRepositoryImages = jest.fn(async (users) => ({
      success: true,
      repositoryData: {}
    }));

    // === IMAGE MANAGEMENT ===
    this.getImages = jest.fn(async () => ({
      success: true,
      images: []
    }));

    this.saveCapturedImage = jest.fn(async (imageData) => ({
      success: true,
      path: '/fake/images/20250101120000.jpg'
    }));

    this.linkImageToUser = jest.fn(async (data) => ({
      success: true
    }));

    this.confirmLinkImage = jest.fn(async (data) => ({
      success: true
    }));

    this.unlinkImageFromUser = jest.fn(async (userId) => ({
      success: true
    }));

    this.moveImageToIngest = jest.fn(async (imagePath) => ({
      success: true
    }));

    // === EXPORT / IMPORT ===
    this.importImagesWithId = jest.fn(async (folderPath) => ({
      success: true,
      results: {
        total: 0,
        linked: 0,
        notFound: [],
        errors: []
      }
    }));

    this.exportCSV = jest.fn(async (folderPath, users) => ({
      success: true,
      filename: 'carnets.csv',
      exported: users?.length || 0,
      ignored: 0
    }));

    this.exportImages = jest.fn(async (folderPath, users, options) => ({
      success: true
    }));

    this.exportImagesName = jest.fn(async (folderPath, users, options) => ({
      success: true
    }));

    this.exportToRepository = jest.fn(async (users, options) => ({
      success: true,
      results: {
        total: users?.length || 0,
        exported: users?.length || 0,
        errors: []
      }
    }));

    // === DIALOGS ===
    this.showOpenDialog = jest.fn(async (options) => ({
      canceled: false,
      filePaths: ['/fake/path/folder']
    }));

    this.focusWindow = jest.fn(async () => {});

    // === CAMERA ===
    this.updateAvailableCameras = jest.fn(async (cameras) => ({
      success: true
    }));

    this.getSelectedCamera = jest.fn(async () => ({
      success: true,
      cameraId: 'default'
    }));

    // === XML UPDATE ===
    this.updateXML = jest.fn(async (xmlPath) => ({
      success: true,
      changes: {
        toAdd: 0,
        toUpdate: 0,
        toDelete: 0,
        toDeleteWithImage: 0,
        toDeleteWithoutImage: 0
      },
      groups: [],
      newUsersMap: {},
      deletedUsers: [],
      currentUsers: []
    }));

    this.confirmUpdateXML = jest.fn(async (data) => ({
      success: true,
      results: {
        added: 0,
        updated: 0,
        movedToDeleted: 0,
        permanentlyDeleted: 0
      }
    }));

    // === CONFIGURATION ===
    this.getImageRepositoryPath = jest.fn(async () => ({
      success: true,
      path: null
    }));

    this.setImageRepositoryPath = jest.fn(async (repositoryPath) => ({
      success: true
    }));

    this.getSelectedGroupFilter = jest.fn(async () => ({
      success: true,
      groupCode: ''
    }));

    this.setSelectedGroupFilter = jest.fn(async (groupCode) => ({
      success: true
    }));

    // === IMAGE TAGS ===
    this.addImageTag = jest.fn(async (data) => ({
      success: true
    }));

    this.getImageTags = jest.fn(async (imagePath) => ({
      success: true,
      tags: []
    }));

    this.deleteImageTag = jest.fn(async (tagId) => ({
      success: true
    }));

    this.getAllImagesWithTags = jest.fn(async () => ({
      success: true,
      images: []
    }));

    // === LEGACY (para compatibilidad con tests existentes) ===
    this.invoke = jest.fn(async (channel, ...args) => {
      // Retornar respuesta genérica con channel y args
      return { channel, args };
    });
    this.send = jest.fn();
    this.exportCsv = jest.fn(async (opts) => ({ ok: true, opts }));
  }

  // === EVENT LISTENERS (on___) ===
  // Patrón: registrar listener y retornar función de cleanup

  _registerEvent(eventName, callback) {
    this.on(eventName, callback);
    // Retornar función para desuscribir
    return () => this.off(eventName, callback);
  }

  // Image events
  onImageDetecting(callback) {
    return this._registerEvent('image-detecting', callback);
  }

  onNewImageDetected(callback) {
    return this._registerEvent('new-image-detected', callback);
  }

  // Repository events
  onRepositoryChanged(callback) {
    return this._registerEvent('repository-changed', callback);
  }

  onSyncProgress(callback) {
    return this._registerEvent('sync-progress', callback);
  }

  onSyncCompleted(callback) {
    return this._registerEvent('sync-completed', callback);
  }

  // Progress event
  onProgress(callback) {
    return this._registerEvent('progress', callback);
  }

  // Menu events - Project
  onMenuNewProject(callback) {
    return this._registerEvent('menu-new-project', callback);
  }

  onMenuOpenProject(callback) {
    return this._registerEvent('menu-open-project', callback);
  }

  onProjectOpened(callback) {
    return this._registerEvent('project-opened', callback);
  }

  // Menu events - Camera
  onMenuToggleCamera(callback) {
    return this._registerEvent('menu-toggle-camera', callback);
  }

  onMenuCameraAutostart(callback) {
    return this._registerEvent('menu-camera-autostart', callback);
  }

  onChangeCamera(callback) {
    return this._registerEvent('change-camera', callback);
  }

  // Menu events - Image operations
  onMenuLinkImage(callback) {
    return this._registerEvent('menu-link-image', callback);
  }

  onMenuDeletePhoto(callback) {
    return this._registerEvent('menu-delete-photo', callback);
  }

  // Menu events - Display toggles
  onMenuToggleDuplicates(callback) {
    return this._registerEvent('menu-toggle-duplicates', callback);
  }

  onMenuToggleCapturedPhotos(callback) {
    return this._registerEvent('menu-toggle-captured-photos', callback);
  }

  onMenuToggleRepositoryPhotos(callback) {
    return this._registerEvent('menu-toggle-repository-photos', callback);
  }

  onMenuToggleRepositoryIndicators(callback) {
    return this._registerEvent('menu-toggle-repository-indicators', callback);
  }

  onInitialDisplayPreferences(callback) {
    return this._registerEvent('initial-display-preferences', callback);
  }

  onMenuToggleAdditionalActions(callback) {
    return this._registerEvent('menu-toggle-additional-actions', callback);
  }

  // Menu events - Import/Export
  onMenuImportImagesId(callback) {
    return this._registerEvent('menu-import-images-id', callback);
  }

  onMenuExportCSV(callback) {
    return this._registerEvent('menu-export-csv', callback);
  }

  onMenuExportImages(callback) {
    return this._registerEvent('menu-export-images', callback);
  }

  onMenuExportImagesName(callback) {
    return this._registerEvent('menu-export-images-name', callback);
  }

  onMenuExportToRepository(callback) {
    return this._registerEvent('menu-export-to-repository', callback);
  }

  // Menu events - XML
  onMenuUpdateXML(callback) {
    return this._registerEvent('menu-update-xml', callback);
  }

  // Menu events - Tags
  onMenuAddImageTag(callback) {
    return this._registerEvent('menu-add-image-tag', callback);
  }

  onMenuShowTaggedImages(callback) {
    return this._registerEvent('menu-show-tagged-images', callback);
  }

  // Config events
  onGroupFilterChanged(callback) {
    return this._registerEvent('group-filter-changed', callback);
  }

  // Legacy para compatibilidad
  onEvent(event, listener) {
    this.on(event, listener);
    return () => this.off(event, listener);
  }

  // === HELPERS PARA TESTS ===

  /**
   * Trigger event desde tests
   * Útil para simular eventos del main process
   */
  triggerEvent(eventName, ...args) {
    this.emit(eventName, ...args);
  }

  /**
   * Reset all mocks (útil en beforeEach)
   */
  resetAllMocks() {
    Object.keys(this).forEach(key => {
      if (this[key] && typeof this[key].mockClear === 'function') {
        this[key].mockClear();
      }
    });
  }
}

/**
 * Instalar mock en global.window
 * Llamar desde jest.setup.js
 */
function installOnWindow() {
  if (!global.window) {
    global.window = {};
  }
  global.window.electronAPI = new ElectronAPIMock();
  return global.window.electronAPI;
}

module.exports = { ElectronAPIMock, installOnWindow };
