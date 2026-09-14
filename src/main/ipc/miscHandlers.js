/**
 * Miscellaneous IPC handlers (dialog, camera, config, UI state, tags)
 */
const { ipcMain, dialog } = require('electron');
const path = require('path');
const { getActiveIngestPath, getConfiguredIngestPath } = require('../ingestFolder');
const { getLastExportFolder, setLastExportFolder, getUpdatePreferences, saveUpdatePreferences } = require('../utils/config');
const { getImageRepositoryPath, setImageRepositoryPath, getSelectedGroupFilter, setSelectedGroupFilter, loadGlobalConfig, saveGlobalConfig } = require('../utils/config');
const VersionManager = require('../utils/version');

// Card print requests cache, remembered per repository: opening another project
// points at a different folder, and its requests must not be reported against
// this project's users
let cardPrintRequestsCache = null;
let cardPrintRequestsCacheTime = null;
let cardPrintRequestsCacheKey = null;
const CARD_PRINT_CACHE_TTL = 30000; // 30 seconds

/**
 * Whether a cached folder listing can still be used
 * @param {Array|null} cache
 * @param {number|null} cachedAt
 * @param {string|null} cachedKey - Repository the listing was taken from
 * @param {string|null} repositoryPath - Repository being asked about now
 * @param {number} ttl
 * @returns {boolean}
 */
function isListingCacheValid(cache, cachedAt, cachedKey, repositoryPath, ttl) {
  return Boolean(cache) &&
    cachedKey === repositoryPath &&
    Boolean(cachedAt) &&
    (Date.now() - cachedAt) < ttl;
}

/**
 * Receipt price to use: 0 is a valid price, only a missing or unusable value
 * falls back to 18 (it used to be `price || 18`, which turned 0 into 18)
 * @param {*} value
 * @returns {number}
 */
function receiptPriceOrDefault(value) {
  const price = typeof value === 'string' ? parseFloat(value) : value;
  return typeof price === 'number' && Number.isFinite(price) && price >= 0 ? price : 18;
}

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
  const { mainWindow: getMainWindow, logger, state, imageGridWindow, repositoryGridWindow, createMenu, reinitializeRepositoryMirror, repositoryMirror: getRepositoryMirror } = context;

  // ============================================================================
  // Dialog Handlers
  // ============================================================================

  // Show open dialog
  ipcMain.handle('show-open-dialog', async (event, options) => {
    const mainWindow = getMainWindow();
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
  });

  // Choose the folder an export goes to. Every export uses this one, so the
  // dialog opens where the previous export went, whichever export it was.
  ipcMain.handle('select-export-folder', async (event, options = {}) => {
    const properties = new Set(options.properties || []);
    properties.add('openDirectory');
    properties.add('createDirectory');

    const result = await dialog.showOpenDialog(getMainWindow(), {
      ...options,
      defaultPath: options.defaultPath || getLastExportFolder() || undefined,
      properties: [...properties]
    });

    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
      setLastExportFolder(result.filePaths[0]);
    }

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

      const fs = require('fs').promises;
      const repositoryPath = await getImageRepositoryPath(dbManager);
      const now = Date.now();

      // Check cache validity
      if (isListingCacheValid(cardPrintRequestsCache, cardPrintRequestsCacheTime, cardPrintRequestsCacheKey, repositoryPath, CARD_PRINT_CACHE_TTL)) {
        logger.info('[CardPrint] Using cached card print requests');
        return { success: true, userIds: cardPrintRequestsCache };
      }

      cardPrintRequestsCacheKey = repositoryPath;

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

  // Publication requests cache, remembered per repository for the same reason
  // as the card print one above
  let publicationRequestsCache = null;
  let publicationRequestsCacheTime = null;
  let publicationRequestsCacheKey = null;
  const PUBLICATION_CACHE_TTL = 30000; // 30 seconds

  // Get pending publication requests
  ipcMain.handle('get-publication-requests', async () => {
    try {
      const { projectPath, dbManager } = state;

      if (!projectPath || !dbManager) {
        return { success: false, error: 'No hay proyecto abierto' };
      }

      const fs = require('fs').promises;
      const repositoryPath = await getImageRepositoryPath(dbManager);
      const now = Date.now();

      // Check cache validity
      if (isListingCacheValid(publicationRequestsCache, publicationRequestsCacheTime, publicationRequestsCacheKey, repositoryPath, PUBLICATION_CACHE_TTL)) {
        logger.info('[Publication] Using cached publication requests');
        return { success: true, userIds: publicationRequestsCache };
      }

      publicationRequestsCacheKey = repositoryPath;

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

          // The printed cards window dates each card by this file's
          // modification time, which a move keeps from the request
          try {
            const now = new Date();
            await fs.utimes(destPath, now, now);
          } catch (error) {
            logger.warning(`Could not date the printed card for user ${userId}: ${error.message}`);
          }
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

      // Resolve every file name in one lookup instead of two queries each
      const matchedUsers = await state.dbManager.getUsersByIdentifiers(files);

      const usersByIdentifier = new Map();
      matchedUsers.forEach(user => {
        if (user.nia) usersByIdentifier.set(user.nia, user);
        if (user.document) usersByIdentifier.set(user.document, user);
      });

      // File modification time is when the card was moved to Printed-ID
      const printedDates = await Promise.all(
        files.map(async (fileId) => {
          try {
            const stats = await fs.stat(path.join(printedIdFolder, fileId));
            return stats.mtime.toISOString();
          } catch (error) {
            logger.warning(`[Card Print] Could not get file stats for ${fileId}: ${error.message}`);
            return null;
          }
        })
      );

      const users = [];
      files.forEach((fileId, index) => {
        const user = usersByIdentifier.get(fileId);

        if (!user) {
          logger.warning(`[Card Print] User not found for printed card ID: ${fileId}`);
          return;
        }

        user.printed_date = printedDates[index];
        users.push(user);
      });

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

  // ============================================================================
  // Version Handler
  // ============================================================================

  // Get application version
  ipcMain.handle('get-app-version', async () => {
    try {
      return VersionManager.getVersion();
    } catch (error) {
      logger.error('Error getting app version:', error);
      return '0.0.0';
    }
  });

  // ============================================================================
  // Printer Configuration Handler
  // ============================================================================

  // Get list of available printers
  ipcMain.handle('get-printers', async () => {
    try {
      const mainWindow = getMainWindow();
      if (!mainWindow) {
        logger.error('[Printer] Main window not available');
        return [];
      }

      // Use getPrintersAsync() instead of deprecated getPrinters()
      let printers = await mainWindow.webContents.getPrintersAsync();
      logger.info(`[Printer] webContents.getPrintersAsync() returned ${printers.length} printers`);

      if (printers.length === 0) {
        logger.warn('[Printer] No printers found via webContents.getPrintersAsync()');
      } else {
        // Chromium dropped status and isDefault from PrinterInfo (Electron 36)
        logger.info(`[Printer] Available printers:`, printers.map(p => ({
          name: p.name,
          displayName: p.displayName
        })));
      }

      return printers;
    } catch (error) {
      logger.error('[Printer] Error getting printers:', error);
      return [];
    }
  });

  // Save printer configuration
  ipcMain.handle('save-printer-config', async (event, printerConfig) => {
    try {
      const { loadGlobalConfig, saveGlobalConfig } = require('../utils/config');
      const config = loadGlobalConfig();
      config.printer = printerConfig;
      saveGlobalConfig(config);
      logger.info('[Printer] Configuration saved:', printerConfig);
      return { success: true };
    } catch (error) {
      logger.error('Error saving printer config:', error);
      return { success: false, error: error.message };
    }
  });

  // Open printer preferences
  ipcMain.handle('open-printer-preferences', async (event, printerName) => {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execPromise = promisify(exec);

      logger.info(`[Printer] Opening preferences for: ${printerName}`);

      // Windows command to open printer properties
      // rundll32 printui.dll,PrintUIEntry /e /n "PrinterName"
      const command = `rundll32 printui.dll,PrintUIEntry /e /n "${printerName}"`;

      await execPromise(command);
      logger.info('[Printer] Preferences dialog opened successfully');
      return { success: true };
    } catch (error) {
      logger.error('[Printer] Error opening printer preferences:', error);
      return { success: false, error: error.message };
    }
  });

  // Get saved printer configuration
  ipcMain.handle('get-printer-config', async () => {
    try {
      const { loadGlobalConfig } = require('../utils/config');
      const config = loadGlobalConfig();
      return config.printer || null;
    } catch (error) {
      logger.error('Error getting printer config:', error);
      return null;
    }
  });

  // ============================================================================
  // Receipt Configuration Handler
  // ============================================================================

  // Get receipt configuration
  ipcMain.handle('get-receipt-config', async () => {
    try {
      const { loadGlobalConfig } = require('../utils/config');
      const config = loadGlobalConfig();

      // Default configuration
      const defaultConfig = {
        subtitle: 'Reserva de una copia de Orla',
        price: 18,
        footerText: 'Este resguardo es personal e intransferible.\nPor favor, si no eres el/la titular que aparece en él, entrégalo en la dirección del centro para que se lo hagan llegar a su propietario/a.\nEs imprescindible presentar este resguardo para recoger la copia de la orla reservada en las fechas que indique la dirección del centro.'
      };

      return config.receiptConfig || defaultConfig;
    } catch (error) {
      logger.error('Error getting receipt config:', error);
      return {
        subtitle: 'Reserva de una copia de Orla',
        price: 18,
        footerText: 'Este resguardo es personal e intransferible.\nPor favor, si no eres el/la titular que aparece en él, entrégalo en la dirección del centro para que se lo hagan llegar a su propietario/a.\nEs imprescindible presentar este resguardo para recoger la copia de la orla reservada en las fechas que indique la dirección del centro.'
      };
    }
  });

  // Save receipt configuration
  ipcMain.handle('set-receipt-config', async (event, receiptConfig) => {
    try {
      const { loadGlobalConfig, saveGlobalConfig } = require('../utils/config');
      const config = loadGlobalConfig();
      config.receiptConfig = receiptConfig;
      saveGlobalConfig(config);
      logger.info('[Config] Receipt configuration saved');
      return { success: true };
    } catch (error) {
      logger.error('Error saving receipt config:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Receipt Printing Handler
  // ============================================================================

  // Print receipt for orla payment
  ipcMain.handle('print-orla-receipt', async (event, receiptData) => {
    try {
      const { BrowserWindow } = require('electron');
      const { loadGlobalConfig } = require('../utils/config');
      const fs = require('fs');
      const path = require('path');

      logger.info('[Receipt] Printing receipt for user:', receiptData.userName);

      // Get printer and receipt configuration
      const config = loadGlobalConfig();
      const printerConfig = config.printer;
      const receiptConfig = config.receiptConfig || {
        subtitle: 'Reserva de una copia de Orla',
        price: 18,
        footerText: 'Este resguardo es personal e intransferible.\nPor favor, si no eres el/la titular que aparece en él, entrégalo en la dirección del centro para que se lo hagan llegar a su propietario/a.\nEs imprescindible presentar este resguardo para recoger la copia de la orla reservada en las fechas que indique la dirección del centro.'
      };

      // Get center name from global config
      const centerName = config.centerName || 'IES La Marxadella';

      // Load logo from global config as base64 if exists
      let logoBase64 = '';
      const logoPath = config.logoPath || '';
      if (logoPath && fs.existsSync(logoPath)) {
        try {
          const logoData = fs.readFileSync(logoPath);
          const ext = path.extname(logoPath).toLowerCase();
          const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
          logoBase64 = `data:${mimeType};base64,${logoData.toString('base64')}`;
        } catch (err) {
          logger.warn('[Receipt] Could not load logo:', err.message);
        }
      }

      // Create a hidden window for printing
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      // Generate receipt HTML
      const receiptHTML = generateReceiptHTML(receiptData, receiptConfig, logoBase64, centerName);

      // Load HTML content
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(receiptHTML)}`);

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 500));

      // Print options for thermal printer (80mm width)
      const printOptions = {
        silent: true, // Silent printing (no dialog)
        printBackground: true,
        margins: {
          marginType: 'none'
        },
        pageSize: {
          width: 80000, // 80mm in microns
          height: 297000 // A4 height, will be cut by printer
        }
      };

      // Set printer if configured
      if (printerConfig && printerConfig.name) {
        printOptions.deviceName = printerConfig.name;
        logger.info('[Receipt] Using configured printer:', printerConfig.name);
      } else {
        logger.warn('[Receipt] No printer configured, using default');
      }

      // Wait for the printer's answer. Reporting success as soon as the job
      // was sent marked receipts as printed when the printer had failed, or
      // when there was no printer at all.
      const { success, errorType } = await new Promise((resolve) => {
        printWindow.webContents.print(printOptions, (ok, reason) => resolve({ success: ok, errorType: reason }));
      });
      printWindow.close();

      if (!success) {
        logger.error('[Receipt] Print failed:', errorType);
        return {
          success: false,
          error: printerConfig && printerConfig.name
            ? `La impresora «${printerConfig.displayName || printerConfig.name}» no ha podido imprimir el recibo (${errorType || 'error desconocido'})`
            : `No se ha podido imprimir el recibo: no hay impresora configurada o la predeterminada no responde (${errorType || 'error desconocido'}). Elígela en Archivo > Preferencias... > Impresora de Recibos.`
        };
      }

      logger.info('[Receipt] Receipt printed successfully');
      return { success: true };
    } catch (error) {
      logger.error('[Receipt] Error printing receipt:', error);
      return { success: false, error: error.message };
    }
  });

  // Helper function to generate receipt HTML
  function generateReceiptHTML(data, config, logoBase64, centerName) {
    const currentDate = new Date().toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const currentTime = new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // Format footer text with line breaks
    const footerLines = config.footerText.split('\n').map(line => line.trim()).filter(line => line);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Recibo</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, sans-serif;
      width: 72mm;
      padding: 5mm 5mm 5mm 2mm;
      font-size: 11pt;
      margin: 0 auto;
    }
    .center {
      text-align: center;
    }
    .bold {
      font-weight: bold;
    }
    .logo {
      text-align: center;
      margin-bottom: 10px;
    }
    .logo img {
      max-width: 50mm;
      max-height: 25mm;
      object-fit: contain;
    }
    .header {
      margin-bottom: 8px;
    }
    .center-name {
      font-size: 16pt;
      font-weight: bold;
      margin-bottom: 3px;
    }
    .subtitle {
      font-size: 11pt;
      margin-bottom: 8px;
    }
    .user-section {
      margin: 12px 0;
      font-size: 13pt;
    }
    .group-row {
      margin-top: 8px;
      font-size: 11pt;
    }
    .date-section {
      margin: 12px 0;
      font-size: 10pt;
    }
    .entrega-section {
      margin: 15px 0;
      font-size: 13pt;
    }
    .footer {
      margin-top: 15px;
      padding-top: 10px;
      border-top: 1px solid #000;
      font-size: 9pt;
      text-align: center;
      line-height: 1.4;
    }
    .footer-line {
      margin-bottom: 6px;
    }
  </style>
</head>
<body>
  ${logoBase64 ? `
  <div class="logo">
    <img src="${logoBase64}" alt="Logo">
  </div>
  ` : ''}

  <div class="header center">
    <div class="center-name">${centerName}</div>
    <div class="subtitle">${config.subtitle}</div>
  </div>

  <div class="user-section center bold">
    ${data.userName}
  </div>

  <div class="group-row center">
    Grupo: ${data.groupName}
  </div>

  <div class="date-section center">
    Fecha:${currentDate} ${currentTime}
  </div>

  <div class="entrega-section center">
    <strong>Entrega: ${config.price.toFixed(2)}€</strong>
  </div>

  <div class="footer">
    ${footerLines.map(line => `<div class="footer-line">${line}</div>`).join('')}
  </div>
</body>
</html>
    `.trim();
  }

  // ============================================================================
  // Image Relationships Backup Handlers
  // ============================================================================

  // Backup user-image relationships
  ipcMain.handle('backup-image-relationships', async () => {
    try {
      if (!state.dbManager) {
        throw new Error('No hay ningún proyecto abierto');
      }

      const result = await state.dbManager.backupUserImageRelationships();
      logger.info(`Backed up ${result.count} image relationships at ${result.backupDate}`);

      return { success: true, ...result };
    } catch (error) {
      logger.error('Error backing up image relationships:', error);
      return { success: false, error: error.message };
    }
  });

  // Clear captured images. Without userIds it clears the whole project.
  ipcMain.handle('clear-captured-images', async (event, userIds) => {
    try {
      if (!state.dbManager) {
        throw new Error('No hay ningún proyecto abierto');
      }

      const result = await state.dbManager.clearCapturedImages(userIds);
      logger.info(
        `Cleared ${result.cleared} captured image links` +
        (Array.isArray(userIds) ? ` (restricted to ${userIds.length} users)` : ' (whole project)')
      );

      return { success: true, ...result };
    } catch (error) {
      logger.error('Error clearing captured images:', error);
      return { success: false, error: error.message };
    }
  });

  // Restore image relationships from backup
  ipcMain.handle('restore-image-relationships', async (event, backupDate) => {
    try {
      logger.info(`[IPC] Restore image relationships called with backup date: ${backupDate}`);

      if (!state.dbManager) {
        throw new Error('No hay ningún proyecto abierto');
      }

      const result = await state.dbManager.restoreUserImageRelationships(backupDate);
      logger.info(`[IPC] Restored ${result.restored} image relationships from backup ${backupDate}`);

      return { success: true, ...result };
    } catch (error) {
      logger.error('[IPC] Error restoring image relationships:', error);
      return { success: false, error: error.message };
    }
  });

  // Get list of backups
  ipcMain.handle('get-image-backups', async () => {
    try {
      if (!state.dbManager) {
        throw new Error('No hay ningún proyecto abierto');
      }

      const backups = await state.dbManager.getBackups();
      return { success: true, backups };
    } catch (error) {
      logger.error('Error getting image backups:', error);
      return { success: false, error: error.message };
    }
  });

  // Delete backup
  ipcMain.handle('delete-image-backup', async (event, backupDate) => {
    try {
      if (!state.dbManager) {
        throw new Error('No hay ningún proyecto abierto');
      }

      const result = await state.dbManager.deleteBackup(backupDate);
      logger.info(`Deleted backup ${backupDate} (${result.deleted} records)`);

      return { success: true, ...result };
    } catch (error) {
      logger.error('Error deleting image backup:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Project Details Handler
  // ============================================================================

  // Everything the project information modal shows. Kept apart from
  // 'get-project-info', which the status bar refreshes often and must stay
  // cheap: this one runs four counts and lists the imports folder.
  ipcMain.handle('get-project-details', async () => {
    try {
      if (!state.projectPath || !state.dbManager) {
        return { success: false, error: 'No hay ningún proyecto abierto' };
      }

      const projectPath = state.projectPath;
      const repositoryPath = await getImageRepositoryPath(state.dbManager);
      const statistics = await state.dbManager.getProjectStatistics();

      // Recorded from the project's second opening onwards; older projects
      // never stored it, so the modal has to cope with it being missing
      const xmlFilePath = await state.dbManager.getProjectSetting('xmlFilePath');

      // The captures live on disk, not in the database
      const capturedImages = state.imageManager
        ? (await state.imageManager.getImages()).length
        : 0;

      const mirror = getRepositoryMirror ? getRepositoryMirror() : null;

      // The configured folder can differ from the watched one when it was
      // missing at opening time and the default is standing in for it
      const ingestPath = getActiveIngestPath(state);
      const configuredIngestPath = await getConfiguredIngestPath(state.dbManager);

      return {
        success: true,
        info: {
          name: path.basename(projectPath),
          projectPath,
          xmlFilePath: xmlFilePath || null,
          ingestPath,
          configuredIngestPath,
          ingestIsCustom: Boolean(configuredIngestPath),
          ingestUnavailable: Boolean(configuredIngestPath) && configuredIngestPath !== ingestPath,
          importsPath: path.join(projectPath, 'imports'),
          databasePath: path.join(projectPath, 'data', 'users.db'),
          repositoryPath: repositoryPath || null,
          mirrorPath: mirror ? mirror.mirrorPath : null,
          capturedImages,
          ...statistics
        }
      };
    } catch (error) {
      logger.error('Error getting project info', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // Preferences Handlers
  // ============================================================================

  // The preferences window owns the institution and receipt data only. The
  // display options live in the Ver menu and are saved from there
  // (saveDisplayPreferences); this pair must not read or write them, or saving
  // the window turns them off.

  // Get application preferences
  ipcMain.handle('get-preferences', async () => {
    try {
      const config = loadGlobalConfig();

      // Get receipt config for preferences
      const receiptConfig = config.receiptConfig || {};

      return {
        success: true,
        preferences: {
          centerName: config.centerName || '',
          logoPath: config.logoPath || '',
          receiptSubtitle: receiptConfig.subtitle || '',
          receiptPrice: receiptPriceOrDefault(receiptConfig.price),
          receiptFooter: receiptConfig.footerText || '',
          // Stored with the rest of the update checker's state, which reads it
          autoCheckUpdates: getUpdatePreferences().autoCheck !== false
        }
      };
    } catch (error) {
      logger.error('Error getting preferences:', error);
      return { success: false, error: error.message };
    }
  });

  // Save application preferences
  ipcMain.handle('save-preferences', async (event, preferences) => {
    try {
      const config = loadGlobalConfig();

      // Update preferences
      config.centerName = preferences.centerName || '';
      config.logoPath = preferences.logoPath || '';

      // Update receipt config
      config.receiptConfig = {
        subtitle: preferences.receiptSubtitle || '',
        price: receiptPriceOrDefault(preferences.receiptPrice),
        footerText: preferences.receiptFooter || ''
      };

      let success = saveGlobalConfig(config);

      // After the rest: saveUpdatePreferences reads the file just written
      if (success && typeof preferences.autoCheckUpdates === 'boolean') {
        success = saveUpdatePreferences({ autoCheck: preferences.autoCheckUpdates });
      }

      if (success) {
        logger.info('Preferences saved successfully');
        return { success: true };
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      logger.error('Error saving preferences:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerMiscHandlers };