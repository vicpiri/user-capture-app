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
    'src/main/**/*.js',
    // Puntos de entrada y orquestación: no son testeables por unidad tal como
    // están, porque montan la aplicación entera al cargarse
    '!src/renderer/renderer.js',
    // Prueba de concepto abierta desde el menú Developers, no es código de la app
    '!src/renderer/_poc/**',
    '!**/__tests__/**',
    '!**/node_modules/**',
    '!**/*.test.js'
  ],

  // Umbrales de cobertura: actúan de trinquete, no de objetivo. Se fijan algo
  // por debajo de lo medido hoy para que fallen cuando la cobertura baje, no de
  // forma permanente; un umbral que falla siempre se acaba ignorando.
  // Medido al fijarlos: global 47.6% sentencias, src/main 41.1%.
  coverageThreshold: {
    global: {
      statements: 45,
      branches: 43,
      functions: 45,
      lines: 45
    },
    // Suelo propio para el proceso principal, que hasta ahora no se medía
    // (41.1% sentencias, 34.3% ramas al fijarlo)
    './src/main/': {
      statements: 38,
      branches: 32,
      functions: 38,
      lines: 38
    }
  },

  // Reportes de cobertura
  coverageReporters: ['text', 'lcov', 'html'],

  // Timeout por defecto
  testTimeout: 10000,

  // Verbose para más información durante tests
  verbose: true
};

