/**
 * User Row Renderer
 *
 * Renders individual user table rows with all interactive features:
 * - Lazy-loaded images
 * - Selection checkboxes
 * - Context menus
 * - Double-click image preview
 * - Duplicate image indicators
 *
 * @module components/UserRowRenderer
 */

// IIFE to avoid polluting global scope
(function(global) {
  'use strict';

// Dependencies: imageUrl (loaded from utils in browser, or via require in Node.js)
let imageUrl;
if (typeof window !== 'undefined' && window.imageUrl) {
  imageUrl = window.imageUrl;
} else if (typeof require !== 'undefined') {
  ({ imageUrl } = require('../utils/imageUrl'));
}

// Placeholder shown until the lazy loader swaps in the real image
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

class UserRowRenderer {
  constructor(config = {}) {
    // Configuration
    this.config = {
      showCapturedPhotos: config.showCapturedPhotos ?? true,
      showRepositoryPhotos: config.showRepositoryPhotos ?? false,
      showRepositoryIndicators: config.showRepositoryIndicators ?? false,
      showAdditionalActions: config.showAdditionalActions ?? true,
      isLoadingRepositoryPhotos: config.isLoadingRepositoryPhotos ?? false,
      isLoadingRepositoryIndicators: config.isLoadingRepositoryIndicators ?? false,
      selectionMode: config.selectionMode ?? false,
      selectedUsers: config.selectedUsers ?? new Set(),
      cardPrintRequests: config.cardPrintRequests ?? new Set(),
      publicationRequests: config.publicationRequests ?? new Set(),
      repositoryVersion: config.repositoryVersion ?? 0
    };

    // Callbacks (provided by renderer)
    this.onUserSelect = config.onUserSelect || (() => {});
    this.onUserContextMenu = config.onUserContextMenu || (() => {});
    this.onImagePreview = config.onImagePreview || (() => {});
    this.onCheckboxToggle = config.onCheckboxToggle || (() => {});
  }

  /**
   * Update renderer configuration
   * @param {object} updates - Configuration updates
   */
  updateConfig(updates) {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Create a user row element
   * @param {object} user - User data
   * @param {object} imageCount - Image duplication count map
   * @returns {HTMLElement} Table row element
   */
  createRow(user, imageCount = {}) {
    const row = document.createElement('tr');
    row.dataset.userId = user.id;

    // Check for duplicate images
    const hasDuplicateImage = user.image_path && imageCount[user.image_path] > 1;
    const duplicateClass = hasDuplicateImage ? 'duplicate-image' : '';

    // Build row HTML
    const photoIndicator = this._buildPhotoIndicator(user, duplicateClass);
    const repositoryIndicator = this._buildRepositoryIndicator(user);
    const repositoryCheckIndicator = this._buildRepositoryCheckIndicator(user);
    const cardPrintIndicator = this._buildCardPrintIndicator(user);
    const publicationIndicator = this._buildPublicationIndicator(user);
    const orlaPaidIndicator = this._buildOrlaPaidIndicator(user);
    const receiptPrintedIndicator = this._buildReceiptPrintedIndicator(user);
    const checkboxCell = this._buildCheckboxCell(user);

    // Show NIA for students, document (DNI) for teachers and non-teaching staff
    const userId = user.type === 'student' ? (user.nia || '-') : (user.document || '-');

    row.innerHTML = `
      ${checkboxCell}
      <td class="name">${user.first_name}</td>
      <td>${user.last_name1} ${user.last_name2 || ''}</td>
      <td>${userId}</td>
      <td>${user.group_code}</td>
      <td style="display: flex; align-items: center; gap: 4px;">${photoIndicator}${repositoryIndicator}${repositoryCheckIndicator}${cardPrintIndicator}${publicationIndicator}${orlaPaidIndicator}${receiptPrintedIndicator}</td>
    `;

    // Attach event listeners
    this._attachEventListeners(row, user);

    return row;
  }

  /**
   * Build photo indicator HTML
   * @private
   */
  _buildPhotoIndicator(user, duplicateClass) {
    if (!this.config.showCapturedPhotos) {
      return '';
    }

    if (user.image_path) {
      // No version: captured files always get a unique name, so the path itself
      // identifies the content and the browser cache stays valid.
      const src = imageUrl.thumbnail(user.image_path, imageUrl.INDICATOR_SIZE);
      // Wrap img in div to support ::after spinner (img elements don't support pseudo-elements)
      // Add 'loading' class to wrapper for CSS spinner
      return `<div class="photo-indicator-wrapper loading ${duplicateClass}"><img src="${TRANSPARENT_PIXEL}" data-src="${src}" class="photo-indicator lazy-image" alt="" onerror="this.style.display='none'"></div>`;
    }

    return `<div class="photo-placeholder">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    </div>`;
  }

  /**
   * Build repository indicator HTML
   * @private
   */
  _buildRepositoryIndicator(user) {
    if (!this.config.showRepositoryPhotos) {
      return '';
    }

    if (user.repository_image_path) {
      // The mirror overwrites repository files in place, so the path alone is not
      // enough to identify the content. repositoryVersion is bumped only when the
      // repository actually changes, keeping URLs stable across scroll/re-render.
      const src = imageUrl.thumbnail(
        user.repository_image_path,
        imageUrl.INDICATOR_SIZE,
        this.config.repositoryVersion
      );
      // Wrap img in div to support ::after spinner (img elements don't support pseudo-elements)
      // Add 'loading' class to wrapper for CSS spinner
      return `<div class="repository-indicator-wrapper loading"><img src="${TRANSPARENT_PIXEL}" data-src="${src}" class="repository-indicator lazy-image" alt="" onerror="this.style.display='none'"></div>`;
    }

    if (this.config.isLoadingRepositoryPhotos) {
      return `<div class="repository-placeholder loading">
        <div class="spinner-small"></div>
      </div>`;
    }

    return `<div class="repository-placeholder">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    </div>`;
  }

  /**
   * Build repository check indicator HTML
   * @private
   */
  _buildRepositoryCheckIndicator(user) {
    if (!this.config.showRepositoryIndicators) {
      return '';
    }

    if (user.repository_image_path) {
      return `<svg class="repository-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>`;
    }

    if (this.config.isLoadingRepositoryIndicators) {
      return `<div class="repository-check-placeholder loading">
        <div class="spinner-small"></div>
      </div>`;
    }

    return `<div class="repository-check-placeholder"></div>`;
  }

  /**
   * Build card print request indicator HTML
   * @private
   */
  _buildCardPrintIndicator(user) {
    // Determine user ID (NIA for students, document for others)
    const userId = user.type === 'student' ? user.nia : user.document;

    if (!userId) {
      return '';
    }

    // Check if this user has a pending card print request
    if (this.config.cardPrintRequests.has(userId)) {
      return `<svg class="card-print-indicator" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="Carnet solicitado">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
        <line x1="1" y1="10" x2="23" y2="10"></line>
      </svg>`;
    }

    return '';
  }

  /**
   * Build publication request indicator HTML
   * @private
   */
  _buildPublicationIndicator(user) {
    // Determine user ID (NIA for students, document for others)
    const userId = user.type === 'student' ? user.nia : user.document;

    if (!userId) {
      return '';
    }

    // Check if this user has a pending publication request
    if (this.config.publicationRequests.has(userId)) {
      return `<svg class="publication-indicator" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="Publicación solicitada">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>`;
    }

    return '';
  }

  /**
   * Build orla paid indicator HTML
   * @private
   */
  _buildOrlaPaidIndicator(user) {
    // Only show if additional actions are visible
    if (!this.config.showAdditionalActions) {
      return '';
    }

    // Check if orla has been paid
    if (user.orla_paid === 1) {
      return `<svg class="orla-paid-indicator" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="Orla pagada">
        <line x1="12" y1="2" x2="12" y2="22"></line>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
      </svg>`;
    }

    return '';
  }

  /**
   * Build receipt printed indicator HTML
   * @private
   */
  _buildReceiptPrintedIndicator(user) {
    // Only show if additional actions are visible
    if (!this.config.showAdditionalActions) {
      return '';
    }

    // Check if receipt has been printed
    if (user.receipt_printed === 1) {
      return `<svg class="receipt-printed-indicator" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="Recibo impreso">
        <polyline points="6 9 6 2 18 2 18 9"></polyline>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
        <rect x="6" y="14" width="12" height="8"></rect>
      </svg>`;
    }

    return '';
  }

  /**
   * Build checkbox cell HTML
   * @private
   */
  _buildCheckboxCell(user) {
    if (!this.config.selectionMode) {
      return '';
    }

    const isChecked = this.config.selectedUsers.has(user.id);
    return `<td class="checkbox-cell">
      <input type="checkbox" class="user-checkbox" ${isChecked ? 'checked' : ''}>
    </td>`;
  }

  /**
   * Attach all event listeners to row
   * @private
   */
  _attachEventListeners(row, user) {
    // Handle checkbox clicks in selection mode
    if (this.config.selectionMode) {
      const checkbox = row.querySelector('.user-checkbox');
      if (checkbox) {
        checkbox.addEventListener('click', (e) => {
          e.stopPropagation();
          this.onCheckboxToggle(user.id, checkbox.checked);
        });
      }
    }

    // Row click for selection
    row.addEventListener('click', () => {
      this.onUserSelect(row, user);
    });

    // Context menu
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.onUserContextMenu(e, user, row);
    });

    // Double-click on captured photo (use wrapper to capture clicks on both image and spinner)
    if (user.image_path) {
      const photoWrapper = row.querySelector('.photo-indicator-wrapper');
      if (photoWrapper) {
        photoWrapper.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          this.onImagePreview(user, 'captured');
        });
      }
    }

    // Double-click on repository photo (use wrapper to capture clicks on both image and spinner)
    if (user.repository_image_path) {
      const repositoryWrapper = row.querySelector('.repository-indicator-wrapper');
      if (repositoryWrapper) {
        repositoryWrapper.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          this.onImagePreview(user, 'repository');
        });
      }
    }
  }

  /**
   * Create multiple rows efficiently
   * @param {Array} users - Array of user objects
   * @param {object} imageCount - Image duplication count map
   * @returns {Array<HTMLElement>} Array of row elements
   */
  createRows(users, imageCount = {}) {
    return users.map(user => this.createRow(user, imageCount));
  }

  /**
   * Rebuild the row of one user in place
   *
   * For changes that touch a single user, such as linking a photo, rebuilding
   * this one row keeps the rest of the table, and its scroll position, exactly
   * as it was. A user whose row is not rendered (scrolled out of the virtual
   * range) needs nothing: the row is built from the user object when it comes
   * into view.
   *
   * @param {HTMLElement} tableBody - The table body containing user rows
   * @param {Object} user - User data to build the row from
   * @param {object} imageCount - Image duplication count map
   * @returns {HTMLElement|null} The new row, or null if the user had no row
   */
  replaceRow(tableBody, user, imageCount = {}) {
    if (!tableBody || !user) return null;

    const existing = tableBody.querySelector(`tr[data-user-id="${user.id}"]`);
    if (!existing) return null;

    const row = this.createRow(user, imageCount);
    existing.replaceWith(row);
    return row;
  }

  /**
   * Update repository indicators for existing rows without recreating them
   * Preserves scroll position and DOM state
   * @param {HTMLElement} tableBody - The table body containing user rows
   * @param {Array} users - Updated user data with repository information
   * @param {object} imageCount - Optional image duplication count map
   */
  updateRepositoryIndicators(tableBody, users, imageCount = {}) {
    if (!tableBody) return;

    // Create a map for quick user lookup
    const userMap = new Map(users.map(user => [user.id, user]));

    // Find all user rows (exclude spacers)
    const rows = tableBody.querySelectorAll('tr[data-user-id]');

    rows.forEach(row => {
      const userId = parseInt(row.dataset.userId, 10);
      const user = userMap.get(userId);

      if (!user) return;

      // Find the last cell (contains indicators)
      const lastCell = row.querySelector('td:last-child');
      if (!lastCell) return;

      // Check for duplicate images
      const hasDuplicateImage = user.image_path && imageCount[user.image_path] > 1;
      const duplicateClass = hasDuplicateImage ? 'duplicate-image' : '';

      // Rebuild indicators HTML
      const photoIndicator = this._buildPhotoIndicator(user, duplicateClass);
      const repositoryIndicator = this._buildRepositoryIndicator(user);
      const repositoryCheckIndicator = this._buildRepositoryCheckIndicator(user);
      const cardPrintIndicator = this._buildCardPrintIndicator(user);
      const publicationIndicator = this._buildPublicationIndicator(user);
      const orlaPaidIndicator = this._buildOrlaPaidIndicator(user);
      const receiptPrintedIndicator = this._buildReceiptPrintedIndicator(user);

      lastCell.innerHTML = `${photoIndicator}${repositoryIndicator}${repositoryCheckIndicator}${cardPrintIndicator}${publicationIndicator}${orlaPaidIndicator}${receiptPrintedIndicator}`;

      // Reattach event listeners for double-click on images (use wrappers)
      if (user.image_path) {
        const photoWrapper = lastCell.querySelector('.photo-indicator-wrapper');
        if (photoWrapper) {
          photoWrapper.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.onImagePreview(user, 'captured');
          });
        }
      }

      if (user.repository_image_path) {
        const repositoryWrapper = lastCell.querySelector('.repository-indicator-wrapper');
        if (repositoryWrapper) {
          repositoryWrapper.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.onImagePreview(user, 'repository');
          });
        }
      }
    });
  }
}

// Export for both browser and Node.js (tests)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UserRowRenderer };
} else {
  global.UserRowRenderer = UserRowRenderer;
}

})(typeof window !== 'undefined' ? window : global);
