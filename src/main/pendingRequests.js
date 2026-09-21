/**
 * Card print and publication requests in the repository
 *
 * Each request is a file named after the person's identifier (NIA for
 * students, document for staff): `To-Print-ID/<id>` for a card, and
 * `To-Publish/<id>.jpg`, a copy of the photo, for a publication. Those files
 * are the only record there is. The repository is shared between projects and
 * carries over from one course to the next, so the folders also hold requests
 * the open project will never act on.
 *
 * Nothing here deletes a request. Archiving moves it into the `Archivadas`
 * subfolder, which the listing skips, so it can be put back by hand.
 */
const fs = require('fs').promises;
const path = require('path');
const { parseAcademicYear, academicYearOn, academicYearStart, requestTime } = require('./academicYear');

const REQUEST_FOLDERS = {
  cards: { folder: 'To-Print-ID', extension: '' },
  publications: { folder: 'To-Publish', extension: '.jpg' }
};

const ARCHIVE_FOLDER = 'Archivadas';

/**
 * Pending requests in one of the repository's request folders
 * @param {string} folderPath - To-Print-ID or To-Publish
 * @param {string} [extension] - Stripped from the file names to get the identifier
 * @returns {Promise<Array<{id: string, file: string, requestedAt: number}>>}
 *   empty when the folder does not exist
 */
async function listRequestFolder(folderPath, extension = '') {
  try {
    await fs.access(folderPath);
  } catch {
    return [];
  }

  const entries = [];
  for (const file of await fs.readdir(folderPath)) {
    let stats;
    try {
      stats = await fs.stat(path.join(folderPath, file));
    } catch {
      // Removed between the listing and now, from this or another computer
      continue;
    }

    // Subfolders, the archive among them, are not requests
    if (!stats.isFile()) {
      continue;
    }

    const id = extension && file.toLowerCase().endsWith(extension)
      ? file.slice(0, -extension.length)
      : file;
    entries.push({ id, file, requestedAt: requestTime(stats) });
  }

  return entries;
}

/**
 * The project's course, or the running one for a project that never recorded it
 * @param {Object} dbManager
 * @returns {Promise<number>}
 */
async function projectAcademicYear(dbManager) {
  return parseAcademicYear(await dbManager.getProjectSetting('academicYear')) ??
    academicYearOn(new Date());
}

/**
 * The project's users each request belongs to, by identifier
 * @param {Object} dbManager
 * @param {Array<{id: string}>} entries
 * @returns {Promise<Map<string, Object>>}
 */
async function usersByRequestId(dbManager, entries) {
  const matched = await dbManager.getUsersByIdentifiers(entries.map(entry => entry.id));

  // A request is named after the NIA for students and the document for staff:
  // a file named like a student's document is not that student's request
  const users = new Map();
  matched.forEach(user => {
    const id = user.type === 'student' ? user.nia : user.document;
    if (id) {
      users.set(id, user);
    }
  });

  return users;
}

/**
 * The part of a request listing that concerns the open project
 *
 * Counting the requests of people outside the project made the badge promise
 * requests its filter then could not show.
 *
 * @param {Object} dbManager
 * @param {Array<{id: string, requestedAt: number}>} entries
 * @returns {Promise<{userIds: string[], previousCourseIds: string[], otherCount: number}>}
 *   previousCourseIds: the project's requests made before its course started.
 *   otherCount: requests for identifiers that are not in the project.
 */
async function projectRequests(dbManager, entries) {
  const users = await usersByRequestId(dbManager, entries);
  const courseStart = academicYearStart(await projectAcademicYear(dbManager)).getTime();

  const own = entries.filter(entry => users.has(entry.id));

  return {
    userIds: own.map(entry => entry.id),
    previousCourseIds: own.filter(entry => entry.requestedAt < courseStart).map(entry => entry.id),
    otherCount: entries.length - own.length
  };
}

/**
 * Requests worth a second look, for the review window
 *
 * @param {Object} dbManager
 * @param {string} repositoryPath
 * @returns {Promise<Object>} `academicYear`, and for `cards` and `publications`:
 *   `folder`, `total`, `others` (nobody in the project) and `previousCourse`
 *   (someone in the project, requested before the course started), oldest first
 */
async function reviewRequests(dbManager, repositoryPath) {
  const academicYear = await projectAcademicYear(dbManager);
  const courseStart = academicYearStart(academicYear).getTime();

  const review = async ({ folder, extension }) => {
    const folderPath = path.join(repositoryPath, folder);
    const entries = await listRequestFolder(folderPath, extension);
    const users = await usersByRequestId(dbManager, entries);

    const others = [];
    const previousCourse = [];

    entries.forEach(entry => {
      const user = users.get(entry.id);

      if (!user) {
        others.push(entry);
      } else if (entry.requestedAt < courseStart) {
        previousCourse.push({
          ...entry,
          name: [user.last_name1, user.last_name2].filter(Boolean).join(' ') +
            (user.first_name ? `, ${user.first_name}` : ''),
          group: user.group_name || user.group_code || ''
        });
      }
    });

    const oldestFirst = (a, b) => a.requestedAt - b.requestedAt;

    return {
      folder: folderPath,
      total: entries.length,
      others: others.sort(oldestFirst),
      previousCourse: previousCourse.sort(oldestFirst)
    };
  };

  return {
    academicYear,
    cards: await review(REQUEST_FOLDERS.cards),
    publications: await review(REQUEST_FOLDERS.publications)
  };
}

/**
 * Move requests into the folder's `Archivadas` subfolder
 *
 * An archived request with the same name is replaced: it is the same person's
 * request, and the one being archived is the newer.
 *
 * @param {string} repositoryPath
 * @param {'cards'|'publications'} kind
 * @param {string[]} files - File names as the review listed them
 * @returns {Promise<{moved: number, failed: string[]}>}
 */
async function archiveRequests(repositoryPath, kind, files) {
  const { folder } = REQUEST_FOLDERS[kind];
  const folderPath = path.join(repositoryPath, folder);
  const archivePath = path.join(folderPath, ARCHIVE_FOLDER);

  let moved = 0;
  const failed = [];

  if (!files || files.length === 0) {
    return { moved, failed };
  }

  await fs.mkdir(archivePath, { recursive: true });

  for (const file of files) {
    // Only a bare name inside the request folder: nothing from the renderer
    // may point anywhere else in the repository
    if (typeof file !== 'string' || !file || file === '.' || file === '..' ||
        path.basename(file) !== file || file === ARCHIVE_FOLDER) {
      failed.push(String(file));
      continue;
    }

    const source = path.join(folderPath, file);

    try {
      const stats = await fs.stat(source);
      if (!stats.isFile()) {
        failed.push(file);
        continue;
      }

      await fs.rename(source, path.join(archivePath, file));
      moved++;
    } catch {
      // Already gone, archived from another computer, or held open
      failed.push(file);
    }
  }

  return { moved, failed };
}

/**
 * Stamp a request with the time it was made. Requesting again rewrites the
 * same file, and a copy keeps the photo's date, so neither would say when.
 * @param {string} filePath
 * @param {Object} logger
 */
async function stampRequest(filePath, logger) {
  try {
    const now = new Date();
    await fs.utimes(filePath, now, now);
  } catch (error) {
    logger.warning(`Could not date the request ${filePath}: ${error.message}`);
  }
}

module.exports = {
  REQUEST_FOLDERS,
  ARCHIVE_FOLDER,
  listRequestFolder,
  projectRequests,
  reviewRequests,
  archiveRequests,
  stampRequest
};
