/**
 * Ingest folder of a project
 *
 * Every project watches one folder and moves each new JPG that lands in it to
 * its imports folder. By default that is the project's own 'ingest' subfolder,
 * but a project can point it somewhere else so other programs (a tethering
 * tool, a shared folder a photographer drops files into) can feed photos to
 * the application. The choice is stored in the project's own database.
 *
 * Whatever writes into the ingest folder has to ask for the active path here
 * rather than rebuilding it from the project folder: the webcam and the drag
 * and drop both do, and a hardcoded 'ingest' would leave their photos in a
 * folder nobody watches.
 */
const { dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const FolderWatcher = require('./folderWatcher');
const { getImageRepositoryPath } = require('./utils/config');

const INGEST_SETTING = 'ingestPath';
const DEFAULT_INGEST_FOLDER = 'ingest';

/**
 * @param {string} projectPath
 * @returns {string}
 */
function getDefaultIngestPath(projectPath) {
  return path.join(projectPath, DEFAULT_INGEST_FOLDER);
}

/**
 * Folder being watched right now
 *
 * Can differ from the configured one: when that folder is missing at opening
 * time the default is watched instead.
 *
 * @param {Object} state - Shared application state
 * @returns {string|null}
 */
function getActiveIngestPath(state) {
  if (state.folderWatcher && state.folderWatcher.ingestPath) {
    return state.folderWatcher.ingestPath;
  }
  return state.projectPath ? getDefaultIngestPath(state.projectPath) : null;
}

/**
 * Custom ingest folder stored for the project, if any
 * @param {Object} dbManager
 * @returns {Promise<string|null>}
 */
async function getConfiguredIngestPath(dbManager) {
  if (!dbManager) {
    return null;
  }
  try {
    return (await dbManager.getProjectSetting(INGEST_SETTING)) || null;
  } catch (error) {
    console.error('Error getting ingest path:', error);
    return null;
  }
}

/**
 * Store a custom ingest folder, or go back to the default with null
 * @param {Object} dbManager
 * @param {string|null} folderPath
 * @returns {Promise<void>}
 */
async function setConfiguredIngestPath(dbManager, folderPath) {
  if (folderPath) {
    await dbManager.setProjectSetting(INGEST_SETTING, folderPath);
  } else {
    await dbManager.deleteProjectSetting(INGEST_SETTING);
  }
}

/**
 * @param {string} folderPath
 * @returns {boolean}
 */
function isDirectory(folderPath) {
  try {
    return fs.statSync(folderPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Whether child is parent itself or somewhere below it
 *
 * path.relative compares case-insensitively on Windows, which is what the
 * filesystem does too.
 *
 * @param {string} child
 * @param {string} parent
 * @returns {boolean}
 */
function isSameOrInside(child, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  if (relative === '') {
    return true;
  }
  return relative.split(path.sep)[0] !== '..' && !path.isAbsolute(relative);
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function isSamePath(a, b) {
  return path.relative(path.resolve(a), path.resolve(b)) === '';
}

/**
 * Where the watcher should look, given what the project has configured
 * @param {string} projectPath
 * @param {string|null} configuredPath
 * @returns {{path: string, configuredPath: string|null, isCustom: boolean, unavailable: boolean}}
 */
function resolveWatchPath(projectPath, configuredPath) {
  const defaultPath = getDefaultIngestPath(projectPath);

  if (!configuredPath) {
    return { path: defaultPath, configuredPath: null, isCustom: false, unavailable: false };
  }

  // An unplugged drive or an unreachable share must not stop the project from
  // opening, nor leave the webcam writing into a folder nobody watches
  if (!isDirectory(configuredPath)) {
    return { path: defaultPath, configuredPath, isCustom: true, unavailable: true };
  }

  return { path: configuredPath, configuredPath, isCustom: true, unavailable: false };
}

/**
 * Reason a folder cannot be the ingest folder, or null if it can
 *
 * The watcher moves everything new it finds, one level of subfolders deep
 * included, so a folder that holds the project's imports or the repository
 * would have it move photos out of places that must keep them.
 *
 * @param {string} candidate
 * @param {Object} context
 * @param {string} context.projectPath
 * @param {string|null} [context.repositoryPath]
 * @param {string|null} [context.mirrorPath]
 * @returns {string|null}
 */
function validateIngestPath(candidate, { projectPath, repositoryPath = null, mirrorPath = null }) {
  if (!candidate) {
    return 'No se ha indicado ninguna carpeta';
  }

  if (!isDirectory(candidate)) {
    return `La carpeta no existe: ${candidate}`;
  }

  if (isSameOrInside(projectPath, candidate)) {
    return 'La carpeta de entrada no puede ser la carpeta del proyecto ni una carpeta que la contenga';
  }

  if (isSameOrInside(candidate, path.join(projectPath, 'imports'))) {
    return 'La carpeta de entrada no puede estar dentro de la carpeta imports del proyecto';
  }

  for (const protectedPath of [repositoryPath, mirrorPath]) {
    if (protectedPath && (isSameOrInside(candidate, protectedPath) || isSameOrInside(protectedPath, candidate))) {
      return 'La carpeta de entrada no puede ser el depósito de imágenes, estar dentro de él ni contenerlo';
    }
  }

  return null;
}

/**
 * Create and start the watcher for the open project
 *
 * Leaves it in state.folderWatcher. Any previous watcher must have been
 * stopped by the caller.
 *
 * @param {Object} options
 * @param {Object} options.state - Shared application state
 * @param {Object} options.logger
 * @param {Function} options.getMainWindow
 * @returns {Promise<ReturnType<typeof resolveWatchPath>>}
 */
async function startIngestWatcher({ state, logger, getMainWindow }) {
  const configuredPath = await getConfiguredIngestPath(state.dbManager);
  const watch = resolveWatchPath(state.projectPath, configuredPath);

  if (watch.unavailable) {
    logger.warning(`Ingest folder not available, watching the default one instead: ${watch.configuredPath}`);
  }

  // Projects created before the folder existed, or whose folder was deleted
  if (!watch.isCustom || watch.unavailable) {
    fs.mkdirSync(watch.path, { recursive: true });
  }

  const watcher = new FolderWatcher(watch.path, path.join(state.projectPath, 'imports'));
  watcher.on('image-detecting', (filename) => {
    logger.info(`Image being processed: ${filename}`);
    getMainWindow()?.webContents.send('image-detecting', filename);
  });
  watcher.on('image-added', (filename) => {
    logger.info(`New image detected: ${filename}`);
    if (state.imageManager) {
      state.imageManager.invalidateCache();
    }
    getMainWindow()?.webContents.send('new-image-detected', filename);
  });

  // Sent for every photo announced with 'image-detecting' that will not arrive,
  // so the viewer stops waiting for it
  watcher.on('image-rejected', ({ filename, message }) => {
    logger.warning(`Image not imported: ${filename}${message ? ` (${message})` : ''}`);
    getMainWindow()?.webContents.send('image-rejected', { filename, message });
  });

  state.folderWatcher = watcher;
  await watcher.start();
  logger.success('Folder watcher started', { watchPath: watch.path });

  if (watch.unavailable) {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Carpeta de entrada no disponible',
        message: 'No se encuentra la carpeta de entrada configurada para este proyecto',
        detail: `Carpeta configurada: ${watch.configuredPath}\n\n` +
          `Mientras no esté disponible se vigila la carpeta por defecto:\n${watch.path}\n\n` +
          'Puedes cambiarla en Proyecto > Configurar carpeta de entrada.',
        buttons: ['Aceptar']
      });
    }
  }

  return watch;
}

/**
 * Stop the current watcher and start one on the configured folder
 * @param {Object} options - Same as startIngestWatcher
 * @returns {Promise<ReturnType<typeof resolveWatchPath>>}
 */
async function restartIngestWatcher(options) {
  const { state } = options;
  if (state.folderWatcher) {
    await state.folderWatcher.stop();
    state.folderWatcher = null;
  }
  return startIngestWatcher(options);
}

/**
 * Let the user choose the project's ingest folder (Proyecto menu)
 *
 * @param {Object} options
 * @param {Object} options.state - Shared application state
 * @param {Object} options.logger
 * @param {Function} options.getMainWindow
 * @param {string|null} [options.mirrorPath] - Local copy of the repository
 * @returns {Promise<{success: boolean, changed: boolean, ingestPath?: string, error?: string}>}
 */
async function configureIngestFolder({ state, logger, getMainWindow, mirrorPath = null }) {
  const mainWindow = getMainWindow();

  if (!state.projectPath || !state.dbManager) {
    if (mainWindow) {
      dialog.showErrorBox('Carpeta de entrada', 'No hay ningún proyecto abierto');
    }
    return { success: false, changed: false, error: 'No hay ningún proyecto abierto' };
  }

  const projectPath = state.projectPath;
  const defaultPath = getDefaultIngestPath(projectPath);
  const configuredPath = await getConfiguredIngestPath(state.dbManager);

  // A folder picker cannot express "back to the default", so that choice is
  // offered first whenever there is something to go back from
  let useDefault = false;
  if (configuredPath) {
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Carpeta de entrada',
      message: 'Carpeta de entrada de imágenes (ingest)',
      detail: `Carpeta actual (personalizada):\n${configuredPath}\n\n` +
        `Carpeta por defecto:\n${defaultPath}`,
      buttons: ['Elegir otra carpeta...', 'Usar la carpeta por defecto', 'Cancelar'],
      defaultId: 0,
      cancelId: 2,
      noLink: true
    });

    if (choice.response === 2) {
      return { success: true, changed: false };
    }
    useDefault = choice.response === 1;
  }

  let newPath = null;
  if (!useDefault) {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Seleccionar la carpeta de entrada de imágenes',
      defaultPath: configuredPath && isDirectory(configuredPath) ? configuredPath : defaultPath,
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, changed: false };
    }

    const selectedPath = result.filePaths[0];

    // Picking the default folder is the same as going back to it
    if (!isSamePath(selectedPath, defaultPath)) {
      const repositoryPath = await getImageRepositoryPath(state.dbManager);
      const error = validateIngestPath(selectedPath, { projectPath, repositoryPath, mirrorPath });
      if (error) {
        dialog.showErrorBox('Carpeta de entrada', error);
        return { success: false, changed: false, error };
      }
      newPath = selectedPath;
    }
  }

  if (newPath === configuredPath) {
    return { success: true, changed: false };
  }

  await setConfiguredIngestPath(state.dbManager, newPath);
  logger.info(`Ingest folder changed to: ${newPath || `${defaultPath} (default)`}`);

  const watch = await restartIngestWatcher({ state, logger, getMainWindow });

  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Configuración guardada',
    message: newPath ? 'Carpeta de entrada configurada' : 'Se usa la carpeta de entrada por defecto',
    detail: `Ruta: ${watch.path}\n\n` +
      'Las imágenes JPG nuevas que lleguen a esta carpeta se moverán a la carpeta imports del proyecto. ' +
      'Las que ya estuvieran en ella no se importan.',
    buttons: ['Aceptar']
  });

  return { success: true, changed: true, ingestPath: watch.path };
}

module.exports = {
  INGEST_SETTING,
  getDefaultIngestPath,
  getActiveIngestPath,
  getConfiguredIngestPath,
  setConfiguredIngestPath,
  resolveWatchPath,
  validateIngestPath,
  isSameOrInside,
  startIngestWatcher,
  restartIngestWatcher,
  configureIngestFolder
};
