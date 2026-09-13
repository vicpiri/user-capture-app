/**
 * Update Handlers - IPC surface of the update checker
 *
 * Thin layer over UpdateManager: the renderer asks for a manual check, skips a
 * version or opens a release page. Status updates travel the other way through
 * the 'update-status' event that UpdateManager sends on its own.
 */

const { ipcMain } = require('electron');

/**
 * @param {Object} context
 * @param {Function} context.updateManager - () => UpdateManager
 * @param {Object} context.logger
 */
function registerUpdateHandlers(context) {
  const { logger } = context;
  const manager = () => context.updateManager();

  // Manual check from the Help menu or the About dialog
  ipcMain.handle('check-for-updates', async () => {
    try {
      const updateManager = manager();
      if (!updateManager) {
        return { status: 'unsupported', manual: true };
      }
      return await updateManager.checkForUpdates({ manual: true });
    } catch (error) {
      logger.error('[Updates] Manual check failed:', error);
      return { status: 'error', manual: true, message: error.message };
    }
  });

  ipcMain.handle('skip-update-version', async (event, version) => {
    try {
      manager()?.skipVersion(version);
      return { success: true };
    } catch (error) {
      logger.error('[Updates] Could not skip version:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('open-release-page', async (event, version) => {
    try {
      await manager()?.openReleasePage(version);
      return { success: true };
    } catch (error) {
      logger.error('[Updates] Could not open release page:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerUpdateHandlers };
