# Lista de usuarios

La lista de la izquierda muestra el alumnado y el personal del proyecto. Desde ella eliges a quién enlazar una foto, compruebas quién tiene ya foto y marcas varios usuarios a la vez para exportarlos o solicitar sus carnets.

## Qué muestra la tabla

| Columna | Contenido |
|---|---|
| NOMBRE | Nombre del usuario. |
| APELLIDOS | Primer y segundo apellido. |
| ID | NIA en el caso del alumnado y DNI en el del personal. Si falta, aparece un guion. |
| GRUPO | Código del grupo. El personal docente y el no docente tienen sus propios grupos. |
| FOTOS | Miniaturas e iconos con el estado de cada usuario (ver [Iconos de cada fila](usuarios.md#iconos-de-cada-fila)). |

Los usuarios aparecen ordenados por primer apellido, segundo apellido y nombre. Para ordenar no cuentan las tildes, las mayúsculas, los espacios ni los guiones («Álvarez» va con «Alvarez» y «De la Fuente» se ordena como «Delafuente»), y la `ñ` va entre la `n` y la `o`. Los listados y las exportaciones siguen el mismo orden. Al hacer clic en una fila, el usuario queda resaltado y su nombre aparece debajo de la lista. El número de usuarios cargados se ve en la parte inferior de la ventana.

## Buscar un usuario

1. Escribe en el cuadro de búsqueda que hay encima de la lista («Buscar usuario...»).
2. La lista se actualiza mientras escribes.
3. Para volver a la lista completa, borra el texto o pulsa la **X** que aparece dentro del cuadro.

La búsqueda encuentra el texto en el nombre, en cualquiera de los dos apellidos, en el NIA o en el documento (DNI), así que también sirve para el personal. Busca siempre en **todos los grupos**, aunque tengas uno elegido en el filtro de grupo.

- No distingue mayúsculas ni tildes: «jose» encuentra «José» y «garcia» encuentra «García».
- Si escribes varias palabras, deben aparecer todas, cada una en cualquiera de esos datos: «ana garcia» encuentra a Ana García.

## Filtrar por grupo

1. Abre el desplegable de grupos, junto al cuadro de búsqueda. Cuando no hay ninguno elegido muestra «Todos los grupos».
2. Elige el grupo. Cada opción muestra el código y el nombre del grupo.

Para volver a ver a todo el mundo, elige **Todos los grupos**. Mientras haya texto en el cuadro de búsqueda, el filtro de grupo no se aplica.

La aplicación recuerda el grupo elegido para la próxima vez. El mismo grupo se usa en los cuadros de imágenes capturadas y del depósito: si lo cambias en uno de ellos, cambia también en la ventana principal.

Los usuarios que desaparecen del XML al actualizarlo pasan al grupo «⚠ Eliminados» (ver [Proyectos](proyectos.md)).

## Filtros especiales del menú Ver

Las tres primeras opciones del menú **Ver** muestran solo un tipo de usuarios:

| Opción | Muestra |
|---|---|
| **Ver > Asignaciones duplicadas** | Usuarios que comparten la misma foto capturada con otro usuario. |
| **Ver > Carnets solicitados** | Usuarios con una solicitud de impresión de carnet pendiente. |
| **Ver > Publicaciones solicitadas** | Usuarios con una solicitud de publicación oficial pendiente. |

- Solo puede haber uno activo: al activar uno, los otros dos se desactivan.
- Muestran usuarios de todos los grupos, sin tener en cuenta el grupo elegido ni la búsqueda.
- Para volver a la lista normal, pulsa otra vez la misma opción para desmarcarla.
- El filtro que tengas activo se recuerda al cerrar la aplicación y se vuelve a aplicar al abrirla.

### Avisos encima de la lista

Encima de la lista pueden aparecer hasta tres avisos de colores con un número:

| Aviso | Color | Qué cuenta |
|---|---|---|
| asignaciones duplicadas | Rojo | Usuarios que comparten foto con otro usuario. |
| carnets pendientes | Amarillo | Solicitudes de impresión de carnet pendientes. |
| fotos pendientes | Azul claro | Solicitudes de publicación oficial pendientes. |

Cada aviso solo se muestra cuando su número es mayor que cero. Al hacer clic en un aviso se activa el filtro correspondiente, igual que desde el menú **Ver**, y el aviso queda remarcado. Otro clic lo desactiva.

## Iconos de cada fila

En la columna FOTOS cada usuario puede mostrar estos elementos, de izquierda a derecha:

| Elemento | Qué significa |
|---|---|
| Miniatura redonda | Foto capturada enlazada al usuario. |
| Círculo gris con una silueta | El usuario todavía no tiene foto capturada. |
| Miniatura con borde rojo | Esa foto está enlazada también a otro usuario: es una [foto duplicada](enlazar.md#fotos-duplicadas). |
| Segunda miniatura | Foto del usuario en el [depósito](deposito.md), la de cursos anteriores. Si no hay, aparece una silueta más tenue. |
| Círculo verde con una marca | El usuario tiene foto en el depósito. |
| Tarjeta de color ámbar | Tiene una solicitud de impresión de carnet pendiente. |
| Flecha morada hacia arriba | Tiene una solicitud de publicación oficial pendiente. |
| Símbolo de dólar verde | La orla está pagada. |
| Impresora azul | El recibo de la orla está impreso. |

- La miniatura del depósito y el círculo verde solo aparecen si activas sus opciones en el menú **Ver** (ver [Mostrar u ocultar fotos e indicadores](usuarios.md#mostrar-u-ocultar-fotos-e-indicadores)). Mientras la aplicación consulta el depósito, en su lugar gira un pequeño círculo de carga.
- Las solicitudes de carnet y de publicación se explican en [Carnets y publicación oficial](carnets.md).
- Los iconos de orla y recibo solo aparecen con **Ver > Acciones adicionales** activado. Ver [Orlas, pagos y recibos](orlas.md).

## Mostrar u ocultar fotos e indicadores

Estas opciones del menú **Ver** se activan y desactivan con un clic:

| Opción | Qué muestra | Al instalar |
|---|---|---|
| **Ver > Fotografías capturadas** | La miniatura de la foto capturada, o la silueta gris si no hay. | Activada |
| **Ver > Fotografías del depósito** | La miniatura de la foto del depósito. | Desactivada |
| **Ver > Indicadores de foto en el depósito** | El círculo verde cuando el usuario tiene foto en el depósito. | Desactivada |
| **Ver > Acciones adicionales** | Los botones de pago de orla bajo el visor y los iconos de orla pagada y recibo impreso. | Activada |

Si desactivas las tres primeras, la columna FOTOS desaparece de la tabla. La aplicación recuerda estas opciones para la próxima vez.

> **Consejo:** si solo necesitas saber quién tiene ya foto en el depósito, basta con **Indicadores de foto en el depósito**; la miniatura te sirve cuando quieres comparar la foto antigua con la nueva.

## Vista de miniaturas

**Ver > Vista de miniaturas** (`Ctrl+M`) cambia la tabla de usuarios por una cuadrícula con la foto de cada uno y, debajo, su nombre, sus apellidos y su grupo. Sirve para repasar de un vistazo las fotos de muchos usuarios a la vez. Vuelve a pulsar `Ctrl+M` para regresar a la tabla.

- Encima de la cuadrícula eliges qué fotos se ven: **Capturadas**, las enlazadas en el proyecto, o **Depósito**, las del depósito de imágenes. La primera vez que eliges **Depósito**, las fotos pueden tardar unos segundos en aparecer mientras se consulta el depósito.
- Al lado verás cuántos usuarios hay y cuántos tienen foto de la clase elegida. Los que no tienen foto aparecen con una silueta gris.
- Aparecen los mismos usuarios que en la tabla: con el grupo, la búsqueda y los filtros del menú **Ver** que tengas puestos. Con **Todos los grupos** ves a todo el proyecto.

Cada miniatura funciona como una fila de la tabla:

- Un clic selecciona al usuario, así que puedes enlazarle la foto del visor con **Enlazar** o `Ctrl+L`, como siempre.
- `↑` y `↓` pasan al usuario anterior o siguiente, en el orden de la cuadrícula, y `←` y `→` siguen recorriendo las fotos del visor.
- Un doble clic amplía la foto que se ve en la miniatura.
- El botón derecho abre el mismo menú contextual que en la tabla. Con **Seleccionar** aparece una casilla en cada miniatura, y encima de la cuadrícula la casilla **Seleccionar todos**.

La aplicación recuerda si usabas la vista de miniaturas y qué fotos mostraba. La vista de miniaturas también se guarda en los espacios de trabajo.

## Espacios de trabajo

Un espacio de trabajo guarda una combinación de las opciones de visualización del menú **Ver**: **Fotografías capturadas**, **Fotografías del depósito**, **Indicadores de foto en el depósito**, **Acciones adicionales**, **Historial de capturas** y **Vista de miniaturas**. La elección entre **Capturadas** y **Depósito** de la vista de miniaturas no forma parte del espacio. Así cambias de una fase del trabajo a otra de una vez, en lugar de activar y desactivar las opciones una a una.

Los filtros del menú **Ver** (**Asignaciones duplicadas**, **Carnets solicitados** y **Publicaciones solicitadas**) no forman parte de los espacios: al cambiar de espacio siguen como estaban.

### Espacios predefinidos

La aplicación trae tres, todos con la tabla en lugar de las miniaturas:

| Espacio | Para qué | Qué muestra |
|---|---|---|
| **Captura** | La sesión de fotos | Fotografías capturadas, indicadores del depósito e historial de capturas |
| **Revisión** | Comparar las fotos nuevas con las antiguas | Fotografías capturadas, fotografías del depósito e indicadores del depósito |
| **Carnets** | Preparar la impresión de carnets | Fotografías del depósito, indicadores del depósito y acciones adicionales |

No se pueden cambiar ni borrar, pero puedes quitarlos del menú si no los usas (ver más abajo).

### Cambiar de espacio

- Elige el espacio en **Ver > Espacios de trabajo**.
- O pulsa `Ctrl+1` a `Ctrl+9`: el número es la posición del espacio en ese menú. Solo los nueve primeros tienen atajo.

El menú marca el espacio que coincide con lo que se ve ahora. Si después cambias alguna opción a mano, la marca desaparece; si la vuelves a dejar como estaba, reaparece.

### Crear un espacio personalizado

1. Deja las opciones del menú **Ver** como las quieras.
2. Elige **Ver > Espacios de trabajo > Guardar la vista actual como espacio nuevo...**.
3. Escribe un nombre y pulsa **Guardar** o `Intro`.

El espacio nuevo aparece en el menú detrás de los que ya había. El nombre no puede repetir el de otro espacio, sin contar mayúsculas ni tildes, y tiene como máximo 40 caracteres.

### Gestionar los espacios

**Ver > Espacios de trabajo > Gestionar espacios de trabajo...** abre la ventana **Espacios de trabajo**, con la lista de espacios, lo que muestra cada uno y su atajo. El que coincide con la vista actual lleva la etiqueta **En uso**.

- **Aplicar** cambia a ese espacio y cierra la ventana.
- En tus espacios:
  - **Guardar vista actual** sustituye sus opciones por las que tienes ahora. Antes te lo pregunta.
  - **Renombrar** cambia el nombre. Escríbelo y pulsa `Intro`; `Esc` deja el nombre como estaba.
  - **Borrar** lo elimina, después de preguntarte.
- En los predefinidos, la casilla **En el menú** los quita del menú **Ver** o los vuelve a poner. Un espacio quitado no ocupa ningún atajo: los siguientes suben un puesto.

Los espacios son de la aplicación, no de cada proyecto: los mismos sirven para todos tus proyectos.

## Ver la foto de un usuario en grande

Haz doble clic en una miniatura de la columna FOTOS:

- En la foto capturada, se abre con el nombre completo del usuario como título.
- En la foto del depósito, el título termina en «- Depósito».

Pulsa **Cerrar** para volver a la lista.

## Moverse por la lista con el teclado

| Tecla | Acción |
|---|---|
| `Flecha arriba` / `Flecha abajo` | Selecciona el usuario anterior o siguiente de la lista. Desde el último se pasa al primero, y al revés. |
| `Flecha izquierda` / `Flecha derecha` | Muestra la foto anterior o siguiente en el visor (ver [Enlazar fotos](enlazar.md)). |

Junto con `Ctrl+L`, que enlaza la foto del visor al usuario seleccionado, puedes hacer toda una sesión de enlazado sin tocar el ratón.

Las flechas no actúan mientras el cursor está en el cuadro de búsqueda ni mientras hay una ventana de aviso abierta.

## Seleccionar varios usuarios

El modo selección sirve para marcar varios usuarios y aplicarles una acción a todos a la vez.

1. Haz clic con el botón derecho sobre uno de ellos y elige **Seleccionar**. Aparece una columna de casillas y ese usuario queda marcado.
2. Marca o desmarca las casillas de los demás usuarios.
3. Para marcar a todos los usuarios de la lista, usa la casilla de la cabecera de la tabla. Marca a todos los de la vista actual (con el grupo, la búsqueda o el filtro que tengas), no solo a los que caben en pantalla.

Debajo de la lista verás cuántos usuarios hay seleccionados.

La selección la usan estas acciones:

- **Solicitar impresión de carnet** y **Solicitar publicación oficial**, desde el menú contextual (ver más abajo).
- Las exportaciones **Archivo > Exportar > Archivo CSV para Carnets del grupo seleccionado**, **Archivo > Exportar > Imágenes capturadas como ID**, **Archivo > Exportar > Imágenes capturadas como nombre y apellidos** y **Archivo > Exportar > Imágenes capturadas al depósito**. Con usuarios marcados exportan solo esos; sin selección, los de la lista. Ver [Exportaciones](exportaciones.md).

Para salir del modo selección, haz clic derecho y elige **Deseleccionar todo**, o desmarca la última casilla que quede marcada. Desmarcar la casilla de la cabecera quita todas las marcas, pero te deja dentro del modo selección.

> **Importante:** el modo selección no cambia a quién se enlaza una foto. **Enlazar** actúa siempre sobre el usuario resaltado, el último en el que hiciste clic, aunque haya otros marcados.

## Menú contextual de una fila

Al hacer clic con el botón derecho sobre una fila aparece un menú. Sus opciones dependen de si estás en modo selección.

Fuera del modo selección:

| Opción | Cuándo aparece | Qué hace |
|---|---|---|
| **Seleccionar** | Siempre | Activa el modo selección con ese usuario marcado. |
| **Desmarcar recibo impreso** | Si el recibo de la orla del usuario está marcado como impreso | Quita la marca de recibo impreso, tras pedir confirmación. |
| **Desmarcar orla pagada** | Si la orla está pagada y el recibo no está impreso | Quita la marca de orla pagada, tras pedir confirmación. |

En modo selección las opciones actúan sobre **todos los usuarios marcados**, no solo sobre la fila en la que haces clic:

| Opción | Qué hace |
|---|---|
| **Solicitar impresión de carnet** | Solicita el carnet de los usuarios marcados. |
| **Solicitar publicación oficial** | Solicita la publicación oficial de la foto de los usuarios marcados. |
| **Deseleccionar todo** | Quita todas las marcas y sale del modo selección. |

Las dos solicitudes solo se aplican a los usuarios que tienen foto en el depósito. Ver [Carnets y publicación oficial](carnets.md).

> **Consejo:** para solicitar el carnet de un solo usuario, haz clic derecho sobre él, elige **Seleccionar** y vuelve a hacer clic derecho para elegir **Solicitar impresión de carnet**.
