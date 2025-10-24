/**
 * Project-related IPC handlers
 */
const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const DatabaseManager = require('../database');
const XMLParser = require('../xmlParser');
const ImageManager = require('../imageManager');
const FolderWatcher = require('../folderWatcher');

/**
 * Register project-related IPC handlers
 * @param {Object} context - Shared context object
 * @param {BrowserWindow} context.mainWindow - Main window instance
 * @param {Object} context.logger - Logger instance
 * @param {Object} context.state - Application state (projectPath, dbManager, etc.)
 * @param {Function} context.addRecentProject - Function to add recent project
 * @param {Function} context.updateWindowTitle - Function to update window title
 */
function registerProjectHandlers(context) {
  const { mainWindow, logger, state, addRecentProject, updateWindowTitle } = context;

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

      state.projectPath = folderPath;

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
      state.dbManager = new DatabaseManager(dbPath);
      await state.dbManager.initialize();
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
      const importReport = await state.dbManager.importUsers(users);
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
      state.imageManager = new ImageManager(importsPath);
      logger.info('Image manager initialized');

      // Start folder watcher
      state.folderWatcher = new FolderWatcher(ingestPath, importsPath);
      state.folderWatcher.on('image-detecting', (filename) => {
        logger.info(`Image being processed: ${filename}`);
        mainWindow.webContents.send('image-detecting', filename);
      });
      state.folderWatcher.on('image-added', (filename) => {
        logger.info(`New image detected: ${filename}`);
        // Invalidate image cache when new image is added
        state.imageManager.invalidateCache();
        mainWindow.webContents.send('new-image-detected', filename);
      });
      state.folderWatcher.start();
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

      state.projectPath = folderPath;
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
      state.dbManager = new DatabaseManager(dbPath);
      await state.dbManager.initialize();
      logger.success('Database loaded successfully');

      // Initialize paths
      const ingestPath = path.join(folderPath, 'ingest');
      const importsPath = path.join(folderPath, 'imports');

      // Initialize image manager
      logger.section('INITIALIZING MANAGERS');
      state.imageManager = new ImageManager(importsPath);
      logger.info('Image manager initialized');

      // Start folder watcher
      state.folderWatcher = new FolderWatcher(ingestPath, importsPath);
      state.folderWatcher.on('image-detecting', (filename) => {
        logger.info(`Image being processed: ${filename}`);
        mainWindow.webContents.send('image-detecting', filename);
      });
      state.folderWatcher.on('image-added', (filename) => {
        logger.info(`New image detected: ${filename}`);
        // Invalidate image cache when new image is added
        state.imageManager.invalidateCache();
        mainWindow.webContents.send('new-image-detected', filename);
      });
      state.folderWatcher.start();
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
      if (!state.dbManager) {
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
      const currentUsers = await state.dbManager.getUsers({});
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
      if (!state.dbManager) {
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
      await state.dbManager.importUsers({ groups, students: [], teachers: [], nonTeachingStaff: [] });
      logger.success(`Groups updated: ${groups.length}`);

      // Progress: 70%
      mainWindow.webContents.send('progress', {
        percentage: 70,
        message: 'Procesando usuarios eliminados...',
        details: ''
      });

      // Process deleted users
      const deletedGroup = await context.ensureDeletedGroup();
      let movedToDeleted = 0;
      let permanentlyDeleted = 0;

      for (const user of deletedUsers) {
        if (user.image_path) {
          // Move to Eliminados group
          await state.dbManager.updateUser(user.id, { group_code: deletedGroup.code });
          movedToDeleted++;
          logger.info(`Moved user ${user.first_name} ${user.last_name1} to Eliminados group`);
        } else {
          // Delete from database
          await state.dbManager.deleteUser(user.id);
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
            await state.dbManager.updateUser(existingUser.id, {
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
            await state.dbManager.importUsers({
              groups: [],
              students: [newUser],
              teachers: [],
              nonTeachingStaff: []
            });
          } else if (newUser.type === 'teacher') {
            await state.dbManager.importUsers({
              groups: [],
              students: [],
              teachers: [newUser],
              nonTeachingStaff: []
            });
          } else if (newUser.type === 'non_teaching_staff') {
            await state.dbManager.importUsers({
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
}

module.exports = { registerProjectHandlers };