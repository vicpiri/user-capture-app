const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Project management
  createProject: (data) => ipcRenderer.invoke('create-project', data),
  openProject: (folderPath) => ipcRenderer.invoke('open-project', folderPath),

  // User management
  getUsers: (filters) => ipcRenderer.invoke('get-users', filters),
  getGroups: () => ipcRenderer.invoke('get-groups'),

  // Image management
  getImages: () => ipcRenderer.invoke('get-images'),
  saveCapturedImage: (imageData) => ipcRenderer.invoke('save-captured-image', imageData),
  linkImageToUser: (data) => ipcRenderer.invoke('link-image-user', data),
  confirmLinkImage: (data) => ipcRenderer.invoke('confirm-link-image', data),

  // Dialog
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

  // Events from main process
  onNewImageDetected: (callback) => {
    ipcRenderer.on('new-image-detected', (event, filename) => callback(filename));
  },

  onProgress: (callback) => {
    ipcRenderer.on('progress', (event, data) => callback(data));
  }
});
