/**
 * Logger tests
 *
 * Log writes happen inside per-image and per-user loops, so they are buffered
 * through a stream rather than written one syscall at a time. That makes
 * flushing and file ownership the things worth covering.
 *
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');
const { Logger } = require('../../../src/main/logger');

describe('Logger', () => {
  const fixturesPath = path.join(__dirname, 'logger-fixtures');
  let testId = 0;
  let projectPath;
  let logger;

  const readLog = (folder = projectPath) =>
    fs.readFileSync(path.join(folder, 'app.log'), 'utf8');

  beforeAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true });
    fs.mkdirSync(fixturesPath, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(fixturesPath, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.useRealTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});

    testId++;
    projectPath = path.join(fixturesPath, `project-${testId}`);
    fs.mkdirSync(projectPath, { recursive: true });

    logger = new Logger();
  });

  afterEach(async () => {
    await logger.closeStream();
    jest.restoreAllMocks();
  });

  test('should create the log file on initialize', async () => {
    logger.initialize(projectPath);
    await logger.closeStream();

    expect(fs.existsSync(path.join(projectPath, 'app.log'))).toBe(true);
    expect(readLog()).toContain('Logger initialized');
  });

  test('should write entries with level and message', async () => {
    logger.initialize(projectPath);
    logger.info('plain message');
    logger.error('failed thing', new Error('boom'));
    await logger.closeStream();

    const contents = readLog();
    expect(contents).toContain('[INFO] plain message');
    expect(contents).toContain('[ERROR] failed thing');
    expect(contents).toContain('boom');
  });

  test('should flush buffered entries on close', async () => {
    logger.initialize(projectPath);
    for (let i = 0; i < 500; i++) {
      logger.info(`entry ${i}`);
    }

    await logger.close();

    const contents = readLog();
    expect(contents).toContain('entry 0');
    expect(contents).toContain('entry 499');
  });

  test('should append instead of truncating an existing log', async () => {
    logger.initialize(projectPath);
    logger.info('from the first session');
    await logger.close();

    const second = new Logger();
    second.initialize(projectPath);
    second.info('from the second session');
    await second.close();

    const contents = readLog();
    expect(contents).toContain('from the first session');
    expect(contents).toContain('from the second session');
  });

  test('should switch to the new project log on re-initialize', async () => {
    const otherPath = path.join(fixturesPath, `project-${testId}-other`);
    fs.mkdirSync(otherPath, { recursive: true });

    logger.initialize(projectPath);
    logger.info('belongs to the first project');

    logger.initialize(otherPath);
    logger.info('belongs to the second project');
    await logger.close();

    expect(readLog(otherPath)).toContain('belongs to the second project');
    expect(readLog(otherPath)).not.toContain('belongs to the first project');
  });

  test('should flush the previous log when switching projects', async () => {
    const otherPath = path.join(fixturesPath, `project-${testId}-switched`);
    fs.mkdirSync(otherPath, { recursive: true });

    logger.initialize(projectPath);
    logger.info('written before the switch');

    logger.initialize(otherPath);
    // Closing the previous stream flushes asynchronously
    await logger.pendingFlush;

    expect(readLog()).toContain('written before the switch');

    await logger.close();
  });

  test('should ignore writes once closed', async () => {
    logger.initialize(projectPath);
    await logger.close();

    expect(() => logger.info('after close')).not.toThrow();
    expect(readLog()).not.toContain('after close');
  });

  test('should do nothing without a project path', async () => {
    expect(() => logger.initialize(null)).not.toThrow();
    expect(() => logger.info('no project open')).not.toThrow();
    await expect(logger.close()).resolves.toBeUndefined();
  });
});
