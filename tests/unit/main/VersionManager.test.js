/**
 * VersionManager tests
 *
 * Resolving the version can shell out to git, which is slow enough on Windows
 * to be felt at startup, so the caching and the release-build shortcut are what
 * these cover.
 *
 * @jest-environment node
 */

const path = require('path');

const VERSION_MODULE = '../../../src/main/utils/version';

describe('VersionManager', () => {
  let VersionManager;
  let execSync;
  let existsSync;

  beforeEach(() => {
    jest.resetModules();

    execSync = jest.fn(() => '0');
    existsSync = jest.fn(() => true);

    jest.doMock('child_process', () => ({ execSync }));
    jest.doMock('fs', () => ({
      existsSync,
      readFileSync: jest.fn(() => JSON.stringify({ version: '9.9.9' }))
    }));

    VersionManager = require(VERSION_MODULE);
  });

  afterEach(() => {
    jest.dontMock('child_process');
    jest.dontMock('fs');
  });

  test('should return the package version when there are no commits after the tag', () => {
    execSync.mockReturnValue('0');

    expect(VersionManager.getVersion()).toBe('9.9.9');
  });

  test('should mark the version as DEV when commits follow the last tag', () => {
    execSync.mockImplementation((command) =>
      command.includes('rev-list') ? '3' : 'v9.9.9'
    );

    expect(VersionManager.getVersion()).toBe('9.9.9-DEV');
  });

  test('should resolve the version only once', () => {
    VersionManager.getVersion();
    const callsAfterFirst = execSync.mock.calls.length;

    VersionManager.getVersion();
    VersionManager.getVersion();

    expect(execSync.mock.calls.length).toBe(callsAfterFirst);
  });

  test('should not spawn git when there is no repository', () => {
    // A packaged build ships no .git, so it must not pay for a process spawn
    existsSync.mockReturnValue(false);

    expect(VersionManager.getVersion()).toBe('9.9.9');
    expect(execSync).not.toHaveBeenCalled();
  });

  test('should look for the repository at the project root', () => {
    VersionManager.isDevVersion();

    const checkedPath = existsSync.mock.calls[0][0];
    expect(path.basename(checkedPath)).toBe('.git');
  });

  test('should fall back to a non-dev version when git fails', () => {
    execSync.mockImplementation(() => {
      throw new Error('git not available');
    });

    expect(VersionManager.getVersion()).toBe('9.9.9');
  });
});
