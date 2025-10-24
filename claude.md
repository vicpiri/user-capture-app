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
│   └── shared/        # Código compartido (tipos, constantes, utilidades)
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
- ✅ Arquitectura modular refactorizada

## Notas de Desarrollo

- **Seguridad**: Implementa `contextIsolation` y `nodeIntegration: false`
- **Comunicación IPC**: Separación clara entre main y renderer con preload
- **Arquitectura modular**: Código organizado por responsabilidad y funcionalidad
- **Caché optimizado**: Sistema de caché con TTL para reducir operaciones de filesystem
- **Sincronización**: Mirror local del repositorio Google Drive con actualización automática
- **Privacidad**: Apropiado para entornos educativos

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