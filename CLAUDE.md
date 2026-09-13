# Edu User Capture App - Contexto del Proyecto

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
│   │   │   ├── exportHandlers.js       # Exportación de CSV e imágenes (7 endpoints)
│   │   │   ├── miscHandlers.js         # Manejadores misceláneos (tags, diálogos, etc.)
│   │   │   ├── projectHandlers.js      # Gestión de proyectos, XML y cierre
│   │   │   └── userGroupImageHandlers.js # Usuarios, grupos e imágenes
│   │   ├── menu/                # Sistema de menús
│   │   │   └── menuBuilder.js          # Constructor de menús de la aplicación
│   │   ├── utils/               # Utilidades y helpers
│   │   │   ├── config.js               # Configuración y preferencias
│   │   │   ├── formatting.js           # Formateo de fechas y nombres
│   │   │   ├── recentProjects.js       # Gestión de proyectos recientes
│   │   │   ├── repositoryCache.js      # Caché de existencia de archivos
│   │   │   └── version.js              # Gestión de versión y modo DEV
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
│   │   │   │   ├── OrlaExportModal.js       # Modal de opciones de exportación de orlas
│   │   │   │   ├── ProjectInfoModal.js      # Modal de información del proyecto
│   │   │   │   └── UserImageModal.js        # Modal de vista previa de imágenes
│   │   │   ├── CaptureHistoryManager.js # Tira de miniaturas del historial de capturas
│   │   │   ├── DragDropManager.js       # Gestión de drag & drop de imágenes
│   │   │   ├── ExportManager.js         # Coordinador de exportaciones (CSV/imágenes)
│   │   │   ├── ImageGridManager.js      # Gestión de grid de imágenes capturadas
│   │   │   ├── ImageTagsManager.js      # Gestión de etiquetas de imágenes
│   │   │   ├── KeyboardNavigationManager.js # Navegación por teclado en tabla de usuarios
│   │   │   ├── LazyImageManager.js      # Carga lazy de imágenes (IntersectionObserver)
│   │   │   ├── MenuEventManager.js      # Coordinador de eventos de menú
│   │   │   ├── OrlaExportManager.js     # Gestión de exportación de orlas PDF
│   │   │   ├── ProgressManager.js       # Gestión de modal de progreso
│   │   │   ├── ProjectManager.js        # Gestión de ciclo de vida de proyectos
│   │   │   ├── SelectionModeManager.js  # Gestión de modo multi-selección
│   │   │   ├── UserDataManager.js       # Gestión de carga de datos de usuarios/grupos
│   │   │   ├── UserRowRenderer.js       # Renderizado de filas de usuarios
│   │   │   └── VirtualScrollManager.js  # Virtual scroll para lista de usuarios
│   │   ├── core/                        # Módulos core del renderer
│   │   │   ├── BaseModal.js             # Clase base para modales
│   │   │   └── store.js                 # Estado global de la aplicación
│   │   ├── utils/                       # Utilidades del renderer
│   │   │   ├── formatters.js            # Formateo de fechas, nombres y tamaños
│   │   │   └── imageUrl.js              # URLs app-img:// de las fotos
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
sqlite3 y sharp son N-API e instalan binarios precompilados: no se recompilan
para Electron. electron-builder ejecuta `install-app-deps` por su cuenta antes
de empaquetar, así que no hay ningún paso manual.

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
2. `dist:win` - Genera instalador NSIS en carpeta `dist/`

## Arquitectura del Proceso Principal

El proceso principal ha sido refactorizado en módulos organizados por responsabilidad:

### Manejadores IPC (ipc/)
- **exportHandlers.js**: Gestiona 7 tipos de exportación
  - `export-csv`: CSV para carnets (ID, foto, nombre completo, etc.)
  - `export-inventory-csv`: 3 CSVs separados (Alumnado.csv, Personal.csv, Grupos.csv)
  - `export-images`: Imágenes con nombre por ID (NIA/DNI)
  - `export-images-name`: Imágenes con formato "Apellido1 Apellido2, Nombre"
  - `export-inventory-images`: Exporta imágenes del repositorio con soporte ZIP
  - `export-to-repository`: Exporta imágenes capturadas al repositorio Google Drive
  - `export-orla-pdf`: Genera PDF de orlas con grid 4x columnas por grupo
- **miscHandlers.js**: Diálogos del sistema, etiquetas de imágenes, y utilidades generales
  - Incluye `update-window-title` para actualizar título de ventana
- **projectHandlers.js**: Gestión completa de ciclo de vida de proyectos
  - Creación, apertura, cierre de proyectos
  - Actualización de XML con análisis de cambios
  - Gestión de usuarios eliminados (movidos a grupo "Eliminados")
- **userGroupImageHandlers.js**: CRUD de usuarios, grupos, imágenes y relaciones

### Gestión de Ventanas (window/)
- **mainWindow.js**: Ventana principal con gestión de usuarios e imágenes
- **cameraWindow.js**: Ventana de captura desde webcam
- **imageGridWindow.js**: Visualización en grid de imágenes capturadas
- **repositoryGridWindow.js**: Visualización en grid de imágenes del repositorio
- **printedCardsWindow.js**: Últimos carnets impresos

#### Cómo añadir una ventana nueva

Toda ventana que no sea la principal es **secundaria** y debe cerrarse con ella.
No es solo cuestión de orden: si queda una ventana abierta, `window-all-closed`
no se dispara, `app.quit()` nunca se ejecuta y la aplicación deja de terminar.

Un gestor nuevo tiene que cumplir dos cosas:

1. **Exponer `close()`**, siguiendo el patrón de los existentes: cerrar la
   ventana solo si sigue viva (`isDestroyed()`) y dejar la referencia a `null`
   en cualquier caso. El handler `'closed'` ya limpia la referencia por su
   cuenta, pero un llamante puede llegar con una obsoleta.
2. **Registrarse en `secondaryWindowManagers`**, el array de `main.js` situado
   junto a la creación de los gestores. `closeSecondaryWindows()` lo recorre
   desde el handler `'closed'` de la ventana principal.

Ambos requisitos están cubiertos por `tests/unit/main/windowManagers.test.js`,
que recorre la carpeta `src/main/window/` en lugar de una lista fija: un gestor
sin `close()`, o que no aparezca en el array de `main.js`, hace fallar la suite.

### Utilidades (utils/)
- **config.js**: Persistencia de configuración y preferencias de usuario
- **formatting.js**: Formateo de fechas (ISO a español) y nombres de archivo
- **recentProjects.js**: Gestión de lista de proyectos recientes
- **repositoryCache.js**: Caché con TTL para verificación de existencia de archivos
- **version.js**: Gestión de versión de la aplicación con detección de modo DEV

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

- **ProjectInfoModal.js**: Modal de información del proyecto (Proyecto > Información
  del proyecto)
  - Nombre del proyecto y ubicación de todas sus carpetas: proyecto, `ingest`,
    `imports`, base de datos, depósito de imágenes y su copia local
  - Recuento de usuarios (total y por tipo), grupos, fotos enlazadas, usuarios
    sin foto, imágenes en `imports` e imágenes con etiquetas
  - Los datos llegan del proceso principal en una sola llamada
    (`get-project-details`), separada de `get-project-info` porque esta última
    la refresca la barra de estado a menudo y debe seguir siendo barata
  - La ruta del XML se registra al crear el proyecto y al actualizarlo; los
    proyectos anteriores a esto la muestran como "No configurado"

- **OrlaExportModal.js**: Modal de configuración de exportación de orlas PDF
  - Selección de fuente de fotos (capturadas vs repositorio)
  - Configuración de calidad de imagen (0-100)
  - Retorna opciones mediante Promise

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

#### CaptureHistoryManager.js
**Propósito**: Tira vertical de miniaturas a la derecha del visor grande, con el
historial de capturas del proyecto

**Funcionalidades**:
- Lista todas las capturas de la carpeta `imports`, las más recientes primero
- Al pulsar una miniatura, el visor grande se desplaza hasta esa foto
- Marca la miniatura que el visor está mostrando y la trae a la vista si queda fuera
- Cabecera con la fecha cada vez que cambia el día, y la hora de captura bajo
  cada miniatura, para localizar la sesión en la que se hizo un enlace erróneo
- Carga diferida de las miniaturas con IntersectionObserver
- Se activa y desactiva desde Ver > Historial de capturas (preferencia persistente)

**Cuidado con la clase `visible`**: `utilities.css` declara una utilidad global
`.visible { display: block !important }`. Cualquier componente que use ese
nombre para marcar su estado acaba renderizado como bloque, pase lo que pase en
su propia hoja. Aquí eso rompía el flex del panel y la lista crecía hasta caber
entera (144 000 px) en lugar de desplazarse, dejando la tira sin barra de
scroll. Por eso las clases de estado son `is-open` e `is-shown`.
`.no-project-placeholder` sortea lo mismo con un `display: flex !important`.

**Fecha y hora**: se leen del nombre del archivo, que es el único registro que
existe de cuándo se capturó (`folderWatcher` renombra a `YYYYMMDDHHMMSS`, con
`_1`, `_2`... si coinciden en el mismo segundo). Las imágenes traídas por la
importación masiva por ID conservan su nombre original, no pasan por el
vigilante y por tanto no tienen marca temporal: se agrupan bajo "Sin fecha en el
nombre" y muestran el nombre del archivo en lugar de la hora. El nombre completo
está siempre en el tooltip.

**Nota**: no tiene fuente de datos propia. Es un índice visual del mismo array
que ya navega `ImageGridManager`, así que pulsar una miniatura sólo mueve el
cursor del visor; la foto queda seleccionada para enlazarla igual que si se
hubiera llegado a ella con las flechas. `ImageGridManager` avisa de los cambios
de lista con `onImagesLoaded` y de los de cursor con `onImageChange`.

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

#### ProjectManager.js
**Propósito**: Gestión centralizada del ciclo de vida de proyectos

**Funcionalidades**:
- Crear nuevo proyecto (delega a NewProjectModal)
- Abrir proyecto existente
- Cerrar proyecto (limpia estado main y renderer)
- Cargar datos del proyecto (grupos, usuarios, imágenes)
- Actualizar XML con análisis de cambios
- Gestionar placeholder de "sin proyecto"

**Patrón**: Centraliza toda la lógica de proyectos extraída de renderer.js

#### UserDataManager.js
**Propósito**: Gestión centralizada de carga de datos de usuarios y grupos

**Funcionalidades**:
- Cargar grupos y poblar filtro de grupos
- Cargar usuarios con filtros (búsqueda, grupo, duplicados)
- Iniciar sincronización de repositorio en background
- Actualizar contadores y estado de UI
- Manejo de estado de carga (spinners)

**Patrón**: Separa lógica de carga de datos del coordinador principal

#### MenuEventManager.js
**Propósito**: Coordinador centralizado de eventos de menú

**Funcionalidades**:
- Registrar listeners para todos los eventos IPC de menú
- Gestionar preferencias de visualización (thumbnails, repository, indicators)
- Coordinar acciones de menú con callbacks configurables
- Toggle de modo selección múltiple
- Manejo de shortcuts de teclado

**Patrón**: Desacopla renderer.js de la gestión de eventos de menú

#### OrlaExportManager.js
**Propósito**: Gestión de exportación de orlas (class photos) en PDF

**Funcionalidades**:
- Mostrar modal de configuración de exportación
- Seleccionar fuente de fotos (capturadas vs repositorio)
- Generar PDFs por grupo con grid 4 columnas
- Configuración de calidad de imagen
- Manejo de progreso de exportación

**Patrón**: Encapsula lógica específica de exportación de orlas

#### KeyboardNavigationManager.js
**Propósito**: Gestión de navegación por teclado en tabla de usuarios

**Funcionalidades**:
- Navegación con flechas arriba/abajo
- Selección con Enter
- Scroll automático para mantener elemento visible
- Integración con virtual scroll

**Patrón**: Mejora accesibilidad y usabilidad de la aplicación

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

### Acceso a datos

Los componentes llaman directamente a `window.electronAPI`, expuesto por el
preload. No hay una capa de servicios intermedia: existió como andamiaje de la
fase 1 del refactor del renderer, nunca se adoptó, y se eliminó cuando la mitad
de los métodos IPC a los que llamaba ya no existían en el preload.

### Utilidades (utils/)

- **formatters.js**: Formateo de fechas, nombres, tamaños y edades
- **imageUrl.js**: Construcción de las URLs `app-img://` de las fotos

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

**Comandos**: `npm test` y `npm run test:coverage`

Los tests del renderer corren en JSDOM. Los del proceso principal declaran
`@jest-environment node` y restauran timers reales, porque el setup compartido
activa timers falsos y estos trabajan contra el sistema de archivos real.

**Organización**:

- `tests/unit/components/` — componentes y modales del renderer
- `tests/unit/core/`, `tests/unit/utils/` — clase base de modales, store, utilidades
- `tests/unit/main/` — proceso principal. Los handlers IPC se prueban capturando
  el handler desde un `ipcMain` mockeado y ejecutándolo contra una base de datos
  y archivos reales en un directorio temporal

**Cobertura**: los umbrales de `jest.config.cjs` son un trinquete contra
regresiones, no un objetivo; se fijaron algo por debajo de lo medido. Hay un
suelo propio para `src/main/`, que antes no se medía en absoluto.

Áreas prioritarias sin cubrir: `menuBuilder.js`, los gestores de ventana,
`imageManager.js`, y en el renderer `OrlaExportManager` y varios modales.

### Beneficios de la Refactorización

1. **Mantenibilidad**: Código organizado en módulos cohesivos y especializados
2. **Testabilidad**: Cada componente es independiente y fácilmente testable
3. **Reutilización**: Componentes reutilizables (especialmente modales)
4. **Escalabilidad**: Fácil agregar nuevas funcionalidades sin inflar renderer.js
5. **Legibilidad**: Separación clara de responsabilidades
6. **Performance**: Virtual scrolling y lazy loading optimizan rendimiento
7. **Calidad**: la suite de tests protege los caminos donde un fallo no es visible

## Novedades de la Versión 1.3.x

### Nuevas Funcionalidades Implementadas

#### Cerrar Proyecto (v1.3.1)
- **Funcionalidad**: Permite cerrar el proyecto actual sin salir de la aplicación
- **Shortcut**: Ctrl+W
- **Comportamiento**:
  - Cierra la base de datos SQLite de forma limpia
  - Detiene el vigilante de carpetas (folderWatcher)
  - Limpia el estado del main process (projectPath)
  - Limpia el estado del renderer (usuarios, grupos, imágenes)
  - Actualiza el título de ventana a "Edu User Capture v{version}"
  - Oculta la barra de estado
  - Muestra placeholder de "sin proyecto"

#### Exportación de Orlas PDF (v1.3.0)
- **Funcionalidad**: Genera PDFs con fotos en formato orla (class photos)
- **Características**:
  - Un PDF por grupo
  - Layout en grid de 4 columnas
  - Formato A4 portrait
  - Nombre completo debajo de cada foto
  - Selección de fuente: fotos capturadas o del repositorio
  - Calidad de imagen configurable (0-100)
  - Placeholder para usuarios sin foto

#### Exportación de CSV Inventario (v1.3.0)
- **Funcionalidad**: Exporta 3 archivos CSV separados por tipo de usuario
- **Archivos**:
  - **Alumnado.csv**: NIA, Nombre, Apellido1, Apellido2, FechaNacimiento, Grupo
  - **Personal.csv**: Documento, Nombre, Apellido1, Apellido2, FechaNacimiento
  - **Grupos.csv**: Código, Nombre
- **Uso**: Ideal para inventarios y reportes administrativos

#### Exportación de Imágenes por Nombre Completo (v1.3.0)
- **Funcionalidad**: Exporta imágenes con formato "Apellido1 Apellido2, Nombre.jpg"
- **Organización**: Carpetas por grupo
- **Opciones**: Copia original o redimensionamiento

#### Exportación de Inventario de Imágenes del Repositorio (v1.3.0)
- **Funcionalidad**: Exporta imágenes del repositorio (no capturadas)
- **Características**:
  - Soporte para ZIP con límite de tamaño configurable
  - División automática en múltiples ZIPs si excede el límite
  - Solo exporta usuarios que tienen imagen en el repositorio
  - Organización por grupos

#### Barra de Estado (v1.3.0)
- **Funcionalidad**: Muestra información del proyecto en tiempo real
- **Información mostrada**:
  - Nombre del proyecto
  - Ruta del repositorio Google Drive
  - Contador de usuarios totales
- **Visibilidad**: Se oculta automáticamente cuando no hay proyecto abierto

#### Placeholder "Sin Proyecto" (v1.3.0)
- **Funcionalidad**: Muestra mensaje cuando no hay proyecto abierto
- **Acciones disponibles**:
  - Crear nuevo proyecto
  - Abrir proyecto existente
- **Comportamiento**: Se oculta automáticamente al abrir/crear proyecto

#### Spinners de Carga (v1.3.0)
- **Funcionalidad**: Indicadores visuales de carga para operaciones largas
- **Ubicaciones**:
  - Lista de usuarios (carga inicial)
  - Indicadores de repositorio (durante sincronización)
  - Imágenes lazy-loaded
- **Duración mínima**: Configurada para evitar flashes visuales

#### Sistema de Petición de Carnets (v1.4.0)
- **Funcionalidad**: Sistema para solicitar la impresión de carnets de usuarios
- **Acceso**: Menú contextual > "Solicitar impresión de carnet"
- **Características**:
  - Funciona con modo multi-selección de usuarios
  - Genera archivos con ID del usuario en carpeta `To-Print-ID` dentro del repositorio
  - Nombre de archivos: `{ID}` sin extensión (NIA para alumnos, DNI para personal)
  - Icono de "ID card" visible en la lista cuando existe archivo en `To-Print-ID`
  - Solo procesa usuarios que tienen imagen en el repositorio
  - Filtro en menú Ver > "Mostrar solo usuarios con solicitud de carnet"
  - El icono desaparece automáticamente cuando se elimina el archivo
  - **Marcado automático como impresos**: Al exportar CSV para carnets, si algún usuario exportado tiene solicitud pendiente, se pregunta al usuario si desea marcarlos como impresos (mueve archivos de `To-Print-ID` a `Printed-ID`)
- **Optimización**: Usa caché con TTL para minimizar operaciones de filesystem
- **Uso**: Ideal para gestionar impresión de carnets en lotes

#### Sistema de Petición de Publicación Oficial (v1.4.0)
- **Funcionalidad**: Sistema para solicitar publicación oficial de fotografías
- **Acceso**: Menú contextual > "Solicitar publicación oficial"
- **Características**:
  - Funciona con modo multi-selección de usuarios
  - Copia imágenes del repositorio a carpeta `To-Publish` dentro del repositorio
  - Nombre de archivos: `{ID}.jpg` (NIA para alumnos, DNI para personal)
  - Icono de "Upload" visible en la lista cuando existe imagen en `To-Publish`
  - Solo procesa usuarios que tienen imagen en el repositorio
  - Filtro en menú Ver > "Mostrar solo usuarios con solicitud de publicación"
  - El icono desaparece automáticamente cuando se elimina la imagen
- **Optimización**: Usa caché con TTL para minimizar operaciones de filesystem
- **Uso**: Ideal para gestionar publicaciones oficiales (sistemas de gestión académica, etc.)

## Changelog Reciente

### 2025-01-30 - Mejora en Sistema de Petición de Carnets

**Marcado automático de carnets como impresos**:
- **Funcionalidad**: Al exportar CSV para carnets, la aplicación verifica si algún usuario exportado tiene solicitud de carnet pendiente en `To-Print-ID`
- **Flujo**:
  1. Usuario exporta CSV para carnets (Ctrl+E)
  2. Si algún usuario exportado tiene archivo en `To-Print-ID`, se muestra un modal de confirmación
  3. Si el usuario confirma, los archivos se mueven de `To-Print-ID` a `Printed-ID`
  4. Se muestra mensaje de confirmación con cantidad de archivos movidos
  5. Se refresca la lista de usuarios para actualizar indicadores visuales
- **Archivos modificados**:
  - `src/main/ipc/miscHandlers.js`: Agregados handlers `check-card-print-requests` y `mark-cards-as-printed`
  - `src/preload/preload.js`: Expuestos nuevos métodos IPC al renderer
  - `src/renderer/components/ExportManager.js`: Agregado método `checkAndMarkCardsAsPrinted()`
  - `src/renderer/renderer.js`: Pasado `confirmModal` a `ExportManager`
- **Beneficio**: Automatiza el flujo de trabajo de impresión de carnets, evitando tener que marcar manualmente los carnets como impresos

### 2025-01-29 - Fixes y limpieza de código

**Corrección de carga de repositorio al inicio**:
- **Problema**: Las imágenes del repositorio no se cargaban al arrancar con `npm run dev`, pero sí después de hacer Ctrl+R
- **Causa raíz**: Race condition - `ensureRepositoryMirrorStarted()` se llamaba en `createWindow()` antes de que el proyecto se abriera, por lo que `dbManager` era null y la función retornaba silenciosamente
- **Solución**: Mover la llamada a `ensureRepositoryMirrorStarted()` al final de `openRecentProject()` (después de que el proyecto se haya abierto exitosamente)
- **Archivos modificados**: `main.js` (líneas 303-313 eliminadas, líneas 651-655 agregadas)

**Eliminación de código muerto**:
- **Campo eliminado**: `has_external_image` en tabla `users` de SQLite
- **Función eliminada**: `markExternalImage(userId, exists)` en `database.js`
- **Razón**: El campo se definió en el schema pero nunca se utilizó en ninguna parte del código
- **Archivos modificados**: `src/main/database.js` (líneas 53 y 404-411)

**Corrección de tests**:
- **Tests corregidos**: 3 tests en `UserRowRenderer.test.js` que verificaban el CSS class `duplicate-image`
- **Problema**: Los tests verificaban el class en `.photo-indicator` pero en realidad se aplica a `.photo-indicator-wrapper`
- **Tests afectados**:
  - "should show duplicate indicator for duplicate images" (líneas 136-142)
  - "should not show duplicate indicator for unique images" (líneas 144-150)
  - "should apply imageCount to all rows" (líneas 288-303)
- **Resultado**: 488/488 tests pasando ✅

**Commits**:
- `c0bc3a9` - fix: ensure repository mirror starts after project opens
- `a5b9f6a` - refactor: remove unused has_external_image field and fix UserRowRenderer tests

## Estado Actual

**Versión**: 1.4.0

Aplicación completamente funcional con todas las características principales implementadas:

- ✅ **Gestión de proyectos**: crear, abrir, cerrar, actualizar XML
- ✅ **Captura de imágenes**: desde webcam con previsualización
- ✅ **Importación automática**: desde carpeta ingest con vigilancia en tiempo real
- ✅ **Asociación de imágenes**: vincular imágenes a usuarios con confirmación
- ✅ **Integración Google Drive**: repositorio de imágenes con API v3
- ✅ **Mirror local**: sincronización automática del repositorio en background
- ✅ **Exportaciones múltiples**:
  - CSV para carnets (formato completo)
  - CSV inventario por grupos (3 archivos separados)
  - Imágenes por ID (NIA/DNI)
  - Imágenes por nombre completo
  - Imágenes del repositorio en ZIP
  - Orlas PDF con grid personalizable
  - Exportación a repositorio Google Drive
- ✅ **Sistema de etiquetado**: tags personalizados para imágenes
- ✅ **Detección de duplicados**: identificación automática
- ✅ **Sistema de petición de carnets**: solicitar impresión de carnets con indicadores visuales
- ✅ **Sistema de petición de publicación**: solicitar publicación oficial con indicadores visuales
- ✅ **Múltiples ventanas**: principal, cámara, grids (capturadas y repositorio)
- ✅ **Filtros avanzados**: búsqueda, grupo, duplicados, carnets pendientes, publicación pendiente
- ✅ **Optimizaciones**:
  - Caché de archivos con TTL
  - Virtual scrolling para listas grandes
  - Lazy loading de imágenes
  - Sincronización en background
- ✅ **Arquitectura modular**: main process y renderer process completamente refactorizados
- ✅ **Testing**: suite unitaria con Jest sobre renderer y proceso principal
- ✅ **Navegación por teclado**: accesibilidad mejorada
- ✅ **Gestión de estado**: store centralizado con sincronización
- ✅ **Menú completo**: shortcuts y organización por categorías

## Notas de Desarrollo

- **Seguridad**: Implementa `contextIsolation` y `nodeIntegration: false`
- **Comunicación IPC**: Separación clara entre main y renderer con preload
- **Arquitectura modular**: Código organizado por responsabilidad y funcionalidad
- **Caché optimizado**: Sistema de caché con TTL para reducir operaciones de filesystem
- **Sincronización**: Mirror local del repositorio Google Drive con actualización automática
- **Privacidad**: Apropiado para entornos educativos
- **Testing**: Suite completa de tests unitarios con Jest (ver sección Testing)
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

## Impresión de recibos
- **Impresora recomendada**: Impresora térmica con ancho de rollo de 80mm
- **Configuración**: Menú > Herramientas > Configurar Impresora
- **Funcionalidades**:
  - Configuración de impresora térmica
  - Personalización del contenido del recibo (nombre del centro, precio, logotipo, texto del pie)
  - Impresión de recibo de prueba para verificar configuración
  - Impresión automática tras marcar orla como pagada
  - Los recibos incluyen nombre del usuario y grupo
- **Nota**: El diseño del recibo está optimizado para impresoras térmicas de 80mm de ancho

## Exportación de datos

### 1. CSV para carnets
- **Comando de menú**: Archivo > Exportar > Lista en CSV para carnets
- **Shortcut**: Ctrl+E
- **Nombre del archivo**: carnets.csv
- **Campos**:
  - id: NIA para alumnos, DNI para docentes y no docentes
  - password: NIA para alumnos, DNI para docentes y no docentes
  - userlevel: Alumno para alumnos Profesor para el resto
  - nombre
  - apellido1
  - apellido2
  - apellidos: suma de apellido1 y apellido2
  - centro: no rellenar
  - foto: para alumnos NIA.jpg. Para el resto DNI.jpg
  - grupo: no rellenar
  - direccion: no rellenar
  - telefono: no rellenar
  - departamento: no rellenar
  - DNI
  - edad: para alumnos mayor.jpg si es mayor de edad (18 años), si no menor.jpg. Para el resto profesor.jpg
  - fechaNacimiento
  - nombreApellidos: nombre + apellido1 + apellido2

### 2. CSV Inventario por grupos
- **Comando de menú**: Archivo > Exportar > CSV Inventario por grupos
- **Archivos generados**:
  - **Alumnado.csv**: NIA, Nombre, Apellido1, Apellido2, FechaNacimiento, Grupo
  - **Personal.csv**: Documento, Nombre, Apellido1, Apellido2, FechaNacimiento
  - **Grupos.csv**: Código, Nombre

### 3. Imágenes como ID
- **Comando de menú**: Archivo > Exportar > Imágenes como ID
- **Formato**: `{NIA}.jpg` para alumnos, `{DNI}.jpg` para personal
- **Opciones**: Copia original o redimensionamiento

### 4. Imágenes como nombre y apellidos
- **Comando de menú**: Archivo > Exportar > Imágenes como nombre y apellidos
- **Formato**: `Apellido1 Apellido2, Nombre.jpg`
- **Organización**: Carpetas por grupo
- **Opciones**: Copia original o redimensionamiento

### 5. Imágenes a repositorio
- **Comando de menú**: Archivo > Exportar > Imágenes a repositorio
- **Destino**: carpeta del depósito configurada en Proyecto > Configurar depósito
- **Alcance**: los usuarios seleccionados si hay modo selección activo; si no,
  los que hay en pantalla con el filtro de grupo y la búsqueda aplicados
- **Formato**: `{NIA}.jpg` para alumnado y `{documento}.jpg` para el resto,
  siempre `.jpg` y en la raíz del depósito, **sobrescribiendo** lo que hubiera
- **Opciones**: copia original o redimensionado (tamaño y peso máximo). El
  diálogo muestra antes un resumen de qué se va a exportar (grupo, selección,
  búsqueda o filtro de duplicados), cuántas imágenes se enviarán y cuántos
  usuarios del ámbito no tienen foto capturada
  - Lo construye `ExportManager.describeExportScope()` y lo pinta
    `ExportOptionsModal.show(summary)`; el modal es compartido, así que el
    resumen es opcional y se oculta si no se le pasa
- **Se descartan**: usuarios sin NIA/DNI y aquellos cuyo archivo de origen falta
- **Desvinculación posterior**: si se exportó al menos una imagen, se ofrece
  quitar la foto capturada de la ficha de **los usuarios exportados, y solo
  ellos**. No borra ningún archivo: las fotos siguen en `imports` y en el
  depósito. Antes se guarda una copia de seguridad de los enlaces de todo el
  proyecto, restaurable desde Proyecto > Restaurar enlaces de imágenes
  - `clearCapturedImages(userIds)` acepta la lista de usuarios; sin ella limpia
    el proyecto entero, que es de lo que depende la restauración de una copia

### 6. Orla PDF
- **Comando de menú**: Archivo > Exportar > Orla PDF
- **Formato**: Un PDF por grupo
- **Layout**: Grid de 4 columnas
- **Contenido**: Foto + nombre completo debajo
- **Fuente de fotos**: Seleccionable (capturadas o repositorio)
- **Calidad**: Configurable (0-100)

### 7. Inventario de imágenes del repositorio
- **Ubicación**: Parte del proceso de inventario
- **Formato**: ZIP con límite de tamaño
- **Contenido**: Imágenes del repositorio organizadas por grupo
- **Opciones**: Compresión configurable
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
- Es obligatorio preguntar si se deben ejecutar los test antes de hacer un commit (se pueden ejecutar solo los tests cercanos a los cambios realizados).