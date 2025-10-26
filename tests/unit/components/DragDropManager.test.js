/**
 * Tests for DragDropManager
 */

const { DragDropManager } = require('../../../src/renderer/components/DragDropManager');

describe('DragDropManager', () => {
  let manager;
  let mockDropZone;
  let mockShowInfoModal;
  let mockMoveImageToIngest;

  beforeEach(() => {
    // Mock drop zone element
    mockDropZone = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      classList: {
        add: jest.fn(),
        remove: jest.fn()
      },
      cloneNode: jest.fn(function() { return this; }),
      parentNode: {
        replaceChild: jest.fn()
      }
    };

    // Mock callbacks
    mockShowInfoModal = jest.fn();
    mockMoveImageToIngest = jest.fn();

    // Create manager instance
    manager = new DragDropManager({
      dropZone: mockDropZone,
      showInfoModal: mockShowInfoModal,
      moveImageToIngest: mockMoveImageToIngest
    });
  });

  describe('Initialization', () => {
    test('should initialize with disabled state', () => {
      expect(manager.isActive()).toBe(false);
    });

    test('should store configuration', () => {
      expect(manager.dropZone).toBe(mockDropZone);
      expect(manager.showInfoModal).toBe(mockShowInfoModal);
      expect(manager.moveImageToIngest).toBe(mockMoveImageToIngest);
    });
  });

  describe('enable()', () => {
    test('should enable drag and drop', () => {
      manager.enable();

      expect(manager.isActive()).toBe(true);
      expect(mockDropZone.addEventListener).toHaveBeenCalled();
    });

    test('should add event listeners for all drag events', () => {
      manager.enable();

      const events = mockDropZone.addEventListener.mock.calls.map(call => call[0]);
      expect(events).toContain('dragenter');
      expect(events).toContain('dragover');
      expect(events).toContain('dragleave');
      expect(events).toContain('drop');
    });

    test('should not enable twice', () => {
      manager.enable();
      mockDropZone.addEventListener.mockClear();

      manager.enable();

      expect(mockDropZone.addEventListener).not.toHaveBeenCalled();
    });

    test('should handle missing drop zone', () => {
      const managerNoZone = new DragDropManager({
        showInfoModal: mockShowInfoModal,
        moveImageToIngest: mockMoveImageToIngest
      });

      expect(() => managerNoZone.enable()).not.toThrow();
      expect(managerNoZone.isActive()).toBe(false);
    });
  });

  describe('disable()', () => {
    beforeEach(() => {
      manager.enable();
    });

    test('should disable drag and drop', () => {
      manager.disable();

      expect(manager.isActive()).toBe(false);
    });

    test('should clone and replace drop zone to remove listeners', () => {
      manager.disable();

      expect(mockDropZone.cloneNode).toHaveBeenCalledWith(true);
      expect(mockDropZone.parentNode.replaceChild).toHaveBeenCalled();
    });
  });

  describe('preventDefaults()', () => {
    test('should prevent default and stop propagation', () => {
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      };

      manager.preventDefaults(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('highlight() and unhighlight()', () => {
    test('should add drag-over class on highlight', () => {
      manager.highlight();

      expect(mockDropZone.classList.add).toHaveBeenCalledWith('drag-over');
    });

    test('should remove drag-over class on unhighlight', () => {
      manager.unhighlight();

      expect(mockDropZone.classList.remove).toHaveBeenCalledWith('drag-over');
    });
  });

  describe('filterImageFiles()', () => {
    test('should filter only JPG and JPEG files', () => {
      const files = [
        { name: 'image1.jpg' },
        { name: 'image2.JPEG' },
        { name: 'image3.png' },
        { name: 'document.pdf' },
        { name: 'photo.JPG' }
      ];

      const result = manager.filterImageFiles(files);

      expect(result.length).toBe(3);
      expect(result.map(f => f.name)).toEqual(['image1.jpg', 'image2.JPEG', 'photo.JPG']);
    });

    test('should return empty array for no image files', () => {
      const files = [
        { name: 'document.pdf' },
        { name: 'video.mp4' }
      ];

      const result = manager.filterImageFiles(files);

      expect(result).toEqual([]);
    });

    test('should handle empty file list', () => {
      const result = manager.filterImageFiles([]);

      expect(result).toEqual([]);
    });
  });

  describe('handleDrop()', () => {
    let mockEvent;

    beforeEach(() => {
      mockEvent = {
        dataTransfer: {
          files: []
        }
      };
    });

    test('should show warning when no image files dropped', async () => {
      mockEvent.dataTransfer.files = [
        { name: 'document.pdf' },
        { name: 'video.mp4' }
      ];

      await manager.handleDrop(mockEvent);

      expect(mockShowInfoModal).toHaveBeenCalledWith(
        'Aviso',
        'Por favor, arrastra solo archivos de imagen JPG/JPEG'
      );
      expect(mockMoveImageToIngest).not.toHaveBeenCalled();
    });

    test('should process image files', async () => {
      mockEvent.dataTransfer.files = [
        { name: 'image1.jpg', path: '/path/image1.jpg' },
        { name: 'image2.jpg', path: '/path/image2.jpg' }
      ];

      mockMoveImageToIngest.mockResolvedValue({ success: true });

      await manager.handleDrop(mockEvent);

      expect(mockMoveImageToIngest).toHaveBeenCalledTimes(2);
      expect(mockMoveImageToIngest).toHaveBeenCalledWith('/path/image1.jpg');
      expect(mockMoveImageToIngest).toHaveBeenCalledWith('/path/image2.jpg');
    });

    test('should filter non-image files before processing', async () => {
      mockEvent.dataTransfer.files = [
        { name: 'image1.jpg', path: '/path/image1.jpg' },
        { name: 'document.pdf', path: '/path/document.pdf' },
        { name: 'image2.jpg', path: '/path/image2.jpg' }
      ];

      mockMoveImageToIngest.mockResolvedValue({ success: true });

      await manager.handleDrop(mockEvent);

      expect(mockMoveImageToIngest).toHaveBeenCalledTimes(2);
    });
  });

  describe('processFiles()', () => {
    test('should process all files successfully', async () => {
      const files = [
        { name: 'image1.jpg', path: '/path/image1.jpg' },
        { name: 'image2.jpg', path: '/path/image2.jpg' }
      ];

      mockMoveImageToIngest.mockResolvedValue({ success: true });

      await manager.processFiles(files);

      expect(mockMoveImageToIngest).toHaveBeenCalledTimes(2);
      expect(mockShowInfoModal).not.toHaveBeenCalled();
    });

    test('should show error for failed file', async () => {
      const files = [
        { name: 'image1.jpg', path: '/path/image1.jpg' }
      ];

      mockMoveImageToIngest.mockResolvedValue({
        success: false,
        error: 'Permission denied'
      });

      await manager.processFiles(files);

      expect(mockShowInfoModal).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Permission denied')
      );
    });

    test('should handle exceptions during processing', async () => {
      const files = [
        { name: 'image1.jpg', path: '/path/image1.jpg' }
      ];

      mockMoveImageToIngest.mockRejectedValue(new Error('Network error'));

      await manager.processFiles(files);

      expect(mockShowInfoModal).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Network error')
      );
    });

    test('should process multiple files with mixed success/failure', async () => {
      const files = [
        { name: 'image1.jpg', path: '/path/image1.jpg' },
        { name: 'image2.jpg', path: '/path/image2.jpg' },
        { name: 'image3.jpg', path: '/path/image3.jpg' }
      ];

      mockMoveImageToIngest
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: 'Failed' })
        .mockResolvedValueOnce({ success: true });

      await manager.processFiles(files);

      expect(mockMoveImageToIngest).toHaveBeenCalledTimes(3);
      expect(mockShowInfoModal).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null dropZone in highlight/unhighlight', () => {
      manager.dropZone = null;

      expect(() => {
        manager.highlight();
        manager.unhighlight();
      }).not.toThrow();
    });

    test('should handle disable when not enabled', () => {
      expect(() => manager.disable()).not.toThrow();
    });

    test('should handle enable/disable cycle', () => {
      manager.enable();
      expect(manager.isActive()).toBe(true);

      manager.disable();
      expect(manager.isActive()).toBe(false);

      manager.enable();
      expect(manager.isActive()).toBe(true);
    });
  });
});
