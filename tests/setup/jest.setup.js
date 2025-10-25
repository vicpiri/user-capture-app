const { installOnWindow } = require('./electronAPI.mock');

// Instalar mock de electronAPI en el entorno global
const electronAPI = installOnWindow();

// Hacer electronAPI accesible globalmente para tests
global.electronAPI = electronAPI;

// Configurar timers falsos (útil para debounce/throttle)
jest.useFakeTimers();

// Utilidad global para avanzar timers
global.advanceAll = async () => {
  jest.runOnlyPendingTimers();
  await Promise.resolve();
};

// Utilidad global para avanzar timers por milisegundos
global.advanceTimersByTime = async (ms) => {
  jest.advanceTimersByTime(ms);
  await Promise.resolve();
};

// Mock de console.error para tests (evitar ruido)
// Se puede habilitar con verbose: true en tests específicos
global.consoleError = console.error;
console.error = jest.fn((...args) => {
  // Filtrar errores esperados en tests
  const message = args[0]?.toString() || '';
  if (!message.includes('Not implemented: HTMLFormElement.prototype.submit')) {
    global.consoleError(...args);
  }
});

// Mock básico de localStorage (JSDOM no lo tiene completo)
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

global.localStorage = localStorageMock;

// Reset localStorage y mocks entre tests
beforeEach(() => {
  localStorage.clear();
  if (electronAPI && typeof electronAPI.resetAllMocks === 'function') {
    electronAPI.resetAllMocks();
  }
});

// Cleanup después de cada test
afterEach(() => {
  jest.clearAllTimers();
});

