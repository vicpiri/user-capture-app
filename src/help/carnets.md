# Carnets y publicación oficial

La aplicación lleva la cuenta de qué carnets hay que imprimir y qué fotos hay que publicar mediante carpetas dentro del depósito de imágenes. Como el depósito es compartido, todos los equipos que trabajan con él ven las mismas solicitudes.

## Antes de empezar

- El proyecto tiene que tener configurado el depósito de imágenes. Se explica en [Depósito de imágenes](deposito.md).
- Solo se puede solicitar algo para quien ya tiene foto en el depósito, es decir, un archivo `NIA.jpg` (alumnado) o `DNI.jpg` (personal) en la carpeta del depósito. A los demás se les salta y el mensaje final dice cuántos se han omitido.
- Las solicitudes se hacen en modo selección, aunque sea para un solo usuario. El modo selección se explica en [Lista de usuarios](usuarios.md).

## Solicitar la impresión de carnets

1. En la lista de usuarios, pulsa con el botón derecho sobre un usuario y elige **Seleccionar**. Se activa el modo selección con ese usuario marcado.
2. Marca las casillas de los demás usuarios. La casilla de la cabecera de la tabla marca todos los que se ven en la lista.
3. Pulsa con el botón derecho sobre cualquiera de los usuarios y elige **Solicitar impresión de carnet**.
4. Un mensaje indica cuántos archivos se han generado en la carpeta `To-Print-ID` y cuántos usuarios se han omitido por no tener imagen en el depósito.

Por cada usuario, la aplicación crea en la carpeta `To-Print-ID` del depósito un archivo vacío cuyo nombre es su NIA o su DNI, sin extensión. Si la carpeta no existe, la crea. Volver a solicitar el carnet de alguien que ya lo tiene pedido no duplica nada.

## Ver los carnets pendientes

- En la lista, los usuarios con carnet pendiente muestran un icono de tarjeta junto a sus demás indicadores.
- Encima de la lista aparece un contador con el número de **carnets pendientes**. Al pulsarlo se activa o se desactiva el filtro.
- **Ver > Carnets solicitados** muestra solo a los usuarios con carnet pendiente, de todos los grupos, sin tener en cuenta el filtro de grupos ni la búsqueda.

Solo puede estar activo uno de estos tres filtros a la vez: **Asignaciones duplicadas**, **Carnets solicitados** y **Publicaciones solicitadas**. Al activar uno, los otros se desactivan.

## Marcar los carnets como impresos

Los carnets se marcan como impresos al exportar el CSV para carnets, que es el archivo con el que se imprimen:

1. Exporta el CSV como se explica en [Exportar el CSV para carnets](exportaciones.md#exportar-el-csv-para-carnets).
2. Si alguno de los usuarios exportados tenía solicitud pendiente, la aplicación pregunta: «N de los usuarios exportados tienen solicitud de carnet pendiente. ¿Desea marcarlos como impresos?».
3. Si respondes **Sí**, sus archivos se mueven de `To-Print-ID` a la carpeta `Printed-ID` del depósito (que se crea si no existe), desaparece el icono de tarjeta y un mensaje indica cuántas solicitudes se han movido. Si respondes **No**, las solicitudes siguen pendientes.

Solo se marcan los usuarios que han entrado en el CSV. La aplicación no tiene otra forma de marcar un carnet como impreso.

> **Consejo:** para imprimir exactamente los carnets pedidos, activa **Ver > Carnets solicitados**, pulsa con el botón derecho sobre un usuario, elige **Seleccionar**, marca la casilla de la cabecera para seleccionarlos todos y pulsa `Ctrl+E`. Sin la selección, el CSV incluiría el grupo del filtro de grupos en lugar de los usuarios con solicitud.

## Consultar los últimos carnets impresos

**Ver > Últimos carnets impresos** abre la ventana **Últimos Carnets Impresos**, con los usuarios cuyo archivo está en la carpeta `Printed-ID` del depósito. Necesita un proyecto abierto con el depósito configurado.

- Cada fila muestra **Tipo**, **ID**, **Nombre Completo**, **Grupo** y **Fecha de Impresión**, de la más reciente a la más antigua. Arriba se indica el total.
- La **Fecha de Impresión** es el momento en que el carnet se marcó como impreso. En los marcados con versiones anteriores a la 1.10.0 aparece, en cambio, la fecha en que se solicitó.
- Solo aparecen los usuarios del proyecto abierto. Si en `Printed-ID` hay archivos que no corresponden a nadie del proyecto, no se muestran.
- La lista se lee al abrir la ventana. Si ya estaba abierta, ciérrala y vuelve a abrirla para ver los últimos cambios.
- El botón **Limpiar Lista** borra todos los archivos de la carpeta `Printed-ID`, después de pedirte confirmación. No se puede deshacer. No afecta a las solicitudes pendientes ni a las fotos.

## Solicitar la publicación oficial de fotos

Sirve para pedir que la foto de una persona se publique en el sistema oficial del centro.

1. Pulsa con el botón derecho sobre un usuario y elige **Seleccionar**.
2. Marca las casillas de los demás usuarios, o la de la cabecera para marcar todos los que se ven.
3. Pulsa con el botón derecho sobre cualquiera de los usuarios y elige **Solicitar publicación oficial**.
4. Un mensaje indica cuántas imágenes se han copiado en la carpeta `To-Publish` y cuántos usuarios se han omitido por no tener imagen en el depósito.

Por cada usuario, la aplicación copia su foto del depósito a la carpeta `To-Publish` del depósito, con el nombre `NIA.jpg` o `DNI.jpg`. Si la carpeta no existe, la crea.

- En la lista, los usuarios con publicación pendiente muestran un icono de flecha hacia arriba.
- Encima de la lista aparece un contador con el número de **fotos pendientes**. Al pulsarlo se activa o se desactiva el filtro.
- **Ver > Publicaciones solicitadas** muestra solo a los usuarios con publicación pendiente, de todos los grupos.

> **Importante:** en `To-Publish` queda la foto tal como estaba en el depósito en el momento de la solicitud. Si después exportas una foto nueva al depósito, la copia de `To-Publish` no se actualiza: vuelve a solicitar la publicación para sustituirla.

La aplicación no marca las publicaciones como hechas: la solicitud desaparece cuando alguien retira la foto de `To-Publish` fuera de la aplicación.

## Qué pasa si otra persona borra o mueve los archivos

Los archivos de estas carpetas son el único registro de las solicitudes; la aplicación no guarda ninguna otra copia. Por eso:

- Si alguien borra un archivo de `To-Print-ID` o de `To-Publish` (desde otro equipo, o al gestionar los carnets o las publicaciones), la solicitud desaparece. El icono y el contador se actualizan la próxima vez que se recarga la lista de usuarios, por ejemplo al cambiar de grupo o al buscar; puede tardar hasta medio minuto.
- Si alguien mueve a mano los archivos de `To-Print-ID` a `Printed-ID`, esos carnets aparecen en **Últimos carnets impresos** igual que los marcados desde la aplicación.
- Si alguien borra archivos de `Printed-ID`, esos usuarios dejan de aparecer en **Últimos carnets impresos**.

En ningún caso se tocan las fotos del proyecto ni sus enlaces.
