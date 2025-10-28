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

class UserRowRenderer {
  constructor(config = {}) {
    // Configuration
    this.config = {
      showCapturedPhotos: config.showCapturedPhotos ?? true,
      showRepositoryPhotos: config.showRepositoryPhotos ?? false,
      showRepositoryIndicators: config.showRepositoryIndicators ?? false,
      isLoadingRepositoryPhotos: config.isLoadingRepositoryPhotos ?? false,
      isLoadingRepositoryIndicators: config.isLoadingRepositoryIndicators ?? false,
      selectionMode: config.selectionMode ?? false,
      selectedUsers: config.selectedUsers ?? new Set()
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
    const checkboxCell = this._buildCheckboxCell(user);

    row.innerHTML = `
      ${checkboxCell}
      <td class="name">${user.first_name}</td>
      <td>${user.last_name1} ${user.last_name2 || ''}</td>
      <td>${user.nia || '-'}</td>
      <td>${user.group_code}</td>
      <td style="display: flex; align-items: center; gap: 4px;">${photoIndicator}${repositoryIndicator}${repositoryCheckIndicator}</td>
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
      // Add timestamp to prevent browser caching
      const cacheBuster = `?t=${Date.now()}`;
      // Use transparent 1x1 pixel as placeholder to avoid broken image icon
      const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      // Wrap img in div to support ::after spinner (img elements don't support pseudo-elements)
      // Add 'loading' class to wrapper for CSS spinner
      const html = `<div class="photo-indicator-wrapper loading ${duplicateClass}"><img src="${transparentPixel}" data-src="file://${user.image_path}${cacheBuster}" class="photo-indicator lazy-image" alt="" onerror="this.style.display='none'"></div>`;
      console.log(`[UserRowRenderer] Built photo indicator for user ${user.id}:`, html.substring(0, 150));
      return html;
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
      // Add timestamp to prevent browser caching
      const cacheBuster = `?t=${Date.now()}`;
      // Use transparent 1x1 pixel as placeholder to avoid broken image icon
      const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      // Wrap img in div to support ::after spinner (img elements don't support pseudo-elements)
      // Add 'loading' class to wrapper for CSS spinner
      const html = `<div class="repository-indicator-wrapper loading"><img src="${transparentPixel}" data-src="file://${user.repository_image_path}${cacheBuster}" class="repository-indicator lazy-image" alt="" onerror="this.style.display='none'"></div>`;
      console.log(`[UserRowRenderer] Built repository indicator for user ${user.id}:`, html.substring(0, 150));
      return html;
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

      lastCell.innerHTML = `${photoIndicator}${repositoryIndicator}${repositoryCheckIndicator}`;

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
