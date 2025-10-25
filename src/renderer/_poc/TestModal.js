/**
 * POC: BaseModal Pattern
 *
 * Clase base para modales con lifecycle management
 * Demuestra el patrón de init/destroy para prevenir memory leaks
 */

class BaseModal {
  constructor(modalId) {
    this.modalId = modalId;
    this.modal = document.getElementById(modalId);

    if (!this.modal) {
      console.warn(`[BaseModal] Modal con id '${modalId}' no encontrado`);
      return;
    }

    // Array para trackear listeners
    this.listeners = [];

    // Referencia a unsubscribe del store
    this.unsubscribe = null;

    console.log(`[BaseModal] Modal '${modalId}' construido`);
  }

  /**
   * Inicializar modal (sobrescribir en subclases)
   */
  init() {
    console.log(`[BaseModal] init() llamado en '${this.modalId}'`);
  }

  /**
   * Abrir modal
   */
  open() {
    if (!this.modal) return;
    this.modal.classList.add('show');
    console.log(`[BaseModal] Modal '${this.modalId}' abierto`);
  }

  /**
   * Cerrar modal
   */
  close() {
    if (!this.modal) return;
    this.modal.classList.remove('show');
    console.log(`[BaseModal] Modal '${this.modalId}' cerrado`);
  }

  /**
   * Agregar event listener con tracking
   * @param {HTMLElement} element - Elemento DOM
   * @param {string} event - Nombre del evento
   * @param {Function} handler - Handler function
   */
  addEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    this.listeners.push({ element, event, handler });
    console.log(`[BaseModal] Listener agregado: ${event} en ${element.tagName}`);
  }

  /**
   * Destruir modal y limpiar recursos
   * CRÍTICO para prevenir memory leaks
   */
  destroy() {
    console.log(`[BaseModal] Destruyendo modal '${this.modalId}'`);

    // Limpiar todos los event listeners
    this.listeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.listeners = [];

    // Limpiar suscripción al store
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    console.log(`[BaseModal] Modal '${this.modalId}' destruido`);
  }
}

/**
 * Modal de prueba que extiende BaseModal
 */
class TestModal extends BaseModal {
  constructor() {
    super('test-modal-poc');
    this.messageEl = null;
    this.openBtn = null;
    this.closeBtn = null;
  }

  init() {
    super.init();

    if (!this.modal) {
      console.warn('[TestModal] No se puede inicializar - modal no existe');
      return;
    }

    // Buscar elementos
    this.messageEl = this.modal.querySelector('.modal-message');
    this.openBtn = document.getElementById('open-test-modal-btn');
    this.closeBtn = this.modal.querySelector('.close-btn');

    // Setup listeners usando addEventListener trackeable
    if (this.openBtn) {
      this.addEventListener(this.openBtn, 'click', () => {
        this.showMessage('¡Modal de prueba funcionando!');
        this.open();
      });
    }

    if (this.closeBtn) {
      this.addEventListener(this.closeBtn, 'click', () => {
        this.close();
      });
    }

    console.log('[TestModal] Inicializado correctamente');
  }

  showMessage(message) {
    if (this.messageEl) {
      this.messageEl.textContent = message;
    }
  }
}

// Para debugging
if (typeof window !== 'undefined') {
  window.__BaseModal__ = BaseModal;
  window.__TestModal__ = TestModal;
  console.log('[Modal POC] BaseModal y TestModal disponibles en window');
}

// CommonJS export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BaseModal, TestModal };
}
