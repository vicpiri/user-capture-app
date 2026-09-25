# Preferencias y actualizaciones

Aquí se explica cómo ajustar los datos del centro, la impresora de recibos y lo que se ve en la lista de usuarios, y cómo sabe la aplicación que hay una versión nueva.

## Abrir las preferencias

1. Pulsa **Archivo > Preferencias...** o `Ctrl+,`.
2. Elige una categoría a la izquierda: **Datos de la Institución**, **Impresora de Recibos** o **Actualizaciones**.
3. Haz los cambios y pulsa **Guardar**. **Cancelar**, o la **×** de la esquina, cierra la ventana sin guardar.

Los cambios se aplican en cuanto guardas, sin reiniciar: los recibos y los PDF leen estos datos cada vez que se generan. Guardar no cambia las casillas del menú **Ver**, que se explican más abajo.

Las preferencias se guardan en este equipo y valen para todos los proyectos que abras en él.

## Datos de la institución

- **Nombre del centro**: aparece en la cabecera de los recibos de la orla. Si lo dejas vacío, el recibo muestra un nombre de centro por defecto, así que conviene rellenarlo.
- **Logotipo**: pulsa **Seleccionar** y elige una imagen PNG o JPG. La **✕** que aparece a su lado lo quita. El logotipo sale en los recibos, en el listado en PDF con fotografías por grupo y en el listado de alumnos pagados en PDF.

> **Importante:** la aplicación guarda dónde está el archivo del logotipo, no una copia. Si lo mueves, lo renombras o lo borras, el logotipo deja de aparecer. Guárdalo en una carpeta fija.

## Impresora de recibos

La categoría **Impresora de Recibos** sirve para elegir la impresora térmica, imprimir un recibo de prueba y escribir el subtítulo, el precio y el pie de los recibos de la orla. Todo ello se explica en [Configurar la impresora de recibos](orlas.md#configurar-la-impresora-de-recibos), [Personalizar el contenido del recibo](orlas.md#personalizar-el-contenido-del-recibo) e [Imprimir un recibo de prueba](orlas.md#imprimir-un-recibo-de-prueba).

## Mantenimiento

La aplicación guarda copias pequeñas de las fotos (miniaturas) para que las listas se pinten rápido, en una carpeta propia fuera del proyecto. Se mantiene sola: cada foto tiene una sola miniatura por tamaño, que se rehace si cambias la foto, y la carpeta nunca pasa de un tamaño máximo.

En **Preferencias > Mantenimiento** puedes ver cuántas miniaturas hay y cuánto ocupan, y vaciarlas con **Vaciar la caché**.

> **Consejo:** no hace falta vaciarla por rutina. Hazlo solo si alguna miniatura se ve mal; se vuelven a crear solas según se necesitan, y las fotos originales no se tocan.

## Opciones de visualización del menú Ver

Estas casillas del menú **Ver** cambian lo que muestra la lista de usuarios:

| Casilla | Qué hace |
|---|---|
| **Asignaciones duplicadas** | Muestra solo a los usuarios que comparten la misma foto capturada con otra persona |
| **Carnets solicitados** | Muestra solo a los usuarios con carnet pendiente de imprimir. Ver [Carnets y publicación oficial](carnets.md) |
| **Publicaciones solicitadas** | Muestra solo a los usuarios con publicación oficial pendiente |
| **Fotografías capturadas** | Muestra en cada fila la miniatura de la foto capturada |
| **Fotografías del depósito** | Muestra en cada fila la miniatura de la foto del depósito |
| **Indicadores de foto en el depósito** | Marca a los usuarios que tienen foto en el depósito |
| **Acciones adicionales** | Muestra la sección **Acciones Adicionales** (**Pagar Orla** e **Imp. Recibo**) y los iconos de orla pagada y recibo impreso. Ver [Orlas, pagos y recibos](orlas.md) |
| **Historial de capturas** | Muestra, junto al visor de fotos, la tira de miniaturas con las capturas del proyecto |
| **Vista de miniaturas** | Cambia la tabla de usuarios por una cuadrícula con la foto de cada uno. Ver [Vista de miniaturas](usuarios.md#vista-de-miniaturas) |

Los tres primeros son filtros y solo puede haber uno activo a la vez: al activar uno, los otros se desactivan.

La aplicación recuerda estas casillas al cerrarla y las vuelve a aplicar la próxima vez, filtros incluidos.

Para cambiar de golpe las opciones de fotos y paneles, usa los espacios de trabajo del mismo menú. Ver [Espacios de trabajo](usuarios.md#espacios-de-trabajo).

## Comprobación automática de actualizaciones

La aplicación instalada en Windows comprueba sola si hay una versión nueva publicada:

- Lo hace unos 15 segundos después de que aparezca la ventana principal, para no retrasar la apertura del proyecto.
- Solo comprueba si han pasado al menos 24 horas desde la última comprobación completada. Aunque abras la aplicación varias veces al día, como mucho lo hace una vez.
- Si hay una versión nueva, se abre la ventana de actualización. Si no la hay, no se muestra nada.
- Si la comprobación falla (por ejemplo, sin conexión a Internet o porque la red del centro bloquea GitHub), tampoco se muestra nada, y se vuelve a intentar la próxima vez que abras la aplicación.
- Si elegiste **Omitir esta versión**, la comprobación automática no vuelve a avisarte de esa versión, pero sí de la siguiente que se publique.

Para que no compruebe nada al arrancar, abre **Archivo > Preferencias...**, elige la categoría **Actualizaciones** y desmarca **Buscar actualizaciones al iniciar la aplicación**. Podrás seguir buscándolas cuando quieras, como se explica a continuación.

Si pides una comprobación mientras la automática aún está en marcha, la ventana espera a su resultado y te lo muestra.

## Buscar actualizaciones manualmente

Puedes comprobarlo en cualquier momento de dos formas:

- **Ayuda > Buscar actualizaciones...**
- **Ayuda > Acerca de Edu User Capture** y, en esa ventana, el botón **Buscar actualizaciones**.

La comprobación manual siempre muestra el resultado:

- **Hay una versión nueva**, con los detalles que se explican a continuación. Aparece también si antes habías omitido esa versión.
- **Sin novedades**: ya tienes la última versión.
- **No se pudo comprobar**, con el motivo. Si no llega respuesta en un minuto, avisa de que la comprobación ha tardado demasiado.

Si ya estás descargando una versión nueva, o ya la has descargado, en lugar de volver a comprobar te muestra cómo va la descarga o te ofrece instalarla.

Solo funciona en la aplicación instalada; en otro caso, avisa de que la comprobación solo está disponible en la aplicación instalada.

## La ventana de actualización

Cuando hay una versión nueva, la ventana **Hay una versión nueva** indica qué versión está disponible, cuál tienes y cuándo se publicó. Debajo, en **Novedades**, muestra los cambios de esa versión. Tiene tres botones:

- **Descargar**: descarga la versión nueva sin salir de la aplicación. Ver [Descargar e instalar la versión nueva](#descargar-e-instalar-la-version-nueva).
- **Más tarde**: cierra la ventana. La comprobación automática volverá a avisarte cuando toque.
- **Omitir esta versión**: cierra la ventana y deja de avisarte de esa versión en las comprobaciones automáticas.

## Descargar e instalar la versión nueva

La aplicación no descarga ni instala nada por su cuenta: la descarga empieza cuando pulsas **Descargar**.

1. En la ventana **Hay una versión nueva**, pulsa **Descargar**.
2. La ventana **Descargando actualización** muestra el avance: el porcentaje, los megas descargados y la velocidad. Normalmente solo se descarga lo que ha cambiado respecto a tu versión, así que suele ser bastante menos que el instalador completo.
3. Puedes seguir trabajando mientras tanto. Si pulsas **Seguir en segundo plano** (o `Esc`), la ventana se cierra y la descarga continúa; volverá a abrirse sola cuando termine.
4. Al terminar aparece **Actualización lista**, con dos opciones:
   - **Reiniciar e instalar**: cierra el proyecto y la aplicación, instala la versión nueva sin preguntar nada más y vuelve a abrir la aplicación con el mismo proyecto.
   - **Al cerrar la aplicación** (o `Esc`): sigues trabajando, y la versión nueva se instala sola la próxima vez que cierres la aplicación. La siguiente vez que la abras ya tendrás la versión nueva.

**Reiniciar e instalar** no funciona mientras hay una tarea en marcha, como una exportación o una importación: la ventana te pide que esperes a que termine o que dejes la instalación para cuando cierres la aplicación. Tampoco se activa con `Intro`, para que una pulsación pensada para otra cosa no te cierre la aplicación en mitad del trabajo: hay que pulsar el botón.

> **Nota:** Windows puede pedir permiso de administrador para instalar si la aplicación se instaló para todos los usuarios del equipo.

### Si la descarga o la instalación fallan

Si se corta la conexión o el instalador no puede arrancar, la ventana muestra **No se pudo descargar** o **No se pudo instalar** con el motivo. Puedes volver a intentarlo más tarde, o pulsar **Abrir página de descarga** para instalarla a mano:

1. En la página de GitHub, dentro del apartado **Assets**, descarga el instalador para Windows, el archivo que termina en `.exe`.
2. Cierra Edu User Capture y ejecuta el instalador.
3. Sigue los pasos del asistente de instalación.

## La ventana Acerca de

**Ayuda > Acerca de Edu User Capture** muestra el nombre de la aplicación, la versión instalada, una breve descripción, el autor y la licencia. Desde ella puedes **Buscar actualizaciones** o **Cerrar**.

> **Consejo:** si tienes que comunicar un problema, indica la versión que aparece en esta ventana.
