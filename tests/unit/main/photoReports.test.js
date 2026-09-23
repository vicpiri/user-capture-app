/**
 * PDF reports on missing photos: export-missing-photos-pdf,
 * export-group-coverage-pdf and the grouping behind them
 *
 * What must hold: the list counts as missing exactly who the export or the
 * photos by group window would, leaves out the deleted users, sorts people
 * like every other listing, writes no file when nobody is missing, and the
 * statistics still come out when the repository cannot be read.
 *
 * @jest-environment node
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const mockHandlers = new Map();
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn((channel, handler) => mockHandlers.set(channel, handler))
  }
}));

const { registerExportHandlers } = require('../../../src/main/ipc/exportHandlers');
const {
  groupMissingPhotos,
  fullName,
  userIdentifier,
  hslToRgb,
  formatGeneratedAt
} = require('../../../src/main/photoReports');

const logger = {
  info: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  section: jest.fn()
};

const student = (nia, group = '1ESOA', overrides = {}) => ({
  id: Number(nia),
  type: 'student',
  nia: String(nia),
  document: '',
  first_name: `Nombre${nia}`,
  last_name1: `Apellido${nia}`,
  last_name2: '',
  group_code: group,
  image_path: null,
  ...overrides
});

const isPdf = (file) => fs.readFileSync(file).subarray(0, 5).toString() === '%PDF-';

describe('groupMissingPhotos()', () => {
  const hasCaptured = (user) => Boolean(user.image_path);

  test('should count per group and list only who has no photo', () => {
    const groups = groupMissingPhotos([
      student(1), student(2, '1ESOA', { image_path: 'a.jpg' }), student(3, '2ESOA')
    ], hasCaptured, new Map([['1ESOA', '1º ESO A']]));

    expect(groups).toEqual([
      expect.objectContaining({ code: '1ESOA', name: '1º ESO A', total: 2, withImage: 1, withoutImage: 1 }),
      expect.objectContaining({ code: '2ESOA', name: '2ESOA', total: 1, withImage: 0, withoutImage: 1 })
    ]);
    expect(groups[0].missing.map((user) => user.id)).toEqual([1]);
  });

  test('should leave out deleted users', () => {
    const groups = groupMissingPhotos([student(1), student(2, 'ELIMINADOS')], hasCaptured);

    expect(groups.map((group) => group.code)).toEqual(['1ESOA']);
  });

  test('should keep groups with nobody missing, for the summary', () => {
    const groups = groupMissingPhotos([student(1, '1ESOA', { image_path: 'a.jpg' })], hasCaptured);

    expect(groups).toEqual([expect.objectContaining({ code: '1ESOA', withoutImage: 0, missing: [] })]);
  });

  test('should sort groups by code with numbers in order', () => {
    const groups = groupMissingPhotos([student(1, '10A'), student(2, '2A'), student(3, '1A')], hasCaptured);

    expect(groups.map((group) => group.code)).toEqual(['1A', '2A', '10A']);
  });

  test('should sort people ignoring accents, like every listing', () => {
    const groups = groupMissingPhotos([
      student(1, '1A', { last_name1: 'Zapata' }),
      student(2, '1A', { last_name1: 'Álvarez' })
    ], hasCaptured);

    expect(groups[0].missing.map((user) => user.last_name1)).toEqual(['Álvarez', 'Zapata']);
  });

  test('should name users with no group', () => {
    const groups = groupMissingPhotos([student(1, null)], hasCaptured);

    expect(groups[0]).toEqual(expect.objectContaining({ code: '', name: 'Sin grupo' }));
  });
});

describe('report helpers', () => {
  test('fullName should put the surnames first', () => {
    expect(fullName({ first_name: 'Ana', last_name1: 'Ruiz', last_name2: 'Gil' })).toBe('Ruiz Gil, Ana');
    expect(fullName({ first_name: 'Ana', last_name1: 'Ruiz', last_name2: null })).toBe('Ruiz, Ana');
  });

  test('userIdentifier should use the NIA for students and the document for staff', () => {
    expect(userIdentifier({ type: 'student', nia: '1001', document: 'X' })).toBe('1001');
    expect(userIdentifier({ type: 'teacher', nia: '', document: '11111111H' })).toBe('11111111H');
  });

  test('hslToRgb should match the CSS colours of the window', () => {
    expect(hslToRgb(0, 100, 50)).toEqual([255, 0, 0]);
    expect(hslToRgb(120, 100, 50)).toEqual([0, 255, 0]);
    expect(hslToRgb(0, 0, 100)).toEqual([255, 255, 255]);
  });

  test('formatGeneratedAt should write a Spanish date and time', () => {
    expect(formatGeneratedAt(new Date(2026, 8, 3, 9, 5))).toBe('03/09/2026 a las 09:05');
  });
});

describe('PDF report handlers', () => {
  const fixturesPath = path.join(os.tmpdir(), 'edu-capture-photo-reports-tests');
  let testId = 0;
  let repositoryPath;
  let exportPath;
  let state;

  const runMissing = (users, source) =>
    mockHandlers.get('export-missing-photos-pdf')({}, { exportPath, users, source, scopeLabel: 'Todos' });

  const runCoverage = () => mockHandlers.get('export-group-coverage-pdf')({}, { exportPath });

  beforeAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    fs.mkdirSync(fixturesPath, { recursive: true });

    state = { dbManager: null, projectPath: null };
    registerExportHandlers({ mainWindow: () => null, logger, state, repositoryMirror: () => null });
  });

  afterAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    testId++;
    repositoryPath = path.join(fixturesPath, `repository-${testId}`);
    exportPath = path.join(fixturesPath, `export-${testId}`);
    fs.mkdirSync(repositoryPath, { recursive: true });
    fs.mkdirSync(exportPath, { recursive: true });

    state.projectPath = path.join(fixturesPath, 'Proyecto de prueba');
    state.dbManager = {
      getProjectSetting: jest.fn(async (key) => (key === 'imageRepositoryPath' ? repositoryPath : null)),
      getGroups: jest.fn(async () => [{ code: '1ESOA', name: '1º ESO A' }]),
      getGroupPhotoCoverage: jest.fn(async (hasPhoto = (user) => Boolean(user.image_path)) => {
        const users = [student(1001), student(1002, '1ESOA', { image_path: 'a.jpg' })];
        const withImage = users.filter(hasPhoto).length;
        return [{ code: '1ESOA', name: '1º ESO A', total: users.length, withImage, withoutImage: users.length - withImage }];
      })
    };
  });

  describe('export-missing-photos-pdf', () => {
    test('should refuse to run without an open project', async () => {
      state.dbManager = null;

      const result = await runMissing([student(1)], 'captured');

      expect(result.success).toBe(false);
    });

    test('should refuse an empty list', async () => {
      const result = await runMissing([], 'captured');

      expect(result.success).toBe(false);
      expect(fs.readdirSync(exportPath)).toEqual([]);
    });

    test('should list the users without a captured photo', async () => {
      const result = await runMissing([
        student(1001), student(1002, '1ESOA', { image_path: 'a.jpg' }), student(1003, '2ESOA')
      ], 'captured');

      expect(result).toEqual({ success: true, fileName: 'Usuarios_sin_foto_capturada.pdf', total: 3, missing: 2, groups: 2 });
      expect(isPdf(path.join(exportPath, result.fileName))).toBe(true);
    });

    test('should look in the repository by NIA, whatever the captured photo', async () => {
      fs.writeFileSync(path.join(repositoryPath, '1001.jpg'), '');
      fs.writeFileSync(path.join(repositoryPath, '1002.JPEG'), '');

      const result = await runMissing([
        student(1001), student(1002), student(1003, '1ESOA', { image_path: 'a.jpg' })
      ], 'repository');

      expect(result).toEqual(expect.objectContaining({
        success: true, fileName: 'Usuarios_sin_foto_en_deposito.pdf', total: 3, missing: 1
      }));
      expect(isPdf(path.join(exportPath, result.fileName))).toBe(true);
    });

    test('should explain where to configure a missing repository', async () => {
      state.dbManager.getProjectSetting.mockResolvedValue(null);

      const result = await runMissing([student(1)], 'repository');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Proyecto > Configurar depósito de imágenes/);
    });

    test('should write nothing when nobody is missing', async () => {
      const result = await runMissing([student(1, '1ESOA', { image_path: 'a.jpg' })], 'captured');

      expect(result).toEqual({ success: true, fileName: null, total: 1, missing: 0 });
      expect(fs.readdirSync(exportPath)).toEqual([]);
    });

    test('should carry a long list over several pages', async () => {
      const users = Array.from({ length: 120 }, (_, index) => student(2000 + index));

      const result = await runMissing(users, 'captured');

      expect(result.missing).toBe(120);
      const content = fs.readFileSync(path.join(exportPath, result.fileName), 'latin1');
      // Summary page, then the group over at least three
      expect((content.match(/\/Type \/Page\b/g) || []).length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('export-group-coverage-pdf', () => {
    test('should include the repository when it can be read', async () => {
      fs.writeFileSync(path.join(repositoryPath, '1001.jpg'), '');

      const result = await runCoverage();

      expect(result).toEqual({ success: true, fileName: 'Fotografias_por_grupo.pdf', includesRepository: true, repositoryNote: '' });
      expect(state.dbManager.getGroupPhotoCoverage).toHaveBeenCalledTimes(2);
      expect(isPdf(path.join(exportPath, result.fileName))).toBe(true);
    });

    test('should still export the captured figures without a repository', async () => {
      state.dbManager.getProjectSetting.mockResolvedValue(null);

      const result = await runCoverage();

      expect(result.success).toBe(true);
      expect(result.includesRepository).toBe(false);
      expect(result.repositoryNote).toMatch(/no se ha configurado/);
      expect(isPdf(path.join(exportPath, result.fileName))).toBe(true);
    });

    test('should say so when the repository folder is not available', async () => {
      fs.rmSync(repositoryPath, { recursive: true, force: true });

      const result = await runCoverage();

      expect(result.includesRepository).toBe(false);
      expect(result.repositoryNote).toMatch(/no está disponible/);
    });

    test('should refuse a project with no users', async () => {
      state.dbManager.getGroupPhotoCoverage.mockResolvedValue([]);

      const result = await runCoverage();

      expect(result.success).toBe(false);
    });
  });
});
