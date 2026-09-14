# Depósito de imágenes

El depósito es la carpeta compartida donde están las fotos oficiales de los usuarios: las de cursos anteriores y las que vas enviando desde la aplicación. Sirve para ver quién tiene ya foto y para dejar allí las nuevas, con el nombre que esperan los demás procesos del centro.

## Qué es el depósito

- Es una carpeta normal. Puede estar en tu equipo, en una unidad de red o en una carpeta de Google Drive sincronizada en el equipo.
- Cada foto se llama con el identificador de su usuario: `{NIA}.jpg` para el alumnado y `{DNI}.jpg` para el personal. También se reconocen las terminadas en `.jpeg`, y da igual que la extensión esté en mayúsculas o minúsculas.
- Solo cuentan las fotos que están directamente en la carpeta, no las de sus subcarpetas.
- La aplicación crea dentro algunas subcarpetas de trabajo: `To-Print-ID` y `Printed-ID` para los carnets, `To-Publish` para la publicación oficial (ver [Carnets y publicación oficial](carnets.md)) y `Reemplazadas` para las fotos sustituidas al exportar.
- Cada proyecto tiene su propio depósito configurado.

> **Importante:** la aplicación no se conecta a Google Drive por su cuenta: trabaja con la carpeta tal como la ve el equipo. Si el depósito está en Google Drive, esa carpeta tiene que estar disponible en el explorador de archivos.

## Configurar el depósito

1. Abre el proyecto.
2. Elige **Proyecto > Configurar depósito de imágenes**.
3. Selecciona la carpeta del depósito y acepta.

Aparece el mensaje «Depósito de imágenes configurado» con la ruta elegida. La ruta queda a la vista en la barra de estado inferior, junto a «Depósito:», que muestra «No configurado» mientras no haya ninguno. También aparece en **Proyecto > Información del proyecto**.

Para cambiar de depósito, repite los pasos: la aplicación deja de usar el anterior y empieza a sincronizar el nuevo.

## La copia local y la sincronización

Como el depósito suele estar en la red o en Google Drive, la aplicación guarda en tu equipo una copia de sus fotos y trabaja con ella, para no quedarse esperando a la red.

- La copia se pone en marcha sola, en segundo plano, cuando la aplicación necesita las fotos del depósito: normalmente al abrir el proyecto, o al activar las opciones del depósito del menú **Ver**.
- La primera vez copia todas las fotos y, si el depósito es grande, puede tardar varios minutos. Después solo copia lo que cambia.
- Mientras tanto puedes seguir trabajando. En la lista, las miniaturas e indicadores del depósito muestran un pequeño círculo girando hasta que llegan los datos. En el cuadro de imágenes en depósito verás el progreso («Sincronizando: … archivos»).
- La aplicación revisa el depósito cada pocos segundos. Si alguien añade, cambia o borra una foto, la lista se actualiza sola poco después, y las fotos borradas del depósito desaparecen también de la copia local.

Si una foto que sabes que está en el depósito no aparece, elige **Ver > Actualizar imágenes del depósito** (`Ctrl+Shift+D`). La aplicación vuelve a comparar el depósito con la copia local y trae lo que haya cambiado.

<!-- REVISAR: al abrir un proyecto desde Proyectos Recientes o al arrancar, la copia local solo se inicia si alguna opción del depósito del menú Ver está activa (main.js, openRecentProject). En ese caso Ver > Actualizar imágenes del depósito no hace nada hasta que algo la inicie. Con Abrir Proyecto... se inicia siempre. -->

## Ver las fotos del depósito en la lista

- **Ver > Fotografías del depósito** añade a cada fila la miniatura de la foto del depósito. Haz doble clic en ella para verla en grande.
- **Ver > Indicadores de foto en el depósito** añade un círculo verde a los usuarios que tienen foto en el depósito.
- **Ver > Cuadro de imágenes en depósito** (`Ctrl+Shift+G`) muestra las fotos del depósito de todo un grupo en una ventana aparte. Ver [Cuadro de imágenes en depósito](enlazar.md#cuadro-de-imagenes-en-deposito).

Las dos primeras opciones vienen desactivadas; los iconos se explican en [Lista de usuarios](usuarios.md#iconos-de-cada-fila).

La aplicación busca la foto de cada usuario por su NIA (alumnado) o su DNI (personal). Si el archivo no se llama exactamente así, el usuario aparece sin foto en el depósito.

## Sacar las fotos del depósito a una carpeta

Para copiar las fotos del depósito a otra carpeta, nombradas con el NIA o el DNI y separadas por grupo, usa **Archivo > Exportar > Imágenes del depósito como ID**. Se explica en [Exportaciones](exportaciones.md#exportar-imagenes-del-deposito-como-id).

## Exportar las fotos capturadas al depósito

Esta exportación envía al depósito las fotos capturadas y enlazadas, con el nombre que el depósito espera: `{NIA}.jpg` para el alumnado y `{DNI}.jpg` para el personal, siempre en la carpeta principal del depósito.

1. Prepara la lista con los usuarios que quieres exportar (ver [Qué usuarios se exportan](deposito.md#que-usuarios-se-exportan)).
2. Elige **Archivo > Exportar > Imágenes capturadas al depósito**.
3. Revisa el resumen de la ventana «Opciones de Exportación».
4. Elige cómo copiar las fotos (ver [Opciones de copia](deposito.md#opciones-de-copia)).
5. Pulsa **Exportar** y espera a que termine la barra de progreso.
6. Lee el resultado, «Exportación completada»: cuántos usuarios tenían imagen, cuántas fotos se exportaron, cuántas sustituyeron a otras y los errores, si los hay.
7. Si se exportó alguna foto, la aplicación te ofrece desvincularlas (ver [Desvincular las fotos después de exportar](deposito.md#desvincular-las-fotos-despues-de-exportar)).

Para las demás exportaciones, ver [Exportaciones](exportaciones.md).

### Qué usuarios se exportan

La aplicación decide qué usuarios entran según lo que tengas en pantalla, por este orden:

1. Si estás en [modo selección](usuarios.md#seleccionar-varios-usuarios) con usuarios marcados, solo los marcados.
2. Si está activo **Ver > Asignaciones duplicadas**, todos los usuarios con foto duplicada.
3. Si hay texto en el cuadro de búsqueda, los resultados de la búsqueda, de todos los grupos.
4. Si no, el grupo elegido en el filtro, o todos los usuarios si está en «Todos los grupos».

De esos, solo se envían los que tienen una foto capturada enlazada.

<!-- REVISAR: con Ver > Carnets solicitados o Ver > Publicaciones solicitadas activos, la exportación no usa esa vista sino el grupo o la búsqueda que haya debajo (ExportManager.getUsersToExport solo contempla selección y duplicadas). Lo que se ve en pantalla y lo que se exporta no coinciden. -->

### El resumen previo

Antes de exportar, la ventana «Opciones de Exportación» muestra qué va a pasar:

| Dato | Significado |
|---|---|
| Se exportará | Qué usuarios entran: los seleccionados, los de asignaciones duplicadas, la búsqueda o el grupo. |
| Imágenes a enviar al depósito | Cuántas fotos se van a enviar. |
| Usuarios sin foto capturada | Usuarios que se quedan fuera por no tener foto capturada. |
| Reemplazarán una foto existente | Fotos que sustituirán a otra que ya está en el depósito. |
| Son fotos nuevas en el depósito | Fotos de usuarios que aún no tenían foto en el depósito. |

Para las dos últimas cifras, la aplicación consulta el depósito en ese momento, tengas o no activadas sus opciones en el menú **Ver**. Aun así, pueden variar si otro equipo exporta a la vez. Si no se puede consultar el depósito (no está configurado o su carpeta no está disponible), la aplicación te avisa y no llega a mostrar el resumen.

### Opciones de copia

- **Copiar imagen original (corrige la orientación si hace falta)**: envía la foto tal cual. Solo la vuelve a guardar si hay que girarla para que quede derecha.
- **Redimensionar imágenes**: reduce la foto para que quepa en un cuadrado del **Tamaño del cuadro (píxeles)** indicado (800 por defecto) y baja la calidad hasta acercarse al **Tamaño máximo de archivo (KB)** (500 por defecto). Las fotos más pequeñas que el cuadro no se amplían. Si ni con la calidad más baja que usa la aplicación se llega a ese peso, el archivo puede quedar algo por encima.

### Usuarios que no se exportan

- Los que no tienen foto capturada: simplemente no se envían.
- Los que no tienen NIA o DNI: aparecen en la lista de errores del resultado como «Usuario sin identificador (NIA/DNI)».
- Aquellos cuya foto ya no está en `imports`: aparecen como «Imagen no encontrada».

Si el proyecto no tiene depósito configurado, o su carpeta no existe o no está accesible, la exportación se detiene con un mensaje de error.

## Qué pasa con las fotos que ya estaban

Si en el depósito ya hay una foto con el mismo nombre, la nueva la sustituye, pero la anterior **no se pierde**: se mueve a la subcarpeta `Reemplazadas` del depósito, dentro de una carpeta con la fecha y hora de la exportación y el nombre del equipo, por ejemplo `20260914103000_SECRETARIA`. El resultado final indica cuántas fotos se sustituyeron.

- Si la foto que envías es idéntica a la que ya había, no cuenta como sustitución y no se guarda copia.
- La carpeta solo se crea si hay alguna sustitución.
- Las fotos de `Reemplazadas` no aparecen en la aplicación. Si necesitas recuperar una, cópiala a mano a la carpeta principal del depósito.

## Desvincular las fotos después de exportar

Cuando termina una exportación en la que se envió al menos una foto, la aplicación pregunta si quieres desvincular las fotos de los usuarios exportados. Es útil para empezar una nueva ronda de fotos con las fichas vacías.

- Si respondes **Sí**, primero se guarda una copia de seguridad de los enlaces de todo el proyecto y después se quita la foto capturada **solo a los usuarios exportados**. Los que no entraron en la exportación conservan la suya.
- No se borra ninguna imagen: las fotos siguen en `imports` y en el depósito.
- Al terminar verás el mensaje «Fotos desvinculadas», con el número de fotos desvinculadas y la fecha de la copia de seguridad.
- Si respondes **No**, los enlaces quedan como estaban.

## Restaurar los enlaces de imágenes

Si desvinculaste las fotos por error, puedes volver al estado que guardó la copia de seguridad:

1. Elige **Proyecto > Restaurar enlaces de imágenes...**
2. En la lista, elige una copia. Cada una muestra su fecha y hora y cuántos enlaces contiene.
3. Pulsa **Restaurar** y confirma.

> **Importante:** restaurar sustituye **todos** los enlaces de fotos capturadas del proyecto por los de la copia. Los enlaces que hayas hecho después de esa copia se pierden.

Las copias de seguridad solo se crean al desvincular las fotos tras exportar al depósito. Si no has hecho nunca esa desvinculación, la ventana muestra el mensaje «No hay copias de seguridad disponibles».
