# Fallos pendientes

Fallos encontrados el 2026-09-14 al redactar el manual de uso (`src/help/`),
contrastando cada página con el código. Salvo que se diga lo contrario, salen
de **leer el código, no de reproducirlos** en la aplicación: antes de corregir
cada uno conviene confirmarlo. Los marcados como *confirmado en el código* se
revisaron de nuevo al escribir este documento.

Las líneas citadas son orientativas y se moverán con los cambios; el nombre
del manejador o de la función es la referencia estable.

Muchos tienen una nota `<!-- REVISAR: ... -->` en la página del manual que les
afecta (se indica en cada uno). Al corregir un fallo hay que quitar esa nota y
ajustar el texto del manual, que describe el comportamiento actual.

## Prioridad alta

Ninguno pendiente: los tres que había están en «Corregidos».

## Prioridad media

Ninguno pendiente: todos están en «Corregidos».

## Prioridad baja

Ninguno pendiente: todos están en «Corregidos».

## Corregidos

- **CLAUDE.md estaba desactualizado** (corregido el 2026-09-16). Describía un
  `googleDriveManager.js` con la API v3 de Google Drive que no existe (el
  depósito es una carpeta del disco con una copia local que mantiene
  `repositoryMirror.js`), daba nombres de menú que ya no existen, contaba 7
  manejadores de exportación donde hay 13, y se equivocaba en la rejilla de las
  orlas (6 × 6, no 4 columnas), su calidad (60/80/90/100), las cabeceras de los
  CSV de inventario, el ZIP de imágenes (plano), las subcarpetas por grupo de
  las imágenes como ID, el CSV de carnets (solo usuarios con foto en el
  depósito), la configuración de la impresora (Preferencias, no un menú
  Herramientas que no existe), las solicitudes de carnet y publicación (solo en
  modo selección), la navegación por teclado, el contador del visor (no hay),
  el placeholder sin proyecto (solo texto) y la carpeta de entrada (eventos del
  sistema de archivos, no una consulta por segundo). Cada punto se comprobó
  contra el código antes de escribirlo.

- **Una lista vacía exportaba todos los usuarios del proyecto** (antes el
  fallo 1, corregido el 2026-09-14). `export-csv`, `export-images`,
  `export-images-name`, `export-inventory-csv` y `export-to-repository`
  sustituían una lista vacía por todos los usuarios; ahora la rechazan sin
  leer ni escribir nada, y `ExportManager.ensureUsersToExport()` avisa antes
  de abrir ningún diálogo. Lo cubre `tests/unit/main/exportEmptyList.test.js`.
- **Guardar las preferencias borraba las opciones del menú Ver** (antes el
  fallo 2, corregido el 2026-09-14). `save-preferences` escribía
  `showCapturedPhotos`, `showRepositoryPhotos`, `showRepositoryIndicators` y
  `showAdditionalActions` con los valores que la ventana ya no enviaba, y el
  renderer los aplicaba desactivados. Ahora `get-preferences` y
  `save-preferences` solo tocan el centro, el logotipo y el recibo; esas
  opciones solo las guarda el menú Ver. Lo cubre
  `tests/unit/main/preferencesHandlers.test.js`.
- **Con Ver > Fotografías capturadas desactivado, las exportaciones de fotos
  capturadas no encontraban ninguna** (antes el fallo 3, corregido el
  2026-09-14). `get-users` borraba la ruta de la foto de cada usuario cuando
  la lista no mostraba miniaturas, y esa ruta también la leen las
  exportaciones, **Eliminar fotografía vinculada** (que decía que el usuario
  no tenía foto) y la detección de duplicados. Ahora la ruta llega siempre y
  ocultar las miniaturas es cosa solo de `UserRowRenderer`; desaparecen la
  opción `loadCapturedImages` y los dos parches que la compensaban. Lo cubre
  `tests/unit/main/getUsersHandler.test.js`.
- **El XML perdía los ceros a la izquierda de NIA y documentos** (antes el
  fallo 4, corregido el 2026-09-14). `parseAttributeValue: true` convertía en
  número los atributos que lo parecían. Ahora el analizador lo lee todo como
  texto. Los proyectos importados antes guardaron los identificadores sin
  ceros: la actualización del XML los compara sin tener en cuenta los ceros de
  la izquierda (`identifierKey()` en `projectHandlers.js`), así que los
  reconoce en lugar de darlos de baja y de alta, y guarda el identificador con
  los ceros. Lo cubren `XMLUserParser.test.js` y `xmlUpdateHandlers.test.js`.
- **Crear un proyecto no cerraba el anterior** (antes el fallo 5, corregido el
  2026-09-14). `create-project` no llamaba a `closeCurrentProject()`, así que
  el vigilante de la carpeta de entrada y la base de datos del proyecto
  anterior seguían vivos. Ahora lo cierra, y antes lee el XML: un archivo roto
  ya no cierra el proyecto abierto ni deja carpetas ni base de datos a medias
  en la carpeta elegida. Lo cubre `tests/unit/main/createProjectHandler.test.js`.
- **Crear un proyecto en una carpeta que ya tenía uno duplicaba los usuarios**
  (antes el fallo 6, corregido el 2026-09-14). `create-project` reutilizaba la
  base de datos existente e importaba el XML encima. Ahora se niega si la
  carpeta tiene `data/users.db` y remite a **Archivo > Abrir Proyecto...**, sin
  cerrar el proyecto abierto. Lo cubre `createProjectHandler.test.js`.
- **Enlazar una foto ya asignada a otro usuario reemplazaba la del actual sin
  preguntar** (antes el fallo 7, corregido el 2026-09-14). `link-image-user`
  devolvía `imageAlreadyAssigned` sin mirar si el usuario ya tenía foto, y la
  única pregunta no lo mencionaba. Ahora devuelve también `currentImage`, y la
  pregunta dice que esa foto se reemplazará. Lo cubre
  `linkImageHandlers.test.js`.
- **Actualizar el XML guardaba la ruta antes de validarla** (antes el fallo 8,
  corregido el 2026-09-14). `update-xml` guardaba `xmlFilePath` al empezar el
  análisis, así que un archivo inexistente, ilegible o una actualización
  cancelada dejaban en la información del proyecto un XML que no se usó. Ahora
  el análisis devuelve la ruta, la ventana la pasa a `confirm-update-xml` y
  esta la guarda al terminar de aplicar los cambios. Lo cubre
  `xmlUpdateHandlers.test.js`.
- **El resumen de la exportación al depósito decía «0 reemplazos» sin las
  opciones del depósito** (antes el fallo 9, corregido el 2026-09-14).
  `describeExportScope` contaba los reemplazos con `has_repository_image`, que
  `get-users` deja a `false` cuando no carga el depósito. Ahora
  `exportToRepository` pregunta a `count-repository-images`, que lee el
  depósito, y el resumen usa esas cifras. Lo cubre `ExportManager.test.js`.
- **Ver > Actualizar imágenes del depósito no hacía nada si la copia local no
  estaba en marcha** (antes el fallo 10, corregido el 2026-09-14). La copia
  local solo arranca cuando algo la necesita, a propósito, y al abrir un
  proyecto reciente con las opciones del depósito de **Ver** desactivadas no
  arrancaba. El comando solo actuaba sobre una copia ya en marcha; ahora la
  arranca si hace falta y avisa si no hay proyecto o depósito configurado.
  Probado en la aplicación: `main.js` no tiene tests unitarios.
- **El aviso «Depósito no configurado» indicaba una ruta de menú que no
  existe** (de la lista de prioridad baja, corregido el 2026-09-14). Ahora
  remite a **Proyecto > Configurar depósito de imágenes**.
- **Las flechas movían la lista de usuarios con algunos diálogos abiertos**
  (antes el fallo 11, corregido el 2026-09-14). `renderer.js` pasaba a
  `KeyboardNavigationManager` una lista a mano de cinco diálogos de dieciséis.
  Ahora el gestor comprueba por defecto si hay cualquier `.modal.show`, así que
  también cubre los diálogos que se añadan. Lo cubre
  `KeyboardNavigationManager.test.js`.
- **Textos incorrectos o en inglés** (de la lista de prioridad baja,
  corregidos el 2026-09-14): la confirmación de la actualización del XML
  llamaba al grupo «¡Eliminados!» en lugar de «⚠ Eliminados»; el aviso de
  duplicados decía «solo se importó el primero» cuando se prioriza el que tiene
  grupo; `xmlParser.js` daba un error en inglés; y la ayuda de Preferencias
  decía que el nombre del centro se usa en los PDF, cuando solo va en los
  recibos (el logotipo sí va en los PDF).
- **Código muerto** (de la lista de prioridad baja, eliminado el 2026-09-14):
  la sección de duplicados del informe que se reescribe al actualizar el XML,
  que buscaba duplicados en un mapa con un usuario por identificador.
- **Los filtros de solicitudes no se recordaban bien** (de la lista de
  prioridad baja, corregido el 2026-09-14). `saveDisplayPreferences` no
  guardaba **Publicaciones solicitadas**, y al arrancar `MenuEventManager` solo
  restauraba el filtro de duplicados: **Carnets solicitados** volvía marcado en
  el menú pero con la lista sin filtrar. Ahora se guardan y restauran los tres.
- **Últimos carnets impresos: fecha y tipo** (de la lista de prioridad baja,
  corregido el 2026-09-14). La fecha de impresión era la del archivo de la
  solicitud, porque moverlo a `Printed-ID` no la cambia; ahora
  `mark-cards-as-printed` le pone la fecha del momento. El personal no docente
  salía como `non_teaching_staff` y sin color, porque la ventana esperaba
  `staff`. Los carnets marcados antes de esta corrección siguen mostrando la
  fecha de la solicitud.
- **`Esc` no cerraba los diálogos** (de la lista de prioridad baja, corregido
  el 2026-09-14). Ahora `core/modalEscape.js` pulsa el botón marcado con
  `data-modal-cancel` del diálogo de delante, en todos los diálogos de la
  ventana principal salvo la barra de progreso.
- **Tras cerrar un mensaje el foco volvía al buscador** (de la lista de
  prioridad baja, corregido el 2026-09-14), lo que bloqueaba las flechas.
  `showInfoModal` devuelve ahora el foco a donde estaba antes del mensaje.
- **La búsqueda de usuarios no incluía el DNI ni ignoraba tildes** (de la
  lista de prioridad baja, corregido el 2026-09-14). `getUsers` filtra ahora la
  búsqueda en JavaScript: cada palabra debe aparecer en el nombre, los
  apellidos, el NIA o el documento, sin distinguir mayúsculas ni tildes.
- **Con las opciones de fotos desactivadas y el modo selección activo se
  ocultaba la columna GRUPO** (de la lista de prioridad baja, corregido el
  2026-09-14). La regla de `tables.css` oculta ahora la última columna en lugar
  de la quinta. Lo cubre `tests/unit/styles/photosColumn.test.js`.
- **Cámara > Activar la cámara al iniciar no hacía nada** (de la lista de
  prioridad baja, implementado el 2026-09-14). Se guarda en `config.json`
  (`cameraAutoStart`) y, al arrancar, la cámara se activa tras abrir el
  proyecto reciente.
- **Cerrar la ventana de la cámara con su X dejaba el menú desincronizado**
  (de la lista de prioridad baja, corregido el 2026-09-14). El cierre de la
  ventana desactiva la cámara y reconstruye el menú, y **Mostrar ventana de
  cámara** ya no usa una referencia a la ventana guardada al construirlo.
- **Una foto de más de 5 MB dejaba el visor parpadeando** (de la lista de
  prioridad baja, corregido el 2026-09-14). `folderWatcher` emite
  `image-rejected` para toda foto anunciada que no llega a importarse; la
  ventana deja de parpadear y, si es por el tamaño, lo avisa.
- **Un precio de recibo de 0 € era imposible** (de la lista de prioridad baja,
  corregido el 2026-09-14): `price || 18` convertía 0 en 18. Ahora solo un
  valor vacío o no numérico usa 18 (`receiptPriceOrDefault()`).
- **Imprimir un recibo fallaba en silencio y lo marcaba como impreso** (de la
  lista de prioridad baja, corregido el 2026-09-14). `print-orla-receipt`
  respondía antes de que la impresora contestara; ahora espera su respuesta y,
  si falla, devuelve el error y el recibo no se marca. Lo cubre
  `tests/unit/main/receiptPrintHandler.test.js`.
- **La ventana de actualizaciones podía quedarse colgada** (de la lista de
  prioridad baja, corregido el 2026-09-14). Una comprobación manual durante la
  automática recibía `already-checking`; ahora se une a la que está en marcha,
  que pasa a ser manual y cuyo resultado reciben las dos.
- **No se podía desactivar la comprobación automática de actualizaciones**
  (de la lista de prioridad baja, añadido el 2026-09-14): casilla en
  **Archivo > Preferencias... > Actualizaciones**, que guarda
  `updates.autoCheck`.
- **Las exportaciones de imágenes informaban poco** (de la lista de prioridad
  baja, corregido el 2026-09-14). Las tres usan ahora
  `exportImagesToGroupFolders()`, que cuenta los usuarios sin grupo, y
  **Imágenes capturadas como ID** y **como nombre y apellidos** muestran al
  terminar el mismo resumen que la del depósito.
- **La rejilla de imágenes capturadas no se refrescaba tras enlazar** (de la
  lista de prioridad baja, corregido el 2026-09-14). Enlazar, quitar, borrar
  los enlaces o restaurarlos avisan a la rejilla con `captured-images-changed`.
