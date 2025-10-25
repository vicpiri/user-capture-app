# Plan de Refactorización de renderer.js

## Objetivo
Refactorizar el archivo `renderer.js` (2143 líneas) en módulos organizados por responsabilidad, siguiendo el mismo enfoque exitoso aplicado al proceso principal.

## Problema Actual
- Archivo monolítico de 2143 líneas con múltiples responsabilidades mezcladas
- Gestión de estado global dispersa (15+ variables globales)
- Lógica de UI, modales, eventos, y datos mezclados sin separación clara
- Difícil mantenimiento y testing
- Código duplicado en funciones de exportación

## Estructura Propuesta

```
src/renderer/
├── renderer.js                  # Punto de entrada principal (reducido)
├── state/                       # Gestión de estado
│   ├── appState.js             # Estado global de la aplicación
│   ├── userState.js            # Estado de usuarios y filtros
│   ├── imageState.js           # Estado de imágenes
│   └── selectionState.js       # Estado de modo selección
├── ui/                          # Componentes de interfaz
│   ├── modals/                 # Gestión de modales
│   │   ├── confirmModal.js     # Modal de confirmación
│   │   ├── infoModal.js        # Modal de información
│   │   ├── progressModal.js    # Modal de progreso
│   │   ├── projectModal.js     # Modal de nuevo proyecto
│   │   ├── exportOptionsModal.js # Modal de opciones de exportación
│   │   ├── addTagModal.js      # Modal de agregar etiqueta
│   │   ├── taggedImagesModal.js # Modal de imágenes etiquetadas
│   │   └── userImageModal.js   # Modal de imagen de usuario
│   ├── table/                  # Tabla de usuarios
│   │   ├── userTable.js        # Gestión principal de tabla
│   │   ├── userRow.js          # Creación de filas
│   │   ├── virtualScroll.js    # Scroll virtual
│   │   └── lazyLoading.js      # Carga lazy de imágenes
│   ├── imagePreview.js         # Preview de imágenes
│   ├── filters.js              # Filtros y búsqueda
│   ├── contextMenu.js          # Menú contextual
│   └── dragAndDrop.js          # Drag & drop de imágenes
├── handlers/                    # Manejadores de eventos
│   ├── projectHandlers.js      # Crear/abrir proyectos
│   ├── userHandlers.js         # Operaciones con usuarios
│   ├── imageHandlers.js        # Operaciones con imágenes
│   ├── exportHandlers.js       # Exportación (CSV, imágenes)
│   ├── importHandlers.js       # Importación de imágenes
│   ├── tagHandlers.js          # Gestión de etiquetas
│   ├── xmlHandlers.js          # Actualización de XML
│   └── menuHandlers.js         # Eventos del menú
├── services/                    # Servicios de datos
│   ├── userService.js          # Operaciones con usuarios
│   ├── imageService.js         # Operaciones con imágenes
│   ├── repositoryService.js    # Gestión del repositorio
│   └── cameraService.js        # Detección de cámaras
└── utils/                       # Utilidades
    ├── domHelpers.js           # Helpers DOM
    ├── filterHelpers.js        # Helpers de filtrado
    └── navigationHelpers.js    # Navegación por teclado
```

## Módulos Detallados

### 1. Estado (state/)

#### appState.js
**Responsabilidad:** Estado global de la aplicación
```javascript
- projectOpen
- repositorySyncCompleted
- isLoadingRepositoryPhotos
- isLoadingRepositoryIndicators
```

#### userState.js
**Responsabilidad:** Estado de usuarios y filtros
```javascript
- currentUsers
- allUsers
- displayedUsers
- selectedUser
- currentGroups
- showDuplicatesOnly
- showCapturedPhotos
- showRepositoryPhotos
- showRepositoryIndicators
```

#### imageState.js
**Responsabilidad:** Estado de imágenes
```javascript
- currentImages
- currentImageIndex
```

#### selectionState.js
**Responsabilidad:** Modo de selección múltiple
```javascript
- selectionMode
- selectedUsers (Set)
```

### 2. UI (ui/)

#### modals/confirmModal.js
**Responsabilidad:** Modal de confirmación
- `showConfirmationModal(message, onConfirm)`
- `closeConfirmModal()`

#### modals/infoModal.js
**Responsabilidad:** Modal de información
- `showInfoModal(title, message, onClose)`
- `closeInfoModal()`

#### modals/progressModal.js
**Responsabilidad:** Modal de progreso
- `showProgressModal(title, message)`
- `updateProgress(percentage, message, details)`
- `closeProgressModal()`
- `setupProgressListener()`

#### modals/projectModal.js
**Responsabilidad:** Modal de nuevo proyecto
- `openNewProjectModal()`
- `closeNewProjectModal()`
- `selectProjectFolder()`
- `selectXMLFile()`

#### modals/exportOptionsModal.js
**Responsabilidad:** Opciones de exportación
- `showExportOptionsModal(folderPath, users)`
- `showExportOptionsModalName(folderPath, users)`
- `showExportToRepositoryModal(users)`

#### modals/addTagModal.js
**Responsabilidad:** Agregar etiquetas
- `showAddTagModal()`

#### modals/taggedImagesModal.js
**Responsabilidad:** Visualizar imágenes etiquetadas
- `showTaggedImagesModal()`

#### modals/userImageModal.js
**Responsabilidad:** Ver imagen completa de usuario
- `showUserImageModal(user, imageType)`

#### table/userTable.js
**Responsabilidad:** Gestión de tabla de usuarios
- `displayUsers(users, allUsers)`
- `renderAllUsers(users, imageCount)`
- `updateUserCount()`
- `selectUserRow(row, user)`

#### table/userRow.js
**Responsabilidad:** Creación de filas
- `createUserRow(user, imageCount)`

#### table/virtualScroll.js
**Responsabilidad:** Scroll virtual
- `setupVirtualScroll()`
- `renderVirtualizedUsers()`
- Estado: `ITEM_HEIGHT`, `BUFFER_SIZE`, `visibleStartIndex`, `visibleEndIndex`, `isVirtualScrolling`

#### table/lazyLoading.js
**Responsabilidad:** Carga lazy de imágenes
- `initLazyLoading()`
- `observeLazyImages()`
- Estado: `imageObserver`

#### imagePreview.js
**Responsabilidad:** Preview de imágenes capturadas
- `showImagePreview()`
- `navigateImages(direction)`
- `updateLinkButtonState()`
- Gestión de tags

#### filters.js
**Responsabilidad:** Búsqueda y filtros
- `toggleClearButton()`
- `clearSearch()`
- `getCurrentFilters()`
- `filterUsers()`
- `populateGroupFilter()`

#### contextMenu.js
**Responsabilidad:** Menú contextual
- `showContextMenu(event, user, row)`
- `enableSelectionMode(initialUserId)`
- `disableSelectionMode()`
- `toggleUserSelection(userId, isChecked)`
- `updateSelectionInfo()`
- `updateTableHeader()`

#### dragAndDrop.js
**Responsabilidad:** Drag & drop de imágenes
- `setupDragAndDrop()`

### 3. Manejadores (handlers/)

#### projectHandlers.js
**Responsabilidad:** Gestión de proyectos
- `handleCreateProject(folderPath, xmlPath)`
- `handleOpenProject()`
- `loadProjectData()`
- `updateNoProjectPlaceholder()`

#### userHandlers.js
**Responsabilidad:** Operaciones con usuarios
- `handleLoadUsers(filters)`
- `handleDeletePhoto()`
- `navigateUsers(direction)`

#### imageHandlers.js
**Responsabilidad:** Operaciones con imágenes
- `handleLinkImage()`
- `handleImageDetecting(filename)`
- `handleNewImageDetected(filename)`

#### exportHandlers.js
**Responsabilidad:** Exportación
- `handleExportCSV()`
- `handleExportImages()`
- `handleExportImagesName()`
- `handleExportToRepository()`
- `getUsersToExport()` (helper)

#### importHandlers.js
**Responsabilidad:** Importación
- `handleImportImagesId()`

#### tagHandlers.js
**Responsabilidad:** Gestión de etiquetas
- `handleAddImageTag()`
- `handleShowTaggedImages()`
- `loadImageTags()`

#### xmlHandlers.js
**Responsabilidad:** Actualización de XML
- `handleUpdateXML()`

#### menuHandlers.js
**Responsabilidad:** Eventos del menú
- `setupMenuListeners()`
- Todos los listeners de eventos del menú

### 4. Servicios (services/)

#### userService.js
**Responsabilidad:** Operaciones de datos de usuarios
- `loadUsers(filters, loadOptions)`
- `loadGroups()`

#### imageService.js
**Responsabilidad:** Operaciones de datos de imágenes
- `loadImages()`
- `loadImageTags(imagePath)`

#### repositoryService.js
**Responsabilidad:** Datos del repositorio
- `loadRepositoryDataInBackground(users)`
- `updateRepositoryDataInDisplay()`

#### cameraService.js
**Responsabilidad:** Detección de cámaras
- `detectAvailableCameras()`

### 5. Utilidades (utils/)

#### domHelpers.js
**Responsabilidad:** Helpers para DOM
- `getElementById(id)`
- `querySelectorAll(selector)`
- Helpers comunes de DOM

#### filterHelpers.js
**Responsabilidad:** Helpers de filtrado
- `buildFilters(searchTerm, groupCode)`
- `filterDuplicates(users, imageCount)`

#### navigationHelpers.js
**Responsabilidad:** Navegación por teclado
- `setupKeyboardNavigation()`
- Lógica de teclas

### 6. renderer.js (Principal)

**Responsabilidad:** Punto de entrada y coordinación
```javascript
- Importar módulos
- Inicializar aplicación en DOMContentLoaded
- Coordinar módulos
- Configurar event listeners principales
```

## Ventajas de la Refactorización

### 1. Mantenibilidad
- Código organizado por responsabilidad
- Fácil localización de funcionalidad
- Cambios aislados a módulos específicos

### 2. Testabilidad
- Módulos pequeños fáciles de testear
- Estado aislado en módulos específicos
- Funciones puras donde sea posible

### 3. Reutilización
- Componentes reutilizables (modales, tabla)
- Servicios compartidos
- Utilities comunes

### 4. Escalabilidad
- Fácil agregar nuevas funcionalidades
- Estructura clara para nuevos desarrolladores
- Separación de concerns

### 5. Debugging
- Stack traces más claros
- Responsabilidades aisladas
- Estado predecible

## Plan de Implementación

### Fase 1: Preparación
1. ✅ Analizar código actual
2. ✅ Crear plan de refactorización
3. Crear estructura de carpetas
4. Configurar sistema de módulos

### Fase 2: Estado
1. Crear módulos de estado (state/)
2. Migrar variables globales
3. Implementar getters/setters
4. Probar gestión de estado

### Fase 3: UI - Modales
1. Extraer todos los modales a módulos separados
2. Crear factory pattern para modales
3. Probar cada modal independientemente

### Fase 4: UI - Tabla
1. Extraer lógica de tabla
2. Separar virtual scroll
3. Separar lazy loading
4. Probar renderizado

### Fase 5: UI - Componentes
1. Extraer image preview
2. Extraer filters
3. Extraer context menu
4. Extraer drag & drop

### Fase 6: Handlers
1. Extraer project handlers
2. Extraer user handlers
3. Extraer image handlers
4. Extraer export/import handlers
5. Extraer tag handlers
6. Extraer XML handlers
7. Extraer menu handlers

### Fase 7: Servicios
1. Crear user service
2. Crear image service
3. Crear repository service
4. Crear camera service

### Fase 8: Utilidades
1. Crear DOM helpers
2. Crear filter helpers
3. Crear navigation helpers

### Fase 9: Integración
1. Refactorizar renderer.js principal
2. Conectar todos los módulos
3. Eliminar código duplicado
4. Optimizar imports

### Fase 10: Testing y Validación
1. Probar todas las funcionalidades
2. Verificar no hay regresiones
3. Probar rendimiento
4. Documentar cambios

## Notas Importantes

### Compatibilidad con preload.js
- Mantener las llamadas a `window.electronAPI` sin cambios
- No modificar la comunicación IPC
- Asegurar que los eventos se propaguen correctamente

### Gestión de Estado
- Evitar estado mutable donde sea posible
- Usar inmutabilidad para arrays/objetos
- Implementar patrón observable si es necesario

### Performance
- Mantener virtual scrolling optimizado
- No degradar lazy loading
- Asegurar que los modales sean eficientes

### Event Listeners
- Limpiar event listeners al destruir componentes
- Evitar memory leaks
- Usar delegation donde sea apropiado

### Código Duplicado
- Las tres funciones de export options modal son muy similares
- Consolidar en una sola función parametrizada
- Aplicar DRY principle

## Estimación
- **Tiempo estimado:** 10-15 horas de trabajo
- **Complejidad:** Media-Alta
- **Riesgo:** Medio (requiere testing exhaustivo)
- **Beneficio:** Alto (mejora significativa en mantenibilidad)

## Criterios de Éxito
1. ✅ Todas las funcionalidades existentes funcionan correctamente
2. ✅ No hay regresiones en rendimiento
3. ✅ Código más legible y organizado
4. ✅ Archivos individuales < 300 líneas
5. ✅ Responsabilidades claramente separadas
6. ✅ Fácil de entender para nuevos desarrolladores
