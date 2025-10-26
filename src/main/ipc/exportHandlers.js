/**
 * Export-related IPC handlers
 */
const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
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
 * Register export-related IPC handlers
 * @param {Object} context - Shared context object
 * @param {BrowserWindow} context.mainWindow - Main window instance
 * @param {Object} context.logger - Logger instance
 * @param {Object} context.state - Application state
 */
function registerExportHandlers(context) {
  const { mainWindow: getMainWindow, logger, state } = context;

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
              processedCount++;
              logger.info(`Exported image for user ${user.first_name} ${user.last_name1} as ${groupCode}/${destFileName}`);

              // Send progress update
              const percentage = Math.round((processedCount / results.total) * 100);
              getMainWindow()?.webContents.send('progress', {
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
          processedCount++;
          logger.info(`Exported image for user ${user.first_name} ${user.last_name1} as ${destFileName}`);

          // Send progress update
          const percentage = Math.round((processedCount / results.total) * 100);
          getMainWindow()?.webContents.send('progress', {
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
              processedCount++;
              logger.info(`Exported image for user ${user.first_name} ${user.last_name1} as ${groupCode}/${destFileName}`);

              // Send progress update
              const percentage = Math.round((processedCount / results.total) * 100);
              getMainWindow()?.webContents.send('progress', {
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
}

module.exports = { registerExportHandlers };