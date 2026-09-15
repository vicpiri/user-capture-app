/**
 * Tests for ChoiceModal
 */

const { ChoiceModal } = require('../../../../src/renderer/components/modals/ChoiceModal');
const { installModalEscape } = require('../../../../src/renderer/core/modalEscape');

describe('ChoiceModal', () => {
  let modal;
  let uninstallEscape;

  const buttons = () => [...document.querySelectorAll('#choice-modal-buttons button')];
  const button = (label) => buttons().find((b) => b.textContent === label);
  const press = (key) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

  const ask = () => modal.show({
    title: 'Carpeta de entrada',
    message: 'Carpeta actual:\nC:\\fotos',
    choices: ['Elegir otra carpeta...', 'Usar la carpeta por defecto']
  });

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="choice-modal" class="modal">
        <h2 id="choice-modal-title"></h2>
        <p id="choice-modal-message"></p>
        <div id="choice-modal-buttons">
          <button id="choice-modal-cancel-btn" data-choice="-1" data-modal-cancel>Cancelar</button>
        </div>
      </div>
    `;
    modal = new ChoiceModal();
    modal.init();
    uninstallEscape = installModalEscape(document);
  });

  afterEach(() => {
    uninstallEscape();
    modal.destroy();
    document.body.innerHTML = '';
  });

  test('shows the question with one button per choice and the cancel button', () => {
    ask();

    expect(modal.isModalOpen()).toBe(true);
    expect(document.getElementById('choice-modal-title').textContent).toBe('Carpeta de entrada');
    expect(document.getElementById('choice-modal-message').textContent).toBe('Carpeta actual:\nC:\\fotos');
    // Cancel first, the default choice last and highlighted
    expect(buttons().map((b) => b.textContent)).toEqual([
      'Cancelar', 'Usar la carpeta por defecto', 'Elegir otra carpeta...'
    ]);
    expect(button('Elegir otra carpeta...').classList.contains('btn-primary')).toBe(true);
    expect(button('Usar la carpeta por defecto').classList.contains('btn-primary')).toBe(false);
  });

  test('answers with the index of the choice pressed', async () => {
    const answer = ask();
    button('Usar la carpeta por defecto').click();

    await expect(answer).resolves.toBe(1);
    expect(modal.isModalOpen()).toBe(false);
  });

  test('Cancelar answers CANCELLED', async () => {
    const answer = ask();
    button('Cancelar').click();
    await expect(answer).resolves.toBe(ChoiceModal.CANCELLED);
  });

  test('Escape cancels', async () => {
    const answer = ask();
    document.getElementById('choice-modal').classList.add('show');
    press('Escape');
    await expect(answer).resolves.toBe(ChoiceModal.CANCELLED);
  });

  test('Enter picks the first choice', async () => {
    const answer = ask();
    press('Enter');
    await expect(answer).resolves.toBe(0);
  });

  test('closing without answering cancels', async () => {
    const answer = ask();
    modal.close();
    await expect(answer).resolves.toBe(ChoiceModal.CANCELLED);
  });

  test('a new question replaces the buttons of the previous one and cancels it', async () => {
    const first = ask();
    const second = modal.show({ title: 'Otra', message: 'otra', choices: ['Sí, seguir'], cancel: 'No' });

    await expect(first).resolves.toBe(ChoiceModal.CANCELLED);
    expect(buttons().map((b) => b.textContent)).toEqual(['No', 'Sí, seguir']);
    button('Sí, seguir').click();
    await expect(second).resolves.toBe(0);
  });
});
