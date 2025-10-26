/**
 * Tests for ImageTagsManager
 */

const { ImageTagsManager } = require('../../../src/renderer/components/ImageTagsManager');

describe('ImageTagsManager', () => {
  let manager;
  let mockAddTagModal;
  let mockShowInfoModal;
  let mockImageGridManager;
  let mockElectronAPI;
  let mockDOM;

  beforeEach(() => {
    // Mock AddTagModal
    mockAddTagModal = {
      show: jest.fn()
    };

    // Mock functions
    mockShowInfoModal = jest.fn();

    // Mock ImageGridManager
    mockImageGridManager = {
      isPreviewActive: jest.fn(() => true),
      getCurrentImagePath: jest.fn(() => '/path/image.jpg'),
      getImageCount: jest.fn(() => 1),
      showImageByPath: jest.fn(() => true)
    };

    // Mock Electron API
    mockElectronAPI = {
      addImageTag: jest.fn(),
      getImageTags: jest.fn(),
      deleteImageTag: jest.fn(),
      getAllImagesWithTags: jest.fn()
    };

    // Mock DOM elements
    mockDOM = {
      tagsContainer: {
        style: { display: '' }
      },
      tagsList: {
        innerHTML: '',
        appendChild: jest.fn()
      },
      taggedImagesModal: {
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        }
      },
      taggedImagesContainer: {
        innerHTML: '',
        appendChild: jest.fn()
      },
      taggedImagesCloseBtn: {
        cloneNode: jest.fn(function() { return this; }),
        parentNode: {
          replaceChild: jest.fn()
        },
        addEventListener: jest.fn()
      }
    };

    // Create manager instance
    manager = new ImageTagsManager({
      addTagModal: mockAddTagModal,
      showInfoModal: mockShowInfoModal,
      imageGridManager: mockImageGridManager,
      getProjectOpen: () => true,
      electronAPI: mockElectronAPI,
      ...mockDOM
    });
  });

  describe('Initialization', () => {
    test('should store all configuration', () => {
      expect(manager.addTagModal).toBe(mockAddTagModal);
      expect(manager.showInfoModal).toBe(mockShowInfoModal);
      expect(manager.imageGridManager).toBe(mockImageGridManager);
      expect(manager.electronAPI).toBe(mockElectronAPI);
    });
  });

  describe('checkImageSelected()', () => {
    test('should return true when image is selected', () => {
      expect(manager.checkImageSelected()).toBe(true);
      expect(mockShowInfoModal).not.toHaveBeenCalled();
    });

    test('should return false and show warning when no image', () => {
      mockImageGridManager.isPreviewActive.mockReturnValue(false);

      expect(manager.checkImageSelected()).toBe(false);
      expect(mockShowInfoModal).toHaveBeenCalledWith('Aviso', 'Debes seleccionar una imagen primero');
    });
  });

  describe('checkProjectOpen()', () => {
    test('should return true when project is open', () => {
      expect(manager.checkProjectOpen()).toBe(true);
      expect(mockShowInfoModal).not.toHaveBeenCalled();
    });

    test('should return false when project is closed', () => {
      manager.getProjectOpen = () => false;

      expect(manager.checkProjectOpen()).toBe(false);
      expect(mockShowInfoModal).toHaveBeenCalledWith('Aviso', 'Debes abrir o crear un proyecto primero');
    });
  });

  describe('handleAddTag()', () => {
    test('should not add tag when no image selected', async () => {
      mockImageGridManager.isPreviewActive.mockReturnValue(false);

      await manager.handleAddTag();

      expect(mockAddTagModal.show).not.toHaveBeenCalled();
    });

    test('should not add tag when user cancels', async () => {
      mockAddTagModal.show.mockResolvedValue(null);

      await manager.handleAddTag();

      expect(mockElectronAPI.addImageTag).not.toHaveBeenCalled();
    });

    test('should add tag successfully', async () => {
      mockAddTagModal.show.mockResolvedValue('Test Tag');
      mockElectronAPI.addImageTag.mockResolvedValue({ success: true });
      mockElectronAPI.getImageTags.mockResolvedValue({ success: true, tags: [] });

      await manager.handleAddTag();

      expect(mockElectronAPI.addImageTag).toHaveBeenCalledWith({
        imagePath: '/path/image.jpg',
        tag: 'Test Tag'
      });
      expect(mockShowInfoModal).toHaveBeenCalledWith('Éxito', 'Etiqueta agregada correctamente');
    });

    test('should handle add tag error', async () => {
      mockAddTagModal.show.mockResolvedValue('Test Tag');
      mockElectronAPI.addImageTag.mockResolvedValue({
        success: false,
        error: 'Database error'
      });

      await manager.handleAddTag();

      expect(mockShowInfoModal).toHaveBeenCalledWith('Error', expect.stringContaining('Database error'));
    });
  });

  describe('loadTags()', () => {
    test('should hide tags when no images', async () => {
      mockImageGridManager.getImageCount.mockReturnValue(0);

      await manager.loadTags();

      expect(mockDOM.tagsContainer.style.display).toBe('none');
    });

    test('should hide tags when no image path', async () => {
      mockImageGridManager.getCurrentImagePath.mockReturnValue(null);

      await manager.loadTags();

      expect(mockDOM.tagsContainer.style.display).toBe('none');
    });

    test('should display tags when tags exist', async () => {
      mockElectronAPI.getImageTags.mockResolvedValue({
        success: true,
        tags: [
          { id: 1, tag: 'Tag 1' },
          { id: 2, tag: 'Tag 2' }
        ]
      });

      await manager.loadTags();

      expect(mockDOM.tagsContainer.style.display).toBe('block');
      expect(mockDOM.tagsList.appendChild).toHaveBeenCalledTimes(2);
    });

    test('should hide tags when no tags exist', async () => {
      mockElectronAPI.getImageTags.mockResolvedValue({
        success: true,
        tags: []
      });

      await manager.loadTags();

      expect(mockDOM.tagsContainer.style.display).toBe('none');
    });
  });

  describe('deleteTag()', () => {
    test('should delete tag successfully', async () => {
      mockElectronAPI.deleteImageTag.mockResolvedValue({ success: true });
      mockElectronAPI.getImageTags.mockResolvedValue({ success: true, tags: [] });

      await manager.deleteTag(1);

      expect(mockElectronAPI.deleteImageTag).toHaveBeenCalledWith(1);
    });

    test('should handle delete error', async () => {
      mockElectronAPI.deleteImageTag.mockResolvedValue({
        success: false,
        error: 'Not found'
      });

      await manager.deleteTag(1);

      expect(mockShowInfoModal).toHaveBeenCalledWith('Error', expect.stringContaining('Not found'));
    });
  });

  describe('showTaggedImages()', () => {
    test('should not show when project is closed', async () => {
      manager.getProjectOpen = () => false;

      await manager.showTaggedImages();

      expect(mockElectronAPI.getAllImagesWithTags).not.toHaveBeenCalled();
    });

    test('should show loading state', async () => {
      mockElectronAPI.getAllImagesWithTags.mockResolvedValue({
        success: true,
        images: []
      });

      await manager.showTaggedImages();

      expect(mockDOM.taggedImagesModal.classList.add).toHaveBeenCalledWith('show');
    });

    test('should show empty state when no tagged images', async () => {
      mockElectronAPI.getAllImagesWithTags.mockResolvedValue({
        success: true,
        images: []
      });

      await manager.showTaggedImages();

      expect(mockDOM.taggedImagesContainer.innerHTML).toContain('No hay imágenes con etiquetas');
    });

    test('should display tagged images', async () => {
      mockElectronAPI.getAllImagesWithTags.mockResolvedValue({
        success: true,
        images: [
          {
            path: '/path/image1.jpg',
            tags: [{ id: 1, tag: 'Tag 1' }]
          },
          {
            path: '/path/image2.jpg',
            tags: [{ id: 2, tag: 'Tag 2' }]
          }
        ]
      });

      await manager.showTaggedImages();

      expect(mockDOM.taggedImagesContainer.appendChild).toHaveBeenCalledTimes(2);
    });

    test('should handle fetch error', async () => {
      mockElectronAPI.getAllImagesWithTags.mockResolvedValue({
        success: false,
        error: 'Network error'
      });

      await manager.showTaggedImages();

      expect(mockDOM.taggedImagesContainer.innerHTML).toContain('Error al cargar las imágenes');
    });
  });

  describe('createTagElement()', () => {
    test('should create tag element with text and delete button', () => {
      const tag = { id: 1, tag: 'Test Tag' };
      const element = manager.createTagElement(tag);

      expect(element.className).toBe('image-tag');
      expect(element.querySelector('.image-tag-text').textContent).toBe('Test Tag');
      expect(element.querySelector('.image-tag-delete')).toBeTruthy();
    });
  });

  describe('createTaggedImageItem()', () => {
    test('should create tagged image item with preview and tags', () => {
      const imageData = {
        path: '/path/image.jpg',
        tags: [
          { id: 1, tag: 'Tag 1' },
          { id: 2, tag: 'Tag 2' }
        ]
      };

      const element = manager.createTaggedImageItem(imageData);

      expect(element.className).toBe('tagged-image-item');
      expect(element.querySelector('.tagged-image-preview').src).toContain('image.jpg');
      expect(element.querySelectorAll('.tagged-image-tag').length).toBe(2);
    });
  });
});
