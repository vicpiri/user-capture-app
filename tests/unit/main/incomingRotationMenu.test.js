/**
 * Proyecto > Girar las fotos entrantes
 *
 * @jest-environment node
 */

jest.mock('electron', () => ({ Menu: {}, dialog: {} }));
jest.mock('../../../src/main/appDialogs', () => ({ showAppMessage: jest.fn() }));

const MenuBuilder = require('../../../src/main/menu/menuBuilder');

describe('Girar las fotos entrantes submenu', () => {
  const build = (incomingRotation) => {
    const callbacks = { setIncomingRotation: jest.fn() };
    const builder = new MenuBuilder({ incomingRotation, callbacks, logger: { info: jest.fn() } });
    return { menu: builder.buildIncomingRotationMenu(), callbacks };
  };

  test('offers the four turns and marks the one in use', () => {
    const { menu } = build(90);

    expect(menu.label).toBe('Girar las fotos entrantes');
    expect(menu.submenu.map((item) => [item.label, item.checked])).toEqual([
      ['No girarlas', false],
      ['90° a la derecha', true],
      ['180°', false],
      ['90° a la izquierda', false]
    ]);
    expect(menu.submenu.every((item) => item.type === 'radio')).toBe(true);
  });

  test('marks "No girarlas" when it is off', () => {
    const { menu } = build(0);
    expect(menu.submenu.find((item) => item.checked).label).toBe('No girarlas');
  });

  test('saves the turn chosen', () => {
    const { menu, callbacks } = build(0);
    menu.submenu.find((item) => item.label === '90° a la izquierda').click();
    expect(callbacks.setIncomingRotation).toHaveBeenCalledWith(270);
  });

  test('is disabled without a project, where it cannot be kept', () => {
    const { menu } = build(null);
    expect(menu.enabled).toBe(false);
    expect(menu.submenu.every((item) => item.enabled === false)).toBe(true);
  });
});
