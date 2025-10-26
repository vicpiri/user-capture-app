/**
 * Tests for ImageGridManager
 */

const { ImageGridManager } = require('../../../src/renderer/components/ImageGridManager');

describe('ImageGridManager', () => {
  let manager;
  let mockContainer;
  let mockImage;
  let mockGetImages;
  let mockOnImageChange;

  beforeEach(() => {
    // Mock DOM elements
    mockContainer = {
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn()
      }
    };

    mockImage = {
      src: ''
    };

    // Mock callbacks
    mockGetImages = jest.fn();
    mockOnImageChange = jest.fn();

    // Create manager instance
    manager = new ImageGridManager({
      imagePreviewContainer: mockContainer,
      currentImage: mockImage,
      getImages: mockGetImages,
      onImageChange: mockOnImageChange
    });
  });

  describe('Initialization', () => {
    test('should initialize with empty state', () => {
      expect(manager.images).toEqual([]);
      expect(manager.currentIndex).toBe(0);
      expect(manager.isActive).toBe(false);
    });

    test('should store configuration', () => {
      expect(manager.imagePreviewContainer).toBe(mockContainer);
      expect(manager.currentImage).toBe(mockImage);
      expect(manager.getImages).toBe(mockGetImages);
      expect(manager.onImageChange).toBe(mockOnImageChange);
    });
  });

  describe('loadImages()', () => {
    test('should load images successfully', async () => {
      mockGetImages.mockResolvedValue({
        success: true,
        images: ['/path/image1.jpg', '/path/image2.jpg', '/path/image3.jpg']
      });

      const result = await manager.loadImages();

      expect(result).toBe(true);
      expect(manager.images.length).toBe(3);
      expect(mockContainer.classList.add).toHaveBeenCalledWith('active');
    });

    test('should show latest image when new images are added', async () => {
      mockGetImages.mockResolvedValue({
        success: true,
        images: ['/path/image1.jpg']
      });

      await manager.loadImages();
      expect(manager.currentIndex).toBe(0);

      mockGetImages.mockResolvedValue({
        success: true,
        images: ['/path/image2.jpg', '/path/image1.jpg']
      });

      await manager.loadImages(true);
      expect(manager.currentIndex).toBe(0); // Latest image
    });

    test('should not reset index when showLatest is false', async () => {
      mockGetImages.mockResolvedValue({
        success: true,
        images: ['/path/image1.jpg']
      });

      await manager.loadImages();
      manager.currentIndex = 0;

      mockGetImages.mockResolvedValue({
        success: true,
        images: ['/path/image2.jpg', '/path/image1.jpg']
      });

      await manager.loadImages(false);
      expect(manager.currentIndex).toBe(0);
    });

    test('should return false when no images loaded', async () => {
      mockGetImages.mockResolvedValue({
        success: true,
        images: []
      });

      const result = await manager.loadImages();
      expect(result).toBe(false);
    });

    test('should handle load errors', async () => {
      mockGetImages.mockRejectedValue(new Error('Failed to load'));

      const result = await manager.loadImages();
      expect(result).toBe(false);
    });
  });

  describe('showPreview()', () => {
    beforeEach(async () => {
      mockGetImages.mockResolvedValue({
        success: true,
        images: ['/path/image1.jpg', '/path/image2.jpg']
      });
      await manager.loadImages();
    });

    test('should show image preview', () => {
      expect(mockContainer.classList.add).toHaveBeenCalledWith('active');
      expect(mockImage.src).toBe('file:///path/image1.jpg');
      expect(manager.isActive).toBe(true);
    });

    test('should call onImageChange callback', () => {
      expect(mockOnImageChange).toHaveBeenCalledWith('/path/image1.jpg');
    });

    test('should do nothing when no images', () => {
      manager.clear();
      mockOnImageChange.mockClear();

      manager.showPreview();

      expect(mockOnImageChange).not.toHaveBeenCalled();
    });
  });

  describe('navigate()', () => {
    beforeEach(async () => {
      mockGetImages.mockResolvedValue({
        success: true,
        images: ['/path/image1.jpg', '/path/image2.jpg', '/path/image3.jpg']
      });
      await manager.loadImages();
      mockOnImageChange.mockClear();
    });

    test('should navigate to next image', () => {
      manager.navigate(1);

      expect(manager.currentIndex).toBe(1);
      expect(mockImage.src).toBe('file:///path/image2.jpg');
      expect(mockOnImageChange).toHaveBeenCalledWith('/path/image2.jpg');
    });

    test('should navigate to previous image', () => {
      manager.currentIndex = 1;

      manager.navigate(-1);

      expect(manager.currentIndex).toBe(0);
      expect(mockImage.src).toBe('file:///path/image1.jpg');
    });

    test('should wrap around to last image when going before first', () => {
      manager.currentIndex = 0;

      manager.navigate(-1);

      expect(manager.currentIndex).toBe(2);
      expect(mockImage.src).toBe('file:///path/image3.jpg');
    });

    test('should wrap around to first image when going after last', () => {
      manager.currentIndex = 2;

      manager.navigate(1);

      expect(manager.currentIndex).toBe(0);
      expect(mockImage.src).toBe('file:///path/image1.jpg');
    });

    test('should do nothing when no images', () => {
      manager.clear();
      const prevIndex = manager.currentIndex;

      manager.navigate(1);

      expect(manager.currentIndex).toBe(prevIndex);
    });
  });

  describe('next() and previous()', () => {
    beforeEach(async () => {
      mockGetImages.mockResolvedValue({
        success: true,
        images: ['/path/image1.jpg', '/path/image2.jpg']
      });
      await manager.loadImages();
    });

    test('next() should move to next image', () => {
      manager.next();
      expect(manager.currentIndex).toBe(1);
    });

    test('previous() should move to previous image', () => {
      manager.currentIndex = 1;
      manager.previous();
      expect(manager.currentIndex).toBe(0);
    });
  });

  describe('hide()', () => {
    beforeEach(async () => {
      mockGetImages.mockResolvedValue({
        success: true,
        images: ['/path/image1.jpg']
      });
      await manager.loadImages();
    });

    test('should hide image preview', () => {
      manager.hide();

      expect(mockContainer.classList.remove).toHaveBeenCalledWith('active');
      expect(manager.isActive).toBe(false);
    });
  });

  describe('showImageAtIndex()', () => {
    beforeEach(async () => {
      mockGetImages.mockResolvedValue({
        success: true,
        images: ['/path/image1.jpg', '/path/image2.jpg', '/path/image3.jpg']
      });
      await manager.loadImages();
      mockOnImageChange.mockClear();
    });

    test('should show image at specific index', () => {
      const result = manager.showImageAtIndex(1);

      expect(result).toBe(true);
      expect(manager.currentIndex).toBe(1);
      expect(mockImage.src).toBe('file:///path/image2.jpg');
    });

    test('should return false for invalid index (negative)', () => {
      const result = manager.showImageAtIndex(-1);
      expect(result).toBe(false);
    });

    test('should return false for invalid index (too large)', () => {
      const result = manager.showImageAtIndex(10);
      expect(result).toBe(false);
    });
  });

  describe('showImageByPath()', () => {
    beforeEach(async () => {
      mockGetImages.mockResolvedValue({
        success: true,
        images: ['/path/image1.jpg', '/path/image2.jpg', '/path/image3.jpg']
      });
      await manager.loadImages();
      mockOnImageChange.mockClear();
    });

    test('should show image by path', () => {
      const result = manager.showImageByPath('/path/image2.jpg');

      expect(result).toBe(true);
      expect(manager.currentIndex).toBe(1);
      expect(mockImage.src).toBe('file:///path/image2.jpg');
    });

    test('should return false for non-existent path', () => {
      const result = manager.showImageByPath('/path/nonexistent.jpg');
      expect(result).toBe(false);
    });
  });

  describe('Getters', () => {
    beforeEach(async () => {
      mockGetImages.mockResolvedValue({
        success: true,
        images: ['/path/image1.jpg', '/path/image2.jpg', '/path/image3.jpg']
      });
      await manager.loadImages();
    });

    test('getCurrentImagePath() should return current image path', () => {
      expect(manager.getCurrentImagePath()).toBe('/path/image1.jpg');

      manager.currentIndex = 1;
      expect(manager.getCurrentImagePath()).toBe('/path/image2.jpg');
    });

    test('getCurrentImagePath() should return null when no images', () => {
      manager.clear();
      expect(manager.getCurrentImagePath()).toBeNull();
    });

    test('getCurrentIndex() should return current index', () => {
      manager.currentIndex = 2;
      expect(manager.getCurrentIndex()).toBe(2);
    });

    test('getImageCount() should return total images', () => {
      expect(manager.getImageCount()).toBe(3);
    });

    test('isPreviewActive() should return active state', () => {
      expect(manager.isPreviewActive()).toBe(true);

      manager.hide();
      expect(manager.isPreviewActive()).toBe(false);
    });

    test('getAllImages() should return copy of images array', () => {
      const images = manager.getAllImages();

      expect(images).toEqual(['/path/image1.jpg', '/path/image2.jpg', '/path/image3.jpg']);
      expect(images).not.toBe(manager.images); // Should be a copy
    });
  });

  describe('setDetecting()', () => {
    test('should add detecting class', () => {
      manager.setDetecting(true);
      expect(mockContainer.classList.add).toHaveBeenCalledWith('detecting-image');
    });

    test('should remove detecting class', () => {
      manager.setDetecting(false);
      expect(mockContainer.classList.remove).toHaveBeenCalledWith('detecting-image');
    });
  });

  describe('clear()', () => {
    beforeEach(async () => {
      mockGetImages.mockResolvedValue({
        success: true,
        images: ['/path/image1.jpg', '/path/image2.jpg']
      });
      await manager.loadImages();
    });

    test('should clear all images and state', () => {
      manager.clear();

      expect(manager.images).toEqual([]);
      expect(manager.currentIndex).toBe(0);
      expect(manager.isActive).toBe(false);
      expect(mockContainer.classList.remove).toHaveBeenCalledWith('active');
    });
  });

  describe('Edge Cases', () => {
    test('should handle manager without DOM elements', () => {
      const managerNoDom = new ImageGridManager({
        getImages: mockGetImages
      });

      // Should not throw
      managerNoDom.showPreview();
      managerNoDom.hide();
      managerNoDom.setDetecting(true);
    });

    test('should handle manager without getImages callback', async () => {
      const managerNoCallback = new ImageGridManager({
        imagePreviewContainer: mockContainer,
        currentImage: mockImage
      });

      const result = await managerNoCallback.loadImages();
      expect(result).toBe(false);
    });

    test('should handle manager without onImageChange callback', async () => {
      const managerNoChange = new ImageGridManager({
        imagePreviewContainer: mockContainer,
        currentImage: mockImage,
        getImages: mockGetImages
      });

      mockGetImages.mockResolvedValue({
        success: true,
        images: ['/path/image1.jpg']
      });

      // Should not throw
      await managerNoChange.loadImages();
      managerNoChange.navigate(1);
    });
  });
});
