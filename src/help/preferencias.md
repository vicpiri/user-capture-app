# Preferencias y actualizaciones

Aquí se explica cómo ajustar los datos del centro, la impresora de recibos y lo que se ve en la lista de usuarios, y cómo sabe la aplicación que hay una versión nueva.

## Abrir las preferencias

1. Pulsa **Archivo > Preferencias...** o `Ctrl+,`.
2. Elige una categoría a la izquierda: **Datos de la Institución** o **Impresora de Recibos**.
3. Haz los cambios y pulsa **Guardar**. **Cancelar**, o la **×** de la esquina, cierra la ventana sin guardar.

Los cambios se aplican en cuanto guardas, sin reiniciar: los recibos y los PDF leen estos datos cada vez que se generan. Guardar no cambia las casillas del menú **Ver**, que se explican más abajo.

Las preferencias se guardan en este equipo y valen para todos los proyectos que abras en él.

## Datos de la institución

- **Nombre del centro**: aparece en la cabecera de los recibos de la orla. Si lo dejas vacío, el recibo muestra un nombre de centro por defecto, así que conviene rellenarlo.
- **Logotipo**: pulsa **Seleccionar** y elige una imagen PNG o JPG. La **✕** que aparece a su lado lo quita. El logotipo sale en los recibos, en las orlas en PDF y en el listado de alumnos pagados en PDF.

> **Importante:** la aplicación guarda dónde está el archivo del logotipo, no una copia. Si lo mueves, lo renombras o lo borras, el logotipo deja de aparecer. Guárdalo en una carpeta fija.

## Impresora de recibos

La categoría **Impresora de Recibos** sirve para elegir la impresora térmica, imprimir un recibo de prueba y escribir el subtítulo, el precio y el pie de los recibos de la orla. Todo ello se explica en [Configurar la impresora de recibos](orlas.md#configurar-la-impresora-de-recibos), [Personalizar el contenido del recibo](orlas.md#personalizar-el-contenido-del-recibo) e [Imprimir un recibo de prueba](orlas.md#imprimir-un-recibo-de-prueba).

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

Los tres primeros son filtros y solo puede haber uno activo a la vez: al activar uno, los otros se desactivan.

La aplicación recuerda estas casillas al cerrarla y las vuelve a aplicar la próxima vez, salvo **Publicaciones solicitadas**, que empieza siempre desactivada.

<!-- REVISAR: "Publicaciones solicitadas" no se guarda porque saveDisplayPreferences (src/main/utils/config.js) no incluye showPublicationRequestsOnly, aunque al arrancar sí se lee. Parece un olvido; si se corrige, quitar la salvedad del párrafo anterior. -->

## Comprobación automática de actualizaciones

La aplicación instalada en Windows comprueba sola si hay una versión nueva publicada:

- Lo hace unos 15 segundos después de que aparezca la ventana principal, para no retrasar la apertura del proyecto.
- Solo comprueba si han pasado al menos 24 horas desde la última comprobación completada. Aunque abras la aplicación varias veces al día, como mucho lo hace una vez.
- Si hay una versión nueva, se abre la ventana de actualización. Si no la hay, no se muestra nada.
- Si la comprobación falla (por ejemplo, sin conexión a Internet o porque la red del centro bloquea GitHub), tampoco se muestra nada, y se vuelve a intentar la próxima vez que abras la aplicación.
- Si elegiste **Omitir esta versión**, la comprobación automática no vuelve a avisarte de esa versión, pero sí de la siguiente que se publique.

<!-- REVISAR: existe una preferencia para desactivar la comprobación automática (updates.autoCheck en config.json), pero no hay ninguna opción en la interfaz para cambiarla, así que no se documenta. -->

## Buscar actualizaciones manualmente

Puedes comprobarlo en cualquier momento de dos formas:

- **Ayuda > Buscar actualizaciones...**
- **Ayuda > Acerca de Edu User Capture** y, en esa ventana, el botón **Buscar actualizaciones**.

La comprobación manual siempre muestra el resultado:

- **Hay una versión nueva**, con los detalles que se explican a continuación. Aparece también si antes habías omitido esa versión.
- **Sin novedades**: ya tienes la última versión.
- **No se pudo comprobar**, con el motivo. Si no llega respuesta en un minuto, avisa de que la comprobación ha tardado demasiado.

Solo funciona en la aplicación instalada; en otro caso, avisa de que la comprobación solo está disponible en la aplicación instalada.

<!-- REVISAR: si se pide una comprobación manual mientras la automática sigue en marcha, UpdateModal no trata el resultado 'already-checking' y la ventana puede quedarse en "Buscando actualizaciones" sin botones (se cierra con Escape). -->

## La ventana de actualización

Cuando hay una versión nueva, la ventana **Hay una versión nueva** indica qué versión está disponible, cuál tienes y cuándo se publicó. Debajo, en **Novedades**, muestra los cambios de esa versión. Tiene tres botones:

- **Abrir página de descarga**: abre en el navegador la página de esa versión en GitHub.
- **Más tarde**: cierra la ventana. La comprobación automática volverá a avisarte cuando toque.
- **Omitir esta versión**: cierra la ventana y deja de avisarte de esa versión en las comprobaciones automáticas.

## Instalar la versión nueva

La aplicación no descarga ni instala nada por su cuenta: solo te avisa y te lleva a la página de descarga.

1. En la ventana de actualización, pulsa **Abrir página de descarga**.
2. En la página de GitHub, dentro del apartado **Assets**, descarga el instalador para Windows, el archivo que termina en `.exe`.
3. Cierra Edu User Capture y ejecuta el instalador.
4. Sigue los pasos del asistente de instalación.

## La ventana Acerca de

**Ayuda > Acerca de Edu User Capture** muestra el nombre de la aplicación, la versión instalada, una breve descripción, el autor y la licencia. Desde ella puedes **Buscar actualizaciones** o **Cerrar**.

> **Consejo:** si tienes que comunicar un problema, indica la versión que aparece en esta ventana.
