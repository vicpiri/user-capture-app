const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Version Manager
 * Handles application version detection and formatting
 */
class VersionManager {
  /**
   * Get the application version with DEV indicator if needed
   * @returns {string} Version string (e.g., "1.1.4" or "1.1.4-DEV")
   */
  static getVersion() {
    try {
      // Get version from package.json
      const packageJsonPath = path.join(__dirname, '../../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const version = packageJson.version;

      // Check if we're in a git repository and if there are commits after the last tag
      if (this.isDevVersion()) {
        return `${version}-DEV`;
      }

      return version;
    } catch (error) {
      console.error('Error getting version:', error);
      return '0.0.0';
    }
  }

  /**
   * Check if current version is a development version
   * (has commits after the last release tag)
   * @returns {boolean} True if this is a dev version
   */
  static isDevVersion() {
    try {
      // Check if we're in a git repository
      execSync('git rev-parse --git-dir', { stdio: 'ignore' });

      // Get the latest tag
      const latestTag = execSync('git describe --tags --abbrev=0', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();

      // Get commits count between latest tag and HEAD
      const commitsSinceTag = execSync(`git rev-list ${latestTag}..HEAD --count`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();

      // If there are commits after the tag, it's a dev version
      return parseInt(commitsSinceTag, 10) > 0;
    } catch (error) {
      // If git is not available or there are no tags, assume it's not a dev version
      return false;
    }
  }

  /**
   * Get detailed version info
   * @returns {Object} Version details
   */
  static getVersionInfo() {
    try {
      const packageJsonPath = path.join(__dirname, '../../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const version = packageJson.version;
      const isDev = this.isDevVersion();

      let commitHash = '';
      try {
        commitHash = execSync('git rev-parse --short HEAD', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore']
        }).trim();
      } catch (error) {
        // Git not available or not in a git repo
      }

      return {
        version,
        isDev,
        fullVersion: isDev ? `${version}-DEV` : version,
        commitHash
      };
    } catch (error) {
      console.error('Error getting version info:', error);
      return {
        version: '0.0.0',
        isDev: false,
        fullVersion: '0.0.0',
        commitHash: ''
      };
    }
  }
}

module.exports = VersionManager;
