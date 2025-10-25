/**
 * Tests for BaseModal
 */

const { BaseModal } = require('../../../src/renderer/core/BaseModal');
const { Store } = require('../../../src/renderer/core/store');

describe('BaseModal', () => {
  let modal;
  let mockElement;

  beforeEach(() => {
    // Create mock modal element
    mockElement = document.createElement('div');
    mockElement.id = 'test-modal';
    mockElement.style.display = 'none';
    document.body.appendChild(mockElement);

    modal = new BaseModal('test-modal');
  });

  afterEach(() => {
    if (modal) {
      modal.destroy();
    }
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    test('should find modal element by id', () => {
      expect(modal.modal).toBe(mockElement);
      expect(modal.modalId).toBe('test-modal');
    });

    test('should warn if modal element not found', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const noModal = new BaseModal('non-existent');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Modal with id 'non-existent' not found")
      );

      consoleWarnSpy.mockRestore();
    });

    test('should initialize empty listeners array', () => {
      expect(modal.listeners).toEqual([]);
    });

    test('should initialize empty subscriptions array', () => {
      expect(modal.storeSubscriptions).toEqual([]);
    });

    test('should set isInitialized to false', () => {
      expect(modal.isInitialized).toBe(false);
    });

    test('should set isOpen to false', () => {
      expect(modal.isOpen).toBe(false);
    });
  });

  describe('init', () => {
    test('should set isInitialized to true', () => {
      modal.init();
      expect(modal.isInitialized).toBe(true);
    });

    test('should not initialize twice', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      modal.init();
      modal.init();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('BaseModal'),
        expect.stringContaining('Already initialized')
      );

      consoleWarnSpy.mockRestore();
    });

    test('should not initialize if modal element not found', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const noModal = new BaseModal('non-existent');
      noModal.init();

      expect(noModal.isInitialized).toBe(false);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('open', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should set display to block', () => {
      modal.open();
      expect(mockElement.style.display).toBe('block');
    });

    test('should add show class', () => {
      modal.open();
      expect(mockElement.classList.contains('show')).toBe(true);
    });

    test('should set isOpen to true', () => {
      modal.open();
      expect(modal.isOpen).toBe(true);
    });

    test('should call onOpen hook if defined', () => {
      const onOpenSpy = jest.fn();
      modal.onOpen = onOpenSpy;

      modal.open();

      expect(onOpenSpy).toHaveBeenCalled();
    });

    test('should not open if not initialized', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const uninitModal = new BaseModal('test-modal');
      uninitModal.open();

      expect(mockElement.classList.contains('show')).toBe(false);
      consoleWarnSpy.mockRestore();
    });
  });

  describe('close', () => {
    beforeEach(() => {
      modal.init();
      modal.open();
    });

    test('should remove show class', () => {
      modal.close();
      expect(mockElement.classList.contains('show')).toBe(false);
    });

    test('should set isOpen to false', () => {
      modal.close();
      expect(modal.isOpen).toBe(false);
    });

    test('should call onClose hook if defined', () => {
      const onCloseSpy = jest.fn();
      modal.onClose = onCloseSpy;

      modal.close();

      expect(onCloseSpy).toHaveBeenCalled();
    });

    test('should set display to none after timeout', () => {
      jest.useFakeTimers();
      modal.close();

      // Fast-forward time by 350ms
      jest.advanceTimersByTime(350);

      expect(mockElement.style.display).toBe('none');
      jest.useRealTimers();
    });
  });

  describe('addEventListener', () => {
    let button;

    beforeEach(() => {
      button = document.createElement('button');
      mockElement.appendChild(button);
      modal.init();
    });

    test('should add event listener to element', () => {
      const handler = jest.fn();
      modal.addEventListener(button, 'click', handler);

      button.click();

      expect(handler).toHaveBeenCalled();
    });

    test('should track listener for cleanup', () => {
      const handler = jest.fn();
      modal.addEventListener(button, 'click', handler);

      expect(modal.listeners).toHaveLength(1);
      expect(modal.listeners[0]).toEqual({
        element: button,
        event: 'click',
        handler,
        options: {}
      });
    });

    test('should warn if element is null', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      modal.addEventListener(null, 'click', jest.fn());

      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('subscribeToStore', () => {
    let store;

    beforeEach(() => {
      store = new Store();
      modal.init();
    });

    afterEach(() => {
      store.clearSubscriptions();
    });

    test('should subscribe to store', () => {
      const callback = jest.fn();
      modal.subscribeToStore(store, 'users', callback);

      store.setState({ users: { selectedUserId: 1 } });

      expect(callback).toHaveBeenCalled();
    });

    test('should track subscription for cleanup', () => {
      const callback = jest.fn();
      modal.subscribeToStore(store, 'users', callback);

      expect(modal.storeSubscriptions).toHaveLength(1);
    });

    test('should return unsubscribe function', () => {
      const callback = jest.fn();
      const unsubscribe = modal.subscribeToStore(store, 'users', callback);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
      store.setState({ users: { selectedUserId: 1 } });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    let button;
    let handler;
    let store;

    beforeEach(() => {
      button = document.createElement('button');
      mockElement.appendChild(button);
      handler = jest.fn();
      store = new Store();
      modal.init();
    });

    afterEach(() => {
      store.clearSubscriptions();
    });

    test('should remove all event listeners', () => {
      modal.addEventListener(button, 'click', handler);
      modal.destroy();

      button.click();

      expect(handler).not.toHaveBeenCalled();
    });

    test('should clear listeners array', () => {
      modal.addEventListener(button, 'click', handler);
      modal.destroy();

      expect(modal.listeners).toEqual([]);
    });

    test('should unsubscribe from store', () => {
      const callback = jest.fn();
      modal.subscribeToStore(store, 'users', callback);
      modal.destroy();

      store.setState({ users: { selectedUserId: 1 } });

      expect(callback).not.toHaveBeenCalled();
    });

    test('should clear subscriptions array', () => {
      modal.subscribeToStore(store, 'users', jest.fn());
      modal.destroy();

      expect(modal.storeSubscriptions).toEqual([]);
    });

    test('should set isInitialized to false', () => {
      modal.destroy();
      expect(modal.isInitialized).toBe(false);
    });

    test('should clear modal reference', () => {
      modal.destroy();
      expect(modal.modal).toBeNull();
    });

    test('should close modal if open', () => {
      modal.open();
      modal.destroy();

      expect(modal.isOpen).toBe(false);
    });

    test('should call onDestroy hook if defined', () => {
      const onDestroySpy = jest.fn();
      modal.onDestroy = onDestroySpy;

      modal.destroy();

      expect(onDestroySpy).toHaveBeenCalled();
    });
  });

  describe('isModalOpen', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should return false when closed', () => {
      expect(modal.isModalOpen()).toBe(false);
    });

    test('should return true when open', () => {
      modal.open();
      expect(modal.isModalOpen()).toBe(true);
    });

    test('should return false after close', () => {
      modal.open();
      modal.close();
      expect(modal.isModalOpen()).toBe(false);
    });
  });
});
