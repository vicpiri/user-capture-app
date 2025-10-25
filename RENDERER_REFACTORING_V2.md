# Plan de Refactorización de renderer.js - Versión 2.0

> **Actualización:** Este plan incorpora las observaciones y recomendaciones del análisis de revisión técnica.

## Objetivo
Refactorizar el archivo `renderer.js` (2143 líneas) en módulos organizados por responsabilidad, con arquitectura unidireccional clara, sistema de módulos definido, y gestión de lifecycle de componentes.

## Problema Actual
- Archivo monolítico de 2143 líneas con múltiples responsabilidades mezcladas
- Gestión de estado global dispersa (15+ variables globales)
- Lógica de UI, modales, eventos, y datos mezclados sin separación clara
- Difícil mantenimiento y testing
- Código duplicado en funciones de exportación
- Sin gestión de lifecycle de componentes (riesgo de memory leaks)
- Riesgo de dependencias circulares sin arquitectura clara

## Arquitectura Propuesta

### Flujo Unidireccional de Datos
```
┌──────────────┐
│   Services   │ ← Wrappers de window.electronAPI (IPC)
│   (IPC)      │   Solo operaciones de datos, retornan Promises
└──────┬───────┘   No tocan DOM
       │
       ↓
┌──────────────┐
│    State     │ ← Fuente única de verdad (Store observable)
│   (Store)    │   Expone getters, setters, suscripciones
└──────┬───────┘   No conoce UI
       │
       ↓
┌──────────────┐
│   Handlers   │ ← Orquestación de interacciones
│ (Orchestra)  │   Usan services y state
└──────┬───────┘   No almacenan estado duradero
       │
       ↓
┌──────────────┐
│      UI      │ ← Manipulación del DOM
│ (Components) │   Se suscriben al store
└──────────────┘   Implementan init()/destroy()
       │
       ↓ (observers/subscriptions)
    [Store]
```

**Regla crítica:** NO permitir flujo inverso. Las capas superiores NO conocen las inferiores.

## Sistema de Módulos

### Decisión: ES Modules Nativos
- **Sintaxis:** `import`/`export` nativo de ES6
- **Soporte:** Electron soporta ES Modules nativamente con `contextIsolation`
- **Ventajas:**
  - No requiere bundler
  - Tree-shaking automático
  - Imports estáticos verificables
  - Debugging más claro

### Configuración en HTML
```html
<!-- renderer.html -->
<script type="module" src="renderer.js"></script>
```

### Barrel Exports (Index Pattern)
Cada carpeta tendrá un `index.js` para rutas estables:

```javascript
// state/index.js
export { default as store } from './store.js';
export { appState } from './appState.js';
export { userState } from './userState.js';
export { imageState } from './imageState.js';
export { selectionState } from './selectionState.js';

// Uso:
import { store, userState } from './state/index.js';
```

## Estructura de Archivos

```
src/renderer/
├── renderer.js                  # Punto de entrada (< 100 líneas)
├── state/                       # Gestión de estado
│   ├── index.js                # Barrel export
│   ├── store.js                # Store observable central
│   ├── appState.js             # Estado de aplicación
│   ├── userState.js            # Estado de usuarios
│   ├── imageState.js           # Estado de imágenes
│   └── selectionState.js       # Estado de selección
├── services/                    # Capa de datos (IPC wrappers)
│   ├── index.js                # Barrel export
│   ├── userService.js          # Operaciones de usuarios
│   ├── imageService.js         # Operaciones de imágenes
│   ├── repositoryService.js    # Gestión del repositorio
│   └── cameraService.js        # Detección de cámaras
├── handlers/                    # Orquestación
│   ├── index.js                # Barrel export
│   ├── projectHandlers.js      # Gestión de proyectos
│   ├── userHandlers.js         # Operaciones con usuarios
│   ├── imageHandlers.js        # Operaciones con imágenes
│   ├── exportHandlers.js       # Exportación
│   ├── importHandlers.js       # Importación
│   ├── tagHandlers.js          # Gestión de etiquetas
│   ├── xmlHandlers.js          # Actualización de XML
│   └── menuHandlers.js         # Eventos del menú
├── ui/                          # Componentes de interfaz
│   ├── index.js                # Barrel export
│   ├── modals/                 # Gestión de modales
│   │   ├── index.js            # Barrel export
│   │   ├── BaseModal.js        # Clase base para modales
│   │   ├── ConfirmModal.js     # Modal de confirmación
│   │   ├── InfoModal.js        # Modal de información
│   │   ├── ProgressModal.js    # Modal de progreso
│   │   ├── ProjectModal.js     # Modal de nuevo proyecto
│   │   ├── ExportOptionsModal.js # Modal de opciones exportación
│   │   ├── AddTagModal.js      # Modal de agregar etiqueta
│   │   ├── TaggedImagesModal.js # Modal de imágenes etiquetadas
│   │   └── UserImageModal.js   # Modal de imagen de usuario
│   ├── table/                  # Tabla de usuarios
│   │   ├── index.js            # Barrel export
│   │   ├── UserTable.js        # Gestión principal de tabla
│   │   ├── UserRow.js          # Creación de filas
│   │   ├── VirtualScroll.js    # Scroll virtual
│   │   └── LazyLoading.js      # Carga lazy de imágenes
│   ├── ImagePreview.js         # Preview de imágenes
│   ├── Filters.js              # Filtros y búsqueda
│   ├── ContextMenu.js          # Menú contextual
│   └── DragAndDrop.js          # Drag & drop de imágenes
└── utils/                       # Utilidades puras
    ├── index.js                # Barrel export
    ├── domHelpers.js           # Helpers DOM
    ├── filterHelpers.js        # Helpers de filtrado
    └── navigationHelpers.js    # Navegación por teclado
```

## Contratos entre Capas

### Services (Capa de Datos)
```javascript
/**
 * Services solo interactúan con window.electronAPI
 * - NO tocan el DOM
 * - NO almacenan estado
 * - Retornan Promises
 * - Manejo de errores consistente
 */

// userService.js
export async function loadUsers(filters = {}, options = {}) {
  try {
    const result = await window.electronAPI.getUsers(filters, options);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.users;
  } catch (error) {
    console.error('Error loading users:', error);
    throw error;
  }
}
```

### State (Store Observable)
```javascript
/**
 * Store centralizado con patrón observable
 * - Fuente única de verdad
 * - Expone getters, setters
 * - Sistema de suscripciones para reactividad
 * - NO conoce UI ni handlers
 * - Inmutabilidad por defecto
 */

// store.js
class Store {
  constructor() {
    this.state = {
      app: { projectOpen: false, ... },
      users: { currentUsers: [], ... },
      images: { currentImages: [], ... },
      selection: { mode: false, ... }
    };
    this.listeners = new Map(); // key -> Set of callbacks
  }

  // Get state (inmutable)
  getState(key) {
    return key ? this.state[key] : { ...this.state };
  }

  // Update state (con notificación)
  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.notify(Object.keys(updates));
  }

  // Suscripción a cambios
  subscribe(keys, callback) {
    if (!Array.isArray(keys)) keys = [keys];

    keys.forEach(key => {
      if (!this.listeners.has(key)) {
        this.listeners.set(key, new Set());
      }
      this.listeners.get(key).add(callback);
    });

    // Retornar función de cleanup
    return () => {
      keys.forEach(key => {
        this.listeners.get(key)?.delete(callback);
      });
    };
  }

  // Notificar cambios
  notify(keys) {
    keys.forEach(key => {
      const callbacks = this.listeners.get(key);
      if (callbacks) {
        callbacks.forEach(cb => cb(this.state[key], this.state));
      }
    });
  }
}

export const store = new Store();
```

### Handlers (Orquestación)
```javascript
/**
 * Handlers orquestan interacciones usuario/sistema
 * - Usan services para datos
 * - Usan store para estado
 * - NO almacenan estado interno duradero
 * - Coordinan UI y datos
 */

// projectHandlers.js
import { store } from '../state/index.js';
import * as userService from '../services/userService.js';
import { showProgressModal, closeProgressModal } from '../ui/modals/index.js';

export async function handleOpenProject() {
  const result = await window.electronAPI.showOpenDialog({
    properties: ['openDirectory']
  });

  if (result.canceled) return;

  showProgressModal('Abriendo Proyecto', 'Cargando datos...');

  try {
    const openResult = await window.electronAPI.openProject(result.filePaths[0]);

    if (openResult.success) {
      store.setState({ app: { projectOpen: true } });
      await loadProjectData();
    } else {
      throw new Error(openResult.error);
    }
  } catch (error) {
    showInfoModal('Error', 'Error al abrir el proyecto: ' + error.message);
  } finally {
    closeProgressModal();
  }
}
```

### UI Components (Presentación)
```javascript
/**
 * Componentes UI manipulan el DOM
 * - Reciben dependencias por parámetro (DI)
 * - Se suscriben al store para reactividad
 * - Implementan init() y destroy()
 * - Limpian listeners en destroy()
 */

// ui/modals/BaseModal.js
export class BaseModal {
  constructor(modalId) {
    this.modal = document.getElementById(modalId);
    this.listeners = [];
    this.unsubscribe = null;
  }

  init() {
    // Override en subclases
  }

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
    // Limpiar todos los listeners
    this.listeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.listeners = [];

    // Limpiar suscripción al store
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}

// Uso en modal específico
export class ConfirmModal extends BaseModal {
  constructor() {
    super('confirm-modal');
    this.messageEl = document.getElementById('confirm-message');
    this.yesBtn = document.getElementById('confirm-yes-btn');
    this.noBtn = document.getElementById('confirm-no-btn');
  }

  init() {
    this.addEventListener(this.noBtn, 'click', () => this.close());
  }

  show(message, onConfirm) {
    this.messageEl.textContent = message;

    // Setup one-time confirm handler
    const confirmHandler = () => {
      this.close();
      onConfirm();
      this.yesBtn.removeEventListener('click', confirmHandler);
    };

    this.yesBtn.addEventListener('click', confirmHandler);
    this.open();
  }
}
```

## Plan de Implementación Revisado

### Fase 0: POC (Proof of Concept) - **NUEVO**
**Objetivo:** Validar arquitectura antes de refactorización completa
**Duración:** 2-3 horas

1. Crear estructura mínima:
   ```
   src/renderer/
   ├── _poc/
   │   ├── store.js (Store observable básico)
   │   ├── testService.js (Un servicio simple)
   │   └── TestModal.js (Modal de prueba)
   └── poc-test.html (HTML de prueba)
   ```

2. Implementar:
   - Store observable con subscribe/notify
   - Un servicio que llame a `window.electronAPI`
   - Un modal que extienda BaseModal
   - Probar que funciona en `npm run dev`

3. Validar:
   - ✅ ES Modules carga correctamente
   - ✅ Store notifica cambios
   - ✅ Modal init/destroy funciona
   - ✅ No hay errores en consola

**Criterio de avance:** POC funcional antes de continuar

### Fase 1: Preparación
**Duración:** 2-3 horas

1. Crear estructura de carpetas completa
2. Crear todos los archivos `index.js` (barrel exports)
3. Configurar `renderer.html` para ES Modules
4. Documentar guía de estilo de módulos

**Entregables:**
- ✅ Estructura de carpetas creada
- ✅ Barrels configurados
- ✅ Guía de estilo documentada
- ✅ Sistema de módulos validado

### Fase 2: Services (Capa de Datos)
**Duración:** 3-4 horas
**Por qué primero:** Bajo riesgo, wrappers simples, base para todo lo demás

1. `userService.js` - Wrappers de operaciones de usuarios
2. `imageService.js` - Wrappers de operaciones de imágenes
3. `repositoryService.js` - Wrappers de repositorio
4. `cameraService.js` - Detección de cámaras

**Testing:** Probar cada servicio individualmente con llamadas reales

### Fase 3: State (Store Observable)
**Duración:** 2-3 horas
**Por qué segundo:** Fundamento para handlers y UI

1. Implementar `store.js` con patrón observable completo
2. Migrar estado de `appState.js`
3. Migrar estado de `userState.js`
4. Migrar estado de `imageState.js`
5. Migrar estado de `selectionState.js`

**Testing:** Verificar subscribe/notify con console.log

### Fase 4: Utils (Utilidades Puras)
**Duración:** 2 horas
**Por qué tercero:** Sin dependencias, fáciles de testear

1. `domHelpers.js` - Helpers de DOM
2. `filterHelpers.js` - Lógica de filtrado
3. `navigationHelpers.js` - Navegación por teclado

**Testing:** Escribir tests unitarios básicos (opcional pero recomendado)

### Fase 5: UI - Modales (Base Común)
**Duración:** 4-5 horas
**Por qué cuarto:** Componentes repetitivos, alta ganancia con BaseModal

1. Implementar `BaseModal.js` con lifecycle
2. Migrar `ConfirmModal.js`
3. Migrar `InfoModal.js`
4. Migrar `ProgressModal.js` + setupProgressListener
5. Migrar `ProjectModal.js`
6. Migrar `ExportOptionsModal.js` (consolidar 3 funciones similares)
7. Migrar `AddTagModal.js`
8. Migrar `TaggedImagesModal.js`
9. Migrar `UserImageModal.js`

**Testing:** Probar apertura/cierre de cada modal

### Fase 6: UI - Tabla (Componentes Críticos)
**Duración:** 5-6 horas
**Por qué quinto:** Mayor complejidad, requiere cuidado especial

1. Extraer `VirtualScroll.js` (preservar `requestAnimationFrame`, debounce)
2. Extraer `LazyLoading.js` (preservar `IntersectionObserver`)
3. Implementar `UserRow.js` (creación de filas)
4. Implementar `UserTable.js` (orquestación)

**Testing crítico:**
- Medir rendimiento ANTES de migrar (baseline)
- Verificar virtual scroll con > 1000 usuarios
- Verificar lazy loading funciona
- Medir rendimiento DESPUÉS (comparar)

### Fase 7: UI - Otros Componentes
**Duración:** 3-4 horas

1. `ImagePreview.js` - Preview de imágenes
2. `Filters.js` - Búsqueda y filtros
3. `ContextMenu.js` - Menú contextual
4. `DragAndDrop.js` - Drag & drop

**Testing:** Probar cada componente individualmente

### Fase 8: Handlers (Orquestación)
**Duración:** 4-5 horas
**Por qué sexto:** Dependen de services, state y UI

1. `projectHandlers.js` - Gestión de proyectos
2. `userHandlers.js` - Operaciones con usuarios
3. `imageHandlers.js` - Operaciones con imágenes
4. `exportHandlers.js` - Exportación (consolidar funciones similares)
5. `importHandlers.js` - Importación
6. `tagHandlers.js` - Gestión de etiquetas
7. `xmlHandlers.js` - Actualización de XML
8. `menuHandlers.js` - Eventos del menú

**Testing:** Probar flujos end-to-end

### Fase 9: Integración Final
**Duración:** 2-3 horas

1. Refactorizar `renderer.js` como punto de entrada mínimo
2. Conectar todos los módulos
3. Eliminar código duplicado
4. Optimizar imports
5. Limpiar código legacy

**Testing:** Smoke testing de todas las funcionalidades

### Fase 10: Testing y Validación Exhaustiva
**Duración:** 4-5 horas

#### Checklist de Funcionalidades
- [ ] **Proyectos**
  - [ ] Crear nuevo proyecto
  - [ ] Abrir proyecto existente
  - [ ] Proyectos recientes

- [ ] **Usuarios**
  - [ ] Cargar usuarios
  - [ ] Buscar usuarios
  - [ ] Filtrar por grupo
  - [ ] Navegación con teclado (↑↓)
  - [ ] Selección múltiple

- [ ] **Imágenes**
  - [ ] Captura desde cámara
  - [ ] Importación desde carpeta
  - [ ] Drag & drop
  - [ ] Preview de imágenes
  - [ ] Navegación (←→)
  - [ ] Enlazar imagen a usuario
  - [ ] Desvincular imagen
  - [ ] Detección de duplicados

- [ ] **Repositorio**
  - [ ] Sincronización con Google Drive
  - [ ] Indicadores de repositorio
  - [ ] Thumbnails de repositorio
  - [ ] Exportar a repositorio

- [ ] **Exportación**
  - [ ] Exportar CSV
  - [ ] Exportar imágenes por ID
  - [ ] Exportar imágenes por nombre
  - [ ] Opciones de redimensionamiento

- [ ] **Importación**
  - [ ] Importar imágenes con ID

- [ ] **Etiquetas**
  - [ ] Agregar etiqueta a imagen
  - [ ] Ver imágenes etiquetadas
  - [ ] Eliminar etiqueta

- [ ] **XML**
  - [ ] Actualizar XML
  - [ ] Preview de cambios
  - [ ] Aplicar cambios

- [ ] **Rendimiento**
  - [ ] Virtual scroll con 1000+ usuarios
  - [ ] Lazy loading de imágenes
  - [ ] Sin memory leaks (verificar con DevTools)

#### Comparación de Rendimiento

Métricas a medir ANTES y DESPUÉS:

| Métrica | Antes | Después | Δ |
|---------|-------|---------|---|
| Tiempo carga inicial | ? | ? | ? |
| Tiempo render 1000 usuarios | ? | ? | ? |
| FPS durante scroll | ? | ? | ? |
| Memoria inicial | ? | ? | ? |
| Memoria después de uso | ? | ? | ? |

**Herramientas:**
- Chrome DevTools Performance
- Chrome DevTools Memory
- `performance.now()` para mediciones

## Riesgos y Mitigaciones

### 1. Dependencias Circulares
**Riesgo:** Handlers ↔ State ↔ UI puede crear ciclos
**Mitigación:**
- Arquitectura unidireccional estricta
- Linters para detectar ciclos (eslint-plugin-import)
- Code review antes de merge

### 2. Memory Leaks
**Riesgo:** Event listeners no limpiados
**Mitigación:**
- Patrón `init()/destroy()` obligatorio
- Usar `WeakMap` donde sea apropiado
- Testing con Chrome DevTools Memory

### 3. Regresiones de Rendimiento
**Riesgo:** Tabla más lenta después de refactorización
**Mitigación:**
- Baseline de rendimiento ANTES
- Preservar optimizaciones (`requestAnimationFrame`, `IntersectionObserver`)
- Comparación DESPUÉS con baseline

### 4. Incompatibilidad de Módulos
**Riesgo:** ES Modules no funciona como esperado
**Mitigación:**
- POC ANTES de refactorización completa
- Fallback a CommonJS si es necesario (menos deseable)

### 5. Bugs Sutiles en Migración de Estado
**Riesgo:** Estado inicializado en orden incorrecto
**Mitigación:**
- Migrar por feature, no por archivo
- Testing incremental después de cada migración

## Estimación Revisada

| Fase | Tiempo Estimado |
|------|-----------------|
| Fase 0: POC | 2-3 horas |
| Fase 1: Preparación | 2-3 horas |
| Fase 2: Services | 3-4 horas |
| Fase 3: State | 2-3 horas |
| Fase 4: Utils | 2 horas |
| Fase 5: Modales | 4-5 horas |
| Fase 6: Tabla | 5-6 horas |
| Fase 7: UI Componentes | 3-4 horas |
| Fase 8: Handlers | 4-5 horas |
| Fase 9: Integración | 2-3 horas |
| Fase 10: Testing | 4-5 horas |
| **TOTAL** | **33-44 horas** |

**Buffer recomendado:** +20% = **40-53 horas**

**Tiempo realista:** 1-1.5 semanas de trabajo dedicado

## Criterios de Éxito

### Funcionales
- ✅ Todas las funcionalidades existentes funcionan correctamente
- ✅ Sin regresiones detectadas en testing exhaustivo
- ✅ Checklist de funcionalidades 100% completado

### No Funcionales
- ✅ Rendimiento igual o mejor que versión original
- ✅ Sin memory leaks detectados en DevTools
- ✅ Archivos individuales < 300 líneas
- ✅ Arquitectura unidireccional respetada
- ✅ Lifecycle de componentes implementado

### Calidad de Código
- ✅ Código más legible y organizado
- ✅ Responsabilidades claramente separadas
- ✅ Sin dependencias circulares
- ✅ Documentación de contratos entre capas
- ✅ Fácil de entender para nuevos desarrolladores

## Ejemplo Completo de Flujo

### Escenario: Usuario hace clic en "Enlazar Imagen"

```javascript
// 1. UI captura evento
// ui/ImagePreview.js
export class ImagePreview {
  init() {
    this.linkBtn = document.getElementById('link-btn');
    this.addEventListener(this.linkBtn, 'click', () => {
      // Delegar a handler
      handleLinkImage();
    });
  }
}

// 2. Handler orquesta
// handlers/imageHandlers.js
import { store } from '../state/index.js';
import * as imageService from '../services/imageService.js';
import { showInfoModal, showConfirmModal } from '../ui/modals/index.js';

export async function handleLinkImage() {
  const { users } = store.getState('users');
  const { images, imageIndex } = store.getState('images');
  const selectedUser = users.selectedUser;

  if (!selectedUser) {
    showInfoModal('Aviso', 'Debes seleccionar un usuario');
    return;
  }

  const imagePath = images.currentImages[imageIndex];

  try {
    // 3. Service llama a IPC
    const result = await imageService.linkImageToUser({
      userId: selectedUser.id,
      imagePath
    });

    if (result.needsConfirmation) {
      showConfirmModal(
        'El usuario ya tiene una imagen. ¿Reemplazar?',
        async () => {
          await imageService.confirmLinkImage({ userId, imagePath });
          // 4. Actualizar estado
          store.setState({
            users: { needsReload: true }
          });
        }
      );
    } else {
      // 4. Actualizar estado
      store.setState({
        users: { needsReload: true }
      });
    }
  } catch (error) {
    showInfoModal('Error', 'Error al enlazar: ' + error.message);
  }
}

// 5. UI reacciona a cambio de estado
// ui/table/UserTable.js
export class UserTable {
  init() {
    // Suscribirse a cambios en estado de usuarios
    this.unsubscribe = store.subscribe(['users'], async (usersState) => {
      if (usersState.needsReload) {
        await this.reload();
        store.setState({ users: { needsReload: false } });
      }
    });
  }

  async reload() {
    const filters = this.getCurrentFilters();
    const users = await userService.loadUsers(filters);
    store.setState({ users: { currentUsers: users } });
    this.render();
  }
}
```

## Siguientes Pasos Inmediatos

1. **Aprobar este plan** y obtener feedback adicional
2. **Crear rama de refactorización:** `git checkout -b refactor/renderer-modular`
3. **Ejecutar Fase 0 (POC):**
   - Crear esqueleto mínimo
   - Validar arquitectura
   - Ajustar plan si es necesario
4. **Continuar con Fase 1** solo si POC es exitoso

## Recursos Adicionales

### Documentación
- [ES Modules en Electron](https://www.electronjs.org/docs/latest/tutorial/esm)
- [Observable Pattern](https://en.wikipedia.org/wiki/Observer_pattern)
- [Memory Management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management)

### Herramientas Recomendadas
- **ESLint:** `eslint-plugin-import` para detectar ciclos
- **Chrome DevTools:** Performance y Memory profiling
- **Jest (opcional):** Para testing de utilities puras

---

**Versión:** 2.0
**Fecha:** 2025-10-25
**Estado:** Pendiente de aprobación
**Autor:** Equipo de desarrollo con review técnica incorporada
