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
      <button id="update-modal-skip-btn" hidden></button>
      <button id="update-modal-later-btn" hidden></button>
      <button id="update-modal-primary-btn"></button>
    `;
    document.body.appendChild(element);

    callbacks = {
      checkForUpdates: jest.fn(async () => ({ status: 'not-available', manual: true })),
      skipUpdateVersion: jest.fn(async () => {}),
      openReleasePage: jest.fn(async () => {}),
      getAppVersion: jest.fn(async () => '1.7.0-DEV')
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
      expect(text('update-modal-primary-btn')).toBe('Abrir página de descarga');
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

    test('primary opens the release page of the offered version and closes', async () => {
      await modal.handlePrimary();
      expect(callbacks.openReleasePage).toHaveBeenCalledWith('1.8.0');
      expect(modal.isModalOpen()).toBe(false);
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
    });
  });
});
