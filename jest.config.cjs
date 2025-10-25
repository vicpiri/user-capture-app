/** @type {import('jest').Config} */
module.exports = {
  testMatch: [
    "<rootDir>/tests/**/*.test.js",
    "<rootDir>/src/**/__tests__/**/*.test.js"
  ],
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ["<rootDir>/tests/setup/jest.setup.js"],

  // === Configuración básica (CommonJS por ahora) ===
  // Cuando migremos a ES Modules, descomentar estas líneas:
  // transform: {},
  // extensionsToTreatAsEsm: ['.js'],
  // moduleNameMapper: {
  //   '^(\\.{1,2}/.*)\\.js$': '$1'
  // },

  moduleFileExtensions: ['js', 'cjs', 'json'],

  // Limpiar mocks automáticamente entre tests
  clearMocks: true,
  // resetMocks: true, // Comentado - resetea la implementación
  // restoreMocks: true, // Comentado - resetea la implementación

  // === Coverage (Cobertura de código) ===
  collectCoverageFrom: [
    'src/renderer/**/*.js',
    '!src/renderer/renderer.js', // Excluir punto de entrada
    '!**/__tests__/**',
    '!**/node_modules/**',
    '!**/*.test.js'
  ],

  // Umbrales de cobertura (empezar bajo, ir aumentando)
  coverageThreshold: {
    global: {
      statements: 50,
      branches: 40,
      functions: 50,
      lines: 50
    }
  },

  // Reportes de cobertura
  coverageReporters: ['text', 'lcov', 'html'],

  // Timeout por defecto
  testTimeout: 10000,

  // Verbose para más información durante tests
  verbose: true
};

