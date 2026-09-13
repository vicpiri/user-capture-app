# Comprobación de actualizaciones y nuevo flujo de release

**Estado**: 🚧 Pasos 1 a 5 hechos: la **1.7.0 es la primera Release de GitHub** (2026-09-13), publicada con este flujo y con el actualizador en fase 1. Pendiente el paso 6 (verificar el aviso con una 1.7.1) y la fase 2.
**Redactado**: 2026-09-13, tras la migración a Electron 44.
**Alcance**: (1) un flujo de publicación reproducible que deje cada versión
como Release de GitHub, y (2) que la aplicación instalada avise de que existe
una versión nueva y, en una segunda fase, la descargue e instale.

Este documento está escrito para leerse **meses después** de la última
release. La primera sección es la guía rápida de publicación; el resto explica
el porqué, el diseño del actualizador y cómo se llega desde el estado actual.

---

## 1. Guía rápida: publicar una versión

> Esto es lo que hay que hacer cada vez. Si es la primera vez tras leer este
> documento, antes hay que completar la sección 6 (transición).

### 1.1 Antes de empezar

| Requisito | Cómo comprobarlo |
|---|---|
| Node 22.12 o superior (lo exige `electron@44`) | `node --version` |
| Sesión de `gh` con permiso `repo` | `gh auth status` |
| En `main`, sin cambios pendientes, sincronizado con `origin` | `git status -sb` debe decir `## main...origin/main` sin `ahead`/`behind` |
| Tests en verde | `npm test` |
| La aplicación arranca y abre el proyecto reciente | `npm run dev` |
| **La aplicación empaquetada arranca** | `npm run dist:unpacked` y abrir `distwin-unpackedEdu User Capture.exe`. Obligatorio: el `package.json` del asar no tiene `build`, `scripts` ni `devDependencies`, y la 1.7.0 se publicó sin arrancar por leer `build.publish` al iniciar. `npm run dev` no lo detecta |
| Los commits desde el último tag usan tipos convencionales | `git log $(git describe --tags --abbrev=0)..HEAD --oneline` |

Lo último importa más de lo que parece: el changelog y el número de versión
se calculan a partir de los prefijos `feat:`, `fix:`, `perf:`... Un commit mal
tipado sale mal en el changelog o no sale.

### 1.2 Ver qué versión saldría, sin tocar nada

```
npx commit-and-tag-version --dry-run
```

Imprime la versión que calcula y el fragmento de changelog. Reglas:

- Solo `fix:` y `perf:` desde el último tag → sube el **patch** (1.7.0 → 1.7.1).
- Algún `feat:` → sube el **minor** (1.7.0 → 1.8.0).
- Algún `BREAKING CHANGE` en el cuerpo de un commit → sube el **major**.

Si el resultado no es el deseado se fuerza con `--release-as minor`,
`--release-as major` o `--release-as 2.0.0`.

### 1.3 Crear la versión (local, reversible)

```
npm run release              # versión calculada de los commits
npm run release:minor        # o forzar minor
npm run release:major        # o forzar major
```

Esto, y nada más que esto:

1. Escribe la versión nueva en `package.json` y `package-lock.json`.
2. Añade la sección nueva a `CHANGELOG.md`.
3. Hace el commit `chore(release): X.Y.Z`.
4. Crea el tag `vX.Y.Z`.

Todavía no ha salido nada del equipo. Revisa `CHANGELOG.md`; si algo está
mal, se deshace con `git tag -d vX.Y.Z && git reset --hard HEAD~1` y se
vuelve a empezar.

### 1.4 Publicar (sube a GitHub, ya no es reversible sin dejar rastro)

```
$env:GH_TOKEN = gh auth token      # PowerShell; en bash: export GH_TOKEN=$(gh auth token)
npm run release:publish
```

`release:publish` hace, en este orden:

1. `git push --follow-tags origin main`: sube los commits **y el tag**. Sin
   el tag no hay Release y el actualizador no ve nada.
2. `node scripts/release-notes.mjs`: **crea la Release** `vX.Y.Z` en GitHub
   con la sección de `CHANGELOG.md` como notas (o actualiza las notas si ya
   existe). Se crea antes de empaquetar a propósito: electron-builder sube
   el instalador y los metadatos desde dos publicadores en paralelo, y si
   ninguno encuentra la Release los dos la crean, quedando **dos releases
   con el mismo tag** y los adjuntos repartidos. Pasó en la 1.7.0.
3. `electron-builder --win nsis --x64 --publish always`: genera el
   instalador en `dist/` y sube a esa Release los tres adjuntos: el
   instalador `.exe`, su `.blockmap` y `latest.yml`. Solo sube a una Release
   publicada hace menos de dos horas; el paso 2 acaba de crearla.

El token solo vive en esa variable de entorno de esa terminal. No se guarda en
ningún archivo del repositorio.

### 1.5 Comprobar que ha salido bien

```
gh release view vX.Y.Z
```

Debe mostrar la release como publicada (no *draft*) y con exactamente estos
tres adjuntos:

```
Edu-User-Capture-X.Y.Z-win-x64.exe
Edu-User-Capture-X.Y.Z-win-x64.exe.blockmap
latest.yml
```

Y esto es lo que consultará cada aplicación instalada:

```
curl -L https://github.com/vicpiri/user-capture-app/releases/latest/download/latest.yml
```

Tiene que responder con `version: X.Y.Z`. Si responde con la versión anterior
o con 404, la release está en borrador o le falta `latest.yml`.

Después, instalar `dist\Edu User Capture-X.Y.Z-win-x64.exe` en el equipo y
comprobar que Ayuda > Acerca de muestra la versión sin `-DEV`.

### 1.6 Notas de la versión en GitHub

Las pone el paso 2 de `release:publish` desde `CHANGELOG.md`, y son las que
muestra la ventana de actualización de la aplicación. Si hay que retocarlas
(por ejemplo para mencionar un cambio de Electron, que al ser `chore` no sale
en el changelog), edítalas en GitHub o vuelve a lanzar `npm run release:notes`
después de corregir `CHANGELOG.md`; el script actualiza las notas si la
Release ya existe. `npm run release:notes -- --dry-run` las muestra sin tocar
nada.

### 1.7 Si algo sale mal después de publicar

- **El instalador es defectuoso y ya está publicado**: no borres la release,
  publica un patch corregido (`fix:` + `npm run release` + `release:publish`).
  Las aplicaciones instaladas irán a la última.
- **Hay que retirarla de verdad** (por ejemplo se publicó desde una rama
  equivocada):
  ```
  gh release delete vX.Y.Z --yes
  git push origin :refs/tags/vX.Y.Z
  git tag -d vX.Y.Z
  git revert HEAD            # revierte el commit chore(release)
  git push origin main
  ```
  Con esto `releases/latest` vuelve a apuntar a la versión anterior.
- **El push funcionó pero electron-builder falló**: el tag ya está en
  GitHub. Arregla la causa y lanza solo la parte de empaquetado:
  `npx electron-builder --win nsis --x64 --publish always`. Vuelve a subir
  los adjuntos a la misma release.
- **Hay dos releases con el mismo tag** (`gh release view` muestra solo
  parte de los adjuntos, o `gh release edit` responde "tag_name already
  exists"). Es la carrera descrita en 1.4 y no debería repetirse con el paso
  2, pero si ocurre: lista las releases con
  `gh api repos/vicpiri/user-capture-app/releases --jq '.[] | {id, tag_name, assets: [.assets[].name]}'`,
  borra la que tenga menos adjuntos con
  `gh api -X DELETE repos/vicpiri/user-capture-app/releases/<id>` y sube a
  la que queda lo que le falte. El instalador se sube con el nombre **con
  guiones** que declara `latest.yml`, y `gh` usa el nombre del archivo:
  ```
  copy "dist\Edu User Capture-X.Y.Z-win-x64.exe" "%TEMP%\Edu-User-Capture-X.Y.Z-win-x64.exe"
  gh release upload vX.Y.Z "%TEMP%\Edu-User-Capture-X.Y.Z-win-x64.exe"
  ```
  No hace falta regenerar nada: el sha512 de `latest.yml` es el del archivo
  de `dist/`.

### 1.8 Errores conocidos y su causa

| Síntoma | Causa | Solución |
|---|---|---|
| `GitHub Personal Access Token is not set` | Falta `GH_TOKEN` en esa terminal | Sección 1.4 |
| `HttpError: 404` al subir | El token no tiene permiso `repo` o el repositorio cambió de nombre | `gh auth refresh -s repo`; revisar `build.publish` en `package.json` |
| La release existe pero `latest.yml` responde con la versión anterior | La release está en borrador | `gh release edit vX.Y.Z --draft=false` |
| `npm ci` falla con "lock file out of sync" | Se editó `package.json` a mano | `npm install` para regenerar el lock |
| `npx electron` falla con `ERR_REQUIRE_ESM` | Node anterior a 22.12 | Subir Node |
| El instalador se llama con espacios y en GitHub con guiones | Normal: electron-builder sustituye los espacios al subir. `latest.yml` ya usa los guiones | Nada. Si subes un archivo a mano, ponle el nombre con guiones |
| La versión en la aplicación acaba en `-DEV` | Hay commits después del último tag; solo pasa en un checkout de git | Nada; la instalada nunca lo muestra |
| `gh release view` muestra solo parte de los adjuntos, o `gh release edit` dice `tag_name already exists` | Dos releases para el mismo tag (carrera de electron-builder, sección 1.4) | Sección 1.7 |
| El changelog no tiene sección de rendimiento | Falta `.versionrc.json` (la herramienta oculta `perf` por defecto) | Está en el repositorio; no borrarlo |
| La aplicación instalada aparece en el Administrador de tareas pero no muestra ventana | Excepción dentro de `app.whenReady()` antes de `createWindow()` (en 1.7.0, leer `build.publish` del `package.json` recortado) | Lanzarla desde una consola con `ELECTRON_ENABLE_LOGGING=1` para ver la excepción; publicar un patch |
| En `distwin-unpacked` la comprobación de actualizaciones dice "no such file or directory, open ...app-update.yml" | El target `dir` no escribe `app-update.yml`; solo lo hace el NSIS | Es normal en esa comprobación. Para probar el actualizador ahí, copiar el `app-update.yml` de `resources/` de una instalación y reiniciar la aplicación |
| `releases/latest` apunta a una versión vieja | Se creó una Release para un tag antiguo: GitHub elige "latest" **por fecha de creación**, no por número | Borrarla con `gh api -X DELETE repos/vicpiri/user-capture-app/releases/<id>`. Nunca crear Releases de versiones ya pasadas; el script se niega |

---

## 2. Por qué GitHub Releases como servidor

- El repositorio es **público**. Los adjuntos de una Release se descargan sin
  autenticación, sin límite práctico, sin servidor que mantener.
- electron-builder 26 **ya genera** lo necesario: en cada `dist:win` escribe
  `latest.yml` (versión, tamaño, sha512 del instalador) y el `.blockmap`
  (descarga diferencial), y mete en el paquete `app-update.yml` con
  `provider: github` y `owner/repo` tomados del remoto. Es exactamente el
  formato que consume `electron-updater`.
- `electron-updater` es la pieza compañera de electron-builder, mantenida por
  el mismo proyecto. La 6.8.x acompaña a electron-builder 26.

Lo que **no** resuelve: si el repositorio pasara a privado, la aplicación
necesitaría un token para descargar, y eso no es aceptable en un instalador
distribuido. Entonces habría que servir `latest.yml` y el instalador desde un
sitio estático (un bucket, una carpeta pública en un servidor del centro).
`electron-updater` lo soporta con `provider: generic` y una URL, sin cambiar
nada más en la aplicación.

## 3. Estado de partida, comprobado

| | |
|---|---|
| Herramienta de versionado | `standard-version` 9.5.0, abandonada desde 2022 |
| Scripts | `release`, `release:minor`, `release:major`: bump + `dist:win`. Ninguno hace push |
| Tags en local | hasta `v1.6.0` |
| Tags en `origin` | hasta `v1.4.0`. **`v1.5.0` y `v1.6.0` nunca se subieron** |
| Releases en GitHub | ninguna |
| `build.publish` en `package.json` | no existe; electron-builder lo deduce del remoto |
| Commits desde `v1.6.0` | 46 (8 `feat`, 8 `fix`, 10 `perf`...): la próxima versión calculada es **1.7.0** |
| Código de actualización en la app | ninguno |
| Firma de código | no hay. SmartScreen avisa en el primer arranque |

Versión y `-DEV`: `src/main/utils/version.js` lee `package.json` y añade
`-DEV` si hay commits tras el último tag, solo cuando existe `.git`. La
aplicación instalada nunca lo muestra, y el actualizador debe comparar la
versión limpia.

## 4. Nuevo flujo de release

### 4.1 Cambios de herramienta

- **`standard-version` → `commit-and-tag-version`** (13.x). Es el fork que
  los propios autores recomiendan: misma línea de comandos, mismo formato de
  changelog, mismos `--release-as` y `--dry-run`. Lleva un `.versionrc.json`
  porque los valores por defecto de la herramienta **ocultan `perf`** (por eso
  el changelog de 1.6.0 no tiene sección de rendimiento): ahora se muestran
  `feat`, `fix`, `perf` y `revert`, y siguen ocultos `docs`, `chore`, `test`,
  `build`, `refactor`, `style` y `ci`.
- **`electron-updater`** como dependencia de producción (sección 5).
- **`build.publish`** explícito en `package.json`:
  ```json
  "publish": {
    "provider": "github",
    "owner": "vicpiri",
    "repo": "user-capture-app",
    "releaseType": "release"
  }
  ```
  `releaseType` importa: el valor por defecto de electron-builder es `draft`,
  y el actualizador **ignora los borradores**. Un borrador olvidado durante
  meses es una release que nadie recibe. Con `release` la publicación es
  inmediata y la verificación es la de la sección 1.5.

### 4.2 Scripts

```json
"release": "commit-and-tag-version",
"release:minor": "commit-and-tag-version --release-as minor",
"release:major": "commit-and-tag-version --release-as major",
"release:publish": "git push --follow-tags origin main && node scripts/release-notes.mjs && electron-builder --win nsis --x64 --publish always",
"release:notes": "node scripts/release-notes.mjs"
```

Se separa en dos pasos a propósito. `release` es local y se deshace con dos
comandos; `release:publish` sube commits, tag e instalador, y eso ya no se
deshace limpiamente. Entre uno y otro se revisa el changelog.

Los scripts `dist:*` se mantienen para generar instaladores sin publicar.

### 4.3 Documentación que hay que actualizar a la vez

- `CLAUDE.md`, sección "Versionado": describe el flujo antiguo y dice que
  `release` crea un patch, cosa que no es cierta ni hoy (el salto lo deciden
  los commits). Debe remitir a la sección 1 de este documento.
- `README.md`, scripts de versionado y distribución.
- `AGENTS.md`, línea de releases.

## 5. Diseño del actualizador en la aplicación

### 5.1 Fases

**Fase 1, avisar.** La aplicación comprueba si hay versión nueva y lo dice en
un modal con las notas de la versión y un botón que abre la página de la
Release en el navegador. La descarga y la instalación las hace la persona,
como hasta ahora. Es lo mínimo útil y no toca el ciclo de vida de la
aplicación.

**Fase 2, descargar e instalar.** Desde el mismo modal, "Descargar" baja el
instalador en segundo plano (diferencial gracias al `.blockmap`, así que
suele ser una fracción de los 129 MB), muestra progreso y termina con
"Reiniciar e instalar". La aplicación cierra el proyecto, se cierra y lanza el
instalador en silencio.

La fase 1 se puede publicar sola. La fase 2 reutiliza todo lo de la 1 y añade
dos eventos y un botón.

### 5.2 Proceso principal: `src/main/updateManager.js`

Envuelve `autoUpdater` de `electron-updater` y es el único sitio que lo toca.

- Configuración: `autoDownload = false` (siempre; descargar es decisión de la
  persona), `autoInstallOnAppQuit = false`, `allowPrerelease = false`,
  `logger` = el logger de la aplicación, para que todo quede en `app.log`.
- `checkForUpdates({ manual })`: si `!app.isPackaged` o la plataforma no es
  Windows, devuelve `{ skipped: true }` sin llamar a nada. En desarrollo no
  existe `app-update.yml` y `electron-updater` lanzaría error.
- Traduce los eventos de `autoUpdater` a un único mensaje IPC
  `update-status` hacia la ventana principal con un estado:
  `checking`, `available` (versión, fecha, notas, URL de la release),
  `not-available`, `downloading` (porcentaje, bytes, velocidad),
  `downloaded`, `error` (mensaje).
- Regla de silencio: una comprobación **automática** que falla (sin red,
  proxy del centro que bloquea GitHub, 404) solo se registra en el log. Una
  comprobación **manual** que falla se muestra, con el texto del error.
- `downloadUpdate()` y `installUpdate()` (fase 2). `installUpdate` llama a
  `autoUpdater.quitAndInstall(true, true)`: silencioso y relanza la
  aplicación. Con el NSIS actual (`oneClick: false`) el primer argumento es
  lo que evita que aparezca el asistente de instalación.
- Antes de instalar, el cierre debe ser el mismo que el de salir de la
  aplicación: cerrar la base de datos y parar los vigilantes. Hay que
  comprobar que `before-quit` en `main.js` ya lo hace, y si no, hacerlo
  desde `installUpdate` antes de `quitAndInstall`.

Persistencia en `config.json` (mediante `utils/config.js`), bajo una clave
`updates`:

```json
"updates": {
  "autoCheck": true,
  "lastCheck": "2026-09-13T08:00:00.000Z",
  "skippedVersion": "1.7.1"
}
```

### 5.3 Cuándo se comprueba

- **Al arrancar**, si `autoCheck` es verdadero y han pasado más de 24 horas
  desde `lastCheck`, con un retraso de unos 15 segundos tras `ready-to-show`
  de la ventana principal para no competir con la apertura del proyecto y la
  sincronización del depósito.
- **A mano**, desde Ayuda > "Buscar actualizaciones..." (`menuBuilder.js`,
  junto a "Acerca de"). Esta ignora `skippedVersion` y `lastCheck`.
- Una versión marcada con "Omitir esta versión" no vuelve a avisar hasta que
  salga otra distinta.

### 5.4 IPC y preload

Handlers nuevos, en un archivo propio `src/main/ipc/updateHandlers.js` para no
engordar `miscHandlers.js`:

| Canal | Sentido | Qué hace |
|---|---|---|
| `check-for-updates` | renderer → main | comprobación manual |
| `download-update` | renderer → main | fase 2 |
| `install-update` | renderer → main | fase 2 |
| `skip-update-version` | renderer → main | guarda `skippedVersion` |
| `open-release-page` | renderer → main | `shell.openExternal` a la URL de la release |
| `update-status` | main → renderer | estado, ver 5.2 |
| `menu-check-updates` | main → renderer | el menú pide abrir el modal en estado `checking` |

El preload expone `checkForUpdates`, `downloadUpdate`, `installUpdate`,
`skipUpdateVersion`, `openReleasePage` y `onUpdateStatus`.

### 5.5 Renderer: `components/modals/UpdateModal.js`

Extiende `BaseModal`, como el resto. Un solo modal con cuatro vistas según el
estado recibido:

- **Comprobando**: spinner. Solo en comprobación manual.
- **Disponible**: "Hay una versión nueva: X.Y.Z (tienes la A.B.C)", fecha,
  notas de la release (el cuerpo de la Release de GitHub, que `release:notes`
  rellena desde el changelog; si está vacío, un enlace al changelog). Botones:
  fase 1 "Abrir página de descarga"; fase 2 "Descargar". Siempre "Más tarde" y
  "Omitir esta versión".
- **Descargando** (fase 2): barra de progreso con porcentaje y MB. Se puede
  cerrar el modal; la descarga sigue y al terminar vuelve a abrirse.
- **Descargada** (fase 2): "Reiniciar e instalar" y "Al salir" (deja
  `autoInstallOnAppQuit` para esa sesión).
- **Sin novedades** y **Error**: texto y "Cerrar". Solo en manual.

Ayuda > Acerca de muestra además "Última comprobación: fecha" y un enlace
"Buscar ahora" que dispara la comprobación manual.

### 5.6 Pruebas en desarrollo

`electron-updater` no funciona con `npm run dev` porque falta
`app-update.yml`. Para probar contra las releases reales sin empaquetar:

1. Crear en la raíz un `dev-app-update.yml` (**en `.gitignore`**) con el mismo
   contenido que el que genera electron-builder:
   ```yaml
   provider: github
   owner: vicpiri
   repo: user-capture-app
   ```
2. En `updateManager`, si `process.argv.includes('--dev-updates')` poner
   `autoUpdater.forceDevUpdateConfig = true` y saltarse la guarda de
   `isPackaged`.
3. Bajar temporalmente la versión de `package.json` (sin commit) para que la
   última release cuente como nueva.

La prueba definitiva es con dos releases reales: instalar la N, publicar la
N+1 y ver que la N avisa (fase 1) o se actualiza sola (fase 2).

### 5.7 Tests unitarios

- `tests/unit/main/updateManager.test.js`: mockear `electron-updater` con un
  `EventEmitter`; comprobar la traducción de eventos a `update-status`, la
  guarda de `isPackaged`, la regla de silencio automático/manual, la lógica de
  `lastCheck` y `skippedVersion`.
- `tests/unit/main/updateHandlers.test.js`: capturar los handlers desde el
  `ipcMain` mockeado, como los demás.
- `tests/unit/components/modals/UpdateModal.test.js`: las cuatro vistas y los
  callbacks de los botones.

### 5.8 Riesgos y decisiones

- **Instalador sin firma.** `electron-updater` solo verifica la firma del
  instalador descargado cuando la aplicación instalada está firmada; aquí no
  lo está, así que no verifica nada más allá del sha512 de `latest.yml`. Es el
  mismo nivel de confianza que descargar el instalador a mano de GitHub.
  Firmar el código queda fuera de alcance, como en la migración.
- **Redes de centro.** GitHub puede estar bloqueado. La comprobación
  automática nunca debe mostrar nada ni retrasar el arranque; por eso el
  retraso y la regla de silencio.
- **Solo Windows.** Solo se publican instaladores de Windows. En otras
  plataformas `checkForUpdates` devuelve `skipped`.
- **Proyecto abierto al instalar.** Un `quitAndInstall` a mitad de una
  exportación al depósito dejaría `.tmp` a medias. El botón "Reiniciar e
  instalar" debe estar deshabilitado mientras `ProgressManager` tenga una
  operación en curso.
- **`releases/latest` y prereleases.** GitHub excluye las prereleases de
  `latest`, y `allowPrerelease = false` las excluye también en el
  actualizador. Si algún día se quiere una beta, se publica marcada como
  prerelease y no llega a nadie por sorpresa.
- **Cambio de nombre de repositorio o de cuenta.** `app-update.yml` va dentro
  de cada instalador. Las versiones ya instaladas seguirían mirando al nombre
  antiguo; GitHub redirige los renombrados, pero no un cambio de cuenta. Si
  ocurriera, la última versión con el nombre antiguo tiene que ser una que
  ya apunte al nuevo.

## 6. Transición: de aquí al nuevo flujo

En orden, con un commit por paso. Los pasos 1 a 3 no tocan la aplicación.

1. **Subir los tags que faltan**: `git push origin --tags`. Sin esto los
   enlaces de comparación del changelog a `v1.5.0` y `v1.6.0` no resuelven.
2. **Cambiar la herramienta**: `npm uninstall standard-version && npm install
   -D commit-and-tag-version`. Scripts de la sección 4.2, `build.publish` de
   la 4.1, `scripts/release-notes.mjs`, y la documentación de la 4.3.
   Comprobar con `npx commit-and-tag-version --dry-run` que calcula 1.7.0 y
   que el fragmento de changelog es correcto.
3. **Ensayo de publicación sin release**: `npx electron-builder --win nsis
   --x64 --publish never` para confirmar que el `build.publish` explícito no
   cambia nada en `latest.yml` ni en `app-update.yml`.
4. **Fase 1 del actualizador** (secciones 5.2 a 5.5 sin descarga), con sus
   tests. Puerta: `npm run dev -- --dev-updates` con `dev-app-update.yml` y la
   versión bajada a mano debe mostrar el modal de "disponible" en cuanto
   exista la primera release; hasta entonces, debe mostrar "sin novedades" en
   manual y nada en automático.
5. **Primera release con el flujo nuevo: 1.7.0.** ✅ Hecha el 2026-09-13.
   Sección 1 completa. Es la primera Release de GitHub del proyecto y la
   primera versión con actualizador. electron-builder creó dos releases
   para el tag y hubo que borrar una y subir el instalador a mano; desde
   entonces `release:publish` crea la Release antes de empaquetar (1.4). La
   impresión térmica sigue sin probar desde la migración de Electron.
6. **Verificar el actualizador de extremo a extremo**: con la 1.7.0
   instalada, publicar una 1.7.1 (basta un `fix:` real o
   `docs:` + `--release-as patch`) y comprobar que la 1.7.0 avisa.
7. **Fase 2** (descarga e instalación), con sus tests, y verificación igual
   que en el paso 6 con la siguiente versión.

## 7. Fuera de alcance

- **Firma de código.** Eliminaría el aviso de SmartScreen y permitiría a
  `electron-updater` verificar firmas. Requiere un certificado de pago o el
  programa de Azure Trusted Signing; es una decisión aparte.
- **Publicar desde GitHub Actions.** Quitaría la dependencia del equipo de
  desarrollo (Node, token, tiempo de empaquetado) y dejaría el proceso en un
  archivo del repositorio. Es el paso natural después de que el flujo local
  funcione dos o tres veces; el flujo de este documento está pensado para
  que ese cambio sea solo mover los mismos comandos a un workflow.
- **Instaladores de macOS y Linux.** No se publican ni se prueban.

## 8. Referencias

| Qué | Dónde |
|---|---|
| Scripts de release y `build.publish` | `package.json` |
| Versión y sufijo `-DEV` | `src/main/utils/version.js` |
| Menú Ayuda | `src/main/menu/menuBuilder.js:463` |
| Configuración persistente | `src/main/utils/config.js` (`config.json` en `userData`) |
| Metadatos que ya genera electron-builder | `dist/latest.yml`, `dist/win-unpacked/resources/app-update.yml` |
| electron-updater | https://www.electron.build/auto-update |
| Publicación en GitHub con electron-builder | https://www.electron.build/configuration/publish#githuboptions |
| commit-and-tag-version | https://github.com/absolute-version/commit-and-tag-version |
