/**
 * Tests for ThumbnailGridManager (Ver > Vista de miniaturas)
 */

const { ThumbnailGridManager } = require('../../../src/renderer/components/ThumbnailGridManager');

describe('ThumbnailGridManager', () => {
  let manager;
  let config;
  let source;
  let selectionMode;
  let selected;
  let loadingRepository;

  const cards = () => [...document.querySelectorAll('#grid .thumbnail-card')];
  const card = (id) => cards().find((c) => c.dataset.userId === String(id));
  const text = (id, className) => card(id).querySelector(`.${className}`).textContent;

  const ana = { id: 1, first_name: 'ANA', last_name1: 'GARCIA', last_name2: 'LOPEZ', group_code: '1ESOA', image_path: 'C:\\p\\imports\\ana.jpg', repository_image_path: null };
  const luis = { id: 2, first_name: 'LUIS', last_name1: 'PEREZ', last_name2: '', group_code: '1ESOB', image_path: null, repository_image_path: 'C:\\repo\\10000002.jpg' };

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="source">
        <button data-source="captured">Capturadas</button>
        <button data-source="repository">Depósito</button>
      </div>
      <label id="select-all" hidden><input type="checkbox"> Seleccionar todos</label>
      <span id="count"></span>
      <div id="grid"></div>
    `;
    source = 'captured';
    selectionMode = false;
    selected = new Set();
    loadingRepository = false;

    config = {
      grid: document.getElementById('grid'),
      countEl: document.getElementById('count'),
      sourceButtons: document.getElementById('source'),
      selectAllLabel: document.getElementById('select-all'),
      getSource: () => source,
      getSelectionMode: () => selectionMode,
      getSelectedUsers: () => selected,
      getRepositoryVersion: () => 7,
      isLoadingRepository: () => loadingRepository,
      onUserSelect: jest.fn(),
      onUserContextMenu: jest.fn(),
      onImagePreview: jest.fn(),
      onCheckboxToggle: jest.fn(),
      onSelectAll: jest.fn(),
      onSourceChange: jest.fn(),
      observeImages: jest.fn()
    };
    manager = new ThumbnailGridManager(config);
    manager.init();
    manager.setItems([ana, luis]);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('cards', () => {
    test('one per user, in the order given', () => {
      expect(cards().map((c) => c.dataset.userId)).toEqual(['1', '2']);
    });

    test('show the name, the surnames and the group under the photo', () => {
      expect(text(1, 'thumbnail-card-name')).toBe('ANA');
      expect(text(1, 'thumbnail-card-surnames')).toBe('GARCIA LOPEZ');
      expect(text(1, 'thumbnail-card-group')).toBe('1ESOA');
      expect(text(2, 'thumbnail-card-surnames')).toBe('PEREZ');
      expect(card(1).title).toBe('ANA GARCIA LOPEZ');
    });

    test('load the captured photo lazily, as a thumbnail', () => {
      const img = card(1).querySelector('img');
      expect(img.classList.contains('lazy-image')).toBe(true);
      expect(img.dataset.src).toContain('app-img://');
      expect(decodeURIComponent(img.dataset.src)).toContain('ana.jpg');
      expect(img.dataset.src).toContain('size=384');
      expect(config.observeImages).toHaveBeenCalled();
    });

    test('show a silhouette for a user with no photo', () => {
      expect(card(2).querySelector('img')).toBeNull();
      expect(card(2).querySelector('.thumbnail-card-placeholder')).not.toBeNull();
    });

    test('count the users and those with a photo', () => {
      expect(document.getElementById('count').textContent).toBe('2 usuarios · 1 con foto');
      manager.setItems([ana]);
      expect(document.getElementById('count').textContent).toBe('1 usuario · 1 con foto');
    });
  });

  describe('repository source', () => {
    beforeEach(() => {
      source = 'repository';
      manager.render();
    });

    test('shows the repository photos, with the repository version in the URL', () => {
      expect(card(1).querySelector('img')).toBeNull();
      const img = card(2).querySelector('img');
      expect(decodeURIComponent(img.dataset.src)).toContain('10000002.jpg');
      expect(img.dataset.src).toContain('v=7');
      expect(document.getElementById('count').textContent).toBe('2 usuarios · 1 con foto');
    });

    test('shows a spinner while the repository photos are being looked up', () => {
      loadingRepository = true;
      manager.render();
      expect(card(1).querySelector('.thumbnail-card-loading')).not.toBeNull();
    });

    test('marks the button of the source on show', () => {
      const button = (name) => document.querySelector(`[data-source="${name}"]`);
      expect(button('repository').classList.contains('is-active')).toBe(true);
      expect(button('captured').classList.contains('is-active')).toBe(false);
      expect(button('repository').getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('switching the source', () => {
    test('asks for the other source', () => {
      document.querySelector('[data-source="repository"]').click();
      expect(config.onSourceChange).toHaveBeenCalledWith('repository');
    });

    test('does nothing when the source is already on show', () => {
      document.querySelector('[data-source="captured"]').click();
      expect(config.onSourceChange).not.toHaveBeenCalled();
    });
  });

  describe('interaction, as with a row', () => {
    test('click selects the user', () => {
      card(2).querySelector('.thumbnail-card-name').click();
      expect(config.onUserSelect).toHaveBeenCalledWith(card(2), luis);
    });

    test('double click enlarges the photo of the source on show', () => {
      card(1).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      expect(config.onImagePreview).toHaveBeenCalledWith(ana, 'captured');
    });

    test('double click on a user with no photo does nothing', () => {
      card(2).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      expect(config.onImagePreview).not.toHaveBeenCalled();
    });

    test('right click opens the context menu', () => {
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      card(1).dispatchEvent(event);
      expect(config.onUserContextMenu).toHaveBeenCalledWith(event, ana, card(1));
      expect(event.defaultPrevented).toBe(true);
    });

    test('getCard finds the card of a user', () => {
      expect(manager.getCard(2)).toBe(card(2));
      expect(manager.getCard(99)).toBeNull();
    });
  });

  describe('selection mode', () => {
    beforeEach(() => {
      selectionMode = true;
      selected = new Set([2]);
      manager.render();
    });

    test('adds a box to every card, ticked for the selected users', () => {
      expect(card(1).querySelector('.thumbnail-card-checkbox').checked).toBe(false);
      expect(card(2).querySelector('.thumbnail-card-checkbox').checked).toBe(true);
      expect(card(2).classList.contains('is-checked')).toBe(true);
    });

    test('ticking a box toggles the user without selecting the card', () => {
      const box = card(1).querySelector('.thumbnail-card-checkbox');
      box.click();
      expect(config.onCheckboxToggle).toHaveBeenCalledWith(1, true);
      expect(config.onUserSelect).not.toHaveBeenCalled();
    });

    test('shows Seleccionar todos, ticked only when everybody is selected', () => {
      const label = document.getElementById('select-all');
      expect(label.hidden).toBe(false);
      expect(label.querySelector('input').checked).toBe(false);

      manager.syncCheckboxes(new Set([1, 2]));
      expect(label.querySelector('input').checked).toBe(true);
    });

    test('Seleccionar todos asks to select or deselect everybody', () => {
      const box = document.querySelector('#select-all input');
      box.checked = true;
      box.dispatchEvent(new Event('change'));
      expect(config.onSelectAll).toHaveBeenCalledWith(true);
    });

    test('syncCheckboxes ticks the boxes in place', () => {
      const before = card(1);
      manager.syncCheckboxes(new Set([1]));
      expect(card(1)).toBe(before);
      expect(card(1).querySelector('.thumbnail-card-checkbox').checked).toBe(true);
      expect(card(2).querySelector('.thumbnail-card-checkbox').checked).toBe(false);
    });

    test('hides Seleccionar todos once selection mode is off', () => {
      selectionMode = false;
      manager.render();
      expect(document.getElementById('select-all').hidden).toBe(true);
      expect(card(1).querySelector('.thumbnail-card-checkbox')).toBeNull();
    });
  });

  describe('replaceCard', () => {
    test('rebuilds one card in its place after linking a photo', () => {
      const other = card(1);
      manager.replaceCard({ ...luis, image_path: 'C:\\p\\imports\\luis.jpg' });

      expect(card(1)).toBe(other);
      expect(decodeURIComponent(card(2).querySelector('img').dataset.src)).toContain('luis.jpg');
      expect(cards().map((c) => c.dataset.userId)).toEqual(['1', '2']);
      expect(document.getElementById('count').textContent).toBe('2 usuarios · 2 con foto');
    });

    test('keeps the card selected', () => {
      card(2).classList.add('selected');
      manager.replaceCard({ ...luis, image_path: null });
      expect(card(2).classList.contains('selected')).toBe(true);
    });

    test('ignores a user who is not in the grid', () => {
      manager.replaceCard({ ...ana, id: 99 });
      expect(cards()).toHaveLength(2);
    });
  });
});
