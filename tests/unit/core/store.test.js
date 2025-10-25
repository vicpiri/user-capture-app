/**
 * Tests for Store Observable
 */

const { Store } = require('../../../src/renderer/core/store');

describe('Store Observable', () => {
  let store;

  beforeEach(() => {
    store = new Store();
  });

  afterEach(() => {
    store.clearSubscriptions();
  });

  describe('getState', () => {
    test('should return entire state when no key provided', () => {
      const state = store.getState();

      expect(state).toHaveProperty('project');
      expect(state).toHaveProperty('users');
      expect(state).toHaveProperty('groups');
      expect(state).toHaveProperty('images');
      expect(state).toHaveProperty('repository');
      expect(state).toHaveProperty('camera');
      expect(state).toHaveProperty('ui');
      expect(state).toHaveProperty('app');
    });

    test('should return specific state slice when key provided', () => {
      const usersState = store.getState('users');

      expect(usersState).toHaveProperty('allUsers');
      expect(usersState).toHaveProperty('filteredUsers');
      expect(usersState).toHaveProperty('selectedUser');
      expect(usersState).toHaveProperty('selectedUserId');
      expect(usersState).toHaveProperty('duplicatesMap');
    });

    test('should return immutable copy of state', () => {
      const state1 = store.getState('users');
      const state2 = store.getState('users');

      expect(state1).not.toBe(state2); // Different references
      expect(state1).toEqual(state2); // Same values
    });

    test('should return undefined for non-existent key', () => {
      const state = store.getState('nonExistent');
      expect(state).toBeUndefined();
    });
  });

  describe('setState', () => {
    test('should update state', () => {
      store.setState({
        users: { selectedUser: { id: 1, nombre: 'Test' } }
      });

      const usersState = store.getState('users');
      expect(usersState.selectedUser).toEqual({ id: 1, nombre: 'Test' });
    });

    test('should merge with existing state', () => {
      store.setState({
        users: { selectedUser: { id: 1 } }
      });

      store.setState({
        users: { selectedUserId: 1 }
      });

      const usersState = store.getState('users');
      expect(usersState.selectedUser).toEqual({ id: 1 });
      expect(usersState.selectedUserId).toBe(1);
    });

    test('should notify subscribers of changed keys', () => {
      const callback = jest.fn();
      store.subscribe('users', callback);

      store.setState({
        users: { selectedUserId: 1 }
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ selectedUserId: 1 }),
        expect.any(Object)
      );
    });
  });

  describe('subscribe', () => {
    test('should register subscriber for single key', () => {
      const callback = jest.fn();
      const unsubscribe = store.subscribe('users', callback);

      expect(typeof unsubscribe).toBe('function');
      expect(store.getSubscriberCount('users')).toBe(1);
    });

    test('should register subscriber for multiple keys', () => {
      const callback = jest.fn();
      store.subscribe(['users', 'groups'], callback);

      expect(store.getSubscriberCount('users')).toBe(1);
      expect(store.getSubscriberCount('groups')).toBe(1);
    });

    test('should notify subscriber on state change', () => {
      const callback = jest.fn();
      store.subscribe('users', callback);

      store.setState({
        users: { selectedUserId: 1 }
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    test('should not notify subscriber for different key', () => {
      const callback = jest.fn();
      store.subscribe('users', callback);

      store.setState({
        groups: { selectedGroup: { id: 1 } }
      });

      expect(callback).not.toHaveBeenCalled();
    });

    test('should throw error if callback is not a function', () => {
      expect(() => {
        store.subscribe('users', 'not a function');
      }).toThrow('Callback must be a function');
    });
  });

  describe('unsubscribe', () => {
    test('should remove subscriber', () => {
      const callback = jest.fn();
      const unsubscribe = store.subscribe('users', callback);

      unsubscribe();

      store.setState({
        users: { selectedUserId: 1 }
      });

      expect(callback).not.toHaveBeenCalled();
      expect(store.getSubscriberCount('users')).toBe(0);
    });

    test('should remove subscriber from multiple keys', () => {
      const callback = jest.fn();
      const unsubscribe = store.subscribe(['users', 'groups'], callback);

      unsubscribe();

      expect(store.getSubscriberCount('users')).toBe(0);
      expect(store.getSubscriberCount('groups')).toBe(0);
    });
  });

  describe('notify', () => {
    test('should notify all subscribers of a key', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      store.subscribe('users', callback1);
      store.subscribe('users', callback2);

      store.notify(['users']);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    test('should handle errors in callbacks gracefully', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = jest.fn();

      store.subscribe('users', errorCallback);
      store.subscribe('users', normalCallback);

      // Should not throw
      expect(() => {
        store.notify(['users']);
      }).not.toThrow();

      // Both should have been called
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });

    test('should pass partial state and full state to callback', () => {
      const callback = jest.fn();
      store.subscribe('users', callback);

      store.setState({
        users: { selectedUserId: 1 }
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ selectedUserId: 1 }), // Partial state
        expect.objectContaining({ users: expect.any(Object), groups: expect.any(Object) }) // Full state
      );
    });
  });

  describe('clearSubscriptions', () => {
    test('should clear all subscriptions', () => {
      store.subscribe('users', jest.fn());
      store.subscribe('groups', jest.fn());

      store.clearSubscriptions();

      expect(store.getSubscriberCount('users')).toBe(0);
      expect(store.getSubscriberCount('groups')).toBe(0);
    });
  });

  describe('setDebug', () => {
    test('should enable debug mode', () => {
      store.setDebug(true);
      expect(store.debug).toBe(true);
    });

    test('should disable debug mode', () => {
      store.setDebug(false);
      expect(store.debug).toBe(false);
    });
  });

  describe('getSubscriberCount', () => {
    test('should return 0 for key with no subscribers', () => {
      expect(store.getSubscriberCount('users')).toBe(0);
    });

    test('should return correct count', () => {
      store.subscribe('users', jest.fn());
      store.subscribe('users', jest.fn());

      expect(store.getSubscriberCount('users')).toBe(2);
    });
  });
});
