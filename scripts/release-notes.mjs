#!/usr/bin/env node
// Copies the CHANGELOG section of the current version to its GitHub Release.
//
// electron-builder creates the release without a description. The in-app
// update dialog shows the release body, so this fills it from the changelog
// that commit-and-tag-version already wrote. Run after `npm run release:publish`.
//
// Usage: node scripts/release-notes.mjs [version] [--dry-run]
//   version defaults to package.json; --dry-run prints the notes instead of
//   editing the release
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const dryRun = process.argv.includes('--dry-run');
const version = process.argv.slice(2).find((a) => !a.startsWith('--')) || JSON.parse(readFileSync('package.json', 'utf8')).version;
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
  console.log(`[release-notes] Notes for ${tag}:
`);
  console.log(body);
  process.exit(0);
}

const notesFile = join(mkdtempSync(join(tmpdir(), 'release-notes-')), `${tag}.md`);
writeFileSync(notesFile, body);

console.log(`[release-notes] Updating notes of ${tag} from CHANGELOG.md`);
const result = spawnSync('gh', ['release', 'edit', tag, '--notes-file', notesFile], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});
if (result.status !== 0) {
  console.error(`[release-notes] gh release edit failed for ${tag}. Does the release exist?`);
  process.exit(result.status ?? 1);
}
console.log(`[release-notes] Done: https://github.com/vicpiri/user-capture-app/releases/tag/${tag}`);
