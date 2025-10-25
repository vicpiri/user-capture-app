# Explicación de Patrones de Arquitectura del Refactor

Este documento explica en detalle los 3 patrones fundamentales utilizados en el refactor de `renderer.js`.

---

## 🎯 Patrón 1: Store Observable (Gestión de Estado Reactiva)

### ¿Qué Problema Resuelve?

En `renderer.js` actual tenemos **15+ variables globales** dispersas:
```javascript
let currentUsers = [];
let selectedUser = null;
let projectOpen = false;
let showDuplicatesOnly = false;
// ... etc
```

**Problemas:**
- No sabes quién modifica qué
- Difícil sincronizar UI con datos
- No hay forma de reaccionar a cambios

### La Solución: Store Observable

**Concepto:** Un objeto centralizado que:
1. **Almacena** todo el estado en un lugar
2. **Notifica** a quien esté interesado cuando algo cambia
3. Permite **suscripciones** reactivas

### Cómo Funciona (Paso a Paso)

#### 1. Inicialización

```javascript
class Store {
  constructor() {
    // Estado centralizado
    this.state = {
      app: { projectOpen: false, message: '...' },
      users: { currentUsers: [], selectedUser: null },
      images: { currentImages: [], currentImageIndex: 0 }
    };

    // Mapa de listeners: key -> Set de callbacks
    this.listeners = new Map();
    //   'app' -> Set([callback1, callback2])
    //   'users' -> Set([callback3])
  }
}
```

#### 2. Obtener Estado (Read)

```javascript
// Obtener TODO el estado
const allState = store.getState();
// { app: {...}, users: {...}, images: {...} }

// Obtener PARTE del estado
const appState = store.getState('app');
// { projectOpen: false, message: '...' }
```

**Importante:** Retorna una **copia**, no el original (inmutabilidad).

#### 3. Actualizar Estado (Write)

```javascript
// Actualizar estado
store.setState({
  app: { projectOpen: true, message: 'Proyecto abierto' }
});

// ¿Qué pasa internamente?
// 1. Actualiza: this.state = { ...this.state, app: {...} }
// 2. Llama a: this.notify(['app'])
// 3. Todos los que escuchan 'app' son notificados
```

#### 4. Suscribirse a Cambios (Subscribe)

```javascript
// Suscribirse a cambios en 'app'
const unsubscribe = store.subscribe(['app'], (appState, fullState) => {
  console.log('¡App cambió!', appState);
  // Actualizar UI aquí
});

// Cuando ya no necesites escuchar:
unsubscribe();
```

**Lo que pasa internamente:**
```javascript
subscribe(keys, callback) {
  keys.forEach(key => {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    // Agregar callback al Set de la key
    this.listeners.get(key).add(callback);
  });

  // Retornar función de cleanup
  return () => {
    keys.forEach(key => {
      this.listeners.get(key)?.delete(callback);
    });
  };
}
```

#### 5. Notificar a Suscriptores (Notify)

```javascript
notify(keys) {
  keys.forEach(key => {
    const callbacks = this.listeners.get(key);
    if (callbacks && callbacks.size > 0) {
      // Llamar a TODOS los callbacks registrados
      callbacks.forEach(callback => {
        callback(this.state[key], this.state);
      });
    }
  });
}
```

### Ejemplo Completo en Acción

```javascript
// === COMPONENTE A: Tabla de Usuarios ===
class UserTable {
  init() {
    // Suscribirse a cambios en 'users'
    this.unsubscribe = store.subscribe(['users'], (usersState) => {
      console.log('Usuarios cambiaron, re-renderizar tabla');
      this.render(usersState.currentUsers);
    });
  }

  destroy() {
    // Limpiar suscripción
    this.unsubscribe();
  }
}

// === COMPONENTE B: Botón de Cargar Usuarios ===
async function loadUsersButton() {
  const users = await userService.loadUsers();

  // Actualizar estado (ESTO notifica a UserTable automáticamente)
  store.setState({
    users: { currentUsers: users }
  });

  // UserTable.render() se ejecuta automáticamente!
}
```

**Flujo:**
```
loadUsersButton()
  → store.setState({ users: {...} })
    → store.notify(['users'])
      → Llama a callback de UserTable
        → UserTable.render() se ejecuta
```

**Ventaja:** Los componentes están **desacoplados**. `loadUsersButton` no sabe que existe `UserTable`, pero funciona automáticamente.

---

## 🎯 Patrón 2: Service Pattern (Wrappers de IPC)

### ¿Qué Problema Resuelve?

En `renderer.js` actual, las llamadas a `window.electronAPI` están **dispersas por todas partes**:

```javascript
// En función X
const result = await window.electronAPI.getUsers(filters);

// En función Y
const groups = await window.electronAPI.getGroups();

// En función Z
window.electronAPI.linkImageToUser({...});
```

**Problemas:**
- Código duplicado (manejo de errores, validación)
- Difícil de testear (acoplado a window.electronAPI)
- Lógica mezclada con UI

### La Solución: Services

**Concepto:** Crear funciones dedicadas que **wrappean** `window.electronAPI`:

```javascript
// services/userService.js
async function loadUsers(filters = {}, options = {}) {
  const result = await window.electronAPI.getUsers(filters, options);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.users;
}
```

### Cómo Funciona

#### 1. Servicio Básico

```javascript
// services/userService.js
async function loadUsers(filters = {}) {
  // 1. Llamar a IPC
  const result = await window.electronAPI.getUsers(filters);

  // 2. Validar respuesta
  if (!result.success) {
    throw new Error(result.error);
  }

  // 3. Retornar datos limpios
  return result.users;
}
```

#### 2. Uso desde Handler

```javascript
// handlers/userHandlers.js
import { loadUsers } from '../services/userService.js';

async function handleLoadUsers() {
  try {
    // Llamar al servicio (abstracción limpia)
    const users = await loadUsers({ group: 'A' });

    // Actualizar estado
    store.setState({ users: { currentUsers: users } });

  } catch (error) {
    // Manejo centralizado de errores
    showErrorModal('Error al cargar usuarios: ' + error.message);
  }
}
```

### Ventajas

**1. Testing:**
```javascript
// Sin servicio (difícil de testear)
test('load users', async () => {
  // ¿Cómo mockeo window.electronAPI?
});

// Con servicio (fácil de testear)
test('load users', async () => {
  const mockAPI = {
    getUsers: jest.fn().mockResolvedValue({ success: true, users: [...] })
  };
  const users = await loadUsers.call({ electronAPI: mockAPI });
  expect(users).toHaveLength(3);
});
```

**2. Reutilización:**
```javascript
// Llamar desde múltiples lugares
handleLoadUsersButton() { await loadUsers(); }
handleRefreshData() { await loadUsers(); }
handleFilterChange() { await loadUsers({ group: 'B' }); }
```

**3. Manejo de Errores Centralizado:**
```javascript
async function loadUsers(filters = {}) {
  try {
    const result = await window.electronAPI.getUsers(filters);

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.users;

  } catch (error) {
    console.error('[UserService] Error loading users:', error);
    throw error; // Propagar para que handler decida qué hacer
  }
}
```

### Ejemplo POC vs Real

**POC (simulado):**
```javascript
async function loadUsers(filters = {}) {
  // Simular latencia
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { id: 1, name: 'Ana' },
        { id: 2, name: 'Luis' }
      ]);
    }, 500);
  });
}
```

**Real (producción):**
```javascript
async function loadUsers(filters = {}, options = {}) {
  const result = await window.electronAPI.getUsers(filters, options);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.users;
}
```

---

## 🎯 Patrón 3: BaseModal con Lifecycle (Prevención de Memory Leaks)

### ¿Qué Problema Resuelve?

En `renderer.js` actual, los modales se manejan así:

```javascript
const confirmModal = document.getElementById('confirm-modal');
const yesBtn = document.getElementById('confirm-yes-btn');

// Agregar listener
yesBtn.addEventListener('click', () => {
  confirmModal.classList.remove('show');
  onConfirm();
});

// ❌ PROBLEMA: El listener NUNCA se limpia
// Si el modal se destruye/recrea, el listener sigue en memoria
// = MEMORY LEAK
```

### La Solución: Lifecycle Management

**Concepto:** Cada componente tiene un **ciclo de vida** explícito:
- `init()` - Crear y registrar listeners
- `destroy()` - Limpiar listeners y recursos

### Cómo Funciona

#### 1. Clase Base (BaseModal)

```javascript
class BaseModal {
  constructor(modalId) {
    this.modal = document.getElementById(modalId);
    this.listeners = []; // Array para trackear listeners
    this.unsubscribe = null; // Cleanup del store
  }

  // Método para agregar listeners CON TRACKING
  addEventListener(element, event, handler) {
    element.addEventListener(event, handler);

    // Guardar referencia para cleanup
    this.listeners.push({ element, event, handler });
  }

  // Método para limpiar TODO
  destroy() {
    // Remover TODOS los listeners
    this.listeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.listeners = [];

    // Limpiar suscripción al store
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}
```

#### 2. Modal Específico (Extiende BaseModal)

```javascript
class ConfirmModal extends BaseModal {
  constructor() {
    super('confirm-modal'); // ID del modal
    this.yesBtn = document.getElementById('confirm-yes-btn');
    this.noBtn = document.getElementById('confirm-no-btn');
  }

  init() {
    // Usar addEventListener de BaseModal (con tracking)
    this.addEventListener(this.yesBtn, 'click', () => {
      this.handleYes();
    });

    this.addEventListener(this.noBtn, 'click', () => {
      this.close();
    });

    // Suscribirse al store
    this.unsubscribe = store.subscribe(['app'], (appState) => {
      // Reaccionar a cambios
    });
  }

  handleYes() {
    this.close();
    if (this.onConfirm) this.onConfirm();
  }

  // destroy() heredado de BaseModal - limpia automáticamente
}
```

#### 3. Uso en la Aplicación

```javascript
// === CREAR E INICIALIZAR ===
const confirmModal = new ConfirmModal();
confirmModal.init();

// Modal funcionando...
confirmModal.show('¿Estás seguro?', () => {
  console.log('Confirmado!');
});

// === DESTRUIR (cuando ya no se necesite) ===
confirmModal.destroy();

// Listeners limpiados ✅
// Suscripciones limpiadas ✅
// No memory leaks ✅
```

### Tracking de Listeners (Lo Importante)

**Sin tracking (MALO):**
```javascript
yesBtn.addEventListener('click', handler);
// Si destruyes el modal, el listener queda en memoria
```

**Con tracking (BUENO):**
```javascript
addEventListener(yesBtn, 'click', handler) {
  yesBtn.addEventListener('click', handler);
  this.listeners.push({ element: yesBtn, event: 'click', handler });
}

destroy() {
  this.listeners.forEach(({ element, event, handler }) => {
    element.removeEventListener(event, handler); // ✅ Limpiado
  });
}
```

### Ejemplo Completo en Acción

```javascript
// === APP INITIALIZATION ===
const confirmModal = new ConfirmModal();
confirmModal.init();

const infoModal = new InfoModal();
infoModal.init();

// === USAR MODAL ===
confirmModal.show('¿Eliminar usuario?', async () => {
  await deleteUser();
  infoModal.show('Usuario eliminado');
});

// === CLEANUP (cuando cierras la app o cambias de página) ===
confirmModal.destroy();
infoModal.destroy();
```

### Por Qué Es Importante

**Sin lifecycle:**
```
Crear modal → Agregar listeners → Usar → (Listeners quedan en memoria)
Crear de nuevo → Agregar listeners → Usar → (MÁS listeners en memoria)
...
= MEMORY LEAK que hace la app más lenta con el tiempo
```

**Con lifecycle:**
```
Crear modal → init() → Usar → destroy() → (Todo limpio)
Crear de nuevo → init() → Usar → destroy() → (Todo limpio)
...
= Sin memory leaks, rendimiento constante
```

---

## 🔗 Cómo se Conectan los 3 Patrones

### Flujo Completo de una Operación

Ejemplo: Usuario hace clic en "Cargar Usuarios"

```javascript
// 1. UI captura el evento
button.addEventListener('click', handleLoadUsers);

// 2. Handler orquesta (usa servicio y store)
async function handleLoadUsers() {
  try {
    // 2a. Llamar al servicio
    const users = await loadUsers({ group: 'A' });

    // 2b. Actualizar store
    store.setState({ users: { currentUsers: users } });

  } catch (error) {
    showErrorModal(error.message);
  }
}

// 3. Store notifica a suscriptores
store.setState(...) → store.notify(['users'])

// 4. Tabla reacciona automáticamente
class UserTable {
  init() {
    this.unsubscribe = store.subscribe(['users'], (usersState) => {
      this.render(usersState.currentUsers); // ✅ Se ejecuta automáticamente
    });
  }
}
```

### Arquitectura Visual

```
┌─────────────────────────────────────────┐
│              USER CLICK                 │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│            HANDLER                      │
│  (orquesta servicio + store)            │
└────────┬─────────────────┬──────────────┘
         │                 │
         ↓                 ↓
┌─────────────────┐  ┌──────────────────┐
│    SERVICE      │  │     STORE        │
│  (IPC wrapper)  │  │  (state mgmt)    │
└─────────────────┘  └────────┬─────────┘
                              │
                              ↓ notify()
                     ┌────────────────┐
                     │  SUBSCRIPTORS  │
                     │  (UI updates)  │
                     └────────────────┘
```

### Flujo Unidireccional de Datos

```
USER ACTION
    ↓
HANDLER (orchestration)
    ↓
SERVICE (data fetching)
    ↓
STORE (state update)
    ↓
NOTIFY (reactive notification)
    ↓
UI COMPONENTS (automatic re-render)
```

**Regla de Oro:** Los datos fluyen en UNA sola dirección. Nunca hacia atrás.

---

## 📝 Resumen de Ventajas

| Patrón | Problema que Resuelve | Ventaja Principal | Implementación |
|--------|----------------------|-------------------|----------------|
| **Store Observable** | Estado disperso, difícil sincronizar | Reactividad automática | `store.setState()` → notifica → UI actualiza |
| **Services** | Llamadas IPC duplicadas, difícil testear | Reutilización y testing | Wrappea `window.electronAPI` |
| **BaseModal Lifecycle** | Memory leaks por listeners no limpiados | Gestión de recursos | `init()` registra, `destroy()` limpia |

---

## 🎓 Conceptos Clave

### Inmutabilidad

```javascript
// MALO (mutable)
this.state.users = newUsers;

// BUENO (inmutable)
this.state = { ...this.state, users: newUsers };
```

**Por qué:** Si cambias el objeto directamente, las comparaciones fallan y no sabes qué cambió.

### Desacoplamiento

```javascript
// MALO (acoplado)
function loadUsers() {
  const users = await fetch(...);
  updateTable(users); // Componente A conoce a Componente B
}

// BUENO (desacoplado)
function loadUsers() {
  const users = await fetch(...);
  store.setState({ users }); // Store notifica a quien escuche
}
```

**Por qué:** Si eliminas `updateTable`, el código se rompe. Con store, los componentes no se conocen entre sí.

### Single Responsibility

```javascript
// MALO (hace todo)
async function handleButton() {
  const result = await window.electronAPI.getUsers();
  if (!result.success) throw Error(...);
  this.state.users = result.users;
  updateTable();
}

// BUENO (separación de responsabilidades)
async function handleButton() {
  const users = await userService.loadUsers(); // Service: solo datos
  store.setState({ users }); // Store: solo estado
  // Tabla se actualiza sola por suscripción
}
```

---

## 🔍 Casos de Uso Reales

### Caso 1: Cargar y Filtrar Usuarios

```javascript
// Service
async function loadUsers(filters = {}) {
  const result = await window.electronAPI.getUsers(filters);
  if (!result.success) throw new Error(result.error);
  return result.users;
}

// Handler
async function handleFilterChange(groupCode) {
  try {
    const users = await loadUsers({ group: groupCode });
    store.setState({ users: { currentUsers: users } });
  } catch (error) {
    showErrorModal(error.message);
  }
}

// UI Component
class UserTable {
  init() {
    this.unsubscribe = store.subscribe(['users'], (usersState) => {
      this.render(usersState.currentUsers);
    });
  }

  render(users) {
    // Actualizar DOM
  }

  destroy() {
    this.unsubscribe();
  }
}
```

### Caso 2: Modal de Confirmación

```javascript
// BaseModal (reutilizable)
class ConfirmModal extends BaseModal {
  constructor() {
    super('confirm-modal');
    this.message = this.modal.querySelector('.message');
    this.yesBtn = this.modal.querySelector('.yes-btn');
    this.noBtn = this.modal.querySelector('.no-btn');
  }

  init() {
    this.addEventListener(this.noBtn, 'click', () => this.close());
  }

  show(message, onConfirm) {
    this.message.textContent = message;

    // Crear handler one-time
    const handleYes = () => {
      this.close();
      onConfirm();
      this.yesBtn.removeEventListener('click', handleYes);
    };

    this.yesBtn.addEventListener('click', handleYes);
    this.open();
  }
}

// Uso
const confirmModal = new ConfirmModal();
confirmModal.init();

confirmModal.show('¿Eliminar usuario?', async () => {
  await deleteUser();
  await loadUsers(); // Recargar lista
});
```

### Caso 3: Sincronización de Múltiples Componentes

```javascript
// Múltiples componentes escuchan el mismo estado
class UserTable {
  init() {
    this.unsubscribe = store.subscribe(['users'], (usersState) => {
      this.render(usersState.currentUsers);
    });
  }
}

class UserCount {
  init() {
    this.unsubscribe = store.subscribe(['users'], (usersState) => {
      this.updateCount(usersState.currentUsers.length);
    });
  }
}

class ExportButton {
  init() {
    this.unsubscribe = store.subscribe(['users'], (usersState) => {
      // Habilitar/deshabilitar según si hay usuarios
      this.button.disabled = usersState.currentUsers.length === 0;
    });
  }
}

// Cuando cargas usuarios, los 3 componentes se actualizan automáticamente
store.setState({ users: { currentUsers: [...] } });
// → UserTable re-renderiza
// → UserCount actualiza número
// → ExportButton se habilita
```

---

## 🚀 Migración Gradual

### Cómo Aplicar en el Refactor

**No hace falta refactorizar todo de golpe.** Se puede migrar gradualmente:

#### 1. Fase: Solo Store

```javascript
// Migrar una variable a store
// ANTES:
let currentUsers = [];

// DESPUÉS:
store.setState({ users: { currentUsers: [] } });
const users = store.getState('users').currentUsers;
```

#### 2. Fase: Agregar Servicios

```javascript
// Extraer llamadas IPC a servicios
// ANTES:
const result = await window.electronAPI.getUsers(...);

// DESPUÉS:
const users = await userService.loadUsers(...);
```

#### 3. Fase: Agregar Suscripciones

```javascript
// Hacer componentes reactivos
// ANTES:
function updateTable(users) {
  // render...
}

// DESPUÉS:
store.subscribe(['users'], (usersState) => {
  // render...
});
```

---

## 📚 Referencias

### Documentos Relacionados

- `RENDERER_REFACTORING_V2.md` - Plan completo de refactorización
- `RENDERER_TESTING_PREP_V2.md` - Preparación de tests
- `src/renderer/_poc/README.md` - Cómo probar el POC
- `TESTING_SETUP_COMPLETE.md` - Estado actual de testing

### Conceptos de Programación

- **Observable Pattern** - https://en.wikipedia.org/wiki/Observer_pattern
- **Service Layer Pattern** - Separación de lógica de datos
- **Component Lifecycle** - Init/Destroy pattern
- **Unidirectional Data Flow** - Flujo de datos en una dirección
- **Single Responsibility Principle** - Cada módulo hace una cosa

---

**Versión:** 1.0
**Fecha:** 2025-10-25
**Estado:** Documentación completa
**Autor:** Basado en POC Fase 0 del refactor
