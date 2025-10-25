/**
 * Tests for ConfirmModal
 */

const { ConfirmModal } = require('../../../../src/renderer/components/modals/ConfirmModal');

describe('ConfirmModal', () => {
  let modal;
  let mockElement;

  beforeEach(() => {
    // Create mock modal element
    mockElement = document.createElement('div');
    mockElement.id = 'confirm-modal';
    mockElement.innerHTML = `
      <p id="confirm-message"></p>
      <button id="confirm-yes-btn">Sí</button>
      <button id="confirm-no-btn">No</button>
    `;
    document.body.appendChild(mockElement);

    modal = new ConfirmModal();
  });

  afterEach(() => {
    if (modal) {
      modal.destroy();
    }
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    test('should create modal with correct id', () => {
      expect(modal.modalId).toBe('confirm-modal');
    });

    test('should initialize elements as null', () => {
      expect(modal.messageEl).toBeNull();
      expect(modal.yesBtn).toBeNull();
      expect(modal.noBtn).toBeNull();
    });

    test('should initialize promise references as null', () => {
      expect(modal.resolvePromise).toBeNull();
      expect(modal.rejectPromise).toBeNull();
    });
  });

  describe('init', () => {
    test('should find all required elements', () => {
      modal.init();

      expect(modal.messageEl).toBeTruthy();
      expect(modal.yesBtn).toBeTruthy();
      expect(modal.noBtn).toBeTruthy();
    });

    test('should register event listeners', () => {
      modal.init();

      expect(modal.listeners.length).toBe(2); // Yes and No buttons
    });
  });

  describe('show', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should return a promise', () => {
      const result = modal.show('Test message');
      expect(result).toBeInstanceOf(Promise);

      // Cleanup
      modal.handleNo();
    });

    test('should set message text', () => {
      modal.show('Custom message');

      expect(modal.messageEl.textContent).toBe('Custom message');

      // Cleanup
      modal.handleNo();
    });

    test('should open modal', () => {
      const openSpy = jest.spyOn(modal, 'open');
      modal.show('Test');

      expect(openSpy).toHaveBeenCalled();

      // Cleanup
      modal.handleNo();
      openSpy.mockRestore();
    });
  });

  describe('handleYes', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should resolve promise with true', async () => {
      const promise = modal.show('Confirm?');

      // Simulate click
      modal.handleYes();

      const result = await promise;
      expect(result).toBe(true);
    });

    test('should close modal', () => {
      const closeSpy = jest.spyOn(modal, 'close');
      modal.show('Test');

      modal.handleYes();

      expect(closeSpy).toHaveBeenCalled();
      closeSpy.mockRestore();
    });

    test('should clear promise references', async () => {
      const promise = modal.show('Test');
      modal.handleYes();
      await promise;

      expect(modal.resolvePromise).toBeNull();
      expect(modal.rejectPromise).toBeNull();
    });
  });

  describe('handleNo', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should resolve promise with false', async () => {
      const promise = modal.show('Confirm?');

      modal.handleNo();

      const result = await promise;
      expect(result).toBe(false);
    });

    test('should close modal', () => {
      const closeSpy = jest.spyOn(modal, 'close');
      modal.show('Test');

      modal.handleNo();

      expect(closeSpy).toHaveBeenCalled();
      closeSpy.mockRestore();
    });

    test('should clear promise references', async () => {
      const promise = modal.show('Test');
      modal.handleNo();
      await promise;

      expect(modal.resolvePromise).toBeNull();
      expect(modal.rejectPromise).toBeNull();
    });
  });

  describe('close without choosing', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should resolve as false if closed without clicking button', async () => {
      const promise = modal.show('Test');

      // Close directly without clicking Yes or No
      modal.close();

      const result = await promise;
      expect(result).toBe(false);
    });
  });

  describe('button clicks', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should resolve true when Yes button clicked', async () => {
      const promise = modal.show('Test?');

      modal.yesBtn.click();

      const result = await promise;
      expect(result).toBe(true);
    });

    test('should resolve false when No button clicked', async () => {
      const promise = modal.show('Test?');

      modal.noBtn.click();

      const result = await promise;
      expect(result).toBe(false);
    });
  });

  describe('multiple shows', () => {
    beforeEach(() => {
      modal.init();
    });

    test('should handle multiple sequential shows', async () => {
      const result1 = await new Promise((resolve) => {
        modal.show('First').then(resolve);
        modal.handleYes();
      });

      const result2 = await new Promise((resolve) => {
        modal.show('Second').then(resolve);
        modal.handleNo();
      });

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });
  });
});
