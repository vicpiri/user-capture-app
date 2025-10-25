# Renderer Architecture Documentation

## Overview

This document describes the refactored architecture of the renderer process in the User Capture App. The refactoring was completed in 3 phases to improve maintainability, testability, and prevent memory leaks.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Patterns](#core-patterns)
3. [Directory Structure](#directory-structure)
4. [Implementation Phases](#implementation-phases)
5. [Testing Strategy](#testing-strategy)
6. [Usage Examples](#usage-examples)
7. [Migration Guide](#migration-guide)

---

## Architecture Overview

The renderer architecture follows a **component-based, reactive pattern** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                    Renderer Process                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │  Components  │───▶│   Services   │───▶│    IPC    │ │
│  │   (UI Logic) │    │  (Business)  │    │  (Main)   │ │
│  └──────────────┘    └──────────────┘    └───────────┘ │
│         │                    │                           │
│         │                    │                           │
│         ▼                    ▼                           │
│  ┌──────────────────────────────────┐                   │
│  │        Store Observable          │                   │
│  │    (Centralized State)           │                   │
│  └──────────────────────────────────┘                   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Unidirectional Data Flow**: User Action → Service → Store → UI Update
2. **Separation of Concerns**: Components handle UI, Services handle business logic
3. **Reactive State Management**: Store notifies subscribers of state changes
4. **Memory Leak Prevention**: Automatic cleanup via lifecycle management
5. **Testability**: All components and services are independently testable

---

## Core Patterns

### 1. Store Observable Pattern

**Purpose**: Centralized, reactive state management

**Location**: `src/renderer/core/store.js`

**Key Features**:
- Single source of truth for application state
- Subscription-based reactivity
- Namespace-based state organization
- Automatic listener management

**Example**:
```javascript
const { store } = require('./core/store');

// Subscribe to state changes
const unsubscribe = store.subscribe('users', (state) => {
  console.log('Users updated:', state.users);
});

// Update state (triggers subscribers)
store.setState({
  users: {
    allUsers: [...],
    selectedUser: null
  }
});

// Cleanup
unsubscribe();
```

**State Structure**:
```javascript
{
  project: {
    isOpen: boolean,
    folderPath: string,
    xmlFilePath: string
  },
  users: {
    allUsers: Array,
    filteredUsers: Array,
    selectedUser: object|null
  },
  groups: {
    allGroups: Array,
    selectedGroup: object|null
  },
  images: {
    capturedImages: Array,
    repositoryImages: Array
  }
}
```

### 2. Service Pattern

**Purpose**: Abstraction layer for IPC communication

**Location**: `src/renderer/services/`

**Key Features**:
- Wraps window.electronAPI calls
- Provides consistent error handling
- Centralizes logging
- Type-safe interfaces (via JSDoc)

**Example**:
```javascript
const { projectService } = require('./services/projectService');

// Clean async/await API
const result = await projectService.createProject({
  folderPath: '/path/to/project',
  xmlFilePath: '/path/to/file.xml'
});

if (result.success) {
  // Handle success
}
```

**Available Services**:
- `projectService` - Project management
- `userService` - User CRUD operations
- `groupService` - Group management
- `imageService` - Image operations

### 3. BaseModal Lifecycle

**Purpose**: Automatic memory leak prevention for modals

**Location**: `src/renderer/core/BaseModal.js`

**Key Features**:
- Automatic event listener tracking
- Automatic store subscription tracking
- Lifecycle methods: init() / destroy()
- Promise-based API

**Example**:
```javascript
class MyModal extends BaseModal {
  constructor() {
    super('my-modal-id');
  }

  init() {
    super.init();

    // Tracked automatically - no manual cleanup needed
    this.addEventListener(button, 'click', () => {});

    // Subscriptions also tracked
    this.subscribeToStore('users', (state) => {});
  }
}

// Usage
const modal = new MyModal();
modal.init();

// Automatic cleanup when done
modal.destroy(); // Removes all listeners and subscriptions
```

---

## Directory Structure

```
src/renderer/
├── core/                          # Core architecture
│   ├── BaseModal.js              # Base class for modals
│   ├── store.js                  # Observable store
│   └── index.js                  # Core exports
│
├── services/                      # Service layer (IPC wrappers)
│   ├── projectService.js         # Project operations
│   ├── userService.js            # User CRUD
│   ├── groupService.js           # Group management
│   ├── imageService.js           # Image operations
│   └── index.js                  # Service exports
│
├── components/                    # UI Components
│   └── modals/                   # Modal dialogs
│       ├── NewProjectModal.js    # Project creation
│       ├── ConfirmModal.js       # Confirmation dialog
│       ├── InfoModal.js          # Info/error messages
│       ├── ExportOptionsModal.js # Export settings
│       ├── AddTagModal.js        # Image tagging
│       └── index.js              # Modal exports
│
├── _poc/                          # Proof of Concept files
│   └── ...                       # POC test files
│
├── renderer.js                    # Main renderer entry point
├── camera.js                      # Camera window
├── image-grid.js                 # Image grid window
└── repository-grid.js            # Repository grid window
```

---

## Implementation Phases

### Phase 1: Architecture Foundation ✅

**Goal**: Establish core patterns

**Deliverables**:
- Store Observable implementation
- Service Pattern implementation
- BaseModal lifecycle management
- POC validation
- Unit tests (102 tests)

**Files Created**:
- `src/renderer/core/store.js`
- `src/renderer/core/BaseModal.js`
- `src/renderer/services/*.js`
- `tests/unit/core/*.test.js`

### Phase 2: Modal Components ✅

**Goal**: Migrate all modals to new architecture

**Deliverables**:
- 5 modal components
- Promise-based modal API
- Automatic lifecycle management
- Unit tests (60 tests)

**Files Created**:
- `src/renderer/components/modals/*.js`
- `tests/unit/components/modals/*.test.js`

### Phase 3: Integration ✅

**Goal**: Integrate modals into renderer.js

**Deliverables**:
- Modal instance management
- Callback → async/await conversion
- Event listener cleanup
- Integration tests (19 tests)

**Files Modified**:
- `src/renderer/renderer.js`
- `src/renderer/components/modals/NewProjectModal.js`

**Files Created**:
- `tests/unit/integration/modalIntegration.test.js`

### Phase 4: Component Extraction (Future)

**Goal**: Extract remaining logic from renderer.js

**Planned Components**:
- UserListComponent
- ImageManagerComponent
- Additional services as needed

---

## Testing Strategy

### Test Coverage Overview

| Category | Tests | Coverage |
|----------|-------|----------|
| Core (Store, Services, BaseModal) | 102 | ✅ 100% |
| Modal Components | 60 | ✅ 100% |
| Integration | 19 | ✅ 100% |
| UserService | 14 | ✅ 100% |
| **Total** | **194** | **✅ 100%** |

### Testing Approach

1. **Unit Tests**: Test each component/service in isolation
2. **Integration Tests**: Test component interactions
3. **Mock Strategy**: Mock window.electronAPI for all tests
4. **Test Structure**: Describe blocks for each method/feature

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- path/to/test.test.js

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

---

## Usage Examples

### Creating a New Modal

```javascript
const { BaseModal } = require('../../core/BaseModal');

class MyCustomModal extends BaseModal {
  constructor() {
    super('my-modal-id');
    this.resolvePromise = null;
  }

  init() {
    super.init();

    if (!this.modal) return;

    // Find elements
    this.confirmBtn = this.modal.querySelector('#confirm-btn');
    this.cancelBtn = this.modal.querySelector('#cancel-btn');

    // Register listeners (tracked automatically)
    this.addEventListener(this.confirmBtn, 'click', () => this.handleConfirm());
    this.addEventListener(this.cancelBtn, 'click', () => this.handleCancel());
  }

  show() {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.open();
    });
  }

  handleConfirm() {
    if (this.resolvePromise) {
      const resolve = this.resolvePromise;
      this.resolvePromise = null;
      this.close();
      resolve(true);
    }
  }

  handleCancel() {
    if (this.resolvePromise) {
      const resolve = this.resolvePromise;
      this.resolvePromise = null;
      this.close();
      resolve(false);
    }
  }
}

module.exports = { MyCustomModal };
```

### Using the Store

```javascript
const { store } = require('./core');

// Initialize state
store.setState({
  users: {
    allUsers: [],
    filteredUsers: [],
    selectedUser: null
  }
});

// Subscribe to changes
const unsubscribe = store.subscribe('users', (state) => {
  updateUserList(state.users.filteredUsers);
  updateSelectedUser(state.users.selectedUser);
});

// Update state (triggers subscribers)
store.setState({
  users: {
    allUsers: users,
    filteredUsers: filteredUsers,
    selectedUser: selectedUser
  }
});

// Cleanup when component is destroyed
unsubscribe();
```

### Creating a New Service

```javascript
class MyService {
  constructor() {
    this.electronAPI = window.electronAPI;
  }

  async myOperation(data) {
    try {
      console.log('[MyService] Starting operation:', data);
      const result = await this.electronAPI.myIPCCall(data);
      console.log('[MyService] Operation completed');
      return result;
    } catch (error) {
      console.error('[MyService] Operation failed:', error);
      throw error;
    }
  }
}

// Export singleton
const myService = new MyService();

module.exports = { MyService, myService };
```

---

## Migration Guide

### From Old Modal Pattern to New

**Before (Callback-based)**:
```javascript
function showConfirmModal(message, onConfirm) {
  document.getElementById('confirm-message').textContent = message;
  confirmModal.classList.add('show');

  const confirmBtn = document.getElementById('confirm-yes-btn');
  confirmBtn.addEventListener('click', () => {
    closeConfirmModal();
    onConfirm();
  });
}

// Usage
showConfirmModal('Delete user?', () => {
  deleteUser(userId);
});
```

**After (Promise-based)**:
```javascript
async function showConfirmModal(message) {
  const confirmed = await confirmModalInstance.show(message);
  return confirmed;
}

// Usage
const confirmed = await showConfirmModal('Delete user?');
if (confirmed) {
  deleteUser(userId);
}
```

### From Direct IPC to Service

**Before**:
```javascript
const result = await window.electronAPI.getUsers(filters, options);
if (result.success) {
  // Handle success
}
```

**After**:
```javascript
const result = await userService.getUsers(filters, options);
if (result.success) {
  // Handle success
}
```

### From Manual State to Store

**Before**:
```javascript
let selectedUser = null;
let allUsers = [];

function updateUser(user) {
  selectedUser = user;
  renderUserDetails(user);
}
```

**After**:
```javascript
// Subscribe once
store.subscribe('users', (state) => {
  renderUserDetails(state.users.selectedUser);
});

// Update state (triggers subscribers)
store.setState({
  users: {
    ...store.getState().users,
    selectedUser: user
  }
});
```

---

## Benefits of New Architecture

### 1. **Memory Leak Prevention**
- Automatic cleanup of event listeners
- Automatic cleanup of store subscriptions
- No manual tracking needed

### 2. **Improved Testability**
- Components can be tested in isolation
- Services are easily mockable
- Store is fully testable

### 3. **Better Code Organization**
- Clear separation of concerns
- Single Responsibility Principle
- Easier to navigate and maintain

### 4. **Cleaner Async Code**
- Promise-based modals
- async/await everywhere
- No callback hell

### 5. **Reactive UI**
- UI updates automatically on state changes
- No manual DOM manipulation needed
- Consistent state management

---

## Best Practices

### 1. Always Use Services for IPC

❌ **Don't**:
```javascript
const result = await window.electronAPI.getUsers();
```

✅ **Do**:
```javascript
const result = await userService.getUsers();
```

### 2. Always Cleanup Subscriptions

❌ **Don't**:
```javascript
store.subscribe('users', (state) => {
  // Never cleaned up - memory leak!
});
```

✅ **Do**:
```javascript
const unsubscribe = store.subscribe('users', (state) => {
  // ...
});

// Later, when component is destroyed
unsubscribe();
```

### 3. Use BaseModal for All Modals

❌ **Don't**:
```javascript
class MyModal {
  // Manual listener management
}
```

✅ **Do**:
```javascript
class MyModal extends BaseModal {
  // Automatic listener management
}
```

### 4. Keep Components Focused

- One component = one responsibility
- Delegate business logic to services
- Use store for state, not component properties

---

## Troubleshooting

### Modal Not Cleaning Up Listeners

**Problem**: Event listeners persist after modal is closed

**Solution**: Ensure you're using `this.addEventListener()` not raw `element.addEventListener()`

```javascript
// ❌ Wrong - not tracked
element.addEventListener('click', handler);

// ✅ Correct - tracked and cleaned up
this.addEventListener(element, 'click', handler);
```

### Store Updates Not Triggering Subscribers

**Problem**: UI not updating when state changes

**Solution**: Ensure you're calling `setState()` with the full namespace

```javascript
// ❌ Wrong - doesn't trigger subscribers
store.state.users.selectedUser = user;

// ✅ Correct - triggers subscribers
store.setState({
  users: {
    ...store.getState().users,
    selectedUser: user
  }
});
```

### Service Errors Not Handled

**Problem**: Unhandled promise rejections

**Solution**: Always wrap service calls in try/catch

```javascript
// ❌ Wrong - errors not handled
const result = await userService.getUsers();

// ✅ Correct - errors handled
try {
  const result = await userService.getUsers();
} catch (error) {
  console.error('Failed to get users:', error);
  showErrorMessage(error.message);
}
```

---

## Future Improvements

### Phase 4: Component Extraction (Planned)

Extract remaining logic from renderer.js into reusable components:

1. **UserListComponent**
   - User list rendering
   - Search and filtering
   - User selection

2. **ImageManagerComponent**
   - Image display
   - Image navigation
   - Image linking/unlinking

3. **Additional Services**
   - exportService
   - repositoryService
   - cameraService

### Other Improvements

- Add TypeScript definitions
- Implement virtual scrolling for large lists
- Add state persistence (localStorage)
- Add undo/redo functionality
- Performance optimizations

---

## References

- [Store Observable Pattern](./patterns/STORE_OBSERVABLE.md)
- [Service Pattern](./patterns/SERVICE_PATTERN.md)
- [BaseModal Lifecycle](./patterns/BASE_MODAL.md)
- [Testing Guide](./TESTING_GUIDE.md)

---

## Changelog

### Version 1.1.4 (Current)
- ✅ Phase 1: Architecture Foundation
- ✅ Phase 2: Modal Components
- ✅ Phase 3: Integration
- ✅ All tests passing (194/194)

---

**Last Updated**: 2025-10-25
**Author**: Renderer Refactoring Team
**Status**: Active Development
