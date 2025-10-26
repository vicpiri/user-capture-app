/**
 * DragDropManager - Manages drag and drop functionality for images
 *
 * Handles all drag-and-drop operations for image files:
 * - Visual feedback when dragging over drop zone
 * - File validation (only JPG/JPEG allowed)
 * - Moving dropped files to ingest folder
 * - Error handling and user notifications
 *
 * Features:
 * - Highlights drop zone when dragging over
 * - Filters non-image files
 * - Processes multiple files
 * - Shows appropriate error messages
 */

(function(global) {
  'use strict';

  class DragDropManager {
    constructor(config = {}) {
      // Required DOM element
      this.dropZone = config.dropZone; // Element to enable drop on

      // Required callbacks
      this.showInfoModal = config.showInfoModal; // Function to show info/error messages
      this.moveImageToIngest = config.moveImageToIngest; // Function to move image file

      // State
      this.isEnabled = false;
    }

    /**
     * Enable drag and drop functionality
     */
    enable() {
      if (!this.dropZone) {
        console.warn('[DragDropManager] Drop zone element not provided');
        return;
      }

      if (this.isEnabled) {
        return; // Already enabled
      }

      // Prevent default behavior for drag events
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        this.dropZone.addEventListener(eventName, this.preventDefaults.bind(this), false);
      });

      // Highlight drop area when dragging over
      ['dragenter', 'dragover'].forEach(eventName => {
        this.dropZone.addEventListener(eventName, this.highlight.bind(this), false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        this.dropZone.addEventListener(eventName, this.unhighlight.bind(this), false);
      });

      // Handle drop
      this.dropZone.addEventListener('drop', this.handleDrop.bind(this), false);

      this.isEnabled = true;
      console.log('[DragDropManager] Drag and drop enabled');
    }

    /**
     * Disable drag and drop functionality
     */
    disable() {
      if (!this.dropZone || !this.isEnabled) {
        return;
      }

      // Remove all event listeners by cloning and replacing the element
      // This is a simple way to remove all listeners
      const newDropZone = this.dropZone.cloneNode(true);
      this.dropZone.parentNode.replaceChild(newDropZone, this.dropZone);
      this.dropZone = newDropZone;

      this.isEnabled = false;
      console.log('[DragDropManager] Drag and drop disabled');
    }

    /**
     * Prevent default behavior
     * @param {Event} e - Event object
     */
    preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    /**
     * Highlight drop zone
     */
    highlight() {
      if (this.dropZone) {
        this.dropZone.classList.add('drag-over');
      }
    }

    /**
     * Remove highlight from drop zone
     */
    unhighlight() {
      if (this.dropZone) {
        this.dropZone.classList.remove('drag-over');
      }
    }

    /**
     * Handle file drop
     * @param {DragEvent} e - Drag event
     */
    async handleDrop(e) {
      const files = Array.from(e.dataTransfer.files);

      // Filter only image files (jpg, jpeg)
      const imageFiles = this.filterImageFiles(files);

      if (imageFiles.length === 0) {
        this.showInfoModal('Aviso', 'Por favor, arrastra solo archivos de imagen JPG/JPEG');
        return;
      }

      // Process each image file
      await this.processFiles(imageFiles);
    }

    /**
     * Filter image files from file list
     * @param {File[]} files - Array of files
     * @returns {File[]} Filtered image files
     */
    filterImageFiles(files) {
      return files.filter(file => {
        const ext = file.name.toLowerCase();
        return ext.endsWith('.jpg') || ext.endsWith('.jpeg');
      });
    }

    /**
     * Process dropped image files
     * @param {File[]} imageFiles - Array of image files
     */
    async processFiles(imageFiles) {
      let successCount = 0;
      let errorCount = 0;

      for (const file of imageFiles) {
        try {
          const result = await this.moveImageToIngest(file.path);
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            this.showInfoModal('Error', `Error al mover ${file.name}: ${result.error}`);
          }
        } catch (error) {
          errorCount++;
          this.showInfoModal('Error', `Error al procesar ${file.name}: ${error.message}`);
        }
      }

      // Log success
      if (successCount > 0) {
        console.log(`[DragDropManager] ${successCount} imagen(es) movida(s) a la carpeta ingest`);
      }
    }

    /**
     * Check if drag and drop is enabled
     * @returns {boolean} True if enabled
     */
    isActive() {
      return this.isEnabled;
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DragDropManager };
  } else if (typeof window !== 'undefined') {
    global.DragDropManager = DragDropManager;
  }
})(typeof window !== 'undefined' ? window : global);
