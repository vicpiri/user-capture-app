/**
 * Miscellaneous IPC handlers (dialog, camera, config, UI state, tags)
 */
const { ipcMain, dialog } = require('electron');
const path = require('path');
const { getImageRepositoryPath, setImageRepositoryPath, getSelectedGroupFilter, setSelectedGroupFilter } = require('../utils/config');

// Card print requests cache
let cardPrintRequestsCache = null;
let cardPrintRequestsCacheTime = null;
const CARD_PRINT_CACHE_TTL = 30000; // 30 seconds

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
  const { mainWindow: getMainWindow, logger, state, imageGridWindow, repositoryGridWindow, createMenu, reinitializeRepositoryMirror } = context;

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
      if (!state.dbManager) {
        return { success: false, error: 'No hay ningún proyecto abierto' };
      }
      const repositoryPath = await getImageRepositoryPath(state.dbManager);
      return { success: true, path: repositoryPath };
    } catch (error) {
      console.error('Error getting image repository path:', error);
      return { success: false, error: error.message };
    }
  });

  // Set image repository path
  ipcMain.handle('set-image-repository-path', async (event, repositoryPath) => {
    try {
      if (!state.dbManager) {
        return { success: false, error: 'No hay ningún proyecto abierto' };
      }
      if (await setImageRepositoryPath(state.dbManager, repositoryPath)) {
        // Reinitialize repository mirror with new path
        logger.info(`Repository path changed to: ${repositoryPath}`);
        await reinitializeRepositoryMirror();
        logger.success('Repository mirror reinitialized with new path');
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

  // ============================================================================
  // Project Info Handlers
  // ============================================================================

  // Get project information (path and repository path)
  ipcMain.handle('get-project-info', async () => {
    try {
      if (!state.projectPath) {
        return { success: false, error: 'No hay ningún proyecto abierto' };
      }

      const repositoryPath = await getImageRepositoryPath(state.dbManager);

      return {
        success: true,
        projectPath: state.projectPath,
        repositoryPath: repositoryPath || null
      };
    } catch (error) {
      console.error('Error getting project info:', error);
      return { success: false, error: error.message };
    }
  });

  // Update window title
  ipcMain.handle('update-window-title', async () => {
    try {
      const { updateWindowTitle } = context;
      if (updateWindowTitle) {
        updateWindowTitle();
      }
      return { success: true };
    } catch (error) {
      console.error('Error updating window title:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Card Print Request Handlers
  // ============================================================================

  // Get pending card print requests
  ipcMain.handle('get-card-print-requests', async () => {
    try {
      const { projectPath, dbManager } = state;

      if (!projectPath || !dbManager) {
        return { success: false, error: 'No hay proyecto abierto' };
      }

      // Check cache validity
      const now = Date.now();
      if (cardPrintRequestsCache && cardPrintRequestsCacheTime && (now - cardPrintRequestsCacheTime < CARD_PRINT_CACHE_TTL)) {
        logger.info('[CardPrint] Using cached card print requests');
        return { success: true, userIds: cardPrintRequestsCache };
      }

      const fs = require('fs').promises;
      const repositoryPath = await getImageRepositoryPath(dbManager);
      if (!repositoryPath) {
        cardPrintRequestsCache = [];
        cardPrintRequestsCacheTime = now;
        return { success: true, userIds: [] };
      }

      // Check if 'To-Print-ID' folder exists
      const toPrintIdFolder = path.join(repositoryPath, 'To-Print-ID');
      try {
        await fs.access(toPrintIdFolder);
      } catch {
        // Folder doesn't exist, cache empty result
        cardPrintRequestsCache = [];
        cardPrintRequestsCacheTime = now;
        return { success: true, userIds: [] };
      }

      // Read all files in the folder
      const files = await fs.readdir(toPrintIdFolder);

      // Filter out directories, only keep files (which are user IDs)
      const userIds = [];
      for (const file of files) {
        const filePath = path.join(toPrintIdFolder, file);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          userIds.push(file);
        }
      }

      // Update cache
      cardPrintRequestsCache = userIds;
      cardPrintRequestsCacheTime = now;

      logger.info(`[CardPrint] Scanned ${userIds.length} card print requests (cached for ${CARD_PRINT_CACHE_TTL}ms)`);
      return { success: true, userIds };
    } catch (error) {
      logger.error('Error getting card print requests:', error);
      return { success: false, error: error.message };
    }
  });

  // Request card print for selected users
  ipcMain.handle('request-card-print', async (event, userIds) => {
    try {
      const fs = require('fs').promises;
      const { projectPath, dbManager } = state;

      if (!projectPath || !dbManager) {
        return { success: false, error: 'No hay proyecto abierto' };
      }

      if (!userIds || userIds.length === 0) {
        return { success: false, error: 'No hay usuarios seleccionados' };
      }

      // Get image repository path
      const repositoryPath = await getImageRepositoryPath(dbManager);
      if (!repositoryPath) {
        return { success: false, error: 'No se ha configurado la ruta del depósito de imágenes' };
      }

      // Create 'To-Print-ID' folder if it doesn't exist
      const toPrintIdFolder = path.join(repositoryPath, 'To-Print-ID');
      try {
        await fs.access(toPrintIdFolder);
      } catch {
        await fs.mkdir(toPrintIdFolder, { recursive: true });
        logger.info(`Created To-Print-ID folder: ${toPrintIdFolder}`);
      }

      // Get user data for selected users
      const users = await dbManager.getUsersByIds(userIds);

      if (!users || users.length === 0) {
        return { success: false, error: 'No se encontraron usuarios' };
      }

      // Generate ID files for each user
      let count = 0;
      let skipped = 0;
      for (const user of users) {
        // Determine user ID (NIA for students, document for others)
        const userId = user.type === 'student' ? user.nia : user.document;

        if (!userId) {
          logger.warning(`User ${user.id} (${user.first_name} ${user.last_name1}) has no ID, skipping`);
          skipped++;
          continue;
        }

        // Check if user has repository image by verifying file existence
        const repositoryImagePath = path.join(repositoryPath, `${userId}.jpg`);
        try {
          await fs.access(repositoryImagePath);
        } catch {
          // File doesn't exist
          logger.warning(`User ${user.id} (${user.first_name} ${user.last_name1}) has no repository image (${userId}.jpg), skipping`);
          skipped++;
          continue;
        }

        // Create empty file with user ID as filename
        const filePath = path.join(toPrintIdFolder, userId);
        await fs.writeFile(filePath, '', 'utf8');
        count++;
        logger.info(`Created card print request for user ${user.id}: ${filePath}`);
      }

      // Invalidate cache after creating new requests
      cardPrintRequestsCache = null;
      cardPrintRequestsCacheTime = null;
      logger.info('[CardPrint] Cache invalidated after creating requests');

      return { success: true, count, skipped };
    } catch (error) {
      logger.error('Error requesting card print:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Publication Request Handlers
  // ============================================================================

  // Publication requests cache
  let publicationRequestsCache = null;
  let publicationRequestsCacheTime = null;
  const PUBLICATION_CACHE_TTL = 30000; // 30 seconds

  // Get pending publication requests
  ipcMain.handle('get-publication-requests', async () => {
    try {
      const { projectPath, dbManager } = state;

      if (!projectPath || !dbManager) {
        return { success: false, error: 'No hay proyecto abierto' };
      }

      // Check cache validity
      const now = Date.now();
      if (publicationRequestsCache && publicationRequestsCacheTime && (now - publicationRequestsCacheTime < PUBLICATION_CACHE_TTL)) {
        logger.info('[Publication] Using cached publication requests');
        return { success: true, userIds: publicationRequestsCache };
      }

      const fs = require('fs').promises;
      const repositoryPath = await getImageRepositoryPath(dbManager);
      if (!repositoryPath) {
        publicationRequestsCache = [];
        publicationRequestsCacheTime = now;
        return { success: true, userIds: [] };
      }

      // Check if 'To-Publish' folder exists
      const toPublishFolder = path.join(repositoryPath, 'To-Publish');
      try {
        await fs.access(toPublishFolder);
      } catch {
        // Folder doesn't exist, cache empty result
        publicationRequestsCache = [];
        publicationRequestsCacheTime = now;
        return { success: true, userIds: [] };
      }

      // Read all files in the folder
      const files = await fs.readdir(toPublishFolder);

      // Filter out directories, only keep files (which are user IDs)
      const userIds = [];
      for (const file of files) {
        const filePath = path.join(toPublishFolder, file);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          // Remove .jpg extension if present
          const userId = file.replace(/\.jpg$/i, '');
          userIds.push(userId);
        }
      }

      // Update cache
      publicationRequestsCache = userIds;
      publicationRequestsCacheTime = now;

      logger.info(`[Publication] Scanned ${userIds.length} publication requests (cached for ${PUBLICATION_CACHE_TTL}ms)`);
      return { success: true, userIds };
    } catch (error) {
      logger.error('Error getting publication requests:', error);
      return { success: false, error: error.message };
    }
  });

  // Request publication for selected users
  ipcMain.handle('request-publication', async (event, userIds) => {
    try {
      const fs = require('fs').promises;
      const { projectPath, dbManager } = state;

      if (!projectPath || !dbManager) {
        return { success: false, error: 'No hay proyecto abierto' };
      }

      if (!userIds || userIds.length === 0) {
        return { success: false, error: 'No hay usuarios seleccionados' };
      }

      // Get image repository path
      const repositoryPath = await getImageRepositoryPath(dbManager);
      if (!repositoryPath) {
        return { success: false, error: 'No se ha configurado la ruta del depósito de imágenes' };
      }

      // Create 'To-Publish' folder if it doesn't exist
      const toPublishFolder = path.join(repositoryPath, 'To-Publish');
      try {
        await fs.access(toPublishFolder);
      } catch {
        await fs.mkdir(toPublishFolder, { recursive: true });
        logger.info(`Created To-Publish folder: ${toPublishFolder}`);
      }

      // Get user data for selected users
      const users = await dbManager.getUsersByIds(userIds);

      if (!users || users.length === 0) {
        return { success: false, error: 'No se encontraron usuarios' };
      }

      // Copy repository images for each user
      let count = 0;
      let skipped = 0;
      for (const user of users) {
        // Determine user ID (NIA for students, document for others)
        const userId = user.type === 'student' ? user.nia : user.document;

        if (!userId) {
          logger.warning(`User ${user.id} (${user.first_name} ${user.last_name1}) has no ID, skipping`);
          skipped++;
          continue;
        }

        // Check if user has repository image by verifying file existence
        const repositoryImagePath = path.join(repositoryPath, `${userId}.jpg`);
        try {
          await fs.access(repositoryImagePath);
        } catch {
          // File doesn't exist
          logger.warning(`User ${user.id} (${user.first_name} ${user.last_name1}) has no repository image (${userId}.jpg), skipping`);
          skipped++;
          continue;
        }

        // Copy image to To-Publish folder with user ID as filename
        const destPath = path.join(toPublishFolder, `${userId}.jpg`);
        await fs.copyFile(repositoryImagePath, destPath);
        count++;
        logger.info(`Created publication request for user ${user.id}: ${destPath}`);
      }

      // Invalidate cache after creating new requests
      publicationRequestsCache = null;
      publicationRequestsCacheTime = null;
      logger.info('[Publication] Cache invalidated after creating requests');

      return { success: true, count, skipped };
    } catch (error) {
      logger.error('Error requesting publication:', error);
      return { success: false, error: error.message };
    }
  });

  // Check if users have card print requests (To-Print-ID)
  ipcMain.handle('check-card-print-requests', async (event, userIds) => {
    try {
      const fs = require('fs').promises;

      if (!state.dbManager) {
        return { success: false, error: 'No hay ningún proyecto abierto' };
      }

      const repositoryPath = await getImageRepositoryPath(state.dbManager);

      if (!repositoryPath) {
        return { success: true, usersWithRequests: [] };
      }

      const toPrintIdFolder = path.join(repositoryPath, 'To-Print-ID');

      // Check if To-Print-ID folder exists
      try {
        await fs.access(toPrintIdFolder);
      } catch {
        return { success: true, usersWithRequests: [] };
      }

      // Check which users have files in To-Print-ID
      const usersWithRequests = [];
      for (const userId of userIds) {
        const filePath = path.join(toPrintIdFolder, userId); // No extension
        try {
          await fs.access(filePath);
          usersWithRequests.push(userId);
        } catch {
          // File doesn't exist, skip
        }
      }

      logger.info(`[Card Print] Found ${usersWithRequests.length} pending requests`);
      return { success: true, usersWithRequests };
    } catch (error) {
      logger.error('Error checking card print requests:', error);
      return { success: false, error: error.message };
    }
  });

  // Move card print requests from To-Print-ID to Printed-ID
  ipcMain.handle('mark-cards-as-printed', async (event, userIds) => {
    try {
      const fs = require('fs').promises;

      if (!state.dbManager) {
        return { success: false, error: 'No hay ningún proyecto abierto' };
      }

      const repositoryPath = await getImageRepositoryPath(state.dbManager);
      if (!repositoryPath) {
        return { success: false, error: 'No se ha configurado la ruta del depósito de imágenes' };
      }

      const toPrintIdFolder = path.join(repositoryPath, 'To-Print-ID');
      const printedIdFolder = path.join(repositoryPath, 'Printed-ID');

      // Create Printed-ID folder if it doesn't exist
      try {
        await fs.access(printedIdFolder);
      } catch {
        await fs.mkdir(printedIdFolder, { recursive: true });
        logger.info(`Created Printed-ID folder: ${printedIdFolder}`);
      }

      // Move files from To-Print-ID to Printed-ID
      let movedCount = 0;
      for (const userId of userIds) {
        const sourcePath = path.join(toPrintIdFolder, userId); // No extension
        const destPath = path.join(printedIdFolder, userId); // No extension

        try {
          await fs.access(sourcePath);
          await fs.rename(sourcePath, destPath);
          movedCount++;
          logger.info(`Moved card print request from To-Print-ID to Printed-ID: ${userId}`);
        } catch (error) {
          // File doesn't exist or couldn't be moved, skip
          logger.warning(`Could not move card print request for user ${userId}: ${error.message}`);
        }
      }

      // Invalidate cache after moving files
      cardPrintRequestsCache = null;
      cardPrintRequestsCacheTime = null;
      logger.info('[Card Print] Cache invalidated after marking as printed');

      return { success: true, movedCount };
    } catch (error) {
      logger.error('Error marking cards as printed:', error);
      return { success: false, error: error.message };
    }
  });

  // Get list of printed cards (users with files in Printed-ID folder)
  ipcMain.handle('get-printed-cards', async () => {
    try {
      const fs = require('fs').promises;

      if (!state.dbManager) {
        return { success: false, error: 'No hay ningún proyecto abierto' };
      }

      const repositoryPath = await getImageRepositoryPath(state.dbManager);
      if (!repositoryPath) {
        return { success: false, error: 'No se ha configurado la ruta del depósito de imágenes' };
      }

      const printedIdFolder = path.join(repositoryPath, 'Printed-ID');

      // Check if Printed-ID folder exists
      let files = [];
      try {
        await fs.access(printedIdFolder);
        files = await fs.readdir(printedIdFolder);
      } catch {
        // Folder doesn't exist, return empty list
        logger.info('[Card Print] Printed-ID folder does not exist');
        return { success: true, users: [] };
      }

      if (files.length === 0) {
        logger.info('[Card Print] No printed cards found');
        return { success: true, users: [] };
      }

      // Get user information for each file
      const users = [];
      for (const fileId of files) {
        // File name is the user ID (NIA or document)
        // Try to find user by NIA first, then by document
        let user = null;

        // Try NIA (students)
        const studentResult = await state.dbManager.getUserByNIA(fileId);
        if (studentResult) {
          user = studentResult;
        } else {
          // Try document (teachers/staff)
          const staffResult = await state.dbManager.getUserByDocument(fileId);
          if (staffResult) {
            user = staffResult;
          }
        }

        if (user) {
          // Get file modification time (when it was moved to Printed-ID)
          try {
            const filePath = path.join(printedIdFolder, fileId);
            const stats = await fs.stat(filePath);
            user.printed_date = stats.mtime.toISOString();
          } catch (error) {
            logger.warning(`[Card Print] Could not get file stats for ${fileId}: ${error.message}`);
            user.printed_date = null;
          }

          users.push(user);
        } else {
          logger.warning(`[Card Print] User not found for printed card ID: ${fileId}`);
        }
      }

      // Sort by printed date (newest first)
      users.sort((a, b) => {
        if (!a.printed_date) return 1;
        if (!b.printed_date) return -1;
        return new Date(b.printed_date) - new Date(a.printed_date);
      });

      logger.info(`[Card Print] Found ${users.length} printed cards`);
      return { success: true, users };
    } catch (error) {
      logger.error('Error getting printed cards:', error);
      return { success: false, error: error.message };
    }
  });

  // Clear printed cards list (delete all files in Printed-ID folder)
  ipcMain.handle('clear-printed-cards', async () => {
    try {
      const fs = require('fs').promises;

      if (!state.dbManager) {
        return { success: false, error: 'No hay ningún proyecto abierto' };
      }

      const repositoryPath = await getImageRepositoryPath(state.dbManager);
      if (!repositoryPath) {
        return { success: false, error: 'No se ha configurado la ruta del depósito de imágenes' };
      }

      const printedIdFolder = path.join(repositoryPath, 'Printed-ID');

      // Check if Printed-ID folder exists
      try {
        await fs.access(printedIdFolder);
      } catch {
        // Folder doesn't exist, nothing to clear
        logger.info('[Card Print] Printed-ID folder does not exist, nothing to clear');
        return { success: true, deletedCount: 0 };
      }

      // Read all files in the folder
      const files = await fs.readdir(printedIdFolder);

      if (files.length === 0) {
        logger.info('[Card Print] Printed-ID folder is already empty');
        return { success: true, deletedCount: 0 };
      }

      // Delete all files
      let deletedCount = 0;
      for (const file of files) {
        try {
          const filePath = path.join(printedIdFolder, file);
          await fs.unlink(filePath);
          deletedCount++;
        } catch (error) {
          logger.warning(`[Card Print] Could not delete file ${file}: ${error.message}`);
        }
      }

      logger.info(`[Card Print] Cleared ${deletedCount} files from Printed-ID folder`);
      return { success: true, deletedCount };
    } catch (error) {
      logger.error('Error clearing printed cards:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerMiscHandlers };