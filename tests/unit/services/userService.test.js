/**
 * Tests for UserService
 */

const { UserService } = require('../../../src/renderer/services/userService');

describe('UserService', () => {
  let userService;
  let mockElectronAPI;

  beforeEach(() => {
    // Mock window.electronAPI
    mockElectronAPI = {
      getUsers: jest.fn(),
      getUserById: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      getDuplicates: jest.fn(),
      searchUsers: jest.fn()
    };

    global.window = { electronAPI: mockElectronAPI };
    userService = new UserService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUsers', () => {
    test('should call electronAPI.getUsers with filters and options', async () => {
      const mockUsers = [
        { id: 1, nombre: 'User 1' },
        { id: 2, nombre: 'User 2' }
      ];

      mockElectronAPI.getUsers.mockResolvedValue({
        success: true,
        users: mockUsers
      });

      const filters = { groupId: 1 };
      const options = { orderBy: 'nombre' };

      const result = await userService.getUsers(filters, options);

      expect(mockElectronAPI.getUsers).toHaveBeenCalledWith(filters, options);
      expect(result.success).toBe(true);
      expect(result.users).toEqual(mockUsers);
    });

    test('should handle empty filters and options', async () => {
      mockElectronAPI.getUsers.mockResolvedValue({
        success: true,
        users: []
      });

      await userService.getUsers();

      expect(mockElectronAPI.getUsers).toHaveBeenCalledWith({}, {});
    });

    test('should throw error on failure', async () => {
      const error = new Error('Failed to get users');
      mockElectronAPI.getUsers.mockRejectedValue(error);

      await expect(userService.getUsers()).rejects.toThrow('Failed to get users');
    });
  });

  describe('getUserById', () => {
    test('should call electronAPI.getUserById with userId', async () => {
      const mockUser = { id: 1, nombre: 'Test User' };

      mockElectronAPI.getUserById.mockResolvedValue({
        success: true,
        user: mockUser
      });

      const result = await userService.getUserById(1);

      expect(mockElectronAPI.getUserById).toHaveBeenCalledWith(1);
      expect(result.user).toEqual(mockUser);
    });

    test('should throw error on failure', async () => {
      mockElectronAPI.getUserById.mockRejectedValue(new Error('User not found'));

      await expect(userService.getUserById(999)).rejects.toThrow('User not found');
    });
  });

  describe('updateUser', () => {
    test('should call electronAPI.updateUser with userId and updates', async () => {
      mockElectronAPI.updateUser.mockResolvedValue({
        success: true
      });

      const updates = { nombre: 'Updated Name' };
      const result = await userService.updateUser(1, updates);

      expect(mockElectronAPI.updateUser).toHaveBeenCalledWith(1, updates);
      expect(result.success).toBe(true);
    });

    test('should throw error on failure', async () => {
      mockElectronAPI.updateUser.mockRejectedValue(new Error('Update failed'));

      await expect(userService.updateUser(1, {})).rejects.toThrow('Update failed');
    });
  });

  describe('deleteUser', () => {
    test('should call electronAPI.deleteUser with userId', async () => {
      mockElectronAPI.deleteUser.mockResolvedValue({
        success: true
      });

      const result = await userService.deleteUser(1);

      expect(mockElectronAPI.deleteUser).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
    });

    test('should throw error on failure', async () => {
      mockElectronAPI.deleteUser.mockRejectedValue(new Error('Delete failed'));

      await expect(userService.deleteUser(1)).rejects.toThrow('Delete failed');
    });
  });

  describe('getDuplicates', () => {
    test('should call electronAPI.getDuplicates', async () => {
      const mockDuplicates = {
        'image1.jpg': [1, 2, 3]
      };

      mockElectronAPI.getDuplicates.mockResolvedValue({
        success: true,
        duplicates: mockDuplicates
      });

      const result = await userService.getDuplicates();

      expect(mockElectronAPI.getDuplicates).toHaveBeenCalled();
      expect(result.duplicates).toEqual(mockDuplicates);
    });
  });

  describe('searchUsers', () => {
    test('should call electronAPI.searchUsers with search term', async () => {
      const mockUsers = [
        { id: 1, nombre: 'John Doe' }
      ];

      mockElectronAPI.searchUsers.mockResolvedValue({
        success: true,
        users: mockUsers
      });

      const result = await userService.searchUsers('John');

      expect(mockElectronAPI.searchUsers).toHaveBeenCalledWith('John');
      expect(result.users).toEqual(mockUsers);
    });

    test('should throw error on failure', async () => {
      mockElectronAPI.searchUsers.mockRejectedValue(new Error('Search failed'));

      await expect(userService.searchUsers('test')).rejects.toThrow('Search failed');
    });
  });

  describe('logging', () => {
    test('should log service calls', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      mockElectronAPI.getUsers.mockResolvedValue({
        success: true,
        users: []
      });

      await userService.getUsers();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[UserService]'),
        expect.anything()
      );

      consoleLogSpy.mockRestore();
    });

    test('should log errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      mockElectronAPI.getUsers.mockRejectedValue(new Error('Test error'));

      await expect(userService.getUsers()).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[UserService]'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
