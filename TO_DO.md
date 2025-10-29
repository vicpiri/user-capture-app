# Lista de Tareas Pendientes

## Funcionalidades Futuras

### 1. Sistema de Petición de Carnets
Crear un sistema que permita a los usuarios solicitar carnets de forma organizada.

**Flujo:**
- El usuario selecciona en el menú contextual de la lista de usuarios 'Solicitar impresión de carnet'.
- Se procede a la solicitud de todos los usuarios seleccionados.
- Se generará un archivo con el ID para cada uno de los usuarios seleccionados en una carpeta contenida en el mismo depósito llamada 'To-Print-ID'.
- El nombre de los archivos será el ID del usuario.
- Cada vez que se refresque la visualización de las imágenes del depósito se buscarán los archivos en la carpeta 'To-Print-ID'. Si hay archivos presentes, aparecerá un icono de 'ID card' en la fila correspondiente de la lista (Optimizar este proceso para mejorar los tiempos de carga. Hay que tener en cuenta que la carpeta del depósito suele ser de Google Drive, One Drive, etc.).
- Cuando un archivo desaparezca de la carpeta, se eliminará el icono en el próximo refresco de pantalla.
- Añadir en el menú Ver la activación de un filtro para mostrar la lista del de usuarios pendientes impresión del carnet (la lista de usuarios con archivo en la carpeta 'To-Print-ID').

**Prioridad:** Media

---

### 2. Sistema de Petición de Publicación Oficial
Crear un sistema que gestione las solicitudes de publicación oficial de fotografías.

**Flujo:**
- El usuario selecciona en el menú contextual de la lista de usuarios 'Solicitar Petición Oficial'.
- Se procede a la solicitud de todos los usuarios seleccionados.
- Se copian las imágenes del depósito de los usuarios seleccionados en una carpeta contenida en el mismo depósito llamada 'To-Publish'.
- El nombre de los archivos copiados será el ID del usuario.
- Cada vez que se refresque la visualización de las imágenes del depósito se buscarán las imágenes en la carpeta 'To-Publish'. Si hay una imagen presente, aparecerá un icono de 'Upload' en la fila correspondiente de la lista (Optimizar este proceso para mejorar los tiempos de carga. Hay que tener en cuenta que la carpeta del depósito suele ser de Google Drive, One Drive, etc.).
- Cuando una imagen desaparezca de la carpeta, se eliminará el icono en el próximo refresco de pantalla.
- Añadir en el menú Ver la activación de un filtro para mostrar la lista del de usuarios pendientes de publicación (la lista de usuarios con imagen en la carpeta 'To-Publish').

**Prioridad:** Media

---

## Notas
- Estas funcionalidades están pendientes de análisis detallado de requisitos
- Se requiere definir flujo de trabajo completo antes de implementación
- Considerar integración con sistemas de terceros si es necesario
