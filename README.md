# User Capture App

Aplicación de escritorio para la captura de imágenes de usuarios en entornos educativos.
## Requisitos

- Node.js 16 o superior
- npm o yarn

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm start
```

Para modo desarrollo:

```bash
npm run dev
```

## Build

Generar ejecutable para la plataforma actual:

```bash
npm run build
```

Generar para plataformas específicas:

```bash
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## Estructura del Proyecto

```
user-capture-app/
├── src/
│   ├── main/          # Proceso principal de Electron
│   ├── renderer/      # Proceso de renderizado (UI)
│   ├── preload/       # Scripts preload (puente seguro)
│   └── shared/        # Código compartido
├── assets/            # Recursos (iconos, imágenes)
├── public/            # Archivos estáticos
└── package.json
```

## Licencia

ISC
