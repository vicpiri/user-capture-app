/**
 * UpdateModal - Offers, downloads and installs newer versions of the app
 *
 * One modal, several views driven by the 'update-status' events the main
 * process sends:
 * - checking, not-available, error: the outcome of a check
 * - available: a newer version, which the user may download
 * - downloading: progress of that download
 * - downloaded: ready to install now (restarting) or when the app closes
 * - download-error, install-error: offer the release page instead
 *
 * The outcome of a check only shows when the user asked for it, except a
 * version found by the automatic one. What follows a download the user
 * started always shows, save the progress while the user sent the download
 * to the background.
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

  // Shown whether or not the user asked for a check
  const UNPROMPTED_STATUSES = ['available', 'downloading', 'downloaded', 'download-error', 'install-error'];

  const BYTES_PER_MB = 1024 * 1024;

  class UpdateModal extends BaseModal {
    /**
     * @param {Object} config
     * @param {Function} config.checkForUpdates - () => Promise<outcome>
     * @param {Function} config.skipUpdateVersion - (version) => Promise
     * @param {Function} config.openReleasePage - (version) => Promise
     * @param {Function} config.getAppVersion - () => Promise<string>
     * @param {Function} config.downloadUpdate - () => Promise<outcome>
     * @param {Function} config.installUpdate - () => Promise<{success, error}>
     * @param {Function} config.closeProject - () => Promise, run before installing
     * @param {Function} config.isBusy - () => boolean, a task that restarting would cut short
     */
    constructor(config = {}) {
      super('update-modal', {
        defaultButtonSelector: '#update-modal-primary-btn'
      });

      this.checkForUpdates = config.checkForUpdates || (async () => ({ status: 'unsupported' }));
      this.skipUpdateVersion = config.skipUpdateVersion || (async () => {});
      this.openReleasePage = config.openReleasePage || (async () => {});
      this.getAppVersion = config.getAppVersion || (async () => '');
      this.downloadUpdate = config.downloadUpdate || (async () => ({ status: 'unsupported' }));
      this.installUpdate = config.installUpdate || (async () => ({ success: false }));
      this.closeProject = config.closeProject || (async () => {});
      this.isBusy = config.isBusy || (() => false);

      // Elements
      this.titleEl = null;
      this.messageEl = null;
      this.spinnerEl = null;
      this.notesEl = null;
      this.notesTextEl = null;
      this.progressEl = null;
      this.progressBarEl = null;
      this.progressTextEl = null;
      this.primaryBtn = null;
      this.laterBtn = null;
      this.skipBtn = null;

      // State
      this.currentStatus = null;
      // The version the current view is about
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
      this.progressEl = this.modal.querySelector('#update-modal-progress');
      this.progressBarEl = this.modal.querySelector('#update-modal-progress-bar');
      this.progressTextEl = this.modal.querySelector('#update-modal-progress-text');
      this.primaryBtn = this.modal.querySelector('#update-modal-primary-btn');
      this.laterBtn = this.modal.querySelector('#update-modal-later-btn');
      this.skipBtn = this.modal.querySelector('#update-modal-skip-btn');

      this.addEventListener(this.primaryBtn, 'click', () => this.handlePrimary());
      this.addEventListener(this.laterBtn, 'click', () => this.close());
      this.addEventListener(this.skipBtn, 'click', () => this.handleSkip());

      this._log('UpdateModal initialized');
    }

    /**
     * Enter presses the primary button, but not a hidden one, and never
     * "Reiniciar e instalar": that view opens by itself when a download ends,
     * often while the user is pressing Enter to link photos, and a stray key
     * would restart the app in the middle of a session
     * @private
     */
    handleEnterKey(event) {
      if (event.key !== 'Enter' || !this.isOpen) return;
      if (this.currentStatus === 'downloaded' || (this.primaryBtn && this.primaryBtn.hidden)) {
        event.preventDefault();
        return;
      }
      super.handleEnterKey(event);
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
     * @param {Object} payload - { status, manual, version, releaseNotes,
     *   message, percent, transferred, total, bytesPerSecond }
     */
    handleStatus(payload) {
      if (!payload || !this.modal) return;

      const { status, manual } = payload;
      // Silent outcomes of automatic checks never open the modal
      if (!manual && !UNPROMPTED_STATUSES.includes(status)) return;
      // "Seguir en segundo plano" closed the window on purpose; the progress
      // must not keep bringing it back. The end of the download will.
      if (status === 'downloading' && !this.isOpen) return;

      this.currentStatus = status;
      this.availableVersion = payload.version || null;

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
            // The user may have moved on while the version was being read
            if (this.currentStatus !== 'available') return;
            this.render({
              title: 'Hay una versión nueva',
              message: `Está disponible la versión ${payload.version}` +
                (current ? ` (tienes la ${this._cleanVersion(current)}).` : '.') +
                (payload.releaseDate ? ` Publicada el ${this._formatDate(payload.releaseDate)}.` : ''),
              notes: this._cleanNotes(payload.releaseNotes),
              primary: 'Descargar',
              later: 'Más tarde',
              skip: 'Omitir esta versión'
            });
          });
          break;
        case 'downloading':
          this.render({
            title: 'Descargando actualización',
            message: `Descargando la versión ${payload.version}. Puedes seguir trabajando mientras tanto.`,
            progress: payload,
            later: 'Seguir en segundo plano'
          });
          break;
        case 'downloaded':
          this.render({
            title: 'Actualización lista',
            message: `La versión ${payload.version} está descargada. Reinicia la aplicación para instalarla ahora, ` +
              'o se instalará sola cuando la cierres.',
            primary: 'Reiniciar e instalar',
            later: 'Al cerrar la aplicación'
          });
          break;
        case 'download-error':
        case 'install-error':
          this.render({
            title: status === 'download-error' ? 'No se pudo descargar' : 'No se pudo instalar',
            message: (payload.message || 'Se produjo un error con la actualización.') +
              (payload.version ? ' Puedes descargarla a mano desde la página de la versión.' : ''),
            primary: payload.version ? 'Abrir página de descarga' : 'Cerrar',
            later: payload.version ? 'Cerrar' : null
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
    render({ title, message, spinner = false, notes = '', progress = null, primary = null, later = null, skip = null }) {
      if (this.titleEl) this.titleEl.textContent = title;
      if (this.messageEl) this.messageEl.textContent = message;
      if (this.spinnerEl) this.spinnerEl.hidden = !spinner;

      if (this.progressEl) {
        this.progressEl.hidden = !progress;
        if (progress) {
          const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
          if (this.progressBarEl) this.progressBarEl.style.width = `${percent}%`;
          if (this.progressTextEl) this.progressTextEl.textContent = this._formatProgress(progress);
        }
      }

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
     * Primary button: what it does depends on the view
     */
    async handlePrimary() {
      switch (this.currentStatus) {
        case 'available':
          if (this.availableVersion) {
            await this.startDownload();
            return;
          }
          break;
        case 'downloaded':
          await this.install();
          return;
        case 'download-error':
        case 'install-error':
          if (this.availableVersion) {
            await this.openReleasePage(this.availableVersion);
          }
          break;
        default:
          break;
      }
      this.close();
    }

    /**
     * Download the version on show, staying on the progress view
     */
    async startDownload() {
      const version = this.availableVersion;
      this.handleStatus({ status: 'downloading', version, percent: 0 });

      const outcome = await this.downloadUpdate();
      // The main process reports every step through 'update-status', so by
      // now the view has moved on. It has not only when the main process
      // could not even start (no update manager).
      if (this.currentStatus === 'downloading' && outcome &&
          !['downloading', 'downloaded', 'download-error'].includes(outcome.status)) {
        this.handleStatus({
          status: 'download-error',
          version,
          message: outcome.message || 'La descarga de actualizaciones no está disponible en esta instalación.'
        });
      }
    }

    /**
     * Close the project and hand over to the installer, which restarts the app
     */
    async install() {
      const version = this.availableVersion;

      // Restarting would cut an export or an import short
      if (this.isBusy()) {
        if (this.messageEl) {
          this.messageEl.textContent = 'Hay una tarea en curso. Espera a que termine para reiniciar, ' +
            'o deja que la actualización se instale al cerrar la aplicación.';
        }
        return;
      }

      this.currentStatus = 'installing';
      this.render({
        title: 'Instalando actualización',
        message: `La aplicación se cerrará para instalar la versión ${version} y volverá a abrirse sola.`,
        spinner: true
      });

      try {
        await this.closeProject();
      } catch (error) {
        // The app is about to quit either way
        this._log(`Could not close the project before installing: ${error.message}`, 'error');
      }

      const result = await this.installUpdate();
      if (this.currentStatus === 'installing' && result && result.success === false) {
        this.handleStatus({ status: 'install-error', version, message: result.error });
      }
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
     * "45 % · 12,3 de 80,1 MB · 2,4 MB/s"
     * @private
     */
    _formatProgress({ percent, transferred, total, bytesPerSecond }) {
      const mb = (bytes) => (bytes / BYTES_PER_MB).toLocaleString('es-ES', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      });
      const parts = [`${Math.floor(Number(percent) || 0)} %`];
      if (total > 0) parts.push(`${mb(transferred || 0)} de ${mb(total)} MB`);
      if (bytesPerSecond > 0) parts.push(`${mb(bytesPerSecond)} MB/s`);
      return parts.join(' · ');
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
