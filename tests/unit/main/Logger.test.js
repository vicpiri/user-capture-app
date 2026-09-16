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

  describe('cutting the log when it grows', () => {
    // Nothing ever cut app.log: a project in use went past 8 MB. The sizes
    // here are tiny so a handful of entries is enough to cut the file.
    const olderLog = (index) => path.join(projectPath, `app.${index}.log`);
    const line = (text) => `${text} ${'.'.repeat(120)}`;

    const everythingLogged = () => [path.join(projectPath, 'app.log'), olderLog(1), olderLog(2)]
      .filter((file) => fs.existsSync(file))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('');

    const writeSettling = async (logger, count, text = 'entry') => {
      for (let i = 0; i < count; i++) {
        logger.info(line(`${text} ${i}`));
        // The swap closes and reopens the file, which takes a turn
        await logger.pendingFlush;
      }
    };

    test('keeps 5 MB and 2 older logs unless told otherwise', () => {
      const plain = new Logger();

      expect(plain.maxSize).toBe(5 * 1024 * 1024);
      expect(plain.keptFiles).toBe(2);
    });

    test('cuts the log during the session, keeping what it said', async () => {
      logger = new Logger({ maxSize: 1500 });
      logger.initialize(projectPath);
      logger.info(line('written before the cut'));

      await writeSettling(logger, 20);
      await logger.close();

      expect(fs.existsSync(olderLog(1))).toBe(true);
      expect(everythingLogged()).toContain('written before the cut');
      expect(readLog()).toContain('entry 19');
      // The entry that crosses the limit still goes in whole
      expect(fs.statSync(path.join(projectPath, 'app.log')).size).toBeLessThan(1500 + 300);
    });

    test('keeps only the chosen number of older logs', async () => {
      logger = new Logger({ maxSize: 600, keptFiles: 2 });
      logger.initialize(projectPath);

      await writeSettling(logger, 40);
      await logger.close();

      expect(fs.existsSync(olderLog(1))).toBe(true);
      expect(fs.existsSync(olderLog(2))).toBe(true);
      expect(fs.existsSync(olderLog(3))).toBe(false);
    });

    test('cuts a log that is already full when the project opens', async () => {
      const logFile = path.join(projectPath, 'app.log');
      fs.writeFileSync(logFile, `${line('from an earlier session')}
${'x'.repeat(2000)}`);

      logger = new Logger({ maxSize: 1500 });
      logger.initialize(projectPath);
      await logger.close();

      expect(fs.readFileSync(olderLog(1), 'utf8')).toContain('from an earlier session');
      expect(readLog()).toContain('Logger initialized');
      expect(readLog()).not.toContain('from an earlier session');
    });

    test('adds to a log that still has room', async () => {
      logger = new Logger({ maxSize: 5000 });
      logger.initialize(projectPath);
      logger.info('from this session');
      await logger.close();

      expect(fs.existsSync(olderLog(1))).toBe(false);
      expect(readLog()).toContain('from this session');
    });

    test('loses no entry written while the file is being swapped', async () => {
      logger = new Logger({ maxSize: 900 });
      logger.initialize(projectPath);

      // No awaiting: these land while the previous file is still closing
      for (let i = 0; i < 30; i++) {
        logger.info(line(`entry ${i}`));
      }
      await logger.close();

      const everything = everythingLogged();
      for (let i = 0; i < 30; i++) {
        expect(everything).toContain(`entry ${i} `);
      }
    });

    test('goes on logging when the older log cannot be replaced', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(fs, 'renameSync').mockImplementation(() => {
        throw new Error('EBUSY');
      });

      logger = new Logger({ maxSize: 900 });
      logger.initialize(projectPath);
      await writeSettling(logger, 10, 'kept anyway');
      await logger.close();

      expect(readLog()).toContain('kept anyway 9');
    });
  });
});
