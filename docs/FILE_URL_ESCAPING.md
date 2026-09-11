# Escapado de rutas en URLs `file://`

**Estado**: ⏳ Pendiente. Diferido al trabajo de protocolo custom + miniaturas.
**Detectado**: 2026-09-11, durante la auditoría de rendimiento del renderer.

## Resumen

El renderer construye las URLs de imagen concatenando la ruta del sistema de archivos
directamente detrás de `file://`, sin escaparla:

```js
data-src="file://${user.image_path}"
```

Para la mayoría de rutas esto funciona, pero hay dos caracteres válidos en nombres de
carpeta de Windows que rompen la carga de la imagen. Cuando ocurre, **falla en silencio**.

## Qué funciona (verificado)

Espacios y acentos **no** son un problema. El parser de URL los codifica automáticamente:

```
D:/Colegio Ñuño/José.jpg   ->   /D:/Colegio%20%C3%91u%C3%B1o/Jos%C3%A9.jpg
```

Como las rutas habituales en centros educativos españoles son de este tipo, el caso
común está cubierto. Por eso el problema no se ha manifestado hasta ahora.

## Qué rompe (verificado)

### `#` — trunca la ruta

Todo lo que sigue se interpreta como fragmento de URL:

```
D:\Curso 2024#2025\1234.jpg   ->   D:\Curso 2024      (hash: "#2025\1234.jpg")
```

La imagen nunca se encuentra. Es un patrón plausible al nombrar cursos académicos.

### `%` — resuelve una ruta distinta o inválida

Una carpeta `Backup 100%25` se resolvería como `Backup 100%`, porque `%25` se decodifica.
Un `%` suelto seguido de `/` produce una secuencia de escape inválida: `decodeURIComponent`
lanza `URIError: URI malformed`, y Chromium tampoco resuelve el archivo.

### `?` — no aplica

Rompería igual (se interpreta como query string), pero Windows no permite `?` en nombres
de archivo o carpeta, así que no puede darse en la práctica.

Nota: en las URLs del depósito ya añadimos un `?v=N` como invalidador de caché, lo que
hace que la parte de query esté ocupada de forma legítima.

### Entidades HTML — solo en dos sitios

`UserRowRenderer` construye el `<img>` dentro de una plantilla que se asigna por
`innerHTML`, sin escapar el atributo. Una carpeta que contuviera una secuencia como
`&copy;` sería convertida por el parser de HTML en `©`. Los demás puntos asignan a la
propiedad `.src`, donde esto no aplica.

## Por qué es difícil de detectar

Todos los `<img>` de la lista llevan `onerror="this.style.display='none'"`. Si la URL no
resuelve, la imagen simplemente **se oculta**: el usuario ve "sin foto" en alumnos que sí
la tienen, sin ningún mensaje de error y sin forma de deducir la causa.

## Puntos afectados

Ocho lugares construyen URLs `file://`:

| Archivo | Línea | Notas |
|---|---|---|
| `src/renderer/components/UserRowRenderer.js` | 109 | Foto capturada. Vía `innerHTML` |
| `src/renderer/components/UserRowRenderer.js` | 136 | Foto del depósito. Vía `innerHTML` |
| `src/renderer/components/ImageGridManager.js` | 82 | Asignación a `.src` |
| `src/renderer/components/ImageGridManager.js` | 107 | Asignación a `.src` |
| `src/renderer/components/ImageTagsManager.js` | 267 | Asignación a `.src` |
| `src/renderer/image-grid.js` | 138 | Ventana de capturadas |
| `src/renderer/repository-grid.js` | 284 | Ventana del depósito |
| `src/renderer/components/modals/UserImageModal.js` | 101 | Vista previa |

## Solución propuesta

No hace falta escapar la ruta entera: basta con codificar los caracteres que el parser
interpreta de forma especial y dejar que él se encargue de espacios y acentos, como ya
hace correctamente.

```js
function toFileUrl(filePath) {
  return 'file:///' + String(filePath)
    .replace(/\\/g, '/')
    .replace(/[#?%]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}
```

Verificado: hace *round-trip* correcto en todos los casos anteriores, incluidos `#` y `%`.

Pendiente además, solo para los dos puntos que usan `innerHTML`: escapar el atributo HTML
(`&` → `&amp;`, `"` → `&quot;`).

## Por qué se difiere

El plan de rendimiento contempla sustituir estas URLs `file://` por un protocolo custom
(`protocol.handle`) en el proceso principal que sirva **miniaturas** generadas con `sharp`
y cacheadas en disco. Ese cambio es necesario por otro motivo: hoy cada indicador de
32 px descarga y decodifica el JPEG original a resolución completa.

Ese trabajo centraliza la construcción de todas las URLs de imagen en un único punto, que
es donde debe vivir el escapado. Hacerlo ahora por separado significaría tocar los ocho
sitios dos veces.

**Condición**: si el protocolo custom se retrasa o se descarta, este arreglo debe hacerse
de forma independiente. Es pequeño y acotado.

## Tests a añadir

Cuando se implemente, cubrir como mínimo:

- Ruta con `#` en un nombre de carpeta.
- Ruta con `%` literal y con `%25`.
- Ruta con espacios y acentos (comprobar que se sigue resolviendo).
- Escapado de atributo HTML en las filas generadas por `UserRowRenderer`.
