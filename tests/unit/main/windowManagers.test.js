/**
 * Window manager tests
 *
 * These managers own the lifetime of every secondary window. What matters is
 * that close() actually releases the window and that it stays safe when the
 * window is already gone, because a leftover window keeps 'window-all-closed'
 * from firing and the application never quits.
 *
 * @jest-environment node
 */

const mockWindows = [];

// The modules pull in electron, which is not available under Jest
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(function () {
    const listeners = {};
    const win = {
      destroyed: false,
      listeners,
      loadFile: jest.fn(),
      show: jest.fn(),
      focus: jest.fn(),
      setMenuBarVisibility: jest.fn(),
      isDestroyed: jest.fn(function () {
        return this.destroyed;
      }),
      close: jest.fn(function () {
        this.destroyed = true;
        (listeners.closed || []).forEach((cb) => cb());
      }),
      once: jest.fn((event, cb) => {
        (listeners[event] = listeners[event] || []).push(cb);
      }),
      on: jest.fn((event, cb) => {
        (listeners[event] = listeners[event] || []).push(cb);
      }),
      webContents: { openDevTools: jest.fn() }
    };
    mockWindows.push(win);
    return win;
  })
}));

const CameraWindowManager = require('../../../src/main/window/cameraWindow');
const ImageGridWindowManager = require('../../../src/main/window/imageGridWindow');
const RepositoryGridWindowManager = require('../../../src/main/window/repositoryGridWindow');
const PrintedCardsWindowManager = require('../../../src/main/window/printedCardsWindow');

const MANAGERS = [
  ['CameraWindowManager', CameraWindowManager],
  ['ImageGridWindowManager', ImageGridWindowManager],
  ['RepositoryGridWindowManager', RepositoryGridWindowManager],
  ['PrintedCardsWindowManager', PrintedCardsWindowManager]
];

describe('window managers', () => {
  beforeEach(() => {
    mockWindows.length = 0;
    jest.clearAllMocks();
  });

  describe.each(MANAGERS)('%s', (_name, Manager) => {
    test('should start with no window', () => {
      const manager = new Manager();

      expect(manager.getWindow()).toBeNull();
      expect(manager.isValid()).toBeFalsy();
    });

    test('should create a window on open()', () => {
      const manager = new Manager();
      manager.open();

      expect(mockWindows).toHaveLength(1);
      expect(manager.getWindow()).toBe(mockWindows[0]);
      expect(manager.isValid()).toBe(true);
    });

    test('should reuse the window on a second open()', () => {
      const manager = new Manager();
      manager.open();
      manager.open();

      expect(mockWindows).toHaveLength(1);
      expect(mockWindows[0].show).toHaveBeenCalled();
      expect(mockWindows[0].focus).toHaveBeenCalled();
    });

    test('should close the window and drop the reference', () => {
      const manager = new Manager();
      manager.open();
      const win = manager.getWindow();

      manager.close();

      expect(win.close).toHaveBeenCalledTimes(1);
      expect(manager.getWindow()).toBeNull();
    });

    test('should do nothing when closing without an open window', () => {
      const manager = new Manager();

      expect(() => manager.close()).not.toThrow();
      expect(manager.getWindow()).toBeNull();
    });

    test('should not close a window the user already closed', () => {
      const manager = new Manager();
      manager.open();
      const win = manager.getWindow();

      // The window's own 'closed' handler clears the manager's reference
      win.close();
      expect(manager.getWindow()).toBeNull();

      manager.close();

      expect(win.close).toHaveBeenCalledTimes(1);
    });

    test('should survive a stale reference to a destroyed window', () => {
      const manager = new Manager();
      manager.open();
      const win = manager.getWindow();

      // Destroyed behind the manager's back, so the reference is left dangling
      win.destroyed = true;

      expect(() => manager.close()).not.toThrow();
      expect(win.close).not.toHaveBeenCalled();
      expect(manager.getWindow()).toBeNull();
    });

    test('should open again after being closed', () => {
      const manager = new Manager();
      manager.open();
      manager.close();
      manager.open();

      expect(mockWindows).toHaveLength(2);
      expect(manager.getWindow()).toBe(mockWindows[1]);
    });
  });
});
