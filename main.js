const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const DatabaseManager = require('./src/main/database');
const FolderWatcher = require('./src/main/folderWatcher');
const ImageManager = require('./src/main/imageManager');
const RepositoryMirror = require('./src/main/repositoryMirror');
const MenuBuilder = require('./src/main/menu/menuBuilder');
const MainWindowManager = require('./src/main/window/mainWindow');
const CameraWindowManager = require('./src/main/window/cameraWindow');
const ImageGridWindowManager = require('./src/main/window/imageGridWindow');
const RepositoryGridWindowManager = require('./src/main/window/repositoryGridWindow');
const { getLogger } = require('./src/main/logger');
const {
  loadGlobalConfig,
  getImageRepositoryPath,
  setImageRepositoryPath,
  saveDisplayPreferences
} = require('./src/main/utils/config');
const {
  loadRecentProjects: loadRecentProjectsUtil,
  saveRecentProjects: saveRecentProjectsUtil,
  addRecentProject: addRecentProjectUtil
} = require('./src/main/utils/recentProjects');
const { RepositoryCacheManager } = require('./src/main/utils/repositoryCache');

// IPC handler modules
const { registerProjectHandlers } = require('./src/main/ipc/projectHandlers');
const { registerUserGroupImageHandlers } = require('./src/main/ipc/userGroupImageHandlers');
const { registerExportHandlers } = require('./src/main/ipc/exportHandlers');
const { registerMiscHandlers } = require('./src/main/ipc/miscHandlers');

// Enable hot reload in development
if (process.argv.includes('--dev')) {
  try {
    require('electron-reloader')(module, {
      debug: true,
      watchRenderer: true
    });
  } catch (err) {
    console.log('Error loading electron-reloader:', err);
  }
}

// Application state
// Window managers
const mainWindowManager = new MainWindowManager();
const cameraWindowManager = new CameraWindowManager();
const imageGridWindowManager = new ImageGridWindowManager();
const repositoryGridWindowManager = new RepositoryGridWindowManager();

let dbManager;
let folderWatcher;
let imageManager;
let projectPath = null;
let logger = getLogger();
let cameraEnabled = false;
let cameraAutoStart = false;
let recentProjects = [];
// Display preferences - will be loaded from config on startup
let showDuplicatesOnly = false;
let showCapturedPhotos = true;
let showRepositoryPhotos = false;
let showRepositoryIndicators = false;
let showAdditionalActions = true;
let availableCameras = [];
let selectedCameraId = null;
let repositoryMirror = null; // Repository mirror manager

// Repository cache manager
const repositoryCacheManager = new RepositoryCacheManager();

function createMenu() {
  const menuBuilder = new MenuBuilder({
    // Windows
    mainWindow: mainWindowManager.getWindow(),
    cameraWindow: cameraWindowManager.getWindow(),

    // State
    cameraEnabled,
    cameraAutoStart,
    selectedCameraId,
    availableCameras,
    showDuplicatesOnly,
    showCapturedPhotos,
    showRepositoryPhotos,
    showRepositoryIndicators,
    showAdditionalActions,
    recentProjects,

    // Logger
    logger,

    // Callbacks
    callbacks: {
      openRecentProject,
      getImageRepositoryPath,
      setImageRepositoryPath,
      toggleCamera: () => {
        cameraEnabled = !cameraEnabled;
        if (cameraEnabled) {
          openCameraWindow();
        } else {
          closeCameraWindow();
        }
        createMenu();
      },
      openCameraWindow,
      selectCamera: (deviceId) => {
        selectedCameraId = deviceId;
        const cameraWindow = cameraWindowManager.getWindow();
        if (cameraWindow) {
          cameraWindow.webContents.send('change-camera', selectedCameraId);
        }
        createMenu();
      },
      setCameraAutoStart: (checked) => {
        cameraAutoStart = checked;
        const mainWindow = mainWindowManager.getWindow();
        if (mainWindow) {
          mainWindow.webContents.send('menu-camera-autostart', cameraAutoStart);
        }
      },
      toggleDuplicates: (checked) => {
        showDuplicatesOnly = checked;
        saveDisplayPreferences({
          showDuplicatesOnly,
          showCapturedPhotos,
          showRepositoryPhotos,
          showRepositoryIndicators,
          showAdditionalActions
        });
        const mainWindow = mainWindowManager.getWindow();
        if (mainWindow) {
          mainWindow.webContents.send('menu-toggle-duplicates', showDuplicatesOnly);
        }
      },
      toggleCapturedPhotos: (checked) => {
        showCapturedPhotos = checked;
        saveDisplayPreferences({
          showDuplicatesOnly,
          showCapturedPhotos,
          showRepositoryPhotos,
          showRepositoryIndicators,
          showAdditionalActions
        });
        const mainWindow = mainWindowManager.getWindow();
        if (mainWindow) {
          mainWindow.webContents.send('menu-toggle-captured-photos', showCapturedPhotos);
        }
      },
      toggleRepositoryPhotos: (checked) => {
        showRepositoryPhotos = checked;
        saveDisplayPreferences({
          showDuplicatesOnly,
          showCapturedPhotos,
          showRepositoryPhotos,
          showRepositoryIndicators,
          showAdditionalActions
        });
        if (showRepositoryPhotos) {
          logger.info('[MENU] Mostrar imágenes del depósito activated');
          ensureRepositoryMirrorStarted();
        }
        const mainWindow = mainWindowManager.getWindow();
        if (mainWindow) {
          mainWindow.webContents.send('menu-toggle-repository-photos', showRepositoryPhotos);
        }
      },
      toggleRepositoryIndicators: (checked) => {
        showRepositoryIndicators = checked;
        saveDisplayPreferences({
          showDuplicatesOnly,
          showCapturedPhotos,
          showRepositoryPhotos,
          showRepositoryIndicators,
          showAdditionalActions
        });
        if (showRepositoryIndicators) {
          ensureRepositoryMirrorStarted();
        }
        const mainWindow = mainWindowManager.getWindow();
        if (mainWindow) {
          mainWindow.webContents.send('menu-toggle-repository-indicators', showRepositoryIndicators);
        }
      },
      toggleAdditionalActions: (checked) => {
        showAdditionalActions = checked;
        saveDisplayPreferences({
          showDuplicatesOnly,
          showCapturedPhotos,
          showRepositoryPhotos,
          showRepositoryIndicators,
          showAdditionalActions
        });
        const mainWindow = mainWindowManager.getWindow();
        if (mainWindow) {
          mainWindow.webContents.send('menu-toggle-additional-actions', showAdditionalActions);
        }
      },
      openImageGridWindow,
      openRepositoryGridWindow
    }
  });

  menuBuilder.build();
}

function createWindow() {
  const isDev = process.argv.includes('--dev');
  const mainWindow = mainWindowManager.create({ isDev });

  // Wait for renderer to be ready before sending events
  mainWindow.webContents.on('did-finish-load', () => {
    // Send initial display preferences to renderer
    mainWindowManager.sendInitialPreferences({
      showDuplicatesOnly,
      showCapturedPhotos,
      showRepositoryPhotos,
      showRepositoryIndicators,
      showAdditionalActions
    });

    // If repository options are enabled in saved preferences, start repository mirror
    if (showRepositoryPhotos || showRepositoryIndicators) {
      logger.info('[STARTUP] Repository options enabled in preferences, starting repository mirror');
      ensureRepositoryMirrorStarted();
    }
  });

  mainWindow.on('closed', () => {
    cameraWindowManager.close();
  });
}

function openCameraWindow() {
  const isDev = process.argv.includes('--dev');
  cameraWindowManager.open({ isDev });
}

function closeCameraWindow() {
  cameraWindowManager.close();
}

function openImageGridWindow() {
  if (!dbManager) {
    const mainWindow = mainWindowManager.getWindow();
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Proyecto no abierto',
      message: 'Debes abrir o crear un proyecto primero',
      buttons: ['Aceptar']
    });
    return;
  }

  const isDev = process.argv.includes('--dev');
  imageGridWindowManager.open({ isDev });
}

function openRepositoryGridWindow() {
  const mainWindow = mainWindowManager.getWindow();

  if (!dbManager) {
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Proyecto no abierto',
      message: 'Debes abrir o crear un proyecto primero',
      buttons: ['Aceptar']
    });
    return;
  }

  // Check if repository path is configured
  const repositoryPath = getImageRepositoryPath();
  if (!repositoryPath) {
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Depósito no configurado',
      message: 'Debes configurar el depósito de imágenes primero.\n\nVe a Archivo > Configuración > Depósito imágenes de usuario',
      buttons: ['Aceptar']
    });
    return;
  }

  // Start mirror lazily when opening repository grid
  ensureRepositoryMirrorStarted();

  const isDev = process.argv.includes('--dev');
  repositoryGridWindowManager.open({ isDev });
}

// ============================================================================
// Helper Functions
// ============================================================================

// Helper function to ensure Eliminados group exists
async function ensureDeletedGroup() {
  const deletedGroupCode = 'ELIMINADOS';
  const deletedGroupName = '⚠ Eliminados';

  const groups = await dbManager.getGroups();
  let deletedGroup = groups.find(g => g.code === deletedGroupCode);

  if (!deletedGroup) {
    // Create the group
    await dbManager.importUsers({
      groups: [{ code: deletedGroupCode, name: deletedGroupName }],
      students: [],
      teachers: [],
      nonTeachingStaff: []
    });
    logger.info(`Created Eliminados group: ${deletedGroupCode}`);
    deletedGroup = { code: deletedGroupCode, name: deletedGroupName };
  }

  return deletedGroup;
}

// Repository mirror management
async function ensureRepositoryMirrorStarted() {
  // Only start if not already running and repository path is set
  if (repositoryMirror) {
    return; // Already running
  }

  const repositoryPath = getImageRepositoryPath();
  if (!repositoryPath) {
    return;
  }

  logger.info('Initializing repository mirror (lazy initialization)...');

  // Create mirror path
  const mirrorPath = path.join(app.getPath('userData'), 'repository-mirror');

  // Initialize mirror
  repositoryMirror = new RepositoryMirror(repositoryPath, mirrorPath, logger);

  // Initialize in background (non-blocking)
  setImmediate(async () => {
    const initialized = await repositoryMirror.initialize();
    if (initialized) {
      logger.success('Repository mirror initialized');

      // Listen to sync events
      repositoryMirror.on('sync-started', () => {
        logger.info('Repository sync started');
      });

      repositoryMirror.on('sync-progress', (data) => {
        if (data.phase === 'syncing' && data.current % 50 === 0) {
          logger.info(`Syncing: ${data.current}/${data.total} files`);
        }
        // Send progress to repository grid window
        const repositoryGridWindow = repositoryGridWindowManager.getWindow();
        if (repositoryGridWindow && !repositoryGridWindow.isDestroyed()) {
          repositoryGridWindow.webContents.send('sync-progress', data);
        }
      });

      repositoryMirror.on('sync-completed', (result) => {
        if (result.success) {
          logger.success(`Sync completed: ${result.synced} files synced`);
          // Notify all windows about repository changes
          const mainWindow = mainWindowManager.getWindow();
          if (mainWindow) {
            mainWindow.webContents.send('repository-changed');
          }
          // Send completion event to repository grid window
          const repositoryGridWindow = repositoryGridWindowManager.getWindow();
          if (repositoryGridWindow && !repositoryGridWindow.isDestroyed()) {
            repositoryGridWindow.webContents.send('sync-completed', result);
          }
        } else {
          logger.error(`Sync failed: ${result.error}`);
          // Send error to repository grid window
          const repositoryGridWindow = repositoryGridWindowManager.getWindow();
          if (repositoryGridWindow && !repositoryGridWindow.isDestroyed()) {
            repositoryGridWindow.webContents.send('sync-completed', result);
          }
        }
      });

      repositoryMirror.on('file-synced', (filename) => {
        // File synced - could update UI here if needed
      });

      // Start initial sync
      repositoryMirror.startSync();
    } else {
      logger.error('Failed to initialize repository mirror');
    }
  });
}

// Helper function to update window title with project name
function updateWindowTitle() {
  mainWindowManager.updateTitle(projectPath);
}

// Wrapper for loadRecentProjects to populate global variable
function loadRecentProjects() {
  recentProjects = loadRecentProjectsUtil();
}

// Wrapper for addRecentProject with additional logic
function addRecentProject(folderPath) {
  recentProjects = addRecentProjectUtil(folderPath, recentProjects);
  saveRecentProjectsUtil(recentProjects);
  createMenu();
}

async function openRecentProject(folderPath) {
  try {
    // Initialize logger for this project
    logger.initialize(folderPath);
    logger.section('OPENING RECENT PROJECT');
    logger.info('Recent project selected', { folderPath });

    if (!fs.existsSync(folderPath)) {
      throw new Error('La carpeta del proyecto no existe');
    }

    projectPath = folderPath;
    const dataPath = path.join(folderPath, 'data');
    const dbPath = path.join(dataPath, 'users.db');

    logger.info('Validating project structure...');
    if (!fs.existsSync(dbPath)) {
      throw new Error('No se encontró la base de datos del proyecto');
    }
    logger.success('Project structure validated');

    // Initialize database
    logger.section('LOADING DATABASE');
    logger.info(`Database path: ${dbPath}`);
    dbManager = new DatabaseManager(dbPath);
    await dbManager.initialize();
    logger.success('Database loaded successfully');

    // Initialize paths
    const ingestPath = path.join(folderPath, 'ingest');
    const importsPath = path.join(folderPath, 'imports');

    // Initialize image manager
    logger.section('INITIALIZING MANAGERS');
    imageManager = new ImageManager(importsPath);
    logger.info('Image manager initialized');

    // Start folder watcher
    folderWatcher = new FolderWatcher(ingestPath, importsPath);
    folderWatcher.on('image-detecting', (filename) => {
      logger.info(`Image being processed: ${filename}`);
      const mainWindow = mainWindowManager.getWindow();
      if (mainWindow) {
        mainWindow.webContents.send('image-detecting', filename);
      }
    });
    folderWatcher.on('image-added', (filename) => {
      logger.info(`New image detected: ${filename}`);
      // Invalidate image cache when new image is added
      imageManager.invalidateCache();
      const mainWindow = mainWindowManager.getWindow();
      if (mainWindow) {
        mainWindow.webContents.send('new-image-detected', filename);
      }
    });
    folderWatcher.start();
    logger.success('Folder watcher started', { watchPath: ingestPath });

    logger.section('PROJECT OPENED SUCCESSFULLY');
    logger.success('Project loaded', { projectPath: folderPath });

    // Add to recent projects
    addRecentProject(folderPath);

    // Update window title
    updateWindowTitle();

    // Notify renderer
    const mainWindow = mainWindowManager.getWindow();
    if (mainWindow) {
      mainWindow.webContents.send('project-opened', { success: true });
    }
  } catch (error) {
    logger.error('Error opening recent project', error);
    dialog.showErrorBox('Error', 'Error al abrir el proyecto: ' + error.message);
  }
}

// ============================================================================
// IPC Handler Registration
// ============================================================================

/**
 * Register all IPC handlers
 */
function registerIPCHandlers() {
  // Create shared state object accessible by all handlers
  const state = {
    get dbManager() { return dbManager; },
    set dbManager(value) { dbManager = value; },
    get folderWatcher() { return folderWatcher; },
    set folderWatcher(value) { folderWatcher = value; },
    get imageManager() { return imageManager; },
    set imageManager(value) { imageManager = value; },
    get projectPath() { return projectPath; },
    set projectPath(value) { projectPath = value; },
    get availableCameras() { return availableCameras; },
    set availableCameras(value) { availableCameras = value; },
    get selectedCameraId() { return selectedCameraId; },
    set selectedCameraId(value) { selectedCameraId = value; },
    invalidateRepositoryCache: () => repositoryCacheManager.invalidateCache()
  };

  // Create shared context object for all handlers
  const context = {
    mainWindow: () => mainWindowManager.getWindow(),
    logger,
    state,
    repositoryCacheManager,
    repositoryMirror: () => repositoryMirror,
    imageGridWindow: () => imageGridWindowManager.getWindow(),
    repositoryGridWindow: () => repositoryGridWindowManager.getWindow(),
    createMenu,
    addRecentProject,
    updateWindowTitle,
    ensureDeletedGroup,
    ensureRepositoryMirrorStarted
  };

  // Register all handler modules
  registerProjectHandlers(context);
  registerUserGroupImageHandlers(context);
  registerExportHandlers(context);
  registerMiscHandlers(context);
}

app.whenReady().then(() => {
  // Load display preferences from config
  const config = loadGlobalConfig();
  showDuplicatesOnly = config.showDuplicatesOnly ?? false;
  showCapturedPhotos = config.showCapturedPhotos ?? true;
  showRepositoryPhotos = config.showRepositoryPhotos ?? false;
  showRepositoryIndicators = config.showRepositoryIndicators ?? false;
  showAdditionalActions = config.showAdditionalActions ?? true;

  loadRecentProjects();
  createMenu();
  createWindow();

  // Register all IPC handlers
  registerIPCHandlers();

  // DO NOT start repository watcher automatically on startup
  // It will be started lazily when needed (when user enables repository options)
  // This prevents blocking on Google Drive during startup

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
