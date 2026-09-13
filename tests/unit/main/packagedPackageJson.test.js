/**
 * What the packaged app may read from package.json
 *
 * electron-builder writes a trimmed package.json into the asar: it keeps
 * name, version, main, dependencies and a few descriptive fields, and drops
 * "build", "scripts" and "devDependencies". Version 1.7.0 read build.publish
 * from it at startup, threw inside app.whenReady() and never opened a window.
 * The dev run cannot catch this, because there the real package.json is used.
 *
 * The check parses the sources instead of grepping them. A text search only
 * recognises the spellings it was taught (`pkg.build`, `packageJson.build`),
 * so renaming the variable was enough to slip past it. Walking the syntax tree
 * resolves whatever name the binding actually has, including the two-hop case
 * in version.js, where the path lives in one variable and the parsed contents
 * in another.
 *
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const ROOT = path.join(__dirname, '../../../');
const STRIPPED_FIELDS = new Set(['build', 'scripts', 'devDependencies']);

const sourceFiles = () => {
  const files = [path.join(ROOT, 'main.js')];
  const walkDir = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkDir(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  };
  walkDir(path.join(ROOT, 'src'));
  return files;
};

/**
 * Visit every node of an ESTree tree
 */
const walk = (node, visit) => {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (Array.isArray(value)) {
      value.forEach((child) => walk(child, visit));
    } else if (value && typeof value.type === 'string') {
      walk(value, visit);
    }
  }
};

/** Does this subtree mention the package.json file name? */
const mentionsPackageJson = (node) => {
  let found = false;
  walk(node, (child) => {
    if (child.type === 'Literal' && typeof child.value === 'string' && child.value.includes('package.json')) {
      found = true;
    }
  });
  return found;
};

/** `foo.build` or `foo['build']` -> "build" */
const propertyName = (member) => {
  if (!member.computed && member.property.type === 'Identifier') return member.property.name;
  if (member.computed && member.property.type === 'Literal') return String(member.property.value);
  return null;
};

/**
 * Fields of package.json that a source file reads
 *
 * @param {string} source
 * @returns {string[]} field names
 */
function fieldsReadFromPackageJson(source) {
  const tree = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });

  // Identifiers holding a path that points at package.json, so the parsed
  // contents can be traced back through them
  const pathNames = new Set();
  // Identifiers holding the parsed contents
  const contentNames = new Set();
  const fields = [];

  const holdsPackageJson = (init) => {
    if (!init) return false;

    // require('../package.json')
    if (init.type === 'CallExpression' && init.callee.type === 'Identifier'
      && init.callee.name === 'require' && mentionsPackageJson(init)) {
      return true;
    }

    // JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    if (init.type === 'CallExpression' && init.callee.type === 'MemberExpression'
      && init.callee.object.name === 'JSON' && propertyName(init.callee) === 'parse') {
      if (mentionsPackageJson(init)) return true;
      let usesPath = false;
      walk(init, (child) => {
        if (child.type === 'Identifier' && pathNames.has(child.name)) usesPath = true;
      });
      return usesPath;
    }

    return false;
  };

  // Declarations first, so a binding is known before its uses are visited
  walk(tree, (node) => {
    if (node.type !== 'VariableDeclarator') return;

    if (node.id.type === 'Identifier' && node.init && mentionsPackageJson(node.init)
      && !holdsPackageJson(node.init)) {
      pathNames.add(node.id.name);
    }

    if (!holdsPackageJson(node.init)) return;

    if (node.id.type === 'Identifier') {
      contentNames.add(node.id.name);
    }

    // const { build } = require('../package.json')
    if (node.id.type === 'ObjectPattern') {
      for (const property of node.id.properties) {
        if (property.type === 'Property' && property.key.type === 'Identifier') {
          fields.push(property.key.name);
        }
      }
    }
  });

  walk(tree, (node) => {
    if (node.type !== 'MemberExpression') return;

    // pkg.build, however pkg was named
    if (node.object.type === 'Identifier' && contentNames.has(node.object.name)) {
      const name = propertyName(node);
      if (name) fields.push(name);
    }

    // require('../package.json').build
    if (holdsPackageJson(node.object)) {
      const name = propertyName(node);
      if (name) fields.push(name);
    }
  });

  return fields;
}

describe('package.json inside the packaged app', () => {
  test('no source file reads a field electron-builder strips from package.json', () => {
    const offenders = [];

    for (const file of sourceFiles()) {
      const source = fs.readFileSync(file, 'utf8');
      for (const field of fieldsReadFromPackageJson(source)) {
        if (STRIPPED_FIELDS.has(field)) {
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

  // The detector is the thing most likely to rot: it has to keep finding the
  // reads it is meant to find, whatever they are called.
  describe('the detector itself', () => {
    const reads = (source) => fieldsReadFromPackageJson(source);

    test('finds a direct read on the require call', () => {
      expect(reads("require('../package.json').build.publish")).toContain('build');
    });

    test('finds a read through any variable name', () => {
      expect(reads("const meta = require('../package.json');\nconst p = meta.build;")).toContain('build');
    });

    test('finds a destructured read', () => {
      expect(reads("const { build, version } = require('../package.json');")).toContain('build');
    });

    test('finds a bracketed read', () => {
      expect(reads("const meta = require('../package.json');\nmeta['scripts'];")).toContain('scripts');
    });

    test('follows the path variable of a readFileSync', () => {
      const source = [
        "const p = path.join(ROOT, 'package.json');",
        "const contents = JSON.parse(fs.readFileSync(p, 'utf8'));",
        'contents.devDependencies;'
      ].join('\n');

      expect(reads(source)).toContain('devDependencies');
    });

    test('reports the safe fields as read, so the allowed list stays visible', () => {
      expect(reads("const meta = require('../package.json');\nmeta.version;")).toEqual(['version']);
    });

    test('does not confuse a variable that has nothing to do with package.json', () => {
      expect(reads("const pkg = { build: 1 };\npkg.build;")).toEqual([]);
    });
  });
});
