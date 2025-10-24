const { BrowserWindow } = require('electron');
const path = require('path');

/**
 * Camera Window Manager
 */
class CameraWindowManager {
  constructor() {
    this.window = null;
  }

  /**
   * Create the camera window
   * @param {Object} options - Window creation options
   * @param {boolean} options.isDev - Whether running in development mode
   * @returns {BrowserWindow} The created window
   */
  create(options = {}) {
    const { isDev = false } = options;

    this.window = new BrowserWindow({
      width: 800,
      height: 600,
      title: 'Vista de Cámara',
      icon: path.join(__dirname, '../../../assets/icons/icon.png'),
      webPreferences: {
        preload: path.join(__dirname, '../../preload/preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      },
      backgroundColor: '#1a1f2e',
      show: false,
      autoHideMenuBar: true
    });

    this.window.loadFile('src/renderer/camera.html');

    this.window.once('ready-to-show', () => {
      this.window.setMenuBarVisibility(false);
      this.window.show();
    });

    this.window.on('closed', () => {
      this.window = null;
    });

    // Open DevTools in development
    if (isDev) {
      this.window.webContents.openDevTools();
    }

    return this.window;
  }

  /**
   * Open the camera window (create if doesn't exist)
   * @param {Object} options - Window creation options
   * @returns {BrowserWindow} The window instance
   */
  open(options = {}) {
    if (!this.window) {
      this.create(options);
    } else {
      this.window.show();
      this.window.focus();
    }
    return this.window;
  }

  /**
   * Close the camera window
   */
  close() {
    if (this.window) {
      this.window.close();
      this.window = null;
    }
  }

  /**
   * Get the camera window instance
   * @returns {BrowserWindow|null}
   */
  getWindow() {
    return this.window;
  }

  /**
   * Check if window exists and is not destroyed
   * @returns {boolean}
   */
  isValid() {
    return this.window && !this.window.isDestroyed();
  }

  /**
   * Show the window if it exists
   */
  show() {
    if (this.window) {
      this.window.show();
      this.window.focus();
    }
  }
}

module.exports = CameraWindowManager;