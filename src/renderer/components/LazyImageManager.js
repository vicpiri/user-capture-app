/**
 * LazyImageManager - Manages lazy loading of images using IntersectionObserver
 *
 * Handles efficient image loading for better performance:
 * - Uses IntersectionObserver API to load images only when visible
 * - Configurable root margin and threshold
 * - Automatic cleanup and re-initialization
 * - Observes all images with 'lazy-image' class
 *
 * Features:
 * - Lazy load images as they enter viewport
 * - Reduce initial page load time
 * - Improve performance for pages with many images
 * - Clean up observers properly
 */

(function(global) {
  'use strict';

  class LazyImageManager {
    constructor(config = {}) {
      // Configuration
      this.rootMargin = config.rootMargin || '50px'; // Start loading 50px before entering viewport
      this.threshold = config.threshold || 0.01; // Trigger when 1% of image is visible
      this.imageSelector = config.imageSelector || '.lazy-image';

      // State
      this.observer = null;
    }

    /**
     * Initialize the IntersectionObserver
     */
    init() {
      // Disconnect previous observer if exists
      if (this.observer) {
        this.disconnect();
      }

      // Create intersection observer for lazy loading
      const options = {
        root: null, // Use viewport as root
        rootMargin: this.rootMargin,
        threshold: this.threshold
      };

      this.observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target, observer);
          }
        });
      }, options);
    }

    /**
     * Load an image
     * @param {HTMLImageElement} img - Image element to load
     * @param {IntersectionObserver} observer - Observer instance
     */
    loadImage(img, observer) {
      // Load the image
      if (img.dataset.src) {
        const imageSrc = img.dataset.src;
        const loadStartTime = Date.now();

        // Set up onload handler to remove spinner when image actually loads
        img.onload = () => {
          const loadDuration = Date.now() - loadStartTime;

          // Ensure spinner is visible for at least 200ms so user can see it
          const minSpinnerDuration = 200;
          const remainingTime = Math.max(0, minSpinnerDuration - loadDuration);

          setTimeout(() => {
            img.classList.remove('lazy-image');
            img.classList.add('lazy-loaded');

            // Also remove 'loading' class from parent wrapper if it exists
            if (img.parentElement && img.parentElement.classList.contains('loading')) {
              img.parentElement.classList.remove('loading');
            }
          }, remainingTime);
        };

        // Set up onerror handler
        img.onerror = () => {
          img.classList.remove('lazy-image');
          img.classList.add('lazy-error');
        };

        // Start loading the image (spinner will stay visible until onload fires)
        img.src = imageSrc;
        img.removeAttribute('data-src');

        // Stop observing this image
        observer.unobserve(img);
      }
    }

    /**
     * Observe all lazy images in the document
     */
    observeAll() {
      if (!this.observer) {
        this.init();
      }

      const lazyImages = document.querySelectorAll(this.imageSelector);
      let loadedImmediately = 0;
      let observedForLater = 0;

      lazyImages.forEach(img => {
        // Skip images that are already loaded
        if (!img.dataset.src) {
          return;
        }

        // Check if image is already in viewport
        const rect = img.getBoundingClientRect();
        const isInViewport = (
          rect.top >= -100 && // Give some margin
          rect.left >= -100 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) + 100 &&
          rect.right <= (window.innerWidth || document.documentElement.clientWidth) + 100
        );

        if (isInViewport) {
          // Image is already visible, load it immediately
          this.loadImage(img, this.observer);
          loadedImmediately++;
        } else {
          // Image is not visible yet, observe it
          this.observer.observe(img);
          observedForLater++;
        }
      });
    }

    /**
     * Observe a specific image
     * @param {HTMLImageElement} img - Image element to observe
     */
    observe(img) {
      if (!this.observer) {
        this.init();
      }

      if (img && img.classList.contains('lazy-image')) {
        this.observer.observe(img);
      }
    }

    /**
     * Unobserve a specific image
     * @param {HTMLImageElement} img - Image element to unobserve
     */
    unobserve(img) {
      if (this.observer && img) {
        this.observer.unobserve(img);
      }
    }

    /**
     * Disconnect the observer
     */
    disconnect() {
      if (this.observer) {
        this.observer.disconnect();
      }
    }

    /**
     * Check if observer is active
     * @returns {boolean} True if observer exists
     */
    isActive() {
      return this.observer !== null;
    }

    /**
     * Force load all lazy images immediately (without observing)
     */
    loadAllImmediate() {
      const lazyImages = document.querySelectorAll(this.imageSelector);

      lazyImages.forEach(img => {
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          img.classList.remove('lazy-image');
          img.classList.add('lazy-loaded');
        }
      });
    }

    /**
     * Reset - disconnect and clear observer
     */
    reset() {
      this.disconnect();
      this.observer = null;
    }
  }

  // Export (for tests and browser)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LazyImageManager };
  } else if (typeof window !== 'undefined') {
    global.LazyImageManager = LazyImageManager;
  }
})(typeof window !== 'undefined' ? window : global);
