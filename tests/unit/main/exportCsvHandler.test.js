/**
 * export-csv handler tests
 *
 * This CSV is fed to the card printing software, so its shape is a contract:
 * the field order, the separator and the values that pick which template each
 * person gets. A wrong column is not an error anyone sees until the cards come
 * out wrong.
 *
 * @jest-environment node
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const DatabaseManager = require('../../../src/main/database');

const mockHandlers = new Map();
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn((channel, handler) => mockHandlers.set(channel, handler))
  }
}));

const { registerExportHandlers } = require('../../../src/main/ipc/exportHandlers');

const logger = {
  info: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  section: jest.fn()
};

const HEADER =
  'id;password;userlevel;nombre;apellido1;apellido2;apellidos;centro;foto;grupo;' +
  'direccion;telefono;departamento;DNI;edad;fechaNacimiento;nombreApellidos';

// Column positions, in the documented order
const COL = {
  id: 0, password: 1, userlevel: 2, nombre: 3, apellido1: 4, apellido2: 5,
  apellidos: 6, centro: 7, foto: 8, grupo: 9, direccion: 10, telefono: 11,
  departamento: 12, DNI: 13, edad: 14, fechaNacimiento: 15, nombreApellidos: 16
};

describe('export-csv handler', () => {
  const fixturesPath = path.join(os.tmpdir(), 'edu-capture-csv-tests');
  let testId = 0;
  let projectPath;
  let repositoryPath;
  let exportPath;
  let db;
  let state;

  const yearsAgo = (years) => {
    const now = new Date();
    return `${now.getFullYear() - years}-01-01`;
  };

  const student = (nia, overrides = {}) => ({
    type: 'student',
    first_name: 'ANA',
    last_name1: 'GARCIA',
    last_name2: 'LOPEZ',
    birth_date: yearsAgo(20),
    document: '12345678Z',
    nia: String(nia),
    group_code: '1ESOA',
    ...overrides
  });

  const teacher = (document, overrides = {}) => ({
    type: 'teacher',
    first_name: 'MARIA',
    last_name1: 'RUIZ',
    last_name2: 'SOLER',
    birth_date: '1975-03-02',
    document: String(document),
    nia: '',
    group_code: 'DOCENTES',
    ...overrides
  });

  /** Give a user a photo in the repository */
  const addRepositoryPhoto = (identifier, extension = '.jpg') => {
    fs.writeFileSync(path.join(repositoryPath, `${identifier}${extension}`), 'photo');
  };

  const runExport = (users) => mockHandlers.get('export-csv')({}, exportPath, users);

  const readRows = () => {
    const contents = fs.readFileSync(path.join(exportPath, 'carnets.csv'), 'utf8');
    const [header, ...rows] = contents.split('\n');
    return { header, rows: rows.filter(Boolean).map(row => row.split(';')) };
  };

  beforeAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    fs.mkdirSync(fixturesPath, { recursive: true });

    state = { dbManager: null, projectPath: null };

    registerExportHandlers({
      mainWindow: () => null,
      logger,
      state,
      repositoryMirror: () => null
    });
  });

  afterAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  beforeEach(async () => {
    jest.useRealTimers();
    jest.clearAllMocks();

    testId++;
    projectPath = path.join(fixturesPath, `project-${testId}`);
    repositoryPath = path.join(fixturesPath, `repository-${testId}`);
    exportPath = path.join(fixturesPath, `export-${testId}`);
    fs.mkdirSync(projectPath, { recursive: true });
    fs.mkdirSync(repositoryPath, { recursive: true });
    fs.mkdirSync(exportPath, { recursive: true });

    db = new DatabaseManager(path.join(projectPath, 'users.db'));
    await db.initialize();
    await db.setProjectSetting('imageRepositoryPath', repositoryPath);

    state.dbManager = db;
    state.projectPath = projectPath;
  });

  afterEach(async () => {
    await db.close();
  });

  describe('file', () => {
    test('should refuse to run without an open project', async () => {
      state.dbManager = null;

      const result = await runExport([]);

      expect(result.success).toBe(false);
      state.dbManager = db;
    });

    test('should always be named carnets.csv', async () => {
      addRepositoryPhoto('1001');

      const result = await runExport([student(1001)]);

      expect(result.filename).toBe('carnets.csv');
      expect(fs.existsSync(path.join(exportPath, 'carnets.csv'))).toBe(true);
    });

    test('should write the documented header, in order', async () => {
      addRepositoryPhoto('1001');
      await runExport([student(1001)]);

      expect(readRows().header).toBe(HEADER);
    });

    test('should separate fields with semicolons', async () => {
      addRepositoryPhoto('1001');
      await runExport([student(1001)]);

      expect(readRows().rows[0]).toHaveLength(17);
    });
  });

  describe('group', () => {
    const addGroups = (groups) => db.importUsers({
      groups,
      students: [],
      teachers: [],
      nonTeachingStaff: []
    });

    test('should write the full name of the group, not its code', async () => {
      await addGroups([{ code: '1ESOA', name: '1º ESO A' }]);
      addRepositoryPhoto('1001');

      await runExport([student(1001)]);

      expect(readRows().rows[0][COL.grupo]).toBe('1º ESO A');
    });

    test('should name the group of each user', async () => {
      await addGroups([
        { code: '1ESOA', name: '1º ESO A' },
        { code: 'DOCENTES', name: 'Docentes' }
      ]);
      addRepositoryPhoto('1001');
      addRepositoryPhoto('11111111H');

      await runExport([student(1001), teacher('11111111H')]);

      expect(readRows().rows.map(row => row[COL.grupo])).toEqual(['1º ESO A', 'Docentes']);
    });

    test('should keep the code when there is no group with it', async () => {
      addRepositoryPhoto('1001');

      await runExport([student(1001, { group_code: '9XYZ' })]);

      expect(readRows().rows[0][COL.grupo]).toBe('9XYZ');
    });

    test('should leave it empty for a user with no group', async () => {
      addRepositoryPhoto('1001');

      await runExport([student(1001, { group_code: null })]);

      expect(readRows().rows[0][COL.grupo]).toBe('');
    });
  });

  describe('students', () => {
    test('should identify them by NIA', async () => {
      addRepositoryPhoto('1001');
      await runExport([student(1001)]);

      const [row] = readRows().rows;
      expect(row[COL.id]).toBe('1001');
      expect(row[COL.password]).toBe('1001');
    });

    test('should mark them as Alumno', async () => {
      addRepositoryPhoto('1001');
      await runExport([student(1001)]);

      expect(readRows().rows[0][COL.userlevel]).toBe('Alumno');
    });

    test('should name their photo after the NIA', async () => {
      addRepositoryPhoto('1001');
      await runExport([student(1001)]);

      expect(readRows().rows[0][COL.foto]).toBe('1001.jpg');
    });

    test('should pick the adult template from 18 on', async () => {
      addRepositoryPhoto('1001');
      await runExport([student(1001, { birth_date: yearsAgo(18) })]);

      expect(readRows().rows[0][COL.edad]).toBe('mayor.jpg');
    });

    test('should pick the minor template below 18', async () => {
      addRepositoryPhoto('1001');
      await runExport([student(1001, { birth_date: yearsAgo(17) })]);

      expect(readRows().rows[0][COL.edad]).toBe('menor.jpg');
    });

    test('should read a birth date written the Spanish way', async () => {
      addRepositoryPhoto('1001');
      const year = new Date().getFullYear() - 20;

      await runExport([student(1001, { birth_date: `01/01/${year}` })]);

      expect(readRows().rows[0][COL.edad]).toBe('mayor.jpg');
    });

    test('should still carry the document in its own column', async () => {
      addRepositoryPhoto('1001');
      await runExport([student(1001, { document: '99999999R' })]);

      expect(readRows().rows[0][COL.DNI]).toBe('99999999R');
    });
  });

  describe('staff', () => {
    test('should identify them by document', async () => {
      addRepositoryPhoto('D100');
      await runExport([teacher('D100')]);

      const [row] = readRows().rows;
      expect(row[COL.id]).toBe('D100');
      expect(row[COL.password]).toBe('D100');
    });

    test('should mark them as Profesor', async () => {
      addRepositoryPhoto('D100');
      await runExport([teacher('D100')]);

      expect(readRows().rows[0][COL.userlevel]).toBe('Profesor');
    });

    test('should name their photo after the document', async () => {
      addRepositoryPhoto('D100');
      await runExport([teacher('D100')]);

      expect(readRows().rows[0][COL.foto]).toBe('D100.jpg');
    });

    test('should use the staff template regardless of age', async () => {
      addRepositoryPhoto('D100');
      await runExport([teacher('D100')]);

      expect(readRows().rows[0][COL.edad]).toBe('profesor.jpg');
    });

    test('should treat non-teaching staff the same as teachers', async () => {
      addRepositoryPhoto('D200');
      await runExport([teacher('D200', { type: 'non_teaching_staff' })]);

      const [row] = readRows().rows;
      expect(row[COL.userlevel]).toBe('Profesor');
      expect(row[COL.edad]).toBe('profesor.jpg');
    });
  });

  describe('names', () => {
    test('should join both surnames', async () => {
      addRepositoryPhoto('1001');
      await runExport([student(1001)]);

      expect(readRows().rows[0][COL.apellidos]).toBe('GARCIA LOPEZ');
    });

    test('should not leave a trailing space when there is one surname', async () => {
      addRepositoryPhoto('1001');
      await runExport([student(1001, { last_name2: '' })]);

      const [row] = readRows().rows;
      expect(row[COL.apellidos]).toBe('GARCIA');
      expect(row[COL.nombreApellidos]).toBe('ANA GARCIA');
    });

    test('should give the full name as first name then surnames', async () => {
      addRepositoryPhoto('1001');
      await runExport([student(1001)]);

      expect(readRows().rows[0][COL.nombreApellidos]).toBe('ANA GARCIA LOPEZ');
    });
  });

  describe('who gets exported', () => {
    test('should leave out a user with no photo in the repository', async () => {
      addRepositoryPhoto('1001');

      const result = await runExport([student(1001), student(1002)]);

      expect(result.exported).toBe(1);
      expect(readRows().rows).toHaveLength(1);
    });

    test('should report how many were left out', async () => {
      // Silently dropping people from a print run is the failure this guards
      addRepositoryPhoto('1001');

      const result = await runExport([student(1001), student(1002), student(1003)]);

      expect(result.ignored).toBe(2);
    });

    test('should report nothing left out when everyone has a photo', async () => {
      addRepositoryPhoto('1001');
      addRepositoryPhoto('1002');

      const result = await runExport([student(1001), student(1002)]);

      expect(result.ignored).toBe(0);
    });

    test('should accept a jpeg photo as well as a jpg', async () => {
      addRepositoryPhoto('1001', '.jpeg');

      const result = await runExport([student(1001)]);

      expect(result.exported).toBe(1);
    });

    test('should match the photo whatever case the file uses', async () => {
      fs.writeFileSync(path.join(repositoryPath, '1001.JPG'), 'photo');

      const result = await runExport([student(1001)]);

      expect(result.exported).toBe(1);
    });

    test('should list the identifiers it exported', async () => {
      addRepositoryPhoto('1001');
      addRepositoryPhoto('D100');

      const result = await runExport([student(1001), teacher('D100')]);

      expect(result.exportedUserIds.sort()).toEqual(['1001', 'D100']);
    });

    test('should export nobody when given none, not everyone in the database', async () => {
      await db.importUsers({
        groups: [{ code: '1ESOA', name: 'Primero ESO A' }],
        students: [
          { first_name: 'ANA', last_name1: 'GARCIA', last_name2: '', nia: '2001', group_code: '1ESOA', document: '', birth_date: '2000-01-01' }
        ],
        teachers: [],
        nonTeachingStaff: []
      });
      addRepositoryPhoto('2001');

      const result = await runExport([]);

      expect(result.success).toBe(false);
      expect(fs.existsSync(path.join(exportPath, 'carnets.csv'))).toBe(false);
    });
  });
});
