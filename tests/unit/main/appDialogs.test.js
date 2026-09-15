/**
 * App dialogs tests
 *
 * The main process asks the main window to show its notices and questions.
 * What must hold: the request reaches the window, the answer comes back to
 * the one who asked, and nothing waits forever when the window cannot
 * answer (no window, closed, or reloading).
 *
 * @jest-environment node
 */

const { EventEmitter } = require('events');

const mockListeners = new Map();
jest.mock('electron', () => ({
  ipcMain: {
    on: jest.fn((channel, listener) => mockListeners.set(channel, listener))
  }
}));

const {
  registerAppDialogHandlers,
  showAppMessage,
  askAppQuestion,
  CANCELLED
} = require('../../../src/main/appDialogs');

describe('app dialogs', () => {
  let window;

  const createWindow = () => {
    const webContents = new EventEmitter();
    webContents.send = jest.fn();
    return { isDestroyed: () => false, webContents };
  };

  const lastRequest = () => {
    const calls = window.webContents.send.mock.calls;
    const [channel, request] = calls[calls.length - 1];
    expect(channel).toBe('app-dialog');
    return request;
  };

  const respond = (id, response) => mockListeners.get('app-dialog-response')({}, { id, response });

  beforeAll(() => {
    registerAppDialogHandlers();
  });

  beforeEach(() => {
    jest.useRealTimers();
    window = createWindow();
  });

  test('listens for answers once, however often it is registered', () => {
    // Registered in beforeAll; the shared setup clears call counts per test
    expect(mockListeners.get('app-dialog-response')).toEqual(expect.any(Function));
    registerAppDialogHandlers();
    expect(require('electron').ipcMain.on).not.toHaveBeenCalled();
  });

  test('sends a message to the window and settles when it is closed', async () => {
    let settled = false;
    const shown = showAppMessage(window, { title: 'Configuración guardada', message: 'Hecho.', detail: 'Ruta: C:\\x' })
      .then(() => { settled = true; });

    const request = lastRequest();
    expect(request).toEqual({
      id: expect.any(Number),
      kind: 'message',
      title: 'Configuración guardada',
      message: 'Hecho.',
      detail: 'Ruta: C:\\x'
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    respond(request.id);
    await shown;
    expect(settled).toBe(true);
  });

  test('returns the choice of a question', async () => {
    const asked = askAppQuestion(window, {
      title: 'Carpeta de entrada',
      message: '¿Qué hacemos?',
      choices: ['Elegir otra carpeta...', 'Usar la carpeta por defecto']
    });

    const request = lastRequest();
    expect(request).toMatchObject({
      kind: 'question',
      choices: ['Elegir otra carpeta...', 'Usar la carpeta por defecto'],
      cancel: 'Cancelar'
    });

    respond(request.id, 1);
    await expect(asked).resolves.toBe(1);
  });

  test('gives each answer to the question it belongs to', async () => {
    const first = askAppQuestion(window, { title: 'A', message: 'a', choices: ['x', 'y'] });
    const firstId = lastRequest().id;
    const second = askAppQuestion(window, { title: 'B', message: 'b', choices: ['x', 'y'] });
    const secondId = lastRequest().id;

    respond(secondId, 0);
    respond(firstId, 1);

    await expect(first).resolves.toBe(1);
    await expect(second).resolves.toBe(0);
  });

  test('ignores answers to nothing and second answers', async () => {
    const asked = askAppQuestion(window, { title: 'A', message: 'a', choices: ['x'] });
    const { id } = lastRequest();

    respond(9999, 0);
    respond(id, 0);
    respond(id, 1);

    await expect(asked).resolves.toBe(0);
  });

  test('a question without an answer counts as cancelled', async () => {
    const asked = askAppQuestion(window, { title: 'A', message: 'a', choices: ['x'] });
    respond(lastRequest().id, undefined);
    await expect(asked).resolves.toBe(CANCELLED);
  });

  test('cancels at once without a window to ask', async () => {
    await expect(askAppQuestion(null, { title: 'A', message: 'a', choices: ['x'] })).resolves.toBe(CANCELLED);
    await expect(showAppMessage(null, { title: 'A', message: 'a' })).resolves.toBeUndefined();
  });

  test('cancels at once when the window is already closed', async () => {
    window.isDestroyed = () => true;
    await expect(askAppQuestion(window, { title: 'A', message: 'a', choices: ['x'] })).resolves.toBe(CANCELLED);
    expect(window.webContents.send).not.toHaveBeenCalled();
  });

  test('cancels a pending question when the window closes', async () => {
    const asked = askAppQuestion(window, { title: 'A', message: 'a', choices: ['x'] });
    window.webContents.emit('destroyed');
    await expect(asked).resolves.toBe(CANCELLED);
  });

  test('cancels a pending question when the page reloads, which wipes the dialog', async () => {
    const asked = askAppQuestion(window, { title: 'A', message: 'a', choices: ['x'] });
    window.webContents.emit('did-start-loading');
    await expect(asked).resolves.toBe(CANCELLED);
  });

  test('stops watching the window once answered', async () => {
    const asked = askAppQuestion(window, { title: 'A', message: 'a', choices: ['x'] });
    respond(lastRequest().id, 0);
    await asked;

    expect(window.webContents.listenerCount('destroyed')).toBe(0);
    expect(window.webContents.listenerCount('did-start-loading')).toBe(0);
  });
});
