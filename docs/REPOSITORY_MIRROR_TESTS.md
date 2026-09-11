# Tests de RepositoryMirror - Resuelto

**Estado**: ✅ Resuelto. 19/19 tests pasando.

Este documento registraba 13 tests fallidos de `RepositoryMirror` como deuda técnica
pendiente. El diagnóstico original (`setImmediate is not defined`, que requeriría
refactorizar la suite entera) era incorrecto: era un síntoma, no la causa.

Se identificaron **dos causas reales**, una en los tests y otra en producción.

## Causa 1: timers falsos globales (test)

`tests/setup/jest.setup.js` ejecuta `jest.useFakeTimers()` a nivel de módulo, lo que
lo aplica a **todos** los archivos de test. Es razonable para las suites del renderer
(debounce, throttle), pero rompe esta:

- `RepositoryMirror` cede el event loop con `await new Promise(r => setImmediate(r))`
  en `discoverRepositoryFiles`, `determineFilesToSync`, `syncFiles` y `cleanupDeletedFiles`.
- Con timers falsos y sin nadie que avance el reloj, ese `setImmediate` no se ejecuta
  nunca y `startSync()` se queda colgado de forma indefinida.
- Resultado: todos los tests que sincronizan o vigilan agotaban el timeout de 10 s.

En `jsdom` el síntoma era distinto (`setImmediate` directamente no existe), lo que
despistó el análisis original.

**Solución**: la suite declara `@jest-environment node` (es código de proceso principal)
y restaura timers reales con `jest.useRealTimers()` en un `beforeEach`. Estos tests
operan sobre el filesystem real, así que necesitan el reloj real.

## Causa 2: el watcher de chokidar nunca emitía eventos (producción)

Bug real en `src/main/repositoryMirror.js`. El predicado `ignored` era:

```js
ignored: (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  return ext !== '.jpg' && ext !== '.jpeg';
}
```

Chokidar evalúa `ignored` también contra **directorios**. Un directorio no tiene
extensión, así que el predicado devolvía `true` para la propia carpeta del repositorio:
chokidar nunca descendía en ella y **no emitía nunca `add`, `change` ni `unlink`**.

Consecuencias en producción:

- Los cambios en el depósito solo se detectaban mediante el polling de respaldo de
  5 segundos (`startPeriodicPolling`), que dispara la sincronización pero **no** emite
  `repository-changed` con `{ type, filename }`.
- La detección de cambios tenía una latencia de hasta 5 segundos en lugar de ~1,5 s.
- El test "should ignore non-image files in watch" pasaba como falso positivo: nada
  se emitía nunca, así que la aserción se cumplía trivialmente.

**Solución**: el predicado no ignora directorios ni entradas sin extensión, y los
manejadores de eventos filtran por extensión de imagen:

```js
ignored: (filePath, stats) => {
  if (stats && stats.isDirectory()) return false;
  if (!path.extname(filePath)) return false;
  return !isImageFile(filePath);
}
```

Verificado fuera de Jest: `repository-changed` se emite ahora a los ~1550 ms
(1 s de intervalo de polling + 500 ms de `awaitWriteFinish`).

## Seguimiento: coste del polling (ya abordado)

El polling periódico de 5 segundos era costoso y, mientras el watcher estuvo roto, era
el único mecanismo que funcionaba. Una vez arreglado el watcher se redujo su coste:

- `binaryInterval` de chokidar se fija explícitamente. Por defecto vale 300 ms y es el
  que se aplica a las imágenes, así que cada foto se consultaba más de tres veces por
  segundo pese a que el código fijaba `interval: 1000`.
- `checkForChanges` ya no hace `stat` de todos los archivos en cada pasada. El watcher
  ya compara tamaño y fecha de forma continua; el poll solo cubre el caso que el watcher
  no puede ver (reemplazo con metadatos idénticos) y lo hace sobre una muestra rotatoria.
- Los intervalos son inyectables por constructor, para que los tests no dependan de los
  valores de producción.

La suite cubre ahora también `checkForChanges` (24 tests), incluido el caso de un archivo
reemplazado conservando tamaño y `mtime`, que es lo único que justifica la comparación
por hash. Cualquier cambio futuro en esa lógica debe mantener esos tests en verde.

### Limitación conocida (no abordada)

`mirrorIndex` guarda el `mtime` del archivo **copiado**, y `checkForChanges` lo compara
contra el `mtime` del archivo **origen**. Esto solo funciona porque en Windows
`fs.copyFile` preserva la marca de tiempo del origen. En Linux y macOS no lo hace, así
que la comparación detectaría un cambio en cada pasada y provocaría resincronizaciones
continuas. La aplicación se distribuye principalmente para Windows, pero conviene tenerlo
presente si alguna vez se usa en serio en otra plataforma.
