/**
 * POC Main Script
 * Orquesta la demostración del POC
 */

// Referencias globales
let testModal = null;
let unsubscribeStore = null;

// Helper para logging en consola personalizada
function log(message, type = 'info') {
  const output = document.getElementById('console-output');
  const logEl = document.createElement('div');
  logEl.className = `log ${type}`;
  logEl.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  output.appendChild(logEl);
  output.scrollTop = output.scrollHeight;

  // También en consola real
  console.log(message);
}

function updateStatus(elementId, status) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = status ? 'OK' : 'Pendiente';
    el.className = status ? 'status success' : 'status pending';
  }
}

// ============================================================================
// SECCIÓN 1: STORE OBSERVABLE
// ============================================================================

document.getElementById('test-store-btn').addEventListener('click', () => {
  log('=== PRUEBA DE STORE ===', 'info');

  // Obtener estado inicial
  const initialState = window.__store__.getState();
  log(`Estado inicial: ${JSON.stringify(initialState)}`, 'info');

  // Actualizar estado
  window.__store__.setState({
    app: { projectOpen: true, message: 'Proyecto de prueba abierto' }
  });

  // Obtener estado actualizado
  const newState = window.__store__.getState('app');
  log(`Estado actualizado: ${JSON.stringify(newState)}`, 'success');

  updateStatus('store-status', true);

  // Mostrar en display
  document.getElementById('state-display').textContent =
    `Estado: ${JSON.stringify(newState, null, 2)}`;
});

document.getElementById('update-state-btn').addEventListener('click', () => {
  const randomValue = Math.floor(Math.random() * 1000);

  window.__store__.setState({
    app: {
      projectOpen: true,
      message: `Actualización ${randomValue}`
    }
  });

  const state = window.__store__.getState('app');
  log(`Estado actualizado: ${state.message}`, 'success');

  document.getElementById('state-display').textContent =
    `Estado: ${JSON.stringify(state, null, 2)}`;
});

document.getElementById('subscribe-btn').addEventListener('click', () => {
  if (unsubscribeStore) {
    log('Ya existe una suscripción activa', 'info');
    return;
  }

  log('Suscribiéndose a cambios en state.app...', 'info');

  unsubscribeStore = window.__store__.subscribe(['app'], (appState, fullState) => {
    log(`🔔 Notificación de cambio: ${appState.message}`, 'success');
    document.getElementById('state-display').textContent =
      `Estado (suscrito): ${JSON.stringify(appState, null, 2)}`;
  });

  log('✅ Suscripción activa. Ahora actualiza el estado para ver la notificación.', 'success');
});

// ============================================================================
// SECCIÓN 2: SERVICE PATTERN
// ============================================================================

document.getElementById('load-users-btn').addEventListener('click', async () => {
  const output = document.getElementById('service-output');
  output.innerHTML = '<div class="log info">Cargando usuarios...</div>';

  log('Llamando a testService.loadUsers()', 'info');

  try {
    const users = await window.__testService__.loadUsers({ group: 'A' });

    log(`✅ Usuarios cargados: ${users.length}`, 'success');

    output.innerHTML = users.map(u =>
      `<div class="log success">• ${u.name} (${u.group})</div>`
    ).join('');

    updateStatus('service-status', true);

    // Actualizar store con usuarios
    window.__store__.setState({
      users: { currentUsers: users }
    });
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'error');
    output.innerHTML = `<div class="log error">Error: ${error.message}</div>`;
  }
});

document.getElementById('load-groups-btn').addEventListener('click', async () => {
  const output = document.getElementById('service-output');
  output.innerHTML = '<div class="log info">Cargando grupos...</div>';

  log('Llamando a testService.loadGroups()', 'info');

  try {
    const groups = await window.__testService__.loadGroups();

    log(`✅ Grupos cargados: ${groups.length}`, 'success');

    output.innerHTML = groups.map(g =>
      `<div class="log success">• ${g.name} (${g.code})</div>`
    ).join('');

    updateStatus('service-status', true);
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'error');
    output.innerHTML = `<div class="log error">Error: ${error.message}</div>`;
  }
});

// ============================================================================
// SECCIÓN 3: BASEMODAL LIFECYCLE
// ============================================================================

document.getElementById('init-modal-btn').addEventListener('click', () => {
  if (testModal) {
    log('Modal ya está inicializado', 'info');
    return;
  }

  log('Inicializando TestModal...', 'info');

  testModal = new window.__TestModal__();
  testModal.init();

  log('✅ Modal inicializado (listeners registrados)', 'success');
  updateStatus('modal-status', true);
});

document.getElementById('destroy-modal-btn').addEventListener('click', () => {
  if (!testModal) {
    log('No hay modal para destruir', 'info');
    return;
  }

  log('Destruyendo TestModal...', 'info');

  testModal.destroy();
  testModal = null;

  log('✅ Modal destruido (listeners limpiados)', 'success');
  updateStatus('modal-status', false);
});

// ============================================================================
// CONSOLA
// ============================================================================

document.getElementById('clear-console-btn').addEventListener('click', () => {
  document.getElementById('console-output').innerHTML =
    '<div class="log info">[POC] Consola limpiada...</div>';
});

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  log('=== POC INICIADO ===', 'success');
  log('Store disponible en: window.__store__', 'info');
  log('TestService disponible en: window.__testService__', 'info');
  log('BaseModal disponible en: window.__BaseModal__', 'info');
  log('TestModal disponible en: window.__TestModal__', 'info');
  log('', 'info');
  log('👉 Haz clic en los botones para probar cada componente', 'info');

  // Auto-inicializar modal
  setTimeout(() => {
    log('Auto-inicializando modal de prueba...', 'info');
    testModal = new window.__TestModal__();
    testModal.init();
    log('✅ Modal auto-inicializado', 'success');
    updateStatus('modal-status', true);
  }, 500);
});
