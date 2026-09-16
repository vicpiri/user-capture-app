/**
 * The repository's folder of replaced photos: reading it and purging it
 *
 * Every export to the repository that overwrites a photo moves the previous one
 * to `Reemplazadas/<YYYYMMDDHHMMSS>_<host>/{id}.jpg` (see exportHandlers). That
 * folder only grows, and since the repository is shared between the computers
 * of the centre nothing is ever deleted on its own: the app tells what is in
 * there and purges what a person asks it to purge.
 */

const fs = require('fs');
const path = require('path');

const REPLACED_FOLDER = 'Reemplazadas';

// One folder per export run, named the way captures are: the stamp is local
// time, and the rest is the computer that ran the export (plus a `-2` suffix
// if two runs ever landed on the same second)
const RUN_NAME = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})_(.+)$/;

/**
 * @param {string} name - Folder name
 * @returns {{ name: string, date: Date, host: string }|null} null when the
 *   folder was not made by an export: it is left alone, never purged
 */
function parseRunName(name) {
  const match = RUN_NAME.exec(name);

  if (!match) {
    return null;
  }

  const [, year, month, day, hours, minutes, seconds, host] = match;
  const parts = [year, month, day, hours, minutes, seconds].map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);

  // Rejects the impossible (month 13, day 32...), which JavaScript would
  // happily roll over into the next month
  const rolled = [
    date.getFullYear(), date.getMonth() + 1, date.getDate(),
    date.getHours(), date.getMinutes(), date.getSeconds()
  ];
  if (rolled.some((value, index) => value !== parts[index])) {
    return null;
  }

  return { name, date, host };
}

/**
 * @param {string} repositoryPath
 * @returns {string} the folder holding the runs
 */
function replacedFolderPath(repositoryPath) {
  return path.join(repositoryPath, REPLACED_FOLDER);
}

/**
 * What the folder of replaced photos holds, run by run
 *
 * Sizes cost a stat per photo, which over a repository on Google Drive is the
 * slow part: the check that runs when a project opens asks for counts only.
 *
 * @param {string} repositoryPath
 * @param {Object} [options]
 * @param {boolean} [options.withSizes] - Add up the bytes of every photo
 * @returns {Promise<Object>} { folder, runs, photos, bytes, strangers }
 */
async function scanReplacedArchive(repositoryPath, options = {}) {
  const folder = repositoryPath ? replacedFolderPath(repositoryPath) : null;
  const empty = { folder, runs: [], photos: 0, bytes: 0, strangers: 0 };

  if (!folder) {
    return empty;
  }

  let entries;
  try {
    entries = await fs.promises.readdir(folder, { withFileTypes: true });
  } catch (error) {
    // Nothing has been replaced yet, or the repository is not reachable
    return empty;
  }

  const runs = [];
  let strangers = 0;

  for (const entry of entries) {
    const run = entry.isDirectory() ? parseRunName(entry.name) : null;

    if (!run) {
      strangers++;
      continue;
    }

    const contents = await readRun(path.join(folder, entry.name), options.withSizes);
    runs.push({ ...run, photos: contents.photos, bytes: contents.bytes });
  }

  runs.sort((a, b) => a.date - b.date);

  return {
    folder,
    runs,
    photos: runs.reduce((total, run) => total + run.photos, 0),
    bytes: runs.reduce((total, run) => total + run.bytes, 0),
    strangers
  };
}

/**
 * @private
 */
async function readRun(runPath, withSizes) {
  let files;
  try {
    files = await fs.promises.readdir(runPath, { withFileTypes: true });
  } catch (error) {
    return { photos: 0, bytes: 0 };
  }

  const photos = files.filter((file) => file.isFile());

  if (!withSizes) {
    return { photos: photos.length, bytes: 0 };
  }

  let bytes = 0;
  for (const photo of photos) {
    try {
      bytes += (await fs.promises.stat(path.join(runPath, photo.name))).size;
    } catch (error) {
      // Gone between the listing and the stat: it adds nothing
    }
  }

  return { photos: photos.length, bytes };
}

/**
 * Delete the runs older than a date, and nothing else
 *
 * @param {string} repositoryPath
 * @param {Object} options
 * @param {Date|number|string} [options.before] - Runs from this moment on are
 *   kept; without it, every run goes
 * @param {Object} [options.logger]
 * @returns {Promise<Object>} { runs, photos, bytes, failed }
 */
async function purgeReplacedRuns(repositoryPath, options = {}) {
  const { logger } = options;
  const limit = options.before === undefined || options.before === null
    ? null
    : new Date(options.before);
  const scan = await scanReplacedArchive(repositoryPath, { withSizes: true });
  const doomed = scan.runs.filter((run) => limit === null || run.date < limit);

  const removed = { runs: 0, photos: 0, bytes: 0, failed: [] };

  for (const run of doomed) {
    const runPath = path.join(scan.folder, run.name);

    try {
      await fs.promises.rm(runPath, { recursive: true });
      removed.runs++;
      removed.photos += run.photos;
      removed.bytes += run.bytes;
    } catch (error) {
      removed.failed.push({ name: run.name, error: error.message });
      if (logger) {
        logger.warning(`Could not purge ${runPath}: ${error.message}`);
      }
    }
  }

  if (logger) {
    logger.info(`Purged ${removed.runs} replaced-photo runs (${removed.photos} photos)`);
  }

  return removed;
}

// When the app offers to purge. Nobody remembers a folder they never open, so
// it says something when there is enough in there to be worth the trouble and
// old enough that losing it costs nothing. At most once a month.
const NOTICE_PHOTOS = 500;
const NOTICE_MONTHS = 6;
const NOTICE_DAYS = 30;

/**
 * Whether to offer a purge when a project opens
 *
 * @param {Object} options
 * @param {Array} options.runs - Runs as scanReplacedArchive() returns them
 * @param {number} options.photos - Photos in the whole folder
 * @param {string|null} [options.lastNotice] - ISO date of the last offer
 * @param {Date} [options.now]
 * @returns {boolean}
 */
function shouldNoticeArchive({ runs, photos, lastNotice = null, now = new Date() }) {
  if (photos < NOTICE_PHOTOS) {
    return false;
  }

  const old = new Date(now.getTime());
  old.setMonth(old.getMonth() - NOTICE_MONTHS);

  // Offering a purge that would delete nothing is worse than saying nothing
  if (!(runs || []).some((run) => run.date < old)) {
    return false;
  }

  if (!lastNotice) {
    return true;
  }

  const asked = new Date(lastNotice);
  const again = new Date(asked.getTime());
  again.setDate(again.getDate() + NOTICE_DAYS);

  return Number.isNaN(asked.getTime()) || again <= now;
}

module.exports = {
  REPLACED_FOLDER,
  NOTICE_PHOTOS,
  NOTICE_MONTHS,
  shouldNoticeArchive,
  parseRunName,
  replacedFolderPath,
  scanReplacedArchive,
  purgeReplacedRuns
};
