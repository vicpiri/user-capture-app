/**
 * What the packaged app may read from package.json
 *
 * electron-builder writes a trimmed package.json into the asar: it keeps
 * name, version, main, dependencies and a few descriptive fields, and drops
 * "build", "scripts" and "devDependencies". Version 1.7.0 read build.publish
 * from it at startup, threw inside app.whenReady() and never opened a window.
 * The dev run cannot catch this, because there the real package.json is used.
 *
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../../');
const STRIPPED_FIELDS = ['build', 'scripts', 'devDependencies'];

const sourceFiles = () => {
  const files = [path.join(ROOT, 'main.js')];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  };
  walk(path.join(ROOT, 'src'));
  return files;
};

describe('package.json inside the packaged app', () => {
  test('no source file reads a field electron-builder strips from package.json', () => {
    const offenders = [];
    for (const file of sourceFiles()) {
      const source = fs.readFileSync(file, 'utf8');
      for (const field of STRIPPED_FIELDS) {
        // require('../package.json').build, pkg.build, packageJson.scripts...
        const pattern = new RegExp(`package\\.json['"\\)]+\\s*\\.\\s*${field}\\b|\\bpackageJson\\.${field}\\b|\\bpkg\\.${field}\\b`);
        if (pattern.test(source)) {
          offenders.push(`${path.relative(ROOT, file)} reads "${field}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('the releases URL in main.js matches build.publish in package.json', () => {
    const main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
    const { owner, repo } = require(path.join(ROOT, 'package.json')).build.publish;
    expect(main).toContain(`https://github.com/${owner}/${repo}/releases`);
  });
});
