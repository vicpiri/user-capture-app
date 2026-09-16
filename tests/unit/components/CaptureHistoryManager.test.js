/**
 * Tests for CaptureHistoryManager
 *
 * The strip is a view over the array the viewer already navigates, so what
 * matters is that it stays in step with the viewer's cursor, that it reuses
 * thumbnails instead of rebuilding them, and that it generates nothing while
 * it is hidden.
 */

const { CaptureHistoryManager } = require('../../../src/renderer/components/CaptureHistoryManager');
const { imageUrl } = require('../../../src/renderer/utils/imageUrl');

describe('CaptureHistoryManager', () => {
  let manager;
  let panel;
  let list;
  let empty;
  let mockObserver;
  let onSelect;

  const IMAGES = [
    'D:\\Proyecto\\imports\\20260101120003.jpg',
    'D:\\Proyecto\\imports\\20260101120002.jpg',
    'D:\\Proyecto\\imports\\20260101120001.jpg'
  ];

  beforeEach(() => {
    document.body.innerHTML = `
      <aside id="panel" class="capture-history">
        <div id="list" class="capture-history-list"></div>
        <div id="empty" class="capture-history-empty"></div>
      </aside>
    `;

    panel = document.getElementById('panel');
    list = document.getElementById('list');
    empty = document.getElementById('empty');

    mockObserver = {
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    };

    global.IntersectionObserver = jest.fn((callback, options) => {
      mockObserver.callback = callback;
      mockObserver.options = options;
      return mockObserver;
    });

    onSelect = jest.fn();

    manager = new CaptureHistoryManager({ panel, list, empty, onSelect });
    manager.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.IntersectionObserver;
  });

  const items = () => list.querySelectorAll('.capture-history-item');

  describe('visibility', () => {
    test('should start hidden', () => {
      expect(manager.isVisible()).toBe(false);
      expect(panel.classList.contains('is-open')).toBe(false);
    });

    test('should render nothing while hidden', () => {
      manager.render(IMAGES, 0);

      expect(items()).toHaveLength(0);
    });

    test('should catch up on the captures it was given while hidden', () => {
      manager.render(IMAGES, 1);
      manager.setVisible(true);

      expect(items()).toHaveLength(3);
      expect(items()[1].classList.contains('current')).toBe(true);
    });

    test('should show the panel when made visible', () => {
      manager.setVisible(true);

      expect(panel.classList.contains('is-open')).toBe(true);
      expect(manager.isVisible()).toBe(true);
    });

    test('should hide the panel again', () => {
      manager.setVisible(true);
      manager.setVisible(false);

      expect(panel.classList.contains('is-open')).toBe(false);
    });

    /**
     * utilities.css declares a global `.visible { display: block !important }`.
     * Marking the strip with that class turned it into a block, which stopped
     * the list being a flex item: it grew to fit all 800+ captures instead of
     * scrolling, so the strip had no scrollbar and the wheel did nothing.
     */
    test('should not mark the strip with the global visible utility', () => {
      manager.setVisible(true);

      expect(panel.classList.contains('visible')).toBe(false);
    });

    test('should not mark the empty message with the global visible utility', () => {
      manager.setVisible(true);
      manager.render([], -1);

      expect(empty.classList.contains('visible')).toBe(false);
    });
  });

  describe('render()', () => {
    beforeEach(() => {
      manager.setVisible(true);
    });

    test('should build one thumbnail per capture, in order', () => {
      manager.render(IMAGES, 0);

      const rendered = Array.from(items()).map((item) => item.dataset.path);
      expect(rendered).toEqual(IMAGES);
    });

    test('should index the thumbnails so a click maps to the viewer', () => {
      manager.render(IMAGES, 0);

      const indices = Array.from(items()).map((item) => item.dataset.index);
      expect(indices).toEqual(['0', '1', '2']);
    });

    test('should request a thumbnail, not the full size image', () => {
      manager.render(IMAGES, 0);
      mockObserver.callback([{ isIntersecting: true, target: items()[0] }]);

      const img = items()[0].querySelector('img');
      expect(img.getAttribute('src')).toBe(
        imageUrl.thumbnail(IMAGES[0], imageUrl.INDICATOR_SIZE)
      );
    });

    test('should leave thumbnails unloaded until they scroll into view', () => {
      manager.render(IMAGES, 0);

      const loaded = Array.from(items()).filter((item) => item.querySelector('img').getAttribute('src'));
      expect(loaded).toHaveLength(0);
      expect(mockObserver.observe).toHaveBeenCalledTimes(3);
    });

    test('should show the empty message when there are no captures', () => {
      manager.render([], -1);

      expect(empty.classList.contains('is-shown')).toBe(true);
      expect(items()).toHaveLength(0);
    });

    test('should hide the empty message once there are captures', () => {
      manager.render([], -1);
      manager.render(IMAGES, 0);

      expect(empty.classList.contains('is-shown')).toBe(false);
    });

    test('should reuse the thumbnail of a capture that is still there', () => {
      manager.render(IMAGES, 0);
      const before = items()[0];

      manager.render(IMAGES, 0);

      expect(items()[0]).toBe(before);
      // Reused, so no second request for the same thumbnail
      expect(mockObserver.observe).toHaveBeenCalledTimes(3);
    });

    test('should reindex reused thumbnails when a newer capture arrives', () => {
      manager.render(IMAGES, 0);
      const previouslyFirst = items()[0];

      const withNewCapture = ['D:\\Proyecto\\imports\\20260101120004.jpg', ...IMAGES];
      manager.render(withNewCapture, 0);

      expect(items()).toHaveLength(4);
      expect(items()[1]).toBe(previouslyFirst);
      expect(previouslyFirst.dataset.index).toBe('1');
      // Only the new capture is observed
      expect(mockObserver.observe).toHaveBeenCalledTimes(4);
    });

    test('should stop observing a capture that is gone', () => {
      manager.render(IMAGES, 0);
      const removed = items()[2];

      manager.render(IMAGES.slice(0, 2), 0);

      expect(items()).toHaveLength(2);
      expect(mockObserver.unobserve).toHaveBeenCalledWith(removed);
    });
  });

  describe('refreshThumbnail()', () => {
    // A photo that is turned keeps its name, and render() reuses the
    // thumbnail it already has for that path: the strip kept the old picture
    beforeEach(() => {
      manager.setVisible(true);
      manager.render(IMAGES, 0);
    });

    const imageOf = (index) => items()[index].querySelector('img');
    const versionOf = (url) => new URL(url).searchParams.get('v');

    test('loads a thumbnail already on screen again, with its new version', () => {
      mockObserver.callback([{ isIntersecting: true, target: items()[0] }]);
      const before = imageOf(0).src;
      const version = imageUrl.bumpVersion(IMAGES[0]);

      manager.refreshThumbnail(IMAGES[0]);

      expect(imageOf(0).src).not.toBe(before);
      expect(versionOf(imageOf(0).src)).toBe(String(version));
      expect(imageOf(0).classList.contains('loaded')).toBe(false);
    });

    test('leaves the other thumbnails alone', () => {
      mockObserver.callback([{ isIntersecting: true, target: items()[1] }]);
      const other = imageOf(1).src;

      manager.refreshThumbnail(IMAGES[0]);

      expect(imageOf(1).src).toBe(other);
    });

    test('updates one that has not loaded yet without loading it', () => {
      const version = imageUrl.bumpVersion(IMAGES[2]);

      manager.refreshThumbnail(IMAGES[2]);

      expect(imageOf(2).src).toBe('');
      expect(versionOf(imageOf(2).dataset.src)).toBe(String(version));
    });

    test('matches the path whatever its case', () => {
      mockObserver.callback([{ isIntersecting: true, target: items()[0] }]);
      const version = imageUrl.bumpVersion(IMAGES[0]);

      manager.refreshThumbnail(IMAGES[0].toLowerCase());

      expect(versionOf(imageOf(0).src)).toBe(String(version));
    });

    test('ignores a photo that is not in the strip', () => {
      expect(() => manager.refreshThumbnail('D:/otra/foto.jpg')).not.toThrow();
    });
  });

  describe('capture time', () => {
    beforeEach(() => {
      manager.setVisible(true);
    });

    const captions = () =>
      Array.from(list.querySelectorAll('.capture-history-caption')).map((el) => el.textContent);

    const days = () =>
      Array.from(list.querySelectorAll('.capture-history-day')).map((el) => el.textContent);

    test('should show the time each capture was taken', () => {
      manager.render(IMAGES, 0);

      expect(captions()).toEqual(['12:00:03', '12:00:02', '12:00:01']);
    });

    test('should read the time through the ordinal of a same-second capture', () => {
      manager.render(['D:\\Proyecto\\imports\\20260101120003_2.jpg'], 0);

      expect(captions()).toEqual(['12:00:03']);
    });

    test('should head each day of captures', () => {
      manager.render([
        'D:\\Proyecto\\imports\\20260112090000.jpg',
        'D:\\Proyecto\\imports\\20260111170000.jpg',
        'D:\\Proyecto\\imports\\20260111083000.jpg'
      ], 0);

      expect(days()).toEqual(['12/01/2026', '11/01/2026']);
    });

    test('should head a day once, however many captures it holds', () => {
      manager.render(IMAGES, 0);

      expect(days()).toEqual(['01/01/2026']);
    });

    test('should put the name and the moment in the tooltip', () => {
      manager.render(IMAGES, 0);

      expect(items()[0].title).toBe('20260101120003.jpg\n01/01/2026 12:00:03');
    });

    test('should fall back to the file name when it carries no timestamp', () => {
      manager.render(['D:\\Proyecto\\imports\\10894357.jpg'], 0);

      expect(captions()).toEqual(['10894357.jpg']);
      expect(items()[0].title).toBe('10894357.jpg');
    });

    test('should group the undated captures apart', () => {
      manager.render([
        'D:\\Proyecto\\imports\\20260101120003.jpg',
        'D:\\Proyecto\\imports\\10894357.jpg'
      ], 0);

      expect(days()).toEqual(['01/01/2026', 'Sin fecha en el nombre']);
    });

    test('should not mistake a name that only looks like a timestamp', () => {
      manager.render(['D:\\Proyecto\\imports\\202601011200031.jpg'], 0);

      expect(captions()).toEqual(['202601011200031.jpg']);
    });

    test('should keep the headings correct after a re-render', () => {
      manager.render(IMAGES, 0);
      manager.render(['D:\\Proyecto\\imports\\20260102080000.jpg', ...IMAGES], 0);

      expect(days()).toEqual(['02/01/2026', '01/01/2026']);
    });

    test('should still map a click to the right index despite the headings', () => {
      manager.render([
        'D:\\Proyecto\\imports\\20260112090000.jpg',
        'D:\\Proyecto\\imports\\20260111170000.jpg'
      ], 0);

      items()[1].click();

      expect(onSelect).toHaveBeenCalledWith(1);
    });
  });

  describe('selection', () => {
    beforeEach(() => {
      manager.setVisible(true);
      manager.render(IMAGES, 0);
    });

    test('should mark the capture the viewer is showing', () => {
      manager.setCurrentIndex(2);

      expect(items()[2].classList.contains('current')).toBe(true);
      expect(items()[0].classList.contains('current')).toBe(false);
    });

    test('should mark only one capture at a time', () => {
      manager.setCurrentIndex(1);
      manager.setCurrentIndex(2);

      const marked = Array.from(items()).filter((item) => item.classList.contains('current'));
      expect(marked).toHaveLength(1);
    });

    test('should report the clicked index', () => {
      items()[1].click();

      expect(onSelect).toHaveBeenCalledWith(1);
    });

    test('should report the reindexed position after a new capture arrives', () => {
      const withNewCapture = ['D:\\Proyecto\\imports\\20260101120004.jpg', ...IMAGES];
      manager.render(withNewCapture, 0);

      // The thumbnail that used to be index 0 has moved down one place
      items()[1].click();

      expect(onSelect).toHaveBeenCalledWith(1);
    });

    test('should keep the mark across a re-render', () => {
      manager.setCurrentIndex(1);
      manager.render(IMAGES, 1);

      expect(items()[1].classList.contains('current')).toBe(true);
    });
  });

  describe('clear()', () => {
    test('should empty the strip', () => {
      manager.setVisible(true);
      manager.render(IMAGES, 0);

      manager.clear();

      expect(items()).toHaveLength(0);
      expect(manager.images).toEqual([]);
      expect(manager.currentIndex).toBe(-1);
    });

    test('should stop observing what it removed', () => {
      manager.setVisible(true);
      manager.render(IMAGES, 0);

      manager.clear();

      expect(mockObserver.unobserve).toHaveBeenCalledTimes(3);
    });

    test('should show the empty message when visible', () => {
      manager.setVisible(true);
      manager.render(IMAGES, 0);

      manager.clear();

      expect(empty.classList.contains('is-shown')).toBe(true);
    });
  });

  describe('destroy()', () => {
    test('should disconnect the observer', () => {
      manager.setVisible(true);
      manager.render(IMAGES, 0);

      manager.destroy();

      expect(mockObserver.disconnect).toHaveBeenCalled();
      expect(manager.observer).toBeNull();
    });
  });

  describe('without IntersectionObserver', () => {
    test('should load the thumbnails right away', () => {
      delete global.IntersectionObserver;

      const fallback = new CaptureHistoryManager({ panel, list, empty });
      fallback.init();
      fallback.setVisible(true);
      fallback.render(IMAGES, 0);

      const sources = Array.from(items()).map((item) => item.querySelector('img').getAttribute('src'));
      expect(sources.every((src) => src && src.startsWith('app-img://'))).toBe(true);
    });
  });
});
