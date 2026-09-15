/**
 * Tests for AppDialogManager
 */

const { AppDialogManager } = require('../../../src/renderer/components/AppDialogManager');

describe('AppDialogManager', () => {
  let infoModal;
  let choiceModal;
  let answer;
  let manager;
  let closeInfo;

  beforeEach(() => {
    // The info modal stays open until the test closes it
    infoModal = {
      show: jest.fn(() => new Promise((resolve) => { closeInfo = resolve; }))
    };
    choiceModal = { show: jest.fn(async () => 1) };
    answer = jest.fn();
    manager = new AppDialogManager({ infoModal, choiceModal, answer });
  });

  test('shows a message with its detail below and answers once it is closed', async () => {
    const done = manager.handle({ id: 7, kind: 'message', title: 'Configuración guardada', message: 'Hecho.', detail: 'Ruta: C:\\x' });
    await Promise.resolve();
    await Promise.resolve();

    expect(infoModal.show).toHaveBeenCalledWith('Configuración guardada', 'Hecho.\n\nRuta: C:\\x');
    expect(answer).not.toHaveBeenCalled();

    closeInfo();
    await done;
    expect(answer).toHaveBeenCalledWith(7, undefined);
  });

  test('leaves the message alone when there is no detail', async () => {
    const done = manager.handle({ id: 1, kind: 'message', title: 'Aviso', message: 'Solo esto.' });
    await Promise.resolve();
    await Promise.resolve();
    closeInfo();
    await done;
    expect(infoModal.show).toHaveBeenCalledWith('Aviso', 'Solo esto.');
  });

  test('asks a question and answers with the choice', async () => {
    await manager.handle({
      id: 3, kind: 'question', title: 'Carpeta de entrada', message: 'm', detail: 'd',
      choices: ['Elegir otra carpeta...', 'Usar la carpeta por defecto'], cancel: 'Cancelar'
    });

    expect(choiceModal.show).toHaveBeenCalledWith({
      title: 'Carpeta de entrada',
      message: 'm\n\nd',
      choices: ['Elegir otra carpeta...', 'Usar la carpeta por defecto'],
      cancel: 'Cancelar'
    });
    expect(answer).toHaveBeenCalledWith(3, 1);
  });

  test('shows requests one after another, not on top of each other', async () => {
    const first = manager.handle({ id: 1, kind: 'message', title: 'Primero', message: 'a' });
    const second = manager.handle({ id: 2, kind: 'question', title: 'Segundo', message: 'b', choices: ['x'] });
    await Promise.resolve();
    await Promise.resolve();

    expect(choiceModal.show).not.toHaveBeenCalled();

    closeInfo();
    await first;
    await second;
    expect(choiceModal.show).toHaveBeenCalledTimes(1);
    expect(answer.mock.calls.map(([id]) => id)).toEqual([1, 2]);
  });

  test('still answers, and keeps going, when a modal fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    choiceModal.show.mockRejectedValueOnce(new Error('broken'));

    await manager.handle({ id: 5, kind: 'question', title: 'A', message: 'a', choices: ['x'] });
    await manager.handle({ id: 6, kind: 'question', title: 'B', message: 'b', choices: ['x'] });

    expect(answer).toHaveBeenCalledWith(5, undefined);
    expect(answer).toHaveBeenCalledWith(6, 1);
    console.error.mockRestore();
  });
});
