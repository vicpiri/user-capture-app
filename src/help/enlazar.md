# Enlazar fotos

Enlazar es asignar a un usuario una de las fotos capturadas del proyecto. Cada usuario puede tener como mucho una foto capturada enlazada; en esta página verás cómo enlazarla, cómo corregir un enlace equivocado y cómo repasar las fotos de un grupo.

## El visor de fotos

El panel de la derecha muestra en grande las fotos capturadas del proyecto, es decir, las que hay en la carpeta `imports`. Están ordenadas por nombre de archivo, de modo que las capturas más recientes salen primero.

- Pasa de una foto a otra con las flechas del propio visor o con las teclas `Flecha izquierda` y `Flecha derecha`. Desde la última se vuelve a la primera.
- Cuando llega una foto nueva, el visor salta a ella.
- Si la foto tiene etiquetas, aparecen debajo del visor (ver [Etiquetas de imágenes](enlazar.md#etiquetas-de-imagenes)).
- Si una foto se ve tumbada, gírala con los botones de arriba a la derecha del visor. Ver [Fotos que llegan giradas](captura.md#fotos-que-llegan-giradas).
- Con **Ver > Historial de capturas** tienes al lado del visor una tira de miniaturas: al hacer clic en una, el visor salta a esa foto. Ver [Captura e importación de fotos](captura.md).

El visor muestra todas las fotos de `imports`, estén enlazadas o no: enlazar una foto no la quita del visor.

### Ver el visor en otro monitor

**Ver > Visor en ventana aparte** (`Ctrl+Shift+F`) abre una ventana que muestra siempre la misma foto que el visor de la ventana principal. Arrástrala a otro monitor, por ejemplo uno orientado hacia la persona fotografiada, para que vea su foto mientras trabajas.

- Cambia sola cuando pasas de una foto a otra, cuando llega una foto nueva o cuando giras la que se ve. No tiene botones: todo se hace desde la ventana principal.
- Haz doble clic en ella o pulsa `F11` para verla a pantalla completa en su monitor; `Esc` o `F11` la devuelven a su tamaño.
- Al cerrarla recuerda dónde estaba, y la siguiente vez se abre en el mismo monitor, también a pantalla completa si lo estaba. Si ese monitor ya no está conectado, se abre en el principal.
- No necesita un proyecto abierto. Si el visor no muestra ninguna foto, la ventana dice «No hay ninguna foto en el visor».
- Se cierra sola al cerrar la aplicación.

<!-- REVISAR: el visor no tiene contador de fotos (CLAUDE.md lo menciona en ImageGridManager, "contador, botones"); no se documenta. -->

## Enlazar una foto a un usuario

1. En el visor, busca la foto.
2. En la lista, haz clic en el usuario o llega a él con las flechas.
3. Pulsa **Enlazar**, o elige **Edición > Enlazar imagen** (`Ctrl+L`).

El botón **Enlazar** está desactivado hasta que hay un usuario seleccionado y una foto en el visor. Al enlazar, la miniatura de la foto aparece en la fila del usuario.

Enlazar no mueve ni copia el archivo: solo anota qué foto corresponde a cada usuario. La foto sigue en `imports`.

> **Consejo:** con `Flecha arriba` y `Flecha abajo` para elegir usuario, `Flecha izquierda` y `Flecha derecha` para elegir foto y `Ctrl+L` para enlazar, puedes trabajar sin ratón. Ver [Lista de usuarios](usuarios.md#moverse-por-la-lista-con-el-teclado).

## Si el usuario ya tiene foto

Un usuario solo puede tener una foto capturada. Si ya tiene una, la aplicación pregunta «El usuario ya tiene una imagen asignada. ¿Deseas reemplazarla?».

- Con **Sí**, la foto nueva sustituye a la anterior. El archivo de la anterior no se borra: sigue en `imports` y en el visor.
- Con **No**, todo queda como estaba.

## Fotos duplicadas

Una misma foto puede quedar enlazada a más de un usuario, aunque casi siempre es un error, por ejemplo enlazar la foto de un alumno a su compañero. Por eso, si la foto que vas a enlazar ya está asignada a otra persona, la aplicación avisa con el mensaje «Esta imagen ya está asignada a: …» y pregunta si quieres asignarla también al usuario seleccionado.

Si además el usuario seleccionado ya tiene otra foto, el mismo mensaje lo dice: «Además, … ya tiene otra imagen enlazada, que se reemplazará por esta».

- Con **No**, no cambia nada.
- Con **Sí**, la foto queda enlazada a los dos y, si el usuario seleccionado tenía otra, la sustituye.

Para localizar las fotos duplicadas:

- En la lista, la miniatura de una foto duplicada tiene un **borde rojo**.
- Encima de la lista aparece el aviso rojo «asignaciones duplicadas», con el número de usuarios afectados. Haz clic en él, o activa **Ver > Asignaciones duplicadas**, para ver solo a esos usuarios, de todos los grupos.

Para corregirlo, selecciona al usuario que no corresponde y [quita la foto enlazada](enlazar.md#quitar-la-foto-enlazada), o enlázale directamente su foto correcta.

## Quitar la foto enlazada

1. Selecciona al usuario en la lista.
2. Elige **Edición > Eliminar fotografía vinculada** (`Ctrl+Supr`).
3. Confirma el mensaje «¿Estás seguro de que deseas eliminar la fotografía vinculada a …?».

Pese al nombre, **no se borra ningún archivo**: solo se deshace el enlace. La foto sigue en `imports` y en el visor, y puedes volver a enlazarla cuando quieras. Si la foto estaba duplicada, los demás usuarios que la tienen la conservan.

> **Importante:** esta opción necesita que **Ver > Fotografías capturadas** esté activado. Si está desactivado, la aplicación puede responder que el usuario no tiene fotografía vinculada aunque sí la tenga.

Para quitar de golpe las fotos de muchos usuarios después de enviarlas al depósito, ver [Desvincular las fotos después de exportar](deposito.md#desvincular-las-fotos-despues-de-exportar).

## Fotografías por grupo

**Ver > Fotografías por grupo** (`Ctrl+Shift+E`) abre una ventana con un listado de los grupos del proyecto. En cada uno ves cuántos usuarios tiene, cuántos tienen ya foto y cuántos no tienen ninguna. Sirve para comprobar de un vistazo si queda algún grupo por fotografiar.

Cada fila lleva un color según lo avanzado que está el grupo: **rojo** si nadie tiene foto, **amarillo** a mitad de camino y **verde** cuando el grupo está completo. La barra de la derecha muestra el mismo avance en porcentaje; solo marca `100 %` cuando no falta nadie.

Arriba se resume el proyecto entero: cuántos grupos están completos, cuántos usuarios tienen foto y cuántos grupos no tienen ninguna.

- **Fotografías**: **Capturadas** cuenta las fotos capturadas y enlazadas en este proyecto; **Del depósito** cuenta las que ya están en el depósito de imágenes, buscándolas por el NIA o el DNI de cada usuario, como hacen las exportaciones. Para esta última hace falta tener configurado el depósito en **Proyecto > Configurar depósito de imágenes**.
- **Orden**: **Por grupo** sigue el código del grupo; **Menos avanzados primero** pone arriba los que más foto les falta.
- **Ocultar grupos completos** deja solo los que tienen trabajo pendiente.

La ventana se actualiza sola cada vez que enlazas o quitas una foto, cuando cambia el contenido del depósito y al actualizar el archivo XML, así que puedes dejarla abierta, por ejemplo en otro monitor, mientras trabajas. Recuerda qué fotografías estabas mirando la próxima vez que la abras. Los usuarios del grupo **Eliminados** no aparecen.

> **Consejo:** Al cerrar el proyecto la ventana se cierra también, porque sus datos son los de ese proyecto.

## Cuadro de imágenes capturadas

**Ver > Cuadro de imágenes capturadas** (`Ctrl+G`) abre una ventana con una ficha por cada usuario del grupo elegido: su foto capturada, o una silueta si no tiene, y debajo el nombre, los apellidos y el NIA o el DNI. En la cabecera ves cuántos usuarios hay y cuántos tienen imagen. Sirve para repasar de un vistazo qué fotos faltan en una clase o si alguna está mal enlazada.

- El desplegable de la ventana cambia el grupo, y está sincronizado con el de la ventana principal.
- La ventana se actualiza sola cuando enlazas, quitas o restauras fotos en la ventana principal.
- Necesita un proyecto abierto.

## Cuadro de imágenes en depósito

**Ver > Cuadro de imágenes en depósito** (`Ctrl+Shift+G`) es igual que el anterior, pero con las fotos del [depósito](deposito.md), las de cursos anteriores. La cabecera indica cuántos usuarios tienen imagen en el depósito y, mientras la copia local se está sincronizando, el progreso («Sincronizando: … archivos»).

- Esta ventana sí se actualiza sola cuando cambia el contenido del depósito.
- Necesita que el proyecto tenga un depósito configurado en **Proyecto > Configurar depósito de imágenes**. Si no lo tiene, aparece el aviso «Depósito no configurado».

## Etiquetas de imágenes

Las etiquetas son notas cortas que puedes poner a una foto capturada, por ejemplo para marcar las que hay que repetir. La etiqueta se guarda en la foto, no en el usuario, y una foto puede tener varias.

### Añadir una etiqueta

1. Muestra la foto en el visor.
2. Elige **Edición > Agregar etiqueta a imagen** (`Ctrl+T`).
3. Escribe el texto y pulsa **Agregar** (o `Intro`).

Las etiquetas de la foto que estás viendo aparecen debajo del visor, tras «Etiquetas:».

### Quitar una etiqueta

Pulsa la **X** que hay junto a la etiqueta, debajo del visor, y confirma.

### Ver todas las fotos con etiquetas

**Ver > Listado de imágenes con etiquetas** (`Ctrl+Shift+T`) muestra todas las fotos que tienen alguna etiqueta, cada una con las suyas. Haz clic en una foto para mostrarla en el visor, o pulsa **Cerrar** para salir.
