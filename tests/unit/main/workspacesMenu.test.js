/**
 * Ver > Espacios de trabajo submenu tests
 *
 * @jest-environment node
 */

jest.mock('electron', () => ({ Menu: {}, dialog: {} }));
jest.mock('../../../src/main/appDialogs', () => ({ showAppMessage: jest.fn() }));

const MenuBuilder = require('../../../src/main/menu/menuBuilder');

describe('Espacios de trabajo submenu', () => {
  const workspace = (id, name) => ({ id, name, builtIn: false, hidden: false, view: {} });

  const build = (workspaces, activeWorkspaceId = null) => {
    const callbacks = { applyWorkspace: jest.fn(), openWorkspaces: jest.fn() };
    const builder = new MenuBuilder({ workspaces, activeWorkspaceId, callbacks, logger: { info: jest.fn() } });
    return { menu: builder.buildWorkspacesMenu(), callbacks };
  };

  const entries = (menu) => menu.submenu.filter((item) => item.type === 'checkbox');

  test('lists one entry per workspace and marks the one in use', () => {
    const { menu } = build([workspace('captura', 'Captura'), workspace('revision', 'Revisión')], 'revision');

    expect(menu.label).toBe('Espacios de trabajo');
    expect(entries(menu).map((item) => [item.label, item.checked])).toEqual([
      ['Captura', false],
      ['Revisión', true]
    ]);
  });

  test('gives Ctrl+1…9 to the first nine only', () => {
    const many = Array.from({ length: 11 }, (_, i) => workspace(`w${i}`, `Espacio ${i + 1}`));
    const { menu } = build(many);

    const accelerators = entries(menu).map((item) => item.accelerator);
    expect(accelerators.slice(0, 9)).toEqual(['CmdOrCtrl+1', 'CmdOrCtrl+2', 'CmdOrCtrl+3', 'CmdOrCtrl+4',
      'CmdOrCtrl+5', 'CmdOrCtrl+6', 'CmdOrCtrl+7', 'CmdOrCtrl+8', 'CmdOrCtrl+9']);
    expect(accelerators.slice(9)).toEqual([undefined, undefined]);
  });

  test('applies the workspace clicked', () => {
    const { menu, callbacks } = build([workspace('captura', 'Captura')]);
    entries(menu)[0].click();
    expect(callbacks.applyWorkspace).toHaveBeenCalledWith('captura');
  });

  test('keeps an ampersand in a name instead of turning it into an access key', () => {
    const { menu } = build([workspace('a', 'Fotos & carnets')]);
    expect(entries(menu)[0].label).toBe('Fotos && carnets');
  });

  test('opens the window to save the view or to manage the workspaces', () => {
    const { menu, callbacks } = build([workspace('captura', 'Captura')]);
    const byLabel = (label) => menu.submenu.find((item) => item.label === label);

    byLabel('Guardar la vista actual como espacio nuevo...').click();
    byLabel('Gestionar espacios de trabajo...').click();

    expect(callbacks.openWorkspaces.mock.calls).toEqual([['save'], ['manage']]);
  });

  test('still offers to save the view with every workspace hidden', () => {
    const { menu } = build([]);
    expect(menu.submenu.map((item) => item.label)).toEqual([
      'Guardar la vista actual como espacio nuevo...',
      'Gestionar espacios de trabajo...'
    ]);
  });
});
