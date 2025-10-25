/**
 * User Service
 *
 * Handles all user-related operations (CRUD, filtering, search).
 * Wraps window.electronAPI calls for user management.
 *
 * @module services/userService
 */

class UserService {
  constructor() {
    this.electronAPI = window.electronAPI;
  }

  /**
   * Get all users with optional filters
   * @param {object} filters - Filter criteria
   * @param {number} filters.groupId - Filter by group ID
   * @param {string} filters.search - Search term
   * @param {boolean} filters.duplicatesOnly - Show only duplicates
   * @param {object} options - Query options
   * @param {string} options.orderBy - Order by field
   * @param {string} options.order - ASC or DESC
   * @returns {Promise<object>} Result with users array
   */
  async getUsers(filters = {}, options = {}) {
    try {
      console.log('[UserService] Getting users:', { filters, options });
      const result = await this.electronAPI.getUsers(filters, options);
      console.log(`[UserService] Got ${result.users?.length || 0} users`);
      return result;
    } catch (error) {
      console.error('[UserService] Error getting users:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param {number} userId - User ID
   * @returns {Promise<object>} Result with user data
   */
  async getUserById(userId) {
    try {
      console.log('[UserService] Getting user by ID:', userId);
      const result = await this.electronAPI.getUserById(userId);
      return result;
    } catch (error) {
      console.error('[UserService] Error getting user:', error);
      throw error;
    }
  }

  /**
   * Update user
   * @param {number} userId - User ID
   * @param {object} updates - Fields to update
   * @returns {Promise<object>} Result
   */
  async updateUser(userId, updates) {
    try {
      console.log('[UserService] Updating user:', userId, updates);
      const result = await this.electronAPI.updateUser(userId, updates);
      console.log('[UserService] User updated');
      return result;
    } catch (error) {
      console.error('[UserService] Error updating user:', error);
      throw error;
    }
  }

  /**
   * Delete user
   * @param {number} userId - User ID
   * @returns {Promise<object>} Result
   */
  async deleteUser(userId) {
    try {
      console.log('[UserService] Deleting user:', userId);
      const result = await this.electronAPI.deleteUser(userId);
      console.log('[UserService] User deleted');
      return result;
    } catch (error) {
      console.error('[UserService] Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Get users with duplicate image assignments
   * @returns {Promise<object>} Result with duplicates map
   */
  async getDuplicates() {
    try {
      console.log('[UserService] Getting duplicates');
      const result = await this.electronAPI.getDuplicates();
      console.log(`[UserService] Found ${Object.keys(result.duplicates || {}).length} duplicate groups`);
      return result;
    } catch (error) {
      console.error('[UserService] Error getting duplicates:', error);
      throw error;
    }
  }

  /**
   * Search users
   * @param {string} searchTerm - Search term
   * @returns {Promise<object>} Result with matching users
   */
  async searchUsers(searchTerm) {
    try {
      console.log('[UserService] Searching users:', searchTerm);
      const result = await this.electronAPI.searchUsers(searchTerm);
      console.log(`[UserService] Found ${result.users?.length || 0} matching users`);
      return result;
    } catch (error) {
      console.error('[UserService] Error searching users:', error);
      throw error;
    }
  }
}

// Export singleton instance
const userService = new UserService();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UserService, userService };
}
