# Primeros pasos

Edu User Capture sirve para hacer las fotos de carnet del alumnado y del personal del centro, asociar cada foto a su persona y sacarlas después en el formato que necesites: listados para carnets, fotos con nombre, listados en PDF con las fotos de cada grupo o envío al depósito de imágenes del centro.

## La ventana principal

- **A la izquierda**, la lista de usuarios, con el buscador y el filtro de grupos. Consulta [Lista de usuarios](usuarios.md).
- **A la derecha**, el visor con las fotos del proyecto, empezando por la más reciente, y el botón **Enlazar**.
- **Junto al visor**, si lo activas en **Ver > Historial de capturas**, una tira de miniaturas con todas las capturas ordenadas por fecha.
- **Abajo**, la barra de estado: nombre del proyecto, carpeta del depósito, recuento de usuarios y fotos enlazadas.

Si no hay ningún proyecto abierto, la lista muestra el mensaje «Abre o crea un nuevo proyecto».

## El flujo de trabajo habitual

1. **Crea el proyecto** con **Archivo > Nuevo Proyecto...** (`Ctrl+N`). Eliges una carpeta y el archivo XML con los datos del centro, y la aplicación importa los grupos, el alumnado, los docentes y los no docentes. Consulta [Crear un proyecto](proyectos.md#crear-un-proyecto).
2. **Configura el depósito de imágenes**, si el centro lo usa, en **Proyecto > Configurar depósito de imágenes**. Es la carpeta donde el centro guarda la foto oficial de cada persona. Consulta [Depósito de imágenes](deposito.md).
3. **Haz las fotos**. Puedes usar la webcam, una cámara o un programa que deje las fotos en la carpeta de entrada del proyecto, o arrastrar archivos JPG a la ventana. Cada foto nueva aparece en el visor en unos instantes. Consulta [Captura e importación de fotos](captura.md).
4. **Enlaza cada foto con su usuario**: selecciona a la persona en la lista, deja su foto a la vista en el visor y pulsa **Enlazar** (`Ctrl+L`). Consulta [Enlazar fotos](enlazar.md).
5. **Exporta o envía las fotos** desde **Archivo > Exportar**: CSV para carnets, fotos con el NIA o el DNI como nombre, fotos con nombre y apellidos, el listado en PDF con fotografías por grupo o **Imágenes capturadas al depósito**. Consulta [Exportaciones](exportaciones.md).

No hace falta guardar: cada cambio queda guardado en el proyecto en el momento.

## Las carpetas del proyecto

Al crear un proyecto, la aplicación prepara esta estructura dentro de la carpeta que elijas:

| Carpeta o archivo | Qué contiene |
|---|---|
| `ingest` | La carpeta de entrada. Cada foto JPG que llega aquí se mueve sola a `imports`, así que normalmente está vacía. |
| `imports` | Todas las fotos del proyecto, renombradas con la fecha y la hora de llegada (salvo las traídas con la importación de imágenes con ID, que conservan su nombre). De aquí salen las fotos enlazadas. |
| `data` | La base de datos del proyecto: usuarios, grupos, enlaces entre fotos y usuarios, etiquetas y configuración del proyecto. |
| `app.log` | Registro de actividad de la aplicación, útil si hay que investigar un problema. Cuando llega a 5 MB se guarda como `app.1.log` y se empieza uno nuevo; se conservan los dos últimos. |
| `import-report.log` | Informe de la importación del XML. Solo aparece si hubo incidencias al crear el proyecto, o después de actualizar el XML. |

> **Importante:** No cambies el nombre ni borres a mano las fotos de `imports`. Cada enlace recuerda el nombre del archivo, y si lo cambias la foto deja de verse en la ficha del usuario. Tampoco modifiques nada dentro de `data`.

> **Consejo:** Para hacer una copia de seguridad de un proyecto, copia su carpeta completa cuando no esté abierto en la aplicación.

La carpeta de entrada puede estar en otro sitio si la rediriges. Consulta [Redirigir la carpeta de entrada](captura.md#redirigir-la-carpeta-de-entrada).

## Dónde seguir

- [Proyectos](proyectos.md): crear, abrir, cerrar y actualizar proyectos.
- [Captura e importación de fotos](captura.md): webcam, carpeta de entrada, arrastrar fotos e importación por ID.
- [Lista de usuarios](usuarios.md): buscar, filtrar y seleccionar usuarios.
- [Enlazar fotos](enlazar.md): asociar cada foto a su usuario y corregir errores.
- [Depósito de imágenes](deposito.md): la carpeta con las fotos oficiales del centro.
- [Exportaciones](exportaciones.md): CSV, fotos y envío al depósito.
- [Carnets y publicación oficial](carnets.md): solicitudes de impresión de carnets y de publicación de fotos.
- [Orla de graduación](orlas.md): pagos de la orla de graduación y recibos.
- [Preferencias y actualizaciones](preferencias.md): datos del centro, impresora de recibos y nuevas versiones.
- [Atajos de teclado](atajos.md): todas las combinaciones de teclas.
