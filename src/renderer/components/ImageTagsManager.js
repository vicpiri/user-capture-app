/**
 * ImageTagsManager - Manages image tags functionality
 *
 * Handles all tag-related operations for images:
 * - Adding tags to images
 * - Loading and displaying tags for current image
 * - Deleting tags from images
 * - Showing all tagged images in a modal
 *
 * Features:
 * - Uses AddTagModal for tag input
 * - Displays tags with delete buttons
 * - Shows tagged images list in modal
 * - Integrates with ImageGridManager for image selection
 */

(function(global) {
  'use strict';

  class ImageTagsManager {
    constructor(config = {}) {
      // Required dependencies
      this.addTagModal = config.addTagModal; // AddTagModal instance
      this.showInfoModal = config.showInfoModal; // Function to show info/error messages
      this.imageGridManager = config.imageGridManager; // ImageGridManager instance

      // Required callbacks
      this.getProjectOpen = config.getProjectOpen; // Function returning projectOpen boolean

      // Required Electron API methods
      this.electronAPI = config.electronAPI; // window.electronAPI reference

      // DOM elements
      this.tagsContainer = config.tagsContainer; // Tags container element
      this.tagsList = config.tagsList; // Tags list element
      this.taggedImagesModal = config.taggedImagesModal; // Tagged images modal element
      this.taggedImagesContainer = config.taggedImagesContainer; // Tagged images container
      this.taggedImagesCloseBtn = config.taggedImagesCloseBtn; // Close button for tagged images modal
    }

    /**
     * Check if image is selected
     * @returns {boolean} True if image is selected
     */
    checkImageSelected() {
      if (!this.imageGridManager || !this.imageGridManager.isPreviewActive()) {
        this.showInfoModal('Aviso', 'Debes seleccionar una imagen primero');
        return false;
      }
      return true;
    }

    /**
     * Check if project is open
     * @returns {boolean} True if project is open
     */
    checkProjectOpen() {
      if (!this.getProjectOpen()) {
        this.showInfoModal('Aviso', 'Debes abrir o crear un proyecto primero');
        return false;
      }
      return true;
    }

    /**
     * Handle add tag to current image
     */
    async handleAddTag() {
      if (!this.checkImageSelected()) return;

      // Show modal and wait for tag input
      const tag = await this.addTagModal.show();

      if (!tag) {
        // User cancelled or entered empty tag
        return;
      }

      // Get current image path
      const imagePath = this.imageGridManager.getCurrentImagePath();
      if (!imagePath) {
        this.showInfoModal('Error', 'No se pudo obtener la imagen actual');
        return;
      }

      // Add tag to image
      const result = await this.electronAPI.addImageTag({ imagePath, tag });

      if (result.success) {
        // Reload tags to show the new tag immediately
        await this.loadTags();
        this.showInfoModal('Éxito', 'Etiqueta agregada correctamente');
      } else {
        this.showInfoModal('Error', 'Error al agregar la etiqueta: ' + result.error);
      }
    }

    /**
     * Load and display tags for current image
     */
    async loadTags() {
      if (!this.imageGridManager || this.imageGridManager.getImageCount() === 0) {
        this.hideTags();
        return;
      }

      const imagePath = this.imageGridManager.getCurrentImagePath();
      if (!imagePath) {
        this.hideTags();
        return;
      }

      const result = await this.electronAPI.getImageTags(imagePath);

      if (result.success && result.tags.length > 0) {
        this.displayTags(result.tags);
      } else {
        this.hideTags();
      }
    }

    /**
     * Display tags in the UI
     * @param {Array} tags - Array of tag objects
     */
    displayTags(tags) {
      if (!this.tagsContainer || !this.tagsList) return;

      // Show tags container
      this.tagsContainer.style.display = 'block';

      // Clear existing tags
      this.tagsList.innerHTML = '';

      // Add tags
      tags.forEach(tag => {
        const tagElement = this.createTagElement(tag);
        this.tagsList.appendChild(tagElement);
      });
    }

    /**
     * Create a tag element with delete button
     * @param {object} tag - Tag object with id and tag properties
     * @returns {HTMLElement} Tag element
     */
    createTagElement(tag) {
      const tagElement = document.createElement('div');
      tagElement.className = 'image-tag';

      const tagText = document.createElement('span');
      tagText.className = 'image-tag-text';
      tagText.textContent = tag.tag;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'image-tag-delete';
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;

      deleteBtn.addEventListener('click', async () => {
        const confirmDelete = confirm(`¿Deseas eliminar la etiqueta "${tag.tag}"?`);
        if (confirmDelete) {
          await this.deleteTag(tag.id);
        }
      });

      tagElement.appendChild(tagText);
      tagElement.appendChild(deleteBtn);

      return tagElement;
    }

    /**
     * Delete a tag by ID
     * @param {number} tagId - Tag ID to delete
     */
    async deleteTag(tagId) {
      const deleteResult = await this.electronAPI.deleteImageTag(tagId);
      if (deleteResult.success) {
        // Reload tags
        await this.loadTags();
      } else {
        this.showInfoModal('Error', 'Error al eliminar la etiqueta: ' + deleteResult.error);
      }
    }

    /**
     * Hide tags container
     */
    hideTags() {
      if (this.tagsContainer) {
        this.tagsContainer.style.display = 'none';
      }
    }

    /**
     * Show all tagged images in a modal
     */
    async showTaggedImages() {
      if (!this.checkProjectOpen()) return;

      if (!this.taggedImagesModal || !this.taggedImagesContainer) {
        console.error('[ImageTagsManager] Tagged images modal elements not configured');
        return;
      }

      // Show loading state
      this.taggedImagesContainer.innerHTML = '<div class="loading">Cargando imágenes con etiquetas...</div>';
      this.taggedImagesModal.classList.add('show');

      // Fetch all images with tags
      const result = await this.electronAPI.getAllImagesWithTags();

      if (!result.success) {
        this.taggedImagesContainer.innerHTML = `<div class="tagged-images-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p>Error al cargar las imágenes: ${result.error}</p>
        </div>`;
        return;
      }

      // Clear container
      this.taggedImagesContainer.innerHTML = '';

      if (result.images.length === 0) {
        // Show empty state
        this.taggedImagesContainer.innerHTML = `<div class="tagged-images-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <p>No hay imágenes con etiquetas</p>
        </div>`;
      } else {
        // Display images with tags
        result.images.forEach(imageData => {
          const imageItem = this.createTaggedImageItem(imageData);
          this.taggedImagesContainer.appendChild(imageItem);
        });
      }

      // Setup close button
      this.setupTaggedImagesCloseButton();
    }

    /**
     * Create a tagged image item element
     * @param {object} imageData - Image data with path and tags
     * @returns {HTMLElement} Tagged image item element
     */
    createTaggedImageItem(imageData) {
      const imageItem = document.createElement('div');
      imageItem.className = 'tagged-image-item';

      // Image preview
      const imagePreview = document.createElement('img');
      imagePreview.className = 'tagged-image-preview';
      imagePreview.src = `file://${imageData.path}`;
      imagePreview.alt = 'Imagen con etiquetas';

      // Tags container
      const tagsContainer = document.createElement('div');
      tagsContainer.className = 'tagged-image-tags';

      imageData.tags.forEach(tag => {
        const tagElement = document.createElement('div');
        tagElement.className = 'tagged-image-tag';
        tagElement.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
          <span>${tag.tag}</span>
        `;
        tagsContainer.appendChild(tagElement);
      });

      // Add elements to item
      imageItem.appendChild(imagePreview);
      imageItem.appendChild(tagsContainer);

      // Add click handler to show full image
      imageItem.addEventListener('click', () => {
        // Show image in preview
        if (this.imageGridManager && this.imageGridManager.showImageByPath(imageData.path)) {
          this.taggedImagesModal.classList.remove('show');
        }
      });

      return imageItem;
    }

    /**
     * Setup close button for tagged images modal
     */
    setupTaggedImagesCloseButton() {
      if (!this.taggedImagesCloseBtn) return;

      // Clone button to remove old event listeners
      const newCloseBtn = this.taggedImagesCloseBtn.cloneNode(true);
      this.taggedImagesCloseBtn.parentNode.replaceChild(newCloseBtn, this.taggedImagesCloseBtn);

      // Store reference to new button
      this.taggedImagesCloseBtn = newCloseBtn;

      newCloseBtn.addEventListener('click', () => {
        this.taggedImagesModal.classList.remove('show');
      });
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ImageTagsManager };
  } else if (typeof window !== 'undefined') {
    global.ImageTagsManager = ImageTagsManager;
  }
})(typeof window !== 'undefined' ? window : global);
