/**
 * Integration tests for Phase 3 - Modal Integration in renderer.js
 *
 * These tests verify that modals are properly integrated into renderer.js:
 * - Modal instances are created and initialized
 * - Modal wrapper functions use the new modal classes
 * - Promise-based API works correctly
 */

const { NewProjectModal } = require('../../../src/renderer/components/modals/NewProjectModal');
const { ConfirmModal } = require('../../../src/renderer/components/modals/ConfirmModal');
const { InfoModal } = require('../../../src/renderer/components/modals/InfoModal');

describe('Modal Integration (Phase 3)', () => {
  let newProjectModalInstance;
  let confirmModalInstance;
  let infoModalInstance;

  beforeEach(() => {
    // Create mock DOM structure for modals
    document.body.innerHTML = `
      <!-- New Project Modal -->
      <div id="new-project-modal">
        <input type="text" id="project-folder" />
        <input type="text" id="xml-file" />
        <button id="select-folder-btn">Seleccionar Carpeta</button>
        <button id="select-xml-btn">Seleccionar XML</button>
        <button id="create-project-btn">Crear</button>
        <button id="cancel-new-project-btn">Cancelar</button>
      </div>

      <!-- Confirm Modal -->
      <div id="confirm-modal">
        <p id="confirm-message"></p>
        <button id="confirm-yes-btn">Sí</button>
        <button id="confirm-no-btn">No</button>
      </div>

      <!-- Info Modal -->
      <div id="info-modal">
        <h2 id="info-modal-title"></h2>
        <p id="info-modal-message"></p>
        <button id="info-modal-ok-btn">Aceptar</button>
      </div>

      <!-- Search input (for focus restoration) -->
      <input type="text" id="search-input" />
    `;
  });

  afterEach(() => {
    if (newProjectModalInstance) {
      newProjectModalInstance.destroy();
    }
    if (confirmModalInstance) {
      confirmModalInstance.destroy();
    }
    if (infoModalInstance) {
      infoModalInstance.destroy();
    }
    document.body.innerHTML = '';
  });

  describe('initializeModals()', () => {
    test('should create modal instances', () => {
      // Simulate initializeModals() function
      newProjectModalInstance = new NewProjectModal();
      confirmModalInstance = new ConfirmModal();
      infoModalInstance = new InfoModal();

      expect(newProjectModalInstance).toBeInstanceOf(NewProjectModal);
      expect(confirmModalInstance).toBeInstanceOf(ConfirmModal);
      expect(infoModalInstance).toBeInstanceOf(InfoModal);
    });

    test('should initialize all modal instances', () => {
      // Simulate initializeModals() function
      newProjectModalInstance = new NewProjectModal();
      newProjectModalInstance.init();

      confirmModalInstance = new ConfirmModal();
      confirmModalInstance.init();

      infoModalInstance = new InfoModal();
      infoModalInstance.init();

      // Verify modals are initialized (have found their DOM elements)
      expect(newProjectModalInstance.modal).toBeTruthy();
      expect(confirmModalInstance.modal).toBeTruthy();
      expect(infoModalInstance.modal).toBeTruthy();
    });

    test('should register event listeners for all modals', () => {
      newProjectModalInstance = new NewProjectModal();
      newProjectModalInstance.init();

      confirmModalInstance = new ConfirmModal();
      confirmModalInstance.init();

      infoModalInstance = new InfoModal();
      infoModalInstance.init();

      // NewProjectModal: 4 buttons
      expect(newProjectModalInstance.listeners.length).toBe(4);

      // ConfirmModal: 2 buttons
      expect(confirmModalInstance.listeners.length).toBe(2);

      // InfoModal: 1 button
      expect(infoModalInstance.listeners.length).toBe(1);
    });
  });

  describe('openNewProjectModal() integration', () => {
    beforeEach(() => {
      newProjectModalInstance = new NewProjectModal();
      newProjectModalInstance.init();
    });

    test('should call NewProjectModal.show()', async () => {
      const showSpy = jest.spyOn(newProjectModalInstance, 'show');

      // Simulate openNewProjectModal() calling show()
      const promise = newProjectModalInstance.show();

      expect(showSpy).toHaveBeenCalled();

      // Cancel to resolve promise
      newProjectModalInstance.handleCancel();
      await promise;

      showSpy.mockRestore();
    });

    test('should return promise from NewProjectModal.show()', async () => {
      const promise = newProjectModalInstance.show();

      expect(promise).toBeInstanceOf(Promise);

      // Cancel to resolve promise
      newProjectModalInstance.handleCancel();
      await promise;
    });

    test('should resolve with result when project is created successfully', async () => {
      // This test verifies the promise resolution mechanism
      // The actual handleCreate() logic is tested separately in NewProjectModal.test.js

      const promise = newProjectModalInstance.show();

      // Simulate successful project creation by manually resolving
      newProjectModalInstance.resolvePromise({
        success: true,
        project: {
          folderPath: '/test/path',
          xmlFilePath: '/test/path/file.xml'
        }
      });

      const result = await promise;

      expect(result).toBeTruthy();
      expect(result.success).toBe(true);
    });

    test('should resolve with null when cancelled', async () => {
      const promise = newProjectModalInstance.show();

      // Simulate cancellation
      newProjectModalInstance.handleCancel();

      const result = await promise;

      expect(result).toBeNull();
    });
  });

  describe('showConfirmationModal() integration', () => {
    beforeEach(() => {
      confirmModalInstance = new ConfirmModal();
      confirmModalInstance.init();
    });

    test('should return promise from ConfirmModal.show()', async () => {
      // Simulate showConfirmationModal() wrapper
      const showConfirmationModal = async (message) => {
        const confirmed = await confirmModalInstance.show(message);
        return confirmed;
      };

      const promise = showConfirmationModal('Test message');

      expect(promise).toBeInstanceOf(Promise);

      // Click No to resolve
      confirmModalInstance.handleNo();
      await promise;
    });

    test('should resolve true when user clicks Yes', async () => {
      // Simulate showConfirmationModal() wrapper
      const showConfirmationModal = async (message) => {
        const confirmed = await confirmModalInstance.show(message);
        return confirmed;
      };

      const promise = showConfirmationModal('Confirm action?');

      // User clicks Yes
      confirmModalInstance.handleYes();

      const result = await promise;
      expect(result).toBe(true);
    });

    test('should resolve false when user clicks No', async () => {
      // Simulate showConfirmationModal() wrapper
      const showConfirmationModal = async (message) => {
        const confirmed = await confirmModalInstance.show(message);
        return confirmed;
      };

      const promise = showConfirmationModal('Confirm action?');

      // User clicks No
      confirmModalInstance.handleNo();

      const result = await promise;
      expect(result).toBe(false);
    });

    test('should work with await pattern in async function', async () => {
      // Simulate typical usage in renderer.js
      const handleAction = async () => {
        const confirmed = await confirmModalInstance.show('Delete user?');
        if (confirmed) {
          return 'action performed';
        }
        return 'action cancelled';
      };

      const promise = handleAction();

      // User clicks Yes
      confirmModalInstance.handleYes();

      const result = await promise;
      expect(result).toBe('action performed');
    });
  });

  describe('showInfoModal() integration', () => {
    beforeEach(() => {
      infoModalInstance = new InfoModal();
      infoModalInstance.init();
    });

    test('should return promise from InfoModal.show()', async () => {
      // Simulate showInfoModal() wrapper
      const showInfoModal = async (title, message) => {
        await infoModalInstance.show(title, message);
      };

      const promise = showInfoModal('Success', 'Operation completed');

      expect(promise).toBeInstanceOf(Promise);

      // Click OK to resolve
      infoModalInstance.handleOk();
      await promise;
    });

    test('should set title and message correctly', async () => {
      const promise = infoModalInstance.show('Test Title', 'Test Message');

      expect(infoModalInstance.titleEl.textContent).toBe('Test Title');
      expect(infoModalInstance.messageEl.textContent).toBe('Test Message');

      // Click OK to resolve
      infoModalInstance.handleOk();
      await promise;
    });

    test('should resolve when user clicks OK', async () => {
      const promise = infoModalInstance.show('Info', 'Some information');

      // User clicks OK
      infoModalInstance.handleOk();

      await expect(promise).resolves.toBeUndefined();
    });

    test('should work with await pattern in async function', async () => {
      // Simulate typical usage in renderer.js
      const handleError = async () => {
        await infoModalInstance.show('Error', 'Something went wrong');
        return 'modal closed';
      };

      const promise = handleError();

      // User clicks OK
      infoModalInstance.handleOk();

      const result = await promise;
      expect(result).toBe('modal closed');
    });
  });

  describe('Modal wrapper functions compatibility', () => {
    beforeEach(() => {
      confirmModalInstance = new ConfirmModal();
      confirmModalInstance.init();

      infoModalInstance = new InfoModal();
      infoModalInstance.init();
    });

    test('showConfirmationModal wrapper should match new API', async () => {
      // Old API: showConfirmationModal(message, callback)
      // New API: showConfirmationModal(message) returns Promise<boolean>

      const showConfirmationModal = async (message) => {
        const confirmed = await confirmModalInstance.show(message);
        return confirmed;
      };

      const promise = showConfirmationModal('Test?');
      confirmModalInstance.handleYes();
      const result = await promise;

      expect(typeof result).toBe('boolean');
      expect(result).toBe(true);
    });

    test('showInfoModal wrapper should match new API', async () => {
      // Old API: showInfoModal(title, message, onClose)
      // New API: showInfoModal(title, message) returns Promise<void>

      const searchInput = document.getElementById('search-input');
      const focusSpy = jest.spyOn(searchInput, 'focus');

      const showInfoModal = async (title, message) => {
        await infoModalInstance.show(title, message);
        // Restore focus to search input after closing
        searchInput.focus();
      };

      const promise = showInfoModal('Title', 'Message');
      infoModalInstance.handleOk();
      await promise;

      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
    });
  });

  describe('Memory leak prevention', () => {
    test('should cleanup modal instances on destroy', () => {
      newProjectModalInstance = new NewProjectModal();
      newProjectModalInstance.init();

      confirmModalInstance = new ConfirmModal();
      confirmModalInstance.init();

      infoModalInstance = new InfoModal();
      infoModalInstance.init();

      const newProjectListenerCount = newProjectModalInstance.listeners.length;
      const confirmListenerCount = confirmModalInstance.listeners.length;
      const infoListenerCount = infoModalInstance.listeners.length;

      expect(newProjectListenerCount).toBeGreaterThan(0);
      expect(confirmListenerCount).toBeGreaterThan(0);
      expect(infoListenerCount).toBeGreaterThan(0);

      // Destroy all instances
      newProjectModalInstance.destroy();
      confirmModalInstance.destroy();
      infoModalInstance.destroy();

      // Verify listeners are removed
      expect(newProjectModalInstance.listeners.length).toBe(0);
      expect(confirmModalInstance.listeners.length).toBe(0);
      expect(infoModalInstance.listeners.length).toBe(0);
    });
  });

  describe('Concurrent modal operations', () => {
    beforeEach(() => {
      confirmModalInstance = new ConfirmModal();
      confirmModalInstance.init();

      infoModalInstance = new InfoModal();
      infoModalInstance.init();
    });

    test('should handle sequential modal operations', async () => {
      // First confirmation
      const promise1 = confirmModalInstance.show('First confirm?');
      confirmModalInstance.handleYes();
      const result1 = await promise1;

      // Then info modal
      const promise2 = infoModalInstance.show('Success', 'First action done');
      infoModalInstance.handleOk();
      await promise2;

      // Second confirmation
      const promise3 = confirmModalInstance.show('Second confirm?');
      confirmModalInstance.handleNo();
      const result3 = await promise3;

      expect(result1).toBe(true);
      expect(result3).toBe(false);
    });
  });
});
