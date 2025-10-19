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

Para otras plataformas:

```bash
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

Los instaladores se generarán en la carpeta `dist/`.

## Estructura del Proyecto

```
user-capture-app/
├── src/
│   ├── main/              # Proceso principal de Electron
│   │   ├── database.js    # Gestión de base de datos SQLite
│   │   ├── xmlParser.js   # Parser de archivos XML
│   │   ├── folderWatcher.js # Vigilancia de carpetas
│   │   ├── imageManager.js  # Gestión de imágenes
│   │   ├── googleDriveManager.js # Conexión con Google Drive
│   │   └── logger.js      # Sistema de logs
│   ├── renderer/          # Interfaz de usuario
│   │   ├── index.html     # Ventana principal
│   │   ├── renderer.js    # Lógica de UI principal
│   │   ├── camera.html    # Ventana de cámara
│   │   └── image-grid.html # Cuadro de imágenes
│   └── preload/           # Scripts preload (puente seguro)
│       └── preload.js
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

## Tecnologías

- **Electron 28**: Framework para aplicaciones de escritorio
- **Node.js**: Runtime de JavaScript
- **SQLite3**: Base de datos local
- **Sharp**: Procesamiento de imágenes
- **Chokidar**: Vigilancia de sistema de archivos
- **fast-xml-parser**: Parser XML
- **Google APIs**: Integración con Google Drive

## Scripts NPM

- `npm start` - Inicia la aplicación
- `npm run dev` - Modo desarrollo con hot reload
- `npm run build` - Build para plataforma actual
- `npm run build:win` - Build para Windows
- `npm run build:mac` - Build para macOS
- `npm run build:linux` - Build para Linux
- `npm run rebuild:native` - Reconstruir módulos nativos
- `npm run dist:win` - Crear distribución para Windows

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

Víctor Pineda Ribes

## Licencia

Este proyecto está licenciado bajo la licencia Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0).

Esto significa que puedes:
- ✅ Compartir: copiar y redistribuir el material en cualquier medio o formato
- ✅ Adaptar: remezclar, transformar y crear a partir del material

Bajo las siguientes condiciones:
- 📝 Atribución: Debes dar crédito apropiado, proporcionar un enlace a la licencia e indicar si se han realizado cambios
- 🚫 No Comercial: No puedes usar el material para fines comerciales

Para más información, consulta: https://creativecommons.org/licenses/by-nc/4.0/
