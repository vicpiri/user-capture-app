/**
 * Tests for InfoModal
 */

const { InfoModal } = require('../../../../src/renderer/components/modals/InfoModal');

describe('InfoModal', () => {
  let modal;
  let mockElement;

  beforeEach(() => {
    // Create mock modal element
    mockElement = document.createElement('div');
    mockElement.id = 'info-modal';
    mockElement.innerHTML = `
      <h2 id="info-modal-title">Información</h2>
      <p id="info-modal-message"></p>
      <button id="info-modal-ok-btn">Aceptar</button>
    `;
    document.body.appendChild(mockElement);

    modal = new InfoModal();
  });

  afterEach(() => {
    if (modal) {
      modal.destroy();
    }
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    test('should create modal with correct id', () => {
      expect(modal.modalId).toBe('info-modal');
    });

    test('should initialize elements as null', () => {
      expect(modal.titleEl).toBeNull();
      expect(modal.messageEl).toBeNull();
      expect(modal.okBtn).toBeNull();
    });

    test('should initialize promise reference as null', () => {
      expect(modal.resolvePromise).toBeNull();
    });
  });

  describe('init', () => {
    test('should find all required elements', () => {
      modal.init();

      expect(modal.titleEl).toBeTruthy();
      expect(modal.messageEl).toBeTruthy();
      expect(modal.okBtn).toBeTruthy();
    });

    test('should register event listener for OK button', () => {
      modal.init();

      expect(modal.listeners.length).toBe(1);
    });
  });

  describe('show', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should return a promise', () => {
      const result = modal.show('Title', 'Message');
      expect(result).toBeInstanceOf(Promise);

      // Cleanup
      modal.handleOk();
    });

    test('should set title text', () => {
      modal.show('Custom Title', 'Message');

      expect(modal.titleEl.textContent).toBe('Custom Title');

      // Cleanup
      modal.handleOk();
    });

    test('should set message text', () => {
      modal.show('Title', 'Custom Message');

      expect(modal.messageEl.textContent).toBe('Custom Message');

      // Cleanup
      modal.handleOk();
    });

    test('should open modal', () => {
      const openSpy = jest.spyOn(modal, 'open');
      modal.show('Title', 'Message');

      expect(openSpy).toHaveBeenCalled();

      // Cleanup
      modal.handleOk();
      openSpy.mockRestore();
    });

    test('should resolve when OK clicked', async () => {
      const promise = modal.show('Title', 'Message');

      modal.handleOk();

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('showSuccess', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should set title to "Éxito"', () => {
      modal.showSuccess('Operation successful');

      expect(modal.titleEl.textContent).toBe('Éxito');

      // Cleanup
      modal.handleOk();
    });

    test('should set message correctly', () => {
      modal.showSuccess('Data saved');

      expect(modal.messageEl.textContent).toBe('Data saved');

      // Cleanup
      modal.handleOk();
    });
  });

  describe('showError', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should set title to "Error"', () => {
      modal.showError('Something went wrong');

      expect(modal.titleEl.textContent).toBe('Error');

      // Cleanup
      modal.handleOk();
    });

    test('should set message correctly', () => {
      modal.showError('File not found');

      expect(modal.messageEl.textContent).toBe('File not found');

      // Cleanup
      modal.handleOk();
    });
  });

  describe('showInfo', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should set title to "Información"', () => {
      modal.showInfo('Please note');

      expect(modal.titleEl.textContent).toBe('Información');

      // Cleanup
      modal.handleOk();
    });

    test('should set message correctly', () => {
      modal.showInfo('This is an info message');

      expect(modal.messageEl.textContent).toBe('This is an info message');

      // Cleanup
      modal.handleOk();
    });
  });

  describe('handleOk', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should resolve promise', async () => {
      const promise = modal.show('Title', 'Message');

      modal.handleOk();

      await expect(promise).resolves.toBeUndefined();
    });

    test('should close modal', () => {
      const closeSpy = jest.spyOn(modal, 'close');
      modal.show('Title', 'Message');

      modal.handleOk();

      expect(closeSpy).toHaveBeenCalled();
      closeSpy.mockRestore();
    });

    test('should clear promise reference', async () => {
      const promise = modal.show('Title', 'Message');
      modal.handleOk();
      await promise;

      expect(modal.resolvePromise).toBeNull();
    });
  });

  describe('close without OK', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should resolve if closed without clicking OK', async () => {
      const promise = modal.show('Title', 'Message');

      modal.close();

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('button click', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should resolve when OK button clicked', async () => {
      const promise = modal.show('Title', 'Message');

      modal.okBtn.click();

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('multiple shows', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should handle multiple sequential shows', async () => {
      await new Promise((resolve) => {
        modal.showSuccess('First').then(resolve);
        modal.handleOk();
      });

      await new Promise((resolve) => {
        modal.showError('Second').then(resolve);
        modal.handleOk();
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
