/**
 * Photo roster PDF (export-photo-roster-pdf)
 *
 * One PDF per group with everyone's photo, for staff to put a name to a face.
 * Every page must be A4: addPage() in PDFKit replaces the document options
 * instead of merging them, so a page added with only its margins came out as
 * Letter from the second page on.
 *
 * @jest-environment node
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

const mockHandlers = new Map();
jest.mock('electron', () => ({
  // No config.json there, so no logo
  app: { getPath: () => require('os').tmpdir() + '/edu-capture-photo-roster-config' },
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

const A4_MEDIA_BOX = '/MediaBox [0 0 595.28 841.89]';

describe('export-photo-roster-pdf', () => {
  const fixturesPath = path.join(os.tmpdir(), 'edu-capture-photo-roster-tests');
  let exportPath;
  let photoPath;

  const exportRoster = (usersByGroup) => mockHandlers.get('export-photo-roster-pdf')({}, {
    exportPath,
    photoSource: 'captured',
    imageQuality: 80,
    usersByGroup
  });

  const user = (i, extra = {}) => ({
    id: i,
    type: 'student',
    nia: String(1000 + i),
    first_name: `NOMBRE${i}`,
    last_name1: `APELLIDO${String(i).padStart(3, '0')}`,
    last_name2: '',
    group_code: '1ESOA',
    image_path: null,
    ...extra
  });

  const mediaBoxes = (fileName) => {
    const pdf = fs.readFileSync(path.join(exportPath, fileName), 'latin1');
    return pdf.match(/\/MediaBox \[[^\]]*\]/g) || [];
  };

  beforeAll(async () => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    exportPath = path.join(fixturesPath, 'export');
    fs.mkdirSync(exportPath, { recursive: true });

    photoPath = path.join(fixturesPath, 'photo.jpg');
    await sharp({ create: { width: 60, height: 80, channels: 3, background: '#88aacc' } })
      .jpeg()
      .toFile(photoPath);

    registerExportHandlers({
      mainWindow: () => null,
      logger,
      state: { dbManager: null, projectPath: null },
      repositoryMirror: () => null
    });
  });

  afterAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  beforeEach(() => {
    jest.useRealTimers();
  });

  test('writes one file per group, named after the roster and not the orla', async () => {
    const result = await exportRoster({
      '1ESOA': [user(1, { image_path: photoPath })],
      '2ESOB': [user(2, { group_code: '2ESOB' })]
    });

    expect(result).toEqual({
      success: true,
      generatedFiles: ['Listado_fotos_1ESOA.pdf', 'Listado_fotos_2ESOB.pdf']
    });
    expect(fs.readdirSync(exportPath).some(name => name.startsWith('Orla_'))).toBe(false);
  });

  test('keeps every page A4 when a group runs over several pages', async () => {
    // 36 photos fit on a page; 80 people take three
    const users = Array.from({ length: 80 }, (_, i) => user(i + 1));

    const result = await exportRoster({ '1ESOA': users });

    expect(result.success).toBe(true);
    const boxes = mediaBoxes('Listado_fotos_1ESOA.pdf');
    expect(boxes.length).toBeGreaterThanOrEqual(3);
    expect(boxes.every(box => box === A4_MEDIA_BOX)).toBe(true);
  });
});
