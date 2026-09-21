/**
 * Pending request review and archive tests
 *
 * The request folders live in the shared repository, and archiving moves
 * files other computers read. A request archived by mistake means a card that
 * is never printed, so what gets listed, and what gets moved, must be exactly
 * what the review said.
 *
 * @jest-environment node
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const DatabaseManager = require('../../../src/main/database');
const {
  ARCHIVE_FOLDER,
  reviewRequests,
  archiveRequests
} = require('../../../src/main/pendingRequests');

describe('pendingRequests', () => {
  const fixturesPath = path.join(os.tmpdir(), 'edu-capture-pending-requests-tests');
  let testId = 0;
  let repositoryPath;
  let db;

  const LAST_COURSE = new Date(2026, 5, 15);
  const THIS_COURSE = new Date(2026, 9, 1);

  // Creation time cannot be set, and a request's date is the later of
  // creation and modification: files dated in the past only look old to a
  // course that has not started yet. So "this course" is 2999 in the tests
  // that need an old request, and 2000 in those that need a recent one.
  const request = (folder, file, date) => {
    const folderPath = path.join(repositoryPath, folder);
    fs.mkdirSync(folderPath, { recursive: true });
    const filePath = path.join(folderPath, file);
    fs.writeFileSync(filePath, '');
    if (date) {
      fs.utimesSync(filePath, date, date);
    }
    return filePath;
  };

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
    const projectPath = path.join(fixturesPath, `project-${testId}`);
    repositoryPath = path.join(fixturesPath, `repository-${testId}`);
    fs.mkdirSync(projectPath, { recursive: true });
    fs.mkdirSync(repositoryPath, { recursive: true });

    db = new DatabaseManager(path.join(projectPath, 'users.db'));
    await db.initialize();

    await db.importUsers({
      groups: [{ code: '1ESOA', name: 'Primero ESO A' }],
      students: [
        { first_name: 'ANA', last_name1: 'GARCIA', last_name2: 'LOPEZ', nia: '1001', group_code: '1ESOA', document: '', birth_date: '2010-01-01' },
        { first_name: 'LUIS', last_name1: 'PEREZ', last_name2: '', nia: '1002', group_code: '1ESOA', document: '', birth_date: '2010-02-02' }
      ],
      teachers: [
        { first_name: 'MARIA', last_name1: 'RUIZ', last_name2: '', document: 'D100', birth_date: '1980-01-01' }
      ],
      nonTeachingStaff: []
    });
  });

  afterEach(async () => {
    await db.close();
  });

  describe('reviewRequests', () => {
    test('should list the requests of people outside the project', async () => {
      await db.setProjectSetting('academicYear', '2000');
      request('To-Print-ID', '9999', LAST_COURSE);
      request('To-Print-ID', '1001', THIS_COURSE);

      const review = await reviewRequests(db, repositoryPath);

      expect(review.cards.others.map(entry => entry.id)).toEqual(['9999']);
      expect(review.cards.total).toBe(2);
    });

    test('should list the project requests from before its course, with who they are for', async () => {
      await db.setProjectSetting('academicYear', '2999');
      request('To-Print-ID', '1001', LAST_COURSE);

      const review = await reviewRequests(db, repositoryPath);

      expect(review.cards.previousCourse).toEqual([
        expect.objectContaining({ id: '1001', file: '1001', name: 'GARCIA LOPEZ, ANA', group: 'Primero ESO A' })
      ]);
    });

    test('should leave out the project requests of this course', async () => {
      await db.setProjectSetting('academicYear', '2000');
      request('To-Print-ID', '1002', THIS_COURSE);

      const review = await reviewRequests(db, repositoryPath);

      expect(review.cards.others).toEqual([]);
      expect(review.cards.previousCourse).toEqual([]);
    });

    test('should review publications by the file name without its extension', async () => {
      await db.setProjectSetting('academicYear', '2999');
      request('To-Publish', '9999.jpg', LAST_COURSE);
      request('To-Publish', 'D100.jpg', LAST_COURSE);

      const review = await reviewRequests(db, repositoryPath);

      expect(review.publications.others).toEqual([expect.objectContaining({ id: '9999', file: '9999.jpg' })]);
      expect(review.publications.previousCourse).toEqual([
        expect.objectContaining({ id: 'D100', file: 'D100.jpg', name: 'RUIZ, MARIA' })
      ]);
    });

    test('should list the oldest first', async () => {
      await db.setProjectSetting('academicYear', '2999');
      request('To-Print-ID', '8888', THIS_COURSE);
      request('To-Print-ID', '9999', LAST_COURSE);

      const review = await reviewRequests(db, repositoryPath);

      expect(review.cards.others.map(entry => entry.id)).toEqual(['9999', '8888']);
    });

    test('should report the project course', async () => {
      await db.setProjectSetting('academicYear', '2026');

      await expect(reviewRequests(db, repositoryPath)).resolves.toMatchObject({ academicYear: 2026 });
    });

    test('should not list what was already archived', async () => {
      fs.mkdirSync(path.join(repositoryPath, 'To-Print-ID', ARCHIVE_FOLDER), { recursive: true });
      request('To-Print-ID', path.join(ARCHIVE_FOLDER, '9999'));

      const review = await reviewRequests(db, repositoryPath);

      expect(review.cards.total).toBe(0);
    });

    test('should report nothing when the folders do not exist', async () => {
      const review = await reviewRequests(db, repositoryPath);

      expect(review.cards).toMatchObject({ total: 0, others: [], previousCourse: [] });
      expect(review.publications).toMatchObject({ total: 0, others: [], previousCourse: [] });
    });
  });

  describe('archiveRequests', () => {
    const archived = (folder) => {
      const archivePath = path.join(repositoryPath, folder, ARCHIVE_FOLDER);
      return fs.existsSync(archivePath) ? fs.readdirSync(archivePath).sort() : [];
    };
    const pending = (folder) => fs.readdirSync(path.join(repositoryPath, folder))
      .filter(name => name !== ARCHIVE_FOLDER).sort();

    test('should move the chosen requests into Archivadas', async () => {
      request('To-Print-ID', '9999');
      request('To-Print-ID', '1001');

      const result = await archiveRequests(repositoryPath, 'cards', ['9999']);

      expect(result).toEqual({ moved: 1, failed: [] });
      expect(archived('To-Print-ID')).toEqual(['9999']);
      expect(pending('To-Print-ID')).toEqual(['1001']);
    });

    test('should archive publications with their photo', async () => {
      request('To-Publish', '9999.jpg');

      await archiveRequests(repositoryPath, 'publications', ['9999.jpg']);

      expect(archived('To-Publish')).toEqual(['9999.jpg']);
    });

    test('should replace an older archived request of the same person', async () => {
      request('To-Print-ID', '9999');
      await archiveRequests(repositoryPath, 'cards', ['9999']);
      request('To-Print-ID', '9999');

      const result = await archiveRequests(repositoryPath, 'cards', ['9999']);

      expect(result.moved).toBe(1);
      expect(archived('To-Print-ID')).toEqual(['9999']);
      expect(pending('To-Print-ID')).toEqual([]);
    });

    test('should report a request that is no longer there', async () => {
      fs.mkdirSync(path.join(repositoryPath, 'To-Print-ID'), { recursive: true });

      const result = await archiveRequests(repositoryPath, 'cards', ['9999']);

      expect(result).toEqual({ moved: 0, failed: ['9999'] });
    });

    test('should refuse anything that is not a file of the request folder', async () => {
      // The photo in the repository root must never be moved from here
      fs.writeFileSync(path.join(repositoryPath, '1001.jpg'), 'photo');
      request('To-Print-ID', '1001');

      const result = await archiveRequests(repositoryPath, 'cards', [
        '../1001.jpg', '..', '.', '', ARCHIVE_FOLDER, path.join(repositoryPath, '1001.jpg')
      ]);

      expect(result.moved).toBe(0);
      expect(result.failed).toHaveLength(6);
      expect(fs.existsSync(path.join(repositoryPath, '1001.jpg'))).toBe(true);
      expect(pending('To-Print-ID')).toEqual(['1001']);
    });

    test('should do nothing with an empty choice', async () => {
      const result = await archiveRequests(repositoryPath, 'cards', []);

      expect(result).toEqual({ moved: 0, failed: [] });
      expect(fs.existsSync(path.join(repositoryPath, 'To-Print-ID'))).toBe(false);
    });
  });
});
