/**
 * Global configuration management utilities
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * Get path to global config file
 * @returns {string} Path to config.json
 */
function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

/**
 * Load global configuration from file
 * @returns {Object} Configuration object
 */
function loadGlobalConfig() {
  try {
    const filePath = getConfigPath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading global config:', error);
  }
  return {};
}

/**
 * Save global configuration to file
 * @param {Object} config - Configuration object to save
 * @returns {boolean} Success status
 */
function saveGlobalConfig(config) {
  try {
    const filePath = getConfigPath();
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving global config:', error);
    return false;
  }
}

/**
 * Get image repository path from project database
 * @param {Object} dbManager - Database manager instance
 * @returns {Promise<string|null>} Repository path or null
 */
async function getImageRepositoryPath(dbManager) {
  if (!dbManager) {
    return null;
  }
  try {
    return await dbManager.getProjectSetting('imageRepositoryPath');
  } catch (error) {
    console.error('Error getting repository path:', error);
    return null;
  }
}

/**
 * Set image repository path in project database
 * @param {Object} dbManager - Database manager instance
 * @param {string} repositoryPath - Path to repository
 * @returns {Promise<boolean>} Success status
 */
async function setImageRepositoryPath(dbManager, repositoryPath) {
  if (!dbManager) {
    return false;
  }
  try {
    await dbManager.setProjectSetting('imageRepositoryPath', repositoryPath);
    return true;
  } catch (error) {
    console.error('Error setting repository path:', error);
    return false;
  }
}

/**
 * Get selected group filter from config
 * @returns {string} Group code filter
 */
function getSelectedGroupFilter() {
  const config = loadGlobalConfig();
  return config.selectedGroupFilter || '';
}

/**
 * Set selected group filter in config
 * @param {string} groupCode - Group code to filter by
 * @returns {boolean} Success status
 */
function setSelectedGroupFilter(groupCode) {
  const config = loadGlobalConfig();
  config.selectedGroupFilter = groupCode;
  return saveGlobalConfig(config);
}

/**
 * Save display preferences to config
 * @param {Object} preferences - Display preferences object
 * @returns {boolean} Success status
 */
function saveDisplayPreferences(preferences) {
  const config = loadGlobalConfig();
  config.showDuplicatesOnly = preferences.showDuplicatesOnly;
  config.showCardPrintRequestsOnly = preferences.showCardPrintRequestsOnly;
  config.showCapturedPhotos = preferences.showCapturedPhotos;
  config.showRepositoryPhotos = preferences.showRepositoryPhotos;
  config.showRepositoryIndicators = preferences.showRepositoryIndicators;
  config.showAdditionalActions = preferences.showAdditionalActions;
  return saveGlobalConfig(config);
}

module.exports = {
  getConfigPath,
  loadGlobalConfig,
  saveGlobalConfig,
  getImageRepositoryPath,
  setImageRepositoryPath,
  getSelectedGroupFilter,
  setSelectedGroupFilter,
  saveDisplayPreferences
};