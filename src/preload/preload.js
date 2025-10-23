const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Project management
  createProject: (data) => ipcRenderer.invoke('create-project', data),
  openProject: (folderPath) => ipcRenderer.invoke('open-project', folderPath),

  // User management
  getUsers: (filters, options) => ipcRenderer.invoke('get-users', filters, options),
  getGroups: () => ipcRenderer.invoke('get-groups'),

  // Image management
  getImages: () => ipcRenderer.invoke('get-images'),
  saveCapturedImage: (imageData) => ipcRenderer.invoke('save-captured-image', imageData),
  linkImageToUser: (data) => ipcRenderer.invoke('link-image-user', data),
  confirmLinkImage: (data) => ipcRenderer.invoke('confirm-link-image', data),

  // Dialog
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  focusWindow: () => ipcRenderer.invoke('focus-window'),

  // Events from main process
  onImageDetecting: (callback) => {
    ipcRenderer.on('image-detecting', (event, filename) => callback(filename));
  },

  onNewImageDetected: (callback) => {
    ipcRenderer.on('new-image-detected', (event, filename) => callback(filename));
  },

  onRepositoryChanged: (callback) => {
    ipcRenderer.on('repository-changed', () => callback());
  },

  onProgress: (callback) => {
    ipcRenderer.on('progress', (event, data) => callback(data));
  },

  onMenuNewProject: (callback) => {
    ipcRenderer.on('menu-new-project', callback);
  },

  onMenuOpenProject: (callback) => {
    ipcRenderer.on('menu-open-project', callback);
  },

  onMenuToggleCamera: (callback) => {
    ipcRenderer.on('menu-toggle-camera', (event, enabled) => callback(enabled));
  },

  onMenuCameraAutostart: (callback) => {
    ipcRenderer.on('menu-camera-autostart', (event, enabled) => callback(enabled));
  },

  onProjectOpened: (callback) => {
    ipcRenderer.on('project-opened', (event, data) => callback(data));
  },

  onMenuLinkImage: (callback) => {
    ipcRenderer.on('menu-link-image', callback);
  },

  onMenuDeletePhoto: (callback) => {
    ipcRenderer.on('menu-delete-photo', callback);
  },

  onMenuToggleDuplicates: (callback) => {
    ipcRenderer.on('menu-toggle-duplicates', (event, enabled) => callback(enabled));
  },

  onMenuToggleCapturedPhotos: (callback) => {
    ipcRenderer.on('menu-toggle-captured-photos', (event, enabled) => callback(enabled));
  },

  onMenuToggleRepositoryPhotos: (callback) => {
    ipcRenderer.on('menu-toggle-repository-photos', (event, enabled) => callback(enabled));
  },

  onMenuToggleRepositoryIndicators: (callback) => {
    ipcRenderer.on('menu-toggle-repository-indicators', (event, enabled) => callback(enabled));
  },

  onInitialDisplayPreferences: (callback) => {
    ipcRenderer.on('initial-display-preferences', (event, prefs) => callback(prefs));
  },

  onMenuImportImagesId: (callback) => {
    ipcRenderer.on('menu-import-images-id', callback);
  },

  onMenuExportCSV: (callback) => {
    ipcRenderer.on('menu-export-csv', callback);
  },

  onMenuExportImages: (callback) => {
    ipcRenderer.on('menu-export-images', callback);
  },

  onMenuExportImagesName: (callback) => {
    ipcRenderer.on('menu-export-images-name', callback);
  },

  onMenuExportToRepository: (callback) => {
    ipcRenderer.on('menu-export-to-repository', callback);
  },

  importImagesWithId: (folderPath) => ipcRenderer.invoke('import-images-with-id', folderPath),
  exportCSV: (folderPath, users) => ipcRenderer.invoke('export-csv', folderPath, users),
  exportImages: (folderPath, users, options) => ipcRenderer.invoke('export-images', folderPath, users, options),
  exportImagesName: (folderPath, users, options) => ipcRenderer.invoke('export-images-name', folderPath, users, options),
  exportToRepository: (users, options) => ipcRenderer.invoke('export-to-repository', users, options),

  unlinkImageFromUser: (userId) => ipcRenderer.invoke('unlink-image-user', userId),

  moveImageToIngest: (imagePath) => ipcRenderer.invoke('move-image-to-ingest', imagePath),

  // Camera
  updateAvailableCameras: (cameras) => ipcRenderer.invoke('update-available-cameras', cameras),
  getSelectedCamera: () => ipcRenderer.invoke('get-selected-camera'),
  onChangeCamera: (callback) => {
    ipcRenderer.on('change-camera', (event, cameraId) => callback(cameraId));
  },

  // XML update
  updateXML: (xmlPath) => ipcRenderer.invoke('update-xml', xmlPath),
  confirmUpdateXML: (data) => ipcRenderer.invoke('confirm-update-xml', data),
  onMenuUpdateXML: (callback) => {
    ipcRenderer.on('menu-update-xml', callback);
  },

  // Global configuration
  getImageRepositoryPath: () => ipcRenderer.invoke('get-image-repository-path'),
  setImageRepositoryPath: (repositoryPath) => ipcRenderer.invoke('set-image-repository-path', repositoryPath),
  getSelectedGroupFilter: () => ipcRenderer.invoke('get-selected-group-filter'),
  setSelectedGroupFilter: (groupCode) => ipcRenderer.invoke('set-selected-group-filter', groupCode),
  onGroupFilterChanged: (callback) => {
    ipcRenderer.on('group-filter-changed', (event, groupCode) => callback(groupCode));
  },

  // Image tags
  addImageTag: (data) => ipcRenderer.invoke('add-image-tag', data),
  getImageTags: (imagePath) => ipcRenderer.invoke('get-image-tags', imagePath),
  deleteImageTag: (tagId) => ipcRenderer.invoke('delete-image-tag', tagId),
  getAllImagesWithTags: () => ipcRenderer.invoke('get-all-images-with-tags'),
  onMenuAddImageTag: (callback) => {
    ipcRenderer.on('menu-add-image-tag', callback);
  },
  onMenuShowTaggedImages: (callback) => {
    ipcRenderer.on('menu-show-tagged-images', callback);
  },

  onMenuToggleAdditionalActions: (callback) => {
    ipcRenderer.on('menu-toggle-additional-actions', (event, enabled) => callback(enabled));
  }
});
