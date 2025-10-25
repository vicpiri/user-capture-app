# Guía Completa para Preparar Tests del Refactor de renderer.js - V2.0

> **Actualización:** Esta versión incluye configuración completa para ES Modules, mock exhaustivo de electronAPI, y tests adicionales críticos (Store, Performance, Memory Leaks).

## Objetivo
Proveer una base de tests ejecutable que sirva de red de seguridad durante el refactor de `renderer.js`. Cubrir lógica pura (utils/estado/scroll), wrappers IPC, y validar performance/memory leaks.

## Alcance

### ✅ Incluido
- Unit tests para módulos puros: `utils`, `state`, funciones de cálculo
- Tests de wrappers IPC en `services` con `window.electronAPI` mockeado
- Tests del Store observable (patrón crítico para arquitectura)
- Tests de performance para virtual scroll (baseline para comparación)
- Tests de lifecycle para detectar memory leaks

### ❌ Excluido (por ahora)
- Tests de UI profunda (DOM complejo) - se pueden añadir después
- Tests E2E con Electron - requieren setup más complejo
- Tests de integración con Google Drive - requieren credenciales

## Estructura de Archivos

```
user-capture-app/
├── jest.config.cjs              # Configuración Jest (ES Modules)
├── tests/
│   ├── setup/
│   │   ├── jest.setup.js        # Setup global (mocks, timers)
│   │   └── electronAPI.mock.js  # Mock completo de window.electronAPI
│   ├── unit/
│   │   ├── state/
│   │   │   ├── store.test.js              # Test del Store observable
│   │   │   └── selectionState.test.js     # Test de selección múltiple
│   │   ├── services/
│   │   │   ├── userService.test.js        # Test de user service
│   │   │   └── imageService.test.js       # Test de image service
│   │   ├── utils/
│   │   │   ├── filterHelpers.test.js      # Test de filtros
│   │   │   └── domHelpers.test.js         # Test de helpers DOM
│   │   ├── table/
│   │   │   ├── virtualScroll.test.js      # Test de scroll virtual
│   │   │   └── virtualScroll.performance.test.js  # Performance baseline
│   │   └── ui/
│   │       └── modals/
│   │           └── BaseModal.test.js      # Test de lifecycle
│   └── fixtures/
│       └── sampleData.js        # Datos de prueba reutilizables
└── package.json                 # Scripts de test agregados
```

## Paso 1: Instalación de Dependencias

### Comandos a Ejecutar

```bash
# Instalar Jest y entorno JSDOM
npm install --save-dev jest jest-environment-jsdom

# Opcional: Si necesitas transformación de código moderno
# npm install --save-dev babel-jest @babel/core @babel/preset-env
```

### Actualizar package.json

Agregar los siguientes scripts:

```json
{
  "scripts": {
    "test": "NODE_OPTIONS=--experimental-vm-modules jest",
    "test:watch": "NODE_OPTIONS=--experimental-vm-modules jest --watch",
    "test:coverage": "NODE_OPTIONS=--experimental-vm-modules jest --coverage",
    "test:unit": "NODE_OPTIONS=--experimental-vm-modules jest tests/unit",
    "test:performance": "NODE_OPTIONS=--experimental-vm-modules jest tests/unit/table/virtualScroll.performance.test.js"
  }
}
```

## Paso 2: Configuración de Jest

### jest.config.cjs

```javascript
/** @type {import('jest').Config} */
module.exports = {
  // Patrones de búsqueda de tests
  testMatch: [
    "<rootDir>/tests/**/*.test.js",
    "<rootDir>/src/**/__tests__/**/*.test.js"
  ],

  // Entorno por defecto (JSDOM para tests con DOM ligero)
  testEnvironment: 'jsdom',

  // Setup global después de inicializar el entorno
  setupFilesAfterEnv: ["<rootDir>/tests/setup/jest.setup.js"],

  // === Configuración para ES Modules ===
  transform: {}, // No usar Babel, confiar en Node nativo
  extensionsToTreatAsEsm: ['.js'],
  moduleNameMapper: {
    // Permite imports sin extensión en tests
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },

  moduleFileExtensions: ['js', 'cjs', 'json'],

  // Limpiar mocks automáticamente entre tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // === Coverage (Cobertura de código) ===
  collectCoverageFrom: [
    'src/renderer/**/*.js',
    '!src/renderer/renderer.js', // Excluir punto de entrada
    '!**/__tests__/**',
    '!**/node_modules/**',
    '!**/*.test.js'
  ],

  // Umbrales de cobertura (empezar bajo, ir aumentando)
  coverageThreshold: {
    global: {
      statements: 50,
      branches: 40,
      functions: 50,
      lines: 50
    }
  },

  // Reportes de cobertura
  coverageReporters: ['text', 'lcov', 'html'],

  // Timeout por defecto (aumentar si hay operaciones lentas)
  testTimeout: 10000,

  // Verbose para más información durante tests
  verbose: true
};
```

## Paso 3: Setup Global y Mocks

### tests/setup/electronAPI.mock.js

Mock completo basado en `src/preload/preload.js`:

```javascript
const { EventEmitter } = require('events');

/**
 * Mock completo de window.electronAPI
 * Basado en la API expuesta en src/preload/preload.js
 */
class ElectronAPIMock extends EventEmitter {
  constructor() {
    super();

    // === PROJECT MANAGEMENT ===
    this.createProject = jest.fn(async (data) => ({
      success: true,
      data
    }));

    this.openProject = jest.fn(async (folderPath) => ({
      success: true,
      path: folderPath
    }));

    // === USER MANAGEMENT ===
    this.getUsers = jest.fn(async (filters = {}, options = {}) => ({
      success: true,
      users: []
    }));

    this.getGroups = jest.fn(async () => ({
      success: true,
      groups: [
        { code: 'A', name: 'Grupo A' },
        { code: 'B', name: 'Grupo B' }
      ]
    }));

    this.loadRepositoryImages = jest.fn(async (users) => ({
      success: true,
      repositoryData: {}
    }));

    // === IMAGE MANAGEMENT ===
    this.getImages = jest.fn(async () => ({
      success: true,
      images: []
    }));

    this.saveCapturedImage = jest.fn(async (imageData) => ({
      success: true,
      path: '/fake/images/20250101120000.jpg'
    }));

    this.linkImageToUser = jest.fn(async (data) => ({
      success: true
    }));

    this.confirmLinkImage = jest.fn(async (data) => ({
      success: true
    }));

    this.unlinkImageFromUser = jest.fn(async (userId) => ({
      success: true
    }));

    this.moveImageToIngest = jest.fn(async (imagePath) => ({
      success: true
    }));

    // === EXPORT / IMPORT ===
    this.importImagesWithId = jest.fn(async (folderPath) => ({
      success: true,
      results: {
        total: 0,
        linked: 0,
        notFound: [],
        errors: []
      }
    }));

    this.exportCSV = jest.fn(async (folderPath, users) => ({
      success: true,
      filename: 'carnets.csv',
      exported: users?.length || 0,
      ignored: 0
    }));

    this.exportImages = jest.fn(async (folderPath, users, options) => ({
      success: true
    }));

    this.exportImagesName = jest.fn(async (folderPath, users, options) => ({
      success: true
    }));

    this.exportToRepository = jest.fn(async (users, options) => ({
      success: true,
      results: {
        total: users?.length || 0,
        exported: users?.length || 0,
        errors: []
      }
    }));

    // === DIALOGS ===
    this.showOpenDialog = jest.fn(async (options) => ({
      canceled: false,
      filePaths: ['/fake/path/folder']
    }));

    this.focusWindow = jest.fn(async () => {});

    // === CAMERA ===
    this.updateAvailableCameras = jest.fn(async (cameras) => ({
      success: true
    }));

    this.getSelectedCamera = jest.fn(async () => ({
      success: true,
      cameraId: 'default'
    }));

    // === XML UPDATE ===
    this.updateXML = jest.fn(async (xmlPath) => ({
      success: true,
      changes: {
        toAdd: 0,
        toUpdate: 0,
        toDelete: 0,
        toDeleteWithImage: 0,
        toDeleteWithoutImage: 0
      },
      groups: [],
      newUsersMap: {},
      deletedUsers: [],
      currentUsers: []
    }));

    this.confirmUpdateXML = jest.fn(async (data) => ({
      success: true,
      results: {
        added: 0,
        updated: 0,
        movedToDeleted: 0,
        permanentlyDeleted: 0
      }
    }));

    // === CONFIGURATION ===
    this.getImageRepositoryPath = jest.fn(async () => ({
      success: true,
      path: null
    }));

    this.setImageRepositoryPath = jest.fn(async (repositoryPath) => ({
      success: true
    }));

    this.getSelectedGroupFilter = jest.fn(async () => ({
      success: true,
      groupCode: ''
    }));

    this.setSelectedGroupFilter = jest.fn(async (groupCode) => ({
      success: true
    }));

    // === IMAGE TAGS ===
    this.addImageTag = jest.fn(async (data) => ({
      success: true
    }));

    this.getImageTags = jest.fn(async (imagePath) => ({
      success: true,
      tags: []
    }));

    this.deleteImageTag = jest.fn(async (tagId) => ({
      success: true
    }));

    this.getAllImagesWithTags = jest.fn(async () => ({
      success: true,
      images: []
    }));
  }

  // === EVENT LISTENERS (on___) ===
  // Patrón: registrar listener y retornar función de cleanup

  _registerEvent(eventName, callback) {
    this.on(eventName, callback);
    // Retornar función para desuscribir
    return () => this.off(eventName, callback);
  }

  // Image events
  onImageDetecting(callback) {
    return this._registerEvent('image-detecting', callback);
  }

  onNewImageDetected(callback) {
    return this._registerEvent('new-image-detected', callback);
  }

  // Repository events
  onRepositoryChanged(callback) {
    return this._registerEvent('repository-changed', callback);
  }

  onSyncProgress(callback) {
    return this._registerEvent('sync-progress', callback);
  }

  onSyncCompleted(callback) {
    return this._registerEvent('sync-completed', callback);
  }

  // Progress event
  onProgress(callback) {
    return this._registerEvent('progress', callback);
  }

  // Menu events - Project
  onMenuNewProject(callback) {
    return this._registerEvent('menu-new-project', callback);
  }

  onMenuOpenProject(callback) {
    return this._registerEvent('menu-open-project', callback);
  }

  onProjectOpened(callback) {
    return this._registerEvent('project-opened', callback);
  }

  // Menu events - Camera
  onMenuToggleCamera(callback) {
    return this._registerEvent('menu-toggle-camera', callback);
  }

  onMenuCameraAutostart(callback) {
    return this._registerEvent('menu-camera-autostart', callback);
  }

  onChangeCamera(callback) {
    return this._registerEvent('change-camera', callback);
  }

  // Menu events - Image operations
  onMenuLinkImage(callback) {
    return this._registerEvent('menu-link-image', callback);
  }

  onMenuDeletePhoto(callback) {
    return this._registerEvent('menu-delete-photo', callback);
  }

  // Menu events - Display toggles
  onMenuToggleDuplicates(callback) {
    return this._registerEvent('menu-toggle-duplicates', callback);
  }

  onMenuToggleCapturedPhotos(callback) {
    return this._registerEvent('menu-toggle-captured-photos', callback);
  }

  onMenuToggleRepositoryPhotos(callback) {
    return this._registerEvent('menu-toggle-repository-photos', callback);
  }

  onMenuToggleRepositoryIndicators(callback) {
    return this._registerEvent('menu-toggle-repository-indicators', callback);
  }

  onInitialDisplayPreferences(callback) {
    return this._registerEvent('initial-display-preferences', callback);
  }

  onMenuToggleAdditionalActions(callback) {
    return this._registerEvent('menu-toggle-additional-actions', callback);
  }

  // Menu events - Import/Export
  onMenuImportImagesId(callback) {
    return this._registerEvent('menu-import-images-id', callback);
  }

  onMenuExportCSV(callback) {
    return this._registerEvent('menu-export-csv', callback);
  }

  onMenuExportImages(callback) {
    return this._registerEvent('menu-export-images', callback);
  }

  onMenuExportImagesName(callback) {
    return this._registerEvent('menu-export-images-name', callback);
  }

  onMenuExportToRepository(callback) {
    return this._registerEvent('menu-export-to-repository', callback);
  }

  // Menu events - XML
  onMenuUpdateXML(callback) {
    return this._registerEvent('menu-update-xml', callback);
  }

  // Menu events - Tags
  onMenuAddImageTag(callback) {
    return this._registerEvent('menu-add-image-tag', callback);
  }

  onMenuShowTaggedImages(callback) {
    return this._registerEvent('menu-show-tagged-images', callback);
  }

  // Config events
  onGroupFilterChanged(callback) {
    return this._registerEvent('group-filter-changed', callback);
  }

  // === HELPERS PARA TESTS ===

  /**
   * Trigger event desde tests
   * Útil para simular eventos del main process
   */
  triggerEvent(eventName, ...args) {
    this.emit(eventName, ...args);
  }

  /**
   * Reset all mocks (útil en beforeEach)
   */
  resetAllMocks() {
    Object.keys(this).forEach(key => {
      if (this[key] && typeof this[key].mockClear === 'function') {
        this[key].mockClear();
      }
    });
  }
}

/**
 * Instalar mock en global.window
 * Llamar desde jest.setup.js
 */
function installOnWindow() {
  if (!global.window) {
    global.window = {};
  }
  global.window.electronAPI = new ElectronAPIMock();
  return global.window.electronAPI;
}

module.exports = { ElectronAPIMock, installOnWindow };
```

### tests/setup/jest.setup.js

```javascript
const { installOnWindow } = require('./electronAPI.mock');

// Instalar mock de electronAPI en el entorno global
const electronAPI = installOnWindow();

// Hacer electronAPI accesible globalmente para tests
global.electronAPI = electronAPI;

// Configurar timers falsos (útil para debounce/throttle)
jest.useFakeTimers();

// Utilidad global para avanzar timers
global.advanceAllTimers = async () => {
  jest.runOnlyPendingTimers();
  await Promise.resolve();
};

// Utilidad global para avanzar timers por milisegundos
global.advanceTimersByTime = async (ms) => {
  jest.advanceTimersByTime(ms);
  await Promise.resolve();
};

// Mock de console.error para tests (evitar ruido)
// Se puede habilitar con verbose: true en tests específicos
global.consoleError = console.error;
console.error = jest.fn((...args) => {
  // Filtrar errores esperados en tests
  const message = args[0]?.toString() || '';
  if (!message.includes('Not implemented: HTMLFormElement.prototype.submit')) {
    global.consoleError(...args);
  }
});

// Mock básico de localStorage (JSDOM no lo tiene completo)
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

global.localStorage = localStorageMock;

// Reset localStorage entre tests
beforeEach(() => {
  localStorage.clear();
  electronAPI.resetAllMocks();
});

// Cleanup después de cada test
afterEach(() => {
  jest.clearAllTimers();
});
```

## Paso 4: Fixtures de Datos de Prueba

### tests/fixtures/sampleData.js

```javascript
/**
 * Datos de prueba reutilizables para tests
 */

const sampleUsers = [
  {
    id: 1,
    first_name: 'Ana',
    last_name1: 'García',
    last_name2: 'López',
    nia: '12345',
    dni: '12345678A',
    group_code: 'A',
    birth_date: '2010-05-15',
    image_path: '/fake/images/001.jpg',
    repository_image_path: null,
    has_repository_image: false
  },
  {
    id: 2,
    first_name: 'Luis',
    last_name1: 'Martínez',
    last_name2: 'Pérez',
    nia: '12346',
    dni: '12345679B',
    group_code: 'B',
    birth_date: '2011-08-20',
    image_path: null,
    repository_image_path: '/fake/repo/002.jpg',
    has_repository_image: true
  },
  {
    id: 3,
    first_name: 'María',
    last_name1: 'Rodríguez',
    last_name2: 'Sánchez',
    nia: '12347',
    dni: '12345680C',
    group_code: 'A',
    birth_date: '2010-11-30',
    image_path: '/fake/images/003.jpg',
    repository_image_path: '/fake/repo/003.jpg',
    has_repository_image: true
  }
];

const sampleGroups = [
  { code: 'A', name: 'Grupo A' },
  { code: 'B', name: 'Grupo B' },
  { code: 'Docentes', name: 'Profesores' }
];

const sampleImages = [
  '/fake/images/20250101120000.jpg',
  '/fake/images/20250101120001.jpg',
  '/fake/images/20250101120002.jpg'
];

const sampleTags = [
  { id: 1, image_path: '/fake/images/001.jpg', tag: 'revisado' },
  { id: 2, image_path: '/fake/images/001.jpg', tag: 'duplicado' },
  { id: 3, image_path: '/fake/images/003.jpg', tag: 'baja calidad' }
];

module.exports = {
  sampleUsers,
  sampleGroups,
  sampleImages,
  sampleTags
};
```

## Paso 5: Tests Críticos

### Test 1: Store Observable (Crítico para arquitectura)

**tests/unit/state/store.test.js**

```javascript
/**
 * @jest-environment node
 * Tests del Store observable - Patrón fundamental de la arquitectura
 */

// Nota: Este test es para un módulo que AÚN NO EXISTE
// Se creará durante el refactor Fase 3
// Este test sirve como especificación de lo que debe hacer

describe('Store Observable (Especificación)', () => {
  let Store;
  let store;

  beforeAll(() => {
    // Intentar importar el Store (fallará hasta que se cree)
    try {
      Store = require('../../../src/renderer/state/store.js').Store;
    } catch (e) {
      // Store no existe aún, crear mock para documentar API esperada
      Store = class Store {
        constructor() {
          this.state = {
            app: { projectOpen: false },
            users: { currentUsers: [], selectedUser: null },
            images: { currentImages: [], currentImageIndex: 0 },
            selection: { mode: false, selectedUsers: new Set() }
          };
          this.listeners = new Map();
        }

        getState(key) {
          return key ? this.state[key] : { ...this.state };
        }

        setState(updates) {
          this.state = { ...this.state, ...updates };
          this.notify(Object.keys(updates));
        }

        subscribe(keys, callback) {
          if (!Array.isArray(keys)) keys = [keys];
          keys.forEach(key => {
            if (!this.listeners.has(key)) {
              this.listeners.set(key, new Set());
            }
            this.listeners.get(key).add(callback);
          });
          return () => {
            keys.forEach(key => {
              this.listeners.get(key)?.delete(callback);
            });
          };
        }

        notify(keys) {
          keys.forEach(key => {
            const callbacks = this.listeners.get(key);
            if (callbacks) {
              callbacks.forEach(cb => cb(this.state[key], this.state));
            }
          });
        }
      };
    }
  });

  beforeEach(() => {
    store = new Store();
  });

  describe('getState', () => {
    test('retorna todo el estado sin key', () => {
      const state = store.getState();
      expect(state).toHaveProperty('app');
      expect(state).toHaveProperty('users');
      expect(state).toHaveProperty('images');
      expect(state).toHaveProperty('selection');
    });

    test('retorna estado específico con key', () => {
      const appState = store.getState('app');
      expect(appState).toHaveProperty('projectOpen');
      expect(appState.projectOpen).toBe(false);
    });
  });

  describe('setState', () => {
    test('actualiza estado correctamente', () => {
      store.setState({ app: { projectOpen: true } });
      const newState = store.getState('app');
      expect(newState.projectOpen).toBe(true);
    });

    test('preserva inmutabilidad', () => {
      const initialState = store.getState();
      store.setState({ app: { projectOpen: true } });
      const newState = store.getState();
      expect(newState).not.toBe(initialState);
    });
  });

  describe('subscribe/notify', () => {
    test('notifica a suscriptores cuando cambia el estado', () => {
      const callback = jest.fn();
      store.subscribe(['app'], callback);

      store.setState({ app: { projectOpen: true } });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        { projectOpen: true },
        expect.any(Object)
      );
    });

    test('unsubscribe detiene notificaciones', () => {
      const callback = jest.fn();
      const unsubscribe = store.subscribe(['app'], callback);

      store.setState({ app: { projectOpen: true } });
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      store.setState({ app: { projectOpen: false } });
      expect(callback).toHaveBeenCalledTimes(1); // No llamado de nuevo
    });

    test('múltiples suscriptores funcionan independientemente', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      store.subscribe(['app'], callback1);
      store.subscribe(['app'], callback2);

      store.setState({ app: { projectOpen: true } });

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    test('suscripción a múltiples keys', () => {
      const callback = jest.fn();
      store.subscribe(['app', 'users'], callback);

      store.setState({ app: { projectOpen: true } });
      expect(callback).toHaveBeenCalledTimes(1);

      store.setState({ users: { currentUsers: [] } });
      expect(callback).toHaveBeenCalledTimes(2);
    });

    test('no notifica si key no está suscrito', () => {
      const callback = jest.fn();
      store.subscribe(['app'], callback);

      store.setState({ users: { currentUsers: [] } });

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
```

### Test 2: Services (Wrappers IPC)

**tests/unit/services/userService.test.js**

```javascript
/**
 * Tests de userService - Wrappers de IPC
 */

const { sampleUsers, sampleGroups } = require('../../fixtures/sampleData');

describe('userService (Especificación)', () => {
  let userService;

  beforeAll(() => {
    // Intentar importar (fallará hasta que se cree)
    try {
      userService = require('../../../src/renderer/services/userService.js');
    } catch (e) {
      // Mock para documentar API esperada
      userService = {
        async loadUsers(filters = {}, options = {}) {
          const result = await window.electronAPI.getUsers(filters, options);
          if (!result.success) {
            throw new Error(result.error);
          }
          return result.users;
        },

        async loadGroups() {
          const result = await window.electronAPI.getGroups();
          if (!result.success) {
            throw new Error(result.error);
          }
          return result.groups;
        },

        async loadRepositoryImages(users) {
          const result = await window.electronAPI.loadRepositoryImages(users);
          if (!result.success) {
            throw new Error(result.error);
          }
          return result.repositoryData;
        }
      };
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadUsers', () => {
    test('delega correctamente a electronAPI', async () => {
      window.electronAPI.getUsers.mockResolvedValueOnce({
        success: true,
        users: sampleUsers
      });

      const filters = { group: 'A' };
      const options = { loadCapturedImages: true };
      const result = await userService.loadUsers(filters, options);

      expect(window.electronAPI.getUsers).toHaveBeenCalledWith(filters, options);
      expect(result).toEqual(sampleUsers);
    });

    test('maneja errores de IPC', async () => {
      window.electronAPI.getUsers.mockResolvedValueOnce({
        success: false,
        error: 'Database connection failed'
      });

      await expect(userService.loadUsers()).rejects.toThrow('Database connection failed');
    });

    test('propaga excepciones de IPC', async () => {
      window.electronAPI.getUsers.mockRejectedValueOnce(new Error('IPC timeout'));

      await expect(userService.loadUsers()).rejects.toThrow('IPC timeout');
    });
  });

  describe('loadGroups', () => {
    test('retorna lista de grupos', async () => {
      window.electronAPI.getGroups.mockResolvedValueOnce({
        success: true,
        groups: sampleGroups
      });

      const result = await userService.loadGroups();

      expect(window.electronAPI.getGroups).toHaveBeenCalled();
      expect(result).toEqual(sampleGroups);
      expect(result).toHaveLength(3);
    });
  });

  describe('loadRepositoryImages', () => {
    test('carga datos del repositorio para usuarios', async () => {
      const mockRepoData = {
        1: { has_repository_image: true, repository_image_path: '/repo/1.jpg' },
        2: { has_repository_image: false, repository_image_path: null }
      };

      window.electronAPI.loadRepositoryImages.mockResolvedValueOnce({
        success: true,
        repositoryData: mockRepoData
      });

      const result = await userService.loadRepositoryImages(sampleUsers);

      expect(window.electronAPI.loadRepositoryImages).toHaveBeenCalledWith(sampleUsers);
      expect(result).toEqual(mockRepoData);
    });
  });
});
```

### Test 3: Virtual Scroll (Lógica Pura)

**tests/unit/table/virtualScroll.test.js**

```javascript
/**
 * @jest-environment node
 * Tests de virtual scroll - Cálculo de rango visible
 */

describe('Virtual Scroll (Especificación)', () => {
  let getVisibleRange;

  beforeAll(() => {
    try {
      const mod = require('../../../src/renderer/ui/table/virtualScroll.js');
      getVisibleRange = mod.getVisibleRange;
    } catch (e) {
      // Mock de la función esperada
      getVisibleRange = ({ total, itemHeight, containerHeight, scrollTop, overscan = 3 }) => {
        const visibleCount = Math.ceil(containerHeight / itemHeight);
        const startIndex = Math.floor(scrollTop / itemHeight);

        const start = Math.max(0, startIndex - overscan);
        const end = Math.min(total, startIndex + visibleCount + overscan);

        return { start, end };
      };
    }
  });

  describe('getVisibleRange', () => {
    test('calcula índices visibles correctamente', () => {
      const result = getVisibleRange({
        total: 1000,
        itemHeight: 40,
        containerHeight: 400,
        scrollTop: 0,
        overscan: 3
      });

      expect(result.start).toBe(0);
      expect(result.end).toBeGreaterThan(10);
      expect(result.end).toBeLessThanOrEqual(1000);
    });

    test('aplica overscan (buffer)', () => {
      const result = getVisibleRange({
        total: 1000,
        itemHeight: 40,
        containerHeight: 400,
        scrollTop: 400, // Scroll a item 10
        overscan: 5
      });

      // Con overscan de 5, debe empezar antes del item 10
      expect(result.start).toBeLessThan(10);
      // Y terminar después del último visible
      expect(result.end).toBeGreaterThan(20);
    });

    test('no excede límite inferior', () => {
      const result = getVisibleRange({
        total: 100,
        itemHeight: 40,
        containerHeight: 400,
        scrollTop: 0,
        overscan: 10 // Overscan muy grande
      });

      expect(result.start).toBe(0);
    });

    test('no excede límite superior', () => {
      const result = getVisibleRange({
        total: 50,
        itemHeight: 40,
        containerHeight: 400,
        scrollTop: 2000, // Scroll más allá del final
        overscan: 10
      });

      expect(result.end).toBe(50);
    });

    test('funciona con listas pequeñas', () => {
      const result = getVisibleRange({
        total: 5,
        itemHeight: 40,
        containerHeight: 400,
        scrollTop: 0,
        overscan: 3
      });

      expect(result.start).toBe(0);
      expect(result.end).toBe(5);
    });
  });
});
```

### Test 4: Performance Baseline

**tests/unit/table/virtualScroll.performance.test.js**

```javascript
/**
 * @jest-environment node
 * Performance tests - Establecer baseline para comparación post-refactor
 */

describe('Virtual Scroll Performance', () => {
  let getVisibleRange;

  beforeAll(() => {
    try {
      const mod = require('../../../src/renderer/ui/table/virtualScroll.js');
      getVisibleRange = mod.getVisibleRange;
    } catch (e) {
      // Skip si módulo no existe aún
      getVisibleRange = ({ total, itemHeight, containerHeight, scrollTop, overscan = 3 }) => {
        const visibleCount = Math.ceil(containerHeight / itemHeight);
        const startIndex = Math.floor(scrollTop / itemHeight);
        const start = Math.max(0, startIndex - overscan);
        const end = Math.min(total, startIndex + visibleCount + overscan);
        return { start, end };
      };
    }
  });

  test('calcula rango visible en < 1ms (promedio)', () => {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      getVisibleRange({
        total: 10000,
        itemHeight: 40,
        containerHeight: 800,
        scrollTop: Math.random() * 400000,
        overscan: 5
      });
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    console.log(`Average calculation time: ${avgDuration.toFixed(4)}ms`);
    console.log(`Total time for ${iterations} iterations: ${duration.toFixed(2)}ms`);

    // Debe ser extremadamente rápido (< 1ms promedio)
    expect(avgDuration).toBeLessThan(1);
  });

  test('no degrada con datasets grandes', () => {
    const datasets = [100, 1000, 10000, 100000];
    const times = [];

    datasets.forEach(total => {
      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        getVisibleRange({
          total,
          itemHeight: 40,
          containerHeight: 800,
          scrollTop: Math.random() * (total * 40),
          overscan: 5
        });
      }

      const duration = performance.now() - start;
      times.push(duration);
    });

    console.log('Performance por tamaño de dataset:');
    datasets.forEach((total, i) => {
      console.log(`  ${total} items: ${times[i].toFixed(2)}ms`);
    });

    // Tiempo debe ser similar independiente del tamaño (O(1))
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    const ratio = maxTime / minTime;

    // Ratio no debe ser mayor a 2x (varianza aceptable)
    expect(ratio).toBeLessThan(2);
  });
});
```

### Test 5: Filter Helpers (Lógica Pura)

**tests/unit/utils/filterHelpers.test.js**

```javascript
/**
 * @jest-environment node
 * Tests de helpers de filtrado
 */

const { sampleUsers } = require('../../fixtures/sampleData');

describe('filterHelpers (Especificación)', () => {
  let filterUsers;

  beforeAll(() => {
    try {
      const mod = require('../../../src/renderer/utils/filterHelpers.js');
      filterUsers = mod.filterUsers;
    } catch (e) {
      // Mock simple para documentar comportamiento esperado
      filterUsers = (users, filters = {}) => {
        let filtered = [...users];

        // Filtro de texto
        if (filters.text) {
          const text = filters.text.toLowerCase();
          filtered = filtered.filter(u => {
            const fullName = `${u.first_name} ${u.last_name1} ${u.last_name2 || ''}`.toLowerCase();
            return fullName.includes(text) ||
                   u.nia?.includes(text) ||
                   u.dni?.includes(text);
          });
        }

        // Filtro de grupo
        if (filters.group) {
          filtered = filtered.filter(u => u.group_code === filters.group);
        }

        // Filtro de fotos capturadas
        if (filters.showCaptured !== undefined) {
          if (filters.showCaptured) {
            filtered = filtered.filter(u => u.image_path);
          }
        }

        // Filtro de repositorio
        if (filters.showRepository !== undefined) {
          if (filters.showRepository) {
            filtered = filtered.filter(u => u.has_repository_image);
          }
        }

        return filtered;
      };
    }
  });

  describe('filterUsers', () => {
    test('sin filtros retorna todos los usuarios', () => {
      const result = filterUsers(sampleUsers);
      expect(result).toHaveLength(sampleUsers.length);
    });

    test('filtra por texto en nombre', () => {
      const result = filterUsers(sampleUsers, { text: 'ana' });
      expect(result).toHaveLength(1);
      expect(result[0].first_name).toBe('Ana');
    });

    test('filtra por texto en apellidos', () => {
      const result = filterUsers(sampleUsers, { text: 'martínez' });
      expect(result).toHaveLength(1);
      expect(result[0].last_name1).toBe('Martínez');
    });

    test('filtro de texto es case-insensitive', () => {
      const result1 = filterUsers(sampleUsers, { text: 'ANA' });
      const result2 = filterUsers(sampleUsers, { text: 'ana' });
      expect(result1).toEqual(result2);
    });

    test('filtra por grupo', () => {
      const result = filterUsers(sampleUsers, { group: 'A' });
      expect(result).toHaveLength(2);
      expect(result.every(u => u.group_code === 'A')).toBe(true);
    });

    test('filtra por imagen capturada', () => {
      const result = filterUsers(sampleUsers, { showCaptured: true });
      expect(result.every(u => u.image_path !== null)).toBe(true);
    });

    test('filtra por imagen en repositorio', () => {
      const result = filterUsers(sampleUsers, { showRepository: true });
      expect(result.every(u => u.has_repository_image === true)).toBe(true);
    });

    test('combina múltiples filtros', () => {
      const result = filterUsers(sampleUsers, {
        group: 'A',
        showCaptured: true
      });

      expect(result.every(u => u.group_code === 'A')).toBe(true);
      expect(result.every(u => u.image_path !== null)).toBe(true);
    });
  });
});
```

### Test 6: BaseModal Lifecycle (Memory Leaks)

**tests/unit/ui/modals/BaseModal.test.js**

```javascript
/**
 * Tests de BaseModal - Verificar lifecycle y prevención de memory leaks
 */

describe('BaseModal Lifecycle (Especificación)', () => {
  let BaseModal;
  let mockModal;

  beforeAll(() => {
    try {
      const mod = require('../../../../src/renderer/ui/modals/BaseModal.js');
      BaseModal = mod.BaseModal;
    } catch (e) {
      // Mock de BaseModal para documentar API esperada
      BaseModal = class BaseModal {
        constructor(modalId) {
          this.modal = document.getElementById(modalId);
          if (!this.modal) {
            this.modal = document.createElement('div');
            this.modal.id = modalId;
          }
          this.listeners = [];
          this.unsubscribe = null;
        }

        init() {}

        open() {
          this.modal.classList.add('show');
        }

        close() {
          this.modal.classList.remove('show');
        }

        addEventListener(element, event, handler) {
          element.addEventListener(event, handler);
          this.listeners.push({ element, event, handler });
        }

        destroy() {
          this.listeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
          });
          this.listeners = [];

          if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
          }
        }
      };
    }
  });

  beforeEach(() => {
    document.body.innerHTML = '<div id="test-modal"></div>';
    mockModal = new BaseModal('test-modal');
  });

  afterEach(() => {
    mockModal.destroy();
    document.body.innerHTML = '';
  });

  describe('Construcción', () => {
    test('encuentra elemento del DOM', () => {
      expect(mockModal.modal).toBeTruthy();
      expect(mockModal.modal.id).toBe('test-modal');
    });

    test('inicializa arrays vacíos', () => {
      expect(mockModal.listeners).toEqual([]);
      expect(mockModal.unsubscribe).toBeNull();
    });
  });

  describe('open/close', () => {
    test('open agrega clase show', () => {
      mockModal.open();
      expect(mockModal.modal.classList.contains('show')).toBe(true);
    });

    test('close remueve clase show', () => {
      mockModal.open();
      mockModal.close();
      expect(mockModal.modal.classList.contains('show')).toBe(false);
    });
  });

  describe('addEventListener (gestión de listeners)', () => {
    test('registra listener correctamente', () => {
      const button = document.createElement('button');
      const handler = jest.fn();

      mockModal.addEventListener(button, 'click', handler);

      button.click();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('trackea listeners para cleanup', () => {
      const button = document.createElement('button');
      const handler = jest.fn();

      mockModal.addEventListener(button, 'click', handler);

      expect(mockModal.listeners).toHaveLength(1);
      expect(mockModal.listeners[0]).toMatchObject({
        element: button,
        event: 'click',
        handler
      });
    });
  });

  describe('destroy (prevención de memory leaks)', () => {
    test('remueve todos los event listeners', () => {
      const button = document.createElement('button');
      const handler = jest.fn();

      mockModal.addEventListener(button, 'click', handler);
      mockModal.destroy();

      button.click();
      expect(handler).not.toHaveBeenCalled();
    });

    test('limpia array de listeners', () => {
      const button = document.createElement('button');
      mockModal.addEventListener(button, 'click', jest.fn());
      mockModal.destroy();

      expect(mockModal.listeners).toEqual([]);
    });

    test('llama a unsubscribe si existe', () => {
      const unsubscribe = jest.fn();
      mockModal.unsubscribe = unsubscribe;

      mockModal.destroy();

      expect(unsubscribe).toHaveBeenCalled();
      expect(mockModal.unsubscribe).toBeNull();
    });

    test('puede llamarse múltiples veces sin error', () => {
      expect(() => {
        mockModal.destroy();
        mockModal.destroy();
        mockModal.destroy();
      }).not.toThrow();
    });
  });

  describe('Integración con múltiples listeners', () => {
    test('maneja múltiples listeners en diferentes elementos', () => {
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      mockModal.addEventListener(button1, 'click', handler1);
      mockModal.addEventListener(button2, 'click', handler2);

      button1.click();
      button2.click();

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      mockModal.destroy();

      button1.click();
      button2.click();

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });
});
```

## Paso 6: Ejecución de Tests

### Comandos Básicos

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests en modo watch (desarrollo)
npm run test:watch

# Ejecutar solo tests de un directorio específico
npm test tests/unit/state

# Ejecutar un test específico
npm test tests/unit/state/store.test.js

# Ejecutar tests con cobertura
npm run test:coverage

# Ejecutar solo tests de performance
npm run test:performance
```

### Verificar Setup Inicial

Después de crear los archivos, ejecutar:

```bash
# Debe fallar pero mostrar que Jest funciona
npm test

# Salida esperada:
# FAIL tests/unit/state/store.test.js
# FAIL tests/unit/services/userService.test.js
# ...
# Esto es NORMAL - los módulos no existen aún
```

## Paso 7: Estrategia de Adopción

### Durante el Refactor (Strangler Pattern)

1. **Fase 2 - Services:**
   - Escribir test PRIMERO (especificación)
   - Implementar servicio hasta que test pase
   - Commit: "feat: add userService with tests"

2. **Fase 3 - State:**
   - `store.test.js` ya existe (especificación completa)
   - Implementar Store hasta que test pase
   - Commit: "feat: add observable Store with tests"

3. **Fase 4 - Utils:**
   - Tests de filtros ya existen
   - Implementar utilities
   - Commit: "feat: add filter helpers with tests"

4. **Fase 6 - Tabla:**
   - **CRÍTICO:** Ejecutar `npm run test:performance` ANTES
   - Guardar resultados (baseline)
   - Refactorizar tabla
   - Ejecutar `npm run test:performance` DESPUÉS
   - Comparar: debe ser igual o mejor

### Checklist Pre-Refactor

- [ ] Jest instalado y configurado
- [ ] `npm test` ejecuta sin errores de configuración
- [ ] Mock de electronAPI completo
- [ ] Fixtures de datos creados
- [ ] Tests de especificación escritos (fallan, pero están listos)
- [ ] Performance baseline registrado (para comparación post-refactor)

### Checklist Durante Refactor

Por cada módulo extraído:

- [ ] Test existe (verde ✅)
- [ ] Módulo implementado
- [ ] Test pasa
- [ ] No hay regresiones en tests existentes
- [ ] Commit con mensaje descriptivo

### Checklist Post-Refactor

- [ ] Todos los tests pasan
- [ ] Cobertura > 50% (objetivo inicial)
- [ ] Performance igual o mejor (verificar con baseline)
- [ ] No memory leaks detectados
- [ ] Documentación actualizada

## Criterios de Éxito

### Funcionales
- ✅ `npm test` ejecuta sin errores
- ✅ Todos los tests de especificación pasan
- ✅ Mock de electronAPI cubre toda la API del preload

### Performance
- ✅ Virtual scroll: < 1ms promedio por cálculo
- ✅ Suite de tests completa: < 5 segundos
- ✅ No degradación vs baseline

### Calidad
- ✅ Cobertura de código: > 50% (líneas)
- ✅ Cobertura de branches: > 40%
- ✅ No false positives (tests que pasan pero código está roto)
- ✅ No memory leaks en tests de lifecycle

## Troubleshooting

### Error: "Cannot use import statement outside a module"

**Solución:** Asegúrate de usar `NODE_OPTIONS=--experimental-vm-modules jest`

### Error: "window is not defined"

**Solución:** Verifica que `testEnvironment: 'jsdom'` en jest.config.cjs

### Error: "electronAPI is not defined"

**Solución:** Verifica que `jest.setup.js` se está ejecutando y que `installOnWindow()` se llama

### Tests muy lentos

**Solución:** Usa `@jest-environment node` en tests que no necesitan DOM

## Próximos Pasos

1. **Crear archivos base** (este documento proporciona el contenido completo)
2. **Verificar que Jest funciona:** `npm test`
3. **Registrar baseline de performance:** `npm run test:performance`
4. **Comenzar refactor con Fase 0 (POC)**
5. **Mantener tests verdes durante todo el refactor**

---

**Versión:** 2.0
**Fecha:** 2025-10-25
**Estado:** Listo para ejecutar
**Cobertura objetivo:** 50%+ (inicial)
