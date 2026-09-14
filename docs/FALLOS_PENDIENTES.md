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

### 8. Actualizar el XML guarda la ruta antes de validarla

`update-xml` guarda el nuevo `xmlFilePath` antes de comprobar que el archivo
existe y antes de que el usuario confirme los cambios. Tras una actualización
fallida o cancelada, la información del proyecto muestra un XML que no se
llegó a usar.

### 9. El resumen de la exportación al depósito dice "0 reemplazos" sin las opciones del depósito

Con las opciones del depósito del menú Ver desactivadas, `get-users` rellena
`has_repository_image = false` y `ExportManager.describeExportScope` da la
cifra por conocida: el resumen dice "Reemplazarán una foto existente: 0"
aunque haya fotos en el depósito.

Manual: `deposito.md` (se aconseja activar los indicadores antes de exportar).

### 10. La copia local del depósito no arranca al abrir un proyecto reciente

Al arrancar o al abrir desde Proyectos Recientes, `openRecentProject`
(`main.js`) solo inicia la copia local si alguna opción del depósito del menú
Ver está activa. Hasta entonces **Ver > Actualizar imágenes del depósito** no
hace nada. Con **Abrir Proyecto...** se inicia siempre.

Manual: `deposito.md`.

### 11. Las flechas mueven la lista de usuarios con algunos diálogos abiertos

`isModalOpen` (`renderer.js`, configuración de `KeyboardNavigationManager`)
solo tiene en cuenta algunos modales. Con las opciones de exportación, la
etiqueta, la restauración, las preferencias, la orla, la actualización o la
vista previa de foto abiertos, las flechas siguen moviendo la selección de la
lista que queda detrás.

## Prioridad baja

- **Cámara > Activar la cámara al iniciar no hace nada.** No se guarda
  (`main.js`) y nada en el renderer escucha `onMenuCameraAutostart`. Se ha
  dejado fuera del manual. (`captura.md`)
- **Cerrar la ventana de la cámara con su X deja el menú desincronizado.** El
  menú no se reconstruye y **Mostrar ventana de cámara** apunta a una ventana
  cerrada. Sin probar. (`captura.md`)
- **Ruta de menú inexistente en el aviso "Depósito no configurado"**
  (`main.js`, *confirmado*): dice "Archivo > Configuración > Depósito
  imágenes de usuario"; la correcta es **Proyecto > Configurar depósito de
  imágenes**. (`enlazar.md`)
- **Los filtros de solicitudes no se recuerdan bien.** `saveDisplayPreferences`
  (`utils/config.js`, *confirmado*) no guarda `showPublicationRequestsOnly`
  aunque al arrancar se lee. **Carnets solicitados** sí se guarda y aparece
  marcado en el menú, pero la lista arranca sin filtrar porque
  `MenuEventManager` solo restaura el de duplicados. (`usuarios.md`,
  `preferencias.md`)
- **Últimos carnets impresos: fecha y tipo.** La fecha de impresión es la de
  modificación del archivo, que no cambia al moverlo a `Printed-ID`, así que
  seguramente muestra la de la solicitud. El personal no docente sale como
  `non_teaching_staff` porque `printed-cards.js` espera `staff`. (`carnets.md`)
- **Una foto de más de 5 MB deja el visor parpadeando.** `folderWatcher` avisa
  de que está procesando antes de comprobar el tamaño; al descartarla, el aviso
  no se retira hasta que llega otra foto. (`captura.md`)
- **`Esc` no cierra los diálogos.** `BaseModal` solo gestiona `Intro`; solo
  "Acerca de" responde a `Esc`, y únicamente con el foco dentro. (`atajos.md`)
- **La búsqueda de usuarios no incluye el DNI ni ignora tildes** (`LIKE` de
  SQLite en `database.js`). Al personal no se le puede buscar por documento.
  (`usuarios.md`)
- **Con las tres opciones de fotos desactivadas y el modo selección activo se
  oculta la columna GRUPO** en lugar de la de fotos: la regla de `tables.css`
  usa `nth-child(5)`. (`usuarios.md`)
- **Un precio de recibo de 0 € es imposible**: se guarda como 18
  (`save-preferences`). (`orlas.md`)
- **Imprimir sin impresora seleccionada o detectada falla en silencio**, y el
  recibo se marca como impreso aunque la impresora falle. (`orlas.md`)
- **La ventana de actualizaciones puede quedarse colgada**: una comprobación
  manual durante la automática recibe `already-checking`, que `UpdateModal`
  ignora, y la ventana se queda en "Buscando actualizaciones" sin botones.
  (`preferencias.md`)
- **No hay forma de desactivar la comprobación automática de actualizaciones**
  desde la aplicación: `updates.autoCheck` existe en `config.json` pero ninguna
  pantalla lo cambia. (`preferencias.md`)
- **Las exportaciones de imágenes informan poco**: los usuarios sin grupo se
  omiten en silencio, los errores por usuario solo van al log y no hay resumen
  al terminar. (`exportaciones.md`)
- **La rejilla de imágenes capturadas no se refresca tras enlazar**: hay que
  cerrarla y abrirla o cambiar de grupo. (`enlazar.md`)
- **Tras cerrar cualquier mensaje el foco vuelve al buscador**, lo que bloquea
  la navegación con flechas hasta hacer clic en la lista. (`usuarios.md`)
- **Textos incorrectos o en inglés**:
  - La confirmación de la actualización del XML llama al grupo "¡Eliminados!"
    (`ProjectManager.js`), pero se llama "⚠ Eliminados".
  - El informe de importación dice "solo se importó el primero" de los
    duplicados, pero se prioriza el que tiene grupo (`projectHandlers.js`).
  - `xmlParser.js` muestra al usuario "Invalid XML structure: missing
    `<centro>` root element".
  - La ayuda de la ventana de preferencias dice que el nombre del centro se usa
    en los PDF; solo se usa en los recibos.
- **Código muerto**: la sección de duplicados del informe que se reescribe al
  actualizar el XML nunca puede llenarse, porque los usuarios ya llegan sin
  duplicados (`projectHandlers.js`).

## CLAUDE.md desactualizado

Discrepancias entre CLAUDE.md y el código. El manual sigue al código.

- **Google Drive**: describe `googleDriveManager.js`, "Google Drive API v3" y
  que la aplicación "se conecta con el servidor". Ese archivo no existe: el
  depósito es una carpeta del disco (normalmente sincronizada) con una copia
  local que mantiene `repositoryMirror.js`.
- **Nombres del menú** que no coinciden con los reales:
  - "Lista en CSV para carnets" → **Archivo CSV para Carnets del grupo seleccionado**
  - "CSV Inventario por grupos" → **Archivos para Edu Inventory Manager**
  - "Imágenes a repositorio" → **Imágenes capturadas al depósito**
  - "Orla PDF" → **Orlas en PDF**
  - "Mostrar solo usuarios con solicitud de carnet/publicación" → **Carnets solicitados** / **Publicaciones solicitadas**
  - "Proyecto > Configurar depósito" → **Configurar depósito de imágenes**
- **Impresora de recibos**: no hay menú Herramientas; se configura en
  **Archivo > Preferencias...** Los recibos no se imprimen automáticamente al
  marcar la orla como pagada: hay un botón **Imp. Recibo**.
- **Solicitudes de carnet y publicación**: solo aparecen en el menú contextual
  en modo selección.
- **Exportación al depósito**: ya no sobrescribe sin más; las fotos
  reemplazadas se archivan en `Reemplazadas/<YYYYMMDDHHMMSS>_<equipo>`.
- **Orlas**: la rejilla es de 6 × 6, no de 4 columnas; la calidad se elige
  entre 60, 80, 90 y 100, no de 0 a 100.
- **CSV para carnets**: solo incluye usuarios con foto en el depósito.
- **CSV de inventario**: las cabeceras no coinciden (`Alumnado.csv` empieza por
  `Codigo` y usa `Fecha Nacimiento`; `Personal.csv` añade `Función`,
  `Teléfono 1`, `Teléfono 2` y `Email`; `Grupos.csv` usa `CódigoGrupo` y lista
  siempre todos los grupos).
- **Inventario de imágenes**: un `imagenes.zip` (o `imagenes_N.zip`) plano, sin
  carpetas por grupo.
- **Imágenes capturadas como ID**: van en una subcarpeta por grupo.
- **Navegación por teclado**: no hay selección con `Intro`; las flechas
  izquierda y derecha mueven el visor. `BaseModal` no gestiona `Esc`.
- **Visor de imágenes**: no tiene contador.
- **Placeholder "sin proyecto"**: solo muestra un texto, sin botones de crear o
  abrir.
- **Carpeta de entrada**: no se revisa cada segundo; se reacciona a los
  eventos del sistema de archivos.
- **exportHandlers.js**: tiene 9 manejadores, no 7.

## Corregidos

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
