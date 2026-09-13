/**
 * UpdateModal - Tells the user whether a newer version of the app exists
 *
 * One modal, several views driven by the 'update-status' events the main
 * process sends: checking, available, not-available and error. In phase 1 the
 * "available" view only offers to open the GitHub release page; downloading
 * and installing come later.
 *
 * Automatic checks only ever produce the "available" view. The other states
 * are shown solely when the user asked for a check.
 *
 * @extends BaseModal
 */

(function(global) {
  'use strict';

  // Dependencies: BaseModal (loaded from core in browser, or via require in Node.js)
  let BaseModal;
  if (typeof window !== 'undefined' && window.BaseModal) {
    BaseModal = window.BaseModal;
  } else if (typeof require !== 'undefined') {
    ({ BaseModal } = require('../../core/BaseModal'));
  }

  class UpdateModal extends BaseModal {
    /**
     * @param {Object} config
     * @param {Function} config.checkForUpdates - () => Promise<outcome>
     * @param {Function} config.skipUpdateVersion - (version) => Promise
     * @param {Function} config.openReleasePage - (version) => Promise
     * @param {Function} config.getAppVersion - () => Promise<string>
     */
    constructor(config = {}) {
      super('update-modal', {
        defaultButtonSelector: '#update-modal-primary-btn'
      });

      this.checkForUpdates = config.checkForUpdates || (async () => ({ status: 'unsupported' }));
      this.skipUpdateVersion = config.skipUpdateVersion || (async () => {});
      this.openReleasePage = config.openReleasePage || (async () => {});
      this.getAppVersion = config.getAppVersion || (async () => '');

      // Elements
      this.titleEl = null;
      this.messageEl = null;
      this.spinnerEl = null;
      this.notesEl = null;
      this.notesTextEl = null;
      this.primaryBtn = null;
      this.laterBtn = null;
      this.skipBtn = null;

      // State
      this.currentStatus = null;
      this.availableVersion = null;
    }

    /**
     * Initialize modal
     */
    init() {
      super.init();

      if (!this.modal) return;

      this.titleEl = this.modal.querySelector('#update-modal-title');
      this.messageEl = this.modal.querySelector('#update-modal-message');
      this.spinnerEl = this.modal.querySelector('#update-modal-spinner');
      this.notesEl = this.modal.querySelector('#update-modal-notes');
      this.notesTextEl = this.modal.querySelector('#update-modal-notes-text');
      this.primaryBtn = this.modal.querySelector('#update-modal-primary-btn');
      this.laterBtn = this.modal.querySelector('#update-modal-later-btn');
      this.skipBtn = this.modal.querySelector('#update-modal-skip-btn');

      this.addEventListener(this.primaryBtn, 'click', () => this.handlePrimary());
      this.addEventListener(this.laterBtn, 'click', () => this.close());
      this.addEventListener(this.skipBtn, 'click', () => this.handleSkip());

      this._log('UpdateModal initialized');
    }

    /**
     * User-initiated check: show the checking view and ask the main process
     * @returns {Promise<Object>} the outcome reported by the main process
     */
    async checkNow() {
      this.handleStatus({ status: 'checking', manual: true });
      const outcome = await this.checkForUpdates();
      // The main process also reports through 'update-status'; this covers the
      // cases where it cannot (unsupported platform, already checking)
      if (outcome && outcome.status === 'unsupported') {
        this.handleStatus({
          status: 'error',
          manual: true,
          message: 'La comprobación de actualizaciones solo está disponible en la aplicación instalada.'
        });
      }
      return outcome;
    }

    /**
     * Render a status sent by the main process
     * @param {Object} payload - { status, manual, version, releaseNotes, message }
     */
    handleStatus(payload) {
      if (!payload || !this.modal) return;

      const { status, manual } = payload;
      // Silent outcomes of automatic checks never open the modal
      if (!manual && status !== 'available') return;

      this.currentStatus = status;
      this.availableVersion = status === 'available' ? payload.version : null;

      switch (status) {
        case 'checking':
          this.render({
            title: 'Buscando actualizaciones',
            message: 'Consultando la última versión publicada...',
            spinner: true
          });
          break;
        case 'available':
          this.getAppVersion().then((current) => {
            this.render({
              title: 'Hay una versión nueva',
              message: `Está disponible la versión ${payload.version}` +
                (current ? ` (tienes la ${this._cleanVersion(current)}).` : '.') +
                (payload.releaseDate ? ` Publicada el ${this._formatDate(payload.releaseDate)}.` : ''),
              notes: this._cleanNotes(payload.releaseNotes),
              primary: 'Abrir página de descarga',
              later: 'Más tarde',
              skip: 'Omitir esta versión'
            });
          });
          break;
        case 'not-available':
          this.render({
            title: 'Sin novedades',
            message: 'Ya tienes la última versión.',
            primary: 'Cerrar'
          });
          break;
        case 'error':
          this.render({
            title: 'No se pudo comprobar',
            message: payload.message || 'Se produjo un error al consultar las actualizaciones.',
            primary: 'Cerrar'
          });
          break;
        default:
          break;
      }
    }

    /**
     * Paint one view
     * @private
     */
    render({ title, message, spinner = false, notes = '', primary = null, later = null, skip = null }) {
      if (this.titleEl) this.titleEl.textContent = title;
      if (this.messageEl) this.messageEl.textContent = message;
      if (this.spinnerEl) this.spinnerEl.hidden = !spinner;

      if (this.notesEl) {
        this.notesEl.hidden = !notes;
        if (this.notesTextEl) this.notesTextEl.textContent = notes;
      }

      this._setButton(this.primaryBtn, primary);
      this._setButton(this.laterBtn, later);
      this._setButton(this.skipBtn, skip);

      if (!this.isOpen) {
        this.open();
      }
    }

    /**
     * Primary button: open the release page when an update is available,
     * otherwise just close
     */
    async handlePrimary() {
      if (this.currentStatus === 'available' && this.availableVersion) {
        await this.openReleasePage(this.availableVersion);
      }
      this.close();
    }

    async handleSkip() {
      if (this.availableVersion) {
        await this.skipUpdateVersion(this.availableVersion);
      }
      this.close();
    }

    /**
     * @private
     */
    _setButton(button, label) {
      if (!button) return;
      button.hidden = !label;
      if (label) button.textContent = label;
    }

    /**
     * Strip the "-DEV" suffix a git checkout adds
     * @private
     */
    _cleanVersion(version) {
      return String(version).replace(/-DEV$/, '');
    }

    /**
     * Turn the release notes into plain text
     *
     * The release body is written as the markdown section of CHANGELOG.md, but
     * that is not what arrives: electron-updater's GitHub provider reads the
     * releases atom feed, whose <content> is the body **already rendered to
     * HTML**. Cleaning only the markdown left the tags in place and the notes
     * were shown as `<h3>Bug Fixes</h3><ul><li>...`.
     *
     * The tags are turned into text rather than injected as HTML: these notes
     * come off the network, and nothing here needs formatting badly enough to
     * put remote markup into the window. Markdown is still handled, in case a
     * provider ever hands the body over unrendered.
     * @private
     */
    _cleanNotes(notes) {
      if (!notes) return '';

      let text = String(notes);

      if (/<[a-z][^>]*>/i.test(text)) {
        text = text
          // The feed pretty-prints one tag per line. Those newlines are
          // formatting, and leaving them in doubled the gap between bullets.
          .replace(/>\s*\n\s*</g, '><')
          .replace(/<li[^>]*>/gi, '• ')
          .replace(/<\/li>/gi, '\n')
          // A heading or a paragraph earns a blank line, a list item does not
          .replace(/<\/(p|h[1-6]|blockquote)>/gi, '\n\n')
          .replace(/<\/(ul|ol|div|tr)>/gi, '\n')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]*>/g, '');
      }

      return text
        .replace(/&nbsp;/gi, ' ')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#0?39;|&apos;/gi, "'")
        // Last, so an escaped entity does not end up decoded twice
        .replace(/&amp;/gi, '&')
        .replace(/\s*\(\[[0-9a-f]{7,40}\]\([^)]*\)\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/^#{1,6}\s*/gm, '')
        .replace(/^\*\s+/gm, '• ')
        // What the commit link leaves behind once it is plain text
        .replace(/\s*\(\s*[0-9a-f]{7,40}\s*\)/g, '')
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    /**
     * @private
     */
    _formatDate(isoDate) {
      const date = new Date(isoDate);
      if (Number.isNaN(date.getTime())) return isoDate;
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    /**
     * Internal logging
     * @private
     */
    _log(message, level = 'info') {
      const prefix = '[UpdateModal]';
      if (level === 'error') {
        console.error(prefix, message);
      } else {
        console.log(prefix, message);
      }
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UpdateModal };
  } else if (typeof window !== 'undefined') {
    global.UpdateModal = UpdateModal;
  }
})(typeof window !== 'undefined' ? window : global);
