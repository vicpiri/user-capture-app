/**
 * RepositoryMirror Tests
 *
 * Tests for repository mirror synchronization and file watching functionality
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const RepositoryMirror = require('../../../src/main/repositoryMirror');

// Mock logger
const mockLogger = {
  info: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  section: jest.fn()
};

describe('RepositoryMirror', () => {
  let repositoryMirror;
  let repositoryPath;
  let mirrorPath;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create temporary paths for testing
    repositoryPath = path.join(__dirname, 'fixtures', 'test-repository');
    mirrorPath = path.join(__dirname, 'fixtures', 'test-mirror');

    // Ensure clean state
    if (fs.existsSync(mirrorPath)) {
      fs.rmSync(mirrorPath, { recursive: true, force: true });
    }
    if (fs.existsSync(repositoryPath)) {
      fs.rmSync(repositoryPath, { recursive: true, force: true });
    }

    // Create repository directory
    fs.mkdirSync(repositoryPath, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (repositoryMirror) {
      repositoryMirror.stopWatch();
      repositoryMirror = null;
    }

    if (fs.existsSync(mirrorPath)) {
      fs.rmSync(mirrorPath, { recursive: true, force: true });
    }
    if (fs.existsSync(repositoryPath)) {
      fs.rmSync(repositoryPath, { recursive: true, force: true });
    }
  });

  describe('Initialization', () => {
    test('should create mirror directory on initialize', async () => {
      repositoryMirror = new RepositoryMirror(repositoryPath, mirrorPath, mockLogger);

      await repositoryMirror.initialize();

      expect(fs.existsSync(mirrorPath)).toBe(true);
      expect(mockLogger.success).toHaveBeenCalledWith('Repository mirror initialized');
    });

    test('should load existing mirror index on initialize', async () => {
      // Create mirror directory with some files
      fs.mkdirSync(mirrorPath, { recursive: true });
      fs.writeFileSync(path.join(mirrorPath, 'test1.jpg'), 'content1');
      fs.writeFileSync(path.join(mirrorPath, 'test2.jpeg'), 'content2');

      repositoryMirror = new RepositoryMirror(repositoryPath, mirrorPath, mockLogger);
      await repositoryMirror.initialize();

      const stats = repositoryMirror.getStats();
      expect(stats.totalFiles).toBe(2);
    });

    test('should handle non-existent mirror directory', async () => {
      repositoryMirror = new RepositoryMirror(repositoryPath, mirrorPath, mockLogger);

      const result = await repositoryMirror.initialize();

      expect(result).toBe(true);
      expect(fs.existsSync(mirrorPath)).toBe(true);
    });
  });

  describe('File Synchronization', () => {
    beforeEach(async () => {
      repositoryMirror = new RepositoryMirror(repositoryPath, mirrorPath, mockLogger);
      await repositoryMirror.initialize();
    });

    test('should sync new files from repository to mirror', async () => {
      // Create files in repository
      fs.writeFileSync(path.join(repositoryPath, 'image1.jpg'), 'image1 content');
      fs.writeFileSync(path.join(repositoryPath, 'image2.jpeg'), 'image2 content');

      // Start sync
      const syncPromise = new Promise(resolve => {
        repositoryMirror.once('sync-completed', resolve);
      });

      repositoryMirror.startSync();
      const result = await syncPromise;

      expect(result.success).toBe(true);
      expect(result.synced).toBe(2);
      expect(fs.existsSync(path.join(mirrorPath, 'image1.jpg'))).toBe(true);
      expect(fs.existsSync(path.join(mirrorPath, 'image2.jpeg'))).toBe(true);
    });

    test('should detect and sync modified files', async () => {
      // Create and sync initial file
      fs.writeFileSync(path.join(repositoryPath, 'image1.jpg'), 'original content');

      let syncPromise = new Promise(resolve => {
        repositoryMirror.once('sync-completed', resolve);
      });
      repositoryMirror.startSync();
      await syncPromise;

      // Modify file
      await new Promise(resolve => setTimeout(resolve, 100)); // Ensure different mtime
      fs.writeFileSync(path.join(repositoryPath, 'image1.jpg'), 'modified content');

      // Sync again
      syncPromise = new Promise(resolve => {
        repositoryMirror.once('sync-completed', resolve);
      });
      repositoryMirror.startSync();
      const result = await syncPromise;

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);

      const mirroredContent = fs.readFileSync(path.join(mirrorPath, 'image1.jpg'), 'utf8');
      expect(mirroredContent).toBe('modified content');
    });

    test('should clean up deleted files from mirror', async () => {
      // Create and sync files
      fs.writeFileSync(path.join(repositoryPath, 'image1.jpg'), 'content1');
      fs.writeFileSync(path.join(repositoryPath, 'image2.jpg'), 'content2');

      let syncPromise = new Promise(resolve => {
        repositoryMirror.once('sync-completed', resolve);
      });
      repositoryMirror.startSync();
      await syncPromise;

      expect(fs.existsSync(path.join(mirrorPath, 'image1.jpg'))).toBe(true);
      expect(fs.existsSync(path.join(mirrorPath, 'image2.jpg'))).toBe(true);

      // Delete one file from repository
      fs.unlinkSync(path.join(repositoryPath, 'image1.jpg'));

      // Sync again
      syncPromise = new Promise(resolve => {
        repositoryMirror.once('sync-completed', resolve);
      });
      repositoryMirror.startSync();
      await syncPromise;

      expect(fs.existsSync(path.join(mirrorPath, 'image1.jpg'))).toBe(false);
      expect(fs.existsSync(path.join(mirrorPath, 'image2.jpg'))).toBe(true);
    });

    test('should only sync jpg and jpeg files', async () => {
      // Create various file types
      fs.writeFileSync(path.join(repositoryPath, 'image1.jpg'), 'content1');
      fs.writeFileSync(path.join(repositoryPath, 'image2.jpeg'), 'content2');
      fs.writeFileSync(path.join(repositoryPath, 'document.txt'), 'text');
      fs.writeFileSync(path.join(repositoryPath, 'image3.png'), 'png content');

      const syncPromise = new Promise(resolve => {
        repositoryMirror.once('sync-completed', resolve);
      });

      repositoryMirror.startSync();
      const result = await syncPromise;

      expect(result.synced).toBe(2);
      expect(fs.existsSync(path.join(mirrorPath, 'image1.jpg'))).toBe(true);
      expect(fs.existsSync(path.join(mirrorPath, 'image2.jpeg'))).toBe(true);
      expect(fs.existsSync(path.join(mirrorPath, 'document.txt'))).toBe(false);
      expect(fs.existsSync(path.join(mirrorPath, 'image3.png'))).toBe(false);
    });

    test('should emit sync-progress events during sync', async () => {
      // Create multiple files
      for (let i = 0; i < 10; i++) {
        fs.writeFileSync(path.join(repositoryPath, `image${i}.jpg`), `content ${i}`);
      }

      const progressEvents = [];
      repositoryMirror.on('sync-progress', (data) => {
        progressEvents.push(data);
      });

      const syncPromise = new Promise(resolve => {
        repositoryMirror.once('sync-completed', resolve);
      });

      repositoryMirror.startSync();
      await syncPromise;

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents.some(e => e.phase === 'discovery')).toBe(true);
      expect(progressEvents.some(e => e.phase === 'syncing')).toBe(true);
    });
  });

  describe('File Watching', () => {
    beforeEach(async () => {
      repositoryMirror = new RepositoryMirror(repositoryPath, mirrorPath, mockLogger);
      await repositoryMirror.initialize();
    });

    test('should start watching repository folder', async () => {
      const watchStarted = await repositoryMirror.startWatch();

      expect(watchStarted).toBe(true);
      expect(repositoryMirror.isWatching()).toBe(true);
    });

    test('should detect when new file is added to repository', async () => {
      await repositoryMirror.startWatch();

      const changePromise = new Promise(resolve => {
        repositoryMirror.once('repository-changed', resolve);
      });

      // Add new file
      fs.writeFileSync(path.join(repositoryPath, 'new-image.jpg'), 'new content');

      const result = await changePromise;
      expect(result.type).toBe('add');
      expect(result.filename).toBe('new-image.jpg');
    });

    test('should detect when file is modified in repository', async () => {
      // Create initial file
      fs.writeFileSync(path.join(repositoryPath, 'image1.jpg'), 'original');

      await repositoryMirror.startWatch();

      const changePromise = new Promise(resolve => {
        repositoryMirror.once('repository-changed', resolve);
      });

      // Modify file
      await new Promise(resolve => setTimeout(resolve, 100));
      fs.writeFileSync(path.join(repositoryPath, 'image1.jpg'), 'modified');

      const result = await changePromise;
      expect(result.type).toBe('change');
      expect(result.filename).toBe('image1.jpg');
    });

    test('should detect when file is deleted from repository', async () => {
      // Create initial file
      fs.writeFileSync(path.join(repositoryPath, 'image1.jpg'), 'content');

      await repositoryMirror.startWatch();

      const changePromise = new Promise(resolve => {
        repositoryMirror.once('repository-changed', resolve);
      });

      // Delete file
      fs.unlinkSync(path.join(repositoryPath, 'image1.jpg'));

      const result = await changePromise;
      expect(result.type).toBe('unlink');
      expect(result.filename).toBe('image1.jpg');
    });

    test('should ignore non-image files in watch', async () => {
      await repositoryMirror.startWatch();

      let changeDetected = false;
      repositoryMirror.once('repository-changed', () => {
        changeDetected = true;
      });

      // Add non-image file
      fs.writeFileSync(path.join(repositoryPath, 'document.txt'), 'text content');

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(changeDetected).toBe(false);
    });

    test('should trigger auto-sync after detecting changes (with debounce)', async () => {
      await repositoryMirror.startWatch();

      const syncPromise = new Promise(resolve => {
        repositoryMirror.once('sync-completed', resolve);
      });

      // Add multiple files quickly
      fs.writeFileSync(path.join(repositoryPath, 'image1.jpg'), 'content1');
      fs.writeFileSync(path.join(repositoryPath, 'image2.jpg'), 'content2');
      fs.writeFileSync(path.join(repositoryPath, 'image3.jpg'), 'content3');

      // Should trigger only one sync due to debouncing
      const result = await syncPromise;

      expect(result.success).toBe(true);
      expect(result.synced).toBe(3);
    });

    test('should stop watching when stopWatch is called', async () => {
      await repositoryMirror.startWatch();
      expect(repositoryMirror.isWatching()).toBe(true);

      repositoryMirror.stopWatch();
      expect(repositoryMirror.isWatching()).toBe(false);
    });
  });

  describe('Mirror Utilities', () => {
    beforeEach(async () => {
      repositoryMirror = new RepositoryMirror(repositoryPath, mirrorPath, mockLogger);
      await repositoryMirror.initialize();
    });

    test('should return mirror path for existing file', async () => {
      fs.writeFileSync(path.join(repositoryPath, 'image1.jpg'), 'content');

      const syncPromise = new Promise(resolve => {
        repositoryMirror.once('sync-completed', resolve);
      });
      repositoryMirror.startSync();
      await syncPromise;

      const mirrorFilePath = repositoryMirror.getMirrorPath('image1.jpg');
      expect(mirrorFilePath).toBe(path.join(mirrorPath, 'image1.jpg'));
    });

    test('should return null for non-existent file', () => {
      const mirrorFilePath = repositoryMirror.getMirrorPath('nonexistent.jpg');
      expect(mirrorFilePath).toBeNull();
    });

    test('should check if file exists in mirror', async () => {
      fs.writeFileSync(path.join(repositoryPath, 'image1.jpg'), 'content');

      const syncPromise = new Promise(resolve => {
        repositoryMirror.once('sync-completed', resolve);
      });
      repositoryMirror.startSync();
      await syncPromise;

      expect(repositoryMirror.hasFile('image1.jpg')).toBe(true);
      expect(repositoryMirror.hasFile('nonexistent.jpg')).toBe(false);
    });

    test('should get stats correctly', async () => {
      fs.writeFileSync(path.join(repositoryPath, 'image1.jpg'), 'content1');
      fs.writeFileSync(path.join(repositoryPath, 'image2.jpg'), 'content2');

      const syncPromise = new Promise(resolve => {
        repositoryMirror.once('sync-completed', resolve);
      });
      repositoryMirror.startSync();
      await syncPromise;

      const stats = repositoryMirror.getStats();
      expect(stats.totalFiles).toBe(2);
      expect(stats.isSyncing).toBe(false);
      expect(stats.lastSyncTime).not.toBeNull();
    });
  });
});
