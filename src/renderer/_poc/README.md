# 🧪 POC - Proof of Concept de Arquitectura de Refactorización

## ¿Qué es esto?

Este es un **Proof of Concept (POC)** para validar la arquitectura propuesta en el refactor de `renderer.js`.

Demuestra los 3 pilares fundamentales de la nueva arquitectura:
1. **Store Observable** - Gestión de estado centralizada con suscripciones reactivas
2. **Service Pattern** - Servicios que wrappean window.electronAPI
3. **BaseModal con Lifecycle** - Componentes UI con init/destroy para prevenir memory leaks

## 🚀 Cómo Probar

### Método 1: Desde el Menú (Recomendado)

1. Iniciar aplicación en modo desarrollo:
   ```bash
   npm run dev
   ```

2. En el menú de la aplicación:
   ```
   Developers → Abrir POC (Refactor Test)
   ```
   O presiona: `Ctrl+Shift+P`

3. Se abrirá el archivo POC en tu navegador predeterminado

### Método 2: Abrir Directamente

Abrir el archivo en cualquier navegador:
```
D:\Proyectos Git\user-capture-app\src\renderer\_poc\poc-test.html
```

## 📋 Qué Probar

### 1. Store Observable

**Objetivo:** Validar que el patrón observable funciona

1. Haz clic en "Probar Store"
   - ✅ Debe mostrar estado inicial y actualizado
   - ✅ Debe aparecer en consola

2. Haz clic en "Actualizar Estado"
   - ✅ Debe actualizar con valores aleatorios
   - ✅ Display debe mostrar nuevo estado

3. Haz clic en "Suscribirse a Cambios"
   - ✅ Debe mostrar mensaje de suscripción
   - Ahora haz clic en "Actualizar Estado" de nuevo
   - ✅ Debe aparecer notificación "🔔 Notificación de cambio"

### 2. Service Pattern

**Objetivo:** Validar que los servicios funcionan correctamente

1. Haz clic en "Cargar Usuarios"
   - ✅ Debe mostrar loading
   - ✅ Después de 500ms debe mostrar 3 usuarios fake
   - ✅ Consola debe mostrar logs del servicio

2. Haz clic en "Cargar Grupos"
   - ✅ Debe mostrar 2 grupos (A y B)
   - ✅ Consola debe mostrar logs

### 3. BaseModal Lifecycle

**Objetivo:** Validar init/destroy y prevención de memory leaks

1. **Modal Auto-Inicializado:**
   - Al cargar la página, el modal se auto-inicializa
   - Estado debe mostrar "OK"

2. Haz clic en "Abrir Modal"
   - ✅ Debe aparecer modal con mensaje
   - ✅ Clic en "Cerrar" debe cerrar el modal

3. Haz clic en "Destruir Modal"
   - ✅ Consola debe mostrar "Modal destruido"
   - ✅ Estado debe cambiar a "Pendiente"
   - Ahora haz clic en "Abrir Modal"
   - ✅ No debe funcionar (modal destruido)

4. Haz clic en "Inicializar Modal"
   - ✅ Modal vuelve a funcionar
   - Prueba "Abrir Modal" de nuevo
   - ✅ Debe funcionar correctamente

## ✅ Criterios de Éxito

### Store Observable
- [x] getState() retorna estado correctamente
- [x] setState() actualiza estado
- [x] subscribe() registra listeners
- [x] notify() notifica a suscriptores
- [x] unsubscribe() limpia suscripciones

### Service Pattern
- [x] loadUsers() retorna Promise con datos
- [x] loadGroups() retorna Promise con datos
- [x] Simula latencia (asincronía)
- [x] Logs en consola funcionan

### BaseModal
- [x] Constructor encuentra elementos DOM
- [x] init() registra event listeners
- [x] open/close funciona
- [x] addEventListener trackea listeners
- [x] destroy() limpia listeners
- [x] destroy() limpia suscripciones store

## 🔍 Debugging

### Herramientas Disponibles

Abre la consola del navegador (F12) y tendrás acceso a:

```javascript
// Store
window.__store__.getState()
window.__store__.setState({ app: { message: 'test' } })

// Services
window.__testService__.loadUsers()
window.__testService__.loadGroups()

// Modal Classes
window.__BaseModal__
window.__TestModal__
```

### Logs

Todos los componentes tienen logging detallado:
- `[Store]` - Operaciones del store
- `[TestService]` - Llamadas a servicios
- `[BaseModal]` - Lifecycle de modales
- `[TestModal]` - Operaciones específicas del modal de prueba

## 📊 Estructura de Archivos

```
_poc/
├── README.md              # Este archivo
├── poc-test.html          # HTML de prueba con estilos
├── store.js               # Store observable
├── testService.js         # Servicio de prueba
├── TestModal.js           # BaseModal + TestModal
└── poc-main.js            # Orquestación de la demo
```

## 🎯 Próximos Pasos

Si el POC funciona correctamente:

1. ✅ Arquitectura validada
2. ✅ Patrón observable funciona
3. ✅ Lifecycle de componentes OK
4. ✅ No hay errores en consola

**Entonces podemos proceder con:**
- Fase 1: Preparación (estructura de carpetas)
- Fase 2: Services (implementación real)
- Fase 3: State (migrar estado de renderer.js)
- Fase 4: Utils
- Fase 5: Modales
- Fase 6: Tabla
- ...

## ⚠️ Notas Importantes

### Este es un POC, no código de producción

- Los servicios retornan datos fake (no IPC real)
- El HTML está autocontenido (no usa preload.js)
- Es solo para validar PATRONES, no funcionalidad real

### Diferencias con Implementación Real

| POC | Implementación Real |
|-----|---------------------|
| Datos fake | window.electronAPI |
| setTimeout | IPC async real |
| HTML standalone | Integrado en renderer.html |
| Scripts inline | Módulos separados |
| Sin ES Modules | CommonJS o ES Modules |

## 🐛 Problemas Comunes

### "Modal no se abre"
- Verifica que está inicializado (estado = OK)
- Mira la consola para errores

### "No veo notificaciones"
- Asegúrate de hacer clic en "Suscribirse a Cambios" primero
- Luego actualiza el estado

### "Consola vacía"
- Abre DevTools del navegador (F12)
- Pestaña "Console"

---

**Versión:** 1.0 (POC Fase 0)
**Fecha:** 2025-10-25
**Estado:** Listo para pruebas
