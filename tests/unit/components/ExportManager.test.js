/**
 * Tests for ExportManager
 */

const { ExportManager } = require('../../../src/renderer/components/ExportManager');

describe('ExportManager', () => {
  let manager;
  let mockExportOptionsModal;
  let mockConfirmModal;
  let mockShowProgressModal;
  let mockCloseProgressModal;
  let mockShowInfoModal;
  let mockShowOpenDialog;
  let mockElectronAPI;
  let mockGetters;

  beforeEach(() => {
    // Mock ExportOptionsModal
    mockExportOptionsModal = {
      show: jest.fn()
    };

    // Mock ConfirmModal
    mockConfirmModal = {
      show: jest.fn()
    };

    // Mock modal functions
    mockShowProgressModal = jest.fn();
    mockCloseProgressModal = jest.fn();
    mockShowInfoModal = jest.fn();
    mockShowOpenDialog = jest.fn();

    // Mock getters
    mockGetters = {
      getProjectOpen: jest.fn(() => true),
      getSelectionMode: jest.fn(() => false),
      getSelectedUsers: jest.fn(() => new Set()),
      getDisplayedUsers: jest.fn(() => []),
      getCurrentUsers: jest.fn(() => []),
      getShowDuplicatesOnly: jest.fn(() => false),
      getAllUsers: jest.fn(() => [])
    };

    // Mock Electron API
    mockElectronAPI = {
      exportCSV: jest.fn(),
      exportImages: jest.fn(),
      exportImagesName: jest.fn(),
      exportToRepository: jest.fn(),
      checkCardPrintRequests: jest.fn().mockResolvedValue({ success: true, usersWithRequests: [] }),
      markCardsAsPrinted: jest.fn().mockResolvedValue({ success: true, movedCount: 0 })
    };

    // Create manager instance
    manager = new ExportManager({
      exportOptionsModal: mockExportOptionsModal,
      confirmModal: mockConfirmModal,
      showProgressModal: mockShowProgressModal,
      closeProgressModal: mockCloseProgressModal,
      showInfoModal: mockShowInfoModal,
      showOpenDialog: mockShowOpenDialog,
      ...mockGetters,
      electronAPI: mockElectronAPI
    });
  });

  describe('Initialization', () => {
    test('should store all configuration', () => {
      expect(manager.exportOptionsModal).toBe(mockExportOptionsModal);
      expect(manager.showProgressModal).toBe(mockShowProgressModal);
      expect(manager.closeProgressModal).toBe(mockCloseProgressModal);
      expect(manager.showInfoModal).toBe(mockShowInfoModal);
      expect(manager.showOpenDialog).toBe(mockShowOpenDialog);
      expect(manager.electronAPI).toBe(mockElectronAPI);
    });
  });

  describe('getUsersToExport()', () => {
    test('should return selected users when in selection mode', () => {
      mockGetters.getSelectionMode.mockReturnValue(true);
      mockGetters.getSelectedUsers.mockReturnValue(new Set([1, 2, 3]));
      mockGetters.getDisplayedUsers.mockReturnValue([
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' },
        { id: 3, name: 'User 3' },
        { id: 4, name: 'User 4' }
      ]);

      const result = manager.getUsersToExport();

      expect(result.length).toBe(3);
      expect(result.map(u => u.id)).toEqual([1, 2, 3]);
    });

    test('should return current users when not in selection mode', () => {
      const users = [{ id: 1 }, { id: 2 }];
      mockGetters.getCurrentUsers.mockReturnValue(users);

      const result = manager.getUsersToExport();

      expect(result).toBe(users);
    });

    test('should return duplicates when showDuplicatesOnly is true', () => {
      mockGetters.getShowDuplicatesOnly.mockReturnValue(true);
      mockGetters.getAllUsers.mockReturnValue([
        { id: 1, image_path: '/path/img1.jpg' },
        { id: 2, image_path: '/path/img1.jpg' }, // Duplicate
        { id: 3, image_path: '/path/img2.jpg' },
        { id: 4, image_path: '/path/img3.jpg' },
        { id: 5, image_path: '/path/img3.jpg' }  // Duplicate
      ]);

      const result = manager.getUsersToExport();

      expect(result.length).toBe(4);
      expect(result.map(u => u.id).sort()).toEqual([1, 2, 4, 5]);
    });

    test('should filter out users without images when finding duplicates', () => {
      mockGetters.getShowDuplicatesOnly.mockReturnValue(true);
      mockGetters.getAllUsers.mockReturnValue([
        { id: 1, image_path: '/path/img1.jpg' },
        { id: 2, image_path: '/path/img1.jpg' },
        { id: 3, image_path: null }
      ]);

      const result = manager.getUsersToExport();

      expect(result.length).toBe(2);
      expect(result.every(u => u.image_path)).toBe(true);
    });
  });

  describe('checkProjectOpen()', () => {
    test('should return true when project is open', () => {
      mockGetters.getProjectOpen.mockReturnValue(true);

      expect(manager.checkProjectOpen()).toBe(true);
      expect(mockShowInfoModal).not.toHaveBeenCalled();
    });

    test('should return false and show warning when project is closed', () => {
      mockGetters.getProjectOpen.mockReturnValue(false);

      expect(manager.checkProjectOpen()).toBe(false);
      expect(mockShowInfoModal).toHaveBeenCalledWith('Aviso', 'Debes abrir o crear un proyecto primero');
    });
  });

  describe('exportCSV()', () => {
    beforeEach(() => {
      mockGetters.getCurrentUsers.mockReturnValue([
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' }
      ]);
    });

    test('should not export when project is closed', async () => {
      mockGetters.getProjectOpen.mockReturnValue(false);

      await manager.exportCSV();

      expect(mockShowOpenDialog).not.toHaveBeenCalled();
    });

    test('should show folder picker dialog', async () => {
      mockShowOpenDialog.mockResolvedValue({ canceled: true });

      await manager.exportCSV();

      expect(mockShowOpenDialog).toHaveBeenCalledWith({
        properties: ['openDirectory'],
        title: 'Seleccionar carpeta para guardar el CSV'
      });
    });

    test('should export CSV successfully', async () => {
      mockShowOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['/export/path']
      });

      mockElectronAPI.exportCSV.mockResolvedValue({
        success: true,
        filename: 'carnets.csv',
        exported: 2,
        ignored: 0
      });

      await manager.exportCSV();

      expect(mockElectronAPI.exportCSV).toHaveBeenCalledWith(
        '/export/path',
        expect.any(Array)
      );

      expect(mockShowInfoModal).toHaveBeenCalledWith(
        'Exportación exitosa',
        expect.stringContaining('CSV exportado correctamente')
      );
    });

    test('should show ignored count in success message', async () => {
      mockShowOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['/export/path']
      });

      mockElectronAPI.exportCSV.mockResolvedValue({
        success: true,
        filename: 'carnets.csv',
        exported: 5,
        ignored: 3
      });

      await manager.exportCSV();

      expect(mockShowInfoModal).toHaveBeenCalledWith(
        'Exportación exitosa',
        expect.stringContaining('3 usuarios ignorados')
      );
    });

    test('should handle export error', async () => {
      mockShowOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['/export/path']
      });

      mockElectronAPI.exportCSV.mockResolvedValue({
        success: false,
        error: 'Permission denied'
      });

      await manager.exportCSV();

      expect(mockShowInfoModal).toHaveBeenCalledWith(
        'Error',
        'Error al exportar el CSV: Permission denied'
      );
    });

    test('should not export when user cancels folder picker', async () => {
      mockShowOpenDialog.mockResolvedValue({ canceled: true });

      await manager.exportCSV();

      expect(mockElectronAPI.exportCSV).not.toHaveBeenCalled();
    });
  });

  describe('exportImagesByID()', () => {
    beforeEach(() => {
      mockGetters.getCurrentUsers.mockReturnValue([
        { id: 1, name: 'User 1', image_path: '/img1.jpg' }
      ]);
    });

    test('should not export when project is closed', async () => {
      mockGetters.getProjectOpen.mockReturnValue(false);

      await manager.exportImagesByID();

      expect(mockShowOpenDialog).not.toHaveBeenCalled();
    });

    test('should show export options modal', async () => {
      mockShowOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['/export/path']
      });

      mockExportOptionsModal.show.mockResolvedValue(null); // User cancelled

      await manager.exportImagesByID();

      expect(mockExportOptionsModal.show).toHaveBeenCalled();
    });

    test('should not export when user cancels options modal', async () => {
      mockShowOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['/export/path']
      });

      mockExportOptionsModal.show.mockResolvedValue(null);

      await manager.exportImagesByID();

      expect(mockElectronAPI.exportImages).not.toHaveBeenCalled();
    });

    test('should export with copy mode', async () => {
      mockShowOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['/export/path']
      });

      mockExportOptionsModal.show.mockResolvedValue({
        mode: 'copy',
        resize: null
      });

      mockElectronAPI.exportImages.mockResolvedValue({ success: true });

      await manager.exportImagesByID();

      expect(mockShowProgressModal).toHaveBeenCalledWith('Exportando Imágenes', 'Procesando archivos...');
      expect(mockElectronAPI.exportImages).toHaveBeenCalledWith(
        '/export/path',
        expect.any(Array),
        {
          copyOriginal: true,
          resizeEnabled: false,
          boxSize: null,
          maxSizeKB: null
        }
      );
      expect(mockCloseProgressModal).toHaveBeenCalled();
    });

    test('should export with resize mode', async () => {
      mockShowOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['/export/path']
      });

      mockExportOptionsModal.show.mockResolvedValue({
        mode: 'resize',
        resize: { boxSize: 800, maxSize: 500 }
      });

      mockElectronAPI.exportImages.mockResolvedValue({ success: true });

      await manager.exportImagesByID();

      expect(mockElectronAPI.exportImages).toHaveBeenCalledWith(
        '/export/path',
        expect.any(Array),
        {
          copyOriginal: false,
          resizeEnabled: true,
          boxSize: 800,
          maxSizeKB: 500
        }
      );
    });

    test('should handle export error', async () => {
      mockShowOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['/export/path']
      });

      mockExportOptionsModal.show.mockResolvedValue({
        mode: 'copy',
        resize: null
      });

      mockElectronAPI.exportImages.mockResolvedValue({
        success: false,
        error: 'Disk full'
      });

      await manager.exportImagesByID();

      expect(mockShowInfoModal).toHaveBeenCalledWith(
        'Error',
        'Error al exportar imágenes: Disk full'
      );
    });
  });

  describe('exportImagesByName()', () => {
    beforeEach(() => {
      mockGetters.getCurrentUsers.mockReturnValue([
        { id: 1, name: 'User 1', image_path: '/img1.jpg' }
      ]);
    });

    test('should call exportImagesName API', async () => {
      mockShowOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['/export/path']
      });

      mockExportOptionsModal.show.mockResolvedValue({
        mode: 'copy',
        resize: null
      });

      mockElectronAPI.exportImagesName.mockResolvedValue({ success: true });

      await manager.exportImagesByName();

      expect(mockElectronAPI.exportImagesName).toHaveBeenCalledWith(
        '/export/path',
        expect.any(Array),
        expect.any(Object)
      );
    });
  });

  describe('exportToRepository()', () => {
    beforeEach(() => {
      mockGetters.getCurrentUsers.mockReturnValue([
        { id: 1, name: 'User 1', image_path: '/img1.jpg' }
      ]);
    });

    test('should not export when project is closed', async () => {
      mockGetters.getProjectOpen.mockReturnValue(false);

      await manager.exportToRepository();

      expect(mockExportOptionsModal.show).not.toHaveBeenCalled();
    });

    test('should show export options modal', async () => {
      mockExportOptionsModal.show.mockResolvedValue(null);

      await manager.exportToRepository();

      expect(mockExportOptionsModal.show).toHaveBeenCalled();
    });

    test('should export successfully', async () => {
      mockExportOptionsModal.show.mockResolvedValue({
        mode: 'resize',
        resize: { boxSize: 800, maxSize: 500 }
      });

      mockElectronAPI.exportToRepository.mockResolvedValue({
        success: true,
        results: {
          total: 10,
          exported: 9,
          errors: [{ user: 'User 1', error: 'Failed' }]
        }
      });

      const onExportComplete = jest.fn();
      manager.onExportComplete = onExportComplete;

      await manager.exportToRepository();

      expect(mockShowProgressModal).toHaveBeenCalledWith('Exportando al Depósito', 'Procesando archivos...');
      expect(mockElectronAPI.exportToRepository).toHaveBeenCalled();
      expect(mockCloseProgressModal).toHaveBeenCalled();
      expect(mockShowInfoModal).toHaveBeenCalledWith(
        'Exportación completada',
        expect.stringContaining('Total de usuarios')
      );
      expect(onExportComplete).toHaveBeenCalled();
    });

    test('should show error details in message', async () => {
      mockExportOptionsModal.show.mockResolvedValue({
        mode: 'copy',
        resize: null
      });

      const errors = Array(10).fill(null).map((_, i) => ({
        user: `User ${i}`,
        error: `Error ${i}`
      }));

      mockElectronAPI.exportToRepository.mockResolvedValue({
        success: true,
        results: {
          total: 20,
          exported: 10,
          errors: errors
        }
      });

      await manager.exportToRepository();

      const message = mockShowInfoModal.mock.calls[0][1];
      expect(message).toContain('Errores (10)');
      expect(message).toContain('y 5 más'); // Shows first 5 + "and 5 more"
    });

    test('should handle export error', async () => {
      mockExportOptionsModal.show.mockResolvedValue({
        mode: 'copy',
        resize: null
      });

      mockElectronAPI.exportToRepository.mockResolvedValue({
        success: false,
        error: 'Network error'
      });

      await manager.exportToRepository();

      expect(mockShowInfoModal).toHaveBeenCalledWith(
        'Error',
        'Error al exportar imágenes: Network error'
      );
    });
  });

  describe('convertOptionsToAPI()', () => {
    test('should convert copy mode', () => {
      const options = {
        mode: 'copy',
        resize: null
      };

      const result = manager.convertOptionsToAPI(options);

      expect(result).toEqual({
        copyOriginal: true,
        resizeEnabled: false,
        boxSize: null,
        maxSizeKB: null
      });
    });

    test('should convert resize mode', () => {
      const options = {
        mode: 'resize',
        resize: { boxSize: 1024, maxSize: 600 }
      };

      const result = manager.convertOptionsToAPI(options);

      expect(result).toEqual({
        copyOriginal: false,
        resizeEnabled: true,
        boxSize: 1024,
        maxSizeKB: 600
      });
    });
  });
});
