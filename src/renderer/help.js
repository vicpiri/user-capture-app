/**
 * User manual window
 *
 * Wires HelpViewer to the preload API. The page to open with comes in the
 * query string, set by the main process when it creates the window.
 */
(function() {
  'use strict';

  const api = window.electronAPI;
  const params = new URLSearchParams(window.location.search);

  const viewer = new window.HelpViewer({
    api: {
      getPages: () => api.helpGetPages(),
      getPage: (pageId) => api.helpGetPage(pageId),
      search: (query) => api.helpSearch(query),
      openExternal: (url) => api.helpOpenExternal(url),
      onNavigate: (callback) => api.onHelpNavigate(callback),
      getVersion: () => api.getAppVersion()
    },
    elements: {
      nav: document.getElementById('help-nav'),
      content: document.getElementById('help-content'),
      results: document.getElementById('help-results'),
      search: document.getElementById('help-search'),
      back: document.getElementById('help-back'),
      version: document.getElementById('help-version'),
      scroller: document.getElementById('help-scroller')
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.altKey && event.key === 'ArrowLeft') {
      event.preventDefault();
      viewer.back();
    } else if (event.ctrlKey && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      document.getElementById('help-search').focus();
    }
  });

  viewer.init({ page: params.get('page'), anchor: params.get('anchor') });
})();
