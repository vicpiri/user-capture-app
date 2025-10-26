/**
 * Tests for ProgressManager
 */

const { ProgressManager } = require('../../../src/renderer/components/ProgressManager');

describe('ProgressManager', () => {
  let manager;
  let mockDOM;
  let mockElectronAPI;

  beforeEach(() => {
    // Mock DOM elements
    mockDOM = {
      modal: {
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        }
      },
      titleElement: { textContent: '' },
      messageElement: { textContent: '' },
      barElement: { style: { width: '' } },
      percentageElement: { textContent: '' },
      detailsElement: { textContent: '' }
    };

    // Mock Electron API
    mockElectronAPI = {
      onProgress: jest.fn()
    };

    // Create manager instance
    manager = new ProgressManager({
      modal: mockDOM.modal,
      titleElement: mockDOM.titleElement,
      messageElement: mockDOM.messageElement,
      barElement: mockDOM.barElement,
      percentageElement: mockDOM.percentageElement,
      detailsElement: mockDOM.detailsElement,
      electronAPI: mockElectronAPI
    });
  });

  describe('Initialization', () => {
    test('should initialize with hidden state', () => {
      expect(manager.isShowing()).toBe(false);
    });

    test('should store DOM elements', () => {
      expect(manager.modal).toBe(mockDOM.modal);
      expect(manager.titleElement).toBe(mockDOM.titleElement);
      expect(manager.messageElement).toBe(mockDOM.messageElement);
    });

    test('should store electron API', () => {
      expect(manager.electronAPI).toBe(mockElectronAPI);
    });
  });

  describe('setupListener()', () => {
    test('should setup progress listener from electron API', () => {
      manager.setupListener();

      expect(mockElectronAPI.onProgress).toHaveBeenCalled();
    });

    test('should call update when progress event is received', () => {
      manager.setupListener();

      // Get the callback function passed to onProgress
      const progressCallback = mockElectronAPI.onProgress.mock.calls[0][0];

      // Show modal first
      manager.show();

      // Spy on update method
      const updateSpy = jest.spyOn(manager, 'update');

      // Simulate progress event
      progressCallback({
        percentage: 50,
        message: 'Processing...',
        details: 'File 1 of 2'
      });

      expect(updateSpy).toHaveBeenCalledWith(50, 'Processing...', 'File 1 of 2');
    });

    test('should handle missing electron API gracefully', () => {
      const managerNoAPI = new ProgressManager({
        modal: mockDOM.modal,
        electronAPI: null
      });

      expect(() => managerNoAPI.setupListener()).not.toThrow();
    });

    test('should handle missing onProgress method gracefully', () => {
      const managerNoProgress = new ProgressManager({
        modal: mockDOM.modal,
        electronAPI: {}
      });

      expect(() => managerNoProgress.setupListener()).not.toThrow();
    });
  });

  describe('show()', () => {
    test('should show modal with default title and message', () => {
      manager.show();

      expect(mockDOM.modal.classList.add).toHaveBeenCalledWith('show');
      expect(manager.isShowing()).toBe(true);
      expect(mockDOM.titleElement.textContent).toBe('Procesando...');
      expect(mockDOM.messageElement.textContent).toBe('Por favor, espera...');
    });

    test('should show modal with custom title and message', () => {
      manager.show('Exporting...', 'Please wait while we export');

      expect(mockDOM.titleElement.textContent).toBe('Exporting...');
      expect(mockDOM.messageElement.textContent).toBe('Please wait while we export');
    });

    test('should reset progress to 0 when showing', () => {
      manager.show();

      expect(mockDOM.barElement.style.width).toBe('0%');
      expect(mockDOM.percentageElement.textContent).toBe('0%');
    });

    test('should clear details when showing', () => {
      mockDOM.detailsElement.textContent = 'Previous details';

      manager.show();

      expect(mockDOM.detailsElement.textContent).toBe('');
    });

    test('should handle missing modal element', () => {
      const managerNoModal = new ProgressManager({
        modal: null
      });

      expect(() => managerNoModal.show()).not.toThrow();
    });
  });

  describe('update()', () => {
    beforeEach(() => {
      manager.show();
    });

    test('should update progress percentage', () => {
      manager.update(50);

      expect(mockDOM.barElement.style.width).toBe('50%');
      expect(mockDOM.percentageElement.textContent).toBe('50%');
    });

    test('should update message if provided', () => {
      manager.update(25, 'Processing files...');

      expect(mockDOM.messageElement.textContent).toBe('Processing files...');
    });

    test('should update details if provided', () => {
      manager.update(75, '', 'File 3 of 4');

      expect(mockDOM.detailsElement.textContent).toBe('File 3 of 4');
    });

    test('should update all fields', () => {
      manager.update(60, 'Exporting...', 'Image 6 of 10');

      expect(mockDOM.barElement.style.width).toBe('60%');
      expect(mockDOM.percentageElement.textContent).toBe('60%');
      expect(mockDOM.messageElement.textContent).toBe('Exporting...');
      expect(mockDOM.detailsElement.textContent).toBe('Image 6 of 10');
    });

    test('should not update message if empty string', () => {
      mockDOM.messageElement.textContent = 'Previous message';

      manager.update(30, '');

      expect(mockDOM.messageElement.textContent).toBe('Previous message');
    });

    test('should handle decimal percentages', () => {
      manager.update(33.333);

      expect(mockDOM.barElement.style.width).toBe('33.333%');
      expect(mockDOM.percentageElement.textContent).toBe('33%');
    });

    test('should warn if update called when modal not visible', () => {
      manager.close();

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      manager.update(50);

      expect(consoleSpy).toHaveBeenCalledWith('[ProgressManager] Update called but modal not visible');
      consoleSpy.mockRestore();
    });
  });

  describe('setProgress()', () => {
    test('should set progress bar width', () => {
      manager.setProgress(45);

      expect(mockDOM.barElement.style.width).toBe('45%');
    });

    test('should set percentage text', () => {
      manager.setProgress(67);

      expect(mockDOM.percentageElement.textContent).toBe('67%');
    });

    test('should round percentage for display', () => {
      manager.setProgress(45.7);

      expect(mockDOM.percentageElement.textContent).toBe('46%');
    });
  });

  describe('setTitle()', () => {
    test('should update title', () => {
      manager.setTitle('New Title');

      expect(mockDOM.titleElement.textContent).toBe('New Title');
    });

    test('should handle missing title element', () => {
      manager.titleElement = null;

      expect(() => manager.setTitle('Title')).not.toThrow();
    });
  });

  describe('setMessage()', () => {
    test('should update message', () => {
      manager.setMessage('New message');

      expect(mockDOM.messageElement.textContent).toBe('New message');
    });

    test('should handle missing message element', () => {
      manager.messageElement = null;

      expect(() => manager.setMessage('Message')).not.toThrow();
    });
  });

  describe('setDetails()', () => {
    test('should update details', () => {
      manager.setDetails('New details');

      expect(mockDOM.detailsElement.textContent).toBe('New details');
    });

    test('should handle missing details element', () => {
      manager.detailsElement = null;

      expect(() => manager.setDetails('Details')).not.toThrow();
    });
  });

  describe('close()', () => {
    test('should hide modal', () => {
      manager.show();
      manager.close();

      expect(mockDOM.modal.classList.remove).toHaveBeenCalledWith('show');
      expect(manager.isShowing()).toBe(false);
    });

    test('should handle missing modal element', () => {
      manager.modal = null;

      expect(() => manager.close()).not.toThrow();
    });
  });

  describe('reset()', () => {
    test('should reset progress to 0', () => {
      manager.setProgress(50);
      manager.setDetails('Some details');

      manager.reset();

      expect(mockDOM.barElement.style.width).toBe('0%');
      expect(mockDOM.percentageElement.textContent).toBe('0%');
      expect(mockDOM.detailsElement.textContent).toBe('');
    });
  });

  describe('isShowing()', () => {
    test('should return false initially', () => {
      expect(manager.isShowing()).toBe(false);
    });

    test('should return true when shown', () => {
      manager.show();

      expect(manager.isShowing()).toBe(true);
    });

    test('should return false after closing', () => {
      manager.show();
      manager.close();

      expect(manager.isShowing()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle show/hide cycle', () => {
      manager.show('Title 1');
      expect(manager.isShowing()).toBe(true);

      manager.close();
      expect(manager.isShowing()).toBe(false);

      manager.show('Title 2');
      expect(manager.isShowing()).toBe(true);
      expect(mockDOM.titleElement.textContent).toBe('Title 2');
    });

    test('should handle multiple updates in sequence', () => {
      manager.show();

      manager.update(20, 'Step 1');
      manager.update(40, 'Step 2');
      manager.update(60, 'Step 3');
      manager.update(80, 'Step 4');
      manager.update(100, 'Complete');

      expect(mockDOM.barElement.style.width).toBe('100%');
      expect(mockDOM.messageElement.textContent).toBe('Complete');
    });

    test('should handle missing DOM elements gracefully', () => {
      const minimalManager = new ProgressManager({});

      expect(() => {
        minimalManager.show();
        minimalManager.update(50);
        minimalManager.close();
      }).not.toThrow();
    });
  });
});
