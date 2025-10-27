# Plan de Acción para Consolidar el Refactor del Renderer

## Resumen
Este plan alinea los servicios con `preload`/IPC, migra estado global al `store`, añade teardown global, y afina rendimiento (virtual scroll y logging). Prioriza cambios de bajo riesgo primero para validar rápido con `npm start`.

## Objetivos
- Alinear API de `services/*` con `src/preload/preload.js` y handlers IPC.
- Reducir estado global en `src/renderer/renderer.js` migrándolo a `src/renderer/core/store.js`.
- Añadir teardown central para evitar fugas de memoria.
- Optimizar `VirtualScrollManager` con `requestAnimationFrame` y observadores.
- Unificar logging y preparar terreno para nombres de archivo según guía.

## Riesgos y mitigaciones
- Desfase servicios↔preload: acordar nombres/firma y aplicar en bloque por dominio (usuarios, proyecto, imágenes).
- Doble estado (global vs store): migrar en iteraciones cortas con pruebas manuales y logs temporales.
- Regressiones de rendimiento: medir brevemente antes/después de tocar virtual scroll.

## Fase 1 — Alineación de Servicios e IPC

- UserService (`src/renderer/services/userService.js`)
  - Mantener: `getUsers(filters, options)` → ya existe `preload.getUsers` y `ipcMain.handle('get-users', ...)`.
  - Opciones:
    - Opción A (rápida): marcar como “no implementado” y comentar temporalmente métodos: `getUserById`, `updateUser`, `deleteUser`, `getDuplicates`, `searchUsers`.
    - Opción B (completa): añadir rutas en `preload` y `src/main/ipc` para esos métodos.

- ProjectService (`src/renderer/services/projectService.js`)
  - Mantener: `createProject`, `openProject` (existen en preload/IPC).
  - Ajustar/Definir: `closeProject`, `updateXmlFile`, `getProjectInfo`.
    - Mapear con lo existente: `update-xml`/`confirm-update-xml` (ajustar nombres/firmas) o crear nuevos canales.

- ImageService (`src/renderer/services/imageService.js`)
  - Adaptar a `preload` actual:
    - Preload tiene: `getImages`, `saveCapturedImage`, `linkImageToUser`, `confirmLinkImage`, `unlinkImageFromUser`, `moveImageToIngest`, `exportCSV`, `exportImages`, `exportImagesName`, `exportToRepository`, `addImageTag`, `getImageTags`, `deleteImageTag`, `getAllImagesWithTags`, `importImagesWithId`, etc.
    - Ajustar métodos del servicio para delegar a estos nombres y firmas en lugar de variantes no disponibles (`getCapturedImages`, `getImageById`, `checkRepositoryImage`, `getRepositoryImagePath`, `getTaggedImages`, `importImages`).

- Preload (`src/preload/preload.js`)
  - Si se elige Opción B, exponer los métodos faltantes con `contextBridge.exposeInMainWorld` y `ipcRenderer.invoke`.

- IPC Main (`src/main/ipc/*.js`)
  - Añadir `ipcMain.handle` correspondientes para métodos nuevos, o reutilizar los existentes ajustando nombres.

Criterio de cierre de Fase 1:
- No quedan llamadas a métodos inexistentes en `window.electronAPI` desde servicios.
- `npm start` arranca y la lista de usuarios e import/export básicos siguen funcionando.

## Fase 2 — Migración Progresiva de Estado al Store

- Alcance inicial (bajo riesgo): flags de UI y colecciones base
  - Migrar al `store` (`src/renderer/core/store.js`):
    - `ui.showDuplicatesOnly`, `ui.showCapturedPhotos`, `ui.showRepositoryPhotos`, `ui.showRepositoryIndicators`, `ui.showAdditionalActions`.
    - `users.allUsers`, `users.filteredUsers`, `groups.allGroups`.
  - `renderer.js` pasa a leer/escribir a través de `store.setState`/`store.getState`.
  - Managers que dependan de estos valores se suscriben con `store.subscribe`.

- Alcance siguiente: selección y repositorio
  - Migrar `selectionMode` y `selectedUsers` a `store` (o mantener en `SelectionModeManager` con sincronización hacia `store`).
  - Migrar `repository.isLoading`, `repository.lastSync`.

Criterio de cierre de Fase 2:
- `renderer.js` reduce variables globales clave, y UI reacciona a cambios vía `store`.

## Fase 3 — Teardown Global y Limpieza de Listeners

- Añadir en `src/renderer/renderer.js`:
  - `window.addEventListener('beforeunload', () => { ...destroy/disable... })` llamando a:
    - `virtualScrollManager.destroy()`
    - `dragDropManager.disable()`
    - `keyboardNavigationManager.disable()`
    - `progressManager.teardown?/removeListener()` según API actual
    - `lazyImageManager.destroy()`
    - `newProjectModalInstance/confirmModalInstance/infoModalInstance/exportOptionsModalInstance/addTagModalInstance/userImageModalInstance.destroy()`

Criterio de cierre de Fase 3:
- No quedan listeners activos tras navegar/cerrar; sin warnings en consola.

## Fase 4 — Virtual Scroll y Rendimiento

- `src/renderer/components/VirtualScrollManager.js`:
  - Sustituir debounce con `requestAnimationFrame` para sincronizar re-render con el frame.
  - Añadir `ResizeObserver` al contenedor para recalcular en cambios de tamaño.
  - Mantener API y contratos.

- Medición rápida (manual):
  - Lista de 5k usuarios: fluidez de scroll, sin jank visible.

Criterio de cierre de Fase 4:
- Scroll fluido con dataset grande; sin regresiones.

## Fase 5 — Logging y Convenciones

- Crear `src/renderer/utils/logger.js` con `debug/info/warn/error` y flag global para activar debug solo en dev.
- Reemplazar `console.log/error` directos en servicios y base de modales.
- Planificar renombrado de componentes a lowerCamelCase según guía (posponer hasta que wiring esté estable para evitar roturas en `index.html`).

## Checklist de Validación
- Servicios no invocan métodos inexistentes en `window.electronAPI`.
- Flujos críticos siguen operativos: abrir/crear proyecto, cargar usuarios, preview de imagen, importar/exportar, etiquetas.
- Teardown elimina listeners y suscripciones; sin memory leaks visibles.
- Virtual scroll fluido; lazy loading intacto.

## Secuencia de Commits sugerida
1. chore(services): alinear métodos a preload/IPC existentes.
2. feat(store): migrar flags de UI y colecciones base; suscripciones en managers.
3. feat(renderer): añadir teardown global con destroy/disable.
4. perf(virtual-scroll): rAF + ResizeObserver; micro-ajustes.
5. chore(logger): introducir util de logging y sustituir logs ruidosos.

## Referencias clave
- Preload: `src/preload/preload.js`
- Servicios: `src/renderer/services/*`
- Store: `src/renderer/core/store.js`
- Orquestador: `src/renderer/renderer.js`
- Virtual Scroll: `src/renderer/components/VirtualScrollManager.js`

---
¿Prefieres ajustar los servicios para encajar con el preload actual (Opción A) o ampliar preload/IPC para adoptar la API propuesta (Opción B)?

