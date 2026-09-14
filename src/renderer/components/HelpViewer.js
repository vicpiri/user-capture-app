/**
 * Help Viewer
 *
 * Drives the user manual window: the index of pages with the sections of the
 * one being read, the page itself, search across the whole manual and a back
 * button for links followed from one page to another.
 *
 * Pages arrive already rendered from the main process, which only produces
 * what Markdown generates (raw HTML in the sources is escaped there), so the
 * HTML is inserted as is. Links carry data attributes instead of usable
 * hrefs: this component decides what each click does.
 *
 * @module components/HelpViewer
 */

(function(global) {
  'use strict';

  const ANCHOR_RE = /^[a-z0-9-]+$/;
  const MIN_QUERY_LENGTH = 2;
  const SEARCH_DELAY = 200;

  class HelpViewer {
    /**
     * @param {Object} config
     * @param {Object} config.api - getPages, getPage, search, openExternal, onNavigate, getVersion
     * @param {Object} config.elements - nav, content, results, search, back, version, scroller
     */
    constructor(config = {}) {
      this.api = config.api;
      this.elements = config.elements || {};

      this.pages = [];
      this.current = null;
      this.history = [];
      this.searchTimer = null;
    }

    /**
     * Load the index and show the first page, or the one asked for
     * @param {{page?: string, anchor?: string}} [target]
     * @returns {Promise<void>}
     */
    async init(target = {}) {
      const { nav, content, results, search, back } = this.elements;

      nav?.addEventListener('click', (event) => this.handleLinkClick(event));
      content?.addEventListener('click', (event) => this.handleLinkClick(event));
      results?.addEventListener('click', (event) => this.handleLinkClick(event));
      back?.addEventListener('click', () => this.back());

      search?.addEventListener('input', () => this.scheduleSearch());
      search?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          search.value = '';
          this.closeResults();
        }
      });

      if (this.api.onNavigate) {
        this.api.onNavigate((navTarget) => this.show(navTarget.page, navTarget.anchor));
      }

      this.showVersion();

      const index = await this.api.getPages();
      if (!index || !index.success) {
        this.renderError((index && index.error) || 'No se pudo leer el índice del manual');
        return;
      }
      this.pages = index.pages;

      const known = this.pages.some((page) => page.id === target.page);
      const first = this.pages[0] && this.pages[0].id;
      await this.show(known ? target.page : first, known ? target.anchor : null, { record: false });
    }

    async showVersion() {
      const { version } = this.elements;
      if (!version || !this.api.getVersion) return;
      try {
        const value = await this.api.getVersion();
        version.textContent = value ? `Versión ${value}` : '';
      } catch {
        version.textContent = '';
      }
    }

    /**
     * Show a page, optionally at one of its sections
     * @param {string} pageId
     * @param {string|null} [anchor]
     * @param {{record?: boolean}} [options] - record: whether Back can return here from it
     * @returns {Promise<boolean>} Whether the page could be shown
     */
    async show(pageId, anchor = null, { record = true } = {}) {
      this.closeResults();

      // A link within the page being read only scrolls
      if (this.current && this.current.id === pageId) {
        if (record) this.pushHistory();
        this.scrollTo(anchor);
        return true;
      }

      const result = await this.api.getPage(pageId);
      if (!result || !result.success) {
        this.renderError((result && result.error) || 'No se pudo abrir la página');
        return false;
      }

      if (record && this.current) this.pushHistory();

      this.current = result.page;
      this.elements.content.innerHTML = result.page.html;
      this.renderNav();
      this.scrollTo(anchor);
      this.updateBack();
      return true;
    }

    pushHistory() {
      this.history.push({ page: this.current.id, anchor: this.currentAnchor || null });
      this.updateBack();
    }

    /**
     * Go back to where the last link was followed from
     * @returns {Promise<void>}
     */
    async back() {
      const previous = this.history.pop();
      this.updateBack();
      if (!previous) return;

      if (this.current && this.current.id === previous.page) {
        this.scrollTo(previous.anchor);
        return;
      }
      await this.show(previous.page, previous.anchor, { record: false });
    }

    updateBack() {
      if (this.elements.back) {
        this.elements.back.disabled = this.history.length === 0;
      }
    }

    /**
     * @param {string|null} anchor
     */
    scrollTo(anchor) {
      this.currentAnchor = anchor || null;
      const target = anchor && ANCHOR_RE.test(anchor)
        ? this.elements.content.querySelector(`[id="${anchor}"]`)
        : null;

      if (target && target.scrollIntoView) {
        target.scrollIntoView({ block: 'start' });
      } else if (this.elements.scroller) {
        this.elements.scroller.scrollTop = 0;
      }
    }

    /**
     * Index of pages, with the sections of the current one under it
     */
    renderNav() {
      const { nav } = this.elements;
      if (!nav) return;

      const list = document.createElement('ul');
      list.className = 'help-nav-list';

      this.pages.forEach((page) => {
        const item = document.createElement('li');
        const isCurrent = this.current && this.current.id === page.id;
        item.appendChild(this.createLink(page.title, page.id, null, isCurrent ? 'help-nav-page is-current' : 'help-nav-page'));

        if (isCurrent) {
          const sections = (this.current.headings || []).filter((heading) => heading.level === 2);
          if (sections.length > 0) {
            const sub = document.createElement('ul');
            sub.className = 'help-nav-sections';
            sections.forEach((heading) => {
              const subItem = document.createElement('li');
              subItem.appendChild(this.createLink(heading.text, page.id, heading.anchor, 'help-nav-section'));
              sub.appendChild(subItem);
            });
            item.appendChild(sub);
          }
        }

        list.appendChild(item);
      });

      nav.replaceChildren(list);
    }

    /**
     * @param {string} text
     * @param {string} pageId
     * @param {string|null} anchor
     * @param {string} className
     * @returns {HTMLAnchorElement}
     */
    createLink(text, pageId, anchor, className) {
      const link = document.createElement('a');
      link.href = '#';
      link.className = className;
      link.textContent = text;
      link.dataset.helpPage = pageId;
      if (anchor) link.dataset.helpAnchor = anchor;
      return link;
    }

    /**
     * Follow a link in the index, the page or the search results
     * @param {MouseEvent} event
     */
    handleLinkClick(event) {
      const link = event.target.closest ? event.target.closest('a') : null;
      if (!link) return;

      event.preventDefault();
      const { helpPage, helpAnchor, helpExternal } = link.dataset;

      if (helpExternal) {
        this.api.openExternal(helpExternal);
      } else if (helpPage) {
        this.show(helpPage, helpAnchor || null);
      } else if (helpAnchor && this.current) {
        this.show(this.current.id, helpAnchor);
      }
    }

    scheduleSearch() {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.search(this.elements.search.value), SEARCH_DELAY);
    }

    /**
     * Search the whole manual and list the sections found
     * @param {string} query
     * @returns {Promise<void>}
     */
    async search(query) {
      const text = String(query || '').trim();
      if (text.length < MIN_QUERY_LENGTH) {
        this.closeResults();
        return;
      }

      const response = await this.api.search(text);
      // A newer query may have been typed while this one was running
      if (this.elements.search && this.elements.search.value.trim() !== text) return;

      this.renderResults(response && response.success ? response.results : [], text);
    }

    /**
     * @param {Array} results
     * @param {string} query
     */
    renderResults(results, query) {
      const { results: container, content } = this.elements;
      if (!container) return;

      const heading = document.createElement('p');
      heading.className = 'help-results-count';
      heading.textContent = results.length === 0
        ? `No hay resultados para «${query}»`
        : `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'} para «${query}»`;

      const list = document.createElement('ul');
      list.className = 'help-results-list';
      results.forEach((result) => {
        const item = document.createElement('li');
        const title = result.section && result.section !== result.pageTitle
          ? `${result.pageTitle} › ${result.section}`
          : result.pageTitle;
        const link = this.createLink(title, result.page, result.anchor, 'help-result-link');
        item.appendChild(link);

        if (result.snippet) {
          const snippet = document.createElement('p');
          snippet.className = 'help-result-snippet';
          snippet.textContent = result.snippet;
          item.appendChild(snippet);
        }
        list.appendChild(item);
      });

      container.replaceChildren(heading, list);
      container.hidden = false;
      if (content) content.hidden = true;
    }

    closeResults() {
      const { results, content } = this.elements;
      if (results) {
        results.hidden = true;
        results.replaceChildren();
      }
      if (content) content.hidden = false;
    }

    /**
     * @param {string} message
     */
    renderError(message) {
      const paragraph = document.createElement('p');
      paragraph.className = 'help-error';
      paragraph.textContent = message;
      this.elements.content.replaceChildren(paragraph);
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HelpViewer };
  } else if (typeof window !== 'undefined') {
    global.HelpViewer = HelpViewer;
  }
})(typeof window !== 'undefined' ? window : global);
