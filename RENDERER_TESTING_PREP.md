# Guía Detallada para Preparar Tests del Refactor de renderer.js

## Objetivo
Proveer un plan práctico y detallado para introducir una base de tests que sirva de red de seguridad durante el refactor de `renderer.js`. La intención es cubrir la lógica pura (utils/estado/scroll) y los wrappers de IPC, minimizando el acoplamiento con Electron y el DOM.

## Alcance
- Unit tests para módulos puros: `utils`, parte de `state`, y funciones de cálculo (p. ej., virtual scroll).
- Tests de wrappers IPC en `services` con `window.electronAPI` mockeado.
- Quedan fuera por ahora: tests de UI profunda (DOM complejo) y E2E con Electron; se podrán añadir luego si es necesario.

## Estructura recomendada
- Ubicar tests en `src/**/__tests__` o en `tests/` (cualquiera es válida; se recomienda `tests/` para separar refactor de código existente).
- Propuesta inicial:
  - `tests/setup/jest.setup.js` — setup global (mocks, polyfills, timers).
  - `tests/setup/electronAPI.mock.js` — mock de `window.electronAPI`.
  - `tests/unit/utils/*.test.js` — tests de utilidades.
  - `tests/unit/state/*.test.js` — tests del store/estado.
  - `tests/unit/scroll/*.test.js` — tests de virtual scroll/lazy.
  - `tests/unit/services/*.test.js` — tests de wrappers IPC.

## Dependencias necesarias
Añadir Jest y entorno JSDOM para tests que toquen DOM de forma ligera.

Comandos (documentación, no ejecutados automáticamente):
- `npm i -D jest jest-environment-jsdom`
- Opcional si se usan funciones modernas a transformar: `npm i -D babel-jest @babel/core @babel/preset-env` (no imprescindible si el código es CommonJS y compatible con Node actual).

## Scripts en package.json
Añadir:
- `"test": "jest"`
- `"test:watch": "jest --watch"`
- Opcional: `"test:coverage": "jest --coverage --collectCoverageFrom=\"src/**/*.{js,cjs}\""`

## Configuración de Jest
Archivo recomendado: `jest.config.cjs` (CommonJS):

```js
/** @type {import('jest').Config} */
module.exports = {
  testMatch: [
    "<rootDir>/tests/**/*.test.js",
    "<rootDir>/src/**/__tests__/**/*.test.js"
  ],
  testEnvironment: 'jsdom', // por defecto; se puede sobreescribir por archivo
  setupFilesAfterEnv: ["<rootDir>/tests/setup/jest.setup.js"],
  // Si no se usa Babel, dejar transform vacío; si se usa:
  // transform: { '^.+\\.js$': ['babel-jest', { presets: ['@babel/preset-env'] }] },
  moduleFileExtensions: ['js', 'cjs', 'json'],
  clearMocks: true,
};
```

## Setup y mocks globales
- Crear `tests/setup/jest.setup.js` con la inicialización de mocks reutilizables.
- Mock de `window.electronAPI` con una pequeña clase basada en EventEmitter.

`tests/setup/electronAPI.mock.js`:

```js
const { EventEmitter } = require('events');

class ElectronAPIMock extends EventEmitter {
  constructor() {
    super();
    // Métodos típicos expuestos vía preload; adaptar según el proyecto real
    this.invoke = jest.fn(async (channel, ...args) => ({ channel, args }));
    this.send = jest.fn();
    // Ejemplo de API específica
    this.openProject = jest.fn(async (path) => ({ ok: true, path }));
    this.exportCsv = jest.fn(async (opts) => ({ ok: true, opts }));
  }
  // Patrón común para eventos
  onEvent(event, listener) { this.on(event, listener); return () => this.off(event, listener); }
}

function installOnWindow() {
  if (!global.window) global.window = {};
  global.window.electronAPI = new ElectronAPIMock();
  return global.window.electronAPI;
}

module.exports = { installOnWindow };
```

`tests/setup/jest.setup.js`:

```js
const { installOnWindow } = require('./electronAPI.mock');

// Instalar mock de electronAPI en el entorno JSDOM
installOnWindow();

// Timers falsos útiles para debounce/throttle
jest.useFakeTimers();

// Utilidad para avanzar timers en tests
global.advanceAll = async () => {
  jest.runOnlyPendingTimers();
  await Promise.resolve();
};
```

Notas:
- Para tests que no necesiten DOM, se puede forzar `@jest-environment node` como cabecera del archivo de test.

## Plantillas de tests por módulo
Ajustar nombres según las funciones reales que se extraigan en el refactor.

### 1) Utils: filtros
Ruta sugerida del módulo: `src/renderer/utils/filterHelpers.js`.

`tests/unit/utils/filterHelpers.test.js`:

```js
// @jest-environment node
const { filterUsers } = require('../../../src/renderer/utils/filterHelpers');

describe('filterUsers', () => {
  const users = [
    { id: 1, name: 'Ana Gómez', group: 'A', hasCaptured: true, inRepo: false },
    { id: 2, name: 'Luis Pérez', group: 'B', hasCaptured: false, inRepo: true },
    { id: 3, name: 'Ana María', group: 'A', hasCaptured: true, inRepo: true },
  ];

  test('filtra por texto (case-insensitive, acentos)', () => {
    const res = filterUsers(users, { text: 'ana' });
    expect(res.map(u => u.id)).toEqual([1, 3]);
  });

  test('filtra por grupos múltiples', () => {
    const res = filterUsers(users, { groups: new Set(['B']) });
    expect(res.map(u => u.id)).toEqual([2]);
  });

  test('combina flags de capturadas/repositorio', () => {
    const res = filterUsers(users, { showCaptured: true, showRepository: true });
    expect(res.map(u => u.id)).toEqual([1, 2, 3]);
  });

  test('aplica composición de filtros', () => {
    const res = filterUsers(users, { text: 'ana', groups: new Set(['A']), showCaptured: true });
    expect(res.map(u => u.id)).toEqual([1, 3]);
  });
});
```

### 2) State: selección múltiple
Ruta sugerida: `src/renderer/state/selectionState.js`.

`tests/unit/state/selectionState.test.js`:

```js
// @jest-environment node
const { createSelectionState } = require('../../../src/renderer/state/selectionState');

describe('selectionState', () => {
  test('toggle y clear', () => {
    const st = createSelectionState();
    st.toggle(1); st.toggle(2);
    expect(st.isSelected(1)).toBe(true);
    expect(st.isSelected(2)).toBe(true);
    st.toggle(1);
    expect(st.isSelected(1)).toBe(false);
    st.clear();
    expect(st.size()).toBe(0);
  });

  test('modo selección on/off', () => {
    const st = createSelectionState();
    expect(st.isActive()).toBe(false);
    st.enable();
    expect(st.isActive()).toBe(true);
    st.disable();
    expect(st.isActive()).toBe(false);
  });
});
```

### 3) Virtual scroll: cálculo de rango visible
Ruta sugerida: `src/renderer/ui/table/virtualScroll.js`.

`tests/unit/scroll/virtualScroll.test.js`:

```js
// @jest-environment node
const { getVisibleRange } = require('../../../src/renderer/ui/table/virtualScroll');

describe('getVisibleRange', () => {
  test('calcula índices visibles con buffer', () => {
    const res = getVisibleRange({
      total: 1000,
      itemHeight: 32,
      containerHeight: 320,
      scrollTop: 160,
      overscan: 3,
    });
    expect(res.start).toBeGreaterThanOrEqual(2);
    expect(res.end - res.start).toBeGreaterThan(10);
  });

  test('no excede límites', () => {
    const res = getVisibleRange({ total: 50, itemHeight: 40, containerHeight: 400, scrollTop: 10, overscan: 2 });
    expect(res.start).toBe(0);
    expect(res.end).toBeLessThanOrEqual(50);
  });
});
```

### 4) Export consolidado: paridad con funciones actuales
Ruta sugerida: `src/renderer/ui/modals/exportOptionsModal.js`.

`tests/unit/utils/exportOptions.test.js`:

```js
// @jest-environment node
const { buildExportOptions } = require('../../../src/renderer/ui/modals/exportOptionsModal');

describe('buildExportOptions', () => {
  test.each([
    [{ type: 'csv', includeHeaders: true }, { type: 'csv', includeHeaders: true }],
    [{ type: 'images', quality: 90 }, { type: 'images', quality: 90 }],
    [{ type: 'both', includeHeaders: false, quality: 80 }, { type: 'both', includeHeaders: false, quality: 80 }],
  ])('normaliza %j', (input, expected) => {
    expect(buildExportOptions(input)).toEqual(expected);
  });
});
```

### 5) Services (wrappers IPC)
Ruta sugerida: `src/renderer/services/userService.js`.

`tests/unit/services/userService.test.js`:

```js
// Usa jsdom (por defecto) para tener window
const userService = require('../../../src/renderer/services/userService');

describe('userService', () => {
  test('delegación a window.electronAPI', async () => {
    const res = await userService.fetchUsers({ group: 'A' });
    expect(window.electronAPI.invoke).toHaveBeenCalled();
    expect(res).toHaveProperty('channel'); // según el mock por defecto
  });

  test('propaga errores con mensaje claro', async () => {
    window.electronAPI.invoke.mockRejectedValueOnce(new Error('IPC fail'));
    await expect(userService.fetchUsers({})).rejects.toThrow('IPC fail');
  });
});
```

## Consejos prácticos
- DI (inyección de dependencias): pasar funciones externas como parámetros cuando sea posible (p. ej., logger, tiempo actual, IPC), facilita mocks.
- Debounce/throttle: usar `jest.useFakeTimers()` y `advanceAll()` para testear sin esperas reales.
- Tests pequeños y específicos: validan la lógica que más riesgo tiene al moverse de `renderer.js`.
- Evitar snapshots frágiles; preferir aserciones explícitas.

## Plan de adopción incremental
1. Preparar Jest y mocks (este documento).
2. Al extraer cada módulo en las Fases 2–6, añadir su test correspondiente (strangler pattern).
3. Anclar rendimiento: antes de Fase 4 (tabla), registrar métricas manuales y compararlas tras la extracción.
4. Mantener la suite rápida (<2s) para que se ejecute continuamente durante el refactor.

## Criterios de éxito
- Tests corren con `npm test` y fallan cuando se rompe la lógica clave.
- Cobertura mínima en utilidades críticas (filtros, selección, scroll) y servicios IPC.
- Mocks de `window.electronAPI` suficientes para poder refactorizar sin Electron en ejecución.

## Preguntas a resolver antes de implementar
- ¿Se usará CommonJS sin transpilar o se necesita Babel por características modernas?
- ¿Cuál es la API exacta expuesta por `window.electronAPI` en este proyecto (nombres de canales y métodos)?
- ¿Dónde residirá el “store” de estado y cuál será su API (getters/setters/eventos)?

---
Con esta preparación, puedes iniciar el refactor con una red de seguridad mínima pero efectiva. Si lo deseas, puedo generar los archivos base (`jest.config.cjs`, `tests/setup/*`) y añadir 2–3 pruebas iniciales de ejemplo.

