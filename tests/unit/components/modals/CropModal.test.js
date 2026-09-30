/**
 * Tests for CropModal: the geometry of the rectangle, and the dialog
 *
 * @jest-environment jsdom
 */

const { CropModal, cropGeometry } = require('../../../../src/renderer/components/modals/CropModal');

const { MIN_SIZE, ratioValue, initialRect, fitRatio, moveRect, resizeRect, roundRect } = cropGeometry;

// A 1280 x 720 webcam photo
const BOUNDS = { width: 1280, height: 720 };

const expectRect = (rect, expected) => {
  Object.entries(expected).forEach(([key, value]) => expect(rect[key]).toBeCloseTo(value, 5));
};

const expectInside = (rect, bounds = BOUNDS) => {
  expect(rect.left).toBeGreaterThanOrEqual(-1e-9);
  expect(rect.top).toBeGreaterThanOrEqual(-1e-9);
  expect(rect.left + rect.width).toBeLessThanOrEqual(bounds.width + 1e-9);
  expect(rect.top + rect.height).toBeLessThanOrEqual(bounds.height + 1e-9);
};

describe('crop geometry', () => {
  describe('ratioValue', () => {
    test('free has no proportion, the others width / height', () => {
      expect(ratioValue('free', BOUNDS)).toBeNull();
      expect(ratioValue('3:4', BOUNDS)).toBeCloseTo(0.75);
      expect(ratioValue('1:1', BOUNDS)).toBe(1);
      expect(ratioValue('original', BOUNDS)).toBeCloseTo(1280 / 720);
    });
  });

  describe('initialRect', () => {
    test('free takes the whole photo', () => {
      expect(initialRect(BOUNDS, null)).toEqual({ left: 0, top: 0, width: 1280, height: 720 });
    });

    test('a proportion takes the largest rectangle, in the middle', () => {
      expectRect(initialRect(BOUNDS, 3 / 4), { left: 370, top: 0, width: 540, height: 720 });
    });

    test('on a portrait photo, a wide proportion fills the width', () => {
      expectRect(initialRect({ width: 600, height: 800 }, 1), { left: 0, top: 100, width: 600, height: 600 });
    });
  });

  describe('fitRatio', () => {
    test('fits the proportion inside the current rectangle, around its centre', () => {
      const rect = { left: 100, top: 100, width: 400, height: 400 };
      expectRect(fitRatio(rect, 3 / 4), { left: 150, top: 100, width: 300, height: 400 });
    });

    test('leaves the rectangle as it is when free', () => {
      const rect = { left: 1, top: 2, width: 3, height: 4 };
      expect(fitRatio(rect, null)).toEqual(rect);
    });
  });

  describe('moveRect', () => {
    const rect = { left: 100, top: 100, width: 200, height: 300 };

    test('moves by the drag', () => {
      expect(moveRect(rect, 50, -20, BOUNDS)).toEqual({ left: 150, top: 80, width: 200, height: 300 });
    });

    test('stops at the edges of the photo, keeping its size', () => {
      expect(moveRect(rect, -500, 900, BOUNDS)).toEqual({ left: 0, top: 420, width: 200, height: 300 });
    });
  });

  describe('resizeRect, free', () => {
    const rect = { left: 100, top: 100, width: 400, height: 300 };

    test('an edge moves only that edge', () => {
      expect(resizeRect(rect, 'e', 50, 999, BOUNDS, null)).toEqual({ left: 100, top: 100, width: 450, height: 300 });
      expect(resizeRect(rect, 'n', 999, -40, BOUNDS, null)).toEqual({ left: 100, top: 60, width: 400, height: 340 });
    });

    test('a corner moves both of its edges', () => {
      expect(resizeRect(rect, 'nw', 30, 20, BOUNDS, null)).toEqual({ left: 130, top: 120, width: 370, height: 280 });
    });

    test('stops at the edges of the photo', () => {
      expect(resizeRect(rect, 'se', 5000, 5000, BOUNDS, null)).toEqual({ left: 100, top: 100, width: 1180, height: 620 });
    });

    test('never goes under the minimum size, nor turns inside out', () => {
      const shrunk = resizeRect(rect, 'w', 1000, 0, BOUNDS, null);
      expect(shrunk.width).toBe(MIN_SIZE);
      expect(shrunk.left + shrunk.width).toBe(500);
    });
  });

  describe('resizeRect, with a proportion', () => {
    const ratio = 3 / 4;
    const rect = { left: 400, top: 100, width: 300, height: 400 };

    test('a corner keeps the opposite corner and the proportion', () => {
      const result = resizeRect(rect, 'se', 60, 10, BOUNDS, ratio);
      expectRect(result, { left: 400, top: 100, width: 360, height: 480 });
    });

    test('a corner follows whichever direction moved more', () => {
      const result = resizeRect(rect, 'se', 0, 80, BOUNDS, ratio);
      expectRect(result, { left: 400, top: 100, width: 360, height: 480 });
    });

    test('an edge grows the other side around its middle', () => {
      const result = resizeRect(rect, 'e', 60, 0, BOUNDS, ratio);
      expectRect(result, { left: 400, top: 60, width: 360, height: 480 });
    });

    test('a top edge keeps the bottom one', () => {
      const result = resizeRect(rect, 'n', 0, -80, BOUNDS, ratio);
      expectRect(result, { left: 370, top: 20, width: 360, height: 480 });
    });

    test('stops where the photo ends, keeping the proportion', () => {
      const result = resizeRect(rect, 'se', 5000, 5000, BOUNDS, ratio);
      expectRect(result, { left: 400, top: 100, width: 465, height: 620 });
      expectInside(result);
    });

    test('an edge stops where the side growing around its middle hits the photo', () => {
      // Middle line at 150: 150 above and 220 below, so 300 of height at most
      const narrow = { left: 400, top: 100, width: 75, height: 100 };
      const result = resizeRect(narrow, 'e', 5000, 0, { width: 1280, height: 370 }, ratio);
      expectInside(result, { width: 1280, height: 370 });
      expect(result.width / result.height).toBeCloseTo(ratio);
      expect(result.height).toBeCloseTo(300);
      expect(result.top).toBeCloseTo(0);
    });

    test('never goes under the minimum size', () => {
      const result = resizeRect(rect, 'nw', 5000, 5000, BOUNDS, ratio);
      expect(Math.min(result.width, result.height)).toBeCloseTo(MIN_SIZE);
      expect(result.width / result.height).toBeCloseTo(ratio);
    });
  });

  describe('roundRect', () => {
    test('gives whole pixels inside the photo', () => {
      expect(roundRect({ left: 369.6, top: -0.2, width: 540.4, height: 720.3 }, BOUNDS))
        .toEqual({ left: 370, top: 0, width: 540, height: 720 });
    });
  });
});

describe('CropModal', () => {
  let modal;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="crop-image-modal" class="modal">
        <button data-crop-ratio="free">Libre</button>
        <button data-crop-ratio="3:4">3:4</button>
        <button data-crop-ratio="1:1">1:1</button>
        <button data-crop-ratio="original">Original</button>
        <span id="crop-size"></span>
        <div id="crop-stage">
          <img id="crop-image">
          <div id="crop-box" hidden><span data-crop-handle="se"></span></div>
        </div>
        <p id="crop-original-note" hidden></p>
        <button id="crop-apply-btn">Recortar</button>
        <button id="crop-cancel-btn" data-modal-cancel>Cancelar</button>
      </div>
    `;
    modal = new CropModal();
    modal.init();
  });

  afterEach(() => {
    modal.destroy();
    document.body.innerHTML = '';
  });

  const show = (options = {}) => modal.show({ url: 'app-img://img/?path=x', width: 1280, height: 720, ...options });

  test('resolves with the whole photo, in whole pixels, when applied as it opens', async () => {
    const promise = show();
    modal.applyBtn.click();

    await expect(promise).resolves.toEqual({ left: 0, top: 0, width: 1280, height: 720 });
  });

  test('resolves with null when cancelled', async () => {
    const promise = show();
    modal.cancelBtn.click();

    await expect(promise).resolves.toBeNull();
  });

  test('shows the size of the crop', () => {
    show();
    expect(modal.sizeLabel.textContent).toBe('1280 × 720 px');
    modal.cancelBtn.click();
  });

  test('a proportion fits inside the current framing and is marked', async () => {
    const promise = show();
    modal.modal.querySelector('[data-crop-ratio="3:4"]').click();

    expect(modal.modal.querySelector('[data-crop-ratio="3:4"]').classList.contains('is-active')).toBe(true);
    expect(modal.modal.querySelector('[data-crop-ratio="free"]').classList.contains('is-active')).toBe(false);
    modal.applyBtn.click();
    await expect(promise).resolves.toEqual({ left: 370, top: 0, width: 540, height: 720 });
  });

  test('remembers the last proportion for the next photo', async () => {
    show();
    modal.modal.querySelector('[data-crop-ratio="1:1"]').click();
    modal.cancelBtn.click();

    const promise = show();
    modal.applyBtn.click();

    await expect(promise).resolves.toEqual({ left: 280, top: 0, width: 720, height: 720 });
  });

  test('says when it shows the original of a photo cropped before', () => {
    show({ hasOriginal: true });
    expect(modal.note.hidden).toBe(false);
    modal.cancelBtn.click();

    show({ hasOriginal: false });
    expect(modal.note.hidden).toBe(true);
    modal.cancelBtn.click();
  });

  test('hides the rectangle until the photo is drawn', () => {
    show();
    expect(modal.box.hidden).toBe(true);

    modal.image.dispatchEvent(new Event('load'));
    expect(modal.box.hidden).toBe(false);
    modal.cancelBtn.click();
  });

  test('dragging a handle resizes, in pixels of the photo whatever the drawn size', async () => {
    const promise = show();
    // Drawn at half size
    Object.defineProperty(modal.image, 'clientWidth', { value: 640, configurable: true });
    const handle = modal.box.querySelector('[data-crop-handle="se"]');

    handle.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 640, clientY: 360, button: 0 }));
    modal.box.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 540, clientY: 300 }));
    modal.box.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    modal.applyBtn.click();

    await expect(promise).resolves.toEqual({ left: 0, top: 0, width: 1080, height: 600 });
  });

  test('dragging inside the rectangle moves it', async () => {
    const promise = show();
    modal.modal.querySelector('[data-crop-ratio="1:1"]').click();
    Object.defineProperty(modal.image, 'clientWidth', { value: 1280, configurable: true });

    modal.box.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 500, clientY: 300, button: 0 }));
    modal.box.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 300, clientY: 300 }));
    modal.box.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    modal.applyBtn.click();

    await expect(promise).resolves.toEqual({ left: 80, top: 0, width: 720, height: 720 });
  });
});
