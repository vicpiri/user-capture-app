# User Capture App - Contexto del Proyecto

## Descripción General

Aplicación de escritorio desarrollada con Electron para la captura de imágenes de usuarios en entornos educativos.

## Tecnologías

- **Electron**: Framework para aplicaciones de escritorio
- **Node.js**: Runtime de JavaScript
- **electron-builder**: Empaquetado de la aplicación

## Estructura del Proyecto

```
user-capture-app/
├── src/
│   ├── main/                    # Proceso principal de Electron (Node.js)
│   │   ├── ipc/                 # Manejadores IPC organizados por funcionalidad
│   │   │   ├── exportHandlers.js       # Exportación de CSV e imágenes
│   │   │   ├── miscHandlers.js         # Manejadores misceláneos (tags, diálogos, etc.)
│   │   │   ├── projectHandlers.js      # Gestión de proyectos y XML
│   │   │   └── userGroupImageHandlers.js # Usuarios, grupos e imágenes
│   │   ├── menu/                # Sistema de menús
│   │   │   └── menuBuilder.js          # Constructor de menús de la aplicación
│   │   ├── utils/               # Utilidades y helpers
│   │   │   ├── config.js               # Configuración y preferencias
│   │   │   ├── formatting.js           # Formateo de fechas y nombres
│   │   │   ├── recentProjects.js       # Gestión de proyectos recientes
│   │   │   └── repositoryCache.js      # Caché de existencia de archivos
│   │   ├── window/              # Gestión de ventanas
│   │   │   ├── cameraWindow.js         # Ventana de captura de cámara
│   │   │   ├── imageGridWindow.js      # Grid de imágenes capturadas
│   │   │   ├── mainWindow.js           # Ventana principal
│   │   │   └── repositoryGridWindow.js # Grid de imágenes del repositorio
│   │   ├── database.js          # Gestión de base de datos SQLite
│   │   ├── folderWatcher.js     # Vigilancia de carpetas ingest/imports
│   │   ├── googleDriveManager.js # Integración con Google Drive API
│   │   ├── imageManager.js      # Procesamiento y gestión de imágenes
│   │   ├── logger.js            # Sistema de logging
│   │   ├── repositoryMirror.js  # Mirror local del repositorio Google Drive
│   │   └── xmlParser.js         # Parseo de archivos XML de usuarios
│   ├── preload/       # Scripts preload (comunicación segura entre procesos)
│   ├── renderer/      # Proceso de renderizado (interfaz de usuario)
│   │   ├── components/                  # Componentes modulares de UI
│   │   │   ├── modals/                  # Componentes de modales
│   │   │   │   ├── AddTagModal.js           # Modal para agregar etiquetas a imágenes
│   │   │   │   ├── ConfirmModal.js          # Modal de confirmación genérico
│   │   │   │   ├── ExportOptionsModal.js    # Modal de opciones de exportación
│   │   │   │   ├── InfoModal.js             # Modal informativo genérico
│   │   │   │   ├── NewProjectModal.js       # Modal de creación de proyectos
│   │   │   │   └── UserImageModal.js        # Modal de vista previa de imágenes
│   │   │   ├── DragDropManager.js       # Gestión de drag & drop de imágenes
│   │   │   ├── ExportManager.js         # Coordinador de exportaciones (CSV/imágenes)
│   │   │   ├── ImageGridManager.js      # Gestión de grid de imágenes capturadas
│   │   │   ├── ImageTagsManager.js      # Gestión de etiquetas de imágenes
│   │   │   ├── LazyImageManager.js      # Carga lazy de imágenes (IntersectionObserver)
│   │   │   ├── ProgressManager.js       # Gestión de modal de progreso
│   │   │   ├── SelectionModeManager.js  # Gestión de modo multi-selección
│   │   │   ├── UserRowRenderer.js       # Renderizado de filas de usuarios
│   │   │   └── VirtualScrollManager.js  # Virtual scroll para lista de usuarios
│   │   ├── core/                        # Módulos core del renderer
│   │   │   ├── BaseModal.js             # Clase base para modales
│   │   │   └── store.js                 # Estado global de la aplicación
│   │   ├── index.html           # HTML de la ventana principal
│   │   ├── renderer.js          # Lógica principal de la UI (coordinador)
│   │   ├── styles.css           # Estilos globales
│   │   ├── camera.html          # HTML de la ventana de cámara
│   │   ├── camera.js            # Lógica de captura desde webcam
│   │   ├── image-grid.html      # HTML del grid de imágenes capturadas
│   │   ├── image-grid.js        # Lógica del grid de capturadas
│   │   ├── repository-grid.html # HTML del grid del repositorio
│   │   └── repository-grid.js   # Lógica del grid del repositorio
│   └── shared/        # Código compartido (tipos, constantes, utilidades)
├── tests/             # Tests unitarios (Jest)
│   └── unit/
│       ├── components/          # Tests de componentes del renderer
│       │   ├── modals/          # Tests de modales
│       │   └── ...              # Tests de managers
│       └── ...
├── assets/
│   └── icons/         # Iconos de la aplicación
├── public/            # Archivos estáticos
├── package.json       # Dependencias y scripts
└── .gitignore        # Archivos excluidos de git
```

## Arquitectura de Electron

### Proceso Principal (Main Process)
- Controla el ciclo de vida de la aplicación
- Crea y gestiona ventanas
- Acceso completo a APIs de Node.js
- Ubicación: `src/main/`

### Proceso de Renderizado (Renderer Process)
- Interfaz de usuario (HTML/CSS/JS)
- Ejecuta en contexto de navegador
- Acceso limitado por seguridad
- Ubicación: `src/renderer/`

### Script Preload
- Puente seguro entre main y renderer
- Expone APIs específicas al renderer
- Ubicación: `src/preload/`

## Scripts Disponibles

### Ejecución
- `npm start` - Inicia la aplicación en modo producción
- `npm run dev` - Inicia la aplicación en modo desarrollo

### Testing
- `npm test` - Ejecuta suite completa de tests unitarios (Jest)

### Mantenimiento
- `npm run clean` - Limpia node_modules, dist y build completamente
- `npm run clean:dist` - Limpia solo carpetas dist y build
- `npm run install:clean` - Limpia y reinstala dependencias con npm ci

### Módulos nativos
- `npm run rebuild:native` - Reconstruye módulos nativos (sqlite3 y sharp)
- `npm run rebuild:native:sqlite` - Reconstruye solo módulos nativos de sqlite3

### Distribución
- `npm run dist:win` - Build para Windows (NSIS instalador x64)
- `npm run dist:mac` - Build para macOS (DMG x64)
- `npm run dist:linux` - Build para Linux (AppImage x64)

### Versionado
- `npm run release` - Crea nueva versión (patch) y genera instalador Windows
- `npm run release:minor` - Crea nueva versión minor y genera instalador Windows
- `npm run release:major` - Crea nueva versión major y genera instalador Windows

Cada comando de release ejecuta automáticamente:
1. `standard-version` - Actualiza versión, genera CHANGELOG y crea tag git
2. `dist:win` - Reconstruye módulos nativos y genera instalador NSIS en carpeta `dist/`

## Arquitectura del Proceso Principal

El proceso principal ha sido refactorizado en módulos organizados por responsabilidad:

### Manejadores IPC (ipc/)
- **exportHandlers.js**: Gestiona exportación de CSV e imágenes con opciones de redimensionamiento
- **miscHandlers.js**: Diálogos del sistema, etiquetas de imágenes, y utilidades generales
- **projectHandlers.js**: Creación, apertura y actualización de proyectos y XML
- **userGroupImageHandlers.js**: CRUD de usuarios, grupos, imágenes y relaciones

### Gestión de Ventanas (window/)
- **mainWindow.js**: Ventana principal con gestión de usuarios e imágenes
- **cameraWindow.js**: Ventana de captura desde webcam
- **imageGridWindow.js**: Visualización en grid de imágenes capturadas
- **repositoryGridWindow.js**: Visualización en grid de imágenes del repositorio

### Utilidades (utils/)
- **config.js**: Persistencia de configuración y preferencias de usuario
- **formatting.js**: Formateo de fechas (ISO a español) y nombres de archivo
- **recentProjects.js**: Gestión de lista de proyectos recientes
- **repositoryCache.js**: Caché con TTL para verificación de existencia de archivos

### Menú (menu/)
- **menuBuilder.js**: Constructor centralizado del menú con gestión de estado y callbacks

### Módulos Core
- **database.js**: Gestión completa de SQLite (usuarios, grupos, imágenes, tags)
- **folderWatcher.js**: Vigilancia de carpetas ingest/imports con chokidar
- **googleDriveManager.js**: Integración con Google Drive API v3
- **imageManager.js**: Procesamiento de imágenes con sharp (validación, redimensionamiento)
- **repositoryMirror.js**: Sincronización y mirror local del repositorio Google Drive
- **xmlParser.js**: Parseo de XML de usuarios con fast-xml-parser
- **logger.js**: Sistema de logging centralizado

## Arquitectura del Proceso de Renderizado

El proceso de renderizado ha sido refactorizado siguiendo una arquitectura modular basada en componentes (Phase 4). El archivo monolítico `renderer.js` (originalmente 2091 líneas) se ha reducido a 1386 líneas (reducción del 34%) extrayendo funcionalidad cohesiva en componentes especializados.

### Principios de Diseño

#### Patrón IIFE (Immediately Invoked Function Expression)
Todos los componentes utilizan IIFE para evitar contaminación del scope global:
```javascript
(function(global) {
  'use strict';
  class ComponentName { /* ... */ }

  // Export UMD
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ComponentName };
  } else if (typeof window !== 'undefined') {
    global.ComponentName = ComponentName;
  }
})(typeof window !== 'undefined' ? window : global);
```

#### Arquitectura basada en Callbacks
Los componentes se comunican mediante callbacks configurados en la inicialización:
```javascript
const manager = new SomeManager({
  onEvent: (data) => { /* handle event */ },
  getSomeData: () => { /* provide data */ }
});
```

#### Patrón de Delegación
`renderer.js` actúa como coordinador, delegando funcionalidad a componentes especializados:
```javascript
// Antes: implementación directa en renderer.js
function someFunction() { /* 50 líneas de código */ }

// Después: delegación al manager
function someFunction() {
  if (someManager) {
    someManager.handleFunction();
  }
}
```

### Componentes de Modales (components/modals/)

Todos los modales extienden `BaseModal` para comportamiento consistente.

- **NewProjectModal.js**: Modal de creación de proyectos
  - Selección de carpeta y archivo XML
  - Validación de inputs
  - Retorna configuración mediante Promise

- **ConfirmModal.js**: Modal de confirmación genérico
  - Mensaje personalizable
  - Retorna `true`/`false` mediante Promise

- **InfoModal.js**: Modal informativo genérico
  - Título y mensaje personalizables
  - Soporte para texto multilínea

- **ExportOptionsModal.js**: Modal de opciones de exportación
  - Modo copia original vs redimensionamiento
  - Configuración de tamaño y calidad
  - Retorna opciones mediante Promise

- **AddTagModal.js**: Modal para agregar etiquetas a imágenes
  - Input de texto para etiqueta
  - Retorna texto de etiqueta mediante Promise

- **UserImageModal.js**: Modal de vista previa de imágenes de usuario
  - Muestra imagen capturada o del repositorio
  - Título con nombre completo del usuario
  - Etiqueta distintiva para imágenes del repositorio

### Componentes Managers (components/)

#### ExportManager.js
**Propósito**: Coordinador central de todas las exportaciones (CSV e imágenes)

**Funcionalidades**:
- Exportación de CSV para carnets
- Exportación de imágenes por ID (NIA/DNI)
- Exportación de imágenes por nombre completo
- Exportación a repositorio
- Gestión de usuarios a exportar (selección, duplicados, filtros)

**Patrón**: Consolida código duplicado de 3 funciones casi idénticas en un único flujo reutilizable

#### ImageTagsManager.js
**Propósito**: Gestión completa del sistema de etiquetado de imágenes

**Funcionalidades**:
- Agregar etiquetas a imágenes
- Cargar y mostrar etiquetas
- Eliminar etiquetas
- Mostrar modal con todas las imágenes etiquetadas
- Actualización automática de UI

#### SelectionModeManager.js
**Propósito**: Gestión del modo de selección múltiple de usuarios

**Funcionalidades**:
- Activar/desactivar modo selección
- Toggle de selección individual
- Seleccionar/deseleccionar todos
- Actualización de header de tabla (checkbox selectAll)
- Sincronización con estado global para retrocompatibilidad

**Estado**: Mantiene `isActive` y `selectedUsers` (Set)

#### DragDropManager.js
**Propósito**: Gestión de drag & drop de archivos de imagen

**Funcionalidades**:
- Highlight visual de zona de drop
- Filtrado de archivos (solo JPG/JPEG)
- Procesamiento de múltiples archivos
- Integración con sistema de importación

#### ProgressManager.js
**Propósito**: Gestión del modal de progreso

**Funcionalidades**:
- Mostrar/ocultar modal de progreso
- Actualizar barra de progreso (porcentaje)
- Actualizar mensaje y detalles
- Listener IPC para eventos de progreso del main process

#### LazyImageManager.js
**Propósito**: Carga lazy de imágenes usando IntersectionObserver API

**Funcionalidades**:
- Observación automática de imágenes con clase `.lazy-image`
- Carga bajo demanda cuando la imagen entra en viewport
- Configuración de rootMargin y threshold
- Métodos para observar/desobservar imágenes individuales
- Carga inmediata de todas las imágenes (fallback)

**Optimización**: Reduce carga inicial de página con muchas imágenes de usuario

#### ImageGridManager.js
**Propósito**: Gestión del grid de imágenes capturadas del usuario seleccionado

**Funcionalidades**:
- Carga de imágenes del usuario
- Navegación entre imágenes (prev/next)
- Actualización de UI (contador, botones)
- Callback `onImageChange` para sincronización

#### VirtualScrollManager.js
**Propósito**: Implementación de virtual scrolling para la lista de usuarios

**Funcionalidades**:
- Renderizado eficiente de grandes listas (solo elementos visibles)
- Cálculo dinámico de alturas (spacers)
- Actualización on scroll
- Scroll programático a índice específico

**Optimización**: Permite manejar miles de usuarios sin degradación de performance

#### UserRowRenderer.js
**Propósito**: Renderizado de filas individuales de la tabla de usuarios

**Funcionalidades**:
- Generación de HTML para fila de usuario
- Indicadores visuales (foto, repositorio, duplicados)
- Checkbox de selección en modo multi-selección
- Lazy loading de miniaturas

### Componentes Core (core/)

#### BaseModal.js
**Propósito**: Clase base para todos los modales

**Funcionalidades**:
- Gestión de apertura/cierre
- Manejo de tecla Escape
- Prevención de cierre durante loading
- Soporte para Promise-based workflows

**Patrón**: Herencia - todos los modales extienden BaseModal

#### store.js
**Propósito**: Estado global de la aplicación

**Variables**:
- `currentProject`: Proyecto actualmente abierto
- `currentUsers`: Lista de usuarios cargados
- `selectedUser`: Usuario actualmente seleccionado
- `selectionMode`: Estado del modo multi-selección
- `selectedUsers`: Set de usuarios seleccionados

### Coordinador Principal (renderer.js)

**Función**: Actúa como coordinador central que:
1. Inicializa todos los componentes
2. Configura callbacks de comunicación inter-componentes
3. Delega funcionalidad a componentes especializados
4. Mantiene compatibilidad con código legacy mediante sincronización de estado
5. Gestiona eventos IPC del main process

**Inicialización**:
```javascript
// 1. Crear instancias con configuración
const manager = new SomeManager({
  callback: handleEvent,
  getData: () => globalState
});

// 2. Inicializar
manager.init();

// 3. Funciones delegadas
function legacyFunction() {
  manager.handleLegacyFunction();
}
```

### Testing

Todos los componentes tienen tests unitarios completos usando Jest y JSDOM:

- **Total de tests**: 488 tests pasando
- **Cobertura**: Cada componente tiene 20-37 tests
- **Mocking**: DOM elements, IPC (electronAPI), IntersectionObserver

**Estructura de tests**:
```
tests/unit/components/
├── modals/
│   ├── AddTagModal.test.js (14 tests)
│   ├── ConfirmModal.test.js (19 tests)
│   ├── ExportOptionsModal.test.js (29 tests)
│   ├── InfoModal.test.js (16 tests)
│   ├── NewProjectModal.test.js (32 tests)
│   └── UserImageModal.test.js (24 tests)
├── DragDropManager.test.js (24 tests)
├── ExportManager.test.js (27 tests)
├── ImageGridManager.test.js (36 tests)
├── ImageTagsManager.test.js (22 tests)
├── LazyImageManager.test.js (36 tests)
├── ProgressManager.test.js (37 tests)
├── SelectionModeManager.test.js (29 tests)
├── UserRowRenderer.test.js (33 tests)
└── VirtualScrollManager.test.js (37 tests)
```

**Comando**: `npm test`

### Beneficios de la Refactorización

1. **Mantenibilidad**: Código organizado en módulos cohesivos y especializados
2. **Testabilidad**: Cada componente es independiente y fácilmente testable
3. **Reutilización**: Componentes reutilizables (especialmente modales)
4. **Escalabilidad**: Fácil agregar nuevas funcionalidades sin inflar renderer.js
5. **Legibilidad**: Separación clara de responsabilidades
6. **Performance**: Virtual scrolling y lazy loading optimizan rendimiento
7. **Calidad**: 488 tests garantizan estabilidad

## Estado Actual

Aplicación completamente funcional con todas las características principales implementadas:

- ✅ Gestión de proyectos (crear, abrir, actualizar XML)
- ✅ Captura de imágenes desde webcam
- ✅ Importación automática desde carpeta ingest
- ✅ Asociación de imágenes a usuarios
- ✅ Integración con Google Drive para repositorio de imágenes
- ✅ Mirror local del repositorio con sincronización automática
- ✅ Exportación de CSV e imágenes (con redimensionamiento)
- ✅ Sistema de etiquetado de imágenes
- ✅ Detección de duplicados
- ✅ Múltiples ventanas (principal, cámara, grids de visualización)
- ✅ Caché de archivos con TTL para optimización
- ✅ Arquitectura modular refactorizada (main process y renderer process)
- ✅ Cobertura de tests completa (488 tests unitarios)

## Notas de Desarrollo

- **Seguridad**: Implementa `contextIsolation` y `nodeIntegration: false`
- **Comunicación IPC**: Separación clara entre main y renderer con preload
- **Arquitectura modular**: Código organizado por responsabilidad y funcionalidad
- **Caché optimizado**: Sistema de caché con TTL para reducir operaciones de filesystem
- **Sincronización**: Mirror local del repositorio Google Drive con actualización automática
- **Privacidad**: Apropiado para entornos educativos
- **Testing**: Suite completa de tests unitarios con Jest (488 tests)
- **Patrones**: IIFE, UMD exports, callback-based communication, delegation pattern

## Funcionalidades principales
- Captura de imágenes desde:
    - Cámara web integrada
    - Carpeta del sistema que el programa revisará periódicamente
- Asociación de imágenes a usuarios
- Importación de listado de usuarios y otra información desde archivo XML
- Importación de imágenes de los usuarios correspondientes a cursos anteriores desde un servidor externo.

## Stack tecnológico
- Electron
- Node.js para manejo de archivos
- Para el acceso a la cámara web utilizaremos electron.
- Parser XML fast-xml-parser

## Almacenamiento
- Imágenes: carpeta local del proyecto
- Datos de usuarios: SQLite
- Relación usuario-imagen: un usuario sólo se le puede asignar una imagen capturada
- Archivo base de datos: En la carpeta del proyecto en la subcarpeta 'data'.

## Estructura de usuarios (desde XML)
- El archivo XML está estructurado con distintos conjuntos de datos con las siguientes etiquetas: grupos, alumnos, no_docentes y docentes (estas etiquetas se deben utilizar literalmente. No se pueden traducir a otro idioma).
- Los campos necesarios de los grupos son: código y nombre
- Para el resto los campos son: nombre, apellido1, apellido2, fecha_nac y documento.
- En el caso de 'alumnos' también se extrae el grupo y el NIA.
- En el caso de docentes y no_docentes, se les asigna un grupo de Docentes y No Docentes.

## Flujo de trabajo
- Al crear un proyecto, el usuario debe indicar la carpeta de trabajo y el archivo XML.
- En dicha carpeta se creará una subcarpeta llamada 'ingest' y otra llamada 'imports'.
- Al abrir el proyecto, se conecta con el servidor y descarga el listado de imágenes existentes de los usuarios actuales, y marcará en la lista su presencia con un símbolo. Mientras tanto descargará todas las imágenes en segundo plano.
- Al detectar una imagen nueva en la carpeta 'ingest' se moverá automáticamente a la carpeta 'imports'.
- Cuando se capture desde la webcam, la imagen se almacenará en la carpeta 'ingest'.
- Al pulsar sobre el botón 'Enlazar', se almacena la relación de la fotografía seleccionada con el usuario marcado en la lista.

## Convenciones
- El código fuente debe estar todo en inglés.
- La interfaz de usuario debe estar en español.
- El nombre de la imagen capturada debe ser YYYYMMDDHHMMSS y en el caso de que en el mismo segundo se capturen 2 imágenes, que se le añada un ordinal.

## Servidor externo
- Protocolo: Debe ser compatible con distintas tecnologías. En primer lugar se desarrollará para Google Drive. El resto quedarán pendientes, pero tiene que estar previsto.

## Formato de imágenes
- Formatos aceptados: JPG
- Resolución de captura desde webcam: 1280x720
- Tamaño máximo de archivo: 5MB

## Comportamiento adicional
- Revisión de carpeta 'ingest': cada 1 segundo.
- Al asociar imagen a usuario que ya tiene una: pedir confirmación.
- Formatos de imagen aceptados desde carpeta externa: JPG

## Exportación de datos
- Exportar lista en CSV para carnets:
    - Nombre del archivo: carnets.csv
    - Campos:
        - id: NIA para alumnos, DNI para docentes y no docentes
        - password: NIA para alumnos, DNI para docentes y no docentes
        - userlevel: Alumno para alumnos Profesor para el resto
        - nombre
        - apellido1
        - apellido2
        - apellidos: suma de apellido1 y apellido2
        - centro: no rellenar
        - foto: para alumnos NIA.jpg. Para el resto DNI.jpg (sustituir NIA Y DNI por el valor correspondiente)
        - grupo: no rellenar
        - direccion: no rellenar
        - telefono: no rellenar
        - departamento: no rellenar
        - DNI
        - edad: para alumnos mayor.jpg si es mayor de edad (18 años), si no menor.jpg. Para el resto profesor.jpg
        - fechaNacimiento
        - nombreApellidos: nombre + apellido1 + apellido2
## Política de control de versiones
- Cada vez que una funcionalidad se de por comprobada y finalizada, se hará un commit en git con la descripción de la funcionalidad en inglés.
- Los commits NO deben incluir referencias a Claude, herramientas de IA, o co-autoría con Claude.
- Formato de commits:
  - Usar conventional commits: `tipo: descripción breve`
  - Tipos: `feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, `chore:`, etc.
  - Mensaje principal: descripción concisa en inglés
  - Cuerpo del commit (opcional): lista de cambios detallados con guiones
  - Ejemplo:
    ```
    feat: implement repository file cache and automatic change detection

    - Add repository folder watcher using chokidar to detect image additions, changes, and deletions
    - Implement file existence cache with 5-minute TTL to reduce filesystem operations
    - Add IPC event 'repository-changed' to notify renderer when repository contents change
    ```