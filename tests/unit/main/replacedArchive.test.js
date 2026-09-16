/**
 * Reading and purging the repository's folder of replaced photos
 *
 * What must hold: the folder is read without the repository having one, only
 * the folders an export made are ever deleted, and the purge respects the date
 * it is given. It deletes photos from a folder shared by the whole centre, so
 * "nothing else is touched" is the point of most of this.
 *
 * @jest-environment node
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  REPLACED_FOLDER,
  NOTICE_PHOTOS,
  parseRunName,
  scanReplacedArchive,
  purgeReplacedRuns,
  shouldNoticeArchive
} = require('../../../src/main/replacedArchive');

describe('replacedArchive', () => {
  const fixtures = path.join(os.tmpdir(), 'edu-capture-replaced-tests');
  let testId = 0;
  let repositoryPath;
  let replacedPath;

  const runPath = (name) => path.join(replacedPath, name);

  const makeRun = (name, photos = ['1234.jpg']) => {
    fs.mkdirSync(runPath(name), { recursive: true });
    photos.forEach((photo, index) => {
      fs.writeFileSync(path.join(runPath(name), photo), 'x'.repeat(10 * (index + 1)));
    });
  };

  beforeAll(() => {
    fs.rmSync(fixtures, { recursive: true, force: true });
  });

  afterAll(() => {
    fs.rmSync(fixtures, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.useRealTimers();
    testId++;
    repositoryPath = path.join(fixtures, `repository-${testId}`);
    replacedPath = path.join(repositoryPath, REPLACED_FOLDER);
    fs.mkdirSync(replacedPath, { recursive: true });
  });

  describe('parseRunName()', () => {
    test('reads the date and the computer out of the folder name', () => {
      const run = parseRunName('20260914103000_SECRETARIA');

      expect(run.host).toBe('SECRETARIA');
      expect(run.date).toEqual(new Date(2026, 8, 14, 10, 30, 0));
    });

    test('accepts the suffix of two runs in the same second', () => {
      expect(parseRunName('20260914103000_SECRETARIA-2').host).toBe('SECRETARIA-2');
    });

    test('refuses anything an export did not make', () => {
      expect(parseRunName('Recuperadas')).toBeNull();
      expect(parseRunName('20260914103000')).toBeNull();
      expect(parseRunName('2026091410300_SECRETARIA')).toBeNull();
      // A date that does not exist: JavaScript would roll it into October
      expect(parseRunName('20260931103000_SECRETARIA')).toBeNull();
    });
  });

  describe('scanReplacedArchive()', () => {
    test('lists the runs oldest first, counting their photos', async () => {
      makeRun('20260914103000_SECRETARIA', ['1.jpg', '2.jpg']);
      makeRun('20260301090000_CONSERJERIA', ['3.jpg']);

      const scan = await scanReplacedArchive(repositoryPath);

      expect(scan.runs.map((run) => run.host)).toEqual(['CONSERJERIA', 'SECRETARIA']);
      expect(scan.runs.map((run) => run.photos)).toEqual([1, 2]);
      expect(scan.photos).toBe(3);
    });

    test('adds up the bytes only when asked', async () => {
      makeRun('20260914103000_SECRETARIA', ['1.jpg', '2.jpg']);

      expect((await scanReplacedArchive(repositoryPath)).bytes).toBe(0);
      expect((await scanReplacedArchive(repositoryPath, { withSizes: true })).bytes).toBe(30);
    });

    test('counts what it does not recognise instead of listing it', async () => {
      makeRun('20260914103000_SECRETARIA');
      fs.mkdirSync(runPath('Copias a mano'));
      fs.writeFileSync(runPath('leeme.txt'), 'no tocar');

      const scan = await scanReplacedArchive(repositoryPath);

      expect(scan.runs).toHaveLength(1);
      expect(scan.strangers).toBe(2);
    });

    test('answers empty when nothing has been replaced yet', async () => {
      fs.rmSync(replacedPath, { recursive: true });

      const scan = await scanReplacedArchive(repositoryPath);

      expect(scan).toMatchObject({ runs: [], photos: 0, strangers: 0 });
      expect(scan.folder).toBe(replacedPath);
    });

    test('answers empty without a repository', async () => {
      await expect(scanReplacedArchive(null)).resolves.toMatchObject({ folder: null, runs: [] });
    });
  });

  describe('purgeReplacedRuns()', () => {
    beforeEach(() => {
      makeRun('20250901120000_SECRETARIA', ['old.jpg']);
      makeRun('20260301090000_CONSERJERIA', ['middle.jpg']);
      makeRun('20260914103000_SECRETARIA', ['recent.jpg']);
    });

    test('deletes the runs before the date and keeps the rest', async () => {
      const removed = await purgeReplacedRuns(repositoryPath, {
        before: new Date(2026, 5, 1)
      });

      expect(removed).toMatchObject({ runs: 2, photos: 2, failed: [] });
      expect(removed.bytes).toBeGreaterThan(0);
      expect(fs.readdirSync(replacedPath)).toEqual(['20260914103000_SECRETARIA']);
    });

    test('deletes every run when given no date', async () => {
      const removed = await purgeReplacedRuns(repositoryPath, {});

      expect(removed.runs).toBe(3);
      expect(fs.readdirSync(replacedPath)).toEqual([]);
    });

    test('deletes nothing when everything is newer than the date', async () => {
      const removed = await purgeReplacedRuns(repositoryPath, { before: new Date(2020, 0, 1) });

      expect(removed.runs).toBe(0);
      expect(fs.readdirSync(replacedPath)).toHaveLength(3);
    });

    test('never touches a folder an export did not make', async () => {
      fs.mkdirSync(runPath('Copias a mano'));
      fs.writeFileSync(path.join(runPath('Copias a mano'), 'guardada.jpg'), 'x');

      await purgeReplacedRuns(repositoryPath, {});

      expect(fs.existsSync(path.join(runPath('Copias a mano'), 'guardada.jpg'))).toBe(true);
    });

    test('reports the runs it could not delete and goes on with the rest', async () => {
      const logger = { info: jest.fn(), warning: jest.fn() };
      const doomed = runPath('20250901120000_SECRETARIA');
      const realRm = fs.promises.rm;
      jest.spyOn(fs.promises, 'rm').mockImplementation((target, options) => (
        target === doomed
          ? Promise.reject(new Error('EBUSY'))
          : realRm(target, options)
      ));

      const removed = await purgeReplacedRuns(repositoryPath, { before: new Date(2026, 5, 1), logger });

      expect(removed.runs).toBe(1);
      expect(removed.failed).toEqual([{ name: '20250901120000_SECRETARIA', error: 'EBUSY' }]);
      expect(logger.warning).toHaveBeenCalled();
      expect(fs.existsSync(doomed)).toBe(true);

      fs.promises.rm.mockRestore();
    });
  });

  describe('shouldNoticeArchive()', () => {
    const now = new Date(2026, 8, 16);
    const run = (date) => ({ date });
    const big = (date) => ({ runs: [run(date)], photos: NOTICE_PHOTOS, now });

    test('offers the purge when the pile is big and old', () => {
      expect(shouldNoticeArchive(big(new Date(2025, 8, 1)))).toBe(true);
    });

    test('says nothing about a small pile, however old', () => {
      expect(shouldNoticeArchive({ ...big(new Date(2020, 0, 1)), photos: NOTICE_PHOTOS - 1 })).toBe(false);
    });

    test('says nothing when a purge would delete nothing', () => {
      // Plenty of photos, but every one of them from this month
      expect(shouldNoticeArchive(big(new Date(2026, 8, 1)))).toBe(false);
    });

    test('does not come back for a month', () => {
      const old = new Date(2025, 8, 1);

      expect(shouldNoticeArchive({ ...big(old), lastNotice: new Date(2026, 8, 10).toISOString() })).toBe(false);
      expect(shouldNoticeArchive({ ...big(old), lastNotice: new Date(2026, 7, 1).toISOString() })).toBe(true);
    });

    test('offers it again when what was written down makes no sense', () => {
      expect(shouldNoticeArchive({ ...big(new Date(2025, 8, 1)), lastNotice: 'ayer' })).toBe(true);
    });
  });
});
