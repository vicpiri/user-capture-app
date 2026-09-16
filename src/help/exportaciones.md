# Exportaciones

Desde **Archivo > Exportar** sacas de la aplicación los datos y las fotos del proyecto: listados CSV para otros programas, carpetas de fotos, orlas en PDF y listados de pagos. Todas las exportaciones necesitan un proyecto abierto y te piden la carpeta donde guardar el resultado.

El cuadro para elegir la carpeta se abre en la última carpeta a la que exportaste, sea cual sea la exportación, para que no tengas que buscarla cada vez. Si esa carpeta ya no existe, se abre en la carpeta más cercana por encima de ella. La aplicación lo recuerda aunque la cierres.

## Qué hay en el menú Exportar

| Entrada del menú | Qué genera |
|---|---|
| **Archivo CSV para Carnets del grupo seleccionado** (`Ctrl+E`) | El archivo `carnets.csv` para el programa de carnets |
| **Archivos para Edu Inventory Manager** | `Alumnado.csv`, `Personal.csv` y `Grupos.csv`, y si quieres las fotos del depósito |
| **Imágenes capturadas como ID** | Las fotos capturadas, con el NIA o el DNI como nombre de archivo |
| **Imágenes del depósito como ID** | Las fotos del depósito de imágenes, con el NIA o el DNI como nombre de archivo |
| **Imágenes capturadas como nombre y apellidos** | Las fotos capturadas, con los apellidos y el nombre como nombre de archivo |
| **Imágenes capturadas al depósito** | Las fotos capturadas, copiadas al depósito de imágenes |
| **Orlas en PDF** | Un PDF de orla por grupo |
| **Listado de alumnos pagados en PDF** | El archivo `Alumnos_Pagados.pdf` |
| **Listado de alumnos pagados en CSV** | El archivo `Alumnos_Pagados.csv` |

Si en la carpeta elegida ya hay un archivo con el mismo nombre, la exportación lo sustituye.

## Qué usuarios se exportan

El CSV para carnets, **Imágenes capturadas como ID**, **Imágenes del depósito como ID**, **Imágenes capturadas como nombre y apellidos** e **Imágenes capturadas al depósito** deciden a quién incluir con esta regla, en este orden:

1. Si estás en modo selección y hay usuarios marcados, solo esos.
2. Si no, **los usuarios que ves en la lista**: los que dejen el filtro de grupos, la búsqueda y los filtros del menú **Ver**.

Es decir, lo que ves es lo que se exporta:

- con **Ver > Asignaciones duplicadas**, los usuarios que comparten foto con otro, de todos los grupos;
- con **Ver > Carnets solicitados** o **Ver > Publicaciones solicitadas**, los que tienen esa solicitud pendiente, de todos los grupos;
- con texto en el buscador, los resultados de la búsqueda, de todos los grupos;
- si no, el grupo elegido en el filtro de grupos, o todos si está en «Todos los grupos».

Si con la selección, la búsqueda y los filtros actuales no queda ningún usuario, la aplicación te avisa y no exporta nada.

Las demás exportaciones (inventario, orlas y listados de pagos) tienen su propio alcance, que se explica en cada apartado.

## Copiar el original o redimensionar

**Imágenes capturadas como ID**, **Imágenes capturadas como nombre y apellidos**, **Imágenes capturadas al depósito** y las fotos del inventario te dejan elegir cómo sale cada foto:

- **Copiar imagen original**: la foto sale tal cual. Solo se vuelve a guardar si la cámara la dejó marcada como girada, para ponerla derecha.
- **Redimensionar imágenes**: reduce las fotos con dos valores:
  - **Tamaño del cuadro (píxeles)**: la foto se reduce hasta caber en un cuadrado de ese lado (800 por defecto), sin deformarse. Las fotos más pequeñas no se amplían.
  - **Tamaño máximo de archivo (KB)**: la aplicación baja la calidad poco a poco hasta que la foto pesa menos de ese valor (500 por defecto). Hay una calidad mínima de la que no pasa, así que alguna foto puede quedar algo por encima.

En las tres exportaciones de fotos capturadas, la ventana **Opciones de Exportación** muestra antes un resumen: **Se exportará** (qué usuarios entran, según la regla anterior), cuántas imágenes se enviarán y cuántos **Usuarios sin foto capturada** hay en ese conjunto. Revísalo antes de pulsar **Exportar**.

## Exportar el CSV para carnets

Genera `carnets.csv`, el listado que usa el programa de impresión de carnets.

1. Elige a quién exportar (ver [Qué usuarios se exportan](#que-usuarios-se-exportan)). Lo habitual es elegir el grupo en el filtro de grupos.
2. Pulsa **Archivo > Exportar > Archivo CSV para Carnets del grupo seleccionado** o `Ctrl+E`.
3. Elige la carpeta donde guardarlo.
4. Si alguno de los usuarios exportados tenía una solicitud de carnet pendiente, la aplicación te pregunta si quieres marcarlos como impresos. Se explica en [Carnets y publicación oficial](carnets.md#marcar-los-carnets-como-impresos).
5. Un mensaje final indica cuántos usuarios se han exportado y cuántos se han ignorado.

> **Importante:** solo entran los usuarios que tienen foto en el depósito de imágenes, es decir, un archivo con su NIA o su DNI en la carpeta del depósito. Lo que cuenta es la foto del depósito, no la capturada: si acabas de hacer fotos nuevas, expórtalas antes al depósito. Los que no tienen foto allí aparecen como ignorados «sin imagen en el depósito».

El archivo usa punto y coma (`;`) como separador y tiene estas columnas, en este orden:

| Columna | Contenido |
|---|---|
| `id` | NIA para el alumnado; DNI (documento) para el personal |
| `password` | Lo mismo que `id` |
| `userlevel` | `Alumno` para el alumnado y `Profesor` para todo el personal, docente o no |
| `nombre` | Nombre |
| `apellido1` | Primer apellido |
| `apellido2` | Segundo apellido |
| `apellidos` | Los dos apellidos juntos |
| `centro` | Siempre `1` |
| `foto` | `NIA.jpg` para el alumnado y `DNI.jpg` para el personal |
| `grupo` | Nombre completo del grupo, por ejemplo `1º ESO A` (el código si el grupo ya no existe en el proyecto) |
| `direccion` | Vacía |
| `telefono` | Vacía |
| `departamento` | Siempre `1` |
| `DNI` | Documento de la persona, también del alumnado si lo tiene |
| `edad` | Para el alumnado, `mayor.jpg` si tiene 18 años el día de la exportación y `menor.jpg` si no; para el personal, `profesor.jpg` |
| `fechaNacimiento` | Fecha de nacimiento |
| `nombreApellidos` | Nombre y apellidos juntos |

## Exportar los archivos para Edu Inventory Manager

Genera los listados que importa Edu Inventory Manager y, si quieres, las fotos del depósito.

1. Si solo quieres un grupo, elígelo antes en el filtro de grupos.
2. Pulsa **Archivo > Exportar > Archivos para Edu Inventory Manager**.
3. En **Usuarios a exportar**, elige **Todos los usuarios** o **Grupo seleccionado** (el del filtro de grupos). Esta segunda opción no está disponible si no hay grupo elegido o si hay texto en el buscador. Si el grupo no tiene usuarios, la aplicación te avisa y no exporta nada.
4. Si quieres también las fotos, marca **Exportar imágenes del depósito** y elige **Copiar imagen original** o **Redimensionar imágenes** (ver [Copiar el original o redimensionar](#copiar-el-original-o-redimensionar)).
5. Si quieres las fotos comprimidas, marca **Comprimir imágenes en archivos ZIP** e indica el **Tamaño máximo por archivo ZIP (MB)** (25 por defecto).
6. Pulsa **Exportar** y elige la carpeta.
7. Un mensaje final resume los archivos creados, las imágenes exportadas y las que no tenían foto en el depósito.

Los tres listados usan la coma como separador:

| Archivo | Contenido |
|---|---|
| `Alumnado.csv` | Un alumno por fila: `Codigo` (el NIA), `Nombre`, `Apellido1`, `Apellido2`, `Fecha Nacimiento` y `Grupo` (código del grupo) |
| `Personal.csv` | Docentes y no docentes: `Función` (`Docente` o `No Docente`), `Documento`, `Nombre`, `Apellido1`, `Apellido2`, `Fecha Nacimiento`, `Teléfono 1`, `Teléfono 2` y `Email` (estas tres últimas, vacías) |
| `Grupos.csv` | `CódigoGrupo` y `Nombre` de cada grupo |

> **Importante:** `Grupos.csv` lleva siempre todos los grupos del proyecto, aunque exportes un solo grupo.

Sobre las fotos:

- Salen del depósito de imágenes, no de las capturadas. Solo se incluyen los usuarios que tienen foto en el depósito.
- Se llaman `NIA.jpg` o `DNI.jpg` y van todas juntas en la carpeta elegida, sin subcarpetas por grupo.
- Con la compresión activada, las fotos van dentro de `imagenes.zip`. Si no caben en el tamaño máximo, se reparten en varios archivos: `imagenes_1.zip`, `imagenes_2.zip`, etc. En la carpeta no quedan fotos sueltas.

## Exportar imágenes capturadas como ID

Copia las fotos capturadas a una carpeta, nombradas con el identificador de cada persona.

1. Elige a quién exportar (ver [Qué usuarios se exportan](#que-usuarios-se-exportan)).
2. Pulsa **Archivo > Exportar > Imágenes capturadas como ID**.
3. Elige la carpeta de destino.
4. Revisa el resumen, elige **Copiar imagen original** o **Redimensionar imágenes** y pulsa **Exportar**.

Dentro de la carpeta elegida se crea una subcarpeta por grupo, con el código del grupo como nombre. Cada foto se llama `NIA.jpg` para el alumnado y `DNI.jpg` para el personal. Solo se exportan los usuarios con una foto capturada enlazada; se saltan los que no tienen NIA o DNI.

Al terminar, un mensaje resume cuántas fotos se han exportado y en cuántas carpetas de grupo, cuántos usuarios sin grupo se han quedado fuera y qué fotos no se han podido exportar (por ejemplo, porque falta el archivo o el usuario no tiene NIA ni DNI).

## Exportar imágenes del depósito como ID

Hace lo mismo que **Imágenes capturadas como ID**, pero con las fotos del [depósito de imágenes](deposito.md) en lugar de las capturadas en el proyecto. Sirve, por ejemplo, para sacar las fotos oficiales de un grupo aunque este curso no se les haya hecho foto.

1. Elige a quién exportar (ver [Qué usuarios se exportan](#que-usuarios-se-exportan)).
2. Pulsa **Archivo > Exportar > Imágenes del depósito como ID**.
3. Elige la carpeta de destino.
4. Revisa el resumen: cuántas fotos del depósito se van a exportar y cuántos usuarios no tienen foto en él. Elige **Copiar imagen original** o **Redimensionar imágenes** y pulsa **Exportar**.
5. Al terminar, un mensaje resume cuántas fotos se han exportado, cuántos usuarios no tenían foto en el depósito y los problemas que haya habido.

El resultado tiene la misma forma que **Imágenes capturadas como ID**: una subcarpeta por grupo, con el código del grupo como nombre, y cada foto llamada `NIA.jpg` para el alumnado y `DNI.jpg` para el personal. Da igual que la persona tenga o no una foto capturada: solo cuenta la del depósito.

- Necesita el depósito configurado en **Proyecto > Configurar depósito de imágenes**.
- No depende de las opciones del depósito del menú **Ver**: la aplicación busca las fotos directamente en el depósito.
- Si la copia local del depósito está al día, lee las fotos de ella, que es más rápido; si no, las lee del depósito.
- Si la selección o los filtros no dejan ningún usuario, o ninguno tiene foto en el depósito, la aplicación te avisa y no exporta nada.

## Exportar imágenes capturadas como nombre y apellidos

Igual que la anterior, pero cada foto se llama con los apellidos y el nombre de la persona, con la primera letra de cada palabra en mayúscula: `Apellido1 Apellido2, Nombre.jpg`, por ejemplo `García López, Ana María.jpg`.

1. Elige a quién exportar (ver [Qué usuarios se exportan](#que-usuarios-se-exportan)).
2. Pulsa **Archivo > Exportar > Imágenes capturadas como nombre y apellidos**.
3. Elige la carpeta de destino.
4. Revisa el resumen, elige **Copiar imagen original** o **Redimensionar imágenes** y pulsa **Exportar**.

Las fotos también se reparten en una subcarpeta por grupo, y al terminar se muestra el mismo resumen.

> **Importante:** si dos personas del mismo grupo se llaman exactamente igual, sus fotos tendrían el mismo nombre de archivo y la segunda sustituiría a la primera. En ese caso, usa **Imágenes capturadas como ID**.

## Exportar imágenes capturadas al depósito

**Archivo > Exportar > Imágenes capturadas al depósito** copia las fotos capturadas de los usuarios a exportar (ver [Qué usuarios se exportan](#que-usuarios-se-exportan)) a la carpeta del depósito de imágenes, con el NIA o el DNI como nombre, y sustituye las que ya hubiera. Al terminar, te ofrece desvincular las fotos de los usuarios exportados para empezar una nueva ronda. El proceso completo, incluido qué pasa con las fotos sustituidas y cómo deshacer la desvinculación, está en [Depósito de imágenes](deposito.md).

## Exportar orlas y listados de pagos

Estas exportaciones trabajan sobre todo el proyecto y no tienen en cuenta la búsqueda, el filtro de grupos ni la selección de la lista:

- **Orlas en PDF** genera un PDF por grupo con la foto y el nombre de cada persona. Ver [Exportar las orlas en PDF](orlas.md#exportar-las-orlas-en-pdf).
- **Listado de alumnos pagados en PDF** y **Listado de alumnos pagados en CSV** generan la lista de quienes han pagado la orla. Ver [Exportar el listado de alumnos pagados](orlas.md#exportar-el-listado-de-alumnos-pagados).
