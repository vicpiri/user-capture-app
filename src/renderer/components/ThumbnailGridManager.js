/**
 * ThumbnailGridManager - Ver > Vista de miniaturas
 *
 * Shows the users of the list as a grid of photos, with the name, surnames
 * and group under each one, in place of the table. It is another way of
 * drawing the same list: it gets the users displayUsers() decided to show,
 * and a card does what a row does (click selects, double click enlarges,
 * right click opens the same menu, a box in selection mode).
 *
 * The photos are those captured in the project or those of the repository,
 * switched from the bar above the grid. Images load as they scroll into view,
 * through the same lazy loader as the table.
 */

(function(global) {
  'use strict';

  // Dependencies: imageUrl (loaded from utils in browser, or via require in Node.js)
  let imageUrl;
  if (typeof window !== 'undefined' && window.imageUrl) {
    imageUrl = window.imageUrl;
  } else if (typeof require !== 'undefined') {
    ({ imageUrl } = require('../utils/imageUrl'));
  }

  const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  const PLACEHOLDER = `
    <div class="thumbnail-card-placeholder">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    </div>`;

  class ThumbnailGridManager {
    /**
     * @param {Object} config
     * @param {HTMLElement} config.grid - Element the cards go into
     * @param {HTMLElement} [config.countEl] - "N usuarios · M con foto"
     * @param {HTMLElement} [config.sourceButtons] - Holder of the Capturadas | Depósito buttons
     * @param {HTMLElement} [config.selectAllLabel] - "Seleccionar todos", shown in selection mode
     * @param {Function} config.getSource - () => 'captured'|'repository'
     * @param {Function} config.getSelectionMode - () => boolean
     * @param {Function} config.getSelectedUsers - () => Set of user ids
     * @param {Function} config.getRepositoryVersion - () => number, changes when the repository does
     * @param {Function} config.isLoadingRepository - () => boolean
     * @param {Function} config.onUserSelect - (card, user) => void
     * @param {Function} config.onUserContextMenu - (event, user, card) => void
     * @param {Function} config.onImagePreview - (user, 'captured'|'repository') => void
     * @param {Function} config.onCheckboxToggle - (userId, checked) => void
     * @param {Function} config.onSelectAll - (checked) => void
     * @param {Function} config.onSourceChange - (source) => void
     * @param {Function} config.observeImages - () => void, starts the lazy loader
     */
    constructor(config = {}) {
      this.grid = config.grid;
      this.countEl = config.countEl || null;
      this.sourceButtons = config.sourceButtons || null;
      this.selectAllLabel = config.selectAllLabel || null;
      this.getSource = config.getSource || (() => 'captured');
      this.getSelectionMode = config.getSelectionMode || (() => false);
      this.getSelectedUsers = config.getSelectedUsers || (() => new Set());
      this.getRepositoryVersion = config.getRepositoryVersion || (() => 0);
      this.isLoadingRepository = config.isLoadingRepository || (() => false);
      this.onUserSelect = config.onUserSelect || (() => {});
      this.onUserContextMenu = config.onUserContextMenu || (() => {});
      this.onImagePreview = config.onImagePreview || (() => {});
      this.onCheckboxToggle = config.onCheckboxToggle || (() => {});
      this.onSelectAll = config.onSelectAll || (() => {});
      this.onSourceChange = config.onSourceChange || (() => {});
      this.observeImages = config.observeImages || (() => {});

      this.users = [];
      this.cards = new Map();
    }

    init() {
      if (this.sourceButtons) {
        this.sourceButtons.addEventListener('click', (event) => {
          const button = event.target.closest('button[data-source]');
          if (button && button.dataset.source !== this.getSource()) {
            this.onSourceChange(button.dataset.source);
          }
        });
      }

      const selectAll = this.selectAllLabel && this.selectAllLabel.querySelector('input');
      if (selectAll) {
        selectAll.addEventListener('change', () => this.onSelectAll(selectAll.checked));
      }

      // One set of listeners for every card, whatever the list holds
      this.grid.addEventListener('click', (event) => {
        const card = event.target.closest('.thumbnail-card');
        if (!card) return;
        const user = this.userOf(card);
        if (!user) return;
        if (event.target.matches('.thumbnail-card-checkbox')) {
          this.onCheckboxToggle(user.id, event.target.checked);
          return;
        }
        this.onUserSelect(card, user);
      });
      this.grid.addEventListener('dblclick', (event) => {
        const card = event.target.closest('.thumbnail-card');
        const user = card && this.userOf(card);
        if (user && this.photoPath(user)) {
          this.onImagePreview(user, this.getSource());
        }
      });
      this.grid.addEventListener('contextmenu', (event) => {
        const card = event.target.closest('.thumbnail-card');
        const user = card && this.userOf(card);
        if (user) {
          event.preventDefault();
          this.onUserContextMenu(event, user, card);
        }
      });
    }

    /**
     * Draw the users given, in that order
     * @param {Array} users
     */
    setItems(users) {
      this.users = users || [];
      this.render();
    }

    render() {
      this.cards.clear();
      const fragment = document.createDocumentFragment();
      this.users.forEach((user) => {
        const card = this.createCard(user);
        this.cards.set(user.id, card);
        fragment.appendChild(card);
      });
      this.grid.innerHTML = '';
      this.grid.appendChild(fragment);

      this.updateToolbar();
      this.observeImages();
    }

    /**
     * Rebuild the card of one user in its place, as after linking a photo
     * @param {Object} user
     */
    replaceCard(user) {
      const index = this.users.findIndex((candidate) => candidate.id === user.id);
      if (index === -1) return;
      this.users[index] = user;

      const old = this.cards.get(user.id);
      const card = this.createCard(user);
      if (old && old.classList.contains('selected')) card.classList.add('selected');
      if (old && old.parentNode) {
        old.replaceWith(card);
      }
      this.cards.set(user.id, card);
      this.updateToolbar();
      this.observeImages();
    }

    /**
     * @param {number} userId
     * @returns {HTMLElement|null}
     */
    getCard(userId) {
      return this.cards.get(userId) || null;
    }

    /**
     * Tick the boxes of the selected users without rebuilding the cards
     * @param {Set} selected
     */
    syncCheckboxes(selected) {
      this.cards.forEach((card, id) => {
        const checkbox = card.querySelector('.thumbnail-card-checkbox');
        if (checkbox) checkbox.checked = selected.has(id);
        card.classList.toggle('is-checked', selected.has(id));
      });
      this.updateSelectAll(selected);
    }

    /**
     * @private
     */
    createCard(user) {
      const card = document.createElement('div');
      card.className = 'thumbnail-card';
      card.dataset.userId = String(user.id);

      const fullName = [user.first_name, user.last_name1, user.last_name2].filter(Boolean).join(' ');
      card.title = fullName;

      if (this.getSelectionMode()) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'thumbnail-card-checkbox';
        checkbox.checked = this.getSelectedUsers().has(user.id);
        checkbox.setAttribute('aria-label', `Seleccionar a ${fullName}`);
        card.classList.toggle('is-checked', checkbox.checked);
        card.appendChild(checkbox);
      }

      const image = document.createElement('div');
      image.className = 'thumbnail-card-image';
      const path = this.photoPath(user);
      if (path) {
        const img = document.createElement('img');
        img.className = 'lazy-image';
        img.src = TRANSPARENT_PIXEL;
        img.dataset.src = this.getSource() === 'repository'
          ? imageUrl.thumbnail(path, imageUrl.GRID_SIZE, this.getRepositoryVersion())
          : imageUrl.thumbnail(path, imageUrl.GRID_SIZE);
        img.alt = '';
        img.addEventListener('error', () => {
          image.innerHTML = PLACEHOLDER;
        });
        image.appendChild(img);
      } else if (this.getSource() === 'repository' && this.isLoadingRepository()) {
        image.innerHTML = '<div class="thumbnail-card-loading"><div class="spinner"></div></div>';
      } else {
        image.innerHTML = PLACEHOLDER;
      }
      card.appendChild(image);

      const name = document.createElement('div');
      name.className = 'thumbnail-card-name';
      name.textContent = user.first_name || '';

      const surnames = document.createElement('div');
      surnames.className = 'thumbnail-card-surnames';
      surnames.textContent = [user.last_name1, user.last_name2].filter(Boolean).join(' ');

      const group = document.createElement('div');
      group.className = 'thumbnail-card-group';
      group.textContent = user.group_code || '';

      card.appendChild(name);
      card.appendChild(surnames);
      card.appendChild(group);
      return card;
    }

    /**
     * @private
     */
    photoPath(user) {
      return this.getSource() === 'repository' ? user.repository_image_path : user.image_path;
    }

    /**
     * @private
     */
    userOf(card) {
      const id = Number(card.dataset.userId);
      return this.users.find((user) => user.id === id) || null;
    }

    /**
     * @private
     */
    updateToolbar() {
      const source = this.getSource();

      if (this.sourceButtons) {
        this.sourceButtons.querySelectorAll('button[data-source]').forEach((button) => {
          const active = button.dataset.source === source;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-pressed', String(active));
        });
      }

      if (this.countEl) {
        const withPhoto = this.users.filter((user) => this.photoPath(user)).length;
        const total = this.users.length;
        this.countEl.textContent = `${total} ${total === 1 ? 'usuario' : 'usuarios'} · ${withPhoto} con foto`;
      }

      if (this.selectAllLabel) {
        this.selectAllLabel.hidden = !this.getSelectionMode();
      }
      this.updateSelectAll();
    }

    /**
     * @private
     */
    updateSelectAll(selected = this.getSelectedUsers()) {
      const selectAll = this.selectAllLabel && this.selectAllLabel.querySelector('input');
      if (!selectAll) return;
      selectAll.checked = this.users.length > 0 && this.users.every((user) => selected.has(user.id));
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ThumbnailGridManager };
  } else if (typeof window !== 'undefined') {
    global.ThumbnailGridManager = ThumbnailGridManager;
  }
})(typeof window !== 'undefined' ? window : global);
