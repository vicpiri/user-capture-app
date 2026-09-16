/**
 * Tests for ReplacedArchiveModal
 *
 * The window that offers to purge the repository's replaced photos. What
 * matters is that every cut says exactly what it would delete, that a cut with
 * nothing in it cannot be chosen, and that cancelling deletes nothing.
 */

const { ReplacedArchiveModal } = require('../../../../src/renderer/components/modals/ReplacedArchiveModal');

describe('ReplacedArchiveModal', () => {
  let modal;

  const now = new Date(2026, 8, 16, 12, 0, 0);
  const cuts = () => [...document.querySelectorAll('#replaced-archive-cuts .replaced-cut')];
  const cut = (id) => cuts().find((item) => item.dataset.cutId === id);
  const purgeBtn = () => document.getElementById('purge-replaced-archive-btn');

  // Three runs: one over a year old, one of five months, one of last week
  const runs = [
    { name: '20250401100000_SECRETARIA', date: new Date(2025, 3, 1).toISOString(), host: 'SECRETARIA', photos: 40, bytes: 4 * 1024 * 1024 },
    { name: '20260415100000_CONSERJERIA', date: new Date(2026, 3, 15).toISOString(), host: 'CONSERJERIA', photos: 10, bytes: 1024 * 1024 },
    { name: '20260910100000_SECRETARIA', date: new Date(2026, 8, 10).toISOString(), host: 'SECRETARIA', photos: 5, bytes: 512 * 1024 }
  ];

  const scanReturns = (result) => {
    window.electronAPI = {
      scanReplacedArchive: jest.fn().mockResolvedValue(result)
    };
  };

  beforeEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = `
      <div id="replaced-archive-modal" class="modal">
        <div id="replaced-archive-summary"></div>
        <div id="replaced-archive-cuts"></div>
        <p id="replaced-archive-empty" style="display: none;"></p>
        <button id="purge-replaced-archive-btn" disabled>Purgar</button>
        <button id="cancel-replaced-archive-btn" data-modal-cancel>Cancelar</button>
      </div>
    `;

    scanReturns({
      success: true,
      folder: 'G:\\Mi unidad\\Fotos\\Reemplazadas',
      photos: 55,
      bytes: 5.5 * 1024 * 1024,
      strangers: 0,
      runs
    });

    modal = new ReplacedArchiveModal();
    modal.init();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.electronAPI;
  });

  describe('buildCuts()', () => {
    test('counts what each cut would delete', () => {
      const built = ReplacedArchiveModal.buildCuts(runs, now);
      const byId = Object.fromEntries(built.map((entry) => [entry.id, entry]));

      expect(byId.year).toMatchObject({ runs: 1, photos: 40 });
      expect(byId.six).toMatchObject({ runs: 1, photos: 40 });
      expect(byId.three).toMatchObject({ runs: 2, photos: 50 });
      expect(byId.all).toMatchObject({ runs: 3, photos: 55 });
    });

    test('the cut that takes everything has no date', () => {
      const built = ReplacedArchiveModal.buildCuts(runs, now);

      expect(built.find((entry) => entry.id === 'all').before).toBeNull();
      expect(new Date(built.find((entry) => entry.id === 'six').before))
        .toEqual(new Date(2026, 2, 16, 12, 0, 0));
    });

    test('answers zeros for an empty folder', () => {
      expect(ReplacedArchiveModal.buildCuts([], now).every((entry) => entry.photos === 0)).toBe(true);
    });
  });

  describe('show()', () => {
    test('lists the cuts with their photos and picks the safest one', async () => {
      const chosen = modal.show();
      await Promise.resolve();
      await Promise.resolve();

      expect(cuts()).toHaveLength(4);
      expect(cut('all').textContent).toContain('55 fotos');
      // The oldest cut with something in it comes selected
      expect(cut('year').classList.contains('selected')).toBe(true);
      expect(purgeBtn().disabled).toBe(false);

      document.getElementById('cancel-replaced-archive-btn').click();
      await expect(chosen).resolves.toBeNull();
    });

    test('returns the chosen cut', async () => {
      const chosen = modal.show();
      await Promise.resolve();
      await Promise.resolve();

      cut('three').click();
      purgeBtn().click();

      await expect(chosen).resolves.toMatchObject({ id: 'three', photos: 50 });
    });

    test('a cut with nothing in it cannot be chosen', async () => {
      scanReturns({ success: true, folder: 'G:\\x', photos: 5, bytes: 10, strangers: 0, runs: [runs[2]] });
      const chosen = modal.show();
      await Promise.resolve();
      await Promise.resolve();

      expect(cut('year').classList.contains('empty')).toBe(true);
      cut('year').click();
      expect(cut('year').classList.contains('selected')).toBe(false);

      // Only "todas" holds the recent run, and that is what came selected
      expect(cut('all').classList.contains('selected')).toBe(true);

      document.getElementById('cancel-replaced-archive-btn').click();
      await chosen;
    });

    test('says so when there is nothing kept', async () => {
      scanReturns({ success: true, folder: 'G:\\x', photos: 0, bytes: 0, strangers: 0, runs: [] });
      const chosen = modal.show();
      await Promise.resolve();
      await Promise.resolve();

      expect(cuts()).toHaveLength(0);
      expect(document.getElementById('replaced-archive-empty').style.display).toBe('block');
      expect(purgeBtn().disabled).toBe(true);

      document.getElementById('cancel-replaced-archive-btn').click();
      await expect(chosen).resolves.toBeNull();
    });

    test('shows the problem instead of the cuts when the repository cannot be read', async () => {
      scanReturns({ success: false, error: 'No hay ningún depósito de imágenes configurado.' });
      const chosen = modal.show();
      await Promise.resolve();
      await Promise.resolve();

      expect(document.getElementById('replaced-archive-summary').textContent)
        .toContain('No hay ningún depósito');
      expect(purgeBtn().disabled).toBe(true);

      document.getElementById('cancel-replaced-archive-btn').click();
      await expect(chosen).resolves.toBeNull();
    });
  });
});
