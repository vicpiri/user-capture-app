/**
 * User, Group, and Image-related IPC handlers
 */
const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { formatTimestamp } = require('../utils/formatting');
const { getImageRepositoryPath } = require('../utils/config');

/**
 * Register user, group, and image-related IPC handlers
 * @param {Object} context - Shared context object
 * @param {BrowserWindow} context.mainWindow - Main window instance
 * @param {Object} context.logger - Logger instance
 * @param {Object} context.state - Application state
 * @param {Object} context.repositoryCacheManager - Repository cache manager
 * @param {Object} context.repositoryMirror - Repository mirror instance
 */
function registerUserGroupImageHandlers(context) {
  const { mainWindow, logger, state, repositoryCacheManager, repositoryMirror } = context;

  // Get all users
  ipcMain.handle('get-users', async (event, filters, options = {}) => {
    try {
      if (!state.dbManager) {
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

      const users = await state.dbManager.getUsers(dbFilters);

      // Only process captured images if needed
      if (loadOptions.loadCapturedImages) {
        const importsPath = path.join(state.projectPath, 'imports');
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
        const repositoryPath = await getImageRepositoryPath(state.dbManager);

        if (repositoryPath) {
          // Load repository file list ONCE asynchronously
          const repositoryFiles = await repositoryCacheManager.loadRepositoryFileList(repositoryMirror(), logger);

          // Now check each user against the Set (fast in-memory lookup)
          users.forEach(user => {
            // Check if image exists in repository
            user.has_repository_image = false;
            user.repository_image_path = null;

            // Determine the identifier (NIA for students, document for others)
            const identifier = user.type === 'student' ? user.nia : user.document;

            if (identifier) {
              // Check for .jpg and .jpeg extensions using in-memory Set
              const filename = repositoryCacheManager.findRepositoryFile(identifier, repositoryFiles);

              if (filename) {
                user.has_repository_image = true;
                // Use mirror path if mirror is available, fallback to repository path
                const mirror = repositoryMirror();
                const mirrorPath = mirror ? mirror.getMirrorPath(filename) : null;
                user.repository_image_path = mirrorPath || path.join(repositoryPath, filename);
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
      if (!state.dbManager) {
        throw new Error('No hay ningún proyecto abierto');
      }
      const groups = await state.dbManager.getGroups();
      return { success: true, groups };
    } catch (error) {
      console.error('Error getting groups:', error);
      return { success: false, error: error.message };
    }
  });

  // Load repository images data in background (non-blocking)
  ipcMain.handle('load-repository-images', async (event, users) => {
    try {
      if (!state.dbManager) {
        throw new Error('No hay ningún proyecto abierto');
      }

      const repositoryPath = await getImageRepositoryPath(state.dbManager);
      const repositoryData = {};

      if (!repositoryPath) {
        // No repository configured, return empty data
        return { success: true, repositoryData };
      }

      logger.info(`Loading repository images for ${users.length} users`);

      // Load repository file list ONCE
      const repositoryFiles = await repositoryCacheManager.loadRepositoryFileList(repositoryMirror(), logger);

      // Check each user against the repository
      users.forEach(user => {
        const identifier = user.type === 'student' ? user.nia : user.document;

        if (identifier) {
          const filename = repositoryCacheManager.findRepositoryFile(identifier, repositoryFiles);

          if (filename) {
            // Use mirror path if mirror is available, fallback to repository path
            const mirror = repositoryMirror();
            const mirrorPath = mirror ? mirror.getMirrorPath(filename) : null;
            repositoryData[user.id] = {
              has_repository_image: true,
              repository_image_path: mirrorPath || path.join(repositoryPath, filename)
            };
          } else {
            repositoryData[user.id] = {
              has_repository_image: false,
              repository_image_path: null
            };
          }
        } else {
          repositoryData[user.id] = {
            has_repository_image: false,
            repository_image_path: null
          };
        }
      });

      logger.info(`Repository images loaded: ${Object.keys(repositoryData).length} users processed`);
      return { success: true, repositoryData };
    } catch (error) {
      logger.error('Error loading repository images:', error);
      return { success: false, error: error.message };
    }
  });

  // Link image to user
  ipcMain.handle('link-image-user', async (event, data) => {
    try {
      if (!state.dbManager) {
        throw new Error('No hay ningún proyecto abierto');
      }

      const { userId, imagePath } = data;

      // Convert absolute path to relative path for storage
      const importsPath = path.join(state.projectPath, 'imports');
      const relativeImagePath = path.isAbsolute(imagePath)
        ? path.basename(imagePath)
        : imagePath;

      // Check if image is already assigned to other users
      const usersWithImage = await state.dbManager.getUsersByImagePath(relativeImagePath);
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
      const user = await state.dbManager.getUserById(userId);
      if (user.image_path) {
        // Return confirmation needed (convert to absolute for frontend display)
        const absolutePath = path.isAbsolute(user.image_path)
          ? user.image_path
          : path.join(importsPath, user.image_path);
        return { success: false, needsConfirmation: true, currentImage: absolutePath };
      }

      await state.dbManager.linkImageToUser(userId, relativeImagePath);
      return { success: true };
    } catch (error) {
      console.error('Error linking image:', error);
      return { success: false, error: error.message };
    }
  });

  // Confirm link (when user already has image)
  ipcMain.handle('confirm-link-image', async (event, data) => {
    try {
      if (!state.dbManager) {
        throw new Error('No hay ningún proyecto abierto');
      }

      const { userId, imagePath } = data;

      // Convert absolute path to relative path for storage
      const relativeImagePath = path.isAbsolute(imagePath)
        ? path.basename(imagePath)
        : imagePath;

      await state.dbManager.linkImageToUser(userId, relativeImagePath);
      return { success: true };
    } catch (error) {
      console.error('Error confirming link:', error);
      return { success: false, error: error.message };
    }
  });

  // Unlink image from user
  ipcMain.handle('unlink-image-user', async (event, userId) => {
    try {
      if (!state.dbManager) {
        throw new Error('No hay ningún proyecto abierto');
      }

      await state.dbManager.unlinkImageFromUser(userId);
      return { success: true };
    } catch (error) {
      console.error('Error unlinking image:', error);
      return { success: false, error: error.message };
    }
  });

  // Move image to ingest folder
  ipcMain.handle('move-image-to-ingest', async (event, sourceImagePath) => {
    try {
      if (!state.projectPath) {
        throw new Error('No hay ningún proyecto abierto');
      }

      const ingestPath = path.join(state.projectPath, 'ingest');
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
      if (!state.projectPath || !state.dbManager) {
        throw new Error('No hay ningún proyecto abierto');
      }

      logger.section('IMPORTING IMAGES WITH ID');
      logger.info(`Import folder: ${folderPath}`);

      const importsPath = path.join(state.projectPath, 'imports');

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
          const allUsers = await state.dbManager.getUsers({});

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
            await state.dbManager.linkImageToUser(user.id, relativeImagePath);

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

  // Get images
  ipcMain.handle('get-images', async () => {
    try {
      if (!state.imageManager) {
        throw new Error('No hay ningún proyecto abierto');
      }
      const images = await state.imageManager.getImages();
      return { success: true, images };
    } catch (error) {
      console.error('Error getting images:', error);
      return { success: false, error: error.message };
    }
  });

  // Save captured image
  ipcMain.handle('save-captured-image', async (event, imageData) => {
    try {
      if (!state.projectPath) {
        throw new Error('No hay ningún proyecto abierto');
      }

      const ingestPath = path.join(state.projectPath, 'ingest');
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
}

module.exports = { registerUserGroupImageHandlers };
