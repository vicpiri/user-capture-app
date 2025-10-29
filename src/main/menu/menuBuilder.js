const { Menu, dialog } = require('electron');
const path = require('path');

/**
 * MenuBuilder - Responsible for creating and managing the application menu
 */
class MenuBuilder {
  constructor(context) {
    // Windows
    this.mainWindow = context.mainWindow;
    this.cameraWindow = context.cameraWindow;

    // State
    this.cameraEnabled = context.cameraEnabled;
    this.cameraAutoStart = context.cameraAutoStart;
    this.selectedCameraId = context.selectedCameraId;
    this.availableCameras = context.availableCameras;
    this.showDuplicatesOnly = context.showDuplicatesOnly;
    this.showCardPrintRequestsOnly = context.showCardPrintRequestsOnly;
    this.showCapturedPhotos = context.showCapturedPhotos;
    this.showRepositoryPhotos = context.showRepositoryPhotos;
    this.showRepositoryIndicators = context.showRepositoryIndicators;
    this.showAdditionalActions = context.showAdditionalActions;
    this.recentProjects = context.recentProjects;

    // Functions/callbacks
    this.callbacks = context.callbacks;

    // Logger
    this.logger = context.logger;
  }

  /**
   * Build and set the application menu
   */
  build() {
    const template = [
      this.buildFileMenu(),
      this.buildEditMenu(),
      this.buildProjectMenu(),
      this.buildCameraMenu(),
      this.buildViewMenu(),
      this.buildHelpMenu()
    ];

    // Add Developer menu in development mode
    if (process.argv.includes('--dev')) {
      template.push(this.buildDeveloperMenu());
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  /**
   * Build File menu
   */
  buildFileMenu() {
    // Build recent projects submenu
    const recentProjectsSubmenu = this.recentProjects.length > 0
      ? this.recentProjects.map((projectPath, index) => ({
          label: path.basename(projectPath),
          accelerator: index < 9 ? `CmdOrCtrl+${index + 1}` : undefined,
          click: () => {
            this.callbacks.openRecentProject(projectPath);
          }
        }))
      : [{ label: 'No hay proyectos recientes', enabled: false }];

    return {
      label: 'Archivo',
      submenu: [
        {
          label: 'Nuevo Proyecto...',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            this.mainWindow.webContents.send('menu-new-project');
          }
        },
        {
          label: 'Abrir Proyecto...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            this.mainWindow.webContents.send('menu-open-project');
          }
        },
        {
          label: 'Cerrar Proyecto',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            this.mainWindow.webContents.send('menu-close-project');
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
                this.mainWindow.webContents.send('menu-import-images-id');
              }
            }
          ]
        },
        {
          label: 'Exportar',
          submenu: [
            {
              label: 'Lista en CSV para carnets',
              accelerator: 'CmdOrCtrl+E',
              click: () => {
                this.mainWindow.webContents.send('menu-export-csv');
              }
            },
            {
              label: 'CSV de inventario por grupos',
              click: () => {
                this.mainWindow.webContents.send('menu-export-inventory-csv');
              }
            },
            {
              label: 'Imágenes como ID',
              click: () => {
                this.mainWindow.webContents.send('menu-export-images');
              }
            },
            {
              label: 'Imágenes como nombre y apellidos',
              click: () => {
                this.mainWindow.webContents.send('menu-export-images-name');
              }
            },
            { type: 'separator' },
            {
              label: 'Imágenes capturadas al depósito',
              click: () => {
                this.mainWindow.webContents.send('menu-export-to-repository');
              }
            },
            {
              label: 'Exportar orla en PDF',
              click: () => {
                this.mainWindow.webContents.send('menu-export-orla-pdf');
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
    };
  }

  /**
   * Build Edit menu
   */
  buildEditMenu() {
    return {
      label: 'Edición',
      submenu: [
        {
          label: 'Enlazar imagen',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            this.mainWindow.webContents.send('menu-link-image');
          }
        },
        {
          label: 'Eliminar fotografía vinculada',
          accelerator: 'CmdOrCtrl+Delete',
          click: () => {
            this.mainWindow.webContents.send('menu-delete-photo');
          }
        },
        { type: 'separator' },
        {
          label: 'Agregar etiqueta a imagen',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            this.mainWindow.webContents.send('menu-add-image-tag');
          }
        }
      ]
    };
  }

  /**
   * Build Project menu
   */
  buildProjectMenu() {
    return {
      label: 'Proyecto',
      submenu: [
        {
          label: 'Actualizar archivo XML',
          click: () => {
            this.mainWindow.webContents.send('menu-update-xml');
          }
        },
        { type: 'separator' },
        {
          label: 'Configurar depósito de imágenes',
          click: async () => {
            const currentPath = await this.callbacks.getImageRepositoryPath();

            const result = await dialog.showOpenDialog(this.mainWindow, {
              title: 'Seleccionar carpeta del depósito de imágenes',
              defaultPath: currentPath || undefined,
              properties: ['openDirectory', 'createDirectory']
            });

            if (!result.canceled && result.filePaths.length > 0) {
              const selectedPath = result.filePaths[0];

              if (await this.callbacks.setImageRepositoryPath(selectedPath)) {
                // Reinitialize repository mirror with new path
                if (this.callbacks.reinitializeRepositoryMirror) {
                  await this.callbacks.reinitializeRepositoryMirror();
                }

                // Notify renderer to update status bar
                this.mainWindow.webContents.send('repository-path-changed');

                dialog.showMessageBox(this.mainWindow, {
                  type: 'info',
                  title: 'Configuración guardada',
                  message: 'Depósito de imágenes configurado',
                  detail: `Ruta: ${selectedPath}`,
                  buttons: ['Aceptar']
                });
              } else {
                dialog.showErrorBox('Error', 'No se pudo guardar la configuración');
              }
            }
          }
        }
      ]
    };
  }

  /**
   * Build Camera menu
   */
  buildCameraMenu() {
    // Build camera selection submenu
    const cameraSelectionSubmenu = this.availableCameras.length > 0
      ? this.availableCameras.map(camera => ({
          label: camera.label,
          type: 'radio',
          checked: camera.deviceId === this.selectedCameraId,
          click: () => {
            this.callbacks.selectCamera(camera.deviceId);
          }
        }))
      : [{ label: 'No hay cámaras disponibles', enabled: false }];

    return {
      label: 'Cámara',
      submenu: [
        {
          label: this.cameraEnabled ? 'Desactivar cámara' : 'Activar cámara',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            this.callbacks.toggleCamera();
          }
        },
        {
          label: 'Mostrar ventana de cámara',
          accelerator: 'CmdOrCtrl+Shift+V',
          enabled: this.cameraEnabled,
          click: () => {
            if (this.cameraWindow) {
              this.cameraWindow.show();
              this.cameraWindow.focus();
            } else {
              this.callbacks.openCameraWindow();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Seleccionar cámara',
          submenu: cameraSelectionSubmenu
        },
        { type: 'separator' },
        {
          label: 'Activar la cámara al iniciar',
          type: 'checkbox',
          checked: this.cameraAutoStart,
          click: (menuItem) => {
            this.callbacks.setCameraAutoStart(menuItem.checked);
          }
        }
      ]
    };
  }

  /**
   * Build View menu
   */
  buildViewMenu() {
    return {
      label: 'Ver',
      submenu: [
        {
          label: 'Asignaciones duplicadas',
          type: 'checkbox',
          checked: this.showDuplicatesOnly,
          click: (menuItem) => {
            this.callbacks.toggleDuplicates(menuItem.checked);
          }
        },
        {
          label: 'Carnets solicitados',
          type: 'checkbox',
          checked: this.showCardPrintRequestsOnly,
          click: (menuItem) => {
            this.callbacks.toggleCardPrintRequests(menuItem.checked);
          }
        },
        { type: 'separator' },
        {
          label: 'Fotografías capturadas',
          type: 'checkbox',
          checked: this.showCapturedPhotos,
          click: (menuItem) => {
            this.callbacks.toggleCapturedPhotos(menuItem.checked);
          }
        },
        {
          label: 'Fotografías del depósito',
          type: 'checkbox',
          checked: this.showRepositoryPhotos,
          click: (menuItem) => {
            this.callbacks.toggleRepositoryPhotos(menuItem.checked);
          }
        },
        {
          label: 'Indicadores de foto en el depósito',
          type: 'checkbox',
          checked: this.showRepositoryIndicators,
          click: (menuItem) => {
            this.callbacks.toggleRepositoryIndicators(menuItem.checked);
          }
        },
        { type: 'separator' },
        {
          label: 'Actualizar imágenes del depósito',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => {
            this.callbacks.refreshRepositoryImages();
          }
        },
        { type: 'separator' },
        {
          label: 'Acciones adicionales',
          type: 'checkbox',
          checked: this.showAdditionalActions,
          click: (menuItem) => {
            this.callbacks.toggleAdditionalActions(menuItem.checked);
          }
        },
        { type: 'separator' },
        {
          label: 'Cuadro de imágenes capturadas',
          accelerator: 'CmdOrCtrl+G',
          click: () => {
            this.callbacks.openImageGridWindow();
          }
        },
        {
          label: 'Cuadro de imágenes en depósito',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => {
            this.callbacks.openRepositoryGridWindow();
          }
        },
        {
          label: 'Listado de imágenes con etiquetas',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => {
            this.mainWindow.webContents.send('menu-show-tagged-images');
          }
        }
      ]
    };
  }

  /**
   * Build Help menu
   */
  buildHelpMenu() {
    return {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Acerca de User Capture',
          click: () => {
            dialog.showMessageBox(this.mainWindow, {
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
    };
  }

  /**
   * Build Developer menu (only in dev mode)
   */
  buildDeveloperMenu() {
    return {
      label: 'Developers',
      submenu: [
        { label: 'Recargar', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Forzar recarga', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: 'Herramientas de desarrollo', accelerator: 'CmdOrCtrl+Shift+I', role: 'toggleDevTools' },
        { type: 'separator' },
        {
          label: 'Abrir POC (Refactor Test)',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            if (this.callbacks.openPOC) {
              this.callbacks.openPOC();
            }
          }
        },
        { type: 'separator' },
        { label: 'Zoom +', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom -', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Zoom normal', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' }
      ]
    };
  }
}

module.exports = MenuBuilder;