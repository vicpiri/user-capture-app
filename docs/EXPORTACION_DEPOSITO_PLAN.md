# Exportación al depósito: escritura segura y conservación de lo reemplazado

**Estado**: 🔧 Fase 1 implementada (2026-09-12), pendiente de la prueba en real.
Fases 2 y 3 sin implementar.
**Redactado**: 2026-09-12. **Revisado**: 2026-09-12 (la fase 2 pasa de copiar
a mover; la fase 1 absorbe el arreglo de la "copia original").
**Alcance**: `Archivo > Exportar > Imágenes capturadas al depósito`.

## El riesgo que se quiere cubrir

Sobrescribir una foto del depósito es **la única operación irreversible de toda
la aplicación**. Todo lo demás tiene vuelta atrás: los enlaces usuario-imagen se
respaldan antes de limpiarlos y se restauran desde `Proyecto > Restaurar enlaces
de imágenes`; las capturas siguen en `imports`; los usuarios se reimportan del
XML. Una foto del depósito machacada no la recupera nada dentro de la aplicación.

Hoy `export-to-repository` escribe `{NIA}.jpg` (o `{documento}.jpg`) en la raíz
del depósito y pisa lo que hubiera, sin avisar y sin conservar nada.

## El escenario que condiciona el diseño

Pueden funcionar **2-3 instancias en equipos distintos apuntando a la misma
carpeta de depósito** en Google Drive. Esto no es un detalle menor: invierte
decisiones que en monopuesto serían las obvias.

Cada instancia mantiene su propio mirror local en
`%APPDATA%/Edu User Capture/repository-mirror`, refrescado por sondeo: la
vigilancia escanea cada 10 s (`WATCH_POLL_INTERVAL`) y el sondeo de contenido
cada 60 s. **El mirror de una instancia puede ir hasta un minuto por detrás de
lo que otra acaba de escribir.** Y la propia vista de Google Drive File Stream
de cada PC también va por detrás de la nube: lo que otra instancia acaba de
subir tarda en aparecer en el disco virtual de esta.

Dos hechos del mirror que sostienen el diseño, comprobados en el código:

- `discoverRepositoryFiles()` (`repositoryMirror.js:253`) y `scanRepository()`
  (`repositoryMirror.js:612`) hacen `readdir` **de la raíz, sin recursividad**, y
  descartan todo lo que no sea `.jpg`/`.jpeg`.
- Por tanto, **una subcarpeta dentro del depósito es invisible para el mirror**, y
  también lo es un archivo con otra extensión (`.tmp`).

---

## Fase 1 — Escritura atómica y copia original que sea copia

Independiente de las demás y la más urgente.

> **Implementada** el 2026-09-12 en `exportHandlers.js`: `writeFileAtomically()`,
> `renameWithRetry()`, `removeOrphanTempExports()` y `buildOriginalCopy()`, todas
> cubiertas en `tests/unit/main/exportHandlers.test.js`. Queda **pendiente la
> prueba en real** contra Google Drive File Stream, que no puede hacerse sin
> exportar de verdad: ver Riesgos. Y sigue abierta la decisión sobre el EXIF,
> que ahora ya no es hipotética: con la copia exacta, los metadatos de las fotos
> de cámara o móvil llegan al depósito.

### Problema

`writeExportedImage()` (`exportHandlers.js:112`) escribe directamente sobre el
destino: `sharp(...).toFile(destPath)` en modo copia original, y
`fs.promises.writeFile(destPath, outputBuffer)` en modo redimensionado. Si eso se
interrumpe —tirón de Drive, aplicación cerrada, disco lleno— queda un archivo
truncado **y** el original ya no está.

En multi-instancia es peor: los mirrors de los otros equipos ven un cambio de
tamaño y **se llevan el archivo corrupto como si fuera bueno**. La corrupción se
propaga a los tres puestos.

### Diseño

Producir primero el buffer de salida en memoria y escribirlo en un temporal de la
misma carpeta, renombrando encima al final:

```
{destino}.{equipo}-{pid}-{contador}.tmp   →   fs.rename   →   {destino}
```

La extensión `.tmp` es la pieza clave: al no ser `.jpg`, **ningún mirror indexa
el archivo parcial**, así que los demás equipos solo llegan a ver el archivo
terminado.

El temporal vive en la carpeta compartida, así que el nombre lleva el equipo
(`os.hostname()`) además del `pid`: dos PCs pueden coincidir en `pid` y estar
exportando al mismo alumno.

Detalles que hay que prever:

- **Reintentos en el `rename`.** En Windows, si File Stream o el antivirus tienen
  el destino abierto en ese instante, falla con `EPERM` o `EBUSY`. Dos o tres
  reintentos con una pausa corta bastan.
- **Limpieza en el `catch`**, para no dejar el temporal si algo falla.
- **Residuos de cierres bruscos.** Un `.tmp` huérfano es invisible para todos los
  mirrors y se acumularía sin que nadie lo viera. Al empezar cada exportación,
  borrar los temporales con el patrón de la aplicación que queden en la raíz.

### La "copia original" recodifica sin necesidad

El modo copia original hace `sharp(buffer).rotate().toFile()`. El `rotate()` es
deliberado (el commit original lo describe como "copiar el original corrigiendo
la orientación", para fotos de móvil con EXIF girado), pero `toFile()` sobre un
`.jpg` **recodifica siempre** a la calidad por defecto de sharp, 80, con
submuestreo 4:2:0, y descarta los metadatos. No es una copia.

No es grave: el origen es siempre la foto de `imports`, nunca la del depósito,
así que la pérdida es de una sola generación y no se acumula. Pero la opción
promete lo que no hace, y las capturas de webcam, que salen de un canvas sin
EXIF y son la mayoría, se recomprimen sin motivo.

Arreglo, dentro del mismo refactor a buffer:

1. Leer `metadata()` del buffer de origen. Solo analiza la cabecera, es barato y
   de paso valida que el JPEG está entero.
2. Si `orientation` es 1 o no existe, **el buffer de salida es el de origen**.
   Copia de bytes exacta.
3. Si hay que rotar, `rotate()` y codificar con `quality: 95`. Ahí la
   recodificación es inevitable con sharp, pero queda residual y solo afecta a
   fotos de móvil.

Como el helper es común, el arreglo alcanza también a "Imágenes como ID" e
"Imágenes como nombre y apellidos".

**Decisión pendiente, EXIF.** Hoy los metadatos se pierden por accidente, y en un
depósito compartido eso es deseable: no viajan GPS ni datos de la cámara. Con la
copia exacta, el EXIF de las fotos de cámara o móvil llega al depósito. Quitarlo
sin recodificar exige una librería aparte que reescriba solo los segmentos EXIF,
porque sharp no lo hace sin volver a comprimir. Para capturas de webcam no cambia
nada. Hay que decidir si se acepta o se añade esa librería.

**Texto de la opción.** Renombrar "Copiar original" a algo como "Copiar original
(corrige la orientación si hace falta)", en `index.html` (radio `export-copy-original`).

### Verificación

- Unitario: interrumpir la escritura (mock que lanza tras crear el temporal) y
  comprobar que el destino conserva el contenido anterior intacto y que no queda
  ningún `.tmp`.
- Unitario: el destino final tiene los bytes nuevos y no existe el temporal.
- Unitario: un `.tmp` huérfano con el patrón de la aplicación desaparece al
  empezar la exportación; uno ajeno se respeta.
- Unitario: un JPEG sin orientación sale **byte a byte idéntico** al de entrada.
- Unitario: un JPEG con orientación 6 sale con las dimensiones intercambiadas y
  sin la etiqueta de orientación.
- **En real**: confirmar que `fs.rename` sobre Google Drive File Stream se
  comporta como se espera, y **qué hace Drive con el archivo pisado** (ver
  Riesgos). No es un sistema de archivos POSIX y esto no se puede dar por hecho.

---

## Fase 2 — Conservar lo reemplazado moviéndolo

### Diseño

Antes de sustituir la foto, **mover** la que había a:

```
<depósito>/Reemplazadas/<AAAAMMDDHHMMSS>_<equipo>/{id}.jpg
```

Mover, no copiar. La secuencia completa, con la fase 1 hecha:

1. Generar el buffer de salida y escribirlo en el `.tmp` (la parte lenta).
2. `fs.rename` del `{id}.jpg` existente a la carpeta `Reemplazadas/...`.
3. `fs.rename` del `.tmp` a `{id}.jpg`.

Los dos renombrados van seguidos y sin trabajo entre medias, así que la ventana
en la que `{id}.jpg` no existe dura milisegundos. El vigilante escanea cada 10 s;
si la pillara, vería un `unlink` y la sincronización diferida 2 s después
encontraría el archivo de vuelta. Si falla el paso 3, el `catch` deshace el paso
2; si eso también falla, se registra en el log dónde ha quedado el original, que
en ningún caso se pierde.

Por qué mover resuelve lo que copiar no:

- **Se conserva exactamente lo que había**, venga de donde venga. Con una copia
  hay que elegir de dónde sacarla: el mirror puede llevar un minuto de retraso
  respecto a lo que otra instancia acaba de escribir, y archivar esa versión
  vieja mientras se pierde la nueva es peor que no archivar nada. Mover elimina
  la pregunta.
- **Sin segunda subida.** Un movimiento dentro de la misma unidad de Drive es un
  cambio de metadatos, no una copia de bytes.
- **Sin depender del mirror** ni del supuesto sobre `mtime` descrito en Riesgos.

**Una carpeta por ejecución**, con marca temporal a resolución de segundo (la
misma convención `YYYYMMDDHHMMSS` que usan las capturas) y nombre del equipo:

- Una carpeta plana haría que la segunda exportación del mismo alumno
  sobrescribiera su propia copia, reproduciendo el problema.
- Con resolución de minuto, dos exportaciones seguidas del mismo alumno desde el
  mismo equipo colisionarían. Con segundos no puede ocurrir: una exportación
  tarda más que eso. Si aun así la carpeta existiera, añadir un sufijo.
- El nombre del equipo evita colisiones entre instancias y convierte la carpeta
  en un **registro de quién reemplazó qué y cuándo**, que en un montaje de tres
  puestos vale casi tanto como el archivo.

Encaja con las subcarpetas de convención que el depósito ya usa (`To-Print-ID`,
`To-Publish`) y, al ser subcarpeta, no se descarga a los mirrors de los tres
equipos.

### Lo que este diseño no puede garantizar

Se mueve lo que **este PC ve** en su disco virtual. Si otra instancia acaba de
subir una versión que File Stream todavía no ha traído, aquí no hay nada que
hacer: el conflicto es entre dos escrituras a la nube y lo resuelve Drive, no la
aplicación. Es el máximo alcanzable en local, y hay que contarlo así.

### Cuándo mover

- Solo si el destino ya existe. Si es una foto nueva no hay nada que conservar.
- Solo si el contenido **cambia**. Reexportar la misma foto sin tocarla no debe
  generar entrada en `Reemplazadas`. Con el buffer de salida en memoria:
  1. `stat` del destino. Si el tamaño difiere, cambia: mover.
  2. Si el tamaño coincide, comparar hash. El archivo existente se lee del mirror
     **solo si su `size` y `mtime` coinciden con lo que dice `mirrorIndex`**; si
     no coinciden o no está indexado, se lee del depósito. Es el único punto en
     que se sigue usando el mirror, como atajo, y con el arreglo de la fase 1
     este caso acierta siempre en el uso habitual: los bytes son literalmente los
     del origen.

### Purga

**Sin purga automática.** En una carpeta compartida, que cualquier instancia
borre por su cuenta lo que otra acaba de archivar es buscarse un problema.
Dejarlo como acción manual de menú, o simplemente documentado. Anotarlo junto a
los otros crecimientos sin límite ya detectados (`app.log`, caché de miniaturas).

### Verificación

- Unitario: con destino inexistente no se crea nada en `Reemplazadas`.
- Unitario: con destino existente y contenido distinto, el archivo de
  `Reemplazadas` tiene los bytes **anteriores** y el destino los nuevos.
- Unitario: con contenido idéntico no se mueve nada y el destino queda igual.
- Unitario: si falla el renombrado final, el original vuelve a su sitio y no
  queda `.tmp`.
- Unitario: mirror al día → el hash se calcula sobre el mirror; mirror desfasado
  en `mtime` o en `size` → se lee del depósito.
- Unitario: dos ejecuciones seguidas del mismo usuario dejan dos carpetas con
  una entrada cada una.

---

## Fase 3 — Aviso previo en el diálogo

El resumen del diálogo de exportación ya existe
(`ExportManager.describeExportScope()`). Añadir una fila:

```
Reemplazarán una foto existente    24
Son fotos nuevas                    9
```

**No hace falta IPC nuevo.** Los usuarios llegan al renderer con
`has_repository_image` (`userGroupImageHandlers.js:79`), que es lo mismo que
pinta el indicador de la lista. El recuento se hace sobre `usersToExport` en el
propio `describeExportScope`, con la misma fuente y la misma caducidad que el
indicador.

**Redactarlo sin prometer exactitud.** El dato sale del mirror, que puede llevar
hasta un minuto de retraso respecto a lo que otra instancia acaba de escribir.
Hay además un caso borde: la exportación siempre escribe `.jpg`, así que un
usuario cuya foto del depósito sea `.jpeg` contaría como reemplazo y en realidad
quedaría con dos archivos. Es raro, y una razón más para que el dato se lea como
orientativo.

Muchas veces evita el error en lugar de permitir deshacerlo, así que se
complementa bien con la fase 2 aunque parezca redundante.

---

## Decisiones y por qué

**Lo reemplazado se queda en el depósito, no en la carpeta del proyecto.** Esta
decisión se tomó al revés en un primer momento, asumiendo un solo operador. Con
2-3 equipos, quien necesita restaurar casi nunca es quien sobrescribió, y ni
siquiera sabrá qué máquina lo hizo: un archivo en el disco de un PC de aula es un
archivo que nadie encontrará, y que desaparece si ese equipo se reinstala.

**Mover en vez de copiar.** Conserva los bytes reales sin elegir origen, no sube
nada y no depende del mirror. El coste es una ventana de milisegundos sin el
archivo en la raíz, que el vigilante tolera.

**Subcarpeta del depósito y no carpeta hermana**, porque el mirror no es
recursivo y por tanto no se descarga a los tres equipos, y porque sigue la
convención que el depósito ya tiene.

**Copia original que sea copia**, dentro de la fase 1, porque el refactor a
buffer es el mismo y porque la comprobación de contenido idéntico de la fase 2
solo tiene sentido si reexportar lo mismo produce lo mismo.

**Sin purga automática**, por ser una carpeta compartida.

---

## Riesgos y cosas a verificar en real

**`fs.rename` sobre Google Drive File Stream.** No es POSIX. Hay que comprobar en
la instalación real que el renombrado sobre un destino existente funciona y que
los otros equipos no ven un estado intermedio. Si no se comportara bien, la
alternativa es escribir el `.tmp` y hacer `copyFile` + `unlink`, que ya no es
atómico pero al menos no deja el destino a medias durante la generación de la
imagen.

**Qué hace Drive con el archivo pisado por un `rename`.** Drive guarda revisiones
de los archivos sobrescritos en el sitio, restaurables desde la web con
"Gestionar versiones". Pero renombrar un `.tmp` encima puede que lo interprete
como borrar y crear: se perdería ese historial y cambiaría el ID del archivo. La
prueba de si Drive ya cubre la recuperación **hay que hacerla con el mecanismo
de la fase 1, no con la escritura directa de hoy**, o la conclusión no vale. Si
resulta que Drive manda el archivo pisado a la papelera, eso también es una vía
de recuperación digna de anotar. Con la fase 2 hecha como movimiento, el
historial de Drive deja de ser necesario, pero conviene saber qué queda.

**Supuesto no evidente del mirror**: `mirrorIndex` guarda el `size` y el `mtime`
de la **copia local** (`syncFiles`, `repositoryMirror.js:396-404`), pero
`determineFilesToSync()` los compara contra el `stat` del archivo **del
depósito**. Eso solo cuadra porque en Windows `CopyFile` conserva la fecha de
modificación del origen, y en macOS libuv usa `copyfile` con `COPYFILE_ALL`, que
también la conserva. En Linux `fs.copyFile` previsiblemente no la preserva y el
mirror se resincronizaría entero en cada arranque; no verificado, y ajeno a este
plan. Tras el cambio a mover, de este supuesto solo depende el atajo del hash en
la fase 2, y si falla el atajo se lee del depósito: el coste de equivocarse es
una lectura más, no una copia equivocada.

---

## Fuera de alcance

**El pisado silencioso entre operadores.** Si dos personas fotografían al mismo
alumno, el segundo en exportar pisa al primero y ninguno se entera. La carpeta
`Reemplazadas` conserva al perdedor y dice quién y cuándo, pero no evita la
situación. Atacarlo de raíz exigiría avisar cuando la foto del depósito sea más
reciente que la última sincronización de esa instancia. Queda para más adelante.

**Eliminar EXIF sin recodificar.** Pendiente de la decisión de la fase 1; si se
quiere, es una librería aparte.

---

## Orden sugerido

Las tres fases son independientes y se pueden entregar por separado:

1. **Escritura atómica y copia original real** — la más urgente, y la única que
   reduce un riesgo que hoy puede corromper el depósito de los tres equipos. Ya
   en la primera prueba real, observar qué hace Drive con el archivo pisado.
2. **Mover lo reemplazado** — sobre el helper ya refactorizado.
3. **Aviso previo** — la más barata, y sin dependencias de las otras dos.

## Referencias de código

| Qué | Dónde |
|---|---|
| Handler de exportación | `src/main/ipc/exportHandlers.js:588` |
| Escritura de la imagen (helper común a tres exportaciones) | `src/main/ipc/exportHandlers.js:112` |
| Nombre y ruta de destino | `src/main/ipc/exportHandlers.js:674-675` |
| Origen del `rotate()` en copia original | commit `41b5c09` |
| Índice del mirror | `src/main/repositoryMirror.js:143`, `:396-404` |
| Decisión de qué sincronizar | `src/main/repositoryMirror.js:301` |
| Descubrimiento (filtra `.jpg`, no recursivo) | `src/main/repositoryMirror.js:253` |
| Escaneo de vigilancia (ídem) | `src/main/repositoryMirror.js:612` |
| Ruta de un archivo en el mirror | `src/main/repositoryMirror.js:480` |
| `has_repository_image` por usuario | `src/main/ipc/userGroupImageHandlers.js:79` |
| Resumen del diálogo | `src/renderer/components/ExportManager.js`, `describeExportScope()` |
| Texto de la opción "Copiar original" | `src/renderer/index.html:283` (radio `export-copy-original`) |
