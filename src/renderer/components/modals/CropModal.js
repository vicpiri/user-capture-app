/**
 * CropModal - Choose the part of a captured photo to keep
 *
 * Shows the photo as large as fits, with a rectangle that can be moved and
 * resized from its edges and corners, and a choice of proportion: free, 3:4,
 * 1:1 or that of the photo. The last one chosen is remembered.
 *
 * The rectangle is kept in pixels of the photo as shown (after its EXIF
 * orientation), whatever size it is drawn at, and that is what it resolves
 * with. Cropping the file is up to the caller.
 *
 * @extends BaseModal
 */

(function(global) {
  'use strict';

  let BaseModal;
  if (typeof window !== 'undefined' && window.BaseModal) {
    BaseModal = window.BaseModal;
  } else if (typeof require !== 'undefined') {
    ({ BaseModal } = require('../../core/BaseModal'));
  }

  // Smallest side of the crop, in pixels of the photo
  const MIN_SIZE = 32;

  // width / height; null is free and 'original' that of the photo
  const RATIOS = {
    free: null,
    '3:4': 3 / 4,
    '1:1': 1,
    original: 'original'
  };

  const RATIO_KEY = 'edu-user-capture:crop-ratio';

  // ==========================================================================
  // Geometry, in pixels of the photo. A rect is { left, top, width, height }
  // and bounds are { width, height } of the photo.
  // ==========================================================================

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  /**
   * Width / height of a proportion key, or null when free
   * @param {string} key
   * @param {{width: number, height: number}} bounds
   * @returns {number|null}
   */
  function ratioValue(key, bounds) {
    const ratio = RATIOS[key];
    if (ratio === 'original') return bounds.width / bounds.height;
    return typeof ratio === 'number' ? ratio : null;
  }

  /**
   * The largest rectangle of the proportion, in the middle of the photo; the
   * whole photo when free
   */
  function initialRect(bounds, ratio) {
    if (!ratio) {
      return { left: 0, top: 0, width: bounds.width, height: bounds.height };
    }
    const width = Math.min(bounds.width, bounds.height * ratio);
    const height = width / ratio;
    return {
      left: (bounds.width - width) / 2,
      top: (bounds.height - height) / 2,
      width,
      height
    };
  }

  /**
   * The largest rectangle of the proportion that fits in the current one,
   * around the same centre: the framing chosen so far is kept
   */
  function fitRatio(rect, ratio) {
    if (!ratio) return { ...rect };
    let width = rect.width;
    let height = width / ratio;
    if (height > rect.height) {
      height = rect.height;
      width = height * ratio;
    }
    return {
      left: rect.left + (rect.width - width) / 2,
      top: rect.top + (rect.height - height) / 2,
      width,
      height
    };
  }

  /**
   * The rectangle dragged by (dx, dy), without leaving the photo
   */
  function moveRect(rect, dx, dy, bounds) {
    return {
      ...rect,
      left: clamp(rect.left + dx, 0, bounds.width - rect.width),
      top: clamp(rect.top + dy, 0, bounds.height - rect.height)
    };
  }

  /**
   * The rectangle with one edge or corner dragged by (dx, dy)
   *
   * The opposite edge or corner stays put. With a proportion, dragging an
   * edge grows the other side around its middle, and dragging a corner
   * follows whichever direction moved more. Never leaves the photo nor goes
   * under MIN_SIZE.
   *
   * @param {Object} rect - as it was when the drag started
   * @param {string} handle - n, s, e, w, ne, nw, se or sw
   * @param {number} dx - total movement since the drag started
   * @param {number} dy
   * @param {{width: number, height: number}} bounds
   * @param {number|null} ratio
   */
  function resizeRect(rect, handle, dx, dy, bounds, ratio) {
    const right = rect.left + rect.width;
    const bottom = rect.top + rect.height;
    const west = handle.includes('w');
    const east = handle.includes('e');
    const north = handle.includes('n');
    const south = handle.includes('s');
    const minSize = Math.min(MIN_SIZE, bounds.width, bounds.height);

    if (!ratio) {
      const left = west ? clamp(rect.left + dx, 0, right - minSize) : rect.left;
      const newRight = east ? clamp(right + dx, rect.left + minSize, bounds.width) : right;
      const top = north ? clamp(rect.top + dy, 0, bottom - minSize) : rect.top;
      const newBottom = south ? clamp(bottom + dy, rect.top + minSize, bounds.height) : bottom;
      return { left, top, width: newRight - left, height: newBottom - top };
    }

    // What stays put: the opposite edge, or the middle when that side is not
    // dragged
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const anchorX = west ? right : east ? rect.left : centerX;
    const anchorY = north ? bottom : south ? rect.top : centerY;

    const draggedWidth = rect.width + (west ? -dx : east ? dx : 0);
    const draggedHeight = rect.height + (north ? -dy : south ? dy : 0);

    let width;
    if ((west || east) && (north || south)) {
      width = Math.abs(dx) >= Math.abs(dy) * ratio ? draggedWidth : draggedHeight * ratio;
    } else if (west || east) {
      width = draggedWidth;
    } else {
      width = draggedHeight * ratio;
    }

    // Room from the anchor to the edges of the photo
    const roomX = west ? anchorX : east ? bounds.width - anchorX : 2 * Math.min(anchorX, bounds.width - anchorX);
    const roomY = north ? anchorY : south ? bounds.height - anchorY : 2 * Math.min(anchorY, bounds.height - anchorY);
    const maxWidth = Math.min(roomX, roomY * ratio);
    const minWidth = Math.min(maxWidth, Math.max(minSize, minSize * ratio));

    width = clamp(width, minWidth, maxWidth);
    const height = width / ratio;

    return {
      left: west ? anchorX - width : east ? anchorX : anchorX - width / 2,
      top: north ? anchorY - height : south ? anchorY : anchorY - height / 2,
      width,
      height
    };
  }

  /**
   * Whole pixels, inside the photo, for the main process
   */
  function roundRect(rect, bounds) {
    const left = clamp(Math.round(rect.left), 0, bounds.width - 1);
    const top = clamp(Math.round(rect.top), 0, bounds.height - 1);
    return {
      left,
      top,
      width: clamp(Math.round(rect.width), 1, bounds.width - left),
      height: clamp(Math.round(rect.height), 1, bounds.height - top)
    };
  }

  const cropGeometry = { MIN_SIZE, RATIOS, ratioValue, initialRect, fitRatio, moveRect, resizeRect, roundRect };

  // ==========================================================================
  // Dialog
  // ==========================================================================

  class CropModal extends BaseModal {
    constructor() {
      super('crop-image-modal', {
        defaultButtonSelector: '#crop-apply-btn'
      });

      this.stage = null;
      this.image = null;
      this.box = null;
      this.sizeLabel = null;
      this.note = null;
      this.ratioButtons = [];
      this.applyBtn = null;
      this.cancelBtn = null;

      this.bounds = null;
      this.rect = null;
      this.ratioKey = 'free';
      this.drag = null;
      this.resolvePromise = null;
    }

    init() {
      super.init();
      if (!this.modal) return;

      this.stage = this.modal.querySelector('#crop-stage');
      this.image = this.modal.querySelector('#crop-image');
      this.box = this.modal.querySelector('#crop-box');
      this.sizeLabel = this.modal.querySelector('#crop-size');
      this.note = this.modal.querySelector('#crop-original-note');
      this.ratioButtons = Array.from(this.modal.querySelectorAll('[data-crop-ratio]'));
      this.applyBtn = this.modal.querySelector('#crop-apply-btn');
      this.cancelBtn = this.modal.querySelector('#crop-cancel-btn');

      this.ratioButtons.forEach((button) => {
        this.addEventListener(button, 'click', () => this.setRatio(button.dataset.cropRatio));
      });
      this.addEventListener(this.applyBtn, 'click', () => this.finish(true));
      this.addEventListener(this.cancelBtn, 'click', () => this.finish(false));

      this.addEventListener(this.box, 'pointerdown', (event) => this.startDrag(event));
      this.addEventListener(this.box, 'pointermove', (event) => this.continueDrag(event));
      this.addEventListener(this.box, 'pointerup', (event) => this.endDrag(event));
      this.addEventListener(this.box, 'pointercancel', (event) => this.endDrag(event));

      // Until the photo is drawn there is no scale to place the rectangle with
      this.addEventListener(this.image, 'load', () => {
        if (this.box) this.box.hidden = false;
        this.render();
      });
      if (typeof window !== 'undefined') {
        this.addEventListener(window, 'resize', () => this.render());
      }
    }

    /**
     * @param {Object} source
     * @param {string} source.url - of the photo to crop from
     * @param {number} source.width - as shown, after its EXIF orientation
     * @param {number} source.height
     * @param {boolean} [source.hasOriginal] - it was cropped before, and this
     *   is its original
     * @returns {Promise<Object|null>} the rectangle in whole pixels, or null
     */
    show({ url, width, height, hasOriginal = false }) {
      return new Promise((resolve) => {
        this.resolvePromise = resolve;
        this.bounds = { width, height };
        this.ratioKey = loadRatioKey();
        this.rect = initialRect(this.bounds, ratioValue(this.ratioKey, this.bounds));
        this.drag = null;

        if (this.note) this.note.hidden = !hasOriginal;
        if (this.box) this.box.hidden = true;
        this.updateRatioButtons();

        this.open();
        if (this.image) this.image.src = url;
        this.render();
      });
    }

    /**
     * @param {string} key - one of RATIOS
     */
    setRatio(key) {
      if (!(key in RATIOS) || !this.bounds) return;
      this.ratioKey = key;
      saveRatioKey(key);
      // The framing chosen so far is kept: the new proportion fits inside it,
      // and free leaves it as it is
      this.rect = fitRatio(this.rect, ratioValue(key, this.bounds));
      this.updateRatioButtons();
      this.render();
    }

    updateRatioButtons() {
      this.ratioButtons.forEach((button) => {
        const active = button.dataset.cropRatio === this.ratioKey;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }

    /**
     * Screen pixels per photo pixel, as the photo is drawn now
     * @returns {number}
     */
    scale() {
      if (!this.image || !this.bounds || !this.image.clientWidth) return 1;
      return this.image.clientWidth / this.bounds.width;
    }

    render() {
      if (!this.box || !this.rect) return;
      const scale = this.scale();
      const offsetLeft = this.image ? this.image.offsetLeft : 0;
      const offsetTop = this.image ? this.image.offsetTop : 0;

      this.box.style.left = `${offsetLeft + this.rect.left * scale}px`;
      this.box.style.top = `${offsetTop + this.rect.top * scale}px`;
      this.box.style.width = `${this.rect.width * scale}px`;
      this.box.style.height = `${this.rect.height * scale}px`;

      if (this.sizeLabel) {
        const { width, height } = roundRect(this.rect, this.bounds);
        this.sizeLabel.textContent = `${width} × ${height} px`;
      }
    }

    startDrag(event) {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      const handle = event.target && event.target.dataset ? event.target.dataset.cropHandle : null;
      this.drag = {
        handle: handle || 'move',
        startX: event.clientX,
        startY: event.clientY,
        startRect: { ...this.rect },
        pointerId: event.pointerId
      };
      if (this.box.setPointerCapture && event.pointerId !== undefined) {
        try {
          this.box.setPointerCapture(event.pointerId);
        } catch (error) {
          // Not a live pointer (tests); the moves still arrive
        }
      }
    }

    continueDrag(event) {
      if (!this.drag) return;
      const scale = this.scale();
      const dx = (event.clientX - this.drag.startX) / scale;
      const dy = (event.clientY - this.drag.startY) / scale;

      this.rect = this.drag.handle === 'move'
        ? moveRect(this.drag.startRect, dx, dy, this.bounds)
        : resizeRect(this.drag.startRect, this.drag.handle, dx, dy, this.bounds, ratioValue(this.ratioKey, this.bounds));
      this.render();
    }

    endDrag() {
      this.drag = null;
    }

    /**
     * @param {boolean} apply
     */
    finish(apply) {
      const resolve = this.resolvePromise;
      this.resolvePromise = null;
      const result = apply && this.rect ? roundRect(this.rect, this.bounds) : null;
      this.close();
      if (resolve) resolve(result);
    }

    close() {
      super.close();
      if (this.image) this.image.removeAttribute('src');
      // Closed without an answer: cancelled
      if (this.resolvePromise) {
        const resolve = this.resolvePromise;
        this.resolvePromise = null;
        resolve(null);
      }
    }
  }

  function loadRatioKey() {
    try {
      const key = localStorage.getItem(RATIO_KEY);
      return key in RATIOS ? key : 'free';
    } catch (error) {
      return 'free';
    }
  }

  function saveRatioKey(key) {
    try {
      localStorage.setItem(RATIO_KEY, key);
    } catch (error) {
      // Not remembered this time
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CropModal, cropGeometry };
  } else if (typeof window !== 'undefined') {
    global.CropModal = CropModal;
  }
})(typeof window !== 'undefined' ? window : global);
