#!/usr/bin/env node
// Makes sure the GitHub Release of the current version exists and carries the
// CHANGELOG section as its notes.
//
// It runs inside `npm run release:publish`, after the push and before
// electron-builder uploads the installer. Creating the release first matters:
// electron-builder publishes the installer and the update metadata from two
// publishers in parallel, and when neither finds a release both create one,
// which leaves two releases for the same tag with the assets split between
// them (it happened on 1.7.0). With the release already there, both only
// upload. The in-app update dialog shows the release body, so the notes come
// from the changelog that commit-and-tag-version already wrote.
//
// Usage: node scripts/release-notes.mjs [version] [--dry-run]
//   version defaults to package.json; --dry-run prints the notes instead of
//   touching GitHub
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const dryRun = process.argv.includes('--dry-run');
const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
const version = process.argv.slice(2).find((a) => !a.startsWith('--')) || packageVersion;
const tag = `v${version}`;
const changelog = readFileSync('CHANGELOG.md', 'utf8').split(/\r?\n/);

// Minor and major releases get a "## [x.y.z]" heading, patches a "### [x.y.z]"
// one. The section runs until the next version heading of either level.
const isVersionHeading = (line) => /^#{2,3} \[?\d+\.\d+\.\d+/.test(line);
const escaped = version.replace(/\./g, '\\.');
const start = changelog.findIndex((line) => new RegExp(`^#{2,3} \\[?${escaped}\\]?`).test(line));
if (start === -1) {
  console.error(`[release-notes] No CHANGELOG section found for ${version}`);
  process.exit(1);
}
let end = start + 1;
while (end < changelog.length && !isVersionHeading(changelog[end])) end++;

// Drop the heading itself: GitHub already shows the tag as the title
const body = changelog.slice(start + 1, end).join('\n').trim() + '\n';
if (!body.trim()) {
  console.error(`[release-notes] The CHANGELOG section for ${version} is empty`);
  process.exit(1);
}

if (dryRun) {
  console.log(`[release-notes] Notes for ${tag}:\n`);
  console.log(body);
  process.exit(0);
}

const notesFile = join(mkdtempSync(join(tmpdir(), 'release-notes-')), `${tag}.md`);
writeFileSync(notesFile, body);

// gh is an .exe on Windows, so no shell is needed and no argument escaping issue
const gh = (args, options = {}) => spawnSync('gh', args, { encoding: 'utf8', ...options });

const existing = gh(['release', 'view', tag, '--json', 'isDraft,url']);
if (existing.status === 0) {
  const release = JSON.parse(existing.stdout);
  console.log(`[release-notes] Release ${tag} exists${release.isDraft ? ' (draft)' : ''}; updating its notes from CHANGELOG.md`);
  const edit = gh(['release', 'edit', tag, '--notes-file', notesFile], { stdio: 'inherit' });
  if (edit.status !== 0) {
    console.error(`[release-notes] gh release edit failed for ${tag}. If GitHub answers "tag_name already exists", there are two releases for the tag: list them with "gh api repos/vicpiri/user-capture-app/releases" and delete the extra one.`);
    process.exit(edit.status ?? 1);
  }
} else {
  // GitHub picks "latest" by creation date, not by version number: a release
  // created today for an old tag would become what every installed app
  // updates to. Only the version being released may be created here.
  if (version !== packageVersion) {
    console.error(`[release-notes] Release ${tag} does not exist and ${version} is not the current version (${packageVersion}); refusing to create a release for an old tag`);
    process.exit(1);
  }
  console.log(`[release-notes] Creating release ${tag} with the CHANGELOG.md notes`);
  const create = gh(['release', 'create', tag, '--verify-tag', '--title', version, '--notes-file', notesFile], { stdio: 'inherit' });
  if (create.status !== 0) {
    console.error(`[release-notes] gh release create failed for ${tag}. Is the tag pushed (git push --follow-tags)?`);
    process.exit(create.status ?? 1);
  }
}
console.log(`[release-notes] Done: https://github.com/vicpiri/user-capture-app/releases/tag/${tag}`);
