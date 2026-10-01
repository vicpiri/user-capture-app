/**
 * Group filter stepper - move to the previous or next group without opening
 * the list
 *
 * Going through the groups in order is the usual way to work, and the list
 * made it slow: open, find the next one, click. Here:
 * - The mouse wheel over the closed filter moves one group per notch.
 * - Alt+↑ / Alt+↓ do the same from anywhere in the window.
 *
 * It stops at the first and the last option instead of going round, and does
 * nothing while the filter is disabled (locked by a search) or a dialog is
 * open. The change is announced with a 'change' event, the one the windows
 * already listen to, so saving and broadcasting the group work as when it is
 * picked from the list.
 *
 * @module utils/groupFilterStepper
 */

(function(global) {
  'use strict';

  // A wheel notch is 100 in Chromium; a touchpad sends many small deltas,
  // which add up to a step every this much
  const WHEEL_STEP = 50;

  // Several notches in a row show each group in the filter at once, but only
  // the one stopped at is announced: every change saves the group, tells the
  // other windows and reloads their lists
  const CHANGE_DELAY = 150;

  /**
   * Choose the option next to the chosen one
   * @param {HTMLSelectElement} select
   * @param {number} direction - 1 for the next, -1 for the previous
   * @param {Object} [options]
   * @param {boolean} [options.notify=true] - send 'change' right away
   * @returns {boolean} whether the group changed
   */
  function stepSelect(select, direction, { notify = true } = {}) {
    if (!select || select.disabled) return false;

    for (let index = select.selectedIndex + direction; index >= 0 && index < select.options.length; index += direction) {
      if (!select.options[index].disabled) {
        select.selectedIndex = index;
        if (notify) notifyChange(select);
        return true;
      }
    }
    return false;
  }

  function notifyChange(select) {
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function isOpen(select) {
    try {
      return select.matches(':open');
    } catch (error) {
      // A browser without :open never draws the list in the page
      return false;
    }
  }

  /**
   * @param {HTMLSelectElement} select
   * @param {Object} [options]
   * @param {Document} [options.doc] - where Alt+↑/↓ are listened for
   * @param {function(): boolean} [options.isBlocked] - true while stepping must
   *   not happen; by default, while a dialog (.modal.show) is open
   * @param {number} [options.changeDelay] - quiet time before 'change' is sent
   * @returns {function(): void} removes the listeners
   */
  function attachGroupFilterStepper(select, { doc = global.document, isBlocked, changeDelay = CHANGE_DELAY } = {}) {
    if (!select || !doc) return () => {};

    const blocked = isBlocked || (() => Boolean(doc.querySelector('.modal.show')));
    let wheelDelta = 0;
    let pending = null;

    const step = (direction) => {
      if (!stepSelect(select, direction, { notify: false })) return;
      clearTimeout(pending);
      pending = setTimeout(() => {
        pending = null;
        // Locked by a search started meanwhile: the filter shows all groups
        // only for the search, which must not be saved nor told to others
        if (!select.disabled) notifyChange(select);
      }, changeDelay);
    };

    // Picked from the list before the wait ended: that change was already
    // announced, and the stepped one must not follow it
    const onOtherChange = () => {
      clearTimeout(pending);
      pending = null;
    };

    const onWheel = (event) => {
      // Open, the wheel scrolls the list
      if (isOpen(select) || select.disabled || blocked()) return;
      event.preventDefault();

      wheelDelta += event.deltaY;
      if (Math.abs(wheelDelta) < WHEEL_STEP) return;
      const direction = wheelDelta > 0 ? 1 : -1;
      wheelDelta = 0;
      step(direction);
    };

    const onKeyDown = (event) => {
      if (!event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) return;
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      // Open, the keys move inside the list
      if (isOpen(select) || blocked()) return;

      // Also on the filter itself, where Alt+↓ would open the list
      event.preventDefault();
      step(event.key === 'ArrowDown' ? 1 : -1);
    };

    select.addEventListener('wheel', onWheel, { passive: false });
    select.addEventListener('change', onOtherChange);
    doc.addEventListener('keydown', onKeyDown);

    return () => {
      clearTimeout(pending);
      select.removeEventListener('wheel', onWheel);
      select.removeEventListener('change', onOtherChange);
      doc.removeEventListener('keydown', onKeyDown);
    };
  }

  const groupFilterStepper = { WHEEL_STEP, CHANGE_DELAY, stepSelect, attachGroupFilterStepper };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = groupFilterStepper;
  } else {
    global.groupFilterStepper = groupFilterStepper;
  }
})(typeof window !== 'undefined' ? window : global);
