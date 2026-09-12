/**
 * RepositoryMirror Tests
 *
 * Tests for repository mirror synchronization and file watching functionality
 *
 * Runs in the node environment: this is main-process code and relies on Node
 * globals such as setImmediate, which jsdom does not provide.
 *
 * @jest-environment node
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

// Production polls slowly on purpose, to stay cheap on network drives. These
// tests drive real filesystem events, so they override the timings to keep the
// suite fast and well inside the default timeout.
// pollingInterval is kept high so the periodic content check never fires on its
// own during a test: the watching tests must be driven by the watcher, not by a
// background poll that happens to trigger a sync at the right moment.
// Not as low as they could be: at 100ms the watcher intermittently missed
// additions entirely when the suite ran in parallel and the workers competed
// for CPU. These stay fast while leaving room for scheduling noise.
const TEST_TIMINGS = {
  watchPollInterval: 250,
  awaitWriteFinish: 250,
  syncDebounceDelay: 300,
  pollingInterval: 60000
};

// The watching tests drive real scans over the filesystem. Running alongside
// the rest of the suite they compete for CPU with the other Jest workers, and a
// starved scan can take far longer than it does in isolation, so they get a
// generous ceiling instead of failing on scheduling noise.
const WATCH_TEST_TIMEOUT = 25000;

describe('RepositoryMirror', () => {
  let repositoryMirror;
  let repositoryPath;
  let mirrorPath;

  const fixturesPath = path.join(__dirname, 'fixtures');
  let testId = 0;

  beforeAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true });
    fs.mkdirSync(fixturesPath, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true });
  });

  // The shared setup enables fake timers for the renderer suites, but this one
  // drives real filesystem work: sync yields to the event loop via setImmediate
  // and the watcher debounces with a real delay, so neither ever fires unless
  // the clock is real.
  beforeEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // A fresh directory per test, so leftovers from one never show up as
    // changes in the next
    testId++;
    repositoryPath = path.join(fixturesPath, `repository-${testId}`);
    mirrorPath = path.join(fixturesPath, `mirror-${testId}`);

    // Create repository directory
    fs.mkdirSync(repositoryPath, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup. Stopped first, so a scan still in flight cannot report the
    // files this cleanup deletes.
    if (repositoryMirror) {
      await repositoryMirror.stopWatch();
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
      repositoryMirror = new RepositoryMirror(repositoryPath, mirrorPath, mockLogger, TEST_TIMINGS);

      await repositoryMirror.initialize();

      expect(fs.existsSync(mirrorPath)).toBe(true);
      expect(mockLogger.success).toHaveBeenCalledWith('Repository mirror initialized');
    });

    test('should load existing mirror index on initialize', async () => {
      // Create mirror directory with some files
      fs.mkdirSync(mirrorPath, { recursive: true });
      fs.writeFileSync(path.join(mirrorPath, 'test1.jpg'), 'content1');
      fs.writeFileSync(path.join(mirrorPath, 'test2.jpeg'), 'content2');

      repositoryMirror = new RepositoryMirror(repositoryPath, mirrorPath, mockLogger, TEST_TIMINGS);
      await repositoryMirror.initialize();

      const stats = repositoryMirror.getStats();
      expect(stats.totalFiles).toBe(2);
    });

    test('should handle non-existent mirror directory', async () => {
      repositoryMirror = new RepositoryMirror(repositoryPath, mirrorPath, mockLogger, TEST_TIMINGS);

      const result = await repositoryMirror.initialize();

      expect(result).toBe(true);
      expect(fs.existsSync(mirrorPath)).toBe(true);
    });
  });

  describe('File Synchronization', () => {
    beforeEach(async () => {
      repositoryMirror = new RepositoryMirror(repositoryPath, mirrorPath, mockLogger, TEST_TIMINGS);
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
    // startWatch resolves once the baseline snapshot is taken, so anything
    // written afterwards is reported. A short pause keeps the write clearly
    // apart from the baseline's timestamps all the same.
    const settleWatcher = () =>
      new Promise(resolve => setTimeout(resolve, TEST_TIMINGS.watchPollInterval * 2));

    beforeEach(async () => {
      repositoryMirror = new RepositoryMirror(repositoryPath, mirrorPath, mockLogger, TEST_TIMINGS);
      await repositoryMirror.initialize();
    });

    test('should start watching repository folder', async () => {
      const watchStarted = await repositoryMirror.startWatch();

      expect(watchStarted).toBe(true);
      expect(repositoryMirror.isWatching()).toBe(true);
    });

    test('should detect when new file is added to repository', async () => {
      await repositoryMirror.startWatch();
      await settleWatcher();

      const changePromise = new Promise(resolve => {
        repositoryMirror.once('repository-changed', resolve);
      });

      // Add new file
      fs.writeFileSync(path.join(repositoryPath, 'new-image.jpg'), 'new content');

      const result = await changePromise;
      expect(result.type).toBe('add');
      expect(result.filename).toBe('new-image.jpg');
    }, WATCH_TEST_TIMEOUT);

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
    }, WATCH_TEST_TIMEOUT);

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
    }, WATCH_TEST_TIMEOUT);

    test('should ignore non-image files in watch', async () => {
      await repositoryMirror.startWatch();
      await settleWatcher();

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
      await settleWatcher();

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
    }, WATCH_TEST_TIMEOUT);

    test('should stop watching when stopWatch is called', async () => {
      await repositoryMirror.startWatch();
      expect(repositoryMirror.isWatching()).toBe(true);

      repositoryMirror.stopWatch();
      expect(repositoryMirror.isWatching()).toBe(false);
    });

    test('should report nothing after stopWatch', async () => {
      await repositoryMirror.startWatch();
      await settleWatcher();

      const changes = [];
      repositoryMirror.on('repository-changed', (change) => changes.push(change));

      await repositoryMirror.stopWatch();
      fs.writeFileSync(path.join(repositoryPath, 'late.jpg'), 'content');

      await new Promise(resolve => setTimeout(resolve, TEST_TIMINGS.watchPollInterval * 3));

      expect(changes).toEqual([]);
    });

    test('should report a change once, not on every scan after it', async () => {
      fs.writeFileSync(path.join(repositoryPath, 'image1.jpg'), 'original');
      await repositoryMirror.startWatch();

      const firstChange = new Promise(resolve => {
        repositoryMirror.once('repository-changed', resolve);
      });

      // A different length on purpose. Windows stamps file times from a clock
      // that ticks every few milliseconds, and this write can land in the same
      // tick as the original: same mtime and same size would be invisible to
      // any metadata comparison, which is the content check's job, not this one.
      fs.writeFileSync(path.join(repositoryPath, 'image1.jpg'), 'modified, and longer');

      expect(await firstChange).toEqual({ type: 'change', filename: 'image1.jpg' });

      // Several more scans: the snapshot now holds the new size and mtime, so
      // none of them may report the same change again
      const repeated = [];
      repositoryMirror.on('repository-changed', (change) => repeated.push(change));

      await new Promise(resolve => setTimeout(resolve, TEST_TIMINGS.watchPollInterval * 4));

      expect(repeated).toEqual([]);
    }, WATCH_TEST_TIMEOUT);

    test('should keep only a few stats in flight while scanning', async () => {
      // The scan shares the libuv thread pool with the thumbnails the
      // interface is waiting for. Flooding it is what made photos take twenty
      // seconds to appear after a scroll over a Google Drive repository.
      for (let i = 0; i < 30; i++) {
        fs.writeFileSync(path.join(repositoryPath, `image${i}.jpg`), `content${i}`);
      }

      const realStat = fs.promises.stat;
      let inFlight = 0;
      let peak = 0;
      const statSpy = jest.spyOn(fs.promises, 'stat').mockImplementation(async (...args) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        try {
          await new Promise(resolve => setTimeout(resolve, 5));
          return await realStat(...args);
        } finally {
          inFlight--;
        }
      });

      let snapshot;
      try {
        snapshot = await repositoryMirror.scanRepository();
      } finally {
        statSpy.mockRestore();
      }

      expect(snapshot.size).toBe(30);
      expect(peak).toBe(repositoryMirror.STAT_CONCURRENCY);
      expect(peak).toBeLessThan(8);
    });
  });

  describe('Index readiness', () => {
    test('should not report the index as ready before it is loaded', async () => {
      fs.mkdirSync(mirrorPath, { recursive: true });
      for (let i = 0; i < 40; i++) {
        fs.writeFileSync(path.join(mirrorPath, `image${i}.jpg`), `content${i}`);
      }

      repositoryMirror = new RepositoryMirror(repositoryPath, mirrorPath, mockLogger, TEST_TIMINGS);

      // Asking straight after construction, as the interface does: without the
      // wait it would be told the repository holds nothing
      const initializing = repositoryMirror.initialize();
      await repositoryMirror.whenIndexLoaded();

      expect(repositoryMirror.mirrorIndex.size).toBe(40);
      await initializing;
    });

    test('should release the wait even when initialize fails', async () => {
      // A mirror path that cannot be created
      repositoryMirror = new RepositoryMirror(
        repositoryPath,
        path.join(repositoryPath, 'image.jpg', 'nested'),
        mockLogger,
        TEST_TIMINGS
      );
      fs.writeFileSync(path.join(repositoryPath, 'image.jpg'), 'not a folder');

      await repositoryMirror.initialize();

      await expect(repositoryMirror.whenIndexLoaded()).resolves.toBeUndefined();
    });

    test('should give up waiting rather than hang', async () => {
      repositoryMirror = new RepositoryMirror(repositoryPath, mirrorPath, mockLogger, {
        ...TEST_TIMINGS,
        indexWaitTimeout: 50
      });

      // initialize is never called, so the index never loads
      await expect(repositoryMirror.whenIndexLoaded()).resolves.toBeUndefined();
    });
  });

  describe('Periodic content check', () => {
    const syncAll = async () => {
      const syncPromise = new Promise(resolve => {
        repositoryMirror.once('sync-completed', resolve);
      });
      repositoryMirror.startSync();
      await syncPromise;
    };

    // The comparison this describe exercises is size and mtime against the
    // mirrored copy. Pinning the source timestamps to a whole second keeps
    // sub-millisecond filesystem precision out of the assertions.
    const writePhoto = (name, contents) => {
      const filePath = path.join(repositoryPath, name);
      fs.writeFileSync(filePath, contents);
      const whole = new Date(Math.floor(Date.now() / 1000) * 1000);
      fs.utimesSync(filePath, whole, whole);
      return filePath;
    };

    beforeEach(async () => {
      repositoryMirror = new RepositoryMirror(repositoryPath, mirrorPath, mockLogger, TEST_TIMINGS);
      await repositoryMirror.initialize();
    });

    test('should report no changes when repository matches mirror', async () => {
      writePhoto('image1.jpg', 'content1');
      writePhoto('image2.jpg', 'content2');
      await syncAll();

      expect(await repositoryMirror.checkForChanges()).toBe(false);
    });

    test('should report changes when the file count differs', async () => {
      writePhoto('image1.jpg', 'content1');
      await syncAll();

      writePhoto('image2.jpg', 'content2');

      expect(await repositoryMirror.checkForChanges()).toBe(true);
    });

    test('should detect a replacement that kept its size and mtime', async () => {
      const filePath = path.join(repositoryPath, 'image1.jpg');
      // Whole second, so restoring it later loses no sub-millisecond fraction
      const fixedTime = new Date(Math.floor(Date.now() / 1000) * 1000);

      fs.writeFileSync(filePath, 'aaaaaaaa');
      fs.utimesSync(filePath, fixedTime, fixedTime);
      await syncAll();

      // Same byte length, different content, timestamp restored: neither the
      // watcher nor a size/mtime comparison can see this, only the hash check
      fs.writeFileSync(filePath, 'bbbbbbbb');
      fs.utimesSync(filePath, fixedTime, fixedTime);

      const entry = repositoryMirror.mirrorIndex.get('image1.jpg');
      const stats = fs.statSync(filePath);
      expect(stats.size).toBe(entry.size);
      expect(stats.mtimeMs).toBe(entry.mtime);

      expect(await repositoryMirror.checkForChanges()).toBe(true);
    });

    test('should detect a missing mirror file', async () => {
      writePhoto('image1.jpg', 'content1');
      await syncAll();

      fs.unlinkSync(path.join(mirrorPath, 'image1.jpg'));

      expect(await repositoryMirror.checkForChanges()).toBe(true);
    });

    test('should decide correctly over more files than run at once', async () => {
      // determineFilesToSync overlaps its stats; the result must not depend on
      // how the work happened to be spread
      for (let i = 0; i < 60; i++) {
        writePhoto(`image${i}.jpg`, `content${i}`);
      }
      await syncAll();

      const extra = 'newcomer.jpg';
      writePhoto(extra, 'brand new');

      const files = await repositoryMirror.discoverRepositoryFiles();
      const toSync = await repositoryMirror.determineFilesToSync(files);

      expect(toSync).toEqual([extra]);
    });

    test('should advance the sample cursor so every file is eventually checked', async () => {
      repositoryMirror.CONTENT_CHECK_SAMPLE_SIZE = 2;

      for (let i = 0; i < 6; i++) {
        writePhoto(`image${i}.jpg`, `content${i}`);
      }
      await syncAll();

      expect(repositoryMirror.contentCheckCursor).toBe(0);
      await repositoryMirror.checkForChanges();
      expect(repositoryMirror.contentCheckCursor).toBe(2);
      await repositoryMirror.checkForChanges();
      expect(repositoryMirror.contentCheckCursor).toBe(4);

      // Wraps back around instead of running off the end
      await repositoryMirror.checkForChanges();
      expect(repositoryMirror.contentCheckCursor).toBe(0);
    });
  });

  describe('Mirror Utilities', () => {
    beforeEach(async () => {
      repositoryMirror = new RepositoryMirror(repositoryPath, mirrorPath, mockLogger, TEST_TIMINGS);
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
