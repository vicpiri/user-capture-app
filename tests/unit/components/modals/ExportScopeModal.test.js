/**
 * Tests for ExportScopeModal
 *
 * The dialog that asks who an export covers. It only renders what it is given
 * and answers with an id, so what matters is that the counts reach the screen,
 * that the marked option is the one asked for, and that cancelling answers null.
 */

const { ExportScopeModal } = require('../../../../src/renderer/components/modals/ExportScopeModal');

describe('ExportScopeModal', () => {
  let modal;

  const SCOPES = [
    { id: 'selection', label: '12 usuarios seleccionados', count: 12 },
    { id: 'displayed', label: '1ESOA - Primero A', count: 30 },
    { id: 'project', label: 'Todos los usuarios del proyecto', count: 412 }
  ];

  const radios = () => [...document.querySelectorAll('#export-scope-options input[type="radio"]')];
  const radio = (id) => radios().find((input) => input.value === id);
  const labels = () => [...document.querySelectorAll('#export-scope-options label')].map((l) => l.textContent);

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="export-scope-modal" class="modal">
        <div id="export-scope-options"></div>
        <button id="export-scope-confirm-btn">Continuar</button>
        <button id="export-scope-cancel-btn" data-modal-cancel>Cancelar</button>
      </div>
    `;

    modal = new ExportScopeModal();
    modal.init();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('shows every scope with how many users it covers', () => {
    modal.show(SCOPES);

    expect(labels()).toEqual([
      '12 usuarios seleccionados (12)',
      '1ESOA - Primero A (30)',
      'Todos los usuarios del proyecto (412)'
    ]);
  });

  test('marks the scope it is told to mark', () => {
    modal.show(SCOPES, 'displayed');

    expect(radio('displayed').checked).toBe(true);
    expect(radio('selection').checked).toBe(false);
  });

  test('falls back to the first scope when the marked one is not there', () => {
    modal.show(SCOPES, 'group');

    expect(radio('selection').checked).toBe(true);
  });

  test('answers with the chosen scope', async () => {
    const chosen = modal.show(SCOPES, 'displayed');

    radio('project').checked = true;
    radio('project').dispatchEvent(new Event('change'));
    document.getElementById('export-scope-confirm-btn').click();

    await expect(chosen).resolves.toBe('project');
  });

  test('answers with the marked scope when nothing is touched', async () => {
    const chosen = modal.show(SCOPES, 'displayed');

    document.getElementById('export-scope-confirm-btn').click();

    await expect(chosen).resolves.toBe('displayed');
  });

  test('answers null when cancelled', async () => {
    const chosen = modal.show(SCOPES, 'displayed');

    document.getElementById('export-scope-cancel-btn').click();

    await expect(chosen).resolves.toBeNull();
  });
});
