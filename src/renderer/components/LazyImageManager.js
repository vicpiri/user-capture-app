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

      console.log('[LazyImageManager] Initialized');
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

        console.log(`[LazyImageManager] Starting to load image: ${imageSrc.substring(0, 50)}...`);
        console.log(`[LazyImageManager] Image classes before load:`, img.classList.toString());
        console.log(`[LazyImageManager] Image has parent wrapper:`, img.parentElement?.className);

        // Set up onload handler to remove spinner when image actually loads
        img.onload = () => {
          const loadDuration = Date.now() - loadStartTime;
          console.log(`[LazyImageManager] ✓ Image LOADED (onload fired in ${loadDuration}ms): ${imageSrc.substring(0, 50)}...`);
          console.log(`[LazyImageManager] Image classes before removing lazy-image:`, img.classList.toString());

          // Ensure spinner is visible for at least 200ms so user can see it
          const minSpinnerDuration = 200;
          const remainingTime = Math.max(0, minSpinnerDuration - loadDuration);

          setTimeout(() => {
            img.classList.remove('lazy-image');
            img.classList.add('lazy-loaded');

            // Also remove 'loading' class from parent wrapper if it exists
            if (img.parentElement && img.parentElement.classList.contains('loading')) {
              img.parentElement.classList.remove('loading');
              console.log(`[LazyImageManager] Removed 'loading' class from wrapper`);
            }

            console.log(`[LazyImageManager] Image classes after removing lazy-image:`, img.classList.toString());
          }, remainingTime);
        };

        // Set up onerror handler
        img.onerror = () => {
          console.log(`[LazyImageManager] ✗ Image ERROR: ${imageSrc.substring(0, 50)}...`);
          img.classList.remove('lazy-image');
          img.classList.add('lazy-error');
        };

        // Start loading the image (spinner will stay visible until onload fires)
        img.src = imageSrc;
        img.removeAttribute('data-src');
        console.log(`[LazyImageManager] Set img.src, spinner should be visible now`);

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

      console.log(`[LazyImageManager] === observeAll() called ===`);
      const lazyImages = document.querySelectorAll(this.imageSelector);
      console.log(`[LazyImageManager] Found ${lazyImages.length} images with selector '${this.imageSelector}'`);

      let loadedImmediately = 0;
      let observedForLater = 0;
      let alreadyLoaded = 0;

      lazyImages.forEach((img, index) => {
        // Skip images that are already loaded
        if (!img.dataset.src) {
          alreadyLoaded++;
          return;
        }

        console.log(`[LazyImageManager] Image ${index + 1}: classes=${img.classList.toString()}, parent=${img.parentElement?.className}`);

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
          console.log(`[LazyImageManager] Image ${index + 1} is IN viewport, loading immediately`);
          this.loadImage(img, this.observer);
          loadedImmediately++;
        } else {
          // Image is not visible yet, observe it
          console.log(`[LazyImageManager] Image ${index + 1} is OUT of viewport, will observe`);
          this.observer.observe(img);
          observedForLater++;
        }
      });

      console.log(`[LazyImageManager] === Summary: ${alreadyLoaded} already loaded, ${loadedImmediately} loaded immediately, ${observedForLater} observing for later ===`);
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
        console.log('[LazyImageManager] Disconnected');
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

      console.log(`[LazyImageManager] Loaded ${lazyImages.length} images immediately`);
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
