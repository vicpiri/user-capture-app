/**
 * Miscellaneous IPC handlers (dialog, camera, config, UI state, tags)
 */
const { ipcMain, dialog } = require('electron');
const path = require('path');
const { getImageRepositoryPath, setImageRepositoryPath, getSelectedGroupFilter, setSelectedGroupFilter } = require('../utils/config');

/**
 * Register miscellaneous IPC handlers
 * @param {Object} context - Shared context object
 * @param {BrowserWindow} context.mainWindow - Main window instance
 * @param {Object} context.logger - Logger instance
 * @param {Object} context.state - Application state
 * @param {BrowserWindow} context.imageGridWindow - Image grid window instance
 * @param {BrowserWindow} context.repositoryGridWindow - Repository grid window instance
 * @param {Function} context.createMenu - Create menu function
 */
function registerMiscHandlers(context) {
  const { mainWindow: getMainWindow, logger, state, imageGridWindow, repositoryGridWindow, createMenu } = context;

  // ============================================================================
  // Dialog Handlers
  // ============================================================================

  // Show open dialog
  ipcMain.handle('show-open-dialog', async (event, options) => {
    const mainWindow = getMainWindow();
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
  });

  // ============================================================================
  // Window Handlers
  // ============================================================================

  // Focus window handler
  ipcMain.handle('focus-window', async () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.focus();
    }
    return { success: true };
  });

  // ============================================================================
  // Camera Handlers
  // ============================================================================

  // Update available cameras
  ipcMain.handle('update-available-cameras', async (event, cameras) => {
    state.availableCameras = cameras;
    // If no camera is selected yet, select the first one
    if (!state.selectedCameraId && cameras.length > 0) {
      state.selectedCameraId = cameras[0].deviceId;
    }
    createMenu();
    return { success: true, selectedCameraId: state.selectedCameraId };
  });

  // Get selected camera
  ipcMain.handle('get-selected-camera', async () => {
    return { success: true, selectedCameraId: state.selectedCameraId };
  });

  // ============================================================================
  // Repository Configuration Handlers
  // ============================================================================

  // Get image repository path
  ipcMain.handle('get-image-repository-path', async () => {
    try {
      const repositoryPath = getImageRepositoryPath();
      return { success: true, path: repositoryPath };
    } catch (error) {
      console.error('Error getting image repository path:', error);
      return { success: false, error: error.message };
    }
  });

  // Set image repository path
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

  // ============================================================================
  // UI State Handlers (Group Filter Synchronization)
  // ============================================================================

  // Get selected group filter
  ipcMain.handle('get-selected-group-filter', async () => {
    try {
      const groupFilter = getSelectedGroupFilter();
      return { success: true, groupCode: groupFilter };
    } catch (error) {
      console.error('Error getting selected group filter:', error);
      return { success: false, error: error.message };
    }
  });

  // Set selected group filter
  ipcMain.handle('set-selected-group-filter', async (event, groupCode) => {
    try {
      if (setSelectedGroupFilter(groupCode)) {
        // Notify all windows about the filter change
        const mainWindow = getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send('group-filter-changed', groupCode);
        }
        if (imageGridWindow && imageGridWindow()) {
          imageGridWindow().webContents.send('group-filter-changed', groupCode);
        }
        if (repositoryGridWindow && repositoryGridWindow()) {
          repositoryGridWindow().webContents.send('group-filter-changed', groupCode);
        }
        return { success: true };
      } else {
        return { success: false, error: 'No se pudo guardar el filtro' };
      }
    } catch (error) {
      console.error('Error setting selected group filter:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Image Tag Handlers
  // ============================================================================

  // Add image tag
  ipcMain.handle('add-image-tag', async (event, data) => {
    try {
      if (!state.dbManager) {
        throw new Error('No hay ningún proyecto abierto');
      }

      const { imagePath, tag } = data;

      // Convert absolute path to relative path for storage
      const relativeImagePath = path.isAbsolute(imagePath)
        ? path.basename(imagePath)
        : imagePath;

      await state.dbManager.addImageTag(relativeImagePath, tag);
      logger.info(`Tag added to image: ${relativeImagePath} - "${tag}"`);

      return { success: true };
    } catch (error) {
      console.error('Error adding image tag:', error);
      return { success: false, error: error.message };
    }
  });

  // Get image tags
  ipcMain.handle('get-image-tags', async (event, imagePath) => {
    try {
      if (!state.dbManager) {
        throw new Error('No hay ningún proyecto abierto');
      }

      // Convert absolute path to relative path for storage
      const relativeImagePath = path.isAbsolute(imagePath)
        ? path.basename(imagePath)
        : imagePath;

      const tags = await state.dbManager.getImageTags(relativeImagePath);
      return { success: true, tags };
    } catch (error) {
      console.error('Error getting image tags:', error);
      return { success: false, error: error.message };
    }
  });

  // Delete image tag
  ipcMain.handle('delete-image-tag', async (event, tagId) => {
    try {
      if (!state.dbManager) {
        throw new Error('No hay ningún proyecto abierto');
      }

      await state.dbManager.deleteImageTag(tagId);
      logger.info(`Tag deleted: ${tagId}`);

      return { success: true };
    } catch (error) {
      console.error('Error deleting image tag:', error);
      return { success: false, error: error.message };
    }
  });

  // Get all images with tags
  ipcMain.handle('get-all-images-with-tags', async () => {
    try {
      if (!state.dbManager) {
        throw new Error('No hay ningún proyecto abierto');
      }

      const imagesWithTags = await state.dbManager.getAllImagesWithTags();

      // Convert relative paths to absolute paths and get tags for each image
      const importsPath = path.join(state.projectPath, 'imports');
      const imagesData = await Promise.all(
        imagesWithTags.map(async (row) => {
          const absolutePath = path.isAbsolute(row.image_path)
            ? row.image_path
            : path.join(importsPath, row.image_path);

          const tags = await state.dbManager.getImageTags(row.image_path);

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

  // ============================================================================
  // Repository Mirror Handlers
  // ============================================================================

  // Get repository sync status
  ipcMain.handle('get-sync-status', async () => {
    try {
      const { repositoryMirror } = context;
      const mirror = repositoryMirror();

      if (!mirror) {
        return { success: true, isSyncing: false, hasCompleted: false };
      }

      const stats = mirror.getStats();

      return {
        success: true,
        isSyncing: stats.isSyncing,
        hasCompleted: stats.lastSyncTime !== null,
        totalFiles: stats.totalFiles,
        lastSyncTime: stats.lastSyncTime
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return { success: false, error: error.message, isSyncing: false };
    }
  });
}

module.exports = { registerMiscHandlers };