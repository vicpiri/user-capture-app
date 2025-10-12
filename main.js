const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const DatabaseManager = require('./src/main/database');
const XMLParser = require('./src/main/xmlParser');
const FolderWatcher = require('./src/main/folderWatcher');
const ImageManager = require('./src/main/imageManager');
const { getLogger } = require('./src/main/logger');

let mainWindow;
let dbManager;
let folderWatcher;
let imageManager;
let projectPath = null;
let logger = getLogger();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'src/preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#1a1f2e',
    show: false
  });

  mainWindow.loadFile('src/renderer/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

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

// IPC Handlers

// Create new project
ipcMain.handle('create-project', async (event, data) => {
  try {
    const { folderPath, xmlPath } = data;

    // Initialize logger for this project
    logger.initialize(folderPath);
    logger.section('CREATING NEW PROJECT');
    logger.info('Project folder selected', { folderPath, xmlPath });

    // Validate paths
    logger.info('Validating paths...');
    if (!fs.existsSync(folderPath)) {
      throw new Error('La carpeta seleccionada no existe');
    }
    if (!fs.existsSync(xmlPath)) {
      throw new Error('El archivo XML no existe');
    }
    logger.success('Paths validated successfully');

    // Progress: 10%
    mainWindow.webContents.send('progress', {
      percentage: 10,
      message: 'Creando carpetas del proyecto...',
      details: ''
    });

    projectPath = folderPath;

    // Create necessary folders
    logger.section('CREATING PROJECT STRUCTURE');
    const ingestPath = path.join(folderPath, 'ingest');
    const importsPath = path.join(folderPath, 'imports');
    const dataPath = path.join(folderPath, 'data');

    [ingestPath, importsPath, dataPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created folder: ${dir}`);
      } else {
        logger.info(`Folder already exists: ${dir}`);
      }
    });
    logger.success('Project structure created successfully');

    // Progress: 25%
    mainWindow.webContents.send('progress', {
      percentage: 25,
      message: 'Inicializando base de datos...',
      details: ''
    });

    // Initialize database
    logger.section('INITIALIZING DATABASE');
    const dbPath = path.join(dataPath, 'users.db');
    logger.info(`Database path: ${dbPath}`);
    dbManager = new DatabaseManager(dbPath);
    await dbManager.initialize();
    logger.success('Database initialized successfully');

    // Progress: 40%
    mainWindow.webContents.send('progress', {
      percentage: 40,
      message: 'Leyendo archivo XML...',
      details: xmlPath
    });

    // Parse XML and import users
    logger.section('PARSING XML FILE');
    logger.info(`Reading XML file: ${xmlPath}`);
    const xmlParser = new XMLParser(xmlPath);
    const users = await xmlParser.parse();

    const totalUsers = users.students.length + users.teachers.length + users.nonTeachingStaff.length;
    const totalGroups = users.groups.length;

    logger.success('XML parsed successfully', {
      groups: totalGroups,
      students: users.students.length,
      teachers: users.teachers.length,
      nonTeachingStaff: users.nonTeachingStaff.length,
      totalUsers: totalUsers
    });

    // Progress: 60%
    mainWindow.webContents.send('progress', {
      percentage: 60,
      message: 'Importando usuarios...',
      details: `${totalGroups} grupos, ${totalUsers} usuarios encontrados`
    });

    logger.section('IMPORTING USERS TO DATABASE');
    logger.info(`Importing ${totalGroups} groups and ${totalUsers} users...`);
    await dbManager.importUsers(users);
    logger.success('Users imported successfully');

    // Progress: 80%
    mainWindow.webContents.send('progress', {
      percentage: 80,
      message: 'Configurando vigilancia de carpetas...',
      details: ''
    });

    // Initialize image manager
    logger.section('INITIALIZING MANAGERS');
    imageManager = new ImageManager(importsPath);
    logger.info('Image manager initialized');

    // Start folder watcher
    folderWatcher = new FolderWatcher(ingestPath, importsPath);
    folderWatcher.on('image-added', (filename) => {
      logger.info(`New image detected: ${filename}`);
      mainWindow.webContents.send('new-image-detected', filename);
    });
    folderWatcher.start();
    logger.success('Folder watcher started', { watchPath: ingestPath });

    // Progress: 100%
    mainWindow.webContents.send('progress', {
      percentage: 100,
      message: 'Proyecto creado exitosamente',
      details: `${totalUsers} usuarios importados`
    });

    logger.section('PROJECT CREATION COMPLETED');
    logger.success('Project created successfully', {
      totalGroups,
      totalUsers,
      projectPath: folderPath
    });

    return { success: true, message: 'Proyecto creado exitosamente' };
  } catch (error) {
    logger.error('Error creating project', error);
    return { success: false, error: error.message };
  }
});

// Open existing project
ipcMain.handle('open-project', async (event, folderPath) => {
  try {
    // Initialize logger for this project
    logger.initialize(folderPath);
    logger.section('OPENING EXISTING PROJECT');
    logger.info('Project folder selected', { folderPath });

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
    folderWatcher.on('image-added', (filename) => {
      logger.info(`New image detected: ${filename}`);
      mainWindow.webContents.send('new-image-detected', filename);
    });
    folderWatcher.start();
    logger.success('Folder watcher started', { watchPath: ingestPath });

    logger.section('PROJECT OPENED SUCCESSFULLY');
    logger.success('Project loaded', { projectPath: folderPath });

    return { success: true, message: 'Proyecto abierto exitosamente' };
  } catch (error) {
    logger.error('Error opening project', error);
    return { success: false, error: error.message };
  }
});

// Get all users
ipcMain.handle('get-users', async (event, filters) => {
  try {
    if (!dbManager) {
      throw new Error('No hay ningún proyecto abierto');
    }
    const users = await dbManager.getUsers(filters);
    return { success: true, users };
  } catch (error) {
    console.error('Error getting users:', error);
    return { success: false, error: error.message };
  }
});

// Get groups
ipcMain.handle('get-groups', async () => {
  try {
    if (!dbManager) {
      throw new Error('No hay ningún proyecto abierto');
    }
    const groups = await dbManager.getGroups();
    return { success: true, groups };
  } catch (error) {
    console.error('Error getting groups:', error);
    return { success: false, error: error.message };
  }
});

// Link image to user
ipcMain.handle('link-image-user', async (event, data) => {
  try {
    if (!dbManager) {
      throw new Error('No hay ningún proyecto abierto');
    }

    const { userId, imagePath } = data;

    // Check if user already has an image
    const user = await dbManager.getUserById(userId);
    if (user.image_path) {
      // Return confirmation needed
      return { success: false, needsConfirmation: true, currentImage: user.image_path };
    }

    await dbManager.linkImageToUser(userId, imagePath);
    return { success: true };
  } catch (error) {
    console.error('Error linking image:', error);
    return { success: false, error: error.message };
  }
});

// Confirm link (when user already has image)
ipcMain.handle('confirm-link-image', async (event, data) => {
  try {
    if (!dbManager) {
      throw new Error('No hay ningún proyecto abierto');
    }

    const { userId, imagePath } = data;
    await dbManager.linkImageToUser(userId, imagePath);
    return { success: true };
  } catch (error) {
    console.error('Error confirming link:', error);
    return { success: false, error: error.message };
  }
});

// Get images from imports folder
ipcMain.handle('get-images', async () => {
  try {
    if (!imageManager) {
      throw new Error('No hay ningún proyecto abierto');
    }
    const images = await imageManager.getImages();
    return { success: true, images };
  } catch (error) {
    console.error('Error getting images:', error);
    return { success: false, error: error.message };
  }
});

// Save captured image
ipcMain.handle('save-captured-image', async (event, imageData) => {
  try {
    if (!projectPath) {
      throw new Error('No hay ningún proyecto abierto');
    }

    const ingestPath = path.join(projectPath, 'ingest');
    const timestamp = new Date();
    let filename = formatTimestamp(timestamp) + '.jpg';
    let filePath = path.join(ingestPath, filename);

    // Check for duplicate filenames (same second)
    let counter = 1;
    while (fs.existsSync(filePath)) {
      filename = formatTimestamp(timestamp) + '_' + counter + '.jpg';
      filePath = path.join(ingestPath, filename);
      counter++;
    }

    // Convert base64 to buffer and save
    const base64Data = imageData.replace(/^data:image\/jpeg;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    return { success: true, filename };
  } catch (error) {
    console.error('Error saving captured image:', error);
    return { success: false, error: error.message };
  }
});

// Dialog handlers
ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// Helper function to format timestamp
function formatTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}
