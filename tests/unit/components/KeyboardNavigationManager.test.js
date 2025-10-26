/**
 * Tests for KeyboardNavigationManager
 */

const { KeyboardNavigationManager } = require('../../../src/renderer/components/KeyboardNavigationManager');

describe('KeyboardNavigationManager', () => {
  let manager;
  let mockCallbacks;
  let mockGetters;

  beforeEach(() => {
    // Mock callbacks
    mockCallbacks = {
      onNavigateUserPrev: jest.fn(),
      onNavigateUserNext: jest.fn(),
      onNavigateImagePrev: jest.fn(),
      onNavigateImageNext: jest.fn()
    };

    // Mock state getters
    mockGetters = {
      isModalOpen: jest.fn(() => false),
      hasImages: jest.fn(() => true)
    };

    // Create manager instance
    manager = new KeyboardNavigationManager({
      ...mockCallbacks,
      ...mockGetters
    });
  });

  afterEach(() => {
    // Cleanup
    if (manager.getIsEnabled()) {
      manager.disable();
    }
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with disabled state', () => {
      expect(manager.getIsEnabled()).toBe(false);
    });

    test('should store callbacks', () => {
      expect(manager.onNavigateUserPrev).toBe(mockCallbacks.onNavigateUserPrev);
      expect(manager.onNavigateUserNext).toBe(mockCallbacks.onNavigateUserNext);
      expect(manager.onNavigateImagePrev).toBe(mockCallbacks.onNavigateImagePrev);
      expect(manager.onNavigateImageNext).toBe(mockCallbacks.onNavigateImageNext);
    });

    test('should store state getters', () => {
      expect(manager.isModalOpen).toBe(mockGetters.isModalOpen);
      expect(manager.hasImages).toBe(mockGetters.hasImages);
    });

    test('should use default callbacks if not provided', () => {
      const defaultManager = new KeyboardNavigationManager();

      expect(typeof defaultManager.onNavigateUserPrev).toBe('function');
      expect(typeof defaultManager.onNavigateUserNext).toBe('function');
      expect(typeof defaultManager.onNavigateImagePrev).toBe('function');
      expect(typeof defaultManager.onNavigateImageNext).toBe('function');
    });

    test('should use default getters if not provided', () => {
      const defaultManager = new KeyboardNavigationManager();

      expect(typeof defaultManager.isModalOpen).toBe('function');
      expect(typeof defaultManager.hasImages).toBe('function');
      expect(defaultManager.isModalOpen()).toBe(false);
      expect(defaultManager.hasImages()).toBe(false);
    });
  });

  describe('enable()', () => {
    test('should add keydown event listener', () => {
      const addSpy = jest.spyOn(document, 'addEventListener');

      manager.enable();

      expect(addSpy).toHaveBeenCalledWith('keydown', manager.handleKeyDown);
      addSpy.mockRestore();
    });

    test('should set enabled state to true', () => {
      manager.enable();

      expect(manager.getIsEnabled()).toBe(true);
    });

    test('should not add listener twice if already enabled', () => {
      const addSpy = jest.spyOn(document, 'addEventListener');

      manager.enable();
      manager.enable();

      expect(addSpy).toHaveBeenCalledTimes(1);
      addSpy.mockRestore();
    });
  });

  describe('disable()', () => {
    test('should remove keydown event listener', () => {
      const removeSpy = jest.spyOn(document, 'removeEventListener');

      manager.enable();
      manager.disable();

      expect(removeSpy).toHaveBeenCalledWith('keydown', manager.handleKeyDown);
      removeSpy.mockRestore();
    });

    test('should set enabled state to false', () => {
      manager.enable();
      manager.disable();

      expect(manager.getIsEnabled()).toBe(false);
    });

    test('should not remove listener if not enabled', () => {
      const removeSpy = jest.spyOn(document, 'removeEventListener');

      manager.disable();

      expect(removeSpy).not.toHaveBeenCalled();
      removeSpy.mockRestore();
    });
  });

  describe('handleKeyDown()', () => {
    beforeEach(() => {
      manager.enable();
    });

    test('should not handle keys when modal is open', () => {
      mockGetters.isModalOpen.mockReturnValue(true);

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      manager.handleKeyDown(event);

      expect(mockCallbacks.onNavigateUserPrev).not.toHaveBeenCalled();
    });

    test('should not handle keys when typing in input', () => {
      const input = document.createElement('input');
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      Object.defineProperty(event, 'target', { value: input, enumerable: true });

      manager.handleKeyDown(event);

      expect(mockCallbacks.onNavigateUserPrev).not.toHaveBeenCalled();
    });

    test('should not handle keys when typing in textarea', () => {
      const textarea = document.createElement('textarea');
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      Object.defineProperty(event, 'target', { value: textarea, enumerable: true });

      manager.handleKeyDown(event);

      expect(mockCallbacks.onNavigateUserPrev).not.toHaveBeenCalled();
    });

    test('should ignore non-arrow keys', () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      manager.handleKeyDown(event);

      expect(mockCallbacks.onNavigateUserPrev).not.toHaveBeenCalled();
      expect(mockCallbacks.onNavigateUserNext).not.toHaveBeenCalled();
      expect(mockCallbacks.onNavigateImagePrev).not.toHaveBeenCalled();
      expect(mockCallbacks.onNavigateImageNext).not.toHaveBeenCalled();
    });
  });

  describe('Arrow key handling', () => {
    beforeEach(() => {
      manager.enable();
    });

    test('should navigate to previous user on ArrowUp', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

      manager.handleKeyDown(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(mockCallbacks.onNavigateUserPrev).toHaveBeenCalled();
    });

    test('should navigate to next user on ArrowDown', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

      manager.handleKeyDown(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(mockCallbacks.onNavigateUserNext).toHaveBeenCalled();
    });

    test('should navigate to previous image on ArrowLeft when images exist', () => {
      mockGetters.hasImages.mockReturnValue(true);
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

      manager.handleKeyDown(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(mockCallbacks.onNavigateImagePrev).toHaveBeenCalled();
    });

    test('should navigate to next image on ArrowRight when images exist', () => {
      mockGetters.hasImages.mockReturnValue(true);
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

      manager.handleKeyDown(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(mockCallbacks.onNavigateImageNext).toHaveBeenCalled();
    });

    test('should not navigate images on ArrowLeft when no images', () => {
      mockGetters.hasImages.mockReturnValue(false);
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

      manager.handleKeyDown(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(mockCallbacks.onNavigateImagePrev).not.toHaveBeenCalled();
    });

    test('should not navigate images on ArrowRight when no images', () => {
      mockGetters.hasImages.mockReturnValue(false);
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

      manager.handleKeyDown(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(mockCallbacks.onNavigateImageNext).not.toHaveBeenCalled();
    });
  });

  describe('isTypingInInput()', () => {
    test('should return true for INPUT elements', () => {
      const input = document.createElement('input');
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      Object.defineProperty(event, 'target', { value: input, enumerable: true });

      expect(manager.isTypingInInput(event)).toBe(true);
    });

    test('should return true for TEXTAREA elements', () => {
      const textarea = document.createElement('textarea');
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      Object.defineProperty(event, 'target', { value: textarea, enumerable: true });

      expect(manager.isTypingInInput(event)).toBe(true);
    });

    test('should return false for other elements', () => {
      const div = document.createElement('div');
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      Object.defineProperty(event, 'target', { value: div, enumerable: true });

      expect(manager.isTypingInInput(event)).toBe(false);
    });
  });

  describe('updateCallbacks()', () => {
    test('should update onNavigateUserPrev callback', () => {
      const newCallback = jest.fn();

      manager.updateCallbacks({ onNavigateUserPrev: newCallback });

      expect(manager.onNavigateUserPrev).toBe(newCallback);
    });

    test('should update onNavigateUserNext callback', () => {
      const newCallback = jest.fn();

      manager.updateCallbacks({ onNavigateUserNext: newCallback });

      expect(manager.onNavigateUserNext).toBe(newCallback);
    });

    test('should update onNavigateImagePrev callback', () => {
      const newCallback = jest.fn();

      manager.updateCallbacks({ onNavigateImagePrev: newCallback });

      expect(manager.onNavigateImagePrev).toBe(newCallback);
    });

    test('should update onNavigateImageNext callback', () => {
      const newCallback = jest.fn();

      manager.updateCallbacks({ onNavigateImageNext: newCallback });

      expect(manager.onNavigateImageNext).toBe(newCallback);
    });

    test('should only update provided callbacks', () => {
      const originalPrev = manager.onNavigateUserPrev;
      const newNext = jest.fn();

      manager.updateCallbacks({ onNavigateUserNext: newNext });

      expect(manager.onNavigateUserPrev).toBe(originalPrev);
      expect(manager.onNavigateUserNext).toBe(newNext);
    });
  });

  describe('updateGetters()', () => {
    test('should update isModalOpen getter', () => {
      const newGetter = jest.fn(() => true);

      manager.updateGetters({ isModalOpen: newGetter });

      expect(manager.isModalOpen).toBe(newGetter);
    });

    test('should update hasImages getter', () => {
      const newGetter = jest.fn(() => false);

      manager.updateGetters({ hasImages: newGetter });

      expect(manager.hasImages).toBe(newGetter);
    });

    test('should only update provided getters', () => {
      const originalIsModalOpen = manager.isModalOpen;
      const newHasImages = jest.fn(() => false);

      manager.updateGetters({ hasImages: newHasImages });

      expect(manager.isModalOpen).toBe(originalIsModalOpen);
      expect(manager.hasImages).toBe(newHasImages);
    });
  });

  describe('Integration', () => {
    test('should handle complete enable/disable cycle', () => {
      expect(manager.getIsEnabled()).toBe(false);

      manager.enable();
      expect(manager.getIsEnabled()).toBe(true);

      manager.disable();
      expect(manager.getIsEnabled()).toBe(false);
    });

    test('should handle keyboard navigation when enabled', () => {
      manager.enable();

      const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      manager.handleKeyDown(upEvent);
      expect(mockCallbacks.onNavigateUserPrev).toHaveBeenCalled();

      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      manager.handleKeyDown(downEvent);
      expect(mockCallbacks.onNavigateUserNext).toHaveBeenCalled();

      const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      manager.handleKeyDown(leftEvent);
      expect(mockCallbacks.onNavigateImagePrev).toHaveBeenCalled();

      const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      manager.handleKeyDown(rightEvent);
      expect(mockCallbacks.onNavigateImageNext).toHaveBeenCalled();
    });

    test('should respect modal state', () => {
      manager.enable();
      mockGetters.isModalOpen.mockReturnValue(true);

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      manager.handleKeyDown(event);

      expect(mockCallbacks.onNavigateUserPrev).not.toHaveBeenCalled();
    });

    test('should respect image availability', () => {
      manager.enable();
      mockGetters.hasImages.mockReturnValue(false);

      const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      manager.handleKeyDown(leftEvent);
      expect(mockCallbacks.onNavigateImagePrev).not.toHaveBeenCalled();

      const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      manager.handleKeyDown(rightEvent);
      expect(mockCallbacks.onNavigateImageNext).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle rapid key presses', () => {
      manager.enable();

      for (let i = 0; i < 10; i++) {
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
        manager.handleKeyDown(event);
      }

      expect(mockCallbacks.onNavigateUserPrev).toHaveBeenCalledTimes(10);
    });

    test('should handle multiple enable calls', () => {
      const addSpy = jest.spyOn(document, 'addEventListener');

      manager.enable();
      manager.enable();
      manager.enable();

      expect(addSpy).toHaveBeenCalledTimes(1);
      addSpy.mockRestore();
    });

    test('should handle multiple disable calls', () => {
      const removeSpy = jest.spyOn(document, 'removeEventListener');

      manager.enable();
      manager.disable();
      manager.disable();
      manager.disable();

      expect(removeSpy).toHaveBeenCalledTimes(1);
      removeSpy.mockRestore();
    });

    test('should handle callback updates while enabled', () => {
      manager.enable();

      const newCallback = jest.fn();
      manager.updateCallbacks({ onNavigateUserPrev: newCallback });

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      manager.handleKeyDown(event);

      expect(newCallback).toHaveBeenCalled();
      expect(mockCallbacks.onNavigateUserPrev).not.toHaveBeenCalled();
    });

    test('should handle getter updates while enabled', () => {
      manager.enable();

      const newGetter = jest.fn(() => true);
      manager.updateGetters({ isModalOpen: newGetter });

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      manager.handleKeyDown(event);

      expect(newGetter).toHaveBeenCalled();
      expect(mockCallbacks.onNavigateUserPrev).not.toHaveBeenCalled();
    });
  });
});
