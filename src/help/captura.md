# Captura e importación de fotos

Las fotos entran en el proyecto por varias vías: la webcam, la carpeta de entrada, arrastrándolas a la ventana o con la importación de imágenes con ID. Todas acaban en la carpeta `imports` del proyecto y aparecen en el visor, listas para [enlazarlas](enlazar.md) con su usuario.

## Cómo llegan las fotos al proyecto

| Vía | Qué hace la aplicación con la foto |
|---|---|
| Webcam | La guarda en la carpeta de entrada, que la pasa a `imports`. |
| Cámara u otro programa | Recoge lo que se deja en la carpeta de entrada y lo pasa a `imports`. |
| Arrastrar a la ventana | Copia el archivo a la carpeta de entrada, que lo pasa a `imports`. |
| Imágenes con ID | Copia cada archivo directamente a `imports` y lo enlaza con su usuario. |

Salvo la importación con ID, todo pasa por la carpeta de entrada, así que se aplican sus reglas: solo JPG, hasta 5 MB y renombrado con la fecha y la hora.

## Hacer fotos con la webcam

1. Abre el proyecto.
2. Elige **Cámara > Activar cámara** (`Ctrl+Shift+C`). Se abre la ventana **Vista de Cámara** con la imagen en directo.
3. Encuadra a la persona y pulsa **Capturar**. Un destello breve confirma la captura.
4. En unos instantes la foto aparece en el visor de la ventana principal.

Para apagar la cámara, elige **Cámara > Desactivar cámara** (el mismo atajo). Si la ventana de la cámara ha quedado detrás de otras, tráela al frente con **Cámara > Mostrar ventana de cámara** (`Ctrl+Shift+V`), disponible solo con la cámara activada.

Si cierras la ventana de la cámara con su botón de cerrar, la cámara queda desactivada, igual que con **Cámara > Desactivar cámara**.

Para que la cámara se active sola, marca **Cámara > Activar la cámara al iniciar**. La próxima vez que abras la aplicación, en cuanto se abra el proyecto se abrirá también la ventana de la cámara. La opción se recuerda hasta que la desmarques.

Otros detalles de la ventana de la cámara:

- **Girar la imagen**: el botón de la esquina superior derecha, **Rotar cámara 90°**, gira la vista un cuarto de vuelta cada vez. La foto se guarda girada tal como la ves. El giro se pierde al desactivar la cámara.
- **Resolución**: la aplicación pide a la cámara 1280 × 720 píxeles. Si la cámara no la admite, usa la más parecida que ofrezca.
- **Sin proyecto abierto** no se puede capturar: aparece el error «Error al capturar la imagen: No hay ningún proyecto abierto».
- Si la ventana muestra «No se pudo acceder a la cámara», comprueba que la cámara está conectada y que no la está usando otro programa, o elige otra.

## Elegir la cámara

Si el equipo tiene varias cámaras, elige la que quieres usar en **Cámara > Seleccionar cámara**. El cambio se aplica al momento, también con la ventana de la cámara abierta.

La lista se rellena al arrancar la aplicación y cada vez que se abre la ventana de la cámara. Si conectas una cámara con la aplicación abierta, activa la cámara (o desactívala y vuelve a activarla) para que aparezca en la lista.

La aplicación no recuerda la cámara elegida: al volver a abrirla se usa la primera de la lista.

> **Consejo:** Algunos programas de vídeo instalan cámaras virtuales que aparecen en la lista junto a las reales. Si ves una imagen en negro o que no es la de tu cámara, elige otra en **Cámara > Seleccionar cámara**.

## La carpeta de entrada

La carpeta de entrada es la que la aplicación vigila mientras el proyecto está abierto. Por defecto es la subcarpeta `ingest` de la carpeta del proyecto. Cada foto JPG que aparece en ella:

1. se mueve a la carpeta `imports` del proyecto,
2. se renombra con la fecha y la hora de llegada, en el formato `YYYYMMDDHHMMSS` (año, mes, día, hora, minutos y segundos), conservando su extensión, por ejemplo `20260914103512.jpg`,
3. y aparece en el visor, que parpadea mientras la aplicación procesa la foto.

Si llegan varias fotos en el mismo segundo, a partir de la segunda se añade un número: `20260914103512_1.jpg`, `20260914103512_2.jpg`...

Así puedes trabajar con cualquier cámara o programa capaz de guardar sus fotos en una carpeta: basta con que las guarde en la carpeta de entrada, o con [redirigir la carpeta de entrada](captura.md#redirigir-la-carpeta-de-entrada) a la que ya usa ese programa.

Reglas de la carpeta de entrada:

- **Solo archivos JPG** (`.jpg` o `.jpeg`). Los demás archivos se ignoran y se quedan donde están.
- **Hasta 5 MB por foto.** Las que pesan más no se importan y se quedan en la carpeta; la aplicación te avisa con el mensaje «Foto no importada».
- También se recogen las fotos que se dejan dentro de una subcarpeta de la carpeta de entrada, pero solo en el primer nivel.
- **La fecha y la hora del nombre son las de llegada** a la aplicación, no las del momento en que la cámara hizo la foto. Si copias de golpe 50 fotos de una tarjeta, todas tendrán prácticamente la misma hora.

> **Importante:** Solo se importan las fotos que llegan a la carpeta con el proyecto abierto. Las que ya estaban al abrirlo, o las que llegaron con la aplicación cerrada, se quedan en la carpeta sin importar. Para importarlas, sácalas de la carpeta y vuelve a dejarlas en ella con el proyecto abierto.

## Redirigir la carpeta de entrada

Si la cámara o el programa que usas guarda las fotos en su propia carpeta, o un fotógrafo las deja en una carpeta compartida, puedes hacer que el proyecto vigile esa carpeta en lugar de `ingest`:

1. Abre **Proyecto > Configurar carpeta de entrada (ingest)...**
2. Si ya habías redirigido la carpeta, verás la carpeta actual y la carpeta por defecto. Pulsa **Elegir otra carpeta...**
3. Elige la carpeta. Puedes crear una nueva desde el propio cuadro de diálogo.
4. La aplicación confirma el cambio con el mensaje «Carpeta de entrada configurada» y la ruta elegida.

Desde ese momento, las fotos JPG nuevas que lleguen a esa carpeta se mueven a `imports` del proyecto. **Las que ya estuvieran en ella no se importan.** Las fotos de la webcam y las que arrastres a la ventana también van a la carpeta nueva.

Cada proyecto guarda su propia carpeta de entrada. En **Proyecto > Información del proyecto**, la fila **Carpeta de entrada (ingest)** la muestra con la nota «Personalizada».

### Volver a la carpeta por defecto

1. Abre **Proyecto > Configurar carpeta de entrada (ingest)...**
2. Pulsa **Usar la carpeta por defecto**.

Elegir la carpeta `ingest` del proyecto en el cuadro de selección tiene el mismo efecto.

### Carpetas que no se admiten

Como la aplicación se lleva todo lo que llega a la carpeta de entrada, rechaza las carpetas de las que se llevaría fotos que deben quedarse donde están:

- la carpeta del proyecto o cualquier carpeta que la contenga,
- la carpeta `imports` del proyecto o una carpeta dentro de ella,
- la carpeta del depósito de imágenes o su copia local, una carpeta dentro de ellas o una que las contenga.

En esos casos aparece un mensaje con el motivo y la carpeta de entrada no cambia.

### ¿Qué pasa si falta la carpeta?

Si al abrir el proyecto la carpeta de entrada no está disponible (un disco desconectado o una carpeta de red inaccesible), el proyecto se abre igualmente:

- Aparece el aviso **Carpeta de entrada no disponible**, con la carpeta configurada y la que se usa en su lugar.
- Mientras tanto se vigila la carpeta por defecto, `ingest`, y allí van también las fotos de la webcam.
- La configuración no se pierde. En la información del proyecto, la carpeta aparece con la nota «No disponible: mientras tanto se usa la carpeta por defecto».

Cuando la carpeta vuelva a estar disponible, cierra el proyecto con **Archivo > Cerrar Proyecto** y vuelve a abrirlo.

## Fotos que llegan giradas

Las cámaras suelen anotar en cada foto cómo estaban colocadas, y la aplicación usa esa anotación para mostrarla derecha. Algunas cámaras no la anotan, o anotan siempre «normal»: sus fotos verticales llegan tumbadas, y como la cámara hace lo mismo con todas, **todas las fotos de esa sesión llegan giradas igual**.

### Girar todas las fotos de una sesión

1. Elige **Proyecto > Girar las fotos entrantes** y el giro que necesitan: **90° a la derecha**, **180°** o **90° a la izquierda**.
2. Desde ese momento, cada foto que llega a la carpeta de entrada se gira sola al pasar a `imports`. Las que ya estaban no cambian; si alguna llegó antes de activarlo, gírala a mano (ver más abajo).
3. Mientras está activo, encima del visor aparece el aviso amarillo **Fotos entrantes giradas…**, para que no se quede puesto por olvido.
4. Al terminar la sesión, vuelve a **Proyecto > Girar las fotos entrantes > No girarlas**.

- Se guarda en el proyecto: sigue activo aunque cierres y vuelvas a abrir la aplicación, hasta que lo desactives. Cada proyecto tiene el suyo.
- Se aplica a las fotos de la cámara externa o de otros programas que las dejan en la carpeta de entrada, y a las que arrastras a la ventana, que también pasan por ella.
- No se aplica a las fotos de la webcam de la aplicación, que se giran con su propio botón (ver [Hacer fotos con la webcam](captura.md#hacer-fotos-con-la-webcam)), ni a las de **Importar imágenes con ID**, que no pasan por la carpeta de entrada.

### Girar una foto ya importada

Encima del visor, arriba a la derecha, hay dos botones: **Girar la foto 90° a la izquierda** y **Girar la foto 90° a la derecha**. Giran la foto que se está viendo; púlsalos las veces que haga falta.

La foto se ve girada al momento en el visor, en el historial de capturas, en la lista, en la vista de miniaturas y en el cuadro de imágenes capturadas.

> **Consejo:** si la foto ya se exportó al depósito antes de girarla, vuelve a exportarla para que el depósito tenga la versión derecha.

### Qué se cambia en la foto

La foto no se vuelve a comprimir: solo se cambia la anotación de cómo va girada, así que no pierde calidad. La aplicación la respeta en todas partes, y las exportaciones, la copia al depósito y las orlas sacan la foto ya derecha, de modo que los programas que las reciban no necesitan entender esa anotación.

## Arrastrar fotos a la ventana

1. Con el proyecto abierto, selecciona una o varias fotos JPG en el Explorador de archivos.
2. Arrástralas sobre la zona de la foto, a la derecha de la ventana principal, y suéltalas.

Las fotos se **copian** a la carpeta de entrada, así que los originales se quedan donde estaban. A partir de ahí siguen el camino habitual: se mueven a `imports`, se renombran con la fecha y la hora y se aplica el límite de 5 MB.

Si entre los archivos arrastrados hay alguno que no es JPG, se ignora. Si no hay ninguno JPG, aparece el aviso «Por favor, arrastra solo archivos de imagen JPG/JPEG».

## Importar imágenes con ID

Sirve para incorporar de una vez fotos que ya tienen como nombre el identificador de cada persona, por ejemplo las de un curso anterior. Cada foto se enlaza sola con su usuario, sin tener que pulsar **Enlazar**.

**Cómo deben llamarse los archivos:** el nombre, sin la extensión, debe ser exactamente el NIA del alumno o el documento (DNI) de la persona, tal como aparecen en el XML. Por ejemplo, `10234567.jpg` o `12345678Z.jpg`. Se tienen en cuenta las letras y las mayúsculas, así que `12345678z.jpg` no encontraría a `12345678Z`.

1. Reúne las fotos en una carpeta. Solo se leen los archivos JPG que están directamente en ella, no los de sus subcarpetas.
2. Abre **Archivo > Importar > Imágenes con ID**.
3. Elige la carpeta.
4. Al terminar verás un resumen con el total de imágenes, cuántas se han enlazado y los nombres de los archivos que no corresponden a ningún usuario.

Cada foto reconocida se copia a `imports` con su nombre original (no se renombra con la fecha) y se enlaza con su usuario. Las fotos que no corresponden a nadie no se copian. Los originales se quedan en la carpeta de origen.

> **Importante:** Si el usuario ya tenía una foto capturada enlazada, se sustituye por la importada sin pedir confirmación. La foto anterior sigue en `imports`, pero ya no está enlazada.

## El historial de capturas

El historial es una tira vertical de miniaturas, a la derecha del visor, con todas las fotos de la carpeta `imports`, las más recientes primero. Sirve para localizar una foto de una sesión concreta, por ejemplo para revisar un enlace equivocado.

Actívalo o desactívalo con **Ver > Historial de capturas**. La aplicación recuerda tu elección.

- **Encabezados de fecha**: cada vez que cambia el día aparece un encabezado con la fecha, por ejemplo `14/09/2026`.
- **Hora bajo cada miniatura**: la hora de llegada de la foto, por ejemplo `10:35:12`.
- **Sin fecha en el nombre**: las fotos cuyo nombre no sigue el formato de fecha y hora, como las traídas con la importación de imágenes con ID, se agrupan bajo este encabezado y muestran el nombre del archivo en lugar de la hora.
- **Fotos ya enlazadas**: se ven atenuadas y llevan un círculo verde con ✓ en la esquina, para que destaquen las que quedan por enlazar. La que muestra el visor y la que tiene el ratón encima se ven siempre enteras.
- **Fotos enlazadas a varios usuarios**: llevan un borde y un círculo rojos con el número de usuarios, como las asignaciones duplicadas de la lista. Casi siempre es un enlace equivocado.
- Al pasar el ratón por una miniatura verás el nombre completo del archivo y, si está enlazada, a quién.

La fecha y la hora se leen del nombre del archivo, que es el único registro de cuándo llegó cada foto.

Al pulsar una miniatura, el visor salta a esa foto y queda lista para enlazarla, igual que si hubieras llegado a ella con las flechas. La miniatura de la foto que muestra el visor aparece resaltada. Si el proyecto no tiene fotos, el historial muestra «Sin capturas».
