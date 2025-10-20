const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const DatabaseManager = require('./src/main/database');
const XMLParser = require('./src/main/xmlParser');
const FolderWatcher = require('./src/main/folderWatcher');
const ImageManager = require('./src/main/imageManager');
const { getLogger } = require('./src/main/logger');

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

let mainWindow;
let cameraWindow = null;
let imageGridWindow = null;
let dbManager;
let folderWatcher;
let imageManager;
let projectPath = null;
let logger = getLogger();
let cameraEnabled = false;
let cameraAutoStart = false;
let recentProjects = [];
let showDuplicatesOnly = false;
let showCapturedPhotos = true;
let showRepositoryPhotos = true;
let showRepositoryIndicators = true;
let availableCameras = [];
let selectedCameraId = null;

function createMenu() {
  // Build recent projects submenu
  const recentProjectsSubmenu = recentProjects.length > 0
    ? recentProjects.map((projectPath, index) => ({
        label: path.basename(projectPath),
        accelerator: index < 9 ? `CmdOrCtrl+${index + 1}` : undefined,
        click: () => {
          openRecentProject(projectPath);
        }
      }))
    : [{ label: 'No hay proyectos recientes', enabled: false }];

  const template = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Nuevo Proyecto...',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-project');
          }
        },
        {
          label: 'Abrir Proyecto...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('menu-open-project');
          }
        },
        { type: 'separator' },
        {
          label: 'Proyectos Recientes',
          submenu: recentProjectsSubmenu
        },
        { type: 'separator' },
        {
          label: 'Importar',
          submenu: [
            {
              label: 'Imágenes con ID',
              click: () => {
                mainWindow.webContents.send('menu-import-images-id');
              }
            }
          ]
        },
        {
          label: 'Exportar',
          submenu: [
            {
              label: 'Lista en CSV para carnets',
              click: () => {
                mainWindow.webContents.send('menu-export-csv');
              }
            },
            {
              label: 'Imágenes como ID',
              click: () => {
                mainWindow.webContents.send('menu-export-images');
              }
            },
            {
              label: 'Imágenes como nombre y apellidos',
              click: () => {
                mainWindow.webContents.send('menu-export-images-name');
              }
            },
            { type: 'separator' },
            {
              label: 'Imágenes capturadas al depósito',
              click: () => {
                mainWindow.webContents.send('menu-export-to-repository');
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Salir',
          accelerator: 'CmdOrCtrl+Q',
          role: 'quit'
        }
      ]
    },
    {
      label: 'Edición',
      submenu: [
        {
          label: 'Enlazar imagen',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            mainWindow.webContents.send('menu-link-image');
          }
        },
        {
          label: 'Eliminar fotografía vinculada',
          accelerator: 'CmdOrCtrl+Delete',
          click: () => {
            mainWindow.webContents.send('menu-delete-photo');
          }
        },
        { type: 'separator' },
        {
          label: 'Agregar etiqueta a imagen',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            mainWindow.webContents.send('menu-add-image-tag');
          }
        }
      ]
    },
      {
          label: 'Proyecto',
          submenu: [
              {
                  label: 'Actualizar archivo XML',
                  click: () => {
                      mainWindow.webContents.send('menu-update-xml');
                  }
              }
          ]
      },
    {
      label: 'Ver',
      submenu: [
        {
          label: 'Mostrar asignaciones duplicadas',
          type: 'checkbox',
          checked: showDuplicatesOnly,
          click: (menuItem) => {
            showDuplicatesOnly = menuItem.checked;
            mainWindow.webContents.send('menu-toggle-duplicates', showDuplicatesOnly);
          }
        },
        { type: 'separator' },
        {
          label: 'Mostrar fotografías capturadas',
          type: 'checkbox',
          checked: showCapturedPhotos,
          click: (menuItem) => {
            showCapturedPhotos = menuItem.checked;
            mainWindow.webContents.send('menu-toggle-captured-photos', showCapturedPhotos);
          }
        },
        {
          label: 'Mostrar fotografías del depósito',
          type: 'checkbox',
          checked: showRepositoryPhotos,
          click: (menuItem) => {
            showRepositoryPhotos = menuItem.checked;
            mainWindow.webContents.send('menu-toggle-repository-photos', showRepositoryPhotos);
          }
        },
        {
          label: 'Indicadores de foto en el depósito',
          type: 'checkbox',
          checked: showRepositoryIndicators,
          click: (menuItem) => {
            showRepositoryIndicators = menuItem.checked;
            mainWindow.webContents.send('menu-toggle-repository-indicators', showRepositoryIndicators);
          }
        },
        { type: 'separator' },
        {
          label: 'Cuadro de imágenes',
          accelerator: 'CmdOrCtrl+G',
          click: () => {
            openImageGridWindow();
          }
        },
        {
          label: 'Listado de imágenes con etiquetas',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => {
            mainWindow.webContents.send('menu-show-tagged-images');
          }
        }
      ]
    },
    {
      label: 'Cámara',
      submenu: [
        {
          label: cameraEnabled ? 'Desactivar cámara' : 'Activar cámara',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            cameraEnabled = !cameraEnabled;
            if (cameraEnabled) {
              openCameraWindow();
            } else {
              closeCameraWindow();
            }
            createMenu();
          }
        },
        {
          label: 'Mostrar ventana de cámara',
          accelerator: 'CmdOrCtrl+Shift+V',
          enabled: cameraEnabled,
          click: () => {
            if (cameraWindow) {
              cameraWindow.show();
              cameraWindow.focus();
            } else {
              openCameraWindow();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Seleccionar cámara',
          submenu: availableCameras.length > 0
            ? availableCameras.map(camera => ({
                label: camera.label,
                type: 'radio',
                checked: camera.deviceId === selectedCameraId,
                click: () => {
                  selectedCameraId = camera.deviceId;
                  if (cameraWindow) {
                    cameraWindow.webContents.send('change-camera', selectedCameraId);
                  }
                  createMenu();
                }
              }))
            : [{ label: 'No hay cámaras disponibles', enabled: false }]
        },
        { type: 'separator' },
        {
          label: 'Activar la cámara al iniciar',
          type: 'checkbox',
          checked: cameraAutoStart,
          click: (menuItem) => {
            cameraAutoStart = menuItem.checked;
            mainWindow.webContents.send('menu-camera-autostart', cameraAutoStart);
          }
        }
      ]
    },
    {
      label: 'Configuración',
      submenu: [
        {
          label: 'Depósito imágenes de usuario',
          click: async () => {
            const currentPath = getImageRepositoryPath();
            const result = await dialog.showOpenDialog(mainWindow, {
              title: 'Seleccionar carpeta del depósito de imágenes',
              defaultPath: currentPath || undefined,
              properties: ['openDirectory', 'createDirectory']
            });

            if (!result.canceled && result.filePaths.length > 0) {
              const selectedPath = result.filePaths[0];
              if (setImageRepositoryPath(selectedPath)) {
                dialog.showMessageBox(mainWindow, {
                  type: 'info',
                  title: 'Configuración guardada',
                  message: 'Depósito de imágenes configurado',
                  detail: `Ruta: ${selectedPath}`,
                  buttons: ['Aceptar']
                });
                logger.info(`Image repository path set to: ${selectedPath}`);
              } else {
                dialog.showErrorBox('Error', 'No se pudo guardar la configuración');
              }
            }
          }
        }
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Acerca de User Capture',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Acerca de User Capture',
              message: 'User Capture',
              detail: 'Versión 1.0.0\n\nAplicación de captura de imágenes de usuarios para entornos educativos.',
              buttons: ['Aceptar']
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Documentación',
          click: () => {
            // Open documentation
          }
        }
      ]
    }
  ];

  // Add View menu in development mode
  if (process.argv.includes('--dev')) {
    template.push({
      label: 'Developers',
      submenu: [
        { label: 'Recargar', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Forzar recarga', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: 'Herramientas de desarrollo', accelerator: 'CmdOrCtrl+Shift+I', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Zoom +', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom -', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Zoom normal', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'User Capture',
    icon: path.join(__dirname, 'assets/icons/icon.png'),
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

  mainWindow.on('closed', () => {
    if (cameraWindow) {
      cameraWindow.close();
    }
  });
}

function createCameraWindow() {
  cameraWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Vista de Cámara',
    icon: path.join(__dirname, 'assets/icons/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'src/preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#1a1f2e',
    show: false,
    autoHideMenuBar: true
  });

  cameraWindow.loadFile('src/renderer/camera.html');

  cameraWindow.once('ready-to-show', () => {
    cameraWindow.setMenuBarVisibility(false);
    cameraWindow.show();
  });

  cameraWindow.on('closed', () => {
    cameraWindow = null;
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    cameraWindow.webContents.openDevTools();
  }
}

function openCameraWindow() {
  if (!cameraWindow) {
    createCameraWindow();
  } else {
    cameraWindow.show();
    cameraWindow.focus();
  }
}

function closeCameraWindow() {
  if (cameraWindow) {
    cameraWindow.close();
    cameraWindow = null;
  }
}

function createImageGridWindow() {
  imageGridWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Cuadro de Imágenes',
    icon: path.join(__dirname, 'assets/icons/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'src/preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#1a1f2e',
    show: false,
    autoHideMenuBar: true
  });

  imageGridWindow.loadFile('src/renderer/image-grid.html');

  imageGridWindow.once('ready-to-show', () => {
    imageGridWindow.setMenuBarVisibility(false);
    imageGridWindow.show();
  });

  imageGridWindow.on('closed', () => {
    imageGridWindow = null;
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    imageGridWindow.webContents.openDevTools();
  }
}

function openImageGridWindow() {
  if (!dbManager) {
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Proyecto no abierto',
      message: 'Debes abrir o crear un proyecto primero',
      buttons: ['Aceptar']
    });
    return;
  }

  if (!imageGridWindow) {
    createImageGridWindow();
  } else {
    imageGridWindow.show();
    imageGridWindow.focus();
  }
}

app.whenReady().then(() => {
  loadRecentProjects();
  createMenu();
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
    const importReport = await dbManager.importUsers(users);
    logger.success('Users imported successfully');

    // Log import report summary
    logger.info('Import report summary', {
      imported: importReport.imported,
      withoutIdentifier: importReport.withoutIdentifier.length,
      withoutGroup: importReport.withoutGroup.length,
      duplicates: importReport.duplicates.length
    });

    // Generate detailed import report log if there are issues
    if (importReport.withoutIdentifier.length > 0 || importReport.withoutGroup.length > 0 || importReport.duplicates.length > 0) {
      const reportLogPath = path.join(folderPath, 'import-report.log');
      let reportContent = '='.repeat(80) + '\n';
      reportContent += 'INFORME DE IMPORTACIÓN DE USUARIOS\n';
      reportContent += '='.repeat(80) + '\n\n';
      reportContent += `Fecha: ${new Date().toLocaleString('es-ES')}\n`;
      reportContent += `Total de usuarios importados: ${importReport.imported}\n\n`;

      // Users without identifier
      if (importReport.withoutIdentifier.length > 0) {
        reportContent += '-'.repeat(80) + '\n';
        reportContent += `USUARIOS SIN IDENTIFICADOR (${importReport.withoutIdentifier.length})\n`;
        reportContent += '-'.repeat(80) + '\n';
        reportContent += 'Estos usuarios NO se han importado porque no tienen identificador válido.\n';
        reportContent += 'Los estudiantes requieren NIA y los docentes/no docentes requieren documento.\n\n';

        importReport.withoutIdentifier.forEach((user, index) => {
          reportContent += `${index + 1}. ${user.name}\n`;
          reportContent += `   Tipo: ${user.type}\n`;
          reportContent += `   Grupo: ${user.group}\n`;
          reportContent += `   Documento: ${user.document}\n`;
          reportContent += `   Razón: ${user.reason}\n\n`;
        });
      }

      // Users without group
      if (importReport.withoutGroup.length > 0) {
        reportContent += '-'.repeat(80) + '\n';
        reportContent += `USUARIOS SIN GRUPO (${importReport.withoutGroup.length})\n`;
        reportContent += '-'.repeat(80) + '\n';
        reportContent += 'Estos usuarios se han importado pero no tienen grupo asignado.\n\n';

        importReport.withoutGroup.forEach((user, index) => {
          reportContent += `${index + 1}. ${user.name}\n`;
          reportContent += `   Tipo: ${user.type}\n`;
          reportContent += `   Identificador: ${user.identifier}\n`;
          reportContent += `   Documento: ${user.document}\n`;
          if (user.note) {
            reportContent += `   Nota: ${user.note}\n`;
          }
          reportContent += '\n';
        });
      }

      // Duplicate users
      if (importReport.duplicates.length > 0) {
        reportContent += '-'.repeat(80) + '\n';
        reportContent += `USUARIOS DUPLICADOS (${importReport.duplicates.length})\n`;
        reportContent += '-'.repeat(80) + '\n';
        reportContent += 'Estos usuarios tienen el mismo identificador (NIA o documento).\n';
        reportContent += 'Se prioriza la importación del usuario que tiene grupo asignado.\n\n';

        importReport.duplicates.forEach((dup, index) => {
          reportContent += `${index + 1}. ${dup.identifier}\n`;
          reportContent += `   Tipo: ${dup.type}\n`;
          if (dup.allNames) {
            reportContent += `   Nombres encontrados: ${dup.allNames}\n`;
            if (dup.occurrencesCount) {
              reportContent += `   Ocurrencias: ${dup.occurrencesCount}\n`;
            }
          } else {
            reportContent += `   Primer usuario: ${dup.firstUser}\n`;
            if (dup.duplicateUser) {
              reportContent += `   Usuario duplicado: ${dup.duplicateUser}\n`;
            }
          }
          if (dup.allGroups) {
            reportContent += `   Grupos encontrados: ${dup.allGroups}\n`;
          }
          reportContent += `   Grupo importado: ${dup.group}\n`;
          if (dup.note) {
            reportContent += `   Nota: ${dup.note}\n`;
          }
          reportContent += '\n';
        });
      }

      reportContent += '='.repeat(80) + '\n';
      reportContent += 'FIN DEL INFORME\n';
      reportContent += '='.repeat(80) + '\n';

      fs.writeFileSync(reportLogPath, reportContent, 'utf8');
      logger.success(`Import report saved: ${reportLogPath}`);
    }

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
      // Invalidate image cache when new image is added
      imageManager.invalidateCache();
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

    // Add to recent projects
    addRecentProject(folderPath);

    // Update window title
    updateWindowTitle();

    // Show import report dialog if there are issues
    if (importReport.withoutIdentifier.length > 0 || importReport.withoutGroup.length > 0 || importReport.duplicates.length > 0) {
      let reportMessage = `Se han importado ${importReport.imported} usuarios correctamente.\n\n`;

      if (importReport.withoutIdentifier.length > 0) {
        reportMessage += `⚠ ${importReport.withoutIdentifier.length} usuarios sin identificador (NO importados)\n`;
      }
      if (importReport.withoutGroup.length > 0) {
        reportMessage += `⚠ ${importReport.withoutGroup.length} usuarios sin grupo\n`;
      }
      if (importReport.duplicates.length > 0) {
        reportMessage += `⚠ ${importReport.duplicates.length} usuarios duplicados (solo se importó el primero)\n`;
      }

      reportMessage += `\nConsulte el archivo 'import-report.log' en la carpeta del proyecto para más detalles.`;

      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Informe de Importación',
        message: 'Proyecto creado con advertencias',
        detail: reportMessage,
        buttons: ['Aceptar']
      });
    }

    return {
      success: true,
      message: 'Proyecto creado exitosamente',
      importReport: {
        imported: importReport.imported,
        withoutIdentifier: importReport.withoutIdentifier.length,
        withoutGroup: importReport.withoutGroup.length,
        duplicates: importReport.duplicates.length
      }
    };
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
      // Invalidate image cache when new image is added
      imageManager.invalidateCache();
      mainWindow.webContents.send('new-image-detected', filename);
    });
    folderWatcher.start();
    logger.success('Folder watcher started', { watchPath: ingestPath });

    logger.section('PROJECT OPENED SUCCESSFULLY');
    logger.success('Project loaded', { projectPath: folderPath });

    // Add to recent projects
    addRecentProject(folderPath);

    // Update window title
    updateWindowTitle();

    return { success: true, message: 'Proyecto abierto exitosamente' };
  } catch (error) {
    logger.error('Error opening project', error);
    return { success: false, error: error.message };
  }
});

// Update XML file
ipcMain.handle('update-xml', async (event, xmlPath) => {
  try {
    if (!dbManager) {
      throw new Error('No hay ningún proyecto abierto');
    }

    logger.section('UPDATING XML FILE');
    logger.info(`New XML file: ${xmlPath}`);

    // Validate XML path
    if (!fs.existsSync(xmlPath)) {
      throw new Error('El archivo XML no existe');
    }

    // Progress: 10%
    mainWindow.webContents.send('progress', {
      percentage: 10,
      message: 'Leyendo archivo XML...',
      details: xmlPath
    });

    // Parse new XML file
    const xmlParser = new XMLParser(xmlPath);
    const newData = await xmlParser.parse();

    const totalNewUsers = newData.students.length + newData.teachers.length + newData.nonTeachingStaff.length;
    logger.success('XML parsed successfully', {
      groups: newData.groups.length,
      students: newData.students.length,
      teachers: newData.teachers.length,
      nonTeachingStaff: newData.nonTeachingStaff.length,
      totalUsers: totalNewUsers
    });

    // Progress: 30%
    mainWindow.webContents.send('progress', {
      percentage: 30,
      message: 'Comparando usuarios actuales...',
      details: ''
    });

    // Get current users from database
    const currentUsers = await dbManager.getUsers({});
    logger.info(`Current users in database: ${currentUsers.length}`);

    // Prepare new users map by identifier (NIA for students, document for others)
    const newUsersMap = new Map();

    // Add students (identified by NIA)
    newData.students.forEach(student => {
      if (student.nia) {
        newUsersMap.set(`student_${student.nia}`, {
          type: 'student',
          identifier: student.nia,
          ...student
        });
      }
    });

    // Add teachers (identified by document)
    newData.teachers.forEach(teacher => {
      if (teacher.document) {
        newUsersMap.set(`teacher_${teacher.document}`, {
          type: 'teacher',
          identifier: teacher.document,
          ...teacher
        });
      }
    });

    // Add non-teaching staff (identified by document)
    newData.nonTeachingStaff.forEach(staff => {
      if (staff.document) {
        newUsersMap.set(`non_teaching_staff_${staff.document}`, {
          type: 'non_teaching_staff',
          identifier: staff.document,
          ...staff
        });
      }
    });

    // Compare and categorize changes
    const changes = {
      toAdd: [],
      toUpdate: [],
      toDelete: []
    };

    // Check for users to add or update
    for (const [key, newUser] of newUsersMap) {
      const existingUser = currentUsers.find(u => {
        if (u.type === 'student' && newUser.type === 'student') {
          // Use == instead of === to handle number vs string comparison
          return u.nia == newUser.nia;
        } else if (u.type !== 'student' && newUser.type !== 'student') {
          // Use == instead of === to handle number vs string comparison
          return u.document == newUser.document;
        }
        return false;
      });

      if (existingUser) {
        // User exists - always add to toUpdate (will be marked as updated or skipped in application phase)
        changes.toUpdate.push({
          id: existingUser.id,
          old: existingUser,
          new: newUser
        });
      } else {
        // New user
        changes.toAdd.push(newUser);
      }
    }

    // Check for users to delete (not in new XML)
    for (const currentUser of currentUsers) {
      const key = currentUser.type === 'student'
        ? `student_${currentUser.nia}`
        : `${currentUser.type}_${currentUser.document}`;

      if (!newUsersMap.has(key)) {
        changes.toDelete.push(currentUser);
      }
    }

    logger.info('Changes summary', {
      toAdd: changes.toAdd.length,
      toUpdate: changes.toUpdate.length,
      toDelete: changes.toDelete.length
    });

    // Progress: 50%
    mainWindow.webContents.send('progress', {
      percentage: 50,
      message: 'Análisis completado',
      details: `${changes.toAdd.length} nuevos, ${changes.toUpdate.length} actualizados, ${changes.toDelete.length} eliminados`
    });

    // Return summary for confirmation
    return {
      success: true,
      needsConfirmation: true,
      changes: {
        toAdd: changes.toAdd.length,
        toUpdate: changes.toUpdate.length,
        toDelete: changes.toDelete.length,
        toDeleteWithImage: changes.toDelete.filter(u => u.image_path).length,
        toDeleteWithoutImage: changes.toDelete.filter(u => !u.image_path).length
      },
      groups: newData.groups,
      newUsersMap: Array.from(newUsersMap.entries()),
      deletedUsers: changes.toDelete,
      currentUsers: currentUsers // Pass current users to avoid reloading
    };
  } catch (error) {
    logger.error('Error analyzing XML update', error);
    return { success: false, error: error.message };
  }
});

// Confirm and apply XML update
ipcMain.handle('confirm-update-xml', async (event, data) => {
  try {
    if (!dbManager) {
      throw new Error('No hay ningún proyecto abierto');
    }

    const { groups, newUsersMap, deletedUsers, currentUsers } = data;

    logger.section('APPLYING XML UPDATE');

    // Progress: 60%
    mainWindow.webContents.send('progress', {
      percentage: 60,
      message: 'Actualizando grupos...',
      details: ''
    });

    // Update groups
    logger.info('Updating groups...');
    await dbManager.importUsers({ groups, students: [], teachers: [], nonTeachingStaff: [] });
    logger.success(`Groups updated: ${groups.length}`);

    // Progress: 70%
    mainWindow.webContents.send('progress', {
      percentage: 70,
      message: 'Procesando usuarios eliminados...',
      details: ''
    });

    // Process deleted users
    const deletedGroup = await ensureDeletedGroup();
    let movedToDeleted = 0;
    let permanentlyDeleted = 0;

    for (const user of deletedUsers) {
      if (user.image_path) {
        // Move to Eliminados group
        await dbManager.updateUser(user.id, { group_code: deletedGroup.code });
        movedToDeleted++;
        logger.info(`Moved user ${user.first_name} ${user.last_name1} to Eliminados group`);
      } else {
        // Delete from database
        await dbManager.deleteUser(user.id);
        permanentlyDeleted++;
        logger.info(`Deleted user ${user.first_name} ${user.last_name1} from database`);
      }
    }

    logger.success(`Processed deleted users: ${movedToDeleted} moved to Eliminados, ${permanentlyDeleted} permanently deleted`);

    // Progress: 80%
    mainWindow.webContents.send('progress', {
      percentage: 80,
      message: 'Actualizando y agregando usuarios...',
      details: ''
    });

    // Process updates and additions
    // Note: We use the original currentUsers from the update-xml handler analysis
    logger.info(`Converting newUsersMap array to Map...`);
    const usersToProcess = new Map(newUsersMap);
    let updated = 0;
    let added = 0;
    let skipped = 0;

    logger.info(`Processing ${usersToProcess.size} users from XML`);
    logger.info(`Current users in database (from snapshot): ${currentUsers.length}`);

    for (const [key, newUser] of usersToProcess) {
      // Find if user existed in original database (before deletions)
      const existingUser = currentUsers.find(u => {
        if (newUser.type === 'student') {
          // Compare with type coercion (== instead of ===) to handle number vs string
          return u.type === 'student' && u.nia == newUser.nia;
        } else {
          // For teachers and non_teaching_staff, match by document and type
          return u.type === newUser.type && u.document == newUser.document;
        }
      });

      if (existingUser) {
        // Check if this user actually needs updating
        const needsUpdate =
          existingUser.first_name !== newUser.first_name ||
          existingUser.last_name1 !== newUser.last_name1 ||
          existingUser.last_name2 !== newUser.last_name2 ||
          existingUser.birth_date !== newUser.birth_date ||
          existingUser.document !== newUser.document ||
          existingUser.group_code !== newUser.group_code;

        if (needsUpdate) {
          // Determine final group_code based on user type
          let finalGroupCode;
          if (newUser.group_code && newUser.group_code !== '') {
            // User has a group in the XML
            finalGroupCode = newUser.group_code;
          } else {
            // No group in XML - assign default based on type
            if (newUser.type === 'student') {
              finalGroupCode = 'SIN_GRUPO';
            } else if (newUser.type === 'teacher') {
              finalGroupCode = 'DOCENTES';
            } else if (newUser.type === 'non_teaching_staff') {
              finalGroupCode = 'NO_DOCENTES';
            } else {
              finalGroupCode = 'SIN_GRUPO'; // Fallback
            }
          }

          // Update existing user (including those moved to Eliminados)
          await dbManager.updateUser(existingUser.id, {
            first_name: newUser.first_name,
            last_name1: newUser.last_name1,
            last_name2: newUser.last_name2,
            birth_date: newUser.birth_date,
            document: newUser.document,
            group_code: finalGroupCode,
            nia: newUser.nia
          });
          updated++;
          logger.info(`Updated user ${newUser.first_name} ${newUser.last_name1} (ID: ${existingUser.id})`);
        } else {
          // User exists but no changes needed
          skipped++;
        }
      } else {
        // This is a completely new user - add them
        logger.info(`Adding new user: ${newUser.first_name} ${newUser.last_name1} (type: ${newUser.type})`);

        // Add new user - convert to format expected by importUsers
        if (newUser.type === 'student') {
          await dbManager.importUsers({
            groups: [],
            students: [newUser],
            teachers: [],
            nonTeachingStaff: []
          });
        } else if (newUser.type === 'teacher') {
          await dbManager.importUsers({
            groups: [],
            students: [],
            teachers: [newUser],
            nonTeachingStaff: []
          });
        } else if (newUser.type === 'non_teaching_staff') {
          await dbManager.importUsers({
            groups: [],
            students: [],
            teachers: [],
            nonTeachingStaff: [newUser]
          });
        }
        added++;
        logger.info(`Added new user ${newUser.first_name} ${newUser.last_name1}`);
      }
    }

    logger.success(`Users processed: ${updated} updated, ${added} added, ${skipped} skipped (no changes)`);

    // Calculate total processed (updated + skipped)
    const totalProcessed = updated + skipped;

    // Progress: 100%
    mainWindow.webContents.send('progress', {
      percentage: 100,
      message: 'Actualización completada',
      details: `${added} añadidos, ${totalProcessed} actualizados, ${movedToDeleted} movidos a Eliminados, ${permanentlyDeleted} eliminados`
    });

    logger.section('XML UPDATE COMPLETED');
    logger.success('XML update completed successfully');

    return {
      success: true,
      results: {
        added,
        updated: totalProcessed,
        movedToDeleted,
        permanentlyDeleted
      }
    };
  } catch (error) {
    logger.error('Error applying XML update', error);
    return { success: false, error: error.message };
  }
});

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

// Get all users
ipcMain.handle('get-users', async (event, filters, options = {}) => {
  try {
    if (!dbManager) {
      throw new Error('No hay ningún proyecto abierto');
    }

    // Default options: load everything unless explicitly disabled
    const loadOptions = {
      loadCapturedImages: options.loadCapturedImages !== false,
      loadRepositoryImages: options.loadRepositoryImages !== false,
      ...options
    };

    // Map frontend filters to database filters
    const dbFilters = {};
    if (filters.search) {
      dbFilters.search = filters.search;
    }
    if (filters.group) {
      dbFilters.groupCode = filters.group;
    }
    if (filters.type) {
      dbFilters.type = filters.type;
    }

    const users = await dbManager.getUsers(dbFilters);

    // Only process captured images if needed
    if (loadOptions.loadCapturedImages) {
      const importsPath = path.join(projectPath, 'imports');
      users.forEach(user => {
        if (user.image_path) {
          // If it's a relative path (just filename), convert to absolute
          if (!path.isAbsolute(user.image_path)) {
            user.image_path = path.join(importsPath, user.image_path);
          }
        }
      });
    } else {
      // Clear image paths if not needed
      users.forEach(user => {
        user.image_path = null;
      });
    }

    // Only check repository images if needed (for photos or indicators)
    if (loadOptions.loadRepositoryImages) {
      const repositoryPath = getImageRepositoryPath();

      if (repositoryPath) {
        users.forEach(user => {
          // Check if image exists in repository
          user.has_repository_image = false;
          user.repository_image_path = null;

          // Determine the identifier (NIA for students, document for others)
          const identifier = user.type === 'student' ? user.nia : user.document;

          if (identifier) {
            // Check for .jpg and .jpeg extensions
            const jpgPath = path.join(repositoryPath, `${identifier}.jpg`);
            const jpegPath = path.join(repositoryPath, `${identifier}.jpeg`);

            if (fs.existsSync(jpgPath)) {
              user.has_repository_image = true;
              user.repository_image_path = jpgPath;
            } else if (fs.existsSync(jpegPath)) {
              user.has_repository_image = true;
              user.repository_image_path = jpegPath;
            }
          }
        });
      } else {
        users.forEach(user => {
          user.has_repository_image = false;
          user.repository_image_path = null;
        });
      }
    } else {
      // Clear repository image data if not needed
      users.forEach(user => {
        user.has_repository_image = false;
        user.repository_image_path = null;
      });
    }

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

    // Convert absolute path to relative path for storage
    const importsPath = path.join(projectPath, 'imports');
    const relativeImagePath = path.isAbsolute(imagePath)
      ? path.basename(imagePath)
      : imagePath;

    // Check if image is already assigned to other users
    const usersWithImage = await dbManager.getUsersByImagePath(relativeImagePath);
    if (usersWithImage.length > 0) {
      // Check if it's assigned to a different user
      const otherUsers = usersWithImage.filter(u => u.id !== userId);
      if (otherUsers.length > 0) {
        return {
          success: false,
          imageAlreadyAssigned: true,
          assignedUsers: otherUsers.map(u => ({
            id: u.id,
            name: `${u.first_name} ${u.last_name1} ${u.last_name2 || ''}`.trim(),
            nia: u.nia
          }))
        };
      }
    }

    // Check if user already has an image
    const user = await dbManager.getUserById(userId);
    if (user.image_path) {
      // Return confirmation needed (convert to absolute for frontend display)
      const absolutePath = path.isAbsolute(user.image_path)
        ? user.image_path
        : path.join(importsPath, user.image_path);
      return { success: false, needsConfirmation: true, currentImage: absolutePath };
    }

    await dbManager.linkImageToUser(userId, relativeImagePath);
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

    // Convert absolute path to relative path for storage
    const relativeImagePath = path.isAbsolute(imagePath)
      ? path.basename(imagePath)
      : imagePath;

    await dbManager.linkImageToUser(userId, relativeImagePath);
    return { success: true };
  } catch (error) {
    console.error('Error confirming link:', error);
    return { success: false, error: error.message };
  }
});

// Unlink image from user
ipcMain.handle('unlink-image-user', async (event, userId) => {
  try {
    if (!dbManager) {
      throw new Error('No hay ningún proyecto abierto');
    }

    await dbManager.unlinkImageFromUser(userId);
    return { success: true };
  } catch (error) {
    console.error('Error unlinking image:', error);
    return { success: false, error: error.message };
  }
});

// Move image to ingest folder
ipcMain.handle('move-image-to-ingest', async (event, sourceImagePath) => {
  try {
    if (!projectPath) {
      throw new Error('No hay ningún proyecto abierto');
    }

    const ingestPath = path.join(projectPath, 'ingest');
    const fileName = path.basename(sourceImagePath);
    let destPath = path.join(ingestPath, fileName);

    // Check if file already exists in ingest
    if (fs.existsSync(destPath)) {
      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const ext = path.extname(fileName);
      const name = path.basename(fileName, ext);
      destPath = path.join(ingestPath, `${name}_${timestamp}${ext}`);
    }

    // Copy file to ingest folder
    fs.copyFileSync(sourceImagePath, destPath);
    logger.info(`Image moved to ingest: ${fileName}`);

    return { success: true, filename: path.basename(destPath) };
  } catch (error) {
    console.error('Error moving image to ingest:', error);
    return { success: false, error: error.message };
  }
});

// Import images with ID
ipcMain.handle('import-images-with-id', async (event, folderPath) => {
  try {
    if (!projectPath || !dbManager) {
      throw new Error('No hay ningún proyecto abierto');
    }

    logger.section('IMPORTING IMAGES WITH ID');
    logger.info(`Import folder: ${folderPath}`);

    const importsPath = path.join(projectPath, 'imports');

    // Get all JPG files from the selected folder
    const files = fs.readdirSync(folderPath).filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === '.jpg' || ext === '.jpeg';
    });

    logger.info(`Found ${files.length} image files`);

    const results = {
      total: files.length,
      linked: 0,
      notFound: [],
      errors: []
    };

    // Process each image
    for (const file of files) {
      const fileName = path.basename(file, path.extname(file));
      const sourcePath = path.join(folderPath, file);

      try {
        // Get all users to search by NIA or document
        const allUsers = await dbManager.getUsers({});

        // Find user by NIA (students) or document (teachers/non-teaching staff)
        const user = allUsers.find(u => u.nia === fileName || u.document === fileName);

        if (user) {
          // Copy image to imports folder
          const destPath = path.join(importsPath, file);

          // If file exists, generate unique name
          let finalDestPath = destPath;
          if (fs.existsSync(destPath)) {
            const timestamp = Date.now();
            const ext = path.extname(file);
            const name = path.basename(file, ext);
            finalDestPath = path.join(importsPath, `${name}_${timestamp}${ext}`);
          }

          fs.copyFileSync(sourcePath, finalDestPath);

          // Link image to user
          const relativeImagePath = path.basename(finalDestPath);
          await dbManager.linkImageToUser(user.id, relativeImagePath);

          results.linked++;
          logger.info(`Linked ${file} to user ${user.first_name} ${user.last_name1} (ID: ${fileName})`);
        } else {
          results.notFound.push(fileName);
          logger.warning(`User not found for ID: ${fileName}`);
        }
      } catch (error) {
        results.errors.push({ file: fileName, error: error.message });
        logger.error(`Error processing ${file}`, error);
      }
    }

    logger.section('IMPORT COMPLETED');
    logger.success(`Linked: ${results.linked}/${results.total}`);
    if (results.notFound.length > 0) {
      logger.warning(`Not found: ${results.notFound.length} users`);
    }
    if (results.errors.length > 0) {
      logger.error(`Errors: ${results.errors.length} files`);
    }

    return { success: true, results };
  } catch (error) {
    logger.error('Error importing images with ID', error);
    return { success: false, error: error.message };
  }
});

// Export CSV
ipcMain.handle('export-csv', async (event, folderPath, users) => {
  try {
    if (!dbManager) {
      throw new Error('No hay ningún proyecto abierto');
    }

    // Use provided users or get all users if not provided
    if (!users || users.length === 0) {
      users = await dbManager.getUsers({});
    }

    // Get repository path
    const repositoryPath = getImageRepositoryPath();

    // Filter users to only include those with images in the repository
    const usersWithRepositoryImages = users.filter(user => {
      if (!repositoryPath) return false;

      // Determine the identifier (NIA for students, document for others)
      const identifier = user.type === 'student' ? user.nia : user.document;

      if (!identifier) return false;

      // Check for .jpg and .jpeg extensions
      const jpgPath = path.join(repositoryPath, `${identifier}.jpg`);
      const jpegPath = path.join(repositoryPath, `${identifier}.jpeg`);

      return fs.existsSync(jpgPath) || fs.existsSync(jpegPath);
    });

    // Log the filtering
    logger.info(`CSV Export: Total users: ${users.length}, Users with repository images: ${usersWithRepositoryImages.length}`);

    // Use the filtered list for export
    users = usersWithRepositoryImages;

    // Helper function to calculate age
    const calculateAge = (birthDate) => {
      if (!birthDate) return 0;

      const today = new Date();
      let birth;

      // Parse the birth date - handle multiple formats
      if (typeof birthDate === 'string') {
        // Check if it's DD/MM/YYYY format
        if (birthDate.includes('/')) {
          const [day, month, year] = birthDate.split('/').map(Number);
          birth = new Date(year, month - 1, day); // month is 0-indexed
        }
        // Check if it's YYYY-MM-DD format (with or without time)
        else if (birthDate.includes('-')) {
          const [year, month, day] = birthDate.split(' ')[0].split('-').map(Number);
          birth = new Date(year, month - 1, day); // month is 0-indexed
        }
        else {
          birth = new Date(birthDate);
        }
      } else {
        birth = new Date(birthDate);
      }

      // Check for invalid date
      if (isNaN(birth.getTime())) {
        logger.warning(`Invalid birth date format: ${birthDate}`);
        return 0;
      }

      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }

      return age;
    };

    // Create CSV content with exact field order from claude.md
    const csvHeader = 'id,password,userlevel,nombre,apellido1,apellido2,apellidos,centro,foto,grupo,direccion,telefono,departamento,DNI,edad,fechaNacimiento,nombreApellidos\n';
    const csvRows = users.map(user => {
      const isStudent = user.type === 'student';
      const nombre = user.first_name || '';
      const apellido1 = user.last_name1 || '';
      const apellido2 = user.last_name2 || '';
      const apellidos = `${apellido1} ${apellido2}`.trim();
      const documento = user.document || '';
      const nia = user.nia || '';
      const fechaNacimiento = user.birth_date || '';
      const nombreApellidos = `${nombre} ${apellido1} ${apellido2}`.trim();

      // id and password: NIA for students, DNI for others
      const id = isStudent ? nia : documento;
      const password = isStudent ? nia : documento;

      // userlevel: Alumno for students, Profesor for others
      const userlevel = isStudent ? 'Alumno' : 'Profesor';

      // foto: NIA.jpg for students, DNI.jpg for others
      const foto = isStudent ? `${nia}.jpg` : `${documento}.jpg`;

      // edad: mayor.jpg/menor.jpg for students (18+ or not), profesor.jpg for others
      let edad;
      if (isStudent) {
        const age = calculateAge(fechaNacimiento);
        edad = age >= 18 ? 'mayor.jpg' : 'menor.jpg';

        // Log age calculation for debugging
        logger.info(`Age calculation for ${nombre} ${apellido1}: birthDate=${fechaNacimiento}, calculatedAge=${age}, result=${edad}`);
      } else {
        edad = 'profesor.jpg';
      }

      // Fields to leave empty: centro, grupo, direccion, telefono, departamento
      const centro = '';
      const grupo = '';
      const direccion = '';
      const telefono = '';
      const departamento = '';
      const DNI = documento;

      return `"${id}","${password}","${userlevel}","${nombre}","${apellido1}","${apellido2}","${apellidos}","${centro}","${foto}","${grupo}","${direccion}","${telefono}","${departamento}","${DNI}","${edad}","${fechaNacimiento}","${nombreApellidos}"`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Fixed filename: carnets.csv
    const filename = 'carnets.csv';
    const filePath = path.join(folderPath, filename);

    // Write file
    fs.writeFileSync(filePath, csvContent, 'utf8');

    // Calculate statistics for user feedback
    const totalUsers = usersWithRepositoryImages.length + (users.length - usersWithRepositoryImages.length);
    const ignoredUsers = totalUsers - usersWithRepositoryImages.length;

    return {
      success: true,
      filename,
      exported: usersWithRepositoryImages.length,
      ignored: ignoredUsers
    };
  } catch (error) {
    console.error('Error exporting CSV:', error);
    return { success: false, error: error.message };
  }
});

// Export images
ipcMain.handle('export-images', async (event, folderPath, users, options) => {
  try {
    if (!dbManager || !projectPath) {
      throw new Error('No hay ningún proyecto abierto');
    }

    // Default options
    const exportOptions = {
      copyOriginal: options?.copyOriginal ?? true,
      resizeEnabled: options?.resizeEnabled ?? false,
      boxSize: options?.boxSize ?? 800,
      maxSizeKB: options?.maxSizeKB ?? 500
    };

    logger.section('EXPORTING IMAGES');
    logger.info(`Export folder: ${folderPath}`);
    logger.info(`Export options:`, exportOptions);

    const importsPath = path.join(projectPath, 'imports');

    // Use provided users or get all users if not provided
    if (!users || users.length === 0) {
      users = await dbManager.getUsers({});
    }

    // Filter only users with images
    const usersWithImages = users.filter(user => user.image_path);

    logger.info(`Found ${usersWithImages.length} users with images`);

    // Group users by group_code
    const usersByGroup = {};
    for (const user of usersWithImages) {
      if (!user.group_code) {
        logger.warning(`User ${user.first_name} ${user.last_name1} has no group_code`);
        continue;
      }
      if (!usersByGroup[user.group_code]) {
        usersByGroup[user.group_code] = [];
      }
      usersByGroup[user.group_code].push(user);
    }

    const results = {
      total: usersWithImages.length,
      exported: 0,
      errors: [],
      groupsFolders: Object.keys(usersByGroup).length
    };

    logger.info(`Exporting images for ${results.groupsFolders} groups`);

    // Track progress
    let processedCount = 0;

    // Export each group
    for (const [groupCode, groupUsers] of Object.entries(usersByGroup)) {
      try {
        // Create group folder
        const groupFolderPath = path.join(folderPath, groupCode);
        if (!fs.existsSync(groupFolderPath)) {
          fs.mkdirSync(groupFolderPath, { recursive: true });
          logger.info(`Created folder for group: ${groupCode}`);
        }

        // Export each user's image in this group
        for (const user of groupUsers) {
          try {
            // Determine the ID to use for filename: NIA for students, document for others
            const isStudent = user.type === 'student';
            const userId = isStudent ? user.nia : user.document;

            if (!userId) {
              results.errors.push({
                user: `${user.first_name} ${user.last_name1}`,
                error: 'Usuario sin identificador (NIA/DNI)'
              });
              processedCount++;
              continue;
            }

            // Get source image path (relative path in DB)
            const sourceImagePath = path.isAbsolute(user.image_path)
              ? user.image_path
              : path.join(importsPath, user.image_path);

            // Check if source image exists
            if (!fs.existsSync(sourceImagePath)) {
              results.errors.push({
                user: `${user.first_name} ${user.last_name1}`,
                error: 'Imagen no encontrada'
              });
              processedCount++;
              continue;
            }

            // Create destination filename with user ID in group folder
            const ext = path.extname(sourceImagePath);
            const destFileName = `${userId}${ext}`;
            const destPath = path.join(groupFolderPath, destFileName);

            // Process image based on options
            if (exportOptions.copyOriginal && !exportOptions.resizeEnabled) {
              // Copy original but correct orientation using sharp
              await sharp(sourceImagePath)
                .rotate() // Auto-rotate based on EXIF orientation
                .toFile(destPath);
            } else if (exportOptions.resizeEnabled) {
              // Use sharp to process the image
              let sharpInstance = sharp(sourceImagePath)
                .rotate(); // Auto-rotate based on EXIF orientation

              // Get image metadata (after rotation)
              const metadata = await sharpInstance.metadata();

              // Resize if image is larger than boxSize
              if (metadata.width > exportOptions.boxSize || metadata.height > exportOptions.boxSize) {
                sharpInstance = sharpInstance.resize(exportOptions.boxSize, exportOptions.boxSize, {
                  fit: 'inside',
                  withoutEnlargement: true
                });
              }

              // Convert to JPEG and apply quality compression
              // Start with quality 90 and reduce if needed
              let quality = 90;
              let outputBuffer;
              const maxSizeBytes = exportOptions.maxSizeKB * 1024;

              // Try to compress to target size
              do {
                outputBuffer = await sharpInstance
                  .jpeg({ quality })
                  .toBuffer();

                if (outputBuffer.length <= maxSizeBytes || quality <= 60) {
                  break;
                }

                // Reduce quality and retry
                quality -= 10;
                sharpInstance = sharp(sourceImagePath)
                  .rotate(); // Auto-rotate based on EXIF orientation
                if (metadata.width > exportOptions.boxSize || metadata.height > exportOptions.boxSize) {
                  sharpInstance = sharpInstance.resize(exportOptions.boxSize, exportOptions.boxSize, {
                    fit: 'inside',
                    withoutEnlargement: true
                  });
                }
              } while (quality > 0);

              // Write the processed image
              fs.writeFileSync(destPath, outputBuffer);

              logger.info(`Processed image: quality=${quality}, size=${Math.round(outputBuffer.length/1024)}KB`);
            }

            results.exported++;
            processedCount++;
            logger.info(`Exported image for user ${user.first_name} ${user.last_name1} as ${groupCode}/${destFileName}`);

            // Send progress update
            const percentage = Math.round((processedCount / results.total) * 100);
            mainWindow.webContents.send('progress', {
              percentage,
              message: 'Exportando imágenes...',
              details: `${processedCount} de ${results.total} imágenes procesadas`
            });
          } catch (error) {
            results.errors.push({
              user: `${user.first_name} ${user.last_name1}`,
              error: error.message
            });
            processedCount++;
            logger.error(`Error exporting image for user ${user.first_name} ${user.last_name1}`, error);
          }
        }
      } catch (error) {
        logger.error(`Error creating folder for group ${groupCode}`, error);
        // Add all users in this group to errors
        groupUsers.forEach(user => {
          results.errors.push({
            user: `${user.first_name} ${user.last_name1}`,
            error: `Error al crear carpeta del grupo: ${error.message}`
          });
          processedCount++;
        });
      }
    }

    logger.section('EXPORT COMPLETED');
    logger.success(`Exported: ${results.exported}/${results.total} images in ${results.groupsFolders} group folders`);
    if (results.errors.length > 0) {
      logger.error(`Errors: ${results.errors.length} images`);
    }

    return { success: true, results };
  } catch (error) {
    logger.error('Error exporting images', error);
    return { success: false, error: error.message };
  }
});

// Export images to repository
ipcMain.handle('export-to-repository', async (event, users, options) => {
  try {
    if (!dbManager || !projectPath) {
      throw new Error('No hay ningún proyecto abierto');
    }

    // Get repository path
    const repositoryPath = getImageRepositoryPath();
    if (!repositoryPath) {
      return { success: false, error: 'No se ha configurado el depósito de imágenes. Por favor, configúralo en Configuración > Depósito imágenes de usuario' };
    }

    // Check if repository path exists
    if (!fs.existsSync(repositoryPath)) {
      return { success: false, error: `La carpeta del depósito no existe: ${repositoryPath}` };
    }

    // Default options
    const exportOptions = {
      copyOriginal: options?.copyOriginal ?? true,
      resizeEnabled: options?.resizeEnabled ?? false,
      boxSize: options?.boxSize ?? 800,
      maxSizeKB: options?.maxSizeKB ?? 500
    };

    logger.section('EXPORTING IMAGES TO REPOSITORY');
    logger.info(`Repository path: ${repositoryPath}`);
    logger.info(`Export options:`, exportOptions);

    const importsPath = path.join(projectPath, 'imports');

    // Use provided users or get all users if not provided
    if (!users || users.length === 0) {
      users = await dbManager.getUsers({});
    }

    // Filter only users with images
    const usersWithImages = users.filter(user => user.image_path);

    logger.info(`Found ${usersWithImages.length} users with images`);

    const results = {
      total: usersWithImages.length,
      exported: 0,
      errors: []
    };

    // Track progress
    let processedCount = 0;

    // Export each user's image
    for (const user of usersWithImages) {
      try {
        // Determine the ID to use for filename: NIA for students, document for others
        const isStudent = user.type === 'student';
        const userId = isStudent ? user.nia : user.document;

        if (!userId) {
          results.errors.push({
            user: `${user.first_name} ${user.last_name1}`,
            error: 'Usuario sin identificador (NIA/DNI)'
          });
          processedCount++;
          continue;
        }

        // Get source image path (relative path in DB)
        const sourceImagePath = path.isAbsolute(user.image_path)
          ? user.image_path
          : path.join(importsPath, user.image_path);

        // Check if source image exists
        if (!fs.existsSync(sourceImagePath)) {
          results.errors.push({
            user: `${user.first_name} ${user.last_name1}`,
            error: 'Imagen no encontrada'
          });
          processedCount++;
          continue;
        }

        // Create destination filename with user ID in repository
        const destFileName = `${userId}.jpg`;
        const destPath = path.join(repositoryPath, destFileName);

        // Process image based on options
        if (exportOptions.copyOriginal && !exportOptions.resizeEnabled) {
          // Copy original but correct orientation using sharp
          await sharp(sourceImagePath)
            .rotate() // Auto-rotate based on EXIF orientation
            .toFile(destPath);
        } else if (exportOptions.resizeEnabled) {
          // Use sharp to process the image
          let sharpInstance = sharp(sourceImagePath)
            .rotate(); // Auto-rotate based on EXIF orientation

          // Get image metadata (after rotation)
          const metadata = await sharpInstance.metadata();

          // Resize if image is larger than boxSize
          if (metadata.width > exportOptions.boxSize || metadata.height > exportOptions.boxSize) {
            sharpInstance = sharpInstance.resize(exportOptions.boxSize, exportOptions.boxSize, {
              fit: 'inside',
              withoutEnlargement: true
            });
          }

          // Convert to JPEG and apply quality compression
          // Start with quality 90 and reduce if needed
          let quality = 90;
          let outputBuffer;
          const maxSizeBytes = exportOptions.maxSizeKB * 1024;

          // Try to compress to target size
          do {
            outputBuffer = await sharpInstance
              .jpeg({ quality })
              .toBuffer();

            if (outputBuffer.length <= maxSizeBytes || quality <= 60) {
              break;
            }

            // Reduce quality and retry
            quality -= 10;
            sharpInstance = sharp(sourceImagePath)
              .rotate(); // Auto-rotate based on EXIF orientation
            if (metadata.width > exportOptions.boxSize || metadata.height > exportOptions.boxSize) {
              sharpInstance = sharpInstance.resize(exportOptions.boxSize, exportOptions.boxSize, {
                fit: 'inside',
                withoutEnlargement: true
              });
            }
          } while (quality > 0);

          // Write the processed image
          fs.writeFileSync(destPath, outputBuffer);

          logger.info(`Processed image: quality=${quality}, size=${Math.round(outputBuffer.length/1024)}KB`);
        }

        results.exported++;
        processedCount++;
        logger.info(`Exported image for user ${user.first_name} ${user.last_name1} as ${destFileName}`);

        // Send progress update
        const percentage = Math.round((processedCount / results.total) * 100);
        mainWindow.webContents.send('progress', {
          percentage,
          message: 'Exportando imágenes al depósito...',
          details: `${processedCount} de ${results.total} imágenes procesadas`
        });
      } catch (error) {
        results.errors.push({
          user: `${user.first_name} ${user.last_name1}`,
          error: error.message
        });
        processedCount++;
        logger.error(`Error exporting image for user ${user.first_name} ${user.last_name1}`, error);
      }
    }

    logger.section('EXPORT TO REPOSITORY COMPLETED');
    logger.success(`Exported: ${results.exported}/${results.total} images to repository`);
    if (results.errors.length > 0) {
      logger.error(`Errors: ${results.errors.length} images`);
    }

    return { success: true, results };
  } catch (error) {
    logger.error('Error exporting images to repository', error);
    return { success: false, error: error.message };
  }
});

// Export images with name format (Apellido1 Apellido2, Nombre)
ipcMain.handle('export-images-name', async (event, folderPath, users, options) => {
  try {
    if (!dbManager || !projectPath) {
      throw new Error('No hay ningún proyecto abierto');
    }

    // Default options
    const exportOptions = {
      copyOriginal: options?.copyOriginal ?? true,
      resizeEnabled: options?.resizeEnabled ?? false,
      boxSize: options?.boxSize ?? 800,
      maxSizeKB: options?.maxSizeKB ?? 500
    };

    logger.section('EXPORTING IMAGES BY NAME');
    logger.info(`Export folder: ${folderPath}`);
    logger.info(`Export options:`, exportOptions);

    const importsPath = path.join(projectPath, 'imports');

    // Use provided users or get all users if not provided
    if (!users || users.length === 0) {
      users = await dbManager.getUsers({});
    }

    // Filter only users with images
    const usersWithImages = users.filter(user => user.image_path);

    logger.info(`Found ${usersWithImages.length} users with images`);

    // Group users by group_code
    const usersByGroup = {};
    for (const user of usersWithImages) {
      if (!user.group_code) {
        logger.warning(`User ${user.first_name} ${user.last_name1} has no group_code`);
        continue;
      }
      if (!usersByGroup[user.group_code]) {
        usersByGroup[user.group_code] = [];
      }
      usersByGroup[user.group_code].push(user);
    }

    const results = {
      total: usersWithImages.length,
      exported: 0,
      errors: [],
      groupsFolders: Object.keys(usersByGroup).length
    };

    logger.info(`Exporting images for ${results.groupsFolders} groups`);

    // Track progress
    let processedCount = 0;

    // Export each group
    for (const [groupCode, groupUsers] of Object.entries(usersByGroup)) {
      try {
        // Create group folder
        const groupFolderPath = path.join(folderPath, groupCode);
        if (!fs.existsSync(groupFolderPath)) {
          fs.mkdirSync(groupFolderPath, { recursive: true });
          logger.info(`Created folder for group: ${groupCode}`);
        }

        // Export each user's image in this group
        for (const user of groupUsers) {
          try {
            // Format name as "Apellido1 Apellido2, Nombre"
            const apellido1 = capitalizeWords(user.last_name1 || '');
            const apellido2 = capitalizeWords(user.last_name2 || '');
            const nombre = capitalizeWords(user.first_name || '');

            let apellidos = apellido1;
            if (apellido2) {
              apellidos += ` ${apellido2}`;
            }

            const fullName = `${apellidos}, ${nombre}`;

            if (!fullName.trim() || fullName.trim() === ',') {
              results.errors.push({
                user: `${user.first_name} ${user.last_name1}`,
                error: 'Usuario sin nombre completo'
              });
              processedCount++;
              continue;
            }

            // Get source image path (relative path in DB)
            const sourceImagePath = path.isAbsolute(user.image_path)
              ? user.image_path
              : path.join(importsPath, user.image_path);

            // Check if source image exists
            if (!fs.existsSync(sourceImagePath)) {
              results.errors.push({
                user: `${user.first_name} ${user.last_name1}`,
                error: 'Imagen no encontrada'
              });
              processedCount++;
              continue;
            }

            // Create destination filename with full name in group folder
            const ext = path.extname(sourceImagePath);
            const destFileName = `${fullName}${ext}`;
            const destPath = path.join(groupFolderPath, destFileName);

            // Process image based on options
            if (exportOptions.copyOriginal && !exportOptions.resizeEnabled) {
              // Copy original but correct orientation using sharp
              await sharp(sourceImagePath)
                .rotate() // Auto-rotate based on EXIF orientation
                .toFile(destPath);
            } else if (exportOptions.resizeEnabled) {
              // Use sharp to process the image
              let sharpInstance = sharp(sourceImagePath)
                .rotate(); // Auto-rotate based on EXIF orientation

              // Get image metadata (after rotation)
              const metadata = await sharpInstance.metadata();

              // Resize if image is larger than boxSize
              if (metadata.width > exportOptions.boxSize || metadata.height > exportOptions.boxSize) {
                sharpInstance = sharpInstance.resize(exportOptions.boxSize, exportOptions.boxSize, {
                  fit: 'inside',
                  withoutEnlargement: true
                });
              }

              // Convert to JPEG and apply quality compression
              // Start with quality 90 and reduce if needed
              let quality = 90;
              let outputBuffer;
              const maxSizeBytes = exportOptions.maxSizeKB * 1024;

              // Try to compress to target size
              do {
                outputBuffer = await sharpInstance
                  .jpeg({ quality })
                  .toBuffer();

                if (outputBuffer.length <= maxSizeBytes || quality <= 60) {
                  break;
                }

                // Reduce quality and retry
                quality -= 10;
                sharpInstance = sharp(sourceImagePath)
                  .rotate(); // Auto-rotate based on EXIF orientation
                if (metadata.width > exportOptions.boxSize || metadata.height > exportOptions.boxSize) {
                  sharpInstance = sharpInstance.resize(exportOptions.boxSize, exportOptions.boxSize, {
                    fit: 'inside',
                    withoutEnlargement: true
                  });
                }
              } while (quality > 0);

              // Write the processed image
              fs.writeFileSync(destPath, outputBuffer);

              logger.info(`Processed image: quality=${quality}, size=${Math.round(outputBuffer.length/1024)}KB`);
            }

            results.exported++;
            processedCount++;
            logger.info(`Exported image for user ${user.first_name} ${user.last_name1} as ${groupCode}/${destFileName}`);

            // Send progress update
            const percentage = Math.round((processedCount / results.total) * 100);
            mainWindow.webContents.send('progress', {
              percentage,
              message: 'Exportando imágenes...',
              details: `${processedCount} de ${results.total} imágenes procesadas`
            });
          } catch (error) {
            results.errors.push({
              user: `${user.first_name} ${user.last_name1}`,
              error: error.message
            });
            processedCount++;
            logger.error(`Error exporting image for user ${user.first_name} ${user.last_name1}`, error);
          }
        }
      } catch (error) {
        logger.error(`Error creating folder for group ${groupCode}`, error);
        // Add all users in this group to errors
        groupUsers.forEach(user => {
          results.errors.push({
            user: `${user.first_name} ${user.last_name1}`,
            error: `Error al crear carpeta del grupo: ${error.message}`
          });
          processedCount++;
        });
      }
    }

    logger.section('EXPORT COMPLETED');
    logger.success(`Exported: ${results.exported}/${results.total} images in ${results.groupsFolders} group folders`);
    if (results.errors.length > 0) {
      logger.error(`Errors: ${results.errors.length} images`);
    }

    return { success: true, results };
  } catch (error) {
    logger.error('Error exporting images by name', error);
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

// Focus window handler
ipcMain.handle('focus-window', async () => {
  if (mainWindow) {
    mainWindow.focus();
  }
  return { success: true };
});

// Camera handlers
ipcMain.handle('update-available-cameras', async (event, cameras) => {
  availableCameras = cameras;
  // If no camera is selected yet, select the first one
  if (!selectedCameraId && cameras.length > 0) {
    selectedCameraId = cameras[0].deviceId;
  }
  createMenu();
  return { success: true, selectedCameraId };
});

ipcMain.handle('get-selected-camera', async () => {
  return { success: true, selectedCameraId };
});

// Global configuration handlers
ipcMain.handle('get-image-repository-path', async () => {
  try {
    const repositoryPath = getImageRepositoryPath();
    return { success: true, path: repositoryPath };
  } catch (error) {
    console.error('Error getting image repository path:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-image-repository-path', async (event, repositoryPath) => {
  try {
    if (setImageRepositoryPath(repositoryPath)) {
      return { success: true };
    } else {
      return { success: false, error: 'No se pudo guardar la configuración' };
    }
  } catch (error) {
    console.error('Error setting image repository path:', error);
    return { success: false, error: error.message };
  }
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

// Helper function to capitalize first letter of each word
function capitalizeWords(str) {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

// Helper function to update window title with project name
function updateWindowTitle() {
  if (projectPath) {
    const projectName = path.basename(projectPath);
    mainWindow.setTitle(`User Capture - ${projectName}`);
  } else {
    mainWindow.setTitle('User Capture');
  }
}

// Global configuration management
function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function loadGlobalConfig() {
  try {
    const filePath = getConfigPath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading global config:', error);
  }
  return {};
}

function saveGlobalConfig(config) {
  try {
    const filePath = getConfigPath();
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving global config:', error);
    return false;
  }
}

function getImageRepositoryPath() {
  const config = loadGlobalConfig();
  return config.imageRepositoryPath || null;
}

function setImageRepositoryPath(repositoryPath) {
  const config = loadGlobalConfig();
  config.imageRepositoryPath = repositoryPath;
  return saveGlobalConfig(config);
}

// Recent projects management
function getRecentProjectsPath() {
  return path.join(app.getPath('userData'), 'recent-projects.json');
}

function loadRecentProjects() {
  try {
    const filePath = getRecentProjectsPath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      recentProjects = JSON.parse(data);

      // Validate that projects still exist
      recentProjects = recentProjects.filter(projectPath => {
        return fs.existsSync(projectPath) && fs.existsSync(path.join(projectPath, 'data', 'users.db'));
      });
    }
  } catch (error) {
    console.error('Error loading recent projects:', error);
    recentProjects = [];
  }
}

function saveRecentProjects() {
  try {
    const filePath = getRecentProjectsPath();
    fs.writeFileSync(filePath, JSON.stringify(recentProjects, null, 2));
  } catch (error) {
    console.error('Error saving recent projects:', error);
  }
}

function addRecentProject(projectPath) {
  // Remove if already exists
  recentProjects = recentProjects.filter(p => p !== projectPath);

  // Add to beginning
  recentProjects.unshift(projectPath);

  // Keep only last 5
  recentProjects = recentProjects.slice(0, 5);

  saveRecentProjects();
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
    folderWatcher.on('image-added', (filename) => {
      logger.info(`New image detected: ${filename}`);
      // Invalidate image cache when new image is added
      imageManager.invalidateCache();
      mainWindow.webContents.send('new-image-detected', filename);
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
    mainWindow.webContents.send('project-opened', { success: true });
  } catch (error) {
    logger.error('Error opening recent project', error);
    dialog.showErrorBox('Error', 'Error al abrir el proyecto: ' + error.message);
  }
}

// Image tags handlers
ipcMain.handle('add-image-tag', async (event, data) => {
  try {
    if (!dbManager) {
      throw new Error('No hay ningún proyecto abierto');
    }

    const { imagePath, tag } = data;

    // Convert absolute path to relative path for storage
    const relativeImagePath = path.isAbsolute(imagePath)
      ? path.basename(imagePath)
      : imagePath;

    await dbManager.addImageTag(relativeImagePath, tag);
    logger.info(`Tag added to image: ${relativeImagePath} - "${tag}"`);

    return { success: true };
  } catch (error) {
    console.error('Error adding image tag:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-image-tags', async (event, imagePath) => {
  try {
    if (!dbManager) {
      throw new Error('No hay ningún proyecto abierto');
    }

    // Convert absolute path to relative path for storage
    const relativeImagePath = path.isAbsolute(imagePath)
      ? path.basename(imagePath)
      : imagePath;

    const tags = await dbManager.getImageTags(relativeImagePath);
    return { success: true, tags };
  } catch (error) {
    console.error('Error getting image tags:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-image-tag', async (event, tagId) => {
  try {
    if (!dbManager) {
      throw new Error('No hay ningún proyecto abierto');
    }

    await dbManager.deleteImageTag(tagId);
    logger.info(`Tag deleted: ${tagId}`);

    return { success: true };
  } catch (error) {
    console.error('Error deleting image tag:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-all-images-with-tags', async () => {
  try {
    if (!dbManager) {
      throw new Error('No hay ningún proyecto abierto');
    }

    const imagesWithTags = await dbManager.getAllImagesWithTags();

    // Convert relative paths to absolute paths and get tags for each image
    const importsPath = path.join(projectPath, 'imports');
    const imagesData = await Promise.all(
      imagesWithTags.map(async (row) => {
        const absolutePath = path.isAbsolute(row.image_path)
          ? row.image_path
          : path.join(importsPath, row.image_path);

        const tags = await dbManager.getImageTags(row.image_path);

        return {
          path: absolutePath,
          relativePath: row.image_path,
          tags: tags
        };
      })
    );

    return { success: true, images: imagesData };
  } catch (error) {
    console.error('Error getting images with tags:', error);
    return { success: false, error: error.message };
  }
});
