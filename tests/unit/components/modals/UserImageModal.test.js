/**
 * Tests for UserImageModal
 */

const { UserImageModal } = require('../../../../src/renderer/components/modals/UserImageModal');

describe('UserImageModal', () => {
  let modal;
  let mockModal;
  let mockTitle;
  let mockImage;
  let mockCloseBtn;

  beforeEach(() => {
    // Mock DOM elements
    mockModal = {
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(() => false)
      }
    };

    mockTitle = { textContent: '' };
    mockImage = { src: '' };
    mockCloseBtn = {
      addEventListener: jest.fn()
    };

    // Setup document.getElementById mocks
    document.getElementById = jest.fn((id) => {
      switch (id) {
        case 'user-image-modal':
          return mockModal;
        case 'user-image-modal-title':
          return mockTitle;
        case 'user-image-preview':
          return mockImage;
        case 'user-image-close-btn':
          return mockCloseBtn;
        default:
          return null;
      }
    });

    // Create modal instance
    modal = new UserImageModal();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with modal elements', () => {
      expect(modal.modal).toBe(mockModal);
      expect(modal.titleElement).toBe(mockTitle);
      expect(modal.imageElement).toBe(mockImage);
      expect(modal.closeBtn).toBe(mockCloseBtn);
    });

    test('should setup close button listener', () => {
      expect(mockCloseBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    test('should handle missing elements gracefully', () => {
      document.getElementById = jest.fn(() => null);

      expect(() => new UserImageModal()).not.toThrow();
    });
  });

  describe('show()', () => {
    let mockUser;

    beforeEach(() => {
      mockUser = {
        first_name: 'John',
        last_name1: 'Doe',
        last_name2: 'Smith',
        image_path: '/path/to/captured.jpg',
        repository_image_path: '/path/to/repository.jpg'
      };
    });

    test('should show captured image by default', () => {
      modal.show(mockUser);

      expect(mockTitle.textContent).toBe('John Doe Smith');
      expect(mockImage.src).toBe('file:///path/to/captured.jpg');
      expect(mockModal.classList.add).toHaveBeenCalledWith('show');
    });

    test('should show repository image when specified', () => {
      modal.show(mockUser, 'repository');

      expect(mockTitle.textContent).toBe('John Doe Smith - Depósito');
      expect(mockImage.src).toBe('file:///path/to/repository.jpg');
    });

    test('should handle user without last_name2', () => {
      mockUser.last_name2 = null;

      modal.show(mockUser);

      expect(mockTitle.textContent).toBe('John Doe');
    });

    test('should handle user with empty last_name2', () => {
      mockUser.last_name2 = '';

      modal.show(mockUser);

      expect(mockTitle.textContent).toBe('John Doe');
    });

    test('should handle missing modal element', () => {
      modal.modal = null;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      modal.show(mockUser);

      expect(consoleSpy).toHaveBeenCalledWith('[UserImageModal] Modal element not found');
      consoleSpy.mockRestore();
    });
  });

  describe('setTitle()', () => {
    test('should set title with full name for captured image', () => {
      const user = {
        first_name: 'Jane',
        last_name1: 'Smith',
        last_name2: 'Johnson'
      };

      modal.setTitle(user, 'captured');

      expect(mockTitle.textContent).toBe('Jane Smith Johnson');
    });

    test('should set title with repository label', () => {
      const user = {
        first_name: 'Jane',
        last_name1: 'Smith',
        last_name2: 'Johnson'
      };

      modal.setTitle(user, 'repository');

      expect(mockTitle.textContent).toBe('Jane Smith Johnson - Depósito');
    });

    test('should trim extra spaces', () => {
      const user = {
        first_name: 'Jane',
        last_name1: 'Smith',
        last_name2: ''
      };

      modal.setTitle(user, 'captured');

      expect(mockTitle.textContent).toBe('Jane Smith');
    });

    test('should handle missing title element', () => {
      modal.titleElement = null;

      const user = {
        first_name: 'Jane',
        last_name1: 'Smith',
        last_name2: ''
      };

      expect(() => modal.setTitle(user, 'captured')).not.toThrow();
    });
  });

  describe('setImage()', () => {
    test('should set captured image path', () => {
      const user = {
        image_path: '/path/to/image.jpg',
        repository_image_path: '/path/to/repo.jpg'
      };

      modal.setImage(user, 'captured');

      expect(mockImage.src).toBe('file:///path/to/image.jpg');
    });

    test('should set repository image path', () => {
      const user = {
        image_path: '/path/to/image.jpg',
        repository_image_path: '/path/to/repo.jpg'
      };

      modal.setImage(user, 'repository');

      expect(mockImage.src).toBe('file:///path/to/repo.jpg');
    });

    test('should handle missing image path', () => {
      const user = {
        image_path: null,
        repository_image_path: null
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      modal.setImage(user, 'captured');

      expect(mockImage.src).toBe('');
      expect(consoleSpy).toHaveBeenCalledWith('[UserImageModal] No image path found');
      consoleSpy.mockRestore();
    });

    test('should handle missing image element', () => {
      modal.imageElement = null;

      const user = {
        image_path: '/path/to/image.jpg'
      };

      expect(() => modal.setImage(user, 'captured')).not.toThrow();
    });
  });

  describe('close()', () => {
    test('should remove show class from modal', () => {
      modal.close();

      expect(mockModal.classList.remove).toHaveBeenCalledWith('show');
    });

    test('should handle missing modal element', () => {
      modal.modal = null;

      expect(() => modal.close()).not.toThrow();
    });
  });

  describe('Integration', () => {
    test('should handle complete show/close cycle', () => {
      const user = {
        first_name: 'Test',
        last_name1: 'User',
        last_name2: 'Name',
        image_path: '/test.jpg',
        repository_image_path: '/repo.jpg'
      };

      // Show modal
      modal.show(user);
      expect(mockModal.classList.add).toHaveBeenCalledWith('show');

      // Close modal
      modal.close();
      expect(mockModal.classList.remove).toHaveBeenCalledWith('show');
    });

    test('should handle multiple show calls with different users', () => {
      const user1 = {
        first_name: 'User',
        last_name1: 'One',
        last_name2: '',
        image_path: '/user1.jpg'
      };

      const user2 = {
        first_name: 'User',
        last_name1: 'Two',
        last_name2: 'Junior',
        image_path: '/user2.jpg'
      };

      modal.show(user1);
      expect(mockTitle.textContent).toBe('User One');
      expect(mockImage.src).toBe('file:///user1.jpg');

      modal.show(user2);
      expect(mockTitle.textContent).toBe('User Two Junior');
      expect(mockImage.src).toBe('file:///user2.jpg');
    });

    test('should handle switching between captured and repository images', () => {
      const user = {
        first_name: 'Test',
        last_name1: 'User',
        last_name2: '',
        image_path: '/captured.jpg',
        repository_image_path: '/repository.jpg'
      };

      modal.show(user, 'captured');
      expect(mockImage.src).toBe('file:///captured.jpg');
      expect(mockTitle.textContent).toBe('Test User');

      modal.show(user, 'repository');
      expect(mockImage.src).toBe('file:///repository.jpg');
      expect(mockTitle.textContent).toBe('Test User - Depósito');
    });
  });

  describe('Edge Cases', () => {
    test('should handle user with all empty name fields', () => {
      const user = {
        first_name: '',
        last_name1: '',
        last_name2: '',
        image_path: '/test.jpg'
      };

      modal.show(user);

      expect(mockTitle.textContent).toBe('');
    });

    test('should handle undefined user properties', () => {
      const user = {
        first_name: 'Test'
      };

      modal.show(user);

      // Should not throw and handle gracefully
      expect(mockTitle.textContent).toContain('Test');
    });

    test('should handle close button click', () => {
      // Get the click handler that was registered
      const clickHandler = mockCloseBtn.addEventListener.mock.calls[0][1];

      // Simulate click
      clickHandler();

      expect(mockModal.classList.remove).toHaveBeenCalledWith('show');
    });
  });
});
