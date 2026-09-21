/**
 * Tests for PendingRequestsModal
 *
 * The window that offers to archive card and publication requests. What
 * matters is that it lists what the review found under the right heading,
 * that nothing is ticked until the user ticks it, and that closing it
 * archives nothing.
 */

const { PendingRequestsModal } = require('../../../../src/renderer/components/modals/PendingRequestsModal');

describe('PendingRequestsModal', () => {
  let modal;

  const review = {
    success: true,
    academicYear: 2026,
    cards: {
      folder: 'G:\\Fotos\\To-Print-ID',
      total: 4,
      others: [
        { id: '9998', file: '9998', requestedAt: new Date(2026, 4, 2).getTime() },
        { id: '9999', file: '9999', requestedAt: new Date(2026, 5, 15).getTime() }
      ],
      previousCourse: [
        { id: '1001', file: '1001', requestedAt: new Date(2026, 5, 20).getTime(), name: 'GARCIA LOPEZ, ANA', group: 'Primero ESO A' }
      ]
    },
    publications: {
      folder: 'G:\\Fotos\\To-Publish',
      total: 1,
      others: [{ id: '7777', file: '7777.jpg', requestedAt: new Date(2026, 5, 1).getTime() }],
      previousCourse: []
    }
  };

  const archiveBtn = () => document.getElementById('archive-pending-requests-btn');
  const section = (key) => document.querySelector(`.pending-requests-section[data-section="${key}"]`);
  const boxes = (key) => [...section(key).querySelectorAll('.pending-requests-list input[type="checkbox"]')];
  const selectAll = (key) => section(key).querySelector('.pending-requests-select-all');
  const kindButton = (kind) => document.querySelector(`#pending-requests-kind [data-kind="${kind}"]`);
  const tick = (box, checked = true) => {
    box.checked = checked;
    box.dispatchEvent(new Event('change'));
  };

  // show() resolves only when the window closes, so it is not awaited
  const open = (result = review) => {
    window.electronAPI = { reviewPendingRequests: jest.fn().mockResolvedValue(result) };
    return modal.show();
  };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = `
      <div id="pending-requests-modal" class="modal">
        <div id="pending-requests-summary"></div>
        <div id="pending-requests-kind" hidden>
          <button type="button" data-kind="cards">Carnets</button>
          <button type="button" data-kind="publications">Publicaciones</button>
        </div>
        <div id="pending-requests-lists"></div>
        <button id="archive-pending-requests-btn" disabled>Archivar</button>
        <button id="cancel-pending-requests-btn" data-modal-cancel>Cerrar</button>
      </div>
    `;

    modal = new PendingRequestsModal();
    modal.init();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.electronAPI;
  });

  test('should say which course the dates are measured against', async () => {
    open();
    await flush();

    const summary = document.getElementById('pending-requests-summary').textContent;
    expect(summary).toContain('2026-2027');
    expect(summary).toContain('1 de septiembre de 2026');
  });

  test('should list each request under its heading', async () => {
    open();
    await flush();

    expect(section('others').textContent).toContain('(2)');
    expect(section('others').textContent).toContain('9998');
    expect(section('previousCourse').textContent).toContain('GARCIA LOPEZ, ANA');
    expect(section('previousCourse').textContent).toContain('Primero ESO A');
  });

  test('should show how many there are of each kind', async () => {
    open();
    await flush();

    expect(kindButton('cards').textContent).toBe('Carnets (3)');
    expect(kindButton('publications').textContent).toBe('Publicaciones (1)');
    expect(kindButton('cards').classList.contains('is-active')).toBe(true);
  });

  test('should open on publications when there are no cards to review', async () => {
    open({ ...review, cards: { folder: '', total: 0, others: [], previousCourse: [] } });
    await flush();

    expect(kindButton('publications').classList.contains('is-active')).toBe(true);
    expect(section('others').textContent).toContain('7777');
  });

  test('should start with nothing ticked', async () => {
    open();
    await flush();

    expect(boxes('others').some((box) => box.checked)).toBe(false);
    expect(archiveBtn().disabled).toBe(true);
  });

  test('should tick a whole section at once', async () => {
    open();
    await flush();

    tick(selectAll('others'));

    expect(boxes('others').every((box) => box.checked)).toBe(true);
    expect(archiveBtn().textContent).toBe('Archivar (2)');
  });

  test('should return the ticked files of both kinds', async () => {
    const shown = open();
    await flush();

    tick(boxes('previousCourse')[0]);
    kindButton('publications').click();
    tick(boxes('others')[0]);
    archiveBtn().click();

    await expect(shown).resolves.toEqual({ cards: ['1001'], publications: ['7777.jpg'] });
  });

  test('should keep what was ticked when switching kinds', async () => {
    open();
    await flush();

    tick(boxes('others')[1]);
    kindButton('publications').click();
    kindButton('cards').click();

    expect(boxes('others')[1].checked).toBe(true);
    expect(selectAll('others').indeterminate).toBe(true);
  });

  test('should archive nothing when closed', async () => {
    const shown = open();
    await flush();

    tick(selectAll('others'));
    document.getElementById('cancel-pending-requests-btn').click();

    await expect(shown).resolves.toBeNull();
  });

  test('should say so when the repository cannot be read', async () => {
    open({ success: false, error: 'No se ha configurado la ruta del depósito de imágenes' });
    await flush();

    expect(document.getElementById('pending-requests-summary').textContent).toContain('depósito');
    expect(document.getElementById('pending-requests-kind').hidden).toBe(true);
    expect(archiveBtn().disabled).toBe(true);
  });

  test('should say there are none in an empty section', async () => {
    open();
    await flush();
    kindButton('publications').click();

    expect(section('previousCourse').textContent).toContain('Ninguna.');
    expect(selectAll('previousCourse').disabled).toBe(true);
  });
});
