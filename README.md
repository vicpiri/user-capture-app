# User Capture App

Aplicación de escritorio desarrollada con Electron para la captura y gestión de imágenes de usuarios en entornos educativos.

## Descripción

User Capture App permite la captura, organización y exportación de fotografías de usuarios (estudiantes, docentes y personal no docente) en instituciones educativas. La aplicación facilita la importación de datos desde archivos XML y la gestión de imágenes asociadas a cada usuario.

## Características Principales

### Gestión de Usuarios
- Importación de usuarios desde archivo XML
- Soporte para estudiantes, docentes y personal no docente
- Organización por grupos
- Búsqueda y filtrado avanzado
- Detección de duplicados
- Actualización de datos desde XML

### Captura de Imágenes
- Captura directa desde cámara web (1280x720)
- Selección de cámara disponible
- Importación de imágenes desde carpeta externa
- Detección automática de nuevas imágenes
- Asociación de imágenes a usuarios

### Exportación
- Exportación de imágenes como ID (NIA/DNI)
- Exportación de imágenes como nombre y apellidos
- Exportación a CSV para carnets
- Depósito de imágenes de usuario
- Procesamiento de imágenes (redimensionado y compresión)

### Funcionalidades Adicionales
- Sistema de etiquetado de imágenes
- Vista de cuadro de imágenes
- Depósito centralizado de imágenes
- Visualización configurable (mostrar/ocultar fotos capturadas o del depósito)
- Gestión de proyectos recientes
- Logs detallados de operaciones

## Requisitos

- Node.js 16 o superior
- npm 8 o superior
- Windows, macOS o Linux

## Instalación

```bash
npm install
```

## Desarrollo

Iniciar la aplicación en modo normal:

```bash
npm start
```

Iniciar en modo desarrollo (con hot reload y DevTools):

```bash
npm run dev
```

## Build

### Reconstruir módulos nativos

Antes de crear una distribución, es necesario reconstruir los módulos nativos (sqlite3 y sharp) para Electron:

```bash
npm run rebuild:native
```

### Generar ejecutable

Para Windows (NSIS installer):

```bash
npm run dist:win
```

Para macOS (DMG):

```bash
npm run dist:mac
```

Para Linux (AppImage):

```bash
npm run dist:linux
```

Los instaladores se generarán en la carpeta `dist/`.

## Estructura del Proyecto

```
user-capture-app/
├── src/
│   ├── main/                    # Proceso principal de Electron
│   │   ├── ipc/                 # Manejadores IPC por funcionalidad
│   │   │   ├── exportHandlers.js       # Exportación CSV e imágenes
│   │   │   ├── miscHandlers.js         # Diálogos, tags, utilidades
│   │   │   ├── projectHandlers.js      # Gestión de proyectos y XML
│   │   │   └── userGroupImageHandlers.js # CRUD usuarios/grupos/imágenes
│   │   ├── menu/                # Sistema de menús
│   │   │   └── menuBuilder.js          # Constructor de menús
│   │   ├── utils/               # Utilidades y helpers
│   │   │   ├── config.js               # Configuración y preferencias
│   │   │   ├── formatting.js           # Formateo de fechas y nombres
│   │   │   ├── recentProjects.js       # Proyectos recientes
│   │   │   └── repositoryCache.js      # Caché de archivos (TTL)
│   │   ├── window/              # Gestión de ventanas
│   │   │   ├── cameraWindow.js         # Ventana de captura
│   │   │   ├── imageGridWindow.js      # Grid de imágenes capturadas
│   │   │   ├── mainWindow.js           # Ventana principal
│   │   │   └── repositoryGridWindow.js # Grid del repositorio
│   │   ├── database.js          # Gestión de SQLite
│   │   ├── folderWatcher.js     # Vigilancia de carpetas ingest/imports
│   │   ├── googleDriveManager.js # Integración con Google Drive API
│   │   ├── imageManager.js      # Procesamiento de imágenes (Sharp)
│   │   ├── logger.js            # Sistema de logging
│   │   ├── repositoryMirror.js  # Mirror local del repositorio
│   │   └── xmlParser.js         # Parser de archivos XML
│   ├── renderer/          # Interfaz de usuario
│   │   ├── index.html     # Ventana principal
│   │   ├── renderer.js    # Lógica de UI principal
│   │   ├── styles.css     # Estilos globales
│   │   ├── camera.html    # Ventana de cámara
│   │   ├── camera.js      # Lógica de captura
│   │   ├── image-grid.html # Grid de imágenes capturadas
│   │   ├── image-grid.js  # Lógica del grid
│   │   ├── repository-grid.html # Grid del repositorio
│   │   └── repository-grid.js # Lógica del grid repositorio
│   └── preload/           # Scripts preload (puente seguro)
│       └── preload.js     # API expuesta al renderer
├── scripts/
│   └── rebuild-native.mjs # Script de rebuild multiplataforma
├── assets/
│   └── icons/             # Iconos de la aplicación
├── main.js                # Punto de entrada principal
└── package.json           # Configuración y dependencias
```

## Estructura de Datos

### Archivo XML

El archivo XML debe contener las siguientes secciones:

- **grupos**: Grupos o clases (código y nombre)
- **alumnos**: Estudiantes (nombre, apellidos, fecha_nac, documento, NIA, grupo)
- **docentes**: Profesores (nombre, apellidos, fecha_nac, documento)
- **no_docentes**: Personal no docente (nombre, apellidos, fecha_nac, documento)

### Base de Datos

La aplicación utiliza SQLite para almacenar:
- Información de usuarios
- Grupos
- Asociaciones de imágenes
- Etiquetas de imágenes

La base de datos se almacena en `[proyecto]/data/users.db`

## Flujo de Trabajo

1. **Crear/Abrir Proyecto**: Seleccionar carpeta de trabajo e importar archivo XML
2. **Capturar Imágenes**: Desde cámara web o carpeta externa
3. **Asociar Imágenes**: Enlazar fotografías con usuarios
4. **Exportar**: Generar archivos CSV y exportar imágenes organizadas

### Carpetas del Proyecto

- `ingest/`: Carpeta temporal donde se guardan las capturas
- `imports/`: Carpeta donde se almacenan las imágenes importadas
- `data/`: Base de datos SQLite
- `repository-mirror/`: Mirror local del repositorio Google Drive

## Arquitectura

### Arquitectura Modular del Proceso Principal

El proceso principal ha sido refactorizado en módulos especializados:

#### Manejadores IPC (`ipc/`)
- **exportHandlers**: Exportación de CSV e imágenes con opciones de procesamiento
- **miscHandlers**: Diálogos del sistema, etiquetas de imágenes y utilidades generales
- **projectHandlers**: Gestión completa de proyectos y actualización de XML
- **userGroupImageHandlers**: Operaciones CRUD sobre usuarios, grupos e imágenes

#### Gestión de Ventanas (`window/`)
- **mainWindow**: Ventana principal con gestión de usuarios e imágenes
- **cameraWindow**: Ventana de captura desde webcam con selección de dispositivo
- **imageGridWindow**: Visualización en cuadrícula de imágenes capturadas
- **repositoryGridWindow**: Visualización en cuadrícula del repositorio

#### Utilidades (`utils/`)
- **config**: Persistencia de configuración y preferencias de usuario
- **formatting**: Formateo de fechas (ISO a español) y nombres de archivo
- **recentProjects**: Gestión de lista de proyectos recientes
- **repositoryCache**: Caché con TTL (5 min) para verificación de existencia de archivos

#### Sistema de Menús (`menu/`)
- **menuBuilder**: Constructor centralizado del menú con gestión de estado y callbacks

#### Módulos Core
- **database**: Gestión completa de SQLite (usuarios, grupos, imágenes, tags)
- **folderWatcher**: Vigilancia de carpetas ingest/imports con chokidar
- **googleDriveManager**: Integración con Google Drive API v3
- **imageManager**: Procesamiento de imágenes con sharp (validación, redimensionamiento)
- **repositoryMirror**: Sincronización y mirror local del repositorio Google Drive
- **xmlParser**: Parseo de XML de usuarios con fast-xml-parser
- **logger**: Sistema de logging centralizado

### Características Técnicas

- **Comunicación IPC segura**: Separación clara entre procesos con preload
- **Caché optimizado**: Sistema de caché con TTL para reducir operaciones de filesystem
- **Sincronización automática**: Mirror local del repositorio Google Drive con detección de cambios
- **Arquitectura modular**: Código organizado por responsabilidad y funcionalidad
- **Seguridad**: Implementa `contextIsolation` y `nodeIntegration: false`

## Tecnologías

- **Electron 28**: Framework para aplicaciones de escritorio
- **Node.js**: Runtime de JavaScript
- **SQLite3**: Base de datos local
- **Sharp**: Procesamiento de imágenes
- **Chokidar**: Vigilancia de sistema de archivos
- **fast-xml-parser**: Parser XML
- **Google APIs**: Integración con Google Drive

## Scripts NPM

### Desarrollo
- `npm start` - Inicia la aplicación en modo producción
- `npm run dev` - Inicia la aplicación en modo desarrollo (con hot reload y DevTools)

### Distribución
- `npm run dist:win` - Crear distribución completa para Windows (NSIS x64)
- `npm run dist:mac` - Crear distribución completa para macOS (DMG x64)
- `npm run dist:linux` - Crear distribución completa para Linux (AppImage x64)

### Módulos nativos
- `npm run rebuild:native` - Reconstruir módulos nativos (SQLite3 y Sharp) para Electron
- `npm run rebuild:native:sqlite` - Reconstruir solo SQLite3 para Electron

### Limpieza
- `npm run clean` - Eliminar node_modules, dist y build completamente
- `npm run clean:dist` - Eliminar solo carpetas dist y build
- `npm run install:clean` - Limpieza completa y reinstalación limpia de dependencias (con npm ci)

### Versionado
- `npm run release` - Crear nueva versión patch y generar instalador Windows
- `npm run release:minor` - Crear nueva versión minor y generar instalador Windows
- `npm run release:major` - Crear nueva versión major y generar instalador Windows

Los comandos de release ejecutan automáticamente:
1. `standard-version` - Actualiza versión, genera CHANGELOG y crea tag git
2. `dist:win` - Reconstruye módulos nativos y genera instalador NSIS

## Formato de Imágenes

- **Formatos aceptados**: JPG/JPEG
- **Resolución de captura**: 1280x720
- **Tamaño máximo**: 5MB
- **Nombrado**: YYYYMMDDHHMMSS (timestamp)

## Exportación CSV

El archivo `carnets.csv` contiene los siguientes campos:
- id, password, userlevel, nombre, apellido1, apellido2
- apellidos, centro, foto, grupo, direccion, telefono
- departamento, DNI, edad, fechaNacimiento, nombreApellidos

## Configuración Global

La aplicación almacena configuración global en:
- Windows: `%APPDATA%/user-capture-app/`
- macOS: `~/Library/Application Support/user-capture-app/`
- Linux: `~/.config/user-capture-app/`

## Autor

Victor Pineda Ribes

## Licencia

Este proyecto está licenciado bajo la licencia Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0).

Esto significa que puedes:
- ✅ Compartir: copiar y redistribuir el material en cualquier medio o formato
- ✅ Adaptar: remezclar, transformar y crear a partir del material

Bajo las siguientes condiciones:
- 📝 Atribución: Debes dar crédito apropiado, proporcionar un enlace a la licencia e indicar si se han realizado cambios
- 🚫 No Comercial: No puedes usar el material para fines comerciales

Para más información, consulta: https://creativecommons.org/licenses/by-nc/4.0/
