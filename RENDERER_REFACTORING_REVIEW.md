# Informe de Revisión del Plan de Refactorización de renderer.js

## Resumen ejecutivo
El plan propuesto es sólido: segmenta por responsabilidad (state/ui/handlers/services/utils), mantiene la compatibilidad con `preload`/IPC y prioriza la extracción de UI pesada (tabla y modales). Los principales riesgos están en definir el sistema de módulos del renderer, evitar dependencias circulares y asegurar limpieza de listeners y rendimiento tras extraer virtual scroll y lazy loading. Con pequeños ajustes de orden y contratos entre capas, reduce riesgo y acelera adopción.

## Puntos fuertes
- Partición clara por responsabilidad alineada con la estructura `src/renderer`.
- Enfoque en estado y extracción de modales/tabla: ataca la mayor complejidad.
- Compatibilidad con `window.electronAPI` e IPC preservada.
- Compromiso con DRY en exportaciones (consolidación en función parametrizada).
- Fases ordenadas con cierre en validación (funcionalidad, rendimiento, regresiones).

## Riesgos y vacíos a cerrar
- Sistema de módulos sin concretar: definir si se usará CommonJS (con `nodeIntegration`), ES Modules (`<script type="module">`) o bundler (Webpack/Vite/Rollup). Incluir criterios de aceptación y verificación con `npm start`/`npm run dev`.
- Dependencias circulares `handlers` ↔ `state` ↔ `ui`: establecer contratos para evitar ciclos.
- Limpieza de listeners y ciclos de vida de componentes (modales, tabla, scroll/lazy): requerir `init()`/`destroy()`.
- Orden de inicialización del estado: migración progresiva por feature para evitar bugs sutiles.
- Rendimiento de tabla tras separación: preservar `requestAnimationFrame`, `IntersectionObserver`, y `debounce/throttle` configurables.
- Ausencia de pruebas: riesgo de regresiones al mover lógica.

## Ajustes recomendados al plan
- Fase 1 (Preparación):
  - Decidir sistema de módulos y validarlo end-to-end en dev.
  - Añadir barrels opcionales por carpeta (`state/index.js`, `ui/index.js`) para rutas estables.
  - Definir contrato del store (API, eventos de cambio) y políticas de inmutabilidad.
- Reordenar extracción (bajo riesgo → alto impacto):
  1) `services/` (wrappers IPC) y `state/` (store central observable).
  2) `ui/modals` con base común (factory/clase con `open/close/destroy`).
  3) `utils/` y `filters` (módulos puros y testeables).
  4) Tabla: separar `virtualScroll` y `lazyLoading` primero, luego `userTable` y `userRow`.
  5) `handlers` por dominio, orquestando `services` y `state`.
- Control de regresiones: checklist por feature (proyecto, import/export, etiquetas, preview, selección múltiple) y comparación de rendimiento antes/después de Fase 4.

## Contratos y límites entre capas
- services: sólo IPC/preload y operaciones de datos; no tocan DOM; devuelven Promises.
- state (store): fuente única de verdad; expone getters, setters y suscripción a cambios; no conoce UI.
- handlers: orquestan interacciones usuario/IPC; no almacenan estado interno duradero; usan el store.
- ui: manipulación del DOM; recibe dependencias por parámetro (DI simple) y se suscribe al store; implementa `init()`/`destroy()` y limpia listeners.

## Rendimiento y limpieza de listeners
- Tabla: pintar con `requestAnimationFrame`, medir y ajustar batch size; `IntersectionObserver` para lazy load; `debounce/throttle` para scroll/resize.
- Modales: un contenedor reutilizable, inserción/remoción eficiente; evitar reflows innecesarios.
- Event listeners: centralizar delegación cuando aplique; registrar y retirar en `destroy()` para evitar memory leaks.

## Pruebas y validación
- Añadir Jest básico para módulos puros (`utils`, parte de `state`, lógica de tabla sin DOM) con mocks de `window.electronAPI`.
- Pruebas manuales guiadas por checklist de features críticas.
- Medición ligera de rendimiento (tiempos de render y FPS) antes/después de la Fase 4.

## Estimación
- 10–15 horas si el sistema de módulos ya es compatible (CommonJS/require). Si se introduce bundler o ES Modules en renderer, sumar 3–5 horas para build, rutas y hot-reload.

## Siguientes pasos propuestos
- Crear esqueleto mínimo:
  - `src/renderer/state/appState.js`: store observable simple (suscripción, getters/setters).
  - `src/renderer/ui/modals/confirmModal.js`: base común de modal con `open/close/destroy`.
  - Ajuste mínimo en `renderer.js` para usar los módulos sin romper la API actual.
- Opcional: añadir una prueba Jest para `appState` y una utilidad de filtros.

