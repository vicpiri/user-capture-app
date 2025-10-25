# BaseModal Lifecycle Pattern

## Overview

BaseModal is a **base class for all modal dialogs** that provides automatic memory leak prevention through lifecycle management. It tracks event listeners and store subscriptions, cleaning them up automatically when the modal is destroyed.

## Location

`src/renderer/core/BaseModal.js`

## Problem Solved

### Without BaseModal (Memory Leaks)

```javascript
class OldModal {
  init() {
    // Manual listener management - easy to forget cleanup!
    this.button.addEventListener('click', this.handler);
    this.unsubscribe = store.subscribe('users', this.updateUsers);
  }

  destroy() {
    // Must remember to clean up EVERYTHING
    this.button.removeEventListener('click', this.handler);  // ❌ Forgot this!
    if (this.unsubscribe) this.unsubscribe();
  }
}
```

### With BaseModal (Automatic Cleanup)

```javascript
class NewModal extends BaseModal {
  init() {
    super.init();

    // Tracked automatically!
    this.addEventListener(this.button, 'click', this.handler);
    this.subscribeToStore('users', this.updateUsers);
  }

  destroy() {
    super.destroy();  // ✅ Cleans up everything automatically!
  }
}
```

## Core Features

### 1. Automatic Event Listener Tracking

```javascript
// Instead of:
element.addEventListener('click', handler);

// Use:
this.addEventListener(element, 'click', handler);
// ✅ Tracked and cleaned up automatically
```

### 2. Automatic Store Subscription Tracking

```javascript
// Instead of:
const unsubscribe = store.subscribe('users', handler);

// Use:
this.subscribeToStore('users', handler);
// ✅ Tracked and cleaned up automatically
```

### 3. Lifecycle Methods

- `init()` - Initialize modal, find elements, setup listeners
- `open()` - Show modal
- `close()` - Hide modal
- `destroy()` - Cleanup all listeners and subscriptions

## API Reference

### Constructor

```javascript
constructor(modalId)
```

**Parameters**:
- `modalId` (string): ID of the modal element in DOM

**Example**:
```javascript
class MyModal extends BaseModal {
  constructor() {
    super('my-modal-id');
  }
}
```

### `init()`

Initializes the modal. Finds modal element in DOM and sets up base functionality.

**Override this** to add your own initialization logic:

```javascript
init() {
  super.init();  // ⚠️ Always call super.init() first!

  if (!this.modal) return;

  // Find your elements
  this.button = this.modal.querySelector('#my-button');

  // Setup listeners (tracked automatically)
  this.addEventListener(this.button, 'click', () => this.handleClick());
}
```

### `addEventListener(element, event, handler)`

Adds event listener that is **automatically tracked and cleaned up**.

**Parameters**:
- `element` (HTMLElement): Element to attach listener to
- `event` (string): Event name (e.g., 'click', 'change')
- `handler` (function): Event handler function

**Example**:
```javascript
this.addEventListener(this.button, 'click', () => {
  console.log('Button clicked');
});

this.addEventListener(this.input, 'input', (e) => {
  this.handleInput(e.target.value);
});
```

### `subscribeToStore(namespace, callback)`

Subscribes to store changes with **automatic cleanup**.

**Parameters**:
- `namespace` (string): Store namespace to watch
- `callback` (function): Called when namespace changes

**Example**:
```javascript
this.subscribeToStore('users', (state) => {
  this.updateUserList(state.users.allUsers);
});
```

### `open()`

Shows the modal (adds 'show' class).

**Override this** to add custom logic:

```javascript
open() {
  this.resetForm();  // Custom logic
  super.open();      // Show modal
}
```

### `close()`

Hides the modal (removes 'show' class).

**Override this** for custom cleanup:

```javascript
close() {
  this.clearErrors();  // Custom logic
  super.close();       // Hide modal
}
```

### `destroy()`

Cleans up all listeners and subscriptions.

**Always call** when removing modal:

```javascript
const modal = new MyModal();
modal.init();

// Later...
modal.destroy();  // ✅ Cleans up everything
```

## Creating a Modal

### Basic Modal Template

```javascript
const { BaseModal } = require('../../core/BaseModal');

class MyModal extends BaseModal {
  constructor() {
    super('my-modal-id');

    // Initialize properties
    this.data = null;
  }

  /**
   * Initialize modal
   */
  init() {
    super.init();

    if (!this.modal) return;

    // Find elements
    this.titleEl = this.modal.querySelector('#modal-title');
    this.messageEl = this.modal.querySelector('#modal-message');
    this.confirmBtn = this.modal.querySelector('#confirm-btn');
    this.cancelBtn = this.modal.querySelector('#cancel-btn');

    // Setup listeners (auto-tracked)
    this.addEventListener(this.confirmBtn, 'click', () => this.handleConfirm());
    this.addEventListener(this.cancelBtn, 'click', () => this.handleCancel());

    // Subscribe to store (auto-tracked)
    this.subscribeToStore('users', (state) => {
      this.updateData(state.users);
    });

    this._log('MyModal initialized');
  }

  /**
   * Open modal with data
   */
  open(data) {
    this.data = data;
    this.titleEl.textContent = data.title;
    this.messageEl.textContent = data.message;
    super.open();
  }

  /**
   * Handle confirm
   */
  handleConfirm() {
    this._log('Confirmed');
    this.close();
  }

  /**
   * Handle cancel
   */
  handleCancel() {
    this._log('Cancelled');
    this.close();
  }

  /**
   * Update data from store
   */
  updateData(users) {
    // Update UI based on users
  }

  /**
   * Internal logging
   */
  _log(message, data = null, level = 'info') {
    const prefix = '[MyModal]';
    if (level === 'error') {
      console.error(prefix, message, data || '');
    } else {
      console.log(prefix, message, data || '');
    }
  }
}

module.exports = { MyModal };
```

### Promise-Based Modal

```javascript
class ConfirmModal extends BaseModal {
  constructor() {
    super('confirm-modal');
    this.resolvePromise = null;
  }

  init() {
    super.init();
    // ... find elements ...
    this.addEventListener(this.yesBtn, 'click', () => this.handleYes());
    this.addEventListener(this.noBtn, 'click', () => this.handleNo());
  }

  /**
   * Show modal and return promise
   * @param {string} message - Confirmation message
   * @returns {Promise<boolean>} True if confirmed, false if cancelled
   */
  show(message) {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.messageEl.textContent = message;
      this.open();
    });
  }

  handleYes() {
    if (this.resolvePromise) {
      const resolve = this.resolvePromise;
      this.resolvePromise = null;
      this.close();
      resolve(true);
    }
  }

  handleNo() {
    if (this.resolvePromise) {
      const resolve = this.resolvePromise;
      this.resolvePromise = null;
      this.close();
      resolve(false);
    }
  }

  close() {
    super.close();

    // If closed without choosing, resolve as false
    if (this.resolvePromise) {
      this.resolvePromise(false);
      this.resolvePromise = null;
    }
  }
}

// Usage
const confirmed = await confirmModal.show('Delete user?');
if (confirmed) {
  deleteUser();
}
```

## Best Practices

### 1. ✅ Always Call super Methods

```javascript
// ❌ Wrong - doesn't call super
init() {
  this.button = this.modal.querySelector('#btn');
}

// ✅ Correct - calls super first
init() {
  super.init();
  this.button = this.modal.querySelector('#btn');
}
```

### 2. ✅ Use addEventListener, Not Direct Assignment

```javascript
// ❌ Wrong - not tracked
this.button.addEventListener('click', handler);

// ✅ Correct - tracked automatically
this.addEventListener(this.button, 'click', handler);
```

### 3. ✅ Use subscribeToStore, Not Direct Subscribe

```javascript
// ❌ Wrong - not tracked
store.subscribe('users', handler);

// ✅ Correct - tracked automatically
this.subscribeToStore('users', handler);
```

### 4. ✅ Check Modal Element Exists

```javascript
init() {
  super.init();

  if (!this.modal) {
    console.error('Modal element not found');
    return;
  }

  // Safe to use this.modal now
}
```

### 5. ✅ Always Destroy When Done

```javascript
class Component {
  init() {
    this.modal = new MyModal();
    this.modal.init();
  }

  cleanup() {
    if (this.modal) {
      this.modal.destroy();  // ✅ Clean up
    }
  }
}
```

## Common Patterns

### Pattern 1: Form Modal

```javascript
class FormModal extends BaseModal {
  init() {
    super.init();

    this.form = this.modal.querySelector('form');
    this.submitBtn = this.modal.querySelector('#submit');
    this.cancelBtn = this.modal.querySelector('#cancel');

    this.addEventListener(this.submitBtn, 'click', () => this.handleSubmit());
    this.addEventListener(this.cancelBtn, 'click', () => this.handleCancel());
  }

  handleSubmit() {
    const formData = new FormData(this.form);
    const data = Object.fromEntries(formData);

    // Validate
    if (this.validate(data)) {
      this.onSubmit(data);
      this.close();
    }
  }

  validate(data) {
    // Validation logic
    return true;
  }

  onSubmit(data) {
    // Override in subclass or pass as parameter
  }
}
```

### Pattern 2: Modal with Multiple States

```javascript
class WizardModal extends BaseModal {
  constructor() {
    super('wizard-modal');
    this.currentStep = 1;
  }

  init() {
    super.init();

    this.nextBtn = this.modal.querySelector('#next-btn');
    this.prevBtn = this.modal.querySelector('#prev-btn');

    this.addEventListener(this.nextBtn, 'click', () => this.nextStep());
    this.addEventListener(this.prevBtn, 'click', () => this.prevStep());
  }

  nextStep() {
    this.currentStep++;
    this.updateUI();
  }

  prevStep() {
    this.currentStep--;
    this.updateUI();
  }

  updateUI() {
    // Update modal based on currentStep
  }

  open() {
    this.currentStep = 1;
    this.updateUI();
    super.open();
  }
}
```

### Pattern 3: Data-Driven Modal

```javascript
class DataModal extends BaseModal {
  init() {
    super.init();

    this.listContainer = this.modal.querySelector('#list');

    // Subscribe to store
    this.subscribeToStore('users', (state) => {
      this.renderList(state.users.allUsers);
    });
  }

  renderList(users) {
    this.listContainer.innerHTML = '';
    users.forEach(user => {
      const item = this.createListItem(user);
      this.listContainer.appendChild(item);
    });
  }

  createListItem(user) {
    const div = document.createElement('div');
    div.textContent = user.name;
    // Track click listener
    this.addEventListener(div, 'click', () => this.selectUser(user));
    return div;
  }

  selectUser(user) {
    console.log('Selected:', user);
  }
}
```

## Testing

### Test Modal Initialization

```javascript
describe('MyModal', () => {
  let modal;

  beforeEach(() => {
    // Create mock DOM
    document.body.innerHTML = `
      <div id="my-modal">
        <button id="confirm-btn">Confirm</button>
      </div>
    `;

    modal = new MyModal();
  });

  afterEach(() => {
    if (modal) {
      modal.destroy();
    }
    document.body.innerHTML = '';
  });

  test('should initialize correctly', () => {
    modal.init();

    expect(modal.modal).toBeTruthy();
    expect(modal.listeners.length).toBeGreaterThan(0);
  });

  test('should cleanup on destroy', () => {
    modal.init();

    const listenerCount = modal.listeners.length;
    expect(listenerCount).toBeGreaterThan(0);

    modal.destroy();

    expect(modal.listeners.length).toBe(0);
  });
});
```

### Test Promise Resolution

```javascript
test('should resolve promise on confirm', async () => {
  modal.init();

  const promise = modal.show('Test message');

  modal.handleConfirm();

  const result = await promise;
  expect(result).toBe(true);
});
```

## Troubleshooting

### Issue: Listeners Not Cleaned Up

**Problem**: Memory leak, listeners still firing after destroy()

**Solution**: Use `this.addEventListener()` not direct addEventListener

```javascript
// ❌ Wrong
this.button.addEventListener('click', handler);

// ✅ Correct
this.addEventListener(this.button, 'click', handler);
```

### Issue: Modal Not Found

**Problem**: `this.modal` is null

**Solution**: Check modal ID matches DOM element

```javascript
constructor() {
  super('my-modal-id');  // ⚠️ Must match DOM id
}
```

```html
<!-- Must have matching ID -->
<div id="my-modal-id">...</div>
```

### Issue: Subscriptions Not Cleaned Up

**Problem**: Store callbacks still being called after destroy

**Solution**: Use `this.subscribeToStore()` not direct store.subscribe

```javascript
// ❌ Wrong
store.subscribe('users', handler);

// ✅ Correct
this.subscribeToStore('users', handler);
```

### Issue: Can't Call Methods After Destroy

**Problem**: `TypeError: Cannot read property 'X' of null`

**Solution**: Don't use modal after calling destroy()

```javascript
const modal = new MyModal();
modal.init();
modal.destroy();

// ❌ Wrong - modal is destroyed
modal.open();

// ✅ Correct - create new instance
const newModal = new MyModal();
newModal.init();
newModal.open();
```

## Performance Considerations

### Lazy Initialization

```javascript
class HeavyModal extends BaseModal {
  init() {
    super.init();

    // Don't initialize heavy stuff until needed
  }

  open() {
    // Initialize on first open
    if (!this.initialized) {
      this.initializeHeavyStuff();
      this.initialized = true;
    }

    super.open();
  }

  initializeHeavyStuff() {
    // Heavy DOM manipulation, data loading, etc.
  }
}
```

### Reusable Modals

```javascript
// Create once, reuse many times
const confirmModal = new ConfirmModal();
confirmModal.init();

// Use multiple times
const result1 = await confirmModal.show('First question?');
const result2 = await confirmModal.show('Second question?');

// Cleanup only when truly done
confirmModal.destroy();
```

## Examples

See existing modals for complete implementations:
- `src/renderer/components/modals/ConfirmModal.js`
- `src/renderer/components/modals/InfoModal.js`
- `src/renderer/components/modals/NewProjectModal.js`

## Related Patterns

- [Store Observable](./STORE_OBSERVABLE.md) - BaseModal tracks store subscriptions
- [Service Pattern](./SERVICE_PATTERN.md) - Modals use services for operations

---

**Last Updated**: 2025-10-25
