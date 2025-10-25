/**
 * POC: Service Pattern
 *
 * Ejemplo de servicio que wrappea window.electronAPI
 * Demuestra el patrón que usaremos en todos los servicios.
 */

/**
 * Cargar usuarios (simulado)
 * @param {object} filters - Filtros de búsqueda
 * @returns {Promise<Array>} Lista de usuarios
 */
async function loadUsers(filters = {}) {
  console.log('[TestService] Cargando usuarios con filtros:', filters);

  // En el POC, retornamos datos fake
  // En la implementación real, usaremos window.electronAPI.getUsers()
  return new Promise((resolve) => {
    setTimeout(() => {
      const fakeUsers = [
        { id: 1, name: 'Ana García', group: 'A' },
        { id: 2, name: 'Luis Martínez', group: 'B' },
        { id: 3, name: 'María Rodríguez', group: 'A' }
      ];

      console.log('[TestService] Usuarios cargados:', fakeUsers.length);
      resolve(fakeUsers);
    }, 500); // Simular latencia
  });
}

/**
 * Cargar grupos (simulado)
 * @returns {Promise<Array>} Lista de grupos
 */
async function loadGroups() {
  console.log('[TestService] Cargando grupos');

  return new Promise((resolve) => {
    setTimeout(() => {
      const fakeGroups = [
        { code: 'A', name: 'Grupo A' },
        { code: 'B', name: 'Grupo B' }
      ];

      console.log('[TestService] Grupos cargados:', fakeGroups.length);
      resolve(fakeGroups);
    }, 300);
  });
}

// Para debugging
if (typeof window !== 'undefined') {
  window.__testService__ = { loadUsers, loadGroups };
  console.log('[TestService POC] Service disponible en window.__testService__');
}

// CommonJS export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadUsers, loadGroups };
}
