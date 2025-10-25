/**
 * Tests for ExportOptionsModal
 */

const { ExportOptionsModal } = require('../../../../src/renderer/components/modals/ExportOptionsModal');

describe('ExportOptionsModal', () => {
  let modal;
  let mockElement;

  beforeEach(() => {
    // Create mock modal element
    mockElement = document.createElement('div');
    mockElement.id = 'export-options-modal';
    mockElement.innerHTML = `
      <input type="radio" id="export-copy-original" name="export-mode" value="copy" checked>
      <input type="radio" id="export-resize-enabled" name="export-mode" value="resize">
      <div id="resize-options">
        <input type="number" id="export-box-size" value="800">
        <input type="number" id="export-max-size" value="500">
      </div>
      <button id="export-confirm-btn">Exportar</button>
      <button id="export-cancel-btn">Cancelar</button>
    `;
    document.body.appendChild(mockElement);

    modal = new ExportOptionsModal();
  });

  afterEach(() => {
    if (modal) {
      modal.destroy();
    }
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    test('should create modal with correct id', () => {
      expect(modal.modalId).toBe('export-options-modal');
    });

    test('should initialize all form elements as null', () => {
      expect(modal.copyOriginalRadio).toBeNull();
      expect(modal.resizeRadio).toBeNull();
      expect(modal.resizeOptionsContainer).toBeNull();
      expect(modal.boxSizeInput).toBeNull();
      expect(modal.maxSizeInput).toBeNull();
      expect(modal.confirmBtn).toBeNull();
      expect(modal.cancelBtn).toBeNull();
    });
  });

  describe('init', () => {
    test('should find all required elements', () => {
      modal.init();

      expect(modal.copyOriginalRadio).toBeTruthy();
      expect(modal.resizeRadio).toBeTruthy();
      expect(modal.resizeOptionsContainer).toBeTruthy();
      expect(modal.boxSizeInput).toBeTruthy();
      expect(modal.maxSizeInput).toBeTruthy();
      expect(modal.confirmBtn).toBeTruthy();
      expect(modal.cancelBtn).toBeTruthy();
    });

    test('should register event listeners', () => {
      modal.init();

      // 2 radio buttons + 2 buttons = 4 listeners
      expect(modal.listeners.length).toBe(4);
    });
  });

  describe('show', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should return a promise', () => {
      const result = modal.show();
      expect(result).toBeInstanceOf(Promise);

      // Cleanup
      modal.handleCancel();
    });

    test('should reset form to defaults', () => {
      // Change values
      modal.resizeRadio.checked = true;
      modal.boxSizeInput.value = '1000';
      modal.maxSizeInput.value = '700';

      // Show modal (should reset)
      modal.show();

      expect(modal.copyOriginalRadio.checked).toBe(true);
      expect(modal.boxSizeInput.value).toBe('800');
      expect(modal.maxSizeInput.value).toBe('500');

      // Cleanup
      modal.handleCancel();
    });

    test('should open modal', () => {
      const openSpy = jest.spyOn(modal, 'open');
      modal.show();

      expect(openSpy).toHaveBeenCalled();

      // Cleanup
      modal.handleCancel();
      openSpy.mockRestore();
    });
  });

  describe('handleModeChange', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should disable resize inputs when copy mode selected', () => {
      modal.copyOriginalRadio.checked = true;
      modal.handleModeChange();

      expect(modal.boxSizeInput.disabled).toBe(true);
      expect(modal.maxSizeInput.disabled).toBe(true);
      expect(modal.resizeOptionsContainer.style.opacity).toBe('0.5');
    });

    test('should enable resize inputs when resize mode selected', () => {
      modal.resizeRadio.checked = true;
      modal.handleModeChange();

      expect(modal.boxSizeInput.disabled).toBe(false);
      expect(modal.maxSizeInput.disabled).toBe(false);
      expect(modal.resizeOptionsContainer.style.opacity).toBe('1');
    });
  });

  describe('getExportOptions', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should return copy mode options when copy selected', () => {
      modal.copyOriginalRadio.checked = true;

      const options = modal.getExportOptions();

      expect(options.mode).toBe('copy');
      expect(options.resize).toBeNull();
    });

    test('should return resize mode options when resize selected', () => {
      modal.resizeRadio.checked = true;
      modal.boxSizeInput.value = '1000';
      modal.maxSizeInput.value = '600';

      const options = modal.getExportOptions();

      expect(options.mode).toBe('resize');
      expect(options.resize).toEqual({
        boxSize: 1000,
        maxSize: 600
      });
    });

    test('should use default values if inputs are invalid', () => {
      modal.resizeRadio.checked = true;
      modal.boxSizeInput.value = '';
      modal.maxSizeInput.value = '';

      const options = modal.getExportOptions();

      expect(options.resize.boxSize).toBe(800);
      expect(options.resize.maxSize).toBe(500);
    });
  });

  describe('handleConfirm', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should resolve with export options', async () => {
      const promise = modal.show();

      modal.copyOriginalRadio.checked = true;
      modal.handleConfirm();

      const result = await promise;
      expect(result).toEqual({
        mode: 'copy',
        resize: null
      });
    });

    test('should close modal', () => {
      const closeSpy = jest.spyOn(modal, 'close');
      modal.show();

      modal.handleConfirm();

      expect(closeSpy).toHaveBeenCalled();
      closeSpy.mockRestore();
    });
  });

  describe('handleCancel', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should resolve with null', async () => {
      const promise = modal.show();

      modal.handleCancel();

      const result = await promise;
      expect(result).toBeNull();
    });

    test('should close modal', () => {
      const closeSpy = jest.spyOn(modal, 'close');
      modal.show();

      modal.handleCancel();

      expect(closeSpy).toHaveBeenCalled();
      closeSpy.mockRestore();
    });
  });

  describe('close without action', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should resolve as null if closed without confirming', async () => {
      const promise = modal.show();

      modal.close();

      const result = await promise;
      expect(result).toBeNull();
    });
  });

  describe('button clicks', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should resolve with options when confirm clicked', async () => {
      const promise = modal.show();

      modal.resizeRadio.checked = true;
      modal.confirmBtn.click();

      const result = await promise;
      expect(result.mode).toBe('resize');
    });

    test('should resolve null when cancel clicked', async () => {
      const promise = modal.show();

      modal.cancelBtn.click();

      const result = await promise;
      expect(result).toBeNull();
    });
  });

  describe('resetForm', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should reset all inputs to defaults', () => {
      // Change values
      modal.resizeRadio.checked = true;
      modal.boxSizeInput.value = '1500';
      modal.maxSizeInput.value = '900';

      // Reset
      modal.resetForm();

      expect(modal.copyOriginalRadio.checked).toBe(true);
      expect(modal.boxSizeInput.value).toBe('800');
      expect(modal.maxSizeInput.value).toBe('500');
    });
  });
});
