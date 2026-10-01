/**
 * Tests for groupFilterStepper: previous or next group with the wheel over the
 * filter or Alt+↑/↓, without opening the list
 *
 * @jest-environment jsdom
 */

const { stepSelect, attachGroupFilterStepper, CHANGE_DELAY } = require('../../../src/renderer/utils/groupFilterStepper');

describe('groupFilterStepper', () => {
  let select;
  let onChange;
  let detach;

  const wheel = (deltaY) => {
    const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
    select.dispatchEvent(event);
    return event;
  };
  const key = (keyName, modifiers = { altKey: true }, target = document.body) => {
    const event = new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true, ...modifiers });
    target.dispatchEvent(event);
    return event;
  };

  beforeEach(() => {
    document.body.innerHTML = `
      <select id="group-filter">
        <option value="">Todos los grupos</option>
        <option value="1ESOA">1ESOA</option>
        <option value="1ESOB">1ESOB</option>
        <option value="1ESOC">1ESOC</option>
      </select>
    `;
    select = document.getElementById('group-filter');
    select.value = '1ESOA';
    onChange = jest.fn();
    select.addEventListener('change', () => onChange(select.value));
    detach = attachGroupFilterStepper(select);
  });

  afterEach(() => {
    detach();
    document.body.innerHTML = '';
  });

  describe('stepSelect', () => {
    test('moves to the next and the previous option, announcing the change', () => {
      expect(stepSelect(select, 1)).toBe(true);
      expect(select.value).toBe('1ESOB');
      expect(stepSelect(select, -1)).toBe(true);
      expect(select.value).toBe('1ESOA');
      expect(onChange.mock.calls).toEqual([['1ESOB'], ['1ESOA']]);
    });

    test('stops at both ends instead of going round', () => {
      select.value = '1ESOC';
      expect(stepSelect(select, 1)).toBe(false);
      select.value = '';
      expect(stepSelect(select, -1)).toBe(false);
      expect(onChange).not.toHaveBeenCalled();
    });

    test('skips disabled options', () => {
      select.options[2].disabled = true;
      stepSelect(select, 1);
      expect(select.value).toBe('1ESOC');
    });

    test('does nothing while the filter is disabled', () => {
      select.disabled = true;
      expect(stepSelect(select, 1)).toBe(false);
      expect(select.value).toBe('1ESOA');
    });
  });

  describe('wheel over the closed filter', () => {
    test('a notch down shows the next group at once and announces it after a pause', () => {
      const event = wheel(100);

      expect(event.defaultPrevented).toBe(true);
      expect(select.value).toBe('1ESOB');
      expect(onChange).not.toHaveBeenCalled();

      jest.advanceTimersByTime(CHANGE_DELAY);
      expect(onChange.mock.calls).toEqual([['1ESOB']]);
    });

    test('several notches in a row announce only the group stopped at', () => {
      wheel(100);
      jest.advanceTimersByTime(CHANGE_DELAY - 10);
      wheel(100);
      jest.advanceTimersByTime(CHANGE_DELAY);

      expect(select.value).toBe('1ESOC');
      expect(onChange.mock.calls).toEqual([['1ESOC']]);
    });

    test('a notch up goes to the previous group', () => {
      wheel(-100);
      jest.advanceTimersByTime(CHANGE_DELAY);
      expect(select.value).toBe('');
    });

    test('small touchpad deltas add up to one step', () => {
      wheel(20);
      wheel(20);
      expect(select.value).toBe('1ESOA');
      wheel(20);
      expect(select.value).toBe('1ESOB');
    });

    test('leaves the wheel alone while the filter is locked by a search', () => {
      select.disabled = true;
      const event = wheel(100);
      expect(event.defaultPrevented).toBe(false);
      expect(select.value).toBe('1ESOA');
    });

    test('leaves the wheel alone while a dialog is open', () => {
      document.body.insertAdjacentHTML('beforeend', '<div class="modal show"></div>');
      wheel(100);
      expect(select.value).toBe('1ESOA');
    });

    test('does not announce a group if a search locked the filter during the pause', () => {
      wheel(100);
      select.disabled = true;
      jest.advanceTimersByTime(CHANGE_DELAY);
      expect(onChange).not.toHaveBeenCalled();
    });

    test('a group picked from the list during the pause is not overridden', () => {
      wheel(100);
      select.value = '1ESOC';
      select.dispatchEvent(new Event('change'));
      jest.advanceTimersByTime(CHANGE_DELAY);

      expect(onChange.mock.calls).toEqual([['1ESOC']]);
    });
  });

  describe('Alt+↑ / Alt+↓', () => {
    test('move to the next and the previous group from anywhere in the window', () => {
      const event = key('ArrowDown');
      expect(event.defaultPrevented).toBe(true);
      expect(select.value).toBe('1ESOB');

      key('ArrowUp');
      key('ArrowUp');
      jest.advanceTimersByTime(CHANGE_DELAY);
      expect(select.value).toBe('');
      expect(onChange.mock.calls).toEqual([['']]);
    });

    test('also on the filter itself, where Alt+↓ would open the list', () => {
      const event = key('ArrowDown', { altKey: true }, select);
      expect(event.defaultPrevented).toBe(true);
      expect(select.value).toBe('1ESOB');
    });

    test.each([
      ['plain arrows', {}],
      ['Ctrl+Alt', { altKey: true, ctrlKey: true }],
      ['Alt+Shift', { altKey: true, shiftKey: true }]
    ])('ignore %s, which belong to the user list', (name, modifiers) => {
      const event = key('ArrowDown', modifiers);
      expect(event.defaultPrevented).toBe(false);
      expect(select.value).toBe('1ESOA');
    });

    test('do nothing while a dialog is open', () => {
      document.body.insertAdjacentHTML('beforeend', '<div class="modal show"></div>');
      key('ArrowDown');
      expect(select.value).toBe('1ESOA');
    });
  });

  test('stops listening once detached', () => {
    detach();
    wheel(100);
    key('ArrowDown');
    expect(select.value).toBe('1ESOA');
  });
});
