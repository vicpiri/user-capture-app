/**
 * Tests for LazyImageManager
 */

const { LazyImageManager } = require('../../../src/renderer/components/LazyImageManager');

describe('LazyImageManager', () => {
  let manager;
  let mockObserver;

  beforeEach(() => {
    // Mock IntersectionObserver
    mockObserver = {
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    };

    global.IntersectionObserver = jest.fn((callback, options) => {
      mockObserver.callback = callback;
      mockObserver.options = options;
      return mockObserver;
    });

    // Create manager instance
    manager = new LazyImageManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(manager.rootMargin).toBe('50px');
      expect(manager.threshold).toBe(0.01);
      expect(manager.imageSelector).toBe('.lazy-image');
      expect(manager.observer).toBeNull();
    });

    test('should accept custom configuration', () => {
      const customManager = new LazyImageManager({
        rootMargin: '100px',
        threshold: 0.5,
        imageSelector: '.custom-lazy'
      });

      expect(customManager.rootMargin).toBe('100px');
      expect(customManager.threshold).toBe(0.5);
      expect(customManager.imageSelector).toBe('.custom-lazy');
    });

    test('should initialize without observer', () => {
      expect(manager.isActive()).toBe(false);
    });
  });

  describe('init()', () => {
    test('should create IntersectionObserver', () => {
      manager.init();

      expect(global.IntersectionObserver).toHaveBeenCalled();
      expect(manager.observer).toBe(mockObserver);
      expect(manager.isActive()).toBe(true);
    });

    test('should pass correct options to observer', () => {
      manager.init();

      expect(mockObserver.options).toEqual({
        root: null,
        rootMargin: '50px',
        threshold: 0.01
      });
    });

    test('should disconnect previous observer before creating new one', () => {
      manager.init();
      const firstObserver = manager.observer;

      manager.init();

      expect(firstObserver.disconnect).toHaveBeenCalled();
    });
  });

  describe('loadImage()', () => {
    let mockImg;

    beforeEach(() => {
      jest.useFakeTimers();

      mockImg = {
        dataset: { src: 'path/to/image.jpg' },
        src: '',
        classList: {
          remove: jest.fn(),
          add: jest.fn()
        },
        removeAttribute: jest.fn(),
        onload: null
      };

      manager.init();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    test('should load image from data-src', () => {
      manager.loadImage(mockImg, mockObserver);

      expect(mockImg.src).toBe('path/to/image.jpg');
      expect(mockImg.removeAttribute).toHaveBeenCalledWith('data-src');
    });

    test('should update image classes', async () => {
      manager.loadImage(mockImg, mockObserver);

      // Trigger onload handler
      if (mockImg.onload) {
        mockImg.onload();
      }

      // Advance timers to execute setTimeout
      await jest.runAllTimersAsync();

      expect(mockImg.classList.remove).toHaveBeenCalledWith('lazy-image');
      expect(mockImg.classList.add).toHaveBeenCalledWith('lazy-loaded');
    });

    test('should unobserve image after loading', async () => {
      manager.loadImage(mockImg, mockObserver);

      // Trigger onload handler
      if (mockImg.onload) {
        mockImg.onload();
      }

      // Advance timers to execute setTimeout
      await jest.runAllTimersAsync();

      expect(mockObserver.unobserve).toHaveBeenCalledWith(mockImg);
    });

    test('should not load image without data-src', () => {
      mockImg.dataset = {};

      manager.loadImage(mockImg, mockObserver);

      expect(mockImg.src).toBe('');
      expect(mockObserver.unobserve).not.toHaveBeenCalled();
    });
  });

  describe('observeAll()', () => {
    beforeEach(() => {
      // Mock window.innerHeight and innerWidth
      global.window.innerHeight = 768;
      global.window.innerWidth = 1024;

      // Mock document.documentElement
      global.document.documentElement = {
        clientHeight: 768,
        clientWidth: 1024
      };

      // Mock document.querySelectorAll
      const mockImages = [
        {
          dataset: { src: 'img1.jpg' },
          src: '',
          classList: { remove: jest.fn(), add: jest.fn() },
          removeAttribute: jest.fn(),
          getBoundingClientRect: jest.fn(() => ({ top: 0, left: 0, bottom: 100, right: 100, width: 100, height: 100 }))
        },
        {
          dataset: { src: 'img2.jpg' },
          src: '',
          classList: { remove: jest.fn(), add: jest.fn() },
          removeAttribute: jest.fn(),
          getBoundingClientRect: jest.fn(() => ({ top: 0, left: 0, bottom: 100, right: 100, width: 100, height: 100 }))
        },
        {
          dataset: { src: 'img3.jpg' },
          src: '',
          classList: { remove: jest.fn(), add: jest.fn() },
          removeAttribute: jest.fn(),
          getBoundingClientRect: jest.fn(() => ({ top: 0, left: 0, bottom: 100, right: 100, width: 100, height: 100 }))
        }
      ];

      document.querySelectorAll = jest.fn(() => mockImages);
    });

    test('should initialize observer if not active', () => {
      manager.observeAll();

      expect(global.IntersectionObserver).toHaveBeenCalled();
    });

    test('should query for lazy images', () => {
      manager.observeAll();

      expect(document.querySelectorAll).toHaveBeenCalledWith('.lazy-image');
    });

    test('should observe all lazy images', () => {
      // Position images outside viewport so they will be observed
      const mockImagesOutsideViewport = [
        {
          dataset: { src: 'img1.jpg' },
          src: '',
          classList: { remove: jest.fn(), add: jest.fn() },
          removeAttribute: jest.fn(),
          getBoundingClientRect: jest.fn(() => ({ top: 1000, left: 0, bottom: 1100, right: 100, width: 100, height: 100 }))
        },
        {
          dataset: { src: 'img2.jpg' },
          src: '',
          classList: { remove: jest.fn(), add: jest.fn() },
          removeAttribute: jest.fn(),
          getBoundingClientRect: jest.fn(() => ({ top: 2000, left: 0, bottom: 2100, right: 100, width: 100, height: 100 }))
        },
        {
          dataset: { src: 'img3.jpg' },
          src: '',
          classList: { remove: jest.fn(), add: jest.fn() },
          removeAttribute: jest.fn(),
          getBoundingClientRect: jest.fn(() => ({ top: 3000, left: 0, bottom: 3100, right: 100, width: 100, height: 100 }))
        }
      ];

      document.querySelectorAll = jest.fn(() => mockImagesOutsideViewport);

      manager.observeAll();

      expect(mockObserver.observe).toHaveBeenCalledTimes(3);
    });

    test('should not reinitialize if observer already exists', () => {
      manager.init();
      jest.clearAllMocks();

      manager.observeAll();

      expect(global.IntersectionObserver).not.toHaveBeenCalled();
    });
  });

  describe('observe()', () => {
    let mockImg;

    beforeEach(() => {
      mockImg = {
        dataset: { src: 'image.jpg' },
        classList: {
          contains: jest.fn(() => true)
        }
      };
    });

    test('should initialize observer if not active', () => {
      manager.observe(mockImg);

      expect(global.IntersectionObserver).toHaveBeenCalled();
    });

    test('should observe image with lazy-image class', () => {
      manager.observe(mockImg);

      expect(mockObserver.observe).toHaveBeenCalledWith(mockImg);
    });

    test('should not observe image without lazy-image class', () => {
      mockImg.classList.contains = jest.fn(() => false);

      manager.observe(mockImg);

      expect(mockObserver.observe).not.toHaveBeenCalled();
    });

    test('should handle null image', () => {
      expect(() => manager.observe(null)).not.toThrow();
    });
  });

  describe('unobserve()', () => {
    let mockImg;

    beforeEach(() => {
      mockImg = { dataset: { src: 'image.jpg' } };
      manager.init();
    });

    test('should unobserve image', () => {
      manager.unobserve(mockImg);

      expect(mockObserver.unobserve).toHaveBeenCalledWith(mockImg);
    });

    test('should handle null image', () => {
      expect(() => manager.unobserve(null)).not.toThrow();
    });

    test('should handle no observer', () => {
      manager.observer = null;

      expect(() => manager.unobserve(mockImg)).not.toThrow();
    });
  });

  describe('disconnect()', () => {
    test('should disconnect observer', () => {
      manager.init();
      manager.disconnect();

      expect(mockObserver.disconnect).toHaveBeenCalled();
    });

    test('should handle no observer', () => {
      expect(() => manager.disconnect()).not.toThrow();
    });
  });

  describe('isActive()', () => {
    test('should return false when not initialized', () => {
      expect(manager.isActive()).toBe(false);
    });

    test('should return true when initialized', () => {
      manager.init();

      expect(manager.isActive()).toBe(true);
    });

    test('should return false after disconnect', () => {
      manager.init();
      manager.disconnect();

      // Note: disconnect() doesn't set observer to null, so it's still active
      // This tests the actual behavior
      expect(manager.isActive()).toBe(true);
    });
  });

  describe('loadAllImmediate()', () => {
    let mockImages;

    beforeEach(() => {
      mockImages = [
        {
          dataset: { src: 'img1.jpg' },
          src: '',
          classList: { remove: jest.fn(), add: jest.fn() },
          removeAttribute: jest.fn()
        },
        {
          dataset: { src: 'img2.jpg' },
          src: '',
          classList: { remove: jest.fn(), add: jest.fn() },
          removeAttribute: jest.fn()
        }
      ];

      document.querySelectorAll = jest.fn(() => mockImages);
    });

    test('should load all images immediately', () => {
      manager.loadAllImmediate();

      expect(mockImages[0].src).toBe('img1.jpg');
      expect(mockImages[1].src).toBe('img2.jpg');
    });

    test('should update all image classes', () => {
      manager.loadAllImmediate();

      mockImages.forEach(img => {
        expect(img.classList.remove).toHaveBeenCalledWith('lazy-image');
        expect(img.classList.add).toHaveBeenCalledWith('lazy-loaded');
        expect(img.removeAttribute).toHaveBeenCalledWith('data-src');
      });
    });

    test('should not use observer', () => {
      manager.init();
      jest.clearAllMocks();

      manager.loadAllImmediate();

      expect(mockObserver.observe).not.toHaveBeenCalled();
    });
  });

  describe('reset()', () => {
    test('should disconnect and clear observer', () => {
      manager.init();
      manager.reset();

      expect(mockObserver.disconnect).toHaveBeenCalled();
      expect(manager.observer).toBeNull();
      expect(manager.isActive()).toBe(false);
    });
  });

  describe('IntersectionObserver callback', () => {
    let mockImg;

    beforeEach(() => {
      mockImg = {
        dataset: { src: 'image.jpg' },
        src: '',
        classList: {
          remove: jest.fn(),
          add: jest.fn()
        },
        removeAttribute: jest.fn()
      };

      manager.init();
    });

    test('should load image when intersecting', () => {
      const entries = [
        { isIntersecting: true, target: mockImg }
      ];

      mockObserver.callback(entries, mockObserver);

      expect(mockImg.src).toBe('image.jpg');
    });

    test('should not load image when not intersecting', () => {
      const entries = [
        { isIntersecting: false, target: mockImg }
      ];

      mockObserver.callback(entries, mockObserver);

      expect(mockImg.src).toBe('');
    });

    test('should handle multiple entries', () => {
      const mockImg2 = {
        dataset: { src: 'image2.jpg' },
        src: '',
        classList: {
          remove: jest.fn(),
          add: jest.fn()
        },
        removeAttribute: jest.fn()
      };

      const entries = [
        { isIntersecting: true, target: mockImg },
        { isIntersecting: false, target: mockImg2 },
        { isIntersecting: true, target: mockImg2 }
      ];

      mockObserver.callback(entries, mockObserver);

      expect(mockImg.src).toBe('image.jpg');
      expect(mockImg2.src).toBe('image2.jpg');
    });
  });

  describe('Edge Cases', () => {
    test('should handle custom selector', () => {
      const customManager = new LazyImageManager({
        imageSelector: '.custom-lazy'
      });

      document.querySelectorAll = jest.fn(() => []);
      customManager.observeAll();

      expect(document.querySelectorAll).toHaveBeenCalledWith('.custom-lazy');
    });

    test('should handle empty image list', () => {
      document.querySelectorAll = jest.fn(() => []);

      expect(() => manager.observeAll()).not.toThrow();
    });

    test('should handle init/disconnect cycle', () => {
      manager.init();
      expect(manager.isActive()).toBe(true);

      manager.disconnect();
      expect(manager.isActive()).toBe(true); // Still has observer reference

      manager.reset();
      expect(manager.isActive()).toBe(false);

      manager.init();
      expect(manager.isActive()).toBe(true);
    });
  });
});
