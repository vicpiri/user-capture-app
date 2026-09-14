/**
 * Escape closes the dialog on top
 *
 * Every dialog marks the button that dismisses it (Cancelar, Cerrar, No...)
 * with data-modal-cancel, and Escape presses it. Pressing the button rather
 * than hiding the dialog lets each one cancel the way it already does, so no
 * dialog is left waiting for an answer it will never get. A hidden or disabled
 * button is not pressed, which keeps a dialog that is busy from being closed.
 *
 * A new dialog only needs the attribute on its button.
 *
 * @module core/modalEscape
 */

(function(global) {
  'use strict';

  const OPEN_DIALOG = '.modal.show';
  const CANCEL_BUTTON = '[data-modal-cancel]:not([hidden]):not(:disabled)';

  /**
   * The dialog the user sees on top
   *
   * Dialogs share a z-index, so the one later in the page is drawn over the
   * others.
   *
   * @param {Document} doc
   * @returns {HTMLElement|null}
   */
  function topmostDialog(doc) {
    const open = doc.querySelectorAll(OPEN_DIALOG);
    return open.length > 0 ? open[open.length - 1] : null;
  }

  /**
   * Press the cancel button of the dialog on top
   * @param {KeyboardEvent} event
   * @param {Document} doc
   * @returns {boolean} Whether a button was pressed
   */
  function handleEscape(event, doc) {
    if (event.key !== 'Escape' || event.defaultPrevented) return false;

    const dialog = topmostDialog(doc);
    const button = dialog ? dialog.querySelector(CANCEL_BUTTON) : null;
    if (!button) return false;

    event.preventDefault();
    button.click();
    return true;
  }

  /**
   * Listen for Escape on the whole document
   * @param {Document} doc
   * @returns {Function} Removes the listener
   */
  function installModalEscape(doc) {
    const listener = (event) => handleEscape(event, doc);
    doc.addEventListener('keydown', listener);
    return () => doc.removeEventListener('keydown', listener);
  }

  const api = { installModalEscape, handleEscape, topmostDialog };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else if (typeof window !== 'undefined') {
    global.installModalEscape = installModalEscape;
  }
})(typeof window !== 'undefined' ? window : global);
