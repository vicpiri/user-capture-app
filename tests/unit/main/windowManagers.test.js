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
      removeMenu: jest.fn(),
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
      webContents: { openDevTools: jest.fn(), send: jest.fn() }
    };
    mockWindows.push(win);
    return win;
  })
}));

const fs = require('fs');
const path = require('path');

const CameraWindowManager = require('../../../src/main/window/cameraWindow');
const ImageGridWindowManager = require('../../../src/main/window/imageGridWindow');
const RepositoryGridWindowManager = require('../../../src/main/window/repositoryGridWindow');
const PrintedCardsWindowManager = require('../../../src/main/window/printedCardsWindow');
const ViewerMirrorWindowManager = require('../../../src/main/window/viewerMirrorWindow');
const GroupCoverageWindowManager = require('../../../src/main/window/groupCoverageWindow');

const MANAGERS = [
  ['CameraWindowManager', CameraWindowManager],
  ['ImageGridWindowManager', ImageGridWindowManager],
  ['RepositoryGridWindowManager', RepositoryGridWindowManager],
  ['PrintedCardsWindowManager', PrintedCardsWindowManager],
  ['ViewerMirrorWindowManager', ViewerMirrorWindowManager],
  ['GroupCoverageWindowManager', GroupCoverageWindowManager]
];

describe('window managers', () => {
  beforeEach(() => {
    mockWindows.length = 0;
    jest.clearAllMocks();
  });

  /**
   * Contract check for anyone adding a window later on.
   *
   * A secondary window that cannot be closed is not merely untidy: it survives
   * the main window and keeps 'window-all-closed' from firing, so the whole
   * application stops quitting. This walks the folder instead of a hardcoded
   * list precisely so a new manager cannot slip through unnoticed.
   */
  describe('close() contract', () => {
    const windowDir = path.join(__dirname, '../../../src/main/window');
    const secondaryModules = fs
      .readdirSync(windowDir)
      .filter((file) => file.endsWith('.js') && file !== 'mainWindow.js');

    test('should find the secondary window managers on disk', () => {
      expect(secondaryModules.length).toBeGreaterThanOrEqual(MANAGERS.length);
    });

    test.each(secondaryModules)('%s should expose close()', (file) => {
      const Manager = require(path.join(windowDir, file));

      expect(typeof Manager.prototype.close).toBe('function');
    });

    test('should be registered in the closeSecondaryWindows() list in main.js', () => {
      const mainSource = fs.readFileSync(path.join(__dirname, '../../../main.js'), 'utf8');
      const registry = mainSource.match(/const secondaryWindowManagers = \[([^\]]*)\]/);

      expect(registry).not.toBeNull();

      secondaryModules.forEach((file) => {
        // cameraWindow.js -> cameraWindowManager
        const instanceName = `${path.basename(file, '.js')}Manager`;
        expect(registry[1]).toContain(instanceName);
      });
    });
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

  describe('ViewerMirrorWindowManager', () => {
    const IMAGE = { path: 'C:/p/imports/20260918101010.jpg', url: 'app-img://image?path=x' };

    test('should keep the viewer photo before the window exists', () => {
      const manager = new ViewerMirrorWindowManager();
      manager.setImage(IMAGE);

      expect(manager.getImage()).toEqual(IMAGE);
    });

    test('should pass each change of photo to the open window', () => {
      const manager = new ViewerMirrorWindowManager();
      manager.open();
      manager.setImage(IMAGE);
      manager.setImage(null);

      const { send } = manager.getWindow().webContents;
      expect(send).toHaveBeenNthCalledWith(1, 'viewer-mirror-image', IMAGE);
      expect(send).toHaveBeenNthCalledWith(2, 'viewer-mirror-image', null);
      expect(manager.getImage()).toBeNull();
    });

    test('should take the menu off again, as rebuilding the app menu puts it back', () => {
      const manager = new ViewerMirrorWindowManager();
      expect(() => manager.removeMenu()).not.toThrow();

      manager.open();
      const win = manager.getWindow();
      win.removeMenu.mockClear();
      manager.removeMenu();
      expect(win.removeMenu).toHaveBeenCalledTimes(1);

      win.destroyed = true;
      manager.removeMenu();
      expect(win.removeMenu).toHaveBeenCalledTimes(1);
    });

    test('should treat an image without path or URL as none', () => {
      const manager = new ViewerMirrorWindowManager();
      manager.setImage({ path: IMAGE.path });

      expect(manager.getImage()).toBeNull();
    });

    test('should not send to a destroyed window', () => {
      const manager = new ViewerMirrorWindowManager();
      manager.open();
      const win = manager.getWindow();
      win.destroyed = true;

      expect(() => manager.setImage(IMAGE)).not.toThrow();
      expect(win.webContents.send).not.toHaveBeenCalled();
    });

    describe('isOnScreen()', () => {
      const primary = { workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
      const second = { workArea: { x: 1920, y: 0, width: 1920, height: 1040 } };

      test('should accept bounds on the second monitor while it is connected', () => {
        const bounds = { x: 2000, y: 100, width: 900, height: 700 };

        expect(ViewerMirrorWindowManager.isOnScreen(bounds, [primary, second])).toBe(true);
        expect(ViewerMirrorWindowManager.isOnScreen(bounds, [primary])).toBe(false);
      });

      test('should reject a window whose title bar is out of reach', () => {
        expect(ViewerMirrorWindowManager.isOnScreen({ x: 100, y: -300, width: 900, height: 700 }, [primary])).toBe(false);
        expect(ViewerMirrorWindowManager.isOnScreen({ x: 1880, y: 100, width: 900, height: 700 }, [primary])).toBe(false);
      });

      test('should reject missing or malformed bounds', () => {
        expect(ViewerMirrorWindowManager.isOnScreen(null, [primary])).toBe(false);
        expect(ViewerMirrorWindowManager.isOnScreen({ x: 1, y: 1 }, [primary])).toBe(false);
      });
    });
  });
});
