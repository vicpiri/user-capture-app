/**
 * Export-related IPC handlers
 */
const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const archiver = require('archiver');
const { getImageRepositoryPath } = require('../utils/config');
const { capitalizeWords } = require('../utils/formatting');

/**
 * Helper function to check if a file exists in the repository
 * @param {string} filePath - Full path to the file
 * @returns {boolean} True if file exists
 */
function checkRepositoryFile(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

/**
 * Helper function to calculate age from birth date
 * @param {string|Date} birthDate - Birth date
 * @param {Object} logger - Logger instance
 * @returns {number} Age in years
 */
function calculateAge(birthDate, logger) {
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
}

/**
 * Helper function to send progress update to main window
 * @param {Function} getMainWindow - Function to get main window
 * @param {number} processedCount - Number of items processed
 * @param {number} total - Total number of items
 * @param {string} message - Progress message
 */
function sendProgressUpdate(getMainWindow, processedCount, total, message) {
  const percentage = Math.round((processedCount / total) * 100);
  getMainWindow()?.webContents.send('progress', {
    percentage,
    message,
    details: `${processedCount} de ${total} imágenes procesadas`
  });
}

/**
 * Register export-related IPC handlers
 * @param {Object} context - Shared context object
 * @param {BrowserWindow} context.mainWindow - Main window instance
 * @param {Object} context.logger - Logger instance
 * @param {Object} context.state - Application state
 */
function registerExportHandlers(context) {
  const { mainWindow: getMainWindow, logger, state, repositoryMirror } = context;

  // Export CSV
  ipcMain.handle('export-csv', async (event, folderPath, users) => {
    try {
      if (!state.dbManager) {
        throw new Error('No hay ningún proyecto abierto');
      }

      // Use provided users or get all users if not provided
      if (!users || users.length === 0) {
        users = await state.dbManager.getUsers({});
      }

      // Get repository path
      const repositoryPath = getImageRepositoryPath();

      // Filter users to only include those with images in the repository
      const usersWithRepositoryImages = users.filter(user => {
        if (!repositoryPath) return false;

        // Determine the identifier (NIA for students, document for others)
        const identifier = user.type === 'student' ? user.nia : user.document;

        if (!identifier) return false;

        // Check for .jpg and .jpeg extensions using cache
        const jpgPath = path.join(repositoryPath, `${identifier}.jpg`);
        const jpegPath = path.join(repositoryPath, `${identifier}.jpeg`);

        return checkRepositoryFile(jpgPath) || checkRepositoryFile(jpegPath);
      });

      // Log the filtering
      logger.info(`CSV Export: Total users: ${users.length}, Users with repository images: ${usersWithRepositoryImages.length}`);

      // Use the filtered list for export
      users = usersWithRepositoryImages;

      // Create CSV content with exact field order from claude.md
      const csvHeader = 'id;password;userlevel;nombre;apellido1;apellido2;apellidos;centro;foto;grupo;direccion;telefono;departamento;DNI;edad;fechaNacimiento;nombreApellidos\n';
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
          const age = calculateAge(fechaNacimiento, logger);
          edad = age >= 18 ? 'mayor.jpg' : 'menor.jpg';

          // Log age calculation for debugging
          logger.info(`Age calculation for ${nombre} ${apellido1}: birthDate=${fechaNacimiento}, calculatedAge=${age}, result=${edad}`);
        } else {
          edad = 'profesor.jpg';
        }

        // centro: always "1"
        const centro = '1';
        // grupo: group code from user
        const grupo = user.group_code || '';
        const direccion = '';
        const telefono = '';
        const departamento = '1';
        const DNI = documento;

        return `${id};${password};${userlevel};${nombre};${apellido1};${apellido2};${apellidos};${centro};${foto};${grupo};${direccion};${telefono};${departamento};${DNI};${edad};${fechaNacimiento};${nombreApellidos}`;
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

  // Export images (placeholder - implementation is very large, continuing in next section)
  ipcMain.handle('export-images', async (event, folderPath, users, options) => {
    try {
      if (!state.dbManager || !state.projectPath) {
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

      const importsPath = path.join(state.projectPath, 'imports');

      // Use provided users or get all users if not provided
      if (!users || users.length === 0) {
        users = await state.dbManager.getUsers({});
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
              logger.info(`Exported image for user ${user.first_name} ${user.last_name1} as ${groupCode}/${destFileName}`);
            } catch (error) {
              results.errors.push({
                user: `${user.first_name} ${user.last_name1}`,
                error: error.message
              });
              logger.error(`Error exporting image for user ${user.first_name} ${user.last_name1}`, error);
            } finally {
              // Always update progress, regardless of success or failure
              processedCount++;
              sendProgressUpdate(getMainWindow, processedCount, results.total, 'Exportando imágenes...');
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
            sendProgressUpdate(getMainWindow, processedCount, results.total, 'Exportando imágenes...');
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
      if (!state.dbManager || !state.projectPath) {
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

      const importsPath = path.join(state.projectPath, 'imports');

      // Use provided users or get all users if not provided
      if (!users || users.length === 0) {
        users = await state.dbManager.getUsers({});
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
          logger.info(`Exported image for user ${user.first_name} ${user.last_name1} as ${destFileName}`);
        } catch (error) {
          results.errors.push({
            user: `${user.first_name} ${user.last_name1}`,
            error: error.message
          });
          logger.error(`Error exporting image for user ${user.first_name} ${user.last_name1}`, error);
        } finally {
          // Always update progress, regardless of success or failure
          processedCount++;
          sendProgressUpdate(getMainWindow, processedCount, results.total, 'Exportando imágenes al depósito...');
        }
      }

      logger.section('EXPORT TO REPOSITORY COMPLETED');
      logger.success(`Exported: ${results.exported}/${results.total} images to repository`);
      if (results.errors.length > 0) {
        logger.error(`Errors: ${results.errors.length} images`);
      }

      // Invalidate repository cache after export
      if (results.exported > 0) {
        state.invalidateRepositoryCache();
        logger.info('Repository cache invalidated after export');
      }

      return { success: true, results };
    } catch (error) {
      logger.error('Error exporting images to repository', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Helper function to create a ZIP archive from images
   * @param {string} zipPath - Full path to the ZIP file to create
   * @param {Array} images - Array of image objects with {path, name} properties
   * @returns {Promise<void>}
   */
  async function createZipArchive(zipPath, images) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      output.on('close', () => {
        resolve();
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // Add each image to the archive
      for (const image of images) {
        archive.file(image.path, { name: image.name });
      }

      archive.finalize();
    });
  }

  // Export inventory images from repository
  ipcMain.handle('export-inventory-images', async (event, folderPath, users, options) => {
    try {
      if (!state.dbManager) {
        throw new Error('No hay ningún proyecto abierto');
      }

      // Get repository path
      const repositoryPath = getImageRepositoryPath();
      if (!repositoryPath) {
        return { success: false, error: 'No se ha configurado el depósito de imágenes' };
      }

      // Default options
      const exportOptions = {
        copyOriginal: options?.copyOriginal ?? true,
        resizeEnabled: options?.resizeEnabled ?? false,
        boxSize: options?.boxSize ?? 800,
        maxSizeKB: options?.maxSizeKB ?? 500,
        zipEnabled: options?.zipEnabled ?? false,
        zipMaxSizeMB: options?.zipMaxSizeMB ?? 25
      };

      logger.section('EXPORTING INVENTORY IMAGES');
      logger.info(`Export folder: ${folderPath}`);
      logger.info(`Export options:`, exportOptions);
      logger.info(`Users to check: ${users.length}`);

      const results = {
        total: users.length,
        exported: 0,
        skipped: 0,
        errors: []
      };

      // If ZIP is enabled, use temp folder, otherwise use target folder
      const tempFolder = exportOptions.zipEnabled ? path.join(folderPath, '.temp-images') : null;
      const exportFolder = exportOptions.zipEnabled ? tempFolder : folderPath;

      // Create temp folder if needed
      if (tempFolder && !fs.existsSync(tempFolder)) {
        fs.mkdirSync(tempFolder, { recursive: true });
      }

      // Track progress
      let processedCount = 0;

      // Array to store processed image paths for ZIP
      const processedImages = [];

      // Export images for each user
      for (const user of users) {
        try {
          // Determine the ID to use for filename: NIA for students, document for others
          const isStudent = user.type === 'student';
          const userId = isStudent ? user.nia : user.document;

          if (!userId) {
            results.skipped++;
            processedCount++;
            continue;
          }

          // Check if image exists in repository
          const sourceImagePath = path.join(repositoryPath, `${userId}.jpg`);
          const sourceImagePathJpeg = path.join(repositoryPath, `${userId}.jpeg`);

          let actualSourcePath = null;
          if (fs.existsSync(sourceImagePath)) {
            actualSourcePath = sourceImagePath;
          } else if (fs.existsSync(sourceImagePathJpeg)) {
            actualSourcePath = sourceImagePathJpeg;
          }

          if (!actualSourcePath) {
            results.skipped++;
            processedCount++;
            continue;
          }

          // Create destination filename
          const destFileName = `${userId}.jpg`;
          const destPath = path.join(exportFolder, destFileName);

          // Process image based on options
          if (exportOptions.copyOriginal && !exportOptions.resizeEnabled) {
            // Copy original but correct orientation using sharp
            await sharp(actualSourcePath)
              .rotate() // Auto-rotate based on EXIF orientation
              .toFile(destPath);
          } else if (exportOptions.resizeEnabled) {
            // Use sharp to process the image
            let sharpInstance = sharp(actualSourcePath)
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
              sharpInstance = sharp(actualSourcePath)
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

          // Store path for ZIP if enabled
          if (exportOptions.zipEnabled) {
            processedImages.push({
              path: destPath,
              name: destFileName,
              size: fs.statSync(destPath).size
            });
          }

          results.exported++;
          logger.info(`Exported image for user ${user.first_name} ${user.last_name1} as ${destFileName}`);
        } catch (error) {
          results.errors.push({
            user: `${user.first_name} ${user.last_name1}`,
            error: error.message
          });
          logger.error(`Error exporting image for user ${user.first_name} ${user.last_name1}`, error);
        } finally {
          // Always update progress
          processedCount++;
          sendProgressUpdate(getMainWindow, processedCount, results.total, 'Exportando imágenes del inventario...');
        }
      }

      // Create ZIP files if enabled
      if (exportOptions.zipEnabled && processedImages.length > 0) {
        logger.info('Creating ZIP archives...');
        const maxSizeBytes = exportOptions.zipMaxSizeMB * 1024 * 1024;
        let currentZipSize = 0;
        let zipIndex = 1;
        let currentZipImages = [];
        const zipFiles = [];

        for (let i = 0; i < processedImages.length; i++) {
          const image = processedImages[i];

          // If adding this image would exceed the max size, create a ZIP and start a new one
          if (currentZipSize + image.size > maxSizeBytes && currentZipImages.length > 0) {
            const zipFileName = processedImages.length <= 1 || (currentZipSize + image.size <= maxSizeBytes && i === processedImages.length - 1)
              ? 'imagenes.zip'
              : `imagenes_${zipIndex}.zip`;
            const zipPath = path.join(folderPath, zipFileName);

            await createZipArchive(zipPath, currentZipImages);
            zipFiles.push({ name: zipFileName, count: currentZipImages.length });

            logger.info(`Created ZIP: ${zipFileName} (${currentZipImages.length} images, ${Math.round(currentZipSize/1024/1024)}MB)`);

            currentZipImages = [];
            currentZipSize = 0;
            zipIndex++;
          }

          currentZipImages.push(image);
          currentZipSize += image.size;
        }

        // Create final ZIP with remaining images
        if (currentZipImages.length > 0) {
          const zipFileName = zipFiles.length === 0 ? 'imagenes.zip' : `imagenes_${zipIndex}.zip`;
          const zipPath = path.join(folderPath, zipFileName);

          await createZipArchive(zipPath, currentZipImages);
          zipFiles.push({ name: zipFileName, count: currentZipImages.length });

          logger.info(`Created ZIP: ${zipFileName} (${currentZipImages.length} images, ${Math.round(currentZipSize/1024/1024)}MB)`);
        }

        // Clean up temp folder
        if (tempFolder && fs.existsSync(tempFolder)) {
          fs.rmSync(tempFolder, { recursive: true, force: true });
        }

        results.zipFiles = zipFiles;
      }

      logger.section('INVENTORY IMAGES EXPORT COMPLETED');
      logger.success(`Exported: ${results.exported}/${results.total} images`);
      logger.info(`Skipped: ${results.skipped} (no image in repository)`);
      if (exportOptions.zipEnabled && results.zipFiles) {
        logger.info(`ZIP files created: ${results.zipFiles.length}`);
      }
      if (results.errors.length > 0) {
        logger.error(`Errors: ${results.errors.length} images`);
      }

      return { success: true, results };
    } catch (error) {
      logger.error('Error exporting inventory images', error);
      return { success: false, error: error.message };
    }
  });

  // Export inventory CSVs (3 files: Alumnado, Personal, Grupos)
  ipcMain.handle('export-inventory-csv', async (event, folderPath, users) => {
    try {
      if (!state.dbManager) {
        throw new Error('No hay ningún proyecto abierto');
      }

      // Use provided users or get all users if not provided
      if (!users || users.length === 0) {
        users = await state.dbManager.getUsers({});
      }

      logger.section('INVENTORY EXPORT');
      logger.info(`Exporting inventory CSVs for ${users.length} users`);

      const results = {
        totalUsers: users.length,
        filesCreated: 0,
        files: []
      };

      // Separate users by type
      const students = users.filter(u => u.type === 'student');
      const staff = users.filter(u => u.type === 'teacher' || u.type === 'non_teaching_staff');

      logger.info(`Students: ${students.length}, Staff: ${staff.length}`);

      // 1. Generate Alumnado.csv (Students)
      try {
        // CSV header (comma-delimited)
        const csvHeader = 'Codigo,Nombre,Apellido1,Apellido2,Fecha Nacimiento,Grupo\n';

        // Generate CSV rows
        const csvRows = students.map(user => {
          const codigo = user.nia || '';
          const nombre = user.first_name || '';
          const apellido1 = user.last_name1 || '';
          const apellido2 = user.last_name2 || '';
          const fechaNacimiento = user.birth_date || '';
          const grupo = user.group_code || '';

          // Escape fields that might contain commas
          const escapeCSV = (field) => {
            if (field.includes(',') || field.includes('"') || field.includes('\n')) {
              return `"${field.replace(/"/g, '""')}"`;
            }
            return field;
          };

          return `${escapeCSV(codigo)},${escapeCSV(nombre)},${escapeCSV(apellido1)},${escapeCSV(apellido2)},${escapeCSV(fechaNacimiento)},${escapeCSV(grupo)}`;
        }).join('\n');

        const csvContent = csvHeader + csvRows;
        const filename = 'Alumnado.csv';
        const filePath = path.join(folderPath, filename);

        fs.writeFileSync(filePath, csvContent, 'utf8');

        results.filesCreated++;
        results.files.push({
          filename,
          userCount: students.length,
          type: 'Alumnado'
        });

        logger.success(`Created ${filename} (${students.length} students)`);
      } catch (error) {
        logger.error('Error creating Alumnado.csv:', error);
      }

      // 2. Generate Personal.csv (Staff)
      try {
        // CSV header (comma-delimited)
        const csvHeader = 'Función,Documento,Nombre,Apellido1,Apellido2,Fecha Nacimiento,Teléfono 1,Teléfono 2,Email\n';

        // Generate CSV rows
        const csvRows = staff.map(user => {
          // Función: "Docente" for teachers, "No Docente" for non-teaching staff
          const funcion = user.type === 'teacher' ? 'Docente' : 'No Docente';
          const documento = user.document || '';
          const nombre = user.first_name || '';
          const apellido1 = user.last_name1 || '';
          const apellido2 = user.last_name2 || '';
          const fechaNacimiento = user.birth_date || '';
          const telefono1 = '';
          const telefono2 = '';
          const email = '';

          // Escape fields that might contain commas
          const escapeCSV = (field) => {
            if (field.includes(',') || field.includes('"') || field.includes('\n')) {
              return `"${field.replace(/"/g, '""')}"`;
            }
            return field;
          };

          return `${escapeCSV(funcion)},${escapeCSV(documento)},${escapeCSV(nombre)},${escapeCSV(apellido1)},${escapeCSV(apellido2)},${escapeCSV(fechaNacimiento)},${escapeCSV(telefono1)},${escapeCSV(telefono2)},${escapeCSV(email)}`;
        }).join('\n');

        const csvContent = csvHeader + csvRows;
        const filename = 'Personal.csv';
        const filePath = path.join(folderPath, filename);

        fs.writeFileSync(filePath, csvContent, 'utf8');

        results.filesCreated++;
        results.files.push({
          filename,
          userCount: staff.length,
          type: 'Personal'
        });

        logger.success(`Created ${filename} (${staff.length} staff)`);
      } catch (error) {
        logger.error('Error creating Personal.csv:', error);
      }

      // 3. Generate Grupos.csv (Groups)
      try {
        // Get all groups from database
        const groups = await state.dbManager.getGroups();

        // CSV header (comma-delimited)
        const csvHeader = 'CódigoGrupo,Nombre\n';

        // Generate CSV rows
        const csvRows = groups.map(group => {
          const codigoGrupo = group.code || '';
          const nombre = group.name || '';

          // Escape fields that might contain commas
          const escapeCSV = (field) => {
            if (field.includes(',') || field.includes('"') || field.includes('\n')) {
              return `"${field.replace(/"/g, '""')}"`;
            }
            return field;
          };

          return `${escapeCSV(codigoGrupo)},${escapeCSV(nombre)}`;
        }).join('\n');

        const csvContent = csvHeader + csvRows;
        const filename = 'Grupos.csv';
        const filePath = path.join(folderPath, filename);

        fs.writeFileSync(filePath, csvContent, 'utf8');

        results.filesCreated++;
        results.files.push({
          filename,
          userCount: groups.length,
          type: 'Grupos'
        });

        logger.success(`Created ${filename} (${groups.length} groups)`);
      } catch (error) {
        logger.error('Error creating Grupos.csv:', error);
      }

      logger.section('INVENTORY EXPORT COMPLETED');
      logger.success(`Created ${results.filesCreated} CSV files`);

      return {
        success: true,
        results
      };
    } catch (error) {
      console.error('Error exporting inventory CSV:', error);
      return { success: false, error: error.message };
    }
  });

  // Export images with name format (Apellido1 Apellido2, Nombre)
  ipcMain.handle('export-images-name', async (event, folderPath, users, options) => {
    try {
      if (!state.dbManager || !state.projectPath) {
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

      const importsPath = path.join(state.projectPath, 'imports');

      // Use provided users or get all users if not provided
      if (!users || users.length === 0) {
        users = await state.dbManager.getUsers({});
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
              logger.info(`Exported image for user ${user.first_name} ${user.last_name1} as ${groupCode}/${destFileName}`);
            } catch (error) {
              results.errors.push({
                user: `${user.first_name} ${user.last_name1}`,
                error: error.message
              });
              logger.error(`Error exporting image for user ${user.first_name} ${user.last_name1}`, error);
            } finally {
              // Always update progress, regardless of success or failure
              processedCount++;
              sendProgressUpdate(getMainWindow, processedCount, results.total, 'Exportando imágenes...');
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
            sendProgressUpdate(getMainWindow, processedCount, results.total, 'Exportando imágenes...');
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

  // Export Orla PDF
  ipcMain.handle('export-orla-pdf', async (event, { exportPath, photoSource, imageQuality, usersByGroup }) => {
    const PDFDocument = require('pdfkit');

    try {
      logger.section('ORLA PDF EXPORT');
      logger.info(`Export path: ${exportPath}`);
      logger.info(`Photo source: ${photoSource}`);
      logger.info(`Image quality: ${imageQuality}`);
      logger.info(`Groups with users: ${Object.keys(usersByGroup).length}`);

      const generatedFiles = [];
      const totalGroups = Object.keys(usersByGroup).length;
      let processedGroups = 0;

      // Generate one PDF per group
      for (const [groupCode, users] of Object.entries(usersByGroup)) {
        logger.info(`Generating PDF for group: ${groupCode} (${users.length} users)`);

        // Send progress update
        sendProgressUpdate(getMainWindow, processedGroups, totalGroups, `Generando PDF para grupo ${groupCode}...`);

        // Create PDF document
        const doc = new PDFDocument({
          size: 'A4',
          layout: 'portrait',
          margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });

        // Create output file path
        const fileName = `Orla_${groupCode}.pdf`;
        const filePath = path.join(exportPath, fileName);

        // Pipe PDF to file
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        // Add title
        doc.fontSize(20)
           .font('Helvetica-Bold')
           .text(`Orla - ${groupCode}`, { align: 'center' });

        doc.moveDown(2);

        // Calculate grid layout
        const imagesPerRow = 4;
        // Aspect ratio 3:4 (width:height) for vertical portrait photos
        const imageWidth = 105;
        const imageHeight = 140; // 105 * 4/3 = 140
        const imageSpacing = 15;
        const nameHeight = 30;
        const cellHeight = imageHeight + nameHeight + imageSpacing;

        // Page dimensions
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const pageHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;

        // Calculate starting X position to center the grid
        const totalGridWidth = (imageWidth + imageSpacing) * imagesPerRow - imageSpacing;
        const startX = doc.page.margins.left + (pageWidth - totalGridWidth) / 2;

        let currentX = startX;
        let currentY = doc.y;
        let count = 0;

        // Sort users alphabetically by last_name1, then last_name2, then first_name
        users.sort((a, b) => {
          const lastName1A = (a.last_name1 || '').toLowerCase();
          const lastName1B = (b.last_name1 || '').toLowerCase();
          const lastName2A = (a.last_name2 || '').toLowerCase();
          const lastName2B = (b.last_name2 || '').toLowerCase();
          const firstNameA = (a.first_name || '').toLowerCase();
          const firstNameB = (b.first_name || '').toLowerCase();

          // Compare by last_name1 first
          if (lastName1A !== lastName1B) {
            return lastName1A.localeCompare(lastName1B);
          }

          // If last_name1 is the same, compare by last_name2
          if (lastName2A !== lastName2B) {
            return lastName2A.localeCompare(lastName2B);
          }

          // If both last names are the same, compare by first_name
          return firstNameA.localeCompare(firstNameB);
        });

        // Process each user
        for (const user of users) {
          // Check if we need a new page
          if (currentY + cellHeight > pageHeight + doc.page.margins.top) {
            doc.addPage();
            currentY = doc.page.margins.top;
            currentX = startX;
            count = 0;
          }

          // Get image path
          let imagePath = photoSource === 'captured'
            ? user.image_path
            : user.repository_image_path;

          // If using repository photos and path is not set, try to construct it
          if (photoSource === 'repository' && !imagePath) {
            const repositoryPath = getImageRepositoryPath();
            if (repositoryPath) {
              const isStudent = user.type === 'student';
              const userId = isStudent ? user.nia : user.document;
              if (userId) {
                const filename = `${userId}.jpg`;
                const mirror = repositoryMirror();
                const mirrorPath = mirror ? mirror.getMirrorPath(filename) : null;
                imagePath = mirrorPath || path.join(repositoryPath, filename);
              }
            }
          }

          // Draw image or placeholder
          if (imagePath && fs.existsSync(imagePath)) {
            try {
              // Load and resize image to fit in 3:4 vertical portrait
              // rotate() without parameters auto-rotates based on EXIF orientation
              // Process at higher resolution (3x display size) for better quality in PDF
              const processingWidth = imageWidth * 3; // 315px for 105pt display
              const processingHeight = imageHeight * 3; // 420px for 140pt display
              const imageBuffer = await sharp(imagePath)
                .rotate()
                .resize(processingWidth, processingHeight, { fit: 'cover' })
                .jpeg({ quality: imageQuality })
                .toBuffer();

              doc.image(imageBuffer, currentX, currentY, {
                width: imageWidth,
                height: imageHeight
              });
            } catch (error) {
              logger.error(`Error loading image for user ${user.first_name} ${user.last_name1}:`, error);
              // Draw placeholder on error
              doc.rect(currentX, currentY, imageWidth, imageHeight)
                 .stroke('#cccccc');
            }
          } else {
            // Draw placeholder rectangle with light gray background
            doc.rect(currentX, currentY, imageWidth, imageHeight)
               .fillAndStroke('#f5f5f5', '#cccccc');

            // Draw simple user icon using SVG-like shapes
            const centerX = currentX + imageWidth / 2;
            const centerY = currentY + imageHeight / 2;

            // Draw head circle
            doc.circle(centerX, centerY - 20, 15)
               .fillAndStroke('#cccccc', '#aaaaaa');

            // Draw body (simplified trapezoid using lines)
            doc.moveTo(centerX - 20, centerY + 35)
               .lineTo(centerX - 12, centerY + 15)
               .lineTo(centerX + 12, centerY + 15)
               .lineTo(centerX + 20, centerY + 35)
               .fillAndStroke('#cccccc', '#aaaaaa');
          }

          // Draw user name below image (always in black)
          // Format: Apellido1 Apellido2, Nombre
          const lastName2 = user.last_name2 ? ` ${user.last_name2}` : '';
          const fullName = `${user.last_name1}${lastName2}, ${user.first_name}`;
          doc.fillColor('#000000')
             .fontSize(8)
             .font('Helvetica')
             .text(fullName, currentX, currentY + imageHeight + 5, {
               width: imageWidth,
               align: 'center',
               lineBreak: false,
               ellipsis: true
             });

          // Move to next position
          count++;
          if (count % imagesPerRow === 0) {
            // Move to next row
            currentX = startX;
            currentY += cellHeight;
          } else {
            // Move to next column
            currentX += imageWidth + imageSpacing;
          }
        }

        // Finalize PDF
        doc.end();

        // Wait for write stream to finish
        await new Promise((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });

        logger.success(`Generated PDF: ${fileName}`);
        generatedFiles.push(fileName);

        // Update progress
        processedGroups++;
        sendProgressUpdate(getMainWindow, processedGroups, totalGroups, `PDF generado: ${fileName}`);
      }

      logger.section('ORLA PDF EXPORT COMPLETED');
      logger.success(`Generated ${generatedFiles.length} PDF file(s)`);

      return { success: true, generatedFiles };
    } catch (error) {
      logger.error('Error exporting orla PDF', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerExportHandlers };