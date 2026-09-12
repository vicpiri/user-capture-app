/**
 * DatabaseManager tests
 *
 * Uses a real sqlite file: the things worth pinning down here are the schema,
 * the pragmas and whether batched writes really commit as one, none of which a
 * mocked driver would show.
 *
 * @jest-environment node
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const DatabaseManager = require('../../../src/main/database');

describe('DatabaseManager', () => {
  const fixturesPath = path.join(os.tmpdir(), 'edu-capture-database-tests');
  let testId = 0;
  let db;

  const query = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

  const student = (nia, overrides = {}) => ({
    type: 'student',
    first_name: `Nombre${nia}`,
    last_name1: `Apellido${nia}`,
    last_name2: '',
    birth_date: '2008-01-01',
    document: '',
    nia: String(nia),
    group_code: '1ESO',
    ...overrides
  });

  const staff = (document, overrides = {}) => ({
    type: 'teacher',
    first_name: `Doc${document}`,
    last_name1: `Apellido${document}`,
    last_name2: '',
    birth_date: '1980-01-01',
    document: String(document),
    nia: '',
    ...overrides
  });

  const importUsers = (students = [], teachers = []) =>
    db.importUsers({
      groups: [{ code: '1ESO', name: 'Primero ESO' }],
      students,
      teachers,
      nonTeachingStaff: []
    });

  beforeAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    fs.mkdirSync(fixturesPath, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  beforeEach(async () => {
    jest.useRealTimers();

    testId++;
    db = new DatabaseManager(path.join(fixturesPath, `users-${testId}.db`));
    await db.initialize();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('schema', () => {
    test('should keep the journal in WAL mode', async () => {
      const [row] = await query('PRAGMA journal_mode');

      expect(row.journal_mode).toBe('wal');
    });

    test('should not fsync on every commit', async () => {
      // NORMAL (1) is safe under WAL and avoids a disk flush per commit
      const [row] = await query('PRAGMA synchronous');

      expect(row.synchronous).toBe(1);
    });

    test('should index the identifiers users are looked up by', async () => {
      const indexes = (await query("SELECT name FROM sqlite_master WHERE type = 'index'"))
        .map(row => row.name);

      expect(indexes).toContain('idx_users_nia');
      expect(indexes).toContain('idx_users_document');
    });

    test('should index the order the user list is read in', async () => {
      const indexes = (await query("SELECT name FROM sqlite_master WHERE type = 'index'"))
        .map(row => row.name);

      expect(indexes).toContain('idx_users_name');
    });

    test('should drop the index that could never serve a search', async () => {
      const indexes = (await query("SELECT name FROM sqlite_master WHERE type = 'index'"))
        .map(row => row.name);

      expect(indexes).not.toContain('idx_users_search');
    });
  });

  describe('getUsersByIdentifiers()', () => {
    beforeEach(async () => {
      await importUsers(
        [student(1001), student(1002), student(1003)],
        [staff('X111'), staff('X222')]
      );
    });

    test('should find students by NIA', async () => {
      const found = await db.getUsersByIdentifiers(['1001', '1003']);

      expect(found.map(u => u.nia).sort()).toEqual(['1001', '1003']);
    });

    test('should find staff by document', async () => {
      const found = await db.getUsersByIdentifiers(['X111']);

      expect(found).toHaveLength(1);
      expect(found[0].document).toBe('X111');
    });

    test('should resolve a mix of both in one call', async () => {
      const found = await db.getUsersByIdentifiers(['1002', 'X222']);

      expect(found).toHaveLength(2);
    });

    test('should include the group name', async () => {
      const [found] = await db.getUsersByIdentifiers(['1001']);

      expect(found.group_name).toBe('Primero ESO');
    });

    test('should ignore identifiers that match nobody', async () => {
      const found = await db.getUsersByIdentifiers(['1001', 'nope']);

      expect(found).toHaveLength(1);
    });

    test('should return nothing for an empty list', async () => {
      await expect(db.getUsersByIdentifiers([])).resolves.toEqual([]);
      await expect(db.getUsersByIdentifiers(null)).resolves.toEqual([]);
    });

    test('should handle more identifiers than fit in one statement', async () => {
      // Each identifier is bound twice, so a long list has to be chunked
      const many = Array.from({ length: 1200 }, (_, i) => `bulk${i}`);
      many.push('1001', 'X111');

      const found = await db.getUsersByIdentifiers(many);

      expect(found).toHaveLength(2);
    });
  });

  describe('image relationship backup', () => {
    const linkImages = async () => {
      const users = await db.getUsers({});
      await Promise.all(
        users.map((user, index) => db.linkImageToUser(user.id, `photo${index}.jpg`))
      );
      return users;
    };

    beforeEach(async () => {
      await importUsers([student(2001), student(2002), student(2003)]);
    });

    test('should back up every linked relationship', async () => {
      await linkImages();

      const result = await db.backupUserImageRelationships();

      expect(result.count).toBe(3);
    });

    test('should restore the relationships it backed up', async () => {
      await linkImages();
      const { backupDate } = await db.backupUserImageRelationships();

      await db.clearCapturedImages();
      expect((await db.getUsers({})).every(u => !u.image_path)).toBe(true);

      const result = await db.restoreUserImageRelationships(backupDate);

      expect(result.restored).toBe(3);
      expect((await db.getUsers({})).every(u => u.image_path)).toBe(true);
    });

    test('should leave nothing half written', async () => {
      await linkImages();
      const { backupDate } = await db.backupUserImageRelationships();

      const rows = await query(
        'SELECT COUNT(*) AS total FROM image_relationships_backup WHERE backup_date = ?',
        [backupDate]
      );

      expect(rows[0].total).toBe(3);
    });

    test('should report nothing to back up when no image is linked', async () => {
      const result = await db.backupUserImageRelationships();

      expect(result.count).toBe(0);
    });
  });
});
