# Exportación al depósito: escritura segura y copia de lo reemplazado

**Estado**: 📋 Planificado, sin implementar.
**Redactado**: 2026-09-12.
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
decisiones que en monopuesto serían las obvias, y añade un modo de fallo propio
(ver "La copia podría guardar los bytes equivocados").

Cada instancia mantiene su propio mirror local en
`%APPDATA%/Edu User Capture/repository-mirror`, refrescado por sondeo: la
vigilancia escanea cada 10 s (`WATCH_POLL_INTERVAL`) y el sondeo de contenido
cada 60 s. **El mirror de una instancia puede ir hasta un minuto por detrás de
lo que otra acaba de escribir.**

Dos hechos del mirror que sostienen el diseño, comprobados en el código:

- `discoverRepositoryFiles()` (`repositoryMirror.js:253`) y `scanRepository()`
  (`repositoryMirror.js:612`) hacen `readdir` **de la raíz, sin recursividad**, y
  descartan todo lo que no sea `.jpg`/`.jpeg`.
- Por tanto, **una subcarpeta dentro del depósito es invisible para el mirror**, y
  también lo es un archivo con otra extensión (`.tmp`).

---

## Fase 1 — Escritura atómica

Independiente de las demás y la más urgente.

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

Escribir a un temporal en la misma carpeta y renombrar encima:

```
{destino}.{pid}-{contador}.tmp   →   fs.rename   →   {destino}
```

La extensión `.tmp` es la pieza clave: al no ser `.jpg`, **ningún mirror indexa
el archivo parcial**, así que los demás equipos solo llegan a ver el archivo
terminado.

Requiere un cambio pequeño en `writeExportedImage`: que el modo copia original
produzca buffer (`.toBuffer()`) en vez de escribir directo, para que ambos modos
compartan la misma escritura. Ese refactor lo aprovecha también la fase 2.

Limpiar el `.tmp` en el `catch` para no dejar residuos si falla.

### Verificación

- Unitario: interrumpir la escritura (mock que lanza tras crear el temporal) y
  comprobar que el destino conserva el contenido anterior intacto y que no queda
  ningún `.tmp`.
- Unitario: el destino final tiene los bytes nuevos y no existe el temporal.
- **En real**: confirmar que `fs.rename` sobre Google Drive File Stream se
  comporta como se espera. No es un sistema de archivos POSIX y esto no se puede
  dar por hecho (ver Riesgos).

---

## Fase 2 — Copia previa de lo reemplazado

### Diseño

Antes de sobrescribir, guardar la versión que había en:

```
<depósito>/Reemplazadas/<AAAAMMDD-HHMM>_<equipo>/{id}.jpg
```

**En Drive, no en local.** Ver "Decisiones" para el porqué.

**Una carpeta por ejecución**, con marca temporal y nombre del equipo
(`os.hostname()`). Sin esto el diseño no sirve:

- Una carpeta plana haría que la segunda exportación del mismo alumno
  sobrescribiera su propia copia de seguridad, reproduciendo el problema.
- El nombre del equipo evita colisiones si dos instancias arrancan en el mismo
  segundo, y de paso convierte la carpeta en un **registro de quién reemplazó qué
  y cuándo**, que en un montaje de tres puestos vale casi tanto como la copia.

Encaja con las subcarpetas de convención que el depósito ya usa (`To-Print-ID`,
`To-Publish`) y, al ser subcarpeta, no se descarga a los mirrors de los tres
equipos.

### La copia podría guardar los bytes equivocados

Este es el modo de fallo propio del multi-instancia y hay que tratarlo, no
mitigarlo.

Si el PC-B sobrescribe `12345.jpg` y treinta segundos después el PC-A exporta a
ese mismo alumno, **el mirror del PC-A todavía tiene la versión vieja**. Copiar
desde el mirror archivaría una versión ya superada, mientras la que de verdad se
pierde —la del PC-B— desaparece. Eso es peor que no tener copia: es una copia en
la que se confía y que no contiene lo que se cree.

Por tanto, **antes de usar el mirror hay que verificarlo**:

1. `stat` del archivo en el depósito.
2. Comparar `size` y `mtime` con lo que dice `mirrorIndex`.
3. **Coinciden** → copiar desde el mirror (local, gratis).
4. **No coinciden, o no está en el índice** → copiar desde el depósito (lento,
   posible descarga desde Drive, pero correcto).

El caso normal es el 3, así que el ahorro se mantiene: se evita descargar de
Drive lo que ya está en disco. El `stat` es metadato y en File Stream es barato.

### Cuándo copiar

- Solo si el destino ya existe. Si es una foto nueva no hay nada que conservar.
- Solo si el contenido **cambia**. Reexportar la misma foto sin tocarla no debe
  generar copia. Con el refactor de la fase 1 se tiene el buffer de salida en
  memoria antes de escribir, así que comparar tamaño y, si coincide, hash contra
  el archivo existente sale casi gratis.

### Purga

**Sin purga automática.** En una carpeta compartida, que cualquier instancia
borre por su cuenta copias que otra acaba de crear es buscarse un problema.
Dejarlo como acción manual de menú, o simplemente documentado. Anotarlo junto a
los otros crecimientos sin límite ya detectados (`app.log`, caché de miniaturas).

### Verificación

- Unitario: con destino inexistente no se crea copia.
- Unitario: con destino existente y contenido distinto, la copia contiene los
  bytes **anteriores**.
- Unitario: con contenido idéntico no se crea copia.
- Unitario: mirror al día → se copia desde el mirror; mirror desfasado en `mtime`
  o en `size` → se copia desde el depósito. Este es el test que importa.
- Unitario: dos ejecuciones seguidas del mismo usuario dejan dos copias, no una.

---

## Fase 3 — Aviso previo en el diálogo

El resumen del diálogo de exportación ya existe
(`ExportManager.describeExportScope()`). Añadir una fila:

```
Reemplazarán una foto existente    24
Son fotos nuevas                    9
```

Se resuelve consultando el índice del mirror, que está en memoria: coste cero.

**Redactarlo sin prometer exactitud.** El dato se calcula contra un mirror que
puede llevar hasta un minuto de retraso respecto a lo que otra instancia acaba de
escribir. Es orientativo, y así debe leerse.

Muchas veces evita el error en lugar de permitir deshacerlo, así que se
complementa bien con la fase 2 aunque parezca redundante.

---

## Decisiones y por qué

**Las copias van a Drive, no a la carpeta del proyecto.** Esta decisión se tomó
al revés en un primer momento, asumiendo un solo operador. Con 2-3 equipos, quien
necesita restaurar casi nunca es quien sobrescribió, y ni siquiera sabrá qué
máquina lo hizo: una copia en el disco de un PC de aula es una copia que nadie
encontrará, y que desaparece si ese equipo se reinstala. El coste es la subida de
una segunda copia de cada foto reemplazada; se acepta.

**Subcarpeta del depósito y no carpeta hermana**, porque el mirror no es
recursivo y por tanto no se descarga a los tres equipos, y porque sigue la
convención que el depósito ya tiene.

**Verificar el mirror en vez de confiar en él**, por lo explicado arriba.

**Sin purga automática**, por ser una carpeta compartida.

---

## Riesgos y cosas a verificar en real

**`fs.rename` sobre Google Drive File Stream.** No es POSIX. Hay que comprobar en
la instalación real que el renombrado sobre un destino existente funciona y que
los otros equipos no ven un estado intermedio. Si no se comportara bien, la
alternativa es escribir el `.tmp` y hacer `copyFile` + `unlink`, que ya no es
atómico pero al menos no deja el destino a medias durante la generación de la
imagen.

**Comprobar antes si Drive ya ofrece el historial de versiones.** Drive guarda
revisiones de los archivos sobrescritos, restaurables desde la web con "Gestionar
versiones". No está confirmado cómo se comporta con File Stream en esta
instalación. Es barato de probar —sobrescribir una foto y mirar— y si funcionase
bien podría bastar con la fase 1. Merece la pena hacer esa prueba antes de
implementar la fase 2.

**Supuesto no evidente del mirror**: `mirrorIndex` guarda el `size` y el `mtime`
de la **copia local** (`syncFiles`, `repositoryMirror.js:396-404`), pero
`determineFilesToSync()` los compara contra el `stat` del archivo **del
depósito**. Eso solo cuadra porque en Windows `CopyFile` conserva la fecha de
modificación del origen. La comparación de frescura de la fase 2 hereda ese
supuesto. En Linux y macOS `fs.copyFile` no preserva `mtime`, así que
previsiblemente el mirror se resincronizaría entero en cada arranque; no
verificado, y ajeno a este plan, pero conviene saberlo porque hay builds para
esas plataformas.

---

## Fuera de alcance

**El pisado silencioso entre operadores.** Si dos personas fotografían al mismo
alumno, el segundo en exportar pisa al primero y ninguno se entera. La copia
previa conserva al perdedor, pero no evita la situación. Atacarlo de raíz
exigiría avisar cuando la foto del depósito sea más reciente que la última
sincronización de esa instancia. Queda para más adelante.

---

## Orden sugerido

Las tres fases son independientes y se pueden entregar por separado:

1. **Escritura atómica** — la más urgente, y la única que reduce un riesgo que
   hoy puede corromper el depósito de los tres equipos.
2. **Copia previa** — antes conviene descartar que Drive ya lo cubra.
3. **Aviso previo** — la más barata, mejor después del refactor de la fase 1.

## Referencias de código

| Qué | Dónde |
|---|---|
| Handler de exportación | `src/main/ipc/exportHandlers.js:588` |
| Escritura de la imagen | `src/main/ipc/exportHandlers.js:112` |
| Nombre y ruta de destino | `src/main/ipc/exportHandlers.js:671-677` |
| Índice del mirror | `src/main/repositoryMirror.js:143`, `:396-404` |
| Decisión de qué sincronizar | `src/main/repositoryMirror.js:301` |
| Descubrimiento (filtra `.jpg`, no recursivo) | `src/main/repositoryMirror.js:253` |
| Escaneo de vigilancia (ídem) | `src/main/repositoryMirror.js:612` |
| Ruta de un archivo en el mirror | `src/main/repositoryMirror.js:480` |
| Resumen del diálogo | `src/renderer/components/ExportManager.js`, `describeExportScope()` |
