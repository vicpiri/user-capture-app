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

Los usuarios aparecen ordenados por primer apellido, segundo apellido y nombre. Al hacer clic en una fila, el usuario queda resaltado y su nombre aparece debajo de la lista. El número de usuarios cargados se ve en la parte inferior de la ventana.

## Buscar un usuario

1. Escribe en el cuadro de búsqueda que hay encima de la lista («Buscar usuario...»).
2. La lista se actualiza mientras escribes.
3. Para volver a la lista completa, borra el texto o pulsa la **X** que aparece dentro del cuadro.

La búsqueda encuentra el texto en el nombre, en cualquiera de los dos apellidos o en el NIA. Busca siempre en **todos los grupos**, aunque tengas uno elegido en el filtro de grupo.

> **Consejo:** escribe una sola palabra, el nombre o un apellido, pero no los dos juntos: «Ana García» no suele encontrar a nadie, mientras que «García» sí. Si no encuentras a alguien con tilde en el apellido, busca solo un trozo sin la letra acentuada, por ejemplo «mart» para «Martínez».

<!-- REVISAR: la búsqueda no incluye el DNI (solo nombre, apellidos y NIA), así que al personal no se le puede buscar por su documento. ¿Es intencionado? Tampoco ignora las tildes ni las mayúsculas acentuadas (LIKE de SQLite). -->

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

<!-- REVISAR: Carnets solicitados y Publicaciones solicitadas se guardan como preferencia y al reiniciar el menú los muestra marcados, pero la lista arranca sin filtrar (MenuEventManager.setupInitialPreferences solo aplica el de duplicadas). Por eso no se dice aquí que los filtros se recuerden. -->

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

<!-- REVISAR: con las tres opciones de foto desactivadas y el modo selección activo, la regla que oculta la columna usa la 5.ª columna (tables.css:58), que en ese momento es GRUPO por la casilla añadida delante. -->

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

> **Consejo:** al cerrar un mensaje de la aplicación, el cursor vuelve al cuadro de búsqueda. Si las flechas no responden, haz clic en la lista.

## Seleccionar varios usuarios

El modo selección sirve para marcar varios usuarios y aplicarles una acción a todos a la vez.

1. Haz clic con el botón derecho sobre uno de ellos y elige **Seleccionar**. Aparece una columna de casillas y ese usuario queda marcado.
2. Marca o desmarca las casillas de los demás usuarios.
3. Para marcar a todos los usuarios de la lista, usa la casilla de la cabecera de la tabla. Marca a todos los de la vista actual (con el grupo, la búsqueda o el filtro que tengas), no solo a los que caben en pantalla.

Debajo de la lista verás cuántos usuarios hay seleccionados.

La selección la usan estas acciones:

- **Solicitar impresión de carnet** y **Solicitar publicación oficial**, desde el menú contextual (ver más abajo).
- Las exportaciones **Archivo > Exportar > Archivo CSV para Carnets del grupo seleccionado**, **Archivo > Exportar > Imágenes como ID**, **Archivo > Exportar > Imágenes como nombre y apellidos** y **Archivo > Exportar > Imágenes capturadas al depósito**. Con usuarios marcados exportan solo esos; sin selección, los de la lista. Ver [Exportaciones](exportaciones.md).

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
