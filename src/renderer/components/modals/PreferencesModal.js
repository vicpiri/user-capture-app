/**
 * PreferencesModal - Modal for global application preferences
 *
 * Features:
 * - Display preferences (thumbnails, repository photos, indicators)
 * - Backup management preferences
 * - Returns true if saved, false if cancelled
 */

(function(global) {
  'use strict';

  // Import BaseModal if available
  const BaseModal = global.BaseModal;

  class PreferencesModal extends BaseModal {
    constructor() {
      super('preferences-modal');

      // Get modal elements
      this.showCapturedPhotosCheckbox = document.getElementById('pref-show-captured-photos');
      this.showRepositoryPhotosCheckbox = document.getElementById('pref-show-repository-photos');
      this.showRepositoryIndicatorsCheckbox = document.getElementById('pref-show-repository-indicators');
      this.showAdditionalActionsCheckbox = document.getElementById('pref-show-additional-actions');
      this.centerNameInput = document.getElementById('pref-center-name');
      this.logoInput = document.getElementById('pref-logo');
      this.logoBtn = document.getElementById('pref-logo-btn');
      this.logoClearBtn = document.getElementById('pref-logo-clear-btn');

      this.saveBtn = document.getElementById('preferences-save-btn');
      this.cancelBtn = document.getElementById('preferences-cancel-btn');

      // Store logo path
      this.currentLogoPath = '';

      // Bind methods
      this.handleSave = this.handleSave.bind(this);
      this.handleCancel = this.handleCancel.bind(this);
      this.handleSelectLogo = this.handleSelectLogo.bind(this);
      this.handleClearLogo = this.handleClearLogo.bind(this);
    }

    /**
     * Initialize the modal
     */
    init() {
      // Call parent init first
      super.init();

      // Setup event listeners
      this.setupEventListeners();
    }

    setupEventListeners() {
      if (this.saveBtn) {
        this.saveBtn.addEventListener('click', this.handleSave);
      }

      if (this.cancelBtn) {
        this.cancelBtn.addEventListener('click', this.handleCancel);
      }

      if (this.logoBtn) {
        this.logoBtn.addEventListener('click', this.handleSelectLogo);
      }

      if (this.logoClearBtn) {
        this.logoClearBtn.addEventListener('click', this.handleClearLogo);
      }
    }

    /**
     * Show modal with current preferences
     * @param {Object} currentPreferences - Current preference values
     * @returns {Promise<Object|null>} New preferences or null if cancelled
     */
    async show(currentPreferences = {}) {
      console.log('[PreferencesModal] show() called with:', currentPreferences);

      // Load current preferences into form
      this.loadPreferences(currentPreferences);

      // Show the modal
      this.open();

      // Return promise that resolves when user makes a choice
      return new Promise((resolve) => {
        this.resolvePromise = resolve;
      });
    }

    /**
     * Load current preferences into form
     */
    loadPreferences(preferences) {
      if (this.showCapturedPhotosCheckbox) {
        this.showCapturedPhotosCheckbox.checked = preferences.showCapturedPhotos !== false;
      }

      if (this.showRepositoryPhotosCheckbox) {
        this.showRepositoryPhotosCheckbox.checked = preferences.showRepositoryPhotos === true;
      }

      if (this.showRepositoryIndicatorsCheckbox) {
        this.showRepositoryIndicatorsCheckbox.checked = preferences.showRepositoryIndicators === true;
      }

      if (this.showAdditionalActionsCheckbox) {
        this.showAdditionalActionsCheckbox.checked = preferences.showAdditionalActions !== false;
      }

      // Load center name
      if (this.centerNameInput) {
        this.centerNameInput.value = preferences.centerName || '';
      }

      // Load logo path
      this.currentLogoPath = preferences.logoPath || '';
      if (this.logoInput) {
        this.logoInput.value = this.currentLogoPath;
      }
      if (this.logoClearBtn) {
        this.logoClearBtn.style.display = this.currentLogoPath ? 'inline-block' : 'none';
      }
    }

    /**
     * Get current form values
     */
    getFormValues() {
      return {
        showCapturedPhotos: this.showCapturedPhotosCheckbox?.checked ?? true,
        showRepositoryPhotos: this.showRepositoryPhotosCheckbox?.checked ?? false,
        showRepositoryIndicators: this.showRepositoryIndicatorsCheckbox?.checked ?? false,
        showAdditionalActions: this.showAdditionalActionsCheckbox?.checked ?? true,
        centerName: this.centerNameInput?.value?.trim() || '',
        logoPath: this.currentLogoPath
      };
    }

    /**
     * Handle select logo button click
     */
    async handleSelectLogo() {
      console.log('[PreferencesModal] handleSelectLogo called');

      // Use electronAPI if available (browser environment)
      if (typeof window !== 'undefined' && window.electronAPI) {
        const result = await window.electronAPI.showOpenDialog({
          title: 'Seleccionar logotipo',
          filters: [
            { name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg'] }
          ],
          properties: ['openFile']
        });

        if (!result.canceled && result.filePaths.length > 0) {
          this.currentLogoPath = result.filePaths[0];
          if (this.logoInput) {
            this.logoInput.value = this.currentLogoPath;
          }
          if (this.logoClearBtn) {
            this.logoClearBtn.style.display = 'inline-block';
          }
        }
      }
    }

    /**
     * Handle clear logo button click
     */
    handleClearLogo() {
      console.log('[PreferencesModal] handleClearLogo called');

      this.currentLogoPath = '';
      if (this.logoInput) {
        this.logoInput.value = '';
      }
      if (this.logoClearBtn) {
        this.logoClearBtn.style.display = 'none';
      }
    }

    /**
     * Handle save button click
     */
    handleSave() {
      console.log('[PreferencesModal] handleSave called');

      const preferences = this.getFormValues();
      console.log('[PreferencesModal] Saving preferences:', preferences);

      this.close();

      if (this.resolvePromise) {
        this.resolvePromise(preferences);
        this.resolvePromise = null;
      }
    }

    /**
     * Handle cancel button click
     */
    handleCancel() {
      console.log('[PreferencesModal] handleCancel called');

      this.close();

      if (this.resolvePromise) {
        this.resolvePromise(null);
        this.resolvePromise = null;
      }
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PreferencesModal };
  } else if (typeof window !== 'undefined') {
    global.PreferencesModal = PreferencesModal;
  }
})(typeof window !== 'undefined' ? window : global);
