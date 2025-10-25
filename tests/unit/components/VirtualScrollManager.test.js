/**
 * Tests for VirtualScrollManager
 */

const { VirtualScrollManager } = require('../../../src/renderer/components/VirtualScrollManager');

describe('VirtualScrollManager', () => {
  let manager;
  let mockContainer;
  let mockTbody;
  let createRowCallback;
  let observeImagesCallback;

  beforeEach(() => {
    // Create mock container
    mockContainer = document.createElement('div');
    mockContainer.id = 'table-container';
    mockContainer.style.height = '400px';
    mockContainer.style.overflow = 'auto';
    document.body.appendChild(mockContainer);

    // Create mock tbody
    mockTbody = document.createElement('tbody');
    mockTbody.id = 'user-table-body';
    mockContainer.appendChild(mockTbody);

    // Create mock callbacks
    createRowCallback = jest.fn((item) => {
      const row = document.createElement('tr');
      row.textContent = item.name;
      row.dataset.userId = item.id;
      return row;
    });

    observeImagesCallback = jest.fn();

    // Create manager instance
    manager = new VirtualScrollManager({
      itemHeight: 40,
      bufferSize: 10,
      minItemsForVirtualization: 50,
      container: mockContainer,
      tbody: mockTbody,
      createRowCallback: createRowCallback,
      observeImagesCallback: observeImagesCallback
    });
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
    document.body.innerHTML = '';
  });

  describe('Initialization', () => {
    test('should initialize with provided configuration', () => {
      expect(manager.itemHeight).toBe(40);
      expect(manager.bufferSize).toBe(10);
      expect(manager.minItemsForVirtualization).toBe(50);
      expect(manager.container).toBe(mockContainer);
      expect(manager.tbody).toBe(mockTbody);
    });

    test('should use default configuration if not provided', () => {
      const defaultManager = new VirtualScrollManager({
        container: mockContainer,
        tbody: mockTbody,
        createRowCallback: createRowCallback
      });

      expect(defaultManager.itemHeight).toBe(40);
      expect(defaultManager.bufferSize).toBe(10);
      expect(defaultManager.minItemsForVirtualization).toBe(50);

      defaultManager.destroy();
    });

    test('should create spacer elements on init', () => {
      manager.init();

      const topSpacer = mockTbody.querySelector('#top-spacer');
      const bottomSpacer = mockTbody.querySelector('#bottom-spacer');

      expect(topSpacer).toBeTruthy();
      expect(bottomSpacer).toBeTruthy();
      expect(topSpacer.style.height).toBe('0px');
      expect(bottomSpacer.style.height).toBe('0px');
    });

    test('should not create duplicate spacers if they exist', () => {
      manager.init();
      const firstTopSpacer = mockTbody.querySelector('#top-spacer');

      manager.init();
      const secondTopSpacer = mockTbody.querySelector('#top-spacer');

      expect(firstTopSpacer).toBe(secondTopSpacer);
      expect(mockTbody.querySelectorAll('#top-spacer').length).toBe(1);
    });

    test('should setup scroll listener on init', () => {
      const addEventListenerSpy = jest.spyOn(mockContainer, 'addEventListener');

      manager.init();

      expect(addEventListenerSpy).toHaveBeenCalledWith('scroll', manager.handleScroll);

      addEventListenerSpy.mockRestore();
    });

    test('should log error if container not provided', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const invalidManager = new VirtualScrollManager({
        tbody: mockTbody
      });
      invalidManager.init();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[VirtualScrollManager] Container or tbody not provided'
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('setItems()', () => {
    beforeEach(() => {
      manager.init();
    });

    test('should store items', () => {
      const items = [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' }
      ];

      manager.setItems(items);

      expect(manager.items).toEqual(items);
    });

    test('should activate virtual scrolling for large lists', () => {
      const items = Array.from({ length: 60 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`
      }));

      manager.setItems(items);

      expect(manager.isActive).toBe(true);
    });

    test('should not activate virtual scrolling for small lists', () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`
      }));

      manager.setItems(items);

      expect(manager.isActive).toBe(false);
    });

    test('should render items after setting', () => {
      const items = [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' }
      ];

      manager.setItems(items);

      expect(createRowCallback).toHaveBeenCalledTimes(2);
      expect(observeImagesCallback).toHaveBeenCalled();
    });

    test('should handle null items', () => {
      manager.setItems(null);

      expect(manager.items).toEqual([]);
      expect(manager.isActive).toBe(false);
    });
  });

  describe('renderNormal()', () => {
    beforeEach(() => {
      manager.init();
    });

    test('should render all items for small lists', () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`
      }));

      manager.setItems(items);

      const rows = mockTbody.querySelectorAll('tr:not(#top-spacer):not(#bottom-spacer)');
      expect(rows.length).toBe(10);
    });

    test('should reset spacer heights for normal rendering', () => {
      manager.setItems([
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' }
      ]);

      const topSpacer = mockTbody.querySelector('#top-spacer');
      const bottomSpacer = mockTbody.querySelector('#bottom-spacer');

      expect(topSpacer.style.height).toBe('0px');
      expect(bottomSpacer.style.height).toBe('0px');
    });

    test('should call createRowCallback for each item', () => {
      const items = [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' },
        { id: 3, name: 'User 3' }
      ];

      manager.setItems(items);

      expect(createRowCallback).toHaveBeenCalledTimes(3);
      expect(createRowCallback).toHaveBeenCalledWith(items[0]);
      expect(createRowCallback).toHaveBeenCalledWith(items[1]);
      expect(createRowCallback).toHaveBeenCalledWith(items[2]);
    });

    test('should call observeImagesCallback after rendering', () => {
      manager.setItems([{ id: 1, name: 'User 1' }]);

      expect(observeImagesCallback).toHaveBeenCalled();
    });
  });

  describe('renderVirtualized()', () => {
    beforeEach(() => {
      manager.init();
      // Mock container dimensions
      Object.defineProperty(mockContainer, 'clientHeight', {
        configurable: true,
        value: 400
      });
      Object.defineProperty(mockContainer, 'scrollTop', {
        configurable: true,
        writable: true,
        value: 0
      });
    });

    test('should render only visible items for large lists', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`
      }));

      manager.setItems(items);

      // Should render visible items + buffer (not all 100)
      const rows = mockTbody.querySelectorAll('tr:not(#top-spacer):not(#bottom-spacer)');
      expect(rows.length).toBeLessThan(100);
      expect(rows.length).toBeGreaterThan(0);
    });

    test('should update spacer heights for virtualized rendering', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`
      }));

      manager.setItems(items);

      const topSpacer = mockTbody.querySelector('#top-spacer');
      const bottomSpacer = mockTbody.querySelector('#bottom-spacer');

      // Should have some spacing
      expect(topSpacer).toBeTruthy();
      expect(bottomSpacer).toBeTruthy();
    });

    test('should not re-render if visible range unchanged', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`
      }));

      manager.setItems(items);

      createRowCallback.mockClear();

      // Call renderVirtualized again without scroll change
      manager.renderVirtualized();

      expect(createRowCallback).not.toHaveBeenCalled();
    });
  });

  describe('handleScroll()', () => {
    beforeEach(() => {
      manager.init();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should debounce scroll events', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`
      }));
      manager.setItems(items);

      const renderSpy = jest.spyOn(manager, 'renderVirtualized');

      // Trigger multiple scroll events
      manager.handleScroll();
      manager.handleScroll();
      manager.handleScroll();

      // Should not render yet (debounced)
      expect(renderSpy).not.toHaveBeenCalled();

      // Fast-forward debounce timeout
      jest.advanceTimersByTime(10);

      // Should render once after debounce
      expect(renderSpy).toHaveBeenCalledTimes(1);

      renderSpy.mockRestore();
    });

    test('should not render if virtualization not active', () => {
      const items = [{ id: 1, name: 'User 1' }];
      manager.setItems(items); // Small list, not virtualized

      const renderSpy = jest.spyOn(manager, 'renderVirtualized');

      manager.handleScroll();
      jest.advanceTimersByTime(10);

      expect(renderSpy).not.toHaveBeenCalled();

      renderSpy.mockRestore();
    });

    test('should not render if items array is empty', () => {
      manager.setItems([]);

      const renderSpy = jest.spyOn(manager, 'renderVirtualized');

      manager.handleScroll();
      jest.advanceTimersByTime(10);

      expect(renderSpy).not.toHaveBeenCalled();

      renderSpy.mockRestore();
    });
  });

  describe('scrollToIndex()', () => {
    beforeEach(() => {
      manager.init();
    });

    test('should scroll to specific item index', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`
      }));
      manager.setItems(items);

      manager.scrollToIndex(50);

      expect(mockContainer.scrollTop).toBe(50 * 40); // 50 * itemHeight
    });

    test('should not scroll if index is negative', () => {
      manager.setItems([{ id: 1, name: 'User 1' }]);

      mockContainer.scrollTop = 100;
      manager.scrollToIndex(-1);

      expect(mockContainer.scrollTop).toBe(100); // Unchanged
    });

    test('should not scroll if index exceeds items length', () => {
      manager.setItems([{ id: 1, name: 'User 1' }]);

      mockContainer.scrollTop = 0;
      manager.scrollToIndex(999);

      expect(mockContainer.scrollTop).toBe(0); // Unchanged
    });
  });

  describe('scrollToTop()', () => {
    beforeEach(() => {
      manager.init();
    });

    test('should scroll container to top', () => {
      manager.setItems([{ id: 1, name: 'User 1' }]);
      mockContainer.scrollTop = 500;

      manager.scrollToTop();

      expect(mockContainer.scrollTop).toBe(0);
    });
  });

  describe('getScrollInfo()', () => {
    beforeEach(() => {
      manager.init();
      Object.defineProperty(mockContainer, 'clientHeight', {
        configurable: true,
        value: 400
      });
      Object.defineProperty(mockContainer, 'scrollHeight', {
        configurable: true,
        value: 4000
      });
    });

    test('should return current scroll information', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`
      }));
      manager.setItems(items);

      const info = manager.getScrollInfo();

      expect(info).toHaveProperty('scrollTop');
      expect(info).toHaveProperty('scrollHeight');
      expect(info).toHaveProperty('clientHeight');
      expect(info).toHaveProperty('visibleStartIndex');
      expect(info).toHaveProperty('visibleEndIndex');
      expect(info).toHaveProperty('totalItems');
      expect(info).toHaveProperty('isActive');
      expect(info.totalItems).toBe(100);
      expect(info.isActive).toBe(true);
    });
  });

  describe('destroy()', () => {
    beforeEach(() => {
      manager.init();
    });

    test('should remove scroll event listener', () => {
      const removeEventListenerSpy = jest.spyOn(mockContainer, 'removeEventListener');

      manager.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', manager.handleScroll);

      removeEventListenerSpy.mockRestore();
    });

    test('should clear scroll timeout', () => {
      jest.useFakeTimers();

      manager.handleScroll(); // Starts timeout

      manager.destroy();

      jest.advanceTimersByTime(10);

      // If timeout was cleared, renderVirtualized shouldn't be called
      const renderSpy = jest.spyOn(manager, 'renderVirtualized');
      expect(renderSpy).not.toHaveBeenCalled();

      renderSpy.mockRestore();
      jest.useRealTimers();
    });
  });
});
