/**
 * Workspace tests
 *
 * A workspace is a saved combination of the Ver menu display options. What
 * must hold: the built-in ones are always there and cannot be changed, the
 * user's survive in the stored settings, names stay unique and readable, and
 * the menu marks the workspace the view really matches.
 *
 * @jest-environment node
 */

const {
  WorkspaceStore,
  BUILT_IN_WORKSPACES,
  VIEW_KEYS,
  MAX_NAME_LENGTH,
  pickView
} = require('../../../src/main/workspaces');

describe('WorkspaceStore', () => {
  let stored;
  let store;

  const view = (overrides = {}) => ({
    showCapturedPhotos: true,
    showRepositoryPhotos: false,
    showRepositoryIndicators: false,
    showAdditionalActions: false,
    showCaptureHistory: false,
    showThumbnailGrid: false,
    ...overrides
  });

  const CAPTURA_VIEW = BUILT_IN_WORKSPACES.find((w) => w.id === 'captura').view;

  beforeEach(() => {
    jest.useRealTimers();
    stored = undefined;
    store = new WorkspaceStore({
      load: () => (stored === undefined ? undefined : JSON.parse(JSON.stringify(stored))),
      save: (settings) => { stored = JSON.parse(JSON.stringify(settings)); }
    });
  });

  describe('built-in workspaces', () => {
    test('come with the app: Captura, Revisión and Carnets', () => {
      expect(store.list().map((w) => w.name)).toEqual(['Captura', 'Revisión', 'Carnets']);
      expect(store.list().every((w) => w.builtIn)).toBe(true);
    });

    test('Captura shows the captured photos and the history, not the repository photos', () => {
      expect(store.get('captura').view).toEqual({
        showCapturedPhotos: true,
        showRepositoryPhotos: false,
        showRepositoryIndicators: true,
        showAdditionalActions: false,
        showCaptureHistory: true,
        showThumbnailGrid: false
      });
    });

    test('Carnets shows the repository photos and the additional actions', () => {
      expect(store.get('carnets').view).toMatchObject({
        showCapturedPhotos: false,
        showRepositoryPhotos: true,
        showAdditionalActions: true
      });
    });

    test('cannot be renamed, overwritten or deleted', () => {
      expect(store.rename('captura', 'Otra').success).toBe(false);
      expect(store.overwrite('captura', view()).success).toBe(false);
      expect(store.remove('captura')).toEqual({ success: false, error: expect.stringContaining('ocultarlos') });
      expect(store.get('captura').name).toBe('Captura');
    });

    test('can be hidden from the menu and shown again', () => {
      store.setHidden('revision', true);
      expect(store.get('revision').hidden).toBe(true);
      expect(store.visible().map((w) => w.id)).toEqual(['captura', 'carnets']);

      store.setHidden('revision', false);
      expect(store.visible().map((w) => w.id)).toEqual(['captura', 'revision', 'carnets']);
    });

    test('are the only ones that can be hidden', () => {
      const { workspace } = store.create('Mío', view());
      expect(store.setHidden(workspace.id, true).success).toBe(false);
    });
  });

  describe('creating', () => {
    test('saves the current view under a name, after the built-in ones', () => {
      const result = store.create('Recepción', view({ showAdditionalActions: true }));

      expect(result.success).toBe(true);
      expect(store.list().map((w) => w.name)).toEqual(['Captura', 'Revisión', 'Carnets', 'Recepción']);
      expect(store.get(result.workspace.id)).toEqual({
        id: result.workspace.id,
        name: 'Recepción',
        builtIn: false,
        hidden: false,
        view: view({ showAdditionalActions: true })
      });
    });

    test('keeps only the display options, whatever else the view carries', () => {
      const { workspace } = store.create('Mío', { ...view(), showDuplicatesOnly: true, extra: 1 });
      expect(Object.keys(store.get(workspace.id).view)).toEqual(VIEW_KEYS);
    });

    test('survives in the stored settings', () => {
      store.create('Mío', view());
      const reopened = new WorkspaceStore({ load: () => stored, save: () => {} });
      expect(reopened.list().map((w) => w.name)).toContain('Mío');
    });

    test('tidies the spaces of the name', () => {
      const { workspace } = store.create('  Sesión   de  tarde ', view());
      expect(workspace.name).toBe('Sesión de tarde');
    });

    test('refuses an empty name', () => {
      expect(store.create('   ', view())).toEqual({ success: false, error: expect.stringContaining('nombre') });
    });

    test('refuses a name that is too long', () => {
      expect(store.create('x'.repeat(MAX_NAME_LENGTH + 1), view()).success).toBe(false);
      expect(store.create('x'.repeat(MAX_NAME_LENGTH), view()).success).toBe(true);
    });

    test('refuses a name already in use, ignoring case and accents', () => {
      expect(store.create('revision', view())).toEqual({ success: false, error: expect.stringContaining('Ya hay') });
      store.create('Tarde', view());
      expect(store.create('TARDE', view()).success).toBe(false);
    });

    test('gives each workspace its own id', () => {
      const first = store.create('Uno', view()).workspace.id;
      const second = store.create('Dos', view()).workspace.id;
      expect(first).not.toBe(second);
    });
  });

  describe('changing the user\'s workspaces', () => {
    let id;

    beforeEach(() => {
      id = store.create('Mío', view()).workspace.id;
    });

    test('overwrite replaces the options with the current view', () => {
      store.overwrite(id, view({ showCaptureHistory: true }));
      expect(store.get(id).view.showCaptureHistory).toBe(true);
    });

    test('rename changes the name', () => {
      expect(store.rename(id, 'Tarde').success).toBe(true);
      expect(store.get(id).name).toBe('Tarde');
    });

    test('rename accepts the same name with other capitals', () => {
      expect(store.rename(id, 'MÍO').success).toBe(true);
    });

    test('rename refuses a name another workspace has', () => {
      expect(store.rename(id, 'Captura').success).toBe(false);
      expect(store.get(id).name).toBe('Mío');
    });

    test('remove deletes it', () => {
      expect(store.remove(id).success).toBe(true);
      expect(store.get(id)).toBeNull();
    });

    test('reports a workspace that no longer exists', () => {
      store.remove(id);
      expect(store.rename(id, 'x')).toEqual({ success: false, error: expect.stringContaining('ya no existe') });
    });
  });

  describe('matching the current view', () => {
    test('finds the workspace with exactly those options', () => {
      expect(store.matching(CAPTURA_VIEW)).toBe('captura');
    });

    test('finds none when one option differs', () => {
      expect(store.matching({ ...CAPTURA_VIEW, showAdditionalActions: true })).toBeNull();
    });

    test('ignores the options a workspace does not save, like the filters', () => {
      expect(store.matching({ ...CAPTURA_VIEW, showDuplicatesOnly: true })).toBe('captura');
    });

    test('prefers the first in the menu when two are equal', () => {
      store.create('Copia de Captura', CAPTURA_VIEW);
      expect(store.matching(CAPTURA_VIEW)).toBe('captura');
    });

    test('skips a hidden workspace', () => {
      const { workspace } = store.create('Copia de Captura', CAPTURA_VIEW);
      store.setHidden('captura', true);
      expect(store.matching(CAPTURA_VIEW)).toBe(workspace.id);
    });
  });

  describe('stored settings edited by hand', () => {
    test('drops broken entries and unknown built-in ids', () => {
      stored = {
        custom: [null, { id: 'a' }, { id: 'b', name: 'Bueno', view: { showCapturedPhotos: 'yes' } }],
        hiddenBuiltIns: ['captura', 'inventado']
      };

      expect(store.list().map((w) => w.name)).toEqual(['Captura', 'Revisión', 'Carnets', 'Bueno']);
      expect(store.get('b').view.showCapturedPhotos).toBe(false);
      expect(store.get('captura').hidden).toBe(true);
    });

    test('work with nothing stored at all', () => {
      stored = null;
      expect(store.list()).toHaveLength(3);
    });
  });

  test('pickView turns anything but true into false', () => {
    expect(pickView({ showCapturedPhotos: 1, showRepositoryPhotos: true })).toEqual({
      showCapturedPhotos: false,
      showRepositoryPhotos: true,
      showRepositoryIndicators: false,
      showAdditionalActions: false,
      showCaptureHistory: false,
      showThumbnailGrid: false
    });
  });

  test('a workspace saved before the thumbnail view existed shows the table', () => {
    stored = { custom: [{ id: 'old', name: 'Antiguo', view: { showCapturedPhotos: true } }], hiddenBuiltIns: [] };
    expect(store.get('old').view.showThumbnailGrid).toBe(false);
  });

  test('remembers the thumbnail view', () => {
    const { workspace } = store.create('Galería', view({ showThumbnailGrid: true }));
    expect(store.get(workspace.id).view.showThumbnailGrid).toBe(true);
    expect(store.matching(view({ showThumbnailGrid: true }))).toBe(workspace.id);
    expect(store.matching(view())).not.toBe(workspace.id);
  });
});
