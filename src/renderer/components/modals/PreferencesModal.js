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
      this.centerNameInput = document.getElementById('pref-center-name');
      this.logoInput = document.getElementById('pref-logo');
      this.logoBtn = document.getElementById('pref-logo-btn');
      this.logoClearBtn = document.getElementById('pref-logo-clear-btn');
      this.receiptSubtitleInput = document.getElementById('pref-receipt-subtitle');
      this.receiptPriceInput = document.getElementById('pref-receipt-price');
      this.receiptFooterInput = document.getElementById('pref-receipt-footer');
      this.printerSelect = document.getElementById('pref-printer-select');
      this.printerInfo = document.getElementById('pref-printer-info');
      this.printerPreferencesBtn = document.getElementById('pref-printer-preferences-btn');
      this.testReceiptBtn = document.getElementById('pref-test-receipt-btn');
      this.printerConfigContent = document.getElementById('pref-printer-config-content');
      this.printerSystemFallback = document.getElementById('pref-printer-system-fallback');

      this.saveBtn = document.getElementById('preferences-save-btn');
      this.cancelBtn = document.getElementById('preferences-cancel-btn');
      this.closeXBtn = document.getElementById('preferences-close-x');

      // Get sidebar categories
      this.categories = document.querySelectorAll('.preferences-category');
      this.panels = document.querySelectorAll('.preferences-panel');

      // Store logo path and printer data
      this.currentLogoPath = '';
      this.availablePrinters = [];
      this.selectedPrinter = null;

      // Bind methods
      this.handleSave = this.handleSave.bind(this);
      this.handleCancel = this.handleCancel.bind(this);
      this.handleSelectLogo = this.handleSelectLogo.bind(this);
      this.handleClearLogo = this.handleClearLogo.bind(this);
      this.handleCategoryClick = this.handleCategoryClick.bind(this);
      this.handlePrinterChange = this.handlePrinterChange.bind(this);
      this.handleOpenPrinterPreferences = this.handleOpenPrinterPreferences.bind(this);
      this.handleTestReceipt = this.handleTestReceipt.bind(this);
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

      if (this.closeXBtn) {
        this.closeXBtn.addEventListener('click', this.handleCancel);
      }

      if (this.logoBtn) {
        this.logoBtn.addEventListener('click', this.handleSelectLogo);
      }

      if (this.logoClearBtn) {
        this.logoClearBtn.addEventListener('click', this.handleClearLogo);
      }

      // Setup category navigation
      this.categories.forEach(category => {
        category.addEventListener('click', this.handleCategoryClick);
      });

      // Setup printer configuration
      if (this.printerSelect) {
        this.printerSelect.addEventListener('change', this.handlePrinterChange);
      }

      if (this.printerPreferencesBtn) {
        this.printerPreferencesBtn.addEventListener('click', this.handleOpenPrinterPreferences);
      }

      if (this.testReceiptBtn) {
        this.testReceiptBtn.addEventListener('click', this.handleTestReceipt);
      }
    }

    /**
     * Handle category click for navigation
     */
    async handleCategoryClick(event) {
      const clickedCategory = event.currentTarget;
      const categoryName = clickedCategory.dataset.category;

      console.log('[PreferencesModal] Category clicked:', categoryName);

      // Update active category
      this.categories.forEach(cat => cat.classList.remove('active'));
      clickedCategory.classList.add('active');

      // Update active panel
      this.panels.forEach(panel => {
        if (panel.dataset.panel === categoryName) {
          panel.classList.add('active');
        } else {
          panel.classList.remove('active');
        }
      });

      // Load printer configuration when switching to receipt-printer panel
      if (categoryName === 'receipt-printer') {
        await this.loadPrinterConfiguration();
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

      // Load receipt configuration
      if (this.receiptSubtitleInput) {
        this.receiptSubtitleInput.value = preferences.receiptSubtitle || '';
      }
      if (this.receiptPriceInput) {
        this.receiptPriceInput.value = preferences.receiptPrice || 18;
      }
      if (this.receiptFooterInput) {
        this.receiptFooterInput.value = preferences.receiptFooter || '';
      }
    }

    /**
     * Get current form values
     */
    getFormValues() {
      return {
        centerName: this.centerNameInput?.value?.trim() || '',
        logoPath: this.currentLogoPath,
        receiptSubtitle: this.receiptSubtitleInput?.value?.trim() || '',
        receiptPrice: parseFloat(this.receiptPriceInput?.value) || 18,
        receiptFooter: this.receiptFooterInput?.value?.trim() || ''
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
    async handleSave() {
      console.log('[PreferencesModal] handleSave called');

      const preferences = this.getFormValues();
      console.log('[PreferencesModal] Saving preferences:', preferences);

      // Save printer configuration separately if a printer is selected
      if (this.selectedPrinter && typeof window !== 'undefined' && window.electronAPI) {
        try {
          const printerConfig = {
            name: this.selectedPrinter.name,
            displayName: this.selectedPrinter.displayName || this.selectedPrinter.name,
            isDefault: this.selectedPrinter.isDefault,
            status: this.selectedPrinter.status
          };
          await window.electronAPI.savePrinterConfig(printerConfig);
          console.log('[PreferencesModal] Printer configuration saved:', printerConfig);
        } catch (error) {
          console.error('[PreferencesModal] Error saving printer configuration:', error);
        }
      }

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

    /**
     * Load printer configuration
     */
    async loadPrinterConfiguration() {
      console.log('[PreferencesModal] loadPrinterConfiguration called');

      // Get available printers
      if (typeof window !== 'undefined' && window.electronAPI) {
        try {
          this.availablePrinters = await window.electronAPI.getPrinters();
          console.log('[PreferencesModal] Received printers:', this.availablePrinters);

          if (!this.availablePrinters || this.availablePrinters.length === 0) {
            // No printers detected - show fallback message
            if (this.printerConfigContent) {
              this.printerConfigContent.style.display = 'none';
            }
            if (this.printerSystemFallback) {
              this.printerSystemFallback.style.display = 'block';
            }
          } else {
            // Printers detected - show normal configuration
            if (this.printerConfigContent) {
              this.printerConfigContent.style.display = 'block';
            }
            if (this.printerSystemFallback) {
              this.printerSystemFallback.style.display = 'none';
            }

            // Populate printer select
            if (this.printerSelect) {
              this.printerSelect.innerHTML = '<option value="">Seleccionar impresora...</option>';
              this.availablePrinters.forEach(printer => {
                const option = document.createElement('option');
                option.value = printer.name;
                option.textContent = printer.displayName || printer.name;
                this.printerSelect.appendChild(option);
              });
            }

            // Load saved printer configuration
            const savedConfig = await window.electronAPI.getPrinterConfig();
            if (savedConfig && this.printerSelect) {
              this.printerSelect.value = savedConfig.name;
              this.updatePrinterInfo(savedConfig.name);
            }
          }
        } catch (error) {
          console.error('[PreferencesModal] Error loading printer configuration:', error);
        }
      }
    }

    /**
     * Update printer info display
     */
    updatePrinterInfo(printerName) {
      if (!this.printerInfo) return;

      if (!printerName) {
        this.printerInfo.innerHTML = '<p class="printer-info-empty">Seleccione una impresora para ver su información</p>';
        this.selectedPrinter = null;
        if (this.printerPreferencesBtn) {
          this.printerPreferencesBtn.style.display = 'none';
        }
        return;
      }

      this.selectedPrinter = this.availablePrinters.find(p => p.name === printerName);
      if (!this.selectedPrinter) {
        this.printerInfo.innerHTML = '<p class="printer-info-empty">Impresora no encontrada</p>';
        if (this.printerPreferencesBtn) {
          this.printerPreferencesBtn.style.display = 'none';
        }
        return;
      }

      // Display printer information
      this.printerInfo.innerHTML = `
        <div class="printer-info-row">
          <span class="printer-info-label">Nombre:</span>
          <span class="printer-info-value">${this.selectedPrinter.displayName || this.selectedPrinter.name}</span>
        </div>
        <div class="printer-info-row">
          <span class="printer-info-label">Estado:</span>
          <span class="printer-info-value">${this.selectedPrinter.status === 0 ? 'Lista' : 'No disponible'}</span>
        </div>
        <div class="printer-info-row">
          <span class="printer-info-label">Predeterminada:</span>
          <span class="printer-info-value">${this.selectedPrinter.isDefault ? 'Sí' : 'No'}</span>
        </div>
        ${this.selectedPrinter.description ? `
        <div class="printer-info-row">
          <span class="printer-info-label">Descripción:</span>
          <span class="printer-info-value">${this.selectedPrinter.description}</span>
        </div>
        ` : ''}
      `;

      // Show preferences button when a printer is selected
      if (this.printerPreferencesBtn) {
        this.printerPreferencesBtn.style.display = 'block';
      }
    }

    /**
     * Handle printer selection change
     */
    handlePrinterChange(event) {
      console.log('[PreferencesModal] handlePrinterChange called');
      this.updatePrinterInfo(event.target.value);
    }

    /**
     * Handle open printer preferences button click
     */
    async handleOpenPrinterPreferences() {
      console.log('[PreferencesModal] handleOpenPrinterPreferences called');

      if (!this.selectedPrinter) {
        console.warn('[PreferencesModal] No printer selected');
        return;
      }

      if (typeof window !== 'undefined' && window.electronAPI) {
        try {
          const result = await window.electronAPI.openPrinterPreferences(this.selectedPrinter.name);
          console.log('[PreferencesModal] Printer preferences opened:', result);
        } catch (error) {
          console.error('[PreferencesModal] Error opening printer preferences:', error);
        }
      }
    }

    /**
     * Handle test receipt button click
     */
    async handleTestReceipt() {
      console.log('[PreferencesModal] handleTestReceipt called');

      if (typeof window !== 'undefined' && window.electronAPI) {
        try {
          // Save current printer configuration first
          if (this.selectedPrinter) {
            const config = {
              name: this.selectedPrinter.name,
              displayName: this.selectedPrinter.displayName || this.selectedPrinter.name,
              isDefault: this.selectedPrinter.isDefault,
              status: this.selectedPrinter.status
            };
            await window.electronAPI.savePrinterConfig(config);
          }

          // Print test receipt
          const result = await window.electronAPI.printOrlaReceipt({
            userName: 'Usuario de Prueba',
            groupName: 'Grupo de Prueba'
          });

          if (result.success) {
            console.log('[PreferencesModal] Test receipt printed successfully');
          } else {
            console.error('[PreferencesModal] Error printing test receipt:', result.error);
          }
        } catch (error) {
          console.error('[PreferencesModal] Error printing test receipt:', error);
        }
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
