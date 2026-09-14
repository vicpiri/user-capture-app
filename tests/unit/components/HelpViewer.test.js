/**
 * Tests for HelpViewer
 *
 * The viewer decides what every click in the manual does, so these check
 * that links move between pages and sections without leaving the window, web
 * links go to the browser, search replaces the page with results and Back
 * returns to where a link was followed from.
 */

const { HelpViewer } = require('../../../src/renderer/components/HelpViewer');

describe('HelpViewer', () => {
  let api;
  let viewer;
  let elements;

  const PAGES = [
    { id: 'inicio', title: 'Primeros pasos' },
    { id: 'exportaciones', title: 'Exportaciones' }
  ];

  const RENDERED = {
    inicio: {
      id: 'inicio',
      title: 'Primeros pasos',
      html: '<h1 id="primeros-pasos">Primeros pasos</h1>' +
        '<h2 id="crear">Crear</h2>' +
        '<p><a href="#" data-help-page="exportaciones" data-help-anchor="csv">Exportar</a> ' +
        '<a href="#" data-help-anchor="crear">Arriba</a> ' +
        '<a href="#" data-help-external="https://example.com">Web</a></p>',
      headings: [
        { level: 1, text: 'Primeros pasos', anchor: 'primeros-pasos' },
        { level: 2, text: 'Crear', anchor: 'crear' }
      ]
    },
    exportaciones: {
      id: 'exportaciones',
      title: 'Exportaciones',
      html: '<h1 id="exportaciones">Exportaciones</h1><h2 id="csv">CSV</h2>',
      headings: [
        { level: 1, text: 'Exportaciones', anchor: 'exportaciones' },
        { level: 2, text: 'CSV', anchor: 'csv' }
      ]
    }
  };

  const content = () => document.getElementById('content');
  const navLinks = () => Array.from(document.querySelectorAll('#nav a')).map((link) => link.textContent);
  const click = (selector) => document.querySelector(selector).click();
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(async () => {
    jest.useRealTimers();

    document.body.innerHTML = `
      <input id="search">
      <span id="version"></span>
      <nav id="nav"></nav>
      <div id="scroller">
        <button id="back"></button>
        <section id="results" hidden></section>
        <article id="content"></article>
      </div>
    `;

    Element.prototype.scrollIntoView = jest.fn();

    api = {
      getPages: jest.fn().mockResolvedValue({ success: true, pages: PAGES }),
      getPage: jest.fn((id) => Promise.resolve(RENDERED[id]
        ? { success: true, page: RENDERED[id] }
        : { success: false, error: `Página de ayuda desconocida: ${id}` })),
      search: jest.fn().mockResolvedValue({ success: true, results: [] }),
      openExternal: jest.fn(),
      onNavigate: jest.fn(),
      getVersion: jest.fn().mockResolvedValue('1.8.0')
    };

    elements = {
      nav: document.getElementById('nav'),
      content: document.getElementById('content'),
      results: document.getElementById('results'),
      search: document.getElementById('search'),
      back: document.getElementById('back'),
      version: document.getElementById('version'),
      scroller: document.getElementById('scroller')
    };

    viewer = new HelpViewer({ api, elements });
  });

  describe('init()', () => {
    test('should open at the first page of the index', async () => {
      await viewer.init();

      expect(api.getPage).toHaveBeenCalledWith('inicio');
      expect(content().querySelector('h1').textContent).toBe('Primeros pasos');
    });

    test('should open at the page asked for', async () => {
      await viewer.init({ page: 'exportaciones', anchor: 'csv' });

      expect(content().querySelector('h1').textContent).toBe('Exportaciones');
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });

    test('should fall back to the first page when asked for an unknown one', async () => {
      await viewer.init({ page: 'nada' });

      expect(api.getPage).toHaveBeenCalledWith('inicio');
    });

    test('should show the installed version', async () => {
      await viewer.init();
      await flush();

      expect(document.getElementById('version').textContent).toBe('Versión 1.8.0');
    });

    test('should say so when the index cannot be read', async () => {
      api.getPages.mockResolvedValue({ success: false, error: 'Sin índice' });

      await viewer.init();

      expect(content().textContent).toBe('Sin índice');
    });

    test('should start with Back disabled', async () => {
      await viewer.init();

      expect(elements.back.disabled).toBe(true);
    });
  });

  describe('index', () => {
    test('should list every page and the sections of the current one', async () => {
      await viewer.init();

      expect(navLinks()).toEqual(['Primeros pasos', 'Crear', 'Exportaciones']);
    });

    test('should mark the current page', async () => {
      await viewer.init();

      expect(document.querySelector('#nav .is-current').textContent).toBe('Primeros pasos');
    });

    test('should open a page from the index', async () => {
      await viewer.init();

      click('#nav a[data-help-page="exportaciones"]');
      await flush();

      expect(content().querySelector('h1').textContent).toBe('Exportaciones');
      expect(navLinks()).toEqual(['Primeros pasos', 'Exportaciones', 'CSV']);
    });
  });

  describe('links in a page', () => {
    beforeEach(async () => {
      await viewer.init();
    });

    test('should follow a link to another page and section', async () => {
      click('#content a[data-help-page="exportaciones"]');
      await flush();

      expect(api.getPage).toHaveBeenLastCalledWith('exportaciones');
      expect(content().querySelector('h1').textContent).toBe('Exportaciones');
    });

    test('should only scroll for a section of the same page', async () => {
      api.getPage.mockClear();

      click('#content a[data-help-anchor="crear"]:not([data-help-page])');
      await flush();

      expect(api.getPage).not.toHaveBeenCalled();
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });

    test('should send web links to the browser', async () => {
      click('#content a[data-help-external]');
      await flush();

      expect(api.openExternal).toHaveBeenCalledWith('https://example.com');
      expect(content().querySelector('h1').textContent).toBe('Primeros pasos');
    });

    test('should report a link to a page that does not exist', async () => {
      await viewer.show('nada');

      expect(content().textContent).toContain('desconocida');
    });
  });

  describe('back()', () => {
    beforeEach(async () => {
      await viewer.init();
    });

    test('should return to the page the link was followed from', async () => {
      click('#content a[data-help-page="exportaciones"]');
      await flush();
      expect(elements.back.disabled).toBe(false);

      await viewer.back();

      expect(content().querySelector('h1').textContent).toBe('Primeros pasos');
      expect(elements.back.disabled).toBe(true);
    });

    test('should do nothing with no history', async () => {
      api.getPage.mockClear();

      await viewer.back();

      expect(api.getPage).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    const RESULTS = [
      { page: 'exportaciones', pageTitle: 'Exportaciones', section: 'CSV', anchor: 'csv', snippet: 'Genera carnets.csv' }
    ];

    beforeEach(async () => {
      await viewer.init();
    });

    test('should list the sections found in place of the page', async () => {
      api.search.mockResolvedValue({ success: true, results: RESULTS });
      elements.search.value = 'carnets';

      await viewer.search('carnets');

      expect(elements.results.hidden).toBe(false);
      expect(content().hidden).toBe(true);
      expect(elements.results.querySelector('.help-result-link').textContent).toBe('Exportaciones › CSV');
      expect(elements.results.querySelector('.help-result-snippet').textContent).toBe('Genera carnets.csv');
    });

    test('should open a result at its section', async () => {
      api.search.mockResolvedValue({ success: true, results: RESULTS });
      elements.search.value = 'carnets';
      await viewer.search('carnets');

      click('#results .help-result-link');
      await flush();

      expect(elements.results.hidden).toBe(true);
      expect(content().hidden).toBe(false);
      expect(content().querySelector('h1').textContent).toBe('Exportaciones');
    });

    test('should say when nothing matches', async () => {
      elements.search.value = 'zzz';

      await viewer.search('zzz');

      expect(elements.results.textContent).toContain('No hay resultados para «zzz»');
    });

    test('should go back to the page when the query is cleared', async () => {
      elements.search.value = 'carnets';
      await viewer.search('carnets');

      elements.search.value = '';
      await viewer.search('');

      expect(elements.results.hidden).toBe(true);
      expect(content().hidden).toBe(false);
    });

    test('should drop the answer to a query the user has already changed', async () => {
      api.search.mockResolvedValue({ success: true, results: RESULTS });
      elements.search.value = 'otra cosa';

      await viewer.search('carnets');

      expect(elements.results.hidden).toBe(true);
    });

    test('should close the results with Escape', async () => {
      elements.search.value = 'carnets';
      await viewer.search('carnets');

      elements.search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(elements.search.value).toBe('');
      expect(elements.results.hidden).toBe(true);
    });
  });

  describe('navigation from the main process', () => {
    test('should move to the page the application asks for', async () => {
      await viewer.init();
      const navigate = api.onNavigate.mock.calls[0][0];

      navigate({ page: 'exportaciones', anchor: 'csv' });
      await flush();

      expect(content().querySelector('h1').textContent).toBe('Exportaciones');
    });
  });
});
