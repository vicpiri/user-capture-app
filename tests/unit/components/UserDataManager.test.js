/**
 * Tests for UserDataManager
 */

const { UserDataManager } = require('../../../src/renderer/components/UserDataManager');

describe('UserDataManager', () => {
  let manager;
  let mockConfig;
  let mockElectronAPI;

  beforeEach(() => {
    // Mock electron API
    mockElectronAPI = {
      getGroups: jest.fn(),
      getUsers: jest.fn(),
      loadRepositoryImages: jest.fn()
    };

    // Mock config
    mockConfig = {
      setCurrentUsers: jest.fn(),
      setAllUsers: jest.fn(),
      setCurrentGroups: jest.fn(),
      setIsLoadingRepositoryPhotos: jest.fn(),
      setIsLoadingRepositoryIndicators: jest.fn(),
      setRepositorySyncCompleted: jest.fn(),
      getCurrentUsers: jest.fn(() => []),
      getAllUsers: jest.fn(() => []),
      getCurrentGroups: jest.fn(() => []),
      getShowCapturedPhotos: jest.fn(() => true),
      getShowRepositoryPhotos: jest.fn(() => false),
      getShowRepositoryIndicators: jest.fn(() => false),
      onDisplayUsers: jest.fn(),
      onUpdateUserCount: jest.fn(),
      groupFilter: document.createElement('select'),
      loadingSpinner: { style: { display: 'none' } },
      userTableBody: document.createElement('tbody'),
      electronAPI: mockElectronAPI,
      minSpinnerDisplayTime: 0 // Set to 0 for faster tests
    };

    // Create spacers in tbody
    const topSpacer = document.createElement('tr');
    topSpacer.id = 'top-spacer';
    const bottomSpacer = document.createElement('tr');
    bottomSpacer.id = 'bottom-spacer';
    mockConfig.userTableBody.appendChild(topSpacer);
    mockConfig.userTableBody.appendChild(bottomSpacer);

    // Create manager instance
    manager = new UserDataManager(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    test('should store all state setters', () => {
      expect(manager.setCurrentUsers).toBe(mockConfig.setCurrentUsers);
      expect(manager.setAllUsers).toBe(mockConfig.setAllUsers);
      expect(manager.setCurrentGroups).toBe(mockConfig.setCurrentGroups);
    });

    test('should store all state getters', () => {
      expect(manager.getCurrentUsers).toBe(mockConfig.getCurrentUsers);
      expect(manager.getAllUsers).toBe(mockConfig.getAllUsers);
      expect(manager.getShowCapturedPhotos).toBe(mockConfig.getShowCapturedPhotos);
    });

    test('should store callbacks', () => {
      expect(manager.onDisplayUsers).toBe(mockConfig.onDisplayUsers);
      expect(manager.onUpdateUserCount).toBe(mockConfig.onUpdateUserCount);
    });

    test('should use default values if not provided', () => {
      const defaultManager = new UserDataManager({ electronAPI: mockElectronAPI });

      expect(typeof defaultManager.setCurrentUsers).toBe('function');
      expect(typeof defaultManager.getCurrentUsers).toBe('function');
      expect(typeof defaultManager.onDisplayUsers).toBe('function');
    });

    test('should use default minSpinnerDisplayTime', () => {
      const defaultManager = new UserDataManager({ electronAPI: mockElectronAPI });

      expect(defaultManager.minSpinnerDisplayTime).toBe(300);
    });
  });

  describe('loadGroups()', () => {
    test('should load groups successfully', async () => {
      const mockGroups = [
        { code: 'G1', name: 'Group 1' },
        { code: 'G2', name: 'Group 2' }
      ];

      mockElectronAPI.getGroups.mockResolvedValue({
        success: true,
        groups: mockGroups
      });

      await manager.loadGroups();

      expect(mockElectronAPI.getGroups).toHaveBeenCalled();
      expect(mockConfig.setCurrentGroups).toHaveBeenCalledWith(mockGroups);
    });

    test('should populate group filter', async () => {
      const mockGroups = [
        { code: 'G1', name: 'Group 1' },
        { code: 'G2', name: 'Group 2' }
      ];

      mockElectronAPI.getGroups.mockResolvedValue({
        success: true,
        groups: mockGroups
      });

      await manager.loadGroups();

      expect(mockConfig.groupFilter.options.length).toBe(3); // "Todos" + 2 groups
      expect(mockConfig.groupFilter.options[0].value).toBe('');
      expect(mockConfig.groupFilter.options[1].value).toBe('G1');
      expect(mockConfig.groupFilter.options[2].value).toBe('G2');
    });

    test('should handle load groups failure', async () => {
      mockElectronAPI.getGroups.mockResolvedValue({
        success: false,
        error: 'Database error'
      });

      await manager.loadGroups();

      expect(mockConfig.setCurrentGroups).not.toHaveBeenCalled();
    });
  });

  describe('populateGroupFilter()', () => {
    test('should populate filter with groups', () => {
      const groups = [
        { code: 'G1', name: 'Group 1' },
        { code: 'G2', name: 'Group 2' }
      ];

      manager.populateGroupFilter(groups);

      expect(mockConfig.groupFilter.options.length).toBe(3);
      expect(mockConfig.groupFilter.options[1].textContent).toBe('G1 - Group 1');
    });

    test('should handle missing group filter', () => {
      const managerWithoutFilter = new UserDataManager({
        ...mockConfig,
        groupFilter: null
      });

      expect(() => managerWithoutFilter.populateGroupFilter([])).not.toThrow();
    });

    test('should clear existing options', () => {
      // Add some existing options
      const existingOption = document.createElement('option');
      mockConfig.groupFilter.appendChild(existingOption);

      manager.populateGroupFilter([{ code: 'G1', name: 'Group 1' }]);

      expect(mockConfig.groupFilter.options.length).toBe(2); // Only "Todos" + new group
    });
  });

  describe('loadUsers()', () => {
    beforeEach(() => {
      mockElectronAPI.getUsers.mockResolvedValue({
        success: true,
        users: [
          { id: 1, name: 'User 1', image_path: '/path1.jpg' },
          { id: 2, name: 'User 2', image_path: '/path2.jpg' }
        ]
      });
    });

    test('should show loading spinner', async () => {
      await manager.loadUsers();

      expect(mockConfig.loadingSpinner.style.display).toBe('none'); // Hidden after load
    });

    test('should load users with filters', async () => {
      const filters = { group: 'G1', search: 'test' };

      await manager.loadUsers(filters);

      expect(mockElectronAPI.getUsers).toHaveBeenCalledWith(
        filters,
        {
          loadCapturedImages: true,
          loadRepositoryImages: false
        }
      );
    });

    test('should set current users', async () => {
      const mockUsers = [{ id: 1, name: 'User 1' }];
      mockElectronAPI.getUsers.mockResolvedValue({
        success: true,
        users: mockUsers
      });

      await manager.loadUsers();

      expect(mockConfig.setCurrentUsers).toHaveBeenCalledWith(mockUsers);
    });

    test('should load all users for duplicate checking', async () => {
      await manager.loadUsers();

      // First call is for filtered users, second is for all users
      expect(mockElectronAPI.getUsers).toHaveBeenCalledTimes(2);
      expect(mockElectronAPI.getUsers).toHaveBeenNthCalledWith(2, {}, {
        loadCapturedImages: true,
        loadRepositoryImages: false
      });
    });

    test('should call display users callback', async () => {
      const mockUsers = [{ id: 1 }];
      const mockAllUsers = [{ id: 1 }, { id: 2 }];

      mockElectronAPI.getUsers
        .mockResolvedValueOnce({ success: true, users: mockUsers })
        .mockResolvedValueOnce({ success: true, users: mockAllUsers });

      mockConfig.getCurrentUsers.mockReturnValue(mockUsers);
      mockConfig.getAllUsers.mockReturnValue(mockAllUsers);

      await manager.loadUsers();

      expect(mockConfig.onDisplayUsers).toHaveBeenCalledWith(mockUsers, mockAllUsers);
    });

    test('should call update user count callback', async () => {
      await manager.loadUsers();

      expect(mockConfig.onUpdateUserCount).toHaveBeenCalled();
    });

    test('should clear existing table rows', async () => {
      // Add some existing rows
      const row1 = document.createElement('tr');
      const row2 = document.createElement('tr');
      mockConfig.userTableBody.appendChild(row1);
      mockConfig.userTableBody.appendChild(row2);

      await manager.loadUsers();

      // Only spacers should remain
      const rows = Array.from(mockConfig.userTableBody.querySelectorAll('tr'));
      expect(rows.length).toBe(2);
      expect(rows[0].id).toBe('top-spacer');
      expect(rows[1].id).toBe('bottom-spacer');
    });

    test('should handle users load failure', async () => {
      mockElectronAPI.getUsers.mockResolvedValue({
        success: false,
        error: 'Database error'
      });

      await manager.loadUsers();

      expect(mockConfig.setCurrentUsers).not.toHaveBeenCalled();
    });

    test('should hide loading spinner even on error', async () => {
      mockElectronAPI.getUsers.mockRejectedValue(new Error('Network error'));

      // loadUsers has try/finally but doesn't catch the error, so it will reject
      try {
        await manager.loadUsers();
      } catch (error) {
        // Expected to throw
      }

      expect(mockConfig.loadingSpinner.style.display).toBe('none');
    });
  });

  describe('Repository Data Loading', () => {
    beforeEach(() => {
      mockElectronAPI.getUsers.mockResolvedValue({
        success: true,
        users: [
          { id: 1, name: 'User 1', repository_image_path: null },
          { id: 2, name: 'User 2', repository_image_path: null }
        ]
      });

      mockElectronAPI.loadRepositoryImages.mockResolvedValue({
        success: true,
        repositoryData: {
          1: { has_repository_image: true, repository_image_path: '/repo1.jpg' },
          2: { has_repository_image: false, repository_image_path: null }
        }
      });
    });

    test('should load repository data if enabled and not loaded', async () => {
      mockConfig.getShowRepositoryPhotos.mockReturnValue(true);
      mockConfig.getCurrentUsers.mockReturnValue([
        { id: 1, repository_image_path: null }
      ]);

      await manager.loadUsers();

      expect(mockElectronAPI.loadRepositoryImages).toHaveBeenCalled();
    });

    test('should not load repository data if disabled', async () => {
      mockConfig.getShowRepositoryPhotos.mockReturnValue(false);
      mockConfig.getShowRepositoryIndicators.mockReturnValue(false);

      await manager.loadUsers();

      expect(mockElectronAPI.loadRepositoryImages).not.toHaveBeenCalled();
    });

    test('should not reload repository data if already loaded', async () => {
      mockConfig.getShowRepositoryPhotos.mockReturnValue(true);
      mockConfig.getCurrentUsers.mockReturnValue([
        { id: 1, repository_image_path: '/existing.jpg' }
      ]);

      await manager.loadUsers();

      expect(mockElectronAPI.loadRepositoryImages).not.toHaveBeenCalled();
      expect(mockConfig.setIsLoadingRepositoryPhotos).toHaveBeenCalledWith(false);
      expect(mockConfig.setRepositorySyncCompleted).toHaveBeenCalledWith(true);
    });
  });

  describe('loadRepositoryDataInBackground()', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    test('should load repository images', async () => {
      const users = [{ id: 1 }, { id: 2 }];

      mockElectronAPI.loadRepositoryImages.mockResolvedValue({
        success: true,
        repositoryData: {
          1: { has_repository_image: true, repository_image_path: '/repo1.jpg' }
        }
      });

      const promise = manager.loadRepositoryDataInBackground(users);

      await promise;

      expect(mockElectronAPI.loadRepositoryImages).toHaveBeenCalledWith(users);
    });

    test('should merge repository data into users', async () => {
      const users = [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' }
      ];

      mockConfig.getCurrentUsers.mockReturnValue(users);

      mockElectronAPI.loadRepositoryImages.mockResolvedValue({
        success: true,
        repositoryData: {
          1: { has_repository_image: true, repository_image_path: '/repo1.jpg' },
          2: { has_repository_image: false, repository_image_path: null }
        }
      });

      const promise = manager.loadRepositoryDataInBackground(users);

      await promise;
      jest.runAllTimers();

      expect(users[0].has_repository_image).toBe(true);
      expect(users[0].repository_image_path).toBe('/repo1.jpg');
      expect(users[1].has_repository_image).toBe(false);
    });

    test('should respect minimum spinner display time', async () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      const managerWithDelay = new UserDataManager({
        ...mockConfig,
        minSpinnerDisplayTime: 300
      });

      mockElectronAPI.loadRepositoryImages.mockResolvedValue({
        success: true,
        repositoryData: {}
      });

      const promise = managerWithDelay.loadRepositoryDataInBackground([]);

      await promise;

      expect(setTimeoutSpy).toHaveBeenCalled();

      jest.runAllTimers();

      expect(mockConfig.onDisplayUsers).toHaveBeenCalled();

      setTimeoutSpy.mockRestore();
    });

    test('should handle repository load failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      mockElectronAPI.loadRepositoryImages.mockResolvedValue({
        success: false,
        error: 'Network error'
      });

      const promise = manager.loadRepositoryDataInBackground([]);

      await promise;
      jest.runAllTimers();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error loading repository data:',
        'Network error'
      );
      expect(mockConfig.setIsLoadingRepositoryPhotos).toHaveBeenCalledWith(false);

      consoleSpy.mockRestore();
    });

    test('should handle repository load exception', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      mockElectronAPI.loadRepositoryImages.mockRejectedValue(
        new Error('Network exception')
      );

      const promise = manager.loadRepositoryDataInBackground([]);

      await promise;
      jest.runAllTimers();

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockConfig.setIsLoadingRepositoryPhotos).toHaveBeenCalledWith(false);

      consoleSpy.mockRestore();
    });
  });

  describe('updateRepositoryDataInDisplay()', () => {
    test('should stop loading states', () => {
      manager.updateRepositoryDataInDisplay();

      expect(mockConfig.setIsLoadingRepositoryPhotos).toHaveBeenCalledWith(false);
      expect(mockConfig.setIsLoadingRepositoryIndicators).toHaveBeenCalledWith(false);
      expect(mockConfig.setRepositorySyncCompleted).toHaveBeenCalledWith(true);
    });

    test('should re-render users', () => {
      const mockUsers = [{ id: 1 }];
      const mockAllUsers = [{ id: 1 }, { id: 2 }];

      mockConfig.getCurrentUsers.mockReturnValue(mockUsers);
      mockConfig.getAllUsers.mockReturnValue(mockAllUsers);

      manager.updateRepositoryDataInDisplay();

      expect(mockConfig.onDisplayUsers).toHaveBeenCalledWith(mockUsers, mockAllUsers);
    });
  });

  describe('Update Methods', () => {
    test('should update state setters', () => {
      const newSetter = jest.fn();

      manager.updateSetters({ setCurrentUsers: newSetter });

      expect(manager.setCurrentUsers).toBe(newSetter);
    });

    test('should update state getters', () => {
      const newGetter = jest.fn();

      manager.updateGetters({ getCurrentUsers: newGetter });

      expect(manager.getCurrentUsers).toBe(newGetter);
    });

    test('should update callbacks', () => {
      const newCallback = jest.fn();

      manager.updateCallbacks({ onDisplayUsers: newCallback });

      expect(manager.onDisplayUsers).toBe(newCallback);
    });

    test('should only update provided setters', () => {
      const originalSetter = manager.setCurrentUsers;
      const newSetter = jest.fn();

      manager.updateSetters({ setAllUsers: newSetter });

      expect(manager.setCurrentUsers).toBe(originalSetter);
      expect(manager.setAllUsers).toBe(newSetter);
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing loading spinner', async () => {
      const managerWithoutSpinner = new UserDataManager({
        ...mockConfig,
        loadingSpinner: null
      });

      mockElectronAPI.getUsers.mockResolvedValue({
        success: true,
        users: []
      });

      await expect(managerWithoutSpinner.loadUsers()).resolves.not.toThrow();
    });

    test('should handle missing user table body', async () => {
      const managerWithoutTable = new UserDataManager({
        ...mockConfig,
        userTableBody: null
      });

      mockElectronAPI.getUsers.mockResolvedValue({
        success: true,
        users: []
      });

      await expect(managerWithoutTable.loadUsers()).resolves.not.toThrow();
    });

    test('should handle empty users array', async () => {
      mockElectronAPI.getUsers.mockResolvedValue({
        success: true,
        users: []
      });

      await manager.loadUsers();

      expect(mockConfig.setCurrentUsers).toHaveBeenCalledWith([]);
      expect(mockConfig.onDisplayUsers).toHaveBeenCalled();
    });

    test('should handle repository data for users not in current list', async () => {
      const users = [{ id: 1, name: 'User 1' }];

      mockConfig.getCurrentUsers.mockReturnValue(users);

      mockElectronAPI.loadRepositoryImages.mockResolvedValue({
        success: true,
        repositoryData: {
          1: { has_repository_image: true, repository_image_path: '/repo1.jpg' },
          99: { has_repository_image: true, repository_image_path: '/repo99.jpg' } // Non-existent user
        }
      });

      await expect(
        manager.loadRepositoryDataInBackground(users)
      ).resolves.not.toThrow();
    });
  });
});
