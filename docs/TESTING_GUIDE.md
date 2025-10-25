# Testing Guide

## Overview

This guide explains the testing strategy, conventions, and best practices for the User Capture App renderer refactoring.

## Test Framework

- **Test Runner**: Jest
- **Environment**: jsdom (simulates browser environment)
- **Assertions**: Jest matchers
- **Mocking**: Jest mocks

## Test Coverage

### Current Status

| Category | Files | Tests | Status |
|----------|-------|-------|--------|
| Core | 7 | 102 | ✅ 100% |
| Modals | 5 | 60 | ✅ 100% |
| Integration | 1 | 19 | ✅ 100% |
| Services | 1 | 14 | ✅ 100% |
| **Total** | **14** | **194** | **✅ 100%** |

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- path/to/test.test.js

# Run tests matching pattern
npm test -- --testNamePattern="Modal"

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run tests silently (no console.log output)
npm test -- --silent
```

## Test Structure

### Directory Layout

```
tests/
├── setup/                          # Test setup files
│   ├── jest.setup.js              # Global Jest config
│   └── electronAPI.mock.js        # electronAPI mock
│
└── unit/                           # Unit tests
    ├── core/                       # Core pattern tests
    │   ├── store.test.js
    │   └── BaseModal.test.js
    │
    ├── services/                   # Service tests
    │   └── userService.test.js
    │
    ├── components/                 # Component tests
    │   └── modals/
    │       ├── ConfirmModal.test.js
    │       └── InfoModal.test.js
    │
    └── integration/                # Integration tests
        └── modalIntegration.test.js
```

### Test File Template

```javascript
/**
 * Tests for ClassName
 */

const { ClassName } = require('../../../src/renderer/path/to/ClassName');

describe('ClassName', () => {
  let instance;

  beforeEach(() => {
    // Setup before each test
    instance = new ClassName();
  });

  afterEach(() => {
    // Cleanup after each test
    if (instance && instance.destroy) {
      instance.destroy();
    }
  });

  describe('methodName', () => {
    test('should do something specific', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = instance.methodName(input);

      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

## Testing Patterns

### Pattern 1: Testing Store

```javascript
const { Store } = require('../../../src/renderer/core/store');

describe('Store', () => {
  let store;

  beforeEach(() => {
    store = new Store();
  });

  test('should update state', () => {
    store.setState({
      users: { allUsers: [] }
    });

    expect(store.getState().users.allUsers).toEqual([]);
  });

  test('should notify subscribers', () => {
    const callback = jest.fn();

    store.subscribe('users', callback);
    store.setState({ users: { allUsers: [] } });

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        users: { allUsers: [] }
      })
    );
  });
});
```

### Pattern 2: Testing Services

```javascript
const { UserService } = require('../../../src/renderer/services/userService');

describe('UserService', () => {
  let userService;
  let mockElectronAPI;

  beforeEach(() => {
    // Mock electronAPI
    mockElectronAPI = {
      getUsers: jest.fn(),
      getUserById: jest.fn()
    };

    // Set global window
    if (!global.window) {
      global.window = {};
    }
    global.window.electronAPI = mockElectronAPI;

    // Create service instance
    userService = new UserService();
  });

  test('should call electronAPI.getUsers', async () => {
    mockElectronAPI.getUsers.mockResolvedValue({
      success: true,
      users: []
    });

    await userService.getUsers();

    expect(mockElectronAPI.getUsers).toHaveBeenCalled();
  });

  test('should handle errors', async () => {
    mockElectronAPI.getUsers.mockRejectedValue(
      new Error('Network error')
    );

    await expect(userService.getUsers()).rejects.toThrow('Network error');
  });
});
```

### Pattern 3: Testing Modals

```javascript
const { ConfirmModal } = require('../../../../src/renderer/components/modals/ConfirmModal');

describe('ConfirmModal', () => {
  let modal;
  let mockElement;

  beforeEach(() => {
    // Create mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'confirm-modal';
    mockElement.innerHTML = `
      <p id="confirm-message"></p>
      <button id="confirm-yes-btn">Yes</button>
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

  test('should show message', () => {
    modal.init();

    const promise = modal.show('Test message?');

    expect(modal.messageEl.textContent).toBe('Test message?');

    // Cleanup
    modal.handleNo();
  });

  test('should resolve true on yes', async () => {
    modal.init();

    const promise = modal.show('Confirm?');
    modal.handleYes();

    const result = await promise;
    expect(result).toBe(true);
  });
});
```

### Pattern 4: Testing Async Operations

```javascript
test('should handle async operation', async () => {
  const promise = asyncOperation();

  // Wait for operation
  await promise;

  // Assert results
  expect(someValue).toBe('expected');
});

test('should handle promise rejection', async () => {
  await expect(
    failingOperation()
  ).rejects.toThrow('Expected error');
});
```

### Pattern 5: Testing Event Listeners

```javascript
test('should handle button click', () => {
  modal.init();

  const spy = jest.spyOn(modal, 'handleClick');

  modal.button.click();

  expect(spy).toHaveBeenCalled();

  spy.mockRestore();
});
```

## Best Practices

### 1. ✅ Arrange-Act-Assert Pattern

```javascript
test('should add two numbers', () => {
  // Arrange
  const a = 5;
  const b = 3;

  // Act
  const result = add(a, b);

  // Assert
  expect(result).toBe(8);
});
```

### 2. ✅ One Assertion Per Test

```javascript
// ❌ Wrong - multiple unrelated assertions
test('should work correctly', () => {
  expect(result.value).toBe(5);
  expect(result.name).toBe('test');
  expect(result.active).toBe(true);
});

// ✅ Correct - separate tests
test('should have correct value', () => {
  expect(result.value).toBe(5);
});

test('should have correct name', () => {
  expect(result.name).toBe('test');
});

test('should be active', () => {
  expect(result.active).toBe(true);
});
```

### 3. ✅ Descriptive Test Names

```javascript
// ❌ Wrong - vague
test('works', () => {});

// ✅ Correct - specific
test('should return null when user is not found', () => {});
```

### 4. ✅ Test Both Success and Failure

```javascript
describe('getUser', () => {
  test('should return user when found', async () => {
    // Test success case
  });

  test('should throw error when not found', async () => {
    // Test error case
  });
});
```

### 5. ✅ Clean Up After Tests

```javascript
afterEach(() => {
  // Cleanup instances
  if (modal) {
    modal.destroy();
  }

  // Cleanup DOM
  document.body.innerHTML = '';

  // Clear mocks
  jest.clearAllMocks();
});
```

### 6. ✅ Mock External Dependencies

```javascript
// Mock window.electronAPI
beforeEach(() => {
  global.window = {
    electronAPI: {
      getUsers: jest.fn()
    }
  };
});
```

## Common Test Scenarios

### Testing Modal Promise Resolution

```javascript
test('should resolve with value on confirm', async () => {
  modal.init();

  const promise = modal.show();

  // Simulate user action
  modal.handleConfirm();

  // Wait for resolution
  const result = await promise;

  expect(result).toBeTruthy();
});
```

### Testing Store Subscriptions

```javascript
test('should trigger subscriber on state change', () => {
  const callback = jest.fn();

  store.subscribe('users', callback);
  store.setState({ users: { allUsers: [] } });

  expect(callback).toHaveBeenCalled();
  expect(callback).toHaveBeenCalledWith(
    expect.objectContaining({
      users: expect.any(Object)
    })
  );
});
```

### Testing Error Handling

```javascript
test('should handle service error', async () => {
  mockElectronAPI.getUsers.mockRejectedValue(
    new Error('Service unavailable')
  );

  await expect(
    userService.getUsers()
  ).rejects.toThrow('Service unavailable');
});
```

### Testing DOM Manipulation

```javascript
test('should update text content', () => {
  modal.init();

  modal.setMessage('Test message');

  expect(modal.messageEl.textContent).toBe('Test message');
});
```

### Testing Cleanup

```javascript
test('should remove all listeners on destroy', () => {
  modal.init();

  const listenerCount = modal.listeners.length;
  expect(listenerCount).toBeGreaterThan(0);

  modal.destroy();

  expect(modal.listeners.length).toBe(0);
});
```

## Mocking Strategies

### Mock electronAPI

```javascript
beforeEach(() => {
  mockElectronAPI = {
    getUsers: jest.fn().mockResolvedValue({ success: true, users: [] }),
    createProject: jest.fn().mockResolvedValue({ success: true })
  };

  global.window = { electronAPI: mockElectronAPI };
});
```

### Mock Store

```javascript
beforeEach(() => {
  mockStore = {
    getState: jest.fn().mockReturnValue({ users: { allUsers: [] } }),
    setState: jest.fn(),
    subscribe: jest.fn().mockReturnValue(() => {})
  };
});
```

### Mock Timers

```javascript
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test('should delay execution', () => {
  const callback = jest.fn();

  setTimeout(callback, 1000);

  jest.advanceTimersByTime(1000);

  expect(callback).toHaveBeenCalled();
});
```

## Debugging Tests

### View Console Output

```bash
# Run without silent mode
npm test

# Run with verbose output
npm test -- --verbose
```

### Debug Specific Test

```javascript
test.only('should debug this test', () => {
  console.log('Debug info:', someValue);
  expect(someValue).toBe('expected');
});
```

### Skip Tests Temporarily

```javascript
test.skip('should skip this test', () => {
  // This test will be skipped
});

describe.skip('Skipped suite', () => {
  // All tests in this suite will be skipped
});
```

## Coverage

### Generate Coverage Report

```bash
npm test -- --coverage
```

### Coverage Output

```
File                  | % Stmts | % Branch | % Funcs | % Lines
----------------------|---------|----------|---------|--------
All files             |   95.5  |   88.2   |   92.1  |   95.8
 core/                |   98.2  |   92.5   |   97.0  |   98.5
  store.js            |   100   |   95.0   |   100   |   100
  BaseModal.js        |   96.5  |   90.0   |   94.0  |   97.0
 services/            |   94.8  |   85.0   |   89.5  |   95.2
  userService.js      |   100   |   90.0   |   100   |   100
```

### Coverage Thresholds

Set in `jest.config.cjs`:

```javascript
module.exports = {
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'

      - run: npm ci
      - run: npm test -- --coverage
      - run: npm run test:integration
```

## Troubleshooting

### Issue: Tests Timeout

**Problem**: Tests hang and timeout

**Solution**: Ensure async operations complete

```javascript
// ❌ Wrong - promise not awaited
test('async test', () => {
  asyncOperation();  // Hangs!
});

// ✅ Correct - await promise
test('async test', async () => {
  await asyncOperation();
});
```

### Issue: Tests Leak Memory

**Problem**: Tests slow down over time

**Solution**: Clean up after each test

```javascript
afterEach(() => {
  modal.destroy();
  document.body.innerHTML = '';
  jest.clearAllMocks();
});
```

### Issue: Flaky Tests

**Problem**: Tests pass/fail randomly

**Solution**: Remove time-dependent logic

```javascript
// ❌ Wrong - depends on timing
test('flaky test', () => {
  setTimeout(() => {
    expect(value).toBe('done');
  }, 100);
});

// ✅ Correct - explicit promise
test('stable test', async () => {
  await waitForCondition(() => value === 'done');
  expect(value).toBe('done');
});
```

### Issue: Can't Find Element

**Problem**: `querySelector` returns null

**Solution**: Ensure DOM is set up

```javascript
beforeEach(() => {
  document.body.innerHTML = `
    <div id="my-element"></div>
  `;
});

test('finds element', () => {
  const element = document.getElementById('my-element');
  expect(element).toBeTruthy();
});
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/)
- [Jest Matchers](https://jestjs.io/docs/expect)
- [Mocking Guide](https://jestjs.io/docs/mock-functions)

---

**Last Updated**: 2025-10-25
