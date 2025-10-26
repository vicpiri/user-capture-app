/**
 * Tests for SelectionModeManager
 */

const { SelectionModeManager } = require('../../../src/renderer/components/SelectionModeManager');

describe('SelectionModeManager', () => {
  let manager;
  let mockCallbacks;
  let mockDOM;

  beforeEach(() => {
    // Mock callbacks
    mockCallbacks = {
      onSelectionChange: jest.fn(),
      getDisplayedUsers: jest.fn(() => [
        { id: 1, first_name: 'User', last_name1: '1' },
        { id: 2, first_name: 'User', last_name1: '2' },
        { id: 3, first_name: 'User', last_name1: '3' }
      ]),
      reRenderUsers: jest.fn()
    };

    // Mock DOM elements
    mockDOM = {
      selectedUserInfo: {
        textContent: ''
      },
      tableHeader: {
        querySelector: jest.fn(),
        insertBefore: jest.fn(),
        firstChild: {}
      }
    };

    // Create manager instance
    manager = new SelectionModeManager({
      ...mockCallbacks,
      ...mockDOM
    });
  });

  describe('Initialization', () => {
    test('should initialize with inactive state', () => {
      expect(manager.isSelectionMode()).toBe(false);
      expect(manager.getSelectedUsers().size).toBe(0);
    });

    test('should store configuration', () => {
      expect(manager.onSelectionChange).toBe(mockCallbacks.onSelectionChange);
      expect(manager.selectedUserInfo).toBe(mockDOM.selectedUserInfo);
    });
  });

  describe('enable()', () => {
    test('should enable selection mode without initial user', () => {
      manager.enable();

      expect(manager.isSelectionMode()).toBe(true);
      expect(manager.getSelectedUsers().size).toBe(0);
      expect(mockCallbacks.reRenderUsers).toHaveBeenCalled();
      expect(mockCallbacks.onSelectionChange).toHaveBeenCalledWith(true, expect.any(Set));
    });

    test('should enable with initial user selected', () => {
      manager.enable(1);

      expect(manager.isSelectionMode()).toBe(true);
      expect(manager.getSelectedUsers().has(1)).toBe(true);
      expect(manager.getSelectedUsers().size).toBe(1);
    });

    test('should clear previous selections when enabling', () => {
      manager.selectedUsers.add(5);
      manager.selectedUsers.add(6);

      manager.enable(1);

      expect(manager.getSelectedUsers().has(5)).toBe(false);
      expect(manager.getSelectedUsers().has(6)).toBe(false);
      expect(manager.getSelectedUsers().has(1)).toBe(true);
    });

    test('should update table header when enabling', () => {
      mockDOM.tableHeader.querySelector.mockReturnValue(null);

      manager.enable();

      expect(mockDOM.tableHeader.insertBefore).toHaveBeenCalled();
    });
  });

  describe('disable()', () => {
    beforeEach(() => {
      manager.enable(1);
      jest.clearAllMocks();
    });

    test('should disable selection mode', () => {
      manager.disable();

      expect(manager.isSelectionMode()).toBe(false);
      expect(manager.getSelectedUsers().size).toBe(0);
      expect(mockCallbacks.reRenderUsers).toHaveBeenCalled();
      expect(mockCallbacks.onSelectionChange).toHaveBeenCalledWith(false, expect.any(Set));
    });

    test('should clear all selected users', () => {
      manager.selectedUsers.add(2);
      manager.selectedUsers.add(3);

      manager.disable();

      expect(manager.getSelectedUsers().size).toBe(0);
    });

    test('should remove table header checkbox', () => {
      const mockCheckboxTh = { remove: jest.fn() };
      mockDOM.tableHeader.querySelector.mockReturnValue(mockCheckboxTh);

      manager.disable();

      expect(mockCheckboxTh.remove).toHaveBeenCalled();
    });
  });

  describe('toggleSelection()', () => {
    beforeEach(() => {
      manager.enable();
      jest.clearAllMocks();
    });

    test('should add user when checked', () => {
      manager.toggleSelection(1, true);

      expect(manager.getSelectedUsers().has(1)).toBe(true);
      expect(mockCallbacks.onSelectionChange).toHaveBeenCalled();
    });

    test('should remove user when unchecked', () => {
      manager.selectedUsers.add(1);

      manager.toggleSelection(1, false);

      expect(manager.getSelectedUsers().has(1)).toBe(false);
    });

    test('should auto-disable when last user is deselected', () => {
      manager.selectedUsers.add(1);

      manager.toggleSelection(1, false);

      expect(manager.isSelectionMode()).toBe(false);
    });

    test('should not auto-disable when users remain selected', () => {
      manager.selectedUsers.add(1);
      manager.selectedUsers.add(2);

      manager.toggleSelection(1, false);

      expect(manager.isSelectionMode()).toBe(true);
      expect(manager.getSelectedUsers().has(2)).toBe(true);
    });
  });

  describe('selectAll()', () => {
    beforeEach(() => {
      manager.enable();
      jest.clearAllMocks();
    });

    test('should select all displayed users', () => {
      manager.selectAll();

      expect(manager.getSelectedUsers().size).toBe(3);
      expect(manager.getSelectedUsers().has(1)).toBe(true);
      expect(manager.getSelectedUsers().has(2)).toBe(true);
      expect(manager.getSelectedUsers().has(3)).toBe(true);
      expect(mockCallbacks.reRenderUsers).toHaveBeenCalled();
      expect(mockCallbacks.onSelectionChange).toHaveBeenCalled();
    });
  });

  describe('deselectAll()', () => {
    beforeEach(() => {
      manager.enable(1);
      manager.selectedUsers.add(2);
      manager.selectedUsers.add(3);
      jest.clearAllMocks();
    });

    test('should deselect all users', () => {
      manager.deselectAll();

      expect(manager.getSelectedUsers().size).toBe(0);
      expect(mockCallbacks.reRenderUsers).toHaveBeenCalled();
    });

    test('should not trigger onSelectionChange', () => {
      manager.deselectAll();

      expect(mockCallbacks.onSelectionChange).not.toHaveBeenCalled();
    });
  });

  describe('updateSelectionInfo()', () => {
    test('should show selection count when in selection mode', () => {
      manager.enable(1);
      manager.selectedUsers.add(2);
      manager.selectedUsers.add(3);

      manager.updateSelectionInfo();

      expect(mockDOM.selectedUserInfo.textContent).toBe('3 usuario(s) seleccionado(s)');
    });

    test('should show current user name when not in selection mode', () => {
      manager.setCurrentSelectedUser({
        first_name: 'John',
        last_name1: 'Doe',
        last_name2: 'Smith'
      });

      manager.updateSelectionInfo();

      expect(mockDOM.selectedUserInfo.textContent).toBe('John Doe Smith');
    });

    test('should show dash when no selection', () => {
      manager.updateSelectionInfo();

      expect(mockDOM.selectedUserInfo.textContent).toBe('-');
    });

    test('should handle user without last_name2', () => {
      manager.setCurrentSelectedUser({
        first_name: 'John',
        last_name1: 'Doe',
        last_name2: null
      });

      manager.updateSelectionInfo();

      expect(mockDOM.selectedUserInfo.textContent).toContain('John Doe');
    });
  });

  describe('setCurrentSelectedUser()', () => {
    test('should set current user and update info', () => {
      const user = {
        first_name: 'Jane',
        last_name1: 'Smith',
        last_name2: ''
      };

      manager.setCurrentSelectedUser(user);

      expect(manager.currentSelectedUser).toBe(user);
      expect(mockDOM.selectedUserInfo.textContent).toContain('Jane Smith');
    });

    test('should not update info when in selection mode', () => {
      manager.enable(1);
      const oldText = mockDOM.selectedUserInfo.textContent;

      manager.setCurrentSelectedUser({
        first_name: 'Test',
        last_name1: 'User',
        last_name2: ''
      });

      expect(mockDOM.selectedUserInfo.textContent).toBe(oldText);
    });
  });

  describe('showContextMenu()', () => {
    let mockEvent;

    beforeEach(() => {
      mockEvent = {
        clientX: 100,
        clientY: 200
      };

      // Mock document.body
      document.body.appendChild = jest.fn();
      document.addEventListener = jest.fn();
    });

    test('should create context menu when not in selection mode', () => {
      const user = { id: 1 };

      manager.showContextMenu(mockEvent, user);

      expect(document.body.appendChild).toHaveBeenCalled();
    });

    test('should show "Seleccionar" option when not in selection mode', () => {
      const user = { id: 1 };

      manager.showContextMenu(mockEvent, user);

      const menu = document.body.appendChild.mock.calls[0][0];
      expect(menu.textContent).toContain('Seleccionar');
    });

    test('should show "Deseleccionar todo" when in selection mode', () => {
      manager.enable(1);
      const user = { id: 1 };

      manager.showContextMenu(mockEvent, user);

      const menu = document.body.appendChild.mock.calls[0][0];
      expect(menu.textContent).toContain('Deseleccionar todo');
    });

    test('should remove existing menu before showing new one', () => {
      const existingMenu = document.createElement('div');
      existingMenu.className = 'context-menu';
      existingMenu.remove = jest.fn();

      document.querySelector = jest.fn(() => existingMenu);

      manager.showContextMenu(mockEvent, { id: 1 });

      expect(existingMenu.remove).toHaveBeenCalled();
    });
  });

  describe('clear()', () => {
    test('should reset all state', () => {
      manager.enable(1);
      manager.selectedUsers.add(2);
      manager.setCurrentSelectedUser({ first_name: 'Test' });

      manager.clear();

      expect(manager.isSelectionMode()).toBe(false);
      expect(manager.getSelectedUsers().size).toBe(0);
      expect(manager.currentSelectedUser).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing DOM elements gracefully', () => {
      const managerNoDom = new SelectionModeManager({
        ...mockCallbacks
      });

      expect(() => {
        managerNoDom.enable();
        managerNoDom.updateSelectionInfo();
        managerNoDom.updateTableHeader();
      }).not.toThrow();
    });

    test('should handle empty displayed users', () => {
      mockCallbacks.getDisplayedUsers.mockReturnValue([]);

      manager.enable();
      manager.selectAll();

      expect(manager.getSelectedUsers().size).toBe(0);
    });
  });
});
