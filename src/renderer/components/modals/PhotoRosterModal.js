/**
 * Photo Roster Modal
 *
 * Options of the photo roster PDF (everyone in a group with their photo):
 * which groups, captured or repository photos, and JPEG quality.
 *
 * @module components/modals/PhotoRosterModal
 */

(function(global) {
  'use strict';

  // Import BaseModal if in browser environment
  const BaseModal = global.BaseModal;

  class PhotoRosterModal extends BaseModal {
    constructor() {
      super('photo-roster-modal');

      // Group scope radio buttons
      this.allGroupsRadio = null;
      this.singleGroupRadio = null;
      this.groupSelect = null;

      // Photo source radio buttons
      this.capturedRadio = null;
      this.repositoryRadio = null;

      // Quality select
      this.qualitySelect = null;

      // Buttons
      this.confirmBtn = null;
      this.cancelBtn = null;

      // Promise resolver
      this.resolver = null;

      // Available groups
      this.groups = [];
    }

    /**
     * Initialize modal
     */
    init() {
      // Call base class init first
      super.init();

      // Get group scope radio buttons
      this.allGroupsRadio = document.getElementById('photo-roster-all-groups');
      this.singleGroupRadio = document.getElementById('photo-roster-single-group');
      this.groupSelect = document.getElementById('photo-roster-group-select');

      // Get photo source radio buttons
      this.capturedRadio = document.getElementById('photo-roster-captured');
      this.repositoryRadio = document.getElementById('photo-roster-repository');

      // Get quality select
      this.qualitySelect = document.getElementById('photo-roster-quality');

      this.errorEl = document.getElementById('photo-roster-error');

      // Get buttons
      this.confirmBtn = document.getElementById('photo-roster-confirm');
      this.cancelBtn = document.getElementById('photo-roster-cancel');

      if (!this.allGroupsRadio || !this.singleGroupRadio || !this.groupSelect ||
          !this.capturedRadio || !this.repositoryRadio || !this.qualitySelect ||
          !this.confirmBtn || !this.cancelBtn) {
        console.error('[PhotoRosterModal] Required elements not found');
        return;
      }

      // Attach event listeners
      this.confirmBtn.addEventListener('click', () => this.handleConfirm());
      this.cancelBtn.addEventListener('click', () => this.handleCancel());

      // Enable/disable group select based on radio selection
      this.allGroupsRadio.addEventListener('change', () => {
        this.groupSelect.disabled = true;
        this.showError(null);
      });

      this.singleGroupRadio.addEventListener('change', () => {
        this.groupSelect.disabled = false;
      });

      this.groupSelect.addEventListener('change', () => this.showError(null));
    }

    /**
     * Show modal and return selected options
     * @param {Array} groups - Available groups to populate select
     * @returns {Promise<Object|null>} Selected options or null if cancelled
     */
    show(groups = []) {
      return new Promise((resolve) => {
        this.resolver = resolve;
        this.groups = groups;

        // Populate group select
        this.populateGroupSelect();

        // Reset to defaults
        this.allGroupsRadio.checked = true;
        this.groupSelect.disabled = true;
        this.capturedRadio.checked = true;
        this.qualitySelect.value = '80'; // Default to high quality
        this.showError(null);

        // Show modal using base class
        super.open();
      });
    }

    /**
     * Show a problem inside the modal, next to what caused it
     * @param {string|null} message - null hides it
     */
    showError(message) {
      if (!this.errorEl) return;
      this.errorEl.textContent = message || '';
      this.errorEl.hidden = !message;
    }

    /**
     * Populate group select with available groups
     */
    populateGroupSelect() {
      // Clear existing options except the first placeholder
      while (this.groupSelect.options.length > 1) {
        this.groupSelect.remove(1);
      }

      // Add group options
      this.groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.code;
        option.textContent = `${group.code} - ${group.name}`;
        this.groupSelect.appendChild(option);
      });
    }

    /**
     * Handle confirm button click
     */
    handleConfirm() {
      const groupScope = this.allGroupsRadio.checked ? 'all' : 'single';
      const selectedGroup = this.singleGroupRadio.checked ? this.groupSelect.value : null;

      // Validate single group selection
      if (groupScope === 'single' && (!selectedGroup || selectedGroup === '')) {
        this.showError('Selecciona el grupo que quieres exportar.');
        this.groupSelect.focus();
        return;
      }

      const photoSource = this.capturedRadio.checked ? 'captured' : 'repository';
      const imageQuality = parseInt(this.qualitySelect.value, 10);

      const options = {
        groupScope,
        selectedGroup,
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
    module.exports = { PhotoRosterModal };
  } else if (typeof window !== 'undefined') {
    global.PhotoRosterModal = PhotoRosterModal;
  }
})(typeof window !== 'undefined' ? window : global);
