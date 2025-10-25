/**
 * Project Service
 *
 * Handles all project-related operations (create, open, close, update XML).
 * Wraps window.electronAPI calls for project management.
 *
 * @module services/projectService
 */

class ProjectService {
  constructor() {
    this.electronAPI = window.electronAPI;
  }

  /**
   * Create a new project
   * @param {object} projectData - Project configuration
   * @param {string} projectData.folderPath - Project folder path
   * @param {string} projectData.xmlFilePath - XML file path
   * @returns {Promise<object>} Result with success status and data
   */
  async createProject(projectData) {
    try {
      console.log('[ProjectService] Creating project:', projectData);
      const result = await this.electronAPI.createProject(projectData);
      console.log('[ProjectService] Project created:', result);
      return result;
    } catch (error) {
      console.error('[ProjectService] Error creating project:', error);
      throw error;
    }
  }

  /**
   * Open an existing project
   * @param {string} folderPath - Project folder path
   * @returns {Promise<object>} Result with project data
   */
  async openProject(folderPath) {
    try {
      console.log('[ProjectService] Opening project:', folderPath);
      const result = await this.electronAPI.openProject(folderPath);
      console.log('[ProjectService] Project opened:', result);
      return result;
    } catch (error) {
      console.error('[ProjectService] Error opening project:', error);
      throw error;
    }
  }

  /**
   * Close current project
   * @returns {Promise<object>} Result
   */
  async closeProject() {
    try {
      console.log('[ProjectService] Closing project');
      const result = await this.electronAPI.closeProject();
      console.log('[ProjectService] Project closed');
      return result;
    } catch (error) {
      console.error('[ProjectService] Error closing project:', error);
      throw error;
    }
  }

  /**
   * Update project XML file
   * @param {string} xmlFilePath - New XML file path
   * @returns {Promise<object>} Result with updated users and groups
   */
  async updateXmlFile(xmlFilePath) {
    try {
      console.log('[ProjectService] Updating XML file:', xmlFilePath);
      const result = await this.electronAPI.updateXmlFile(xmlFilePath);
      console.log('[ProjectService] XML updated:', result);
      return result;
    } catch (error) {
      console.error('[ProjectService] Error updating XML:', error);
      throw error;
    }
  }

  /**
   * Get current project info
   * @returns {Promise<object>} Project information
   */
  async getProjectInfo() {
    try {
      const result = await this.electronAPI.getProjectInfo();
      return result;
    } catch (error) {
      console.error('[ProjectService] Error getting project info:', error);
      throw error;
    }
  }
}

// Export singleton instance
const projectService = new ProjectService();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ProjectService, projectService };
}
