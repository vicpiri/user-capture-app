const { BrowserWindow } = require('electron');
const path = require('path');
const VersionManager = require('../utils/version');

/**
 * Main Window Manager
 */
class MainWindowManager {
  constructor() {
    this.window = null;
    this.version = VersionManager.getVersion();
  }

  /**
   * Create the main window
   * @param {Object} options - Window creation options
   * @param {boolean} options.isDev - Whether running in development mode
   * @returns {BrowserWindow} The created window
   */
  create(options = {}) {
    const { isDev = false } = options;

    this.window = new BrowserWindow({
      width: 1400,
      height: 900,
      title: `User Capture v${this.version}`,
      icon: path.join(__dirname, '../../../assets/icons/icon.png'),
      webPreferences: {
        preload: path.join(__dirname, '../../preload/preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      },
      backgroundColor: '#1a1f2e',
      show: false
    });

    this.window.loadFile('src/renderer/index.html');

    this.window.once('ready-to-show', () => {
      this.window.show();
    });

    // Open DevTools in development
    if (isDev) {
      this.window.webContents.openDevTools();
    }

    return this.window;
  }

  /**
   * Get the main window instance
   * @returns {BrowserWindow|null}
   */
  getWindow() {
    return this.window;
  }

  /**
   * Update window title with project name
   * @param {string|null} projectPath - Path to the project folder
   */
  updateTitle(projectPath) {
    if (!this.window) return;

    if (projectPath) {
      const projectName = path.basename(projectPath);
      this.window.setTitle(`User Capture v${this.version} - ${projectName}`);
    } else {
      this.window.setTitle(`User Capture v${this.version}`);
    }
  }

  /**
   * Send initial display preferences to the window
   * @param {Object} preferences - Display preferences
   */
  sendInitialPreferences(preferences) {
    if (!this.window) return;

    this.window.webContents.send('initial-display-preferences', preferences);
  }

  /**
   * Focus the main window
   */
  focus() {
    if (this.window) {
      this.window.focus();
    }
  }

  /**
   * Check if window exists and is not destroyed
   * @returns {boolean}
   */
  isValid() {
    return this.window && !this.window.isDestroyed();
  }
}

module.exports = MainWindowManager;