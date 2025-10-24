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
 * Get image repository path from config
 * @returns {string|null} Repository path or null
 */
function getImageRepositoryPath() {
  const config = loadGlobalConfig();
  return config.imageRepositoryPath || null;
}

/**
 * Set image repository path in config
 * @param {string} repositoryPath - Path to repository
 * @returns {boolean} Success status
 */
function setImageRepositoryPath(repositoryPath) {
  const config = loadGlobalConfig();
  config.imageRepositoryPath = repositoryPath;
  return saveGlobalConfig(config);
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