/**
 * Tests for the Escape key on dialogs
 *
 * Escape presses the button each dialog marks with data-modal-cancel, on the
 * dialog the user sees on top. The second half reads the real index.html so a
 * dialog added without that mark fails here instead of silently ignoring
 * Escape.
 */

const fs = require('fs');
const path = require('path');
const { installModalEscape, handleEscape, topmostDialog } = require('../../../src/renderer/core/modalEscape');

describe('modalEscape', () => {
  let uninstall;
  const press = (key = 'Escape') => {
    const event = new KeyboardEvent('keydown', { key, cancelable: true });
    document.dispatchEvent(event);
    return event;
  };

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="first" class="modal">
        <button id="first-ok">Aceptar</button>
        <button id="first-cancel" data-modal-cancel>Cancelar</button>
      </div>
      <div id="second" class="modal">
        <button id="second-cancel" data-modal-cancel>Cancelar</button>
      </div>
      <div id="progress" class="modal">
        <p>Procesando...</p>
      </div>
    `;
    uninstall = installModalEscape(document);
  });

  afterEach(() => {
    uninstall();
    document.body.innerHTML = '';
  });

  const spyOn = (id) => {
    const handler = jest.fn();
    document.getElementById(id).addEventListener('click', handler);
    return handler;
  };

  test('should press the cancel button of the open dialog', () => {
    document.getElementById('first').classList.add('show');
    const cancel = spyOn('first-cancel');
    const ok = spyOn('first-ok');

    const event = press();

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(ok).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  test('should only press the dialog on top when two are open', () => {
    document.getElementById('first').classList.add('show');
    document.getElementById('second').classList.add('show');
    const first = spyOn('first-cancel');
    const second = spyOn('second-cancel');

    press();

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  test('should do nothing with no dialog open', () => {
    const cancel = spyOn('first-cancel');

    const event = press();

    expect(cancel).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  test('should not close a dialog with nothing to cancel, like the progress bar', () => {
    document.getElementById('progress').classList.add('show');

    const event = press();

    expect(event.defaultPrevented).toBe(false);
  });

  test('should not press a disabled button, so a busy dialog stays open', () => {
    document.getElementById('first').classList.add('show');
    document.getElementById('first-cancel').disabled = true;
    const cancel = spyOn('first-cancel');

    press();

    expect(cancel).not.toHaveBeenCalled();
  });

  test('should skip a hidden cancel button for a visible one', () => {
    const dialog = document.getElementById('first');
    dialog.innerHTML = `
      <button id="later" data-modal-cancel hidden>Más tarde</button>
      <button id="close" data-modal-cancel>Cerrar</button>
    `;
    dialog.classList.add('show');
    const close = spyOn('close');

    press();

    expect(close).toHaveBeenCalledTimes(1);
  });

  test('should ignore other keys', () => {
    document.getElementById('first').classList.add('show');
    const cancel = spyOn('first-cancel');

    press('Enter');

    expect(cancel).not.toHaveBeenCalled();
  });

  test('should stop listening once uninstalled', () => {
    uninstall();
    document.getElementById('first').classList.add('show');
    const cancel = spyOn('first-cancel');

    press();

    expect(cancel).not.toHaveBeenCalled();
    uninstall = () => {};
  });

  test('should report the topmost dialog and whether it handled the key', () => {
    document.getElementById('first').classList.add('show');

    expect(topmostDialog(document).id).toBe('first');
    expect(handleEscape(new KeyboardEvent('keydown', { key: 'Escape' }), document)).toBe(true);
  });

  describe('the dialogs of the main window', () => {
    const html = fs.readFileSync(path.join(__dirname, '../../../src/renderer/index.html'), 'utf8');
    const page = new DOMParser().parseFromString(html, 'text/html');
    const dialogs = Array.from(page.querySelectorAll('.modal')).filter(el => el.classList.contains('modal'));

    // The progress bar reports work in progress and has nothing to cancel
    const WITHOUT_CANCEL = ['progress-modal'];

    test('should all be found', () => {
      expect(dialogs.length).toBeGreaterThan(10);
    });

    test.each(dialogs.map(dialog => [dialog.id]))('%s should mark the button Escape presses', (id) => {
      const dialog = page.getElementById(id);
      const marked = dialog.querySelectorAll('button[data-modal-cancel]');

      if (WITHOUT_CANCEL.includes(id)) {
        expect(marked).toHaveLength(0);
      } else {
        expect(marked.length).toBeGreaterThan(0);
      }
    });
  });
});
