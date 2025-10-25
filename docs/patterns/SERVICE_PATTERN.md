# Service Pattern

## Overview

The Service Pattern provides a **clean abstraction layer** between the renderer UI and the main process IPC communication. Services wrap `window.electronAPI` calls with consistent error handling, logging, and type-safe interfaces.

## Location

`src/renderer/services/`

## Purpose

1. **Abstraction**: Hide IPC complexity from UI components
2. **Consistency**: Standardize error handling and logging
3. **Testability**: Easy to mock for unit tests
4. **Type Safety**: JSDoc provides autocomplete and type checking
5. **Centralization**: Single place for all IPC calls

## Architecture

```
┌──────────────┐
│  Component   │
│   (UI)       │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Service    │  ← Error handling, logging
│  (Business)  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│     IPC      │
│ (Main Proc)  │
└──────────────┘
```

## Available Services

### 1. ProjectService

Handles project lifecycle operations.

**File**: `src/renderer/services/projectService.js`

**Methods**:
- `createProject(data)` - Create new project
- `openProject(folderPath)` - Open existing project
- `updateXML(data)` - Update project XML
- `exportCSV(options)` - Export to CSV
- `exportImages(options)` - Export images

### 2. UserService

Manages user CRUD operations.

**File**: `src/renderer/services/userService.js`

**Methods**:
- `getUsers(filters, options)` - Get all users
- `getUserById(userId)` - Get specific user
- `updateUser(userId, updates)` - Update user
- `deleteUser(userId)` - Delete user
- `getDuplicates()` - Get duplicate assignments
- `searchUsers(searchTerm)` - Search users

### 3. GroupService

Manages groups.

**File**: `src/renderer/services/groupService.js`

**Methods**:
- `getGroups()` - Get all groups
- `getGroupById(groupCode)` - Get specific group

### 4. ImageService

Handles image operations.

**File**: `src/renderer/services/imageService.js`

**Methods**:
- `getImages(filters)` - Get images
- `linkImage(userId, imagePath)` - Link image to user
- `unlinkImage(userId)` - Unlink image from user
- `addTag(imagePath, tag)` - Add tag to image
- `removeTag(imagePath, tag)` - Remove tag from image

## Service Structure

### Basic Service Template

```javascript
/**
 * Service Name
 *
 * Description of what this service does.
 *
 * @module services/serviceName
 */

class ServiceName {
  constructor() {
    this.electronAPI = window.electronAPI;
  }

  /**
   * Method description
   * @param {type} paramName - Parameter description
   * @returns {Promise<object>} Result description
   */
  async methodName(paramName) {
    try {
      console.log('[ServiceName] Starting operation:', paramName);
      const result = await this.electronAPI.ipcMethod(paramName);
      console.log('[ServiceName] Operation completed');
      return result;
    } catch (error) {
      console.error('[ServiceName] Operation failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
const serviceName = new ServiceName();

module.exports = { ServiceName, serviceName };
```

## Usage Examples

### Example 1: ProjectService

```javascript
const { projectService } = require('./services/projectService');

async function createNewProject() {
  try {
    const result = await projectService.createProject({
      folderPath: '/path/to/project',
      xmlFilePath: '/path/to/file.xml'
    });

    if (result.success) {
      console.log('Project created:', result.project);
      console.log('Users:', result.users);
      console.log('Groups:', result.groups);
    }
  } catch (error) {
    console.error('Failed to create project:', error);
    showErrorMessage(error.message);
  }
}
```

### Example 2: UserService

```javascript
const { userService } = require('./services/userService');

async function loadUsers() {
  try {
    const result = await userService.getUsers(
      { groupId: 1 },           // filters
      { orderBy: 'nombre' }     // options
    );

    if (result.success) {
      displayUsers(result.users);
    }
  } catch (error) {
    console.error('Failed to load users:', error);
  }
}
```

### Example 3: ImageService

```javascript
const { imageService } = require('./services/imageService');

async function linkImageToUser(userId, imagePath) {
  try {
    const result = await imageService.linkImage(userId, imagePath);

    if (result.success) {
      console.log('Image linked successfully');
      updateUserDisplay(userId);
    } else if (result.needsConfirmation) {
      const confirmed = await showConfirmation(
        'User already has an image. Replace it?'
      );

      if (confirmed) {
        const confirmResult = await imageService.confirmLinkImage(
          userId,
          imagePath
        );
        // Handle confirmation result
      }
    }
  } catch (error) {
    console.error('Failed to link image:', error);
  }
}
```

## Best Practices

### 1. ✅ Always Use Try-Catch

```javascript
// ❌ Wrong - errors not handled
const result = await userService.getUsers();

// ✅ Correct - errors handled
try {
  const result = await userService.getUsers();
  if (result.success) {
    // Handle success
  }
} catch (error) {
  console.error('Failed:', error);
  showErrorMessage(error.message);
}
```

### 2. ✅ Check Result Success

```javascript
const result = await service.operation();

if (result.success) {
  // Handle success
} else {
  // Handle failure (result.error contains message)
  console.error('Operation failed:', result.error);
}
```

### 3. ✅ Use Singleton Exports

```javascript
// ❌ Don't create new instances
import { UserService } from './services/userService';
const service = new UserService();  // Creates new instance

// ✅ Use singleton
import { userService } from './services/userService';
await userService.getUsers();  // Uses shared instance
```

### 4. ✅ Provide Detailed Logging

```javascript
async myMethod(param) {
  try {
    console.log('[MyService] Starting operation:', param);
    const result = await this.electronAPI.operation(param);
    console.log('[MyService] Operation completed successfully');
    return result;
  } catch (error) {
    console.error('[MyService] Operation failed:', error);
    throw error;
  }
}
```

## Creating a New Service

### Step 1: Create Service File

```javascript
// src/renderer/services/myService.js

/**
 * My Service
 *
 * Handles XYZ operations.
 *
 * @module services/myService
 */

class MyService {
  constructor() {
    this.electronAPI = window.electronAPI;
  }

  /**
   * Get items
   * @returns {Promise<object>} Result with items array
   */
  async getItems() {
    try {
      console.log('[MyService] Getting items');
      const result = await this.electronAPI.getItems();
      console.log(`[MyService] Got ${result.items?.length || 0} items`);
      return result;
    } catch (error) {
      console.error('[MyService] Error getting items:', error);
      throw error;
    }
  }

  /**
   * Create item
   * @param {object} itemData - Item data
   * @returns {Promise<object>} Result
   */
  async createItem(itemData) {
    try {
      console.log('[MyService] Creating item:', itemData);
      const result = await this.electronAPI.createItem(itemData);
      console.log('[MyService] Item created');
      return result;
    } catch (error) {
      console.error('[MyService] Error creating item:', error);
      throw error;
    }
  }
}

// Export singleton
const myService = new MyService();

module.exports = { MyService, myService };
```

### Step 2: Add to Index

```javascript
// src/renderer/services/index.js

const { projectService, ProjectService } = require('./projectService');
const { userService, UserService } = require('./userService');
const { myService, MyService } = require('./myService');  // Add here

module.exports = {
  projectService,
  ProjectService,
  userService,
  UserService,
  myService,    // Export singleton
  MyService     // Export class
};
```

### Step 3: Use in Components

```javascript
const { myService } = require('./services');

async function loadItems() {
  try {
    const result = await myService.getItems();
    if (result.success) {
      displayItems(result.items);
    }
  } catch (error) {
    console.error('Failed to load items:', error);
  }
}
```

## Testing Services

### Mock electronAPI

```javascript
const { UserService } = require('../../../src/renderer/services/userService');

describe('UserService', () => {
  let userService;
  let mockElectronAPI;

  beforeEach(() => {
    // Create mock
    mockElectronAPI = {
      getUsers: jest.fn(),
      getUserById: jest.fn()
    };

    // Set global
    if (!global.window) {
      global.window = {};
    }
    global.window.electronAPI = mockElectronAPI;

    // Create service
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
});
```

### Test Error Handling

```javascript
test('should throw error on failure', async () => {
  mockElectronAPI.getUsers.mockRejectedValue(
    new Error('Failed to get users')
  );

  await expect(userService.getUsers()).rejects.toThrow(
    'Failed to get users'
  );
});
```

## Common Patterns

### Pattern 1: Filtering and Options

```javascript
async getUsers(filters = {}, options = {}) {
  try {
    const result = await this.electronAPI.getUsers(filters, options);
    return result;
  } catch (error) {
    throw error;
  }
}

// Usage
await userService.getUsers(
  { groupId: 1, search: 'john' },  // filters
  { orderBy: 'nombre', order: 'ASC' }  // options
);
```

### Pattern 2: Confirmation Required

```javascript
async linkImage(userId, imagePath) {
  try {
    const result = await this.electronAPI.linkImage(userId, imagePath);

    // Check if confirmation needed
    if (result.needsConfirmation) {
      return {
        ...result,
        requiresConfirmation: true
      };
    }

    return result;
  } catch (error) {
    throw error;
  }
}

// Usage
const result = await imageService.linkImage(userId, path);
if (result.requiresConfirmation) {
  const confirmed = await showConfirm('Replace existing image?');
  if (confirmed) {
    await imageService.confirmLinkImage(userId, path);
  }
}
```

### Pattern 3: Progress Updates

```javascript
async exportImages(options) {
  try {
    // Start export (triggers progress events)
    const result = await this.electronAPI.exportImages(options);
    return result;
  } catch (error) {
    throw error;
  }
}

// In component
window.electronAPI.onProgress((data) => {
  updateProgressBar(data.percentage);
  updateProgressMessage(data.message);
});

await imageService.exportImages(options);
```

## Error Handling Strategies

### Strategy 1: Rethrow with Context

```javascript
async getUsers() {
  try {
    return await this.electronAPI.getUsers();
  } catch (error) {
    console.error('[UserService] Failed to get users:', error);
    throw new Error(`Failed to load users: ${error.message}`);
  }
}
```

### Strategy 2: Return Error in Result

```javascript
async getUsers() {
  try {
    return await this.electronAPI.getUsers();
  } catch (error) {
    console.error('[UserService] Failed:', error);
    return {
      success: false,
      error: error.message,
      users: []
    };
  }
}
```

### Strategy 3: Specific Error Types

```javascript
async getUserById(userId) {
  try {
    return await this.electronAPI.getUserById(userId);
  } catch (error) {
    if (error.message.includes('not found')) {
      throw new Error(`User ${userId} not found`);
    }
    if (error.message.includes('permission')) {
      throw new Error('Permission denied');
    }
    throw error;
  }
}
```

## Performance Considerations

### Caching

```javascript
class UserService {
  constructor() {
    this.electronAPI = window.electronAPI;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  async getUsers(filters = {}, options = {}) {
    const cacheKey = JSON.stringify({ filters, options });

    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('[UserService] Returning cached users');
        return cached.data;
      }
    }

    // Fetch fresh data
    const result = await this.electronAPI.getUsers(filters, options);

    // Update cache
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  }

  clearCache() {
    this.cache.clear();
  }
}
```

### Debouncing

```javascript
class SearchService {
  constructor() {
    this.electronAPI = window.electronAPI;
    this.debounceTimeout = null;
  }

  async searchUsers(searchTerm) {
    return new Promise((resolve) => {
      clearTimeout(this.debounceTimeout);

      this.debounceTimeout = setTimeout(async () => {
        try {
          const result = await this.electronAPI.searchUsers(searchTerm);
          resolve(result);
        } catch (error) {
          console.error('[SearchService] Search failed:', error);
          resolve({ success: false, users: [] });
        }
      }, 300); // 300ms debounce
    });
  }
}
```

## Troubleshooting

### Issue: electronAPI is undefined

**Problem**: `Cannot read property 'getUsers' of undefined`

**Solution**: Ensure window.electronAPI is available

```javascript
constructor() {
  if (!window.electronAPI) {
    throw new Error('electronAPI not available');
  }
  this.electronAPI = window.electronAPI;
}
```

### Issue: Method not found

**Problem**: `this.electronAPI.myMethod is not a function`

**Solution**: Check that IPC handler exists in main process

```javascript
// Main process
ipcMain.handle('myMethod', async (event, data) => {
  // Handler implementation
});

// Preload
contextBridge.exposeInMainWorld('electronAPI', {
  myMethod: (data) => ipcRenderer.invoke('myMethod', data)
});
```

## Related Patterns

- [Store Observable](./STORE_OBSERVABLE.md) - Services update store after operations
- [BaseModal Lifecycle](./BASE_MODAL.md) - Modals use services for operations

---

**Last Updated**: 2025-10-25
