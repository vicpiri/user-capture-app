const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPOSITORY_ROOT = path.join(__dirname, '../../../');

/**
 * Version Manager
 * Handles application version detection and formatting
 *
 * Results are memoised: the version cannot change while the app runs, and
 * resolving it spawns git processes, which are slow enough on Windows to be
 * noticeable at startup.
 */
class VersionManager {
  /**
   * Get the application version with DEV indicator if needed
   * @returns {string} Version string (e.g., "1.1.4" or "1.1.4-DEV")
   */
  static getVersion() {
    if (this._version === undefined) {
      this._version = this._resolveVersion();
    }

    return this._version;
  }

  /**
   * @private
   */
  static _resolveVersion() {
    try {
      const version = this.getPackageVersion();

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
   * Read the version declared in package.json
   * @returns {string}
   */
  static getPackageVersion() {
    const packageJsonPath = path.join(REPOSITORY_ROOT, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version;
  }

  /**
   * Check if current version is a development version
   * (has commits after the last release tag)
   * @returns {boolean} True if this is a dev version
   */
  static isDevVersion() {
    if (this._isDev !== undefined) {
      return this._isDev;
    }

    this._isDev = this._resolveIsDevVersion();
    return this._isDev;
  }

  /**
   * @private
   */
  static _resolveIsDevVersion() {
    // A packaged build ships no .git, so the git commands below could only
    // fail. Checking for the directory keeps release startups from paying for
    // a process spawn just to be told there is no repository.
    if (!fs.existsSync(path.join(REPOSITORY_ROOT, '.git'))) {
      return false;
    }

    try {
      // Get the latest tag
      const latestTag = execSync('git describe --tags --abbrev=0', {
        cwd: REPOSITORY_ROOT,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();

      // Get commits count between latest tag and HEAD
      const commitsSinceTag = execSync(`git rev-list ${latestTag}..HEAD --count`, {
        cwd: REPOSITORY_ROOT,
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
      const version = this.getPackageVersion();
      const isDev = this.isDevVersion();

      let commitHash = '';
      try {
        commitHash = execSync('git rev-parse --short HEAD', {
          cwd: REPOSITORY_ROOT,
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
