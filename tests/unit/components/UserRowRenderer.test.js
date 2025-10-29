/**
 * Tests for UserRowRenderer
 */

const { UserRowRenderer } = require('../../../src/renderer/components/UserRowRenderer');

describe('UserRowRenderer', () => {
  let renderer;
  let mockUser;
  let mockCallbacks;

  beforeEach(() => {
    // Mock user data
    mockUser = {
      id: 1,
      first_name: 'John',
      last_name1: 'Doe',
      last_name2: 'Smith',
      nia: '12345',
      group_code: 'A1',
      image_path: '/path/to/image.jpg',
      repository_image_path: '/path/to/repo/image.jpg'
    };

    // Mock callbacks
    mockCallbacks = {
      onUserSelect: jest.fn(),
      onUserContextMenu: jest.fn(),
      onImagePreview: jest.fn(),
      onCheckboxToggle: jest.fn()
    };

    // Create renderer instance
    renderer = new UserRowRenderer(mockCallbacks);
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(renderer.config.showCapturedPhotos).toBe(true);
      expect(renderer.config.showRepositoryPhotos).toBe(false);
      expect(renderer.config.showRepositoryIndicators).toBe(false);
      expect(renderer.config.selectionMode).toBe(false);
    });

    test('should initialize with custom configuration', () => {
      const customRenderer = new UserRowRenderer({
        showCapturedPhotos: false,
        showRepositoryPhotos: true,
        selectionMode: true,
        selectedUsers: new Set([1, 2])
      });

      expect(customRenderer.config.showCapturedPhotos).toBe(false);
      expect(customRenderer.config.showRepositoryPhotos).toBe(true);
      expect(customRenderer.config.selectionMode).toBe(true);
      expect(customRenderer.config.selectedUsers.size).toBe(2);
    });

    test('should set callbacks', () => {
      expect(renderer.onUserSelect).toBe(mockCallbacks.onUserSelect);
      expect(renderer.onImagePreview).toBe(mockCallbacks.onImagePreview);
    });
  });

  describe('updateConfig()', () => {
    test('should update configuration', () => {
      renderer.updateConfig({
        showCapturedPhotos: false,
        selectionMode: true
      });

      expect(renderer.config.showCapturedPhotos).toBe(false);
      expect(renderer.config.selectionMode).toBe(true);
    });

    test('should preserve unchanged configuration', () => {
      renderer.updateConfig({ selectionMode: true });

      expect(renderer.config.showCapturedPhotos).toBe(true); // Unchanged
      expect(renderer.config.selectionMode).toBe(true); // Changed
    });
  });

  describe('createRow()', () => {
    test('should create a table row element', () => {
      const row = renderer.createRow(mockUser);

      expect(row.tagName).toBe('TR');
      expect(row.dataset.userId).toBe('1');
    });

    test('should include user data in row', () => {
      const row = renderer.createRow(mockUser);

      expect(row.textContent).toContain('John');
      expect(row.textContent).toContain('Doe');
      expect(row.textContent).toContain('Smith');
      expect(row.textContent).toContain('12345');
      expect(row.textContent).toContain('A1');
    });

    test('should show captured photo indicator when enabled', () => {
      renderer.updateConfig({ showCapturedPhotos: true });
      const row = renderer.createRow(mockUser);

      const photoIndicator = row.querySelector('.photo-indicator');
      expect(photoIndicator).toBeTruthy();
      expect(photoIndicator.getAttribute('data-src')).toContain('image.jpg');
    });

    test('should hide captured photo indicator when disabled', () => {
      renderer.updateConfig({ showCapturedPhotos: false });
      const row = renderer.createRow(mockUser);

      const photoIndicator = row.querySelector('.photo-indicator');
      expect(photoIndicator).toBeFalsy();
    });

    test('should show repository photo indicator when enabled', () => {
      renderer.updateConfig({ showRepositoryPhotos: true });
      const row = renderer.createRow(mockUser);

      const repoIndicator = row.querySelector('.repository-indicator');
      expect(repoIndicator).toBeTruthy();
      expect(repoIndicator.getAttribute('data-src')).toContain('repo/image.jpg');
    });

    test('should show photo placeholder when user has no image', () => {
      const userWithoutImage = { ...mockUser, image_path: null };
      const row = renderer.createRow(userWithoutImage);

      const placeholder = row.querySelector('.photo-placeholder');
      expect(placeholder).toBeTruthy();
    });

    test('should show duplicate indicator for duplicate images', () => {
      const imageCount = { '/path/to/image.jpg': 2 };
      const row = renderer.createRow(mockUser, imageCount);

      const photoWrapper = row.querySelector('.photo-indicator-wrapper');
      expect(photoWrapper.classList.contains('duplicate-image')).toBe(true);
    });

    test('should not show duplicate indicator for unique images', () => {
      const imageCount = { '/path/to/image.jpg': 1 };
      const row = renderer.createRow(mockUser, imageCount);

      const photoWrapper = row.querySelector('.photo-indicator-wrapper');
      expect(photoWrapper.classList.contains('duplicate-image')).toBe(false);
    });

    test('should show checkbox in selection mode', () => {
      renderer.updateConfig({ selectionMode: true });
      const row = renderer.createRow(mockUser);

      const checkbox = row.querySelector('.user-checkbox');
      expect(checkbox).toBeTruthy();
    });

    test('should check checkbox for selected users', () => {
      renderer.updateConfig({
        selectionMode: true,
        selectedUsers: new Set([1])
      });
      const row = renderer.createRow(mockUser);

      const checkbox = row.querySelector('.user-checkbox');
      expect(checkbox.checked).toBe(true);
    });

    test('should not check checkbox for unselected users', () => {
      renderer.updateConfig({
        selectionMode: true,
        selectedUsers: new Set([2, 3])
      });
      const row = renderer.createRow(mockUser);

      const checkbox = row.querySelector('.user-checkbox');
      expect(checkbox.checked).toBe(false);
    });

    test('should hide checkbox when not in selection mode', () => {
      renderer.updateConfig({ selectionMode: false });
      const row = renderer.createRow(mockUser);

      const checkbox = row.querySelector('.user-checkbox');
      expect(checkbox).toBeFalsy();
    });

    test('should show loading spinner for repository photos', () => {
      const userWithoutRepo = { ...mockUser, repository_image_path: null };
      renderer.updateConfig({
        showRepositoryPhotos: true,
        isLoadingRepositoryPhotos: true
      });
      const row = renderer.createRow(userWithoutRepo);

      const loading = row.querySelector('.repository-placeholder.loading');
      expect(loading).toBeTruthy();
      expect(loading.querySelector('.spinner-small')).toBeTruthy();
    });

    test('should show repository check indicator when enabled', () => {
      renderer.updateConfig({ showRepositoryIndicators: true });
      const row = renderer.createRow(mockUser);

      const checkIndicator = row.querySelector('.repository-check');
      expect(checkIndicator).toBeTruthy();
    });
  });

  describe('Event Listeners', () => {
    test('should call onUserSelect when row is clicked', () => {
      const row = renderer.createRow(mockUser);

      row.click();

      expect(mockCallbacks.onUserSelect).toHaveBeenCalledWith(row, mockUser);
    });

    test('should call onUserContextMenu on right-click', () => {
      const row = renderer.createRow(mockUser);
      const event = new MouseEvent('contextmenu', { bubbles: true });

      row.dispatchEvent(event);

      expect(mockCallbacks.onUserContextMenu).toHaveBeenCalled();
      expect(mockCallbacks.onUserContextMenu.mock.calls[0][1]).toBe(mockUser);
    });

    test('should call onCheckboxToggle when checkbox is clicked', () => {
      renderer.updateConfig({ selectionMode: true });
      const row = renderer.createRow(mockUser);
      const checkbox = row.querySelector('.user-checkbox');

      checkbox.click();

      expect(mockCallbacks.onCheckboxToggle).toHaveBeenCalledWith(1, true);
    });

    test('should call onImagePreview on captured photo double-click', () => {
      const row = renderer.createRow(mockUser);
      const photoIndicator = row.querySelector('.photo-indicator');

      const event = new MouseEvent('dblclick', { bubbles: true });
      photoIndicator.dispatchEvent(event);

      expect(mockCallbacks.onImagePreview).toHaveBeenCalledWith(mockUser, 'captured');
    });

    test('should call onImagePreview on repository photo double-click', () => {
      renderer.updateConfig({ showRepositoryPhotos: true });
      const row = renderer.createRow(mockUser);
      const repoIndicator = row.querySelector('.repository-indicator');

      const event = new MouseEvent('dblclick', { bubbles: true });
      repoIndicator.dispatchEvent(event);

      expect(mockCallbacks.onImagePreview).toHaveBeenCalledWith(mockUser, 'repository');
    });

    test('should not attach image preview listener if user has no image', () => {
      const userWithoutImage = { ...mockUser, image_path: null };
      const row = renderer.createRow(userWithoutImage);

      // Should not throw error and should not have photo indicator
      const photoIndicator = row.querySelector('.photo-indicator');
      expect(photoIndicator).toBeFalsy();
    });
  });

  describe('createRows()', () => {
    test('should create multiple rows', () => {
      const users = [
        mockUser,
        { ...mockUser, id: 2, first_name: 'Jane' },
        { ...mockUser, id: 3, first_name: 'Bob' }
      ];

      const rows = renderer.createRows(users);

      expect(rows.length).toBe(3);
      expect(rows[0].textContent).toContain('John');
      expect(rows[1].textContent).toContain('Jane');
      expect(rows[2].textContent).toContain('Bob');
    });

    test('should apply imageCount to all rows', () => {
      const users = [
        mockUser,
        { ...mockUser, id: 2, image_path: '/path/to/image.jpg' }
      ];
      const imageCount = { '/path/to/image.jpg': 2 };

      const rows = renderer.createRows(users, imageCount);

      rows.forEach(row => {
        const photoWrapper = row.querySelector('.photo-indicator-wrapper');
        if (photoWrapper) {
          expect(photoWrapper.classList.contains('duplicate-image')).toBe(true);
        }
      });
    });

    test('should return empty array for empty user list', () => {
      const rows = renderer.createRows([]);

      expect(rows).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    test('should handle user with missing last_name2', () => {
      const userNoLastName2 = { ...mockUser, last_name2: null };
      const row = renderer.createRow(userNoLastName2);

      expect(row.textContent).toContain('Doe');
      expect(row).toBeTruthy();
    });

    test('should handle user with missing NIA', () => {
      const userNoNIA = { ...mockUser, nia: null };
      const row = renderer.createRow(userNoNIA);

      expect(row.textContent).toContain('-');
    });

    test('should handle user with both images', () => {
      const row = renderer.createRow(mockUser);

      expect(row.querySelector('.photo-indicator')).toBeTruthy();
      // Repository indicator only shown if configured
      renderer.updateConfig({ showRepositoryPhotos: true });
      const row2 = renderer.createRow(mockUser);
      expect(row2.querySelector('.repository-indicator')).toBeTruthy();
    });

    test('should handle user with no images', () => {
      const userNoImages = {
        ...mockUser,
        image_path: null,
        repository_image_path: null
      };
      const row = renderer.createRow(userNoImages);

      const placeholder = row.querySelector('.photo-placeholder');
      expect(placeholder).toBeTruthy();
    });
  });
});
