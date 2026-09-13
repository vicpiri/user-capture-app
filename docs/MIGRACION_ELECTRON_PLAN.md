# Migración de Electron 28 a la línea con soporte

**Estado**: 📋 Planificado, sin implementar.
**Redactado**: 2026-09-13.
**Alcance**: dependencias, empaquetado y verificación. Sin cambios de
funcionalidad.

## Punto de partida, comprobado

| | |
|---|---|
| Electron instalado | **28.3.3** (`^28.0.0` en `package.json`) |
| Última estable | **44.3.0** |
| Líneas con soporte | 42, 43, 44 (Electron mantiene las tres últimas) |
| electron-builder instalado | **24.13.3** |
| Última de electron-builder | **26.15.3** |

Electron 28 quedó fuera de soporte a mediados de 2024. Van dieciséis versiones
mayores de Chromium y varias de Node sin actualizar, sin parches de seguridad.

## Lo que parecía el problema y no lo es

Esto era lo que hacía temer la migración, y al mirarlo de cerca se cae:

**Los módulos nativos no hay que recompilarlos.** Los dos son N-API, y N-API es
estable a nivel de ABI entre versiones de Node y de Electron:

- `sqlite3@5.1.7` depende de `node-addon-api` y declara `"binary": {
  "napi_versions": [3, 6] }`. Su binario precompilado sirve para cualquier
  runtime que soporte N-API 6.
- `sharp@0.34.4` no compila nada: instala el paquete de plataforma
  `@img/sharp-win32-x64`, que trae `sharp-win32-x64.node` ya construido.

**No se usa ninguna API retirada.** Comprobado en `main.js` y `src/`:

| Riesgo habitual | En este proyecto |
|---|---|
| `protocol.registerFileProtocol` / `interceptFileProtocol` (retiradas en 35) | No se usan; ya se migró a `protocol.handle` |
| `@electron/remote`, `enableRemoteModule` | No aparecen |
| `desktopCapturer` en el renderer | No se usa |
| `webContents.getPrinters()` (obsoleta) | Ya se usa `getPrintersAsync()` |
| `nodeIntegration`, `contextIsolation` | Ya en la configuración segura |
| Sandbox por defecto (desde Electron 20) | Ya vigente en 28, sin cambio |

Es decir, el código de aplicación está en buena forma. El trabajo está en las
dependencias, el empaquetado y la verificación.

---

## Los riesgos reales

### 1. `scripts/rebuild-native.mjs` es hoy el mayor punto de fallo

El script fuerza `npm rebuild --build-from-source` de `sqlite3` **y** de `sharp`
contra las cabeceras de Electron (`npm_config_target`, `runtime=electron`,
`disturl`). Con dos módulos N-API eso no hace falta, y en el caso de sharp 0.34
compilar desde fuente exige un libvips del sistema que no está declarado en
ninguna parte.

Es más probable que rompa la migración el propio script que Electron.

**Antes de tocar Electron** conviene averiguar qué hace hoy realmente: si compila
de verdad, si falla en silencio y cae a los binarios precompilados, o si
`electron-builder install-app-deps` acaba deshaciendo su trabajo. Con eso claro,
lo previsible es reducirlo a `install-app-deps` o eliminarlo, y quitar
`rebuild:native` de los scripts `dist:*`.

### 2. electron-builder 24 se queda corto

La 24.13.3 es de la época de Electron 28. Para una Electron moderna y las
herramientas de Windows actuales hay que subir a la 26.x. Va en el mismo paso
que Electron, no después: si algo falla en el empaquetado hay que poder atribuir
el fallo a uno de los dos, y por eso conviene verificar el arranque en
desarrollo **antes** de tocar el empaquetado (ver puertas).

### 3. `getUserMedia` desde `file://`

Las ventanas se cargan con `loadFile`, así que el origen es `file://`. La captura
desde webcam depende de `navigator.mediaDevices.getUserMedia`, en
`src/renderer/camera.js:65` y `src/renderer/renderer.js:2074`. Chromium ha ido
apretando las reglas de contexto seguro a lo largo de dieciséis versiones.

Es la funcionalidad central de la aplicación, así que **hay que probarla en un
equipo con cámara real**, no dar por hecho que sigue funcionando.

Si se rompiera, la salida conocida es servir el renderer por un esquema propio
registrado como `standard` y `secure` en lugar de `file://`. El proyecto ya tiene
montada esa maquinaria para `app-img` (`src/main/protocol/imageProtocol.js`), así
que el patrón es conocido, pero es trabajo aparte y no trivial.

### 4. Impresión silenciosa de recibos

`miscHandlers.js:1090` imprime con `webContents.print({ silent: true,
deviceName, printBackground: true })` a una impresora térmica de 80 mm. La pila
de impresión de Chromium ha cambiado varias veces. Hay que probarlo con la
impresora de verdad; un recibo que sale en blanco o con otro tamaño no se detecta
de ninguna otra forma.

### 5. `asarUnpack` y las DLL de sharp

Hallazgo concreto: los binarios de sharp viven en

```
node_modules/@img/sharp-win32-x64/lib/sharp-win32-x64.node   0,4 MB
node_modules/@img/sharp-win32-x64/lib/libvips-42.dll        18,1 MB
node_modules/@img/sharp-win32-x64/lib/libvips-cpp-8.17.2.dll 0,3 MB
```

Y `asarUnpack` en `package.json` dice:

```json
["**/*.node", "node_modules/sqlite3/**/*", "node_modules/sharp/**/*"]
```

El `.node` lo recoge el patrón `**/*.node`, pero **las dos DLL no encajan en
ninguna de las tres entradas**: no son `.node`, y no están bajo
`node_modules/sharp/` sino bajo `node_modules/@img/`. Si acaban dentro del asar,
sharp no puede cargar libvips y en la aplicación instalada fallan las miniaturas
y todas las exportaciones.

Que hoy funcione sugiere que electron-builder las desempaqueta por su cuenta al
detectar dependencias nativas. Es un comportamiento del que no conviene depender
al cambiar de versión mayor de la herramienta: añadir `node_modules/@img/**/*` a
`asarUnpack` es gratis y elimina la duda.

**Esto solo se ve en la aplicación instalada.** En `npm run dev` no hay asar.

### 6. `electron-reloader` (solo desarrollo)

`electron-reloader@1.2.3` lleva años sin tocarse y puede no llevarse bien con una
Electron moderna. Si falla, se pierde la recarga automática en `npm run dev`,
nada más. Se puede quitar sin consecuencias para producción.

Recordatorio de esta misma sesión: vigila la carpeta del proyecto, así que
cualquier archivo que se escriba dentro durante el desarrollo recarga el renderer
y le vacía el estado.

---

## Estrategia: salto directo

Dado que no se usa ninguna API retirada y que los módulos nativos no necesitan
recompilarse, **saltar directamente a la 44.x** es defendible y evita repetir
seis veces la misma verificación. La alternativa —escalar por 31, 37 y 44— solo
compensa si el salto directo falla de forma que no se pueda atribuir.

Elegir 44 y no 42 da el mayor margen antes del próximo fin de soporte.

Todo en una rama desechable. Si a mitad se tuerce, se tira y se escala por
etapas, sin haber ensuciado `main`.

## Pasos

1. Rama nueva desde `main`.
2. **Averiguar qué hace hoy `rebuild-native.mjs`** (riesgo 1) y anotar el
   resultado. Es la única tarea que conviene hacer *antes* de tocar versiones,
   porque después no se podrá distinguir su comportamiento del de la migración.
3. Subir `electron` a `^44.0.0` y `electron-builder` a `^26.0.0`.
   `npm run install:clean` para una instalación limpia; una parcial deja
   binarios de la versión anterior.
4. Añadir `node_modules/@img/**/*` a `asarUnpack`.
5. Simplificar o eliminar `rebuild-native.mjs` según lo averiguado en el paso 2.
6. Pasar las puertas de verificación en orden.
7. Un commit por cambio con sentido propio: dependencias, empaquetado, script de
   nativos. Así el `git bisect` sirve de algo si algo aparece semanas después.

## Puertas de verificación, en orden

El orden importa: cada puerta descarta una capa, y saltarse una hace que el
fallo de la siguiente sea imposible de atribuir.

1. **`npm test`** — 1080 tests. No cargan Electron, lo mockean, así que deben
   pasar sin cambios. Si fallan, el problema es de Node, no de Electron.
2. **`npm run dev` arranca** y abre el proyecto reciente: lista de usuarios,
   miniaturas por `app-img://`, barra de estado.
3. **Cámara**: abrir la ventana de captura en un equipo con webcam y capturar.
   Es el riesgo 3.
4. **Depósito**: sincronización del mirror, y una exportación completa contra
   `G:\Mi unidad\_Borrar` comprobando que se crea `Reemplazadas` y que no quedan
   `.tmp`. Ejercita sharp, el protocolo de imágenes y los renombrados sobre Drive.
5. **Impresión** de un recibo de prueba en la térmica. Es el riesgo 4.
6. **`npm run dist:win`** genera el instalador.
7. **Instalar el instalador y usar la aplicación instalada.** Innegociable: el
   asar, `asarUnpack` y los binarios nativos solo fallan aquí. Repetir en ella
   los puntos 2 a 5.

## Vuelta atrás

`package-lock.json` en git y la rama sin fusionar bastan. Si el instalador
resulta defectuoso ya distribuido, se reinstala la versión anterior desde
`dist/`; conviene conservar el instalador de 1.6.0 antes de empezar.

No hay migración de datos: ni el esquema de SQLite ni el formato del proyecto
cambian, así que un proyecto abierto con la versión nueva sigue abriéndose con la
vieja.

## Fuera de alcance

- **Servir el renderer por un esquema propio** en lugar de `file://`. Solo si el
  riesgo 3 se materializa.
- **Sustituir `electron-reloader`** por otra cosa. Si estorba, se quita.
- **Firma de código del instalador**. No se hace hoy y la migración no lo cambia.

## Después de migrar

Se ha llegado a estar dieciséis versiones por detrás porque no hay ninguna señal
que avise. Electron mantiene solo las tres últimas mayores y publica una nueva
cada ocho semanas, así que **el soporte de una versión dura unos seis meses**.
Conviene subir una o dos veces al año, por ejemplo junto a la preparación de cada
curso, cuando ya se hacen pruebas completas. Desde una versión con soporte el
salto siempre es pequeño; el caro es este.

## Referencias de código

| Qué | Dónde |
|---|---|
| Versiones y empaquetado | `package.json` |
| Recompilado de nativos | `scripts/rebuild-native.mjs` |
| Recarga en desarrollo | `main.js:52-61` |
| Protocolo propio ya registrado | `src/main/protocol/imageProtocol.js` |
| Captura desde webcam | `src/renderer/camera.js:65`, `src/renderer/renderer.js:2074` |
| Impresión silenciosa | `src/main/ipc/miscHandlers.js:1070-1090` |
| Listado de impresoras | `src/main/ipc/miscHandlers.js:897` |
