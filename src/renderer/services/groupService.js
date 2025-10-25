/**
 * Group Service
 *
 * Handles all group-related operations.
 * Wraps window.electronAPI calls for group management.
 *
 * @module services/groupService
 */

class GroupService {
  constructor() {
    this.electronAPI = window.electronAPI;
  }

  /**
   * Get all groups
   * @returns {Promise<object>} Result with groups array
   */
  async getGroups() {
    try {
      console.log('[GroupService] Getting groups');
      const result = await this.electronAPI.getGroups();
      console.log(`[GroupService] Got ${result.groups?.length || 0} groups`);
      return result;
    } catch (error) {
      console.error('[GroupService] Error getting groups:', error);
      throw error;
    }
  }

  /**
   * Get group by ID
   * @param {number} groupId - Group ID
   * @returns {Promise<object>} Result with group data
   */
  async getGroupById(groupId) {
    try {
      console.log('[GroupService] Getting group by ID:', groupId);
      const result = await this.electronAPI.getGroupById(groupId);
      return result;
    } catch (error) {
      console.error('[GroupService] Error getting group:', error);
      throw error;
    }
  }

  /**
   * Get users in a group
   * @param {number} groupId - Group ID
   * @returns {Promise<object>} Result with users array
   */
  async getUsersByGroup(groupId) {
    try {
      console.log('[GroupService] Getting users by group:', groupId);
      const result = await this.electronAPI.getUsersByGroup(groupId);
      console.log(`[GroupService] Found ${result.users?.length || 0} users in group`);
      return result;
    } catch (error) {
      console.error('[GroupService] Error getting users by group:', error);
      throw error;
    }
  }
}

// Export singleton instance
const groupService = new GroupService();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GroupService, groupService };
}
