# Orla de graduación

Muchos centros ofrecen al alumnado que termina sus estudios una orla de graduación, que cada persona paga si quiere una copia. Con Edu User Capture llevas el registro de quién ha pagado la suya, le imprimes un recibo en una impresora térmica y sacas el listado de pagos.

Esta orla no es el PDF con las fotos de cada grupo que sirve al profesorado para identificar al alumnado: ese es el [listado con fotografías por grupo](exportaciones.md#exportar-el-listado-con-fotografias-por-grupo).

## Activar o desactivar la orla de graduación

No todos los centros ofrecen este servicio, así que puedes quitarlo de la vista:

1. Abre **Archivo > Preferencias...** (`Ctrl+,`).
2. Pulsa la categoría **Orla de graduación**, a la izquierda.
3. Marca o desmarca **Gestionar la orla de graduación**.
4. Pulsa **Guardar**.

Con la casilla desmarcada desaparecen el menú **Orla**, la opción **Ver > Pagos de la orla**, los botones de pago bajo el visor, los iconos de orla pagada y recibo impreso de la lista y las opciones para deshacer un pago del menú del botón derecho. Los pagos y recibos ya registrados no se borran: vuelven a verse al marcar de nuevo la casilla. La casilla está marcada si nunca la has cambiado.

## El menú Orla

Todo lo del servicio está reunido en el menú **Orla**:

| Entrada del menú | Qué hace |
|---|---|
| **Registrar el pago del usuario seleccionado** | Lo mismo que el botón **Pagar Orla**. Ver [Registrar el pago de la orla](#registrar-el-pago-de-la-orla) |
| **Imprimir el recibo del usuario seleccionado** | Lo mismo que el botón **Imp. Recibo**. Ver [Imprimir el recibo de un alumno](#imprimir-el-recibo-de-un-alumno) |
| **Listado de alumnos pagados en PDF** | El archivo `Alumnos_Pagados.pdf`. Ver [Exportar el listado de alumnos pagados](#exportar-el-listado-de-alumnos-pagados) |
| **Listado de alumnos pagados en CSV** | El archivo `Alumnos_Pagados.csv` |
| **Configuración de la orla...** | Abre las preferencias en la categoría **Orla de graduación**: el servicio, la impresora y el contenido del recibo |

## Mostrar los botones de pago

Los botones de pago y recibo están en la sección **Pagos de la orla**, debajo del botón **Enlazar**. Si no la ves, activa **Ver > Pagos de la orla**. Esa misma opción muestra en la lista los iconos de orla pagada y recibo impreso. Si tampoco aparece esa opción en el menú **Ver**, el servicio está desactivado (ver [Activar o desactivar la orla de graduación](#activar-o-desactivar-la-orla-de-graduacion)).

## Registrar el pago de la orla

1. Selecciona en la lista a la persona que paga.
2. Pulsa **Pagar Orla**.
3. Confirma el mensaje «¿Deseas marcar como pagado la orla de…?».

En la lista aparece junto a esa persona un icono con el símbolo del dólar, que indica que la orla está pagada. El recibo no se imprime solo: imprímelo después con **Imp. Recibo**.

Si pulsas **Pagar Orla** con una persona que ya tiene la orla pagada, la aplicación te pregunta si quieres desmarcarla como pagada.

## Imprimir el recibo de un alumno

1. Selecciona en la lista a la persona. Su orla tiene que estar pagada.
2. Pulsa **Imp. Recibo**.

El recibo sale directamente por la impresora configurada, sin ninguna ventana intermedia, y en la lista aparece junto a esa persona un icono de impresora, que indica que el recibo está impreso.

- Si la orla no está pagada, la aplicación avisa de que no se puede imprimir el recibo sin que la orla esté pagada previamente.
- Cada recibo se imprime una sola vez. Si ya está marcado como impreso, la aplicación no deja volver a imprimirlo. Para repetirlo, desmárcalo antes (ver [Deshacer un pago o un recibo](#deshacer-un-pago-o-un-recibo)).

> **Importante:** el recibo se marca como impreso cuando la impresora acepta el trabajo. Si no lo acepta (apagada, sin impresora disponible), la aplicación te avisa y no lo marca. Lo que pase después, como un atasco de papel, la aplicación no lo sabe: si el recibo no llega a salir, desmárcalo y vuelve a imprimirlo.

## Qué lleva el recibo

El recibo está pensado para una impresora térmica con rollo de 80 mm. De arriba abajo lleva:

- El logotipo del centro, si has elegido uno.
- El nombre del centro.
- El subtítulo.
- El nombre y los apellidos de la persona, en negrita.
- «Grupo:» y el nombre del grupo.
- «Fecha:» con la fecha y la hora de impresión.
- «Entrega:» con el precio, con dos decimales; por ejemplo, `18.00€`.
- El texto del pie, separado por una línea.

El nombre del centro y el logotipo se configuran en [Preferencias y actualizaciones](preferencias.md); el subtítulo, el precio y el pie, como se explica en [Personalizar el contenido del recibo](#personalizar-el-contenido-del-recibo).

## Ver quién ha pagado

En la lista de usuarios, con **Ver > Pagos de la orla** activado:

- El icono del dólar indica que la orla está pagada.
- El icono de impresora indica que el recibo está impreso.

Para tener la relación completa, exporta el listado de pagados, como se explica a continuación.

## Exportar el listado de alumnos pagados

Ambos listados incluyen a todas las personas del proyecto con la orla pagada, sin tener en cuenta la búsqueda, el filtro de grupos ni la selección. Si no ha pagado nadie, la aplicación lo avisa y no genera nada.

- **Orla > Listado de alumnos pagados en PDF** genera `Alumnos_Pagados.pdf`: un único documento titulado «Alumnos con Orla Pagada», con un apartado por grupo, una lista numerada de «Apellido1 Apellido2, Nombre», el subtotal de cada grupo y una última página de resumen con el total de grupos y de alumnos. Si hay logotipo, aparece en cada página.
- **Orla > Listado de alumnos pagados en CSV** genera `Alumnos_Pagados.csv`, separado por comas, con las columnas `Grupo`, `Apellido1`, `Apellido2` y `Nombre`, ordenado por grupo y apellidos.

En los dos casos, la aplicación te pide la carpeta de destino.

## Deshacer un pago o un recibo

Pulsa con el botón derecho sobre la persona en la lista (fuera del modo selección). Según su situación, el menú ofrece:

- **Desmarcar recibo impreso**, si el recibo está impreso.
- **Desmarcar orla pagada**, si la orla está pagada y el recibo no está impreso. Si ya se imprimió el recibo, desmárcalo primero.

Cada opción pide confirmación.

## Configurar la impresora de recibos

1. Abre **Orla > Configuración de la orla...**, o **Archivo > Preferencias...** (`Ctrl+,`) y pulsa la categoría **Orla de graduación**, a la izquierda.
2. En **Seleccionar impresora**, elige la impresora térmica. Debajo se muestra su información.
3. Si necesitas ajustar el papel u otras opciones de la impresora, pulsa **Abrir Preferencias de Impresora**: se abren las propiedades de la impresora en Windows.
4. Pulsa **Guardar**.

Los recibos se imprimen siempre en esta impresora, sin mostrar ningún cuadro de diálogo. Si no eliges ninguna, se usa la impresora predeterminada de Windows.

Si la impresora no puede imprimir el recibo (está apagada, sin papel, o no hay ninguna disponible), la aplicación te lo dice y el recibo no se marca como impreso, para que puedas volver a intentarlo.

## Personalizar el contenido del recibo

1. Abre **Orla > Configuración de la orla...**.
2. En **Contenido del Recibo**, rellena:
   - **Subtítulo del recibo**: por ejemplo, «Reserva de una copia de Orla».
   - **Precio (€)**: el importe que figura como entrega. Puede ser 0; si dejas el campo vacío se usan 18 €.
   - **Texto del pie del recibo**: el texto informativo final. Cada línea que escribas sale como un párrafo aparte.
3. Pulsa **Guardar**.

> **Importante:** mientras no guardes las preferencias por primera vez, el recibo usa un subtítulo y un pie de ejemplo. Una vez guardadas, usa exactamente lo que haya en estos campos, aunque esté vacío. Rellena el subtítulo y el pie antes de guardar.

## Imprimir un recibo de prueba

En la categoría **Orla de graduación** de las preferencias, el botón **Imprimir Recibo de Prueba** imprime un recibo a nombre de «Usuario de Prueba», del «Grupo de Prueba», en la impresora elegida. Sirve para comprobar la impresora y el aspecto del recibo sin marcar a nadie.

> **Consejo:** la prueba usa el contenido del recibo que ya está guardado, no lo que acabas de escribir. Si has cambiado el subtítulo, el precio o el pie, pulsa **Guardar**, vuelve a abrir las preferencias y haz entonces la prueba.

La aplicación no muestra ningún mensaje al imprimir la prueba: comprueba el resultado en la impresora.
