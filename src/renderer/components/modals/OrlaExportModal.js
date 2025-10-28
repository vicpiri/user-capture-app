/**
 * Orla Export Modal
 *
 * Modal for configuring orla (class photo grid) PDF export options.
 * Allows user to choose between captured photos or repository photos.
 *
 * @module components/modals/OrlaExportModal
 */

(function(global) {
  'use strict';

  // Import BaseModal if in browser environment
  const BaseModal = global.BaseModal;

  class OrlaExportModal extends BaseModal {
    constructor() {
      super('orla-export-modal');

      // Radio buttons
      this.capturedRadio = null;
      this.repositoryRadio = null;

      // Quality select
      this.qualitySelect = null;

      // Buttons
      this.confirmBtn = null;
      this.cancelBtn = null;

      // Promise resolver
      this.resolver = null;
    }

    /**
     * Initialize modal
     */
    init() {
      // Call base class init first
      super.init();

      // Get radio buttons
      this.capturedRadio = document.getElementById('orla-export-captured');
      this.repositoryRadio = document.getElementById('orla-export-repository');

      // Get quality select
      this.qualitySelect = document.getElementById('orla-export-quality');

      // Get buttons
      this.confirmBtn = document.getElementById('orla-export-confirm');
      this.cancelBtn = document.getElementById('orla-export-cancel');

      if (!this.capturedRadio || !this.repositoryRadio || !this.qualitySelect || !this.confirmBtn || !this.cancelBtn) {
        console.error('[OrlaExportModal] Required elements not found');
        return;
      }

      // Attach event listeners
      this.confirmBtn.addEventListener('click', () => this.handleConfirm());
      this.cancelBtn.addEventListener('click', () => this.handleCancel());
    }

    /**
     * Show modal and return selected options
     * @returns {Promise<Object|null>} Selected options or null if cancelled
     */
    show() {
      return new Promise((resolve) => {
        this.resolver = resolve;

        // Reset to defaults
        this.capturedRadio.checked = true;
        this.qualitySelect.value = '80'; // Default to high quality

        // Show modal using base class
        super.open();
      });
    }

    /**
     * Handle confirm button click
     */
    handleConfirm() {
      const photoSource = this.capturedRadio.checked ? 'captured' : 'repository';
      const imageQuality = parseInt(this.qualitySelect.value, 10);

      const options = {
        photoSource,
        imageQuality
      };

      if (this.resolver) {
        this.resolver(options);
        this.resolver = null;
      }

      super.close();
    }

    /**
     * Handle cancel button click
     */
    handleCancel() {
      if (this.resolver) {
        this.resolver(null);
        this.resolver = null;
      }

      super.close();
    }

    /**
     * Override close to handle escape key
     */
    close() {
      super.close();

      // Treat as cancel
      if (this.resolver) {
        this.resolver(null);
        this.resolver = null;
      }
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OrlaExportModal };
  } else if (typeof window !== 'undefined') {
    global.OrlaExportModal = OrlaExportModal;
  }
})(typeof window !== 'undefined' ? window : global);
