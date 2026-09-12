# Escapado de rutas en URLs `file://` - Resuelto

**Estado**: ✅ Resuelto. Ya no se construyen URLs `file://` en el renderer.
**Detectado**: 2026-09-11, durante la auditoría de rendimiento del renderer.
**Resuelto**: 2026-09-12, junto con el protocolo de miniaturas.

## El problema

El renderer concatenaba la ruta del sistema de archivos detrás de `file://` sin
escaparla:

```js
data-src="file://${user.image_path}"
```

Espacios y acentos funcionaban, porque el parser de URL los codifica solo. Pero dos
caracteres válidos en nombres de carpeta de Windows rompían la carga:

- **`#`** truncaba la ruta: `D:\Curso 2024#2025\1234.jpg` se resolvía como
  `D:\Curso 2024`, y el resto pasaba a ser el fragmento de la URL.
- **`%`** producía una secuencia de escape inválida o resolvía una ruta distinta:
  una carpeta `Backup 100%25` acababa apuntando a `Backup 100%`.

Y fallaba en silencio: el `onerror` de los `<img>` oculta la imagen, así que se veía
como "alumno sin foto", sin ningún error y sin forma de deducir la causa.

## La solución

Las imágenes ya no se piden por `file://`. Se sirven por un protocolo propio,
`app-img`, donde la ruta viaja **codificada como parámetro de consulta**:

```
app-img://img/?path=D%3A%5CCurso%202024%232025%5C1234.jpg&size=128
```

Al ir percent-encoded, `#`, `%`, `?`, `&`, espacios y acentos sobreviven intactos.
Todas las URLs se construyen desde un único sitio, `src/renderer/utils/imageUrl.js`,
en lugar de los ocho puntos que las concatenaban a mano.

`tests/unit/utils/imageUrl.test.js` fija ese comportamiento: cada una de las rutas
problemáticas hace *round-trip* exacto.

## Efecto secundario: miniaturas

El mismo protocolo acepta un parámetro `size`, y el proceso principal responde con
una miniatura cacheada en lugar de la foto original. Ver `src/main/thumbnailService.js`.

Esto resolvió el otro hallazgo grande de la auditoría: un indicador de 32 px
descargaba y decodificaba el JPEG completo. Medido sobre el proyecto real, las
fotos capturadas son de 694×925 px y 946 KB de media, y su miniatura de 128 px ocupa
2,5 KB: **376 veces menos bytes** por imagen, y una fracción de la memoria de
decodificación.

## Control de acceso

El manejador lee archivos del disco a petición del renderer, así que solo sirve rutas
dentro de las carpetas del proyecto: `imports`, `ingest`, el espejo local y el
depósito configurado. Cualquier otra ruta se rechaza con un aviso en el log.
Cubierto en `tests/unit/main/imageProtocol.test.js`.

## Pendiente menor

La caché de miniaturas no se poda nunca. Está en
`%APPDATA%/Edu User Capture/thumbnail-cache`, con una entrada por combinación de
ruta, fecha de modificación y tamaño, así que reemplazar una foto deja huérfana la
miniatura anterior. En uso real son unos pocos MB, pero crece de forma monótona.
