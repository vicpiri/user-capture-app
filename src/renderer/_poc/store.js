/**
 * POC: Store Observable Pattern
 *
 * Implementación básica del patrón observable para gestión de estado.
 * Este es el fundamento de la arquitectura del refactor.
 */

class Store {
  constructor() {
    // Estado inicial
    this.state = {
      app: {
        projectOpen: false,
        message: 'Store initialized'
      },
      users: {
        currentUsers: [],
        selectedUser: null
      }
    };

    // Mapa de listeners: key -> Set de callbacks
    this.listeners = new Map();
  }

  /**
   * Obtener estado
   * @param {string} key - Key específica o undefined para todo el estado
   * @returns {object} Estado (inmutable - copia)
   */
  getState(key) {
    if (key) {
      return this.state[key] ? { ...this.state[key] } : undefined;
    }
    return { ...this.state };
  }

  /**
   * Actualizar estado y notificar a suscriptores
   * @param {object} updates - Objeto con keys a actualizar
   */
  setState(updates) {
    // Actualizar estado (inmutabilidad parcial)
    this.state = { ...this.state, ...updates };

    // Notificar a suscriptores de las keys actualizadas
    this.notify(Object.keys(updates));

    console.log('[Store] Estado actualizado:', updates);
  }

  /**
   * Suscribirse a cambios en keys específicas
   * @param {string|string[]} keys - Key o array de keys
   * @param {Function} callback - Función a llamar cuando cambie el estado
   * @returns {Function} Función para desuscribirse
   */
  subscribe(keys, callback) {
    if (!Array.isArray(keys)) {
      keys = [keys];
    }

    // Agregar callback a cada key
    keys.forEach(key => {
      if (!this.listeners.has(key)) {
        this.listeners.set(key, new Set());
      }
      this.listeners.get(key).add(callback);
    });

    console.log('[Store] Nueva suscripción a:', keys);

    // Retornar función de cleanup
    return () => {
      keys.forEach(key => {
        const callbacks = this.listeners.get(key);
        if (callbacks) {
          callbacks.delete(callback);
          console.log('[Store] Desuscrito de:', key);
        }
      });
    };
  }

  /**
   * Notificar a suscriptores de keys específicas
   * @param {string[]} keys - Keys que cambiaron
   */
  notify(keys) {
    keys.forEach(key => {
      const callbacks = this.listeners.get(key);
      if (callbacks && callbacks.size > 0) {
        const partialState = this.state[key];
        const fullState = this.state;

        console.log(`[Store] Notificando ${callbacks.size} listener(s) de '${key}'`);

        callbacks.forEach(callback => {
          try {
            callback(partialState, fullState);
          } catch (error) {
            console.error('[Store] Error en callback:', error);
          }
        });
      }
    });
  }
}

// Exportar instancia única (singleton)
const store = new Store();

// Para debugging en consola
if (typeof window !== 'undefined') {
  window.__store__ = store;
  console.log('[Store POC] Store disponible en window.__store__');
}

// CommonJS export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Store, store };
}
