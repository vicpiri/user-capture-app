/**
 * User manual tests
 *
 * Two halves. The first drives the renderer and the search over a small
 * manual written to a temporary folder. The second checks the real manual in
 * src/help: every page listed exists and every file is listed, each page opens
 * with its own title, and no link points to a page or section that does not
 * exist, so renaming a heading cannot silently break a link.
 *
 * @jest-environment node
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  HELP_DIR,
  slugify,
  parseLink,
  loadManifest,
  parsePage,
  renderPage,
  collectHeadings,
  collectLinks,
  searchPages
} = require('../../../src/main/helpContent');

describe('slugify()', () => {
  test('should drop accents, punctuation and case', () => {
    expect(slugify('¿Qué pasa si falta la carpeta?')).toBe('que-pasa-si-falta-la-carpeta');
  });

  test('should turn ñ into n', () => {
    expect(slugify('Configurar el año')).toBe('configurar-el-ano');
  });

  test('should collapse spaces and hyphens', () => {
    expect(slugify('  CSV  -  para carnets ')).toBe('csv-para-carnets');
  });

  test('should keep digits', () => {
    expect(slugify('Impresora de 80 mm')).toBe('impresora-de-80-mm');
  });
});

describe('parseLink()', () => {
  test('should recognise a page with and without a section', () => {
    expect(parseLink('exportaciones.md')).toEqual({ type: 'page', page: 'exportaciones', anchor: null });
    expect(parseLink('captura.md#redirigir-la-carpeta')).toEqual({ type: 'page', page: 'captura', anchor: 'redirigir-la-carpeta' });
  });

  test('should recognise a section of the same page', () => {
    expect(parseLink('#pasos')).toEqual({ type: 'anchor', anchor: 'pasos' });
  });

  test('should recognise web links', () => {
    expect(parseLink('https://github.com/vicpiri')).toEqual({ type: 'external', url: 'https://github.com/vicpiri' });
  });

  test('should not treat paths or other schemes as pages', () => {
    expect(parseLink('../main.js').type).toBe('unknown');
    expect(parseLink('file:///C:/x.md').type).toBe('unknown');
  });
});

describe('Rendering and search', () => {
  const helpDir = path.join(os.tmpdir(), 'edu-capture-help-tests');

  const write = (name, content) => fs.writeFileSync(path.join(helpDir, name), content, 'utf8');

  beforeAll(() => {
    fs.rmSync(helpDir, { recursive: true, force: true });
    fs.mkdirSync(helpDir, { recursive: true });

    write('pages.json', JSON.stringify([
      { id: 'inicio', title: 'Primeros pasos' },
      { id: 'exportaciones', title: 'Exportaciones' }
    ]));

    write('inicio.md', [
      '# Primeros pasos',
      '',
      'Introducción a la **aplicación**.',
      '',
      '<!-- REVISAR: nota interna -->',
      '',
      '## Crear un proyecto',
      '',
      'Ve a [Exportaciones](exportaciones.md#csv-para-carnets) o [arriba](#crear-un-proyecto).',
      'Más en [la web](https://example.com) y [esto](../secreto.md).',
      '',
      '<script>alert(1)</script>',
      '',
      '## Crear un proyecto',
      '',
      'Encabezado repetido.'
    ].join('\n'));

    write('exportaciones.md', [
      '# Exportaciones',
      '',
      '## CSV para carnets',
      '',
      'Genera el archivo `carnets.csv` con la exportación de los usuarios.',
      '',
      '## Orla en PDF',
      '',
      'Un PDF por grupo.'
    ].join('\n'));
  });

  afterAll(() => {
    fs.rmSync(helpDir, { recursive: true, force: true });
  });

  describe('renderPage()', () => {
    test('should return the title from the index and the HTML', () => {
      const page = renderPage('inicio', helpDir);

      expect(page.id).toBe('inicio');
      expect(page.title).toBe('Primeros pasos');
      expect(page.html).toContain('<strong>aplicación</strong>');
    });

    test('should give headings the ids links are written against', () => {
      const { html } = renderPage('exportaciones', helpDir);

      expect(html).toContain('<h2 id="csv-para-carnets">CSV para carnets</h2>');
    });

    test('should keep ids unique when a heading repeats', () => {
      const { headings } = renderPage('inicio', helpDir);

      expect(headings.map((heading) => heading.anchor))
        .toEqual(['primeros-pasos', 'crear-un-proyecto', 'crear-un-proyecto-2']);
    });

    test('should turn page links into data the viewer acts on', () => {
      const { html } = renderPage('inicio', helpDir);

      expect(html).toContain('href="#" data-help-page="exportaciones" data-help-anchor="csv-para-carnets"');
      expect(html).toContain('href="#" data-help-anchor="crear-un-proyecto"');
      expect(html).toContain('data-help-external="https://example.com"');
    });

    test('should leave no usable href on a link to anything else', () => {
      const { html } = renderPage('inicio', helpDir);

      expect(html).not.toContain('secreto.md');
    });

    test('should escape raw HTML instead of passing it through', () => {
      const { html } = renderPage('inicio', helpDir);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    test('should hide the notes left for whoever maintains the manual', () => {
      const { html } = renderPage('inicio', helpDir);

      expect(html).not.toContain('REVISAR');
    });

    test('should refuse a page that is not in the index', () => {
      expect(() => renderPage('../../main', helpDir)).toThrow(/desconocida/);
      expect(() => renderPage('nada', helpDir)).toThrow(/desconocida/);
    });
  });

  describe('searchPages()', () => {
    test('should find a section ignoring case and accents', () => {
      const results = searchPages('EXPORTACION', helpDir);

      expect(results[0]).toEqual(expect.objectContaining({
        page: 'exportaciones',
        pageTitle: 'Exportaciones'
      }));
    });

    test('should point at the section where the words appear', () => {
      const [first] = searchPages('carnets.csv', helpDir);

      expect(first).toEqual(expect.objectContaining({
        page: 'exportaciones',
        section: 'CSV para carnets',
        anchor: 'csv-para-carnets'
      }));
      expect(first.snippet).toContain('carnets.csv');
    });

    test('should require every word to be present', () => {
      expect(searchPages('orla carnets', helpDir)).toEqual([]);
    });

    test('should rank a match in the title above one in the text', () => {
      const results = searchPages('pdf', helpDir);

      expect(results[0].section).toBe('Orla en PDF');
    });

    test('should ignore a query too short to mean anything', () => {
      expect(searchPages('a', helpDir)).toEqual([]);
      expect(searchPages('   ', helpDir)).toEqual([]);
    });

    test('should not search the notes left for maintainers', () => {
      expect(searchPages('nota interna', helpDir)).toEqual([]);
    });
  });
});

describe('The manual shipped with the application', () => {
  const manifest = loadManifest();
  const pageIds = manifest.map((page) => page.id);
  // Parsed on demand, so a missing file fails its own tests instead of the
  // whole suite
  const cache = new Map();
  const parsed = {
    get(id) {
      if (!cache.has(id)) cache.set(id, parsePage(id));
      return cache.get(id);
    }
  };
  const anchorsOf = (id) => collectHeadings(parsed.get(id).tokens).map((heading) => heading.anchor);

  test('should list at least one page', () => {
    expect(manifest.length).toBeGreaterThan(0);
  });

  test('should not list a page twice', () => {
    expect(new Set(pageIds).size).toBe(pageIds.length);
  });

  test('should have a file for every page in the index, and index every file', () => {
    const files = fs.readdirSync(HELP_DIR)
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.slice(0, -3))
      .sort();

    expect(files).toEqual([...pageIds].sort());
  });

  test.each(manifest.map((page) => [page.id, page.title]))('%s should open with its title as the only main heading', (id, title) => {
    const headings = collectHeadings(parsed.get(id).tokens);
    const mainHeadings = headings.filter((heading) => heading.level === 1);

    expect(mainHeadings.map((heading) => heading.text)).toEqual([title]);
    expect(headings[0].level).toBe(1);
  });

  test.each(pageIds)('%s should only link to pages and sections that exist', (id) => {
    const broken = collectLinks(parsed.get(id).tokens)
      .filter(({ link }) => {
        if (link.type === 'external') return false;
        if (link.type === 'anchor') return !anchorsOf(id).includes(link.anchor);
        if (link.type === 'page') {
          if (!pageIds.includes(link.page)) return true;
          return link.anchor !== null && !anchorsOf(link.page).includes(link.anchor);
        }
        return true;
      })
      .map(({ href }) => href);

    expect(broken).toEqual([]);
  });

  test.each(pageIds)('%s should not repeat a heading', (id) => {
    const texts = collectHeadings(parsed.get(id).tokens).map((heading) => heading.text);

    expect(new Set(texts).size).toBe(texts.length);
  });

  test.each(pageIds)('%s should render without raw HTML', (id) => {
    expect(parsed.get(id).source).not.toMatch(/<[a-z][^>]*>/i);
  });
});
