/**
 * Project lifecycle teardown tests
 *
 * Opening a project takes over shared globals, so the previous one must release
 * its resources first. These cover the two teardowns that reopening depends on:
 * the sqlite connection, which holds a file lock, and the ingest folder watcher.
 *
 * Runs in the node environment: this is main-process code and relies on Node
 * globals such as setImmediate, which jsdom does not provide.
 *
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');
const DatabaseManager = require('../../../src/main/database');
const FolderWatcher = require('../../../src/main/folderWatcher');

describe('Project lifecycle teardown', () => {
  const fixturesPath = path.join(__dirname, 'lifecycle-fixtures');
  let testId = 0;
  let workPath;

  beforeAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true });
    fs.mkdirSync(fixturesPath, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Real timers: the shared setup enables fake ones, and these drive actual
    // filesystem work
    jest.useRealTimers();

    testId++;
    workPath = path.join(fixturesPath, `project-${testId}`);
    fs.mkdirSync(workPath, { recursive: true });
  });

  describe('DatabaseManager.close()', () => {
    test('should resolve once the connection is closed', async () => {
      const dbManager = new DatabaseManager(path.join(workPath, 'users.db'));
      await dbManager.initialize();

      await expect(dbManager.close()).resolves.toBeUndefined();
      expect(dbManager.db).toBeNull();
    });

    test('should allow reopening the same database file', async () => {
      const dbPath = path.join(workPath, 'users.db');

      const first = new DatabaseManager(dbPath);
      await first.initialize();
      await first.importUsers({
        groups: [{ code: 'G1', name: 'Group 1' }],
        students: [],
        teachers: [],
        nonTeachingStaff: []
      });
      await first.close();

      // This is what reopening a project does: a second connection over the
      // same file, which only works if the first one really let go
      const second = new DatabaseManager(dbPath);
      await second.initialize();
      const groups = await second.getGroups();

      expect(groups.map(g => g.code)).toContain('G1');

      await second.close();
    });

    test('should be safe to call twice', async () => {
      const dbManager = new DatabaseManager(path.join(workPath, 'users.db'));
      await dbManager.initialize();

      await dbManager.close();

      await expect(dbManager.close()).resolves.toBeUndefined();
    });
  });

  describe('FolderWatcher.stop()', () => {
    const ingestPath = () => path.join(workPath, 'ingest');
    const importsPath = () => path.join(workPath, 'imports');

    const createWatcher = () => {
      fs.mkdirSync(ingestPath(), { recursive: true });
      fs.mkdirSync(importsPath(), { recursive: true });
      return new FolderWatcher(ingestPath(), importsPath());
    };

    test('should release the watcher and its listeners', async () => {
      const watcher = createWatcher();
      watcher.on('image-added', () => {});
      watcher.start();

      await watcher.stop();

      expect(watcher.watcher).toBeNull();
      expect(watcher.listenerCount('image-added')).toBe(0);
    });

    test('should be safe to call twice', async () => {
      const watcher = createWatcher();
      watcher.start();

      await watcher.stop();

      await expect(watcher.stop()).resolves.toBeUndefined();
    });

    test('should stop reporting images after being stopped', async () => {
      const watcher = createWatcher();
      const detected = [];
      watcher.on('image-added', (filename) => detected.push(filename));
      watcher.start();

      await watcher.stop();

      fs.writeFileSync(path.join(ingestPath(), 'after-stop.jpg'), 'content');
      await new Promise(resolve => setTimeout(resolve, 700));

      expect(detected).toEqual([]);
    });

    test('should allow watching the same folder again', async () => {
      // The reopen case: a replacement watcher over the same path must still
      // receive events, which requires the previous close to have completed
      const first = createWatcher();
      first.start();
      await first.stop();

      const second = new FolderWatcher(ingestPath(), importsPath());
      const detected = new Promise(resolve => second.once('image-added', resolve));
      second.start();

      // chokidar needs its initial scan to settle before the write lands
      await new Promise(resolve => setTimeout(resolve, 300));
      fs.writeFileSync(path.join(ingestPath(), 'reopened.jpg'), 'content');

      // The watcher moves the image into imports first, so it reports the
      // timestamped name it assigned, not the one it was written with
      await expect(detected).resolves.toMatch(/^\d{14}(_\d+)?\.jpg$/);

      await second.stop();
    });
  });
});
