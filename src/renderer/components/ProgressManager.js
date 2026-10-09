/**
 * ProgressManager - Manages progress modal display
 *
 * Handles displaying and updating progress for long-running operations:
 * - Show/hide progress modal
 * - Update progress bar percentage
 * - Display progress messages and details
 * - Listen to progress events from main process
 *
 * Features:
 * - Smooth progress bar updates
 * - Title and message customization
 * - Optional details display
 * - IPC event listener setup
 */

(function(global) {
  'use strict';

  class ProgressManager {
    constructor(config = {}) {
      // DOM elements
      this.modal = config.modal || document.getElementById('progress-modal');
      this.titleElement = config.titleElement || document.getElementById('progress-title');
      this.messageElement = config.messageElement || document.getElementById('progress-message');
      this.barElement = config.barElement || document.getElementById('progress-bar');
      this.percentageElement = config.percentageElement || document.getElementById('progress-percentage');
      this.detailsElement = config.detailsElement || document.getElementById('progress-details');

      // Electron API
      this.electronAPI = config.electronAPI || (typeof window !== 'undefined' ? window.electronAPI : null);

      // State
      this.isVisible = false;
      // Set by resetBar() until the next width is set
      this.barResetPending = false;
    }

    /**
     * Initialize progress listener from main process
     */
    setupListener() {
      if (!this.electronAPI || !this.electronAPI.onProgress) {
        console.warn('[ProgressManager] electronAPI.onProgress not available');
        return;
      }

      this.electronAPI.onProgress((data) => {
        this.update(data.percentage, data.message, data.details);
      });

      console.log('[ProgressManager] Progress listener initialized');
    }

    /**
     * Show progress modal
     * @param {string} title - Modal title
     * @param {string} message - Progress message
     */
    show(title = 'Procesando...', message = 'Por favor, espera...') {
      if (!this.modal) {
        console.warn('[ProgressManager] Modal element not found');
        return;
      }

      // Set initial values
      if (this.titleElement) {
        this.titleElement.textContent = title;
      }

      if (this.messageElement) {
        this.messageElement.textContent = message;
      }

      // Reset progress
      this.resetBar();

      // Clear details
      if (this.detailsElement) {
        this.detailsElement.textContent = '';
      }

      // Show modal
      this.modal.classList.add('show');
      this.isVisible = true;

      console.log(`[ProgressManager] Shown: ${title}`);
    }

    /**
     * Update progress
     * @param {number} percentage - Progress percentage (0-100)
     * @param {string} message - Optional message to display
     * @param {string} details - Optional details to display
     */
    update(percentage, message = '', details = '') {
      if (!this.isVisible) {
        console.warn('[ProgressManager] Update called but modal not visible');
        return;
      }

      // Update progress bar
      this.setProgress(percentage);

      // Update message if provided
      if (message && this.messageElement) {
        this.messageElement.textContent = message;
      }

      // Update details if provided
      if (details && this.detailsElement) {
        this.detailsElement.textContent = details;
      }
    }

    /**
     * Set progress percentage
     * @param {number} percentage - Progress percentage (0-100)
     */
    setProgress(percentage) {
      const clamped = Math.max(0, Math.min(100, Number(percentage) || 0));
      const roundedPercentage = Math.round(clamped);

      if (this.barElement) {
        if (this.barResetPending) {
          // The modal is visible by now: commit the 0% without animating, and
          // only then let the bar animate again from there
          void this.barElement.offsetWidth;
          this.barElement.style.transition = '';
          this.barResetPending = false;
        }
        this.barElement.style.width = clamped + '%';
      }

      if (this.percentageElement) {
        this.percentageElement.textContent = roundedPercentage + '%';
      }
    }

    /**
     * Put the bar back at 0% without the width transition. With it, a second
     * operation started with the bar shrinking from where the previous one
     * left it, and each update retargeted that shrinking, so the bar went
     * down while the percentage went up
     */
    resetBar() {
      if (this.barElement) {
        this.barElement.style.transition = 'none';
        this.barElement.style.width = '0%';
        this.barResetPending = true;
      }

      if (this.percentageElement) {
        this.percentageElement.textContent = '0%';
      }
    }

    /**
     * Update title
     * @param {string} title - New title
     */
    setTitle(title) {
      if (this.titleElement) {
        this.titleElement.textContent = title;
      }
    }

    /**
     * Update message
     * @param {string} message - New message
     */
    setMessage(message) {
      if (this.messageElement) {
        this.messageElement.textContent = message;
      }
    }

    /**
     * Update details
     * @param {string} details - New details
     */
    setDetails(details) {
      if (this.detailsElement) {
        this.detailsElement.textContent = details;
      }
    }

    /**
     * Close progress modal
     */
    close() {
      if (!this.modal) {
        return;
      }

      this.modal.classList.remove('show');
      this.isVisible = false;

      console.log('[ProgressManager] Closed');
    }

    /**
     * Check if modal is visible
     * @returns {boolean} True if visible
     */
    isShowing() {
      return this.isVisible;
    }

    /**
     * Reset progress to 0
     */
    reset() {
      this.resetBar();

      if (this.detailsElement) {
        this.detailsElement.textContent = '';
      }
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProgressManager };
  } else if (typeof window !== 'undefined') {
    global.ProgressManager = ProgressManager;
  }
})(typeof window !== 'undefined' ? window : global);
