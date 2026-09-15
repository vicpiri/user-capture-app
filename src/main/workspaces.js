/**
 * Workspaces - saved combinations of the Ver menu display options
 *
 * A workspace remembers which photos and panels are shown, so switching
 * between the phases of the work (taking photos, reviewing them, preparing
 * cards) is one click or Ctrl+1…9 instead of five menu items. The filters of
 * the Ver menu are not part of it: they narrow the list, they do not change
 * how it looks.
 *
 * Three workspaces come with the app and cannot be changed or deleted, only
 * hidden from the menu. The user adds their own from the current view.
 *
 * Storage is injected (config.json in the app, a plain object in tests).
 */

// The Ver menu options a workspace saves, in menu order
const VIEW_KEYS = [
  'showCapturedPhotos',
  'showRepositoryPhotos',
  'showRepositoryIndicators',
  'showAdditionalActions',
  'showCaptureHistory',
  'showThumbnailGrid'
];

const BUILT_IN_WORKSPACES = [
  {
    id: 'captura',
    name: 'Captura',
    view: {
      showCapturedPhotos: true,
      showRepositoryPhotos: false,
      showRepositoryIndicators: true,
      showAdditionalActions: false,
      showCaptureHistory: true,
      showThumbnailGrid: false
    }
  },
  {
    id: 'revision',
    name: 'Revisión',
    view: {
      showCapturedPhotos: true,
      showRepositoryPhotos: true,
      showRepositoryIndicators: true,
      showAdditionalActions: false,
      showCaptureHistory: false,
      showThumbnailGrid: false
    }
  },
  {
    id: 'carnets',
    name: 'Carnets',
    view: {
      showCapturedPhotos: false,
      showRepositoryPhotos: true,
      showRepositoryIndicators: true,
      showAdditionalActions: true,
      showCaptureHistory: false,
      showThumbnailGrid: false
    }
  }
];

const MAX_NAME_LENGTH = 40;

/**
 * Only the options a workspace saves, as booleans
 * @param {Object} preferences - any object with the display preferences
 * @returns {Object}
 */
function pickView(preferences = {}) {
  const view = {};
  VIEW_KEYS.forEach((key) => {
    view[key] = preferences[key] === true;
  });
  return view;
}

function sameView(a, b) {
  return VIEW_KEYS.every((key) => a[key] === b[key]);
}

// For names that differ only in case, accents or spacing
function nameKey(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

class WorkspaceStore {
  /**
   * @param {Object} storage
   * @param {Function} storage.load - () => { custom: [], hiddenBuiltIns: [] }
   * @param {Function} storage.save - (settings) => void
   */
  constructor({ load, save }) {
    this.load = load;
    this.save = save;
  }

  /**
   * Every workspace: the built-in ones first, then the user's, in the order
   * they were created
   * @returns {Array<{id, name, builtIn, hidden, view}>}
   */
  list() {
    const settings = this._settings();
    const builtIn = BUILT_IN_WORKSPACES.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      builtIn: true,
      hidden: settings.hiddenBuiltIns.includes(workspace.id),
      view: { ...workspace.view }
    }));
    const custom = settings.custom.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      builtIn: false,
      hidden: false,
      view: pickView(workspace.view)
    }));
    return [...builtIn, ...custom];
  }

  /**
   * The ones shown in the menu, which is also the order of Ctrl+1…9
   */
  visible() {
    return this.list().filter((workspace) => !workspace.hidden);
  }

  get(id) {
    return this.list().find((workspace) => workspace.id === id) || null;
  }

  /**
   * The workspace the current view corresponds to, if any: the first one of
   * the menu with exactly those options
   * @param {Object} preferences
   * @returns {string|null} its id
   */
  matching(preferences) {
    const view = pickView(preferences);
    const match = this.visible().find((workspace) => sameView(workspace.view, view));
    return match ? match.id : null;
  }

  /**
   * Save a view as a new workspace
   * @returns {{success: boolean, workspace?: Object, error?: string}}
   */
  create(name, preferences) {
    const checked = this._checkName(name);
    if (checked.error) return { success: false, error: checked.error };

    const settings = this._settings();
    const workspace = { id: this._newId(settings), name: checked.name, view: pickView(preferences) };
    settings.custom.push(workspace);
    this.save(settings);
    return { success: true, workspace: this.get(workspace.id) };
  }

  /**
   * Replace the options of one of the user's workspaces with a view
   */
  overwrite(id, preferences) {
    return this._changeCustom(id, (workspace) => {
      workspace.view = pickView(preferences);
    });
  }

  rename(id, name) {
    const checked = this._checkName(name, id);
    if (checked.error) return { success: false, error: checked.error };
    return this._changeCustom(id, (workspace) => {
      workspace.name = checked.name;
    });
  }

  remove(id) {
    const settings = this._settings();
    const index = settings.custom.findIndex((workspace) => workspace.id === id);
    if (index === -1) {
      return { success: false, error: this._isBuiltIn(id) ? 'Los espacios predefinidos no se pueden borrar; puedes ocultarlos.' : 'Ese espacio de trabajo ya no existe.' };
    }
    settings.custom.splice(index, 1);
    this.save(settings);
    return { success: true };
  }

  /**
   * Show or hide a built-in workspace in the menu
   */
  setHidden(id, hidden) {
    if (!this._isBuiltIn(id)) {
      return { success: false, error: 'Solo se pueden ocultar los espacios predefinidos.' };
    }
    const settings = this._settings();
    settings.hiddenBuiltIns = settings.hiddenBuiltIns.filter((hiddenId) => hiddenId !== id);
    if (hidden) settings.hiddenBuiltIns.push(id);
    this.save(settings);
    return { success: true };
  }

  /**
   * @private
   */
  _changeCustom(id, change) {
    const settings = this._settings();
    const workspace = settings.custom.find((candidate) => candidate.id === id);
    if (!workspace) {
      return { success: false, error: this._isBuiltIn(id) ? 'Los espacios predefinidos no se pueden cambiar.' : 'Ese espacio de trabajo ya no existe.' };
    }
    change(workspace);
    this.save(settings);
    return { success: true, workspace: this.get(id) };
  }

  /**
   * @private
   */
  _checkName(name, exceptId = null) {
    const clean = String(name || '').replace(/\s+/g, ' ').trim();
    if (!clean) {
      return { error: 'Escribe un nombre para el espacio de trabajo.' };
    }
    if (clean.length > MAX_NAME_LENGTH) {
      return { error: `El nombre no puede tener más de ${MAX_NAME_LENGTH} caracteres.` };
    }
    const taken = this.list().some((workspace) => workspace.id !== exceptId && nameKey(workspace.name) === nameKey(clean));
    if (taken) {
      return { error: `Ya hay un espacio de trabajo llamado «${clean}».` };
    }
    return { name: clean };
  }

  /**
   * @private
   */
  _isBuiltIn(id) {
    return BUILT_IN_WORKSPACES.some((workspace) => workspace.id === id);
  }

  /**
   * @private
   */
  _newId(settings) {
    const taken = new Set(settings.custom.map((workspace) => workspace.id));
    let id;
    do {
      id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    } while (taken.has(id));
    return id;
  }

  /**
   * What is stored, repaired if it was edited by hand or is missing
   * @private
   */
  _settings() {
    const stored = this.load() || {};
    const custom = Array.isArray(stored.custom)
      ? stored.custom.filter((workspace) => workspace && typeof workspace.id === 'string' && typeof workspace.name === 'string')
      : [];
    const hiddenBuiltIns = Array.isArray(stored.hiddenBuiltIns)
      ? stored.hiddenBuiltIns.filter((id) => this._isBuiltIn(id))
      : [];
    return {
      custom: custom.map((workspace) => ({ id: workspace.id, name: workspace.name, view: pickView(workspace.view) })),
      hiddenBuiltIns
    };
  }
}

module.exports = {
  WorkspaceStore,
  BUILT_IN_WORKSPACES,
  VIEW_KEYS,
  MAX_NAME_LENGTH,
  pickView
};
