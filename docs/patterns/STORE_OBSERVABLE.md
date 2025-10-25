# Store Observable Pattern

## Overview

The Store Observable is a **centralized, reactive state management** system inspired by Redux and RxJS. It provides a single source of truth for application state with automatic notification of subscribers when state changes.

## Location

`src/renderer/core/store.js`

## Core Concepts

### 1. Single Source of Truth

All application state lives in one place:

```javascript
{
  project: { isOpen: false, folderPath: null, ... },
  users: { allUsers: [], selectedUser: null, ... },
  groups: { allGroups: [], selectedGroup: null, ... },
  images: { capturedImages: [], repositoryImages: [], ... }
}
```

### 2. Reactive Subscriptions

Components subscribe to specific state namespaces and are notified automatically when that state changes:

```javascript
store.subscribe('users', (state) => {
  // Called whenever users state changes
  updateUI(state.users);
});
```

### 3. Immutable Updates

State is never mutated directly. Always use `setState()`:

```javascript
// ❌ Wrong - mutates state
store.state.users.selectedUser = user;

// ✅ Correct - creates new state
store.setState({
  users: {
    ...store.getState().users,
    selectedUser: user
  }
});
```

## API Reference

### `setState(updates)`

Updates state and notifies relevant subscribers.

**Parameters**:
- `updates` (object): Partial state updates

**Example**:
```javascript
store.setState({
  users: {
    allUsers: [...],
    filteredUsers: [...],
    selectedUser: user
  }
});
```

### `getState(namespace?)`

Gets current state or a specific namespace.

**Parameters**:
- `namespace` (string, optional): State namespace (e.g., 'users')

**Returns**: Current state or namespace value

**Example**:
```javascript
// Get all state
const state = store.getState();

// Get specific namespace
const usersState = store.getState('users');
```

### `subscribe(namespace, callback)`

Subscribes to state changes in a specific namespace.

**Parameters**:
- `namespace` (string): State namespace to watch
- `callback` (function): Called with full state when namespace changes

**Returns**: Unsubscribe function

**Example**:
```javascript
const unsubscribe = store.subscribe('users', (state) => {
  console.log('Users changed:', state.users);
});

// Later, cleanup
unsubscribe();
```

### `clearState()`

Resets all state to initial values.

**Example**:
```javascript
store.clearState();
```

## State Structure

### Complete State Schema

```javascript
{
  // Project state
  project: {
    isOpen: boolean,
    folderPath: string | null,
    xmlFilePath: string | null,
    ingestFolderPath: string | null,
    importsFolderPath: string | null
  },

  // User state
  users: {
    allUsers: Array<User>,
    filteredUsers: Array<User>,
    selectedUser: User | null,
    selectedUserId: number | null,
    duplicatesMap: Map<string, Array<number>>
  },

  // Group state
  groups: {
    allGroups: Array<Group>,
    selectedGroup: Group | null
  },

  // Image state
  images: {
    capturedImages: Array<Image>,
    repositoryImages: Array<Image>,
    selectedImage: Image | null,
    currentIndex: number
  }
}
```

### Type Definitions

```javascript
// User
{
  id: number,
  first_name: string,
  last_name1: string,
  last_name2: string,
  nia: string,
  document: string,
  birthdate: string,
  group_code: string,
  user_type: 'alumno' | 'docente' | 'no_docente',
  image_path: string | null
}

// Group
{
  code: string,
  name: string,
  user_count: number
}

// Image
{
  filename: string,
  path: string,
  timestamp: string,
  userId: number | null,
  tags: Array<string>
}
```

## Usage Patterns

### Pattern 1: Component Initialization

```javascript
class MyComponent extends BaseModal {
  init() {
    super.init();

    // Subscribe to relevant state
    this.subscribeToStore('users', (state) => {
      this.updateUserList(state.users.allUsers);
      this.updateSelectedUser(state.users.selectedUser);
    });

    // Initial render
    const state = store.getState();
    this.render(state);
  }

  updateUserList(users) {
    // Update UI with users
  }

  updateSelectedUser(user) {
    // Update UI with selected user
  }
}
```

### Pattern 2: Service Response Handling

```javascript
async function loadUsers() {
  try {
    const result = await userService.getUsers();

    if (result.success) {
      // Update store - triggers all subscribers
      store.setState({
        users: {
          allUsers: result.users,
          filteredUsers: result.users,
          selectedUser: null,
          selectedUserId: null,
          duplicatesMap: new Map()
        }
      });
    }
  } catch (error) {
    console.error('Failed to load users:', error);
  }
}
```

### Pattern 3: Partial State Updates

```javascript
// Only update specific fields
store.setState({
  users: {
    ...store.getState().users,  // Preserve other fields
    selectedUser: user,          // Update only this field
    selectedUserId: user.id
  }
});
```

### Pattern 4: Multiple Namespace Updates

```javascript
// Update multiple namespaces at once
store.setState({
  users: {
    allUsers: users,
    filteredUsers: users
  },
  groups: {
    allGroups: groups,
    selectedGroup: null
  },
  project: {
    isOpen: true,
    folderPath: path
  }
});
```

## Best Practices

### 1. ✅ Always Use setState for Updates

```javascript
// ❌ Wrong
store.state.users.selectedUser = user;

// ✅ Correct
store.setState({
  users: {
    ...store.getState().users,
    selectedUser: user
  }
});
```

### 2. ✅ Clean Up Subscriptions

```javascript
class MyComponent {
  init() {
    // Store reference
    this.unsubscribeUser = store.subscribe('users', this.handleUserChange);
  }

  destroy() {
    // Clean up
    if (this.unsubscribeUser) {
      this.unsubscribeUser();
    }
  }
}
```

### 3. ✅ Use Namespace-Specific Subscriptions

```javascript
// ❌ Don't subscribe to everything
store.subscribe('*', (state) => {
  // Called on ANY state change - wasteful!
});

// ✅ Subscribe to what you need
store.subscribe('users', (state) => {
  // Only called when users change
});
```

### 4. ✅ Preserve Unrelated State

```javascript
// ❌ Wrong - loses other users fields
store.setState({
  users: {
    selectedUser: user
  }
});

// ✅ Correct - preserves other fields
store.setState({
  users: {
    ...store.getState().users,
    selectedUser: user
  }
});
```

## Common Patterns

### Initialize State on App Load

```javascript
document.addEventListener('DOMContentLoaded', () => {
  // Initialize empty state
  store.setState({
    project: {
      isOpen: false,
      folderPath: null,
      xmlFilePath: null
    },
    users: {
      allUsers: [],
      filteredUsers: [],
      selectedUser: null
    },
    groups: {
      allGroups: [],
      selectedGroup: null
    }
  });
});
```

### Reset State on Project Close

```javascript
function closeProject() {
  store.clearState();

  // Or manually reset
  store.setState({
    project: { isOpen: false, folderPath: null },
    users: { allUsers: [], filteredUsers: [], selectedUser: null },
    groups: { allGroups: [], selectedGroup: null }
  });
}
```

### Batch Multiple Updates

```javascript
// ❌ Wrong - triggers subscribers multiple times
store.setState({ users: { allUsers: users } });
store.setState({ users: { filteredUsers: filtered } });
store.setState({ users: { selectedUser: user } });

// ✅ Correct - single update, triggers once
store.setState({
  users: {
    ...store.getState().users,
    allUsers: users,
    filteredUsers: filtered,
    selectedUser: user
  }
});
```

## Testing

### Mock Store in Tests

```javascript
const { Store } = require('../../../src/renderer/core/store');

describe('MyComponent', () => {
  let testStore;
  let component;

  beforeEach(() => {
    testStore = new Store();
    component = new MyComponent(testStore);
  });

  test('should update on state change', () => {
    const spy = jest.spyOn(component, 'updateUI');

    testStore.setState({
      users: { allUsers: [{ id: 1, name: 'Test' }] }
    });

    expect(spy).toHaveBeenCalled();
  });
});
```

### Test Subscriptions

```javascript
test('should notify subscribers', () => {
  const callback = jest.fn();

  store.subscribe('users', callback);

  store.setState({
    users: { allUsers: [] }
  });

  expect(callback).toHaveBeenCalledWith(
    expect.objectContaining({
      users: { allUsers: [] }
    })
  );
});
```

## Performance Considerations

### Subscription Granularity

```javascript
// ✅ Good - specific subscription
store.subscribe('users', (state) => {
  // Only called when users change
});

// ⚠️ Be careful - called on any change
store.subscribe('*', (state) => {
  // Called for ANY state update
});
```

### Minimize Rerenders

```javascript
// ❌ Creates new object every time
store.setState({
  users: {
    allUsers: [...store.getState().users.allUsers]  // Triggers rerender even if no change
  }
});

// ✅ Only update if actually changed
if (users !== store.getState().users.allUsers) {
  store.setState({
    users: {
      ...store.getState().users,
      allUsers: users
    }
  });
}
```

## Troubleshooting

### Issue: Subscribers Not Being Called

**Problem**: Updated state but UI didn't update

**Solution**: Ensure you're using `setState()`, not direct mutation

```javascript
// ❌ This won't trigger subscribers
store.state.users.selectedUser = user;

// ✅ This will trigger subscribers
store.setState({
  users: {
    ...store.getState().users,
    selectedUser: user
  }
});
```

### Issue: Memory Leaks from Subscriptions

**Problem**: Subscriptions not cleaned up

**Solution**: Always unsubscribe

```javascript
class Component {
  init() {
    this.unsubscribe = store.subscribe('users', this.handler);
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();  // Clean up!
    }
  }
}
```

### Issue: Lost State After Update

**Problem**: Other fields disappear after update

**Solution**: Always spread existing state

```javascript
// ❌ Loses allUsers and filteredUsers
store.setState({
  users: {
    selectedUser: user
  }
});

// ✅ Preserves all fields
store.setState({
  users: {
    ...store.getState().users,
    selectedUser: user
  }
});
```

## Related Patterns

- [Service Pattern](./SERVICE_PATTERN.md) - Services update store after IPC calls
- [BaseModal Lifecycle](./BASE_MODAL.md) - BaseModal tracks store subscriptions

## Examples

See `src/renderer/_poc/poc-main.js` for complete working examples.

---

**Last Updated**: 2025-10-25
