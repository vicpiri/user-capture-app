/**
 * Tests for UpdateModal
 */

const { UpdateModal } = require('../../../../src/renderer/components/modals/UpdateModal');

describe('UpdateModal', () => {
  let modal;
  let callbacks;

  const visible = (id) => !document.getElementById(id).hidden;
  const text = (id) => document.getElementById(id).textContent;

  beforeEach(() => {
    const element = document.createElement('div');
    element.id = 'update-modal';
    element.innerHTML = `
      <h2 id="update-modal-title"></h2>
      <div id="update-modal-spinner" hidden></div>
      <p id="update-modal-message"></p>
      <div id="update-modal-notes" hidden><pre id="update-modal-notes-text"></pre></div>
      <div id="update-modal-progress" hidden>
        <div id="update-modal-progress-bar"></div>
        <div id="update-modal-progress-text"></div>
      </div>
      <button id="update-modal-skip-btn" hidden></button>
      <button id="update-modal-later-btn" hidden></button>
      <button id="update-modal-primary-btn"></button>
    `;
    document.body.appendChild(element);

    callbacks = {
      checkForUpdates: jest.fn(async () => ({ status: 'not-available', manual: true })),
      skipUpdateVersion: jest.fn(async () => {}),
      openReleasePage: jest.fn(async () => {}),
      getAppVersion: jest.fn(async () => '1.7.0-DEV'),
      downloadUpdate: jest.fn(async () => ({ status: 'downloaded', version: '1.8.0' })),
      installUpdate: jest.fn(async () => ({ success: true })),
      closeProject: jest.fn(async () => {}),
      isBusy: jest.fn(() => false)
    };
    modal = new UpdateModal(callbacks);
    modal.init();
  });

  afterEach(() => {
    modal.destroy();
    document.body.innerHTML = '';
  });

  describe('automatic checks', () => {
    test('only the "available" status opens the modal', () => {
      modal.handleStatus({ status: 'checking', manual: false });
      modal.handleStatus({ status: 'not-available', manual: false });
      modal.handleStatus({ status: 'error', manual: false, message: 'offline' });
      expect(modal.isModalOpen()).toBe(false);
    });

    test('an available version opens the modal with the three choices', async () => {
      modal.handleStatus({
        status: 'available',
        manual: false,
        version: '1.8.0',
        releaseDate: '2026-10-01T10:00:00.000Z',
        releaseNotes: '### Features\n\n* add x ([abc1234](https://github.com/x/commit/abc1234def))\n* add y'
      });
      await Promise.resolve();

      expect(modal.isModalOpen()).toBe(true);
      expect(text('update-modal-title')).toBe('Hay una versión nueva');
      expect(text('update-modal-message')).toContain('versión 1.8.0');
      expect(text('update-modal-message')).toContain('tienes la 1.7.0)');
      expect(text('update-modal-message')).not.toContain('-DEV');
      expect(visible('update-modal-notes')).toBe(true);
      expect(text('update-modal-notes-text')).toBe('Features\n\n• add x\n• add y');
      expect(text('update-modal-primary-btn')).toBe('Descargar');
      expect(visible('update-modal-later-btn')).toBe(true);
      expect(visible('update-modal-skip-btn')).toBe(true);
    });

    test('hides the notes when the release has none', async () => {
      modal.handleStatus({ status: 'available', manual: false, version: '1.8.0', releaseNotes: '' });
      await Promise.resolve();
      expect(visible('update-modal-notes')).toBe(false);
    });
  });

  describe('manual checks', () => {
    test('checkNow shows the checking view and asks the main process', async () => {
      const pending = modal.checkNow();
      expect(modal.isModalOpen()).toBe(true);
      expect(text('update-modal-title')).toBe('Buscando actualizaciones');
      expect(visible('update-modal-spinner')).toBe(true);
      await pending;
      expect(callbacks.checkForUpdates).toHaveBeenCalledTimes(1);
    });

    test('"not-available" shows a closing message', () => {
      modal.handleStatus({ status: 'not-available', manual: true });
      expect(text('update-modal-title')).toBe('Sin novedades');
      expect(visible('update-modal-spinner')).toBe(false);
      expect(text('update-modal-primary-btn')).toBe('Cerrar');
      expect(visible('update-modal-later-btn')).toBe(false);
      expect(visible('update-modal-skip-btn')).toBe(false);
    });

    test('"error" shows the message from the main process', () => {
      modal.handleStatus({ status: 'error', manual: true, message: 'HTTP 403' });
      expect(text('update-modal-title')).toBe('No se pudo comprobar');
      expect(text('update-modal-message')).toBe('HTTP 403');
    });

    test('an unsupported outcome explains that only the installed app can check', async () => {
      callbacks.checkForUpdates.mockResolvedValue({ status: 'unsupported', manual: true });
      await modal.checkNow();
      expect(text('update-modal-title')).toBe('No se pudo comprobar');
      expect(text('update-modal-message')).toContain('aplicación instalada');
    });
  });

  describe('buttons', () => {
    beforeEach(async () => {
      modal.handleStatus({ status: 'available', manual: true, version: '1.8.0' });
      await Promise.resolve();
    });

    test('primary downloads the offered version and stays open', async () => {
      callbacks.downloadUpdate.mockReturnValue(new Promise(() => {}));
      modal.handlePrimary();
      await Promise.resolve();
      expect(callbacks.downloadUpdate).toHaveBeenCalledTimes(1);
      expect(callbacks.openReleasePage).not.toHaveBeenCalled();
      expect(modal.isModalOpen()).toBe(true);
      expect(text('update-modal-title')).toBe('Descargando actualización');
    });

    test('Enter downloads, like the primary button', async () => {
      callbacks.downloadUpdate.mockReturnValue(new Promise(() => {}));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await Promise.resolve();
      expect(callbacks.downloadUpdate).toHaveBeenCalledTimes(1);
    });

    test('skip persists the version and closes', async () => {
      await modal.handleSkip();
      expect(callbacks.skipUpdateVersion).toHaveBeenCalledWith('1.8.0');
      expect(modal.isModalOpen()).toBe(false);
    });

    test('later just closes', () => {
      document.getElementById('update-modal-later-btn').click();
      expect(modal.isModalOpen()).toBe(false);
      expect(callbacks.skipUpdateVersion).not.toHaveBeenCalled();
    });

    test('primary on a non-available view does not open anything', async () => {
      modal.handleStatus({ status: 'not-available', manual: true });
      await modal.handlePrimary();
      expect(callbacks.openReleasePage).not.toHaveBeenCalled();
      expect(callbacks.downloadUpdate).not.toHaveBeenCalled();
    });

    test('an answer about the version arriving late does not paint over a newer view', async () => {
      modal.handleStatus({ status: 'available', manual: true, version: '1.8.0' });
      modal.handleStatus({ status: 'downloading', version: '1.8.0', percent: 10 });
      await Promise.resolve();
      expect(text('update-modal-title')).toBe('Descargando actualización');
    });
  });

  describe('downloading', () => {
    const progress = (overrides = {}) => ({
      status: 'downloading',
      version: '1.8.0',
      percent: 45.7,
      transferred: 36.6 * 1024 * 1024,
      total: 80.1 * 1024 * 1024,
      bytesPerSecond: 2.4 * 1024 * 1024,
      ...overrides
    });

    beforeEach(async () => {
      modal.handleStatus({ status: 'available', manual: false, version: '1.8.0' });
      await Promise.resolve();
    });

    test('shows the progress with its size and speed', () => {
      modal.handleStatus(progress());
      expect(visible('update-modal-progress')).toBe(true);
      expect(document.getElementById('update-modal-progress-bar').style.width).toBe('45.7%');
      expect(text('update-modal-progress-text')).toBe('45 % · 36,6 de 80,1 MB · 2,4 MB/s');
    });

    test('leaves out the size before the first progress arrives', () => {
      modal.handleStatus(progress({ percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 }));
      expect(text('update-modal-progress-text')).toBe('0 %');
    });

    test('Enter does not press the hidden primary button', () => {
      modal.handleStatus(progress());
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(modal.isModalOpen()).toBe(true);
      expect(text('update-modal-title')).toBe('Descargando actualización');
    });

    test('only offers to keep going in the background', () => {
      modal.handleStatus(progress());
      expect(visible('update-modal-primary-btn')).toBe(false);
      expect(visible('update-modal-skip-btn')).toBe(false);
      expect(text('update-modal-later-btn')).toBe('Seguir en segundo plano');
      expect(visible('update-modal-notes')).toBe(false);
    });

    test('progress does not reopen the window the user sent to the background', () => {
      modal.handleStatus(progress());
      document.getElementById('update-modal-later-btn').click();

      modal.handleStatus(progress({ percent: 80 }));

      expect(modal.isModalOpen()).toBe(false);
    });

    test('the end of the download reopens it', () => {
      modal.handleStatus(progress());
      document.getElementById('update-modal-later-btn').click();

      modal.handleStatus({ status: 'downloaded', version: '1.8.0' });

      expect(modal.isModalOpen()).toBe(true);
      expect(text('update-modal-title')).toBe('Actualización lista');
    });

    test('a failed download reopens it with the release page as a way out', async () => {
      modal.handleStatus(progress());
      document.getElementById('update-modal-later-btn').click();

      modal.handleStatus({ status: 'download-error', version: '1.8.0', message: 'net::ERR_CONNECTION_RESET' });

      expect(modal.isModalOpen()).toBe(true);
      expect(text('update-modal-title')).toBe('No se pudo descargar');
      expect(text('update-modal-message')).toContain('net::ERR_CONNECTION_RESET');
      expect(visible('update-modal-progress')).toBe(false);
      await modal.handlePrimary();
      expect(callbacks.openReleasePage).toHaveBeenCalledWith('1.8.0');
    });

    test('a download that could not even start is reported', async () => {
      callbacks.downloadUpdate.mockResolvedValue({ status: 'unsupported' });
      await modal.handlePrimary();
      expect(text('update-modal-title')).toBe('No se pudo descargar');
    });

    test('the outcome of the download does not repaint what the main process already reported', async () => {
      callbacks.downloadUpdate.mockImplementation(async () => {
        modal.handleStatus({ status: 'downloaded', version: '1.8.0' });
        return { status: 'downloaded', version: '1.8.0' };
      });
      await modal.handlePrimary();
      expect(text('update-modal-title')).toBe('Actualización lista');
    });
  });

  describe('ready to install', () => {
    beforeEach(() => {
      modal.handleStatus({ status: 'downloaded', version: '1.8.0' });
    });

    test('offers to restart now or install on closing', () => {
      expect(text('update-modal-primary-btn')).toBe('Reiniciar e instalar');
      expect(text('update-modal-later-btn')).toBe('Al cerrar la aplicación');
      expect(text('update-modal-message')).toContain('cuando la cierres');
    });

    test('restarting closes the project before installing', async () => {
      const order = [];
      callbacks.closeProject.mockImplementation(async () => order.push('close'));
      callbacks.installUpdate.mockImplementation(async () => { order.push('install'); return { success: true }; });

      await modal.handlePrimary();

      expect(order).toEqual(['close', 'install']);
      expect(text('update-modal-title')).toBe('Instalando actualización');
      expect(visible('update-modal-primary-btn')).toBe(false);
      expect(visible('update-modal-later-btn')).toBe(false);
    });

    test('does not restart while a task is running', async () => {
      callbacks.isBusy.mockReturnValue(true);

      await modal.handlePrimary();

      expect(callbacks.closeProject).not.toHaveBeenCalled();
      expect(callbacks.installUpdate).not.toHaveBeenCalled();
      expect(text('update-modal-message')).toContain('tarea en curso');
      expect(modal.isModalOpen()).toBe(true);
    });

    test('still installs when the project fails to close', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      callbacks.closeProject.mockRejectedValue(new Error('busy'));

      await modal.handlePrimary();

      expect(callbacks.installUpdate).toHaveBeenCalled();
    });

    test('reports an installer that could not start', async () => {
      callbacks.installUpdate.mockResolvedValue({ success: false, error: 'spawn ENOENT' });

      await modal.handlePrimary();

      expect(text('update-modal-title')).toBe('No se pudo instalar');
      expect(text('update-modal-message')).toContain('spawn ENOENT');
    });

    test('Enter does not restart: the view opens by itself, maybe mid-keystroke', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(callbacks.installUpdate).not.toHaveBeenCalled();
      expect(modal.isModalOpen()).toBe(true);
    });

    test('"Al cerrar la aplicación" just closes, the main process installs on quit', () => {
      document.getElementById('update-modal-later-btn').click();
      expect(modal.isModalOpen()).toBe(false);
      expect(callbacks.installUpdate).not.toHaveBeenCalled();
    });
  });

  /**
   * The release body is written as markdown in CHANGELOG.md, but that is not
   * what arrives: electron-updater's GitHub provider reads the releases atom
   * feed, whose <content> is the body already rendered to HTML. Cleaning only
   * the markdown showed the tags to the user.
   */
  describe('release notes', () => {
    // The available view waits on getAppVersion() before painting
    const notesFor = async (releaseNotes) => {
      modal.handleStatus({ status: 'available', manual: true, version: '1.8.0', releaseNotes });
      await Promise.resolve();
      return document.getElementById('update-modal-notes-text').textContent;
    };

    // Copied from https://github.com/vicpiri/user-capture-app/releases.atom
    const REAL_FEED_CONTENT = [
      '<h3>Bug Fixes</h3>',
      '<ul>',
      '<li>give up on an update check that never answers ' +
        '(<a href="https://github.com/vicpiri/user-capture-app/commit/d68e6879d1">d68e687</a>)</li>',
      '</ul>'
    ].join('\n');

    test('renders what GitHub really sends as readable text', async () => {
      expect(await notesFor(REAL_FEED_CONTENT))
        .toBe('Bug Fixes\n\n• give up on an update check that never answers');
    });

    test('leaves no tag behind', async () => {
      expect(await notesFor(REAL_FEED_CONTENT)).not.toMatch(/[<>]/);
    });

    test('turns every list item into its own bullet', async () => {
      const html = '<ul>\n<li>uno</li>\n<li>dos</li>\n<li>tres</li>\n</ul>';

      expect(await notesFor(html)).toBe('• uno\n• dos\n• tres');
    });

    test('keeps the text of a link and drops its address', async () => {
      const html = '<p>Instala la <a href="https://example.com/x">1.7.1</a>, que lo corrige.</p>';

      expect(await notesFor(html)).toBe('Instala la 1.7.1, que lo corrige.');
    });

    test('decodes the entities the feed escapes', async () => {
      const html = '<p>Copias &quot;antiguas&quot; &amp; nuevas &lt;sin tocar&gt;</p>';

      expect(await notesFor(html)).toBe('Copias "antiguas" & nuevas <sin tocar>');
    });

    test('still handles a body that arrives as markdown', async () => {
      const markdown = '### Features\n\n* add x ([abc1234](https://example.com/c/abc1234))\n* add y';

      expect(await notesFor(markdown)).toBe('Features\n\n• add x\n• add y');
    });

    test('does not mistake ordinary parentheses for a commit hash', async () => {
      const html = '<ul><li>arregla la exportación (la de verdad)</li></ul>';

      expect(await notesFor(html)).toBe('• arregla la exportación (la de verdad)');
    });
  });
});
