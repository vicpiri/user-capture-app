/**
 * AppDialogManager - Shows the messages and questions of the main process
 *
 * The main process asks through 'app-dialog' instead of opening the system's
 * message boxes, so every notice looks like the rest of the app. Requests
 * are shown one at a time, in order: two arriving together (a new watch
 * folder that is missing, then the project's import report) would otherwise
 * overwrite each other in the same modal.
 */

(function(global) {
  'use strict';

  class AppDialogManager {
    /**
     * @param {Object} config
     * @param {Object} config.infoModal - InfoModal, for messages
     * @param {Object} config.choiceModal - ChoiceModal, for questions
     * @param {Function} config.answer - (id, response) => void, back to the main process
     */
    constructor(config = {}) {
      this.infoModal = config.infoModal;
      this.choiceModal = config.choiceModal;
      this.answer = config.answer || (() => {});
      this.queue = Promise.resolve();
    }

    /**
     * Queue a request from the main process
     * @param {Object} request - { id, kind: 'message'|'question', title, message, detail, choices, cancel }
     * @returns {Promise<void>} settles once this request has been answered
     */
    handle(request) {
      this.queue = this.queue
        .then(() => this._show(request))
        .catch((error) => {
          console.error('[AppDialogManager] Could not show the dialog:', error);
          // The main process must not wait forever for an answer
          this.answer(request && request.id, undefined);
        });
      return this.queue;
    }

    /**
     * @private
     */
    async _show({ id, kind, title, message, detail, choices, cancel }) {
      const text = detail ? `${message}\n\n${detail}` : message;

      if (kind === 'question') {
        const choice = await this.choiceModal.show({ title, message: text, choices, cancel });
        this.answer(id, choice);
      } else {
        await this.infoModal.show(title, text);
        this.answer(id, undefined);
      }
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AppDialogManager };
  } else if (typeof window !== 'undefined') {
    global.AppDialogManager = AppDialogManager;
  }
})(typeof window !== 'undefined' ? window : global);
