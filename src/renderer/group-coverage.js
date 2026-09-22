/**
 * Photos by group window - Renderer Process
 * Ver > Fotografías por grupo: how many users of each group have a photo,
 * coloured red (none) through yellow to green (complete), to spot at a glance
 * which groups are still to be photographed. The photos counted are either
 * the captured ones linked in the project or those in the repository.
 */

(function(global) {
  'use strict';

  /**
   * Share of the group with a photo, from 0 to 1. An empty group counts as
   * complete: there is nobody left to photograph.
   * @param {{total: number, withImage: number}} group
   * @returns {number}
   */
  function coverageRatio(group) {
    if (!group.total) return 1;
    return Math.min(1, Math.max(0, group.withImage / group.total));
  }

  /**
   * Percentage shown for a ratio. Rounded down, so only a complete group
   * reads 100 %: 199 of 200 would round up and look finished.
   * @param {number} ratio
   * @returns {number}
   */
  function coveragePercent(ratio) {
    return Math.floor(ratio * 100);
  }

  /**
   * Heat map hue: 0 is red, 60 yellow and 120 green, so walking the hue
   * gives the red-yellow-green scale directly.
   * @param {number} ratio
   * @returns {number}
   */
  function heatHue(ratio) {
    return Math.round(Math.min(1, Math.max(0, ratio)) * 120);
  }

  /**
   * @param {Array} groups
   * @param {'code'|'progress'} order - by group code, or least advanced first
   * @returns {Array} a sorted copy
   */
  function sortGroups(groups, order) {
    const byCode = (a, b) => a.code.localeCompare(b.code, 'es', { numeric: true });
    const copy = groups.slice();
    if (order === 'progress') {
      return copy.sort((a, b) =>
        (coverageRatio(a) - coverageRatio(b)) || (b.withoutImage - a.withoutImage) || byCode(a, b));
    }
    return copy.sort(byCode);
  }

  /**
   * Totals for the header
   * @param {Array} groups
   */
  function summarize(groups) {
    return groups.reduce((acc, group) => {
      acc.groups += 1;
      acc.total += group.total;
      acc.withImage += group.withImage;
      if (group.withImage >= group.total) acc.complete += 1;
      if (group.total > 0 && group.withImage === 0) acc.empty += 1;
      return acc;
    }, { groups: 0, complete: 0, empty: 0, total: 0, withImage: 0 });
  }

  const SOURCES = {
    captured: { noun: 'foto enlazada' },
    repository: { noun: 'foto en el depósito' }
  };

  /**
   * Header line under the title
   * @param {Array} groups
   * @param {'captured'|'repository'} source
   * @returns {string}
   */
  function describeTotals(groups, source) {
    const totals = summarize(groups);
    const percent = totals.total ? coveragePercent(totals.withImage / totals.total) : 0;
    const noun = (SOURCES[source] || SOURCES.captured).noun;
    return `${totals.complete} de ${totals.groups} grupos completos · ` +
      `${totals.withImage} de ${totals.total} usuarios con ${noun} (${percent} %)` +
      (totals.empty ? ` · ${totals.empty} sin ninguna foto` : '');
  }

  const helpers = { coverageRatio, coveragePercent, heatHue, sortGroups, summarize, describeTotals };

  // Under Jest only the helpers are wanted; the page itself needs its DOM
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = helpers;
    return;
  }

  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const errorMessageEl = document.getElementById('error-message');
  const emptyEl = document.getElementById('empty');
  const tableWrapperEl = document.getElementById('table-wrapper');
  const tableBodyEl = document.getElementById('table-body');
  const subtitleEl = document.getElementById('subtitle');
  const sourceSelect = document.getElementById('source-select');
  const orderSelect = document.getElementById('order-select');
  const hideCompleteCheck = document.getElementById('hide-complete');
  const allHiddenEl = document.getElementById('all-hidden');

  const PREFS_KEY = 'groupCoverage.view';
  // Repository changes arrive one per file while a sync copies them
  const REPOSITORY_RELOAD_DELAY_MS = 500;
  let groups = [];
  let requestSeq = 0;
  let repositoryReloadTimer = null;

  function readPrefs() {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    } catch (error) {
      return {};
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        source: sourceSelect.value,
        order: orderSelect.value,
        hideComplete: hideCompleteCheck.checked
      }));
    } catch (error) {
      // Only a convenience
    }
  }

  async function init() {
    const prefs = readPrefs();
    if (SOURCES[prefs.source]) {
      sourceSelect.value = prefs.source;
    }
    if (prefs.order === 'code' || prefs.order === 'progress') {
      orderSelect.value = prefs.order;
    }
    hideCompleteCheck.checked = prefs.hideComplete === true;

    sourceSelect.addEventListener('change', () => { savePrefs(); load(); });
    orderSelect.addEventListener('change', () => { savePrefs(); render(); });
    hideCompleteCheck.addEventListener('change', () => { savePrefs(); render(); });

    // Links made in the main window and repository changes arrive here;
    // anything else (an XML update, say) is picked up when the window comes
    // back to the front
    window.electronAPI.onCapturedImagesChanged(() => {
      if (sourceSelect.value === 'captured') load({ quiet: true });
    });
    window.electronAPI.onRepositoryChanged(() => {
      if (sourceSelect.value !== 'repository') return;
      clearTimeout(repositoryReloadTimer);
      repositoryReloadTimer = setTimeout(() => load({ quiet: true }), REPOSITORY_RELOAD_DELAY_MS);
    });
    window.addEventListener('focus', () => load({ quiet: true }));

    await load();
  }

  /**
   * @param {Object} [options]
   * @param {boolean} [options.quiet] - keep the table on screen while reloading
   */
  async function load({ quiet = false } = {}) {
    // Only the latest request is shown: switching the source while the other
    // one is still counting must not end with the old figures on screen
    const seq = ++requestSeq;
    const source = sourceSelect.value;
    try {
      if (!quiet) showState('loading');
      const result = await window.electronAPI.getGroupPhotoCoverage(source);
      if (seq !== requestSeq) return;
      if (!result.success) {
        showError(result.error || 'Error desconocido al cargar los grupos');
        return;
      }
      groups = result.groups || [];
      render();
    } catch (error) {
      if (seq !== requestSeq) return;
      console.error('Error loading group photo coverage:', error);
      showError('Error al cargar los grupos: ' + error.message);
    }
  }

  function render() {
    subtitleEl.textContent = describeTotals(groups, sourceSelect.value);

    if (groups.length === 0) {
      showState('empty');
      return;
    }

    const visible = sortGroups(groups, orderSelect.value)
      .filter((group) => !(hideCompleteCheck.checked && group.withImage >= group.total));

    tableBodyEl.innerHTML = '';
    visible.forEach((group) => tableBodyEl.appendChild(createRow(group)));
    allHiddenEl.style.display = visible.length === 0 ? 'block' : 'none';
    showState('table');
  }

  function createRow(group) {
    const ratio = coverageRatio(group);
    const percent = coveragePercent(ratio);
    const complete = group.withImage >= group.total;

    const row = document.createElement('tr');
    row.style.setProperty('--heat-hue', heatHue(ratio));
    if (complete) row.classList.add('complete');

    const groupCell = document.createElement('td');
    const name = document.createElement('div');
    name.className = 'group-name';
    name.textContent = group.name;
    groupCell.appendChild(name);
    if (group.code && group.code !== group.name) {
      const code = document.createElement('div');
      code.className = 'group-code';
      code.textContent = group.code;
      groupCell.appendChild(code);
    }
    row.appendChild(groupCell);

    row.appendChild(numberCell(group.total));
    row.appendChild(numberCell(group.withImage));
    row.appendChild(numberCell(group.withoutImage, group.withoutImage > 0 ? 'missing' : ''));

    const progressCell = document.createElement('td');
    progressCell.className = 'progress-cell';
    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    fill.style.width = `${ratio * 100}%`;
    bar.appendChild(fill);
    const label = document.createElement('span');
    label.className = 'progress-label';
    label.textContent = complete ? '✓ 100 %' : `${percent} %`;
    progressCell.appendChild(bar);
    progressCell.appendChild(label);
    row.appendChild(progressCell);

    return row;
  }

  function numberCell(value, className = '') {
    const cell = document.createElement('td');
    cell.className = `num ${className}`.trim();
    cell.textContent = value;
    return cell;
  }

  function showError(message) {
    // The totals on show would be those of the other source
    subtitleEl.textContent = '';
    errorMessageEl.textContent = message;
    showState('error');
  }

  function showState(state) {
    loadingEl.style.display = state === 'loading' ? 'flex' : 'none';
    errorEl.style.display = state === 'error' ? 'flex' : 'none';
    emptyEl.style.display = state === 'empty' ? 'flex' : 'none';
    tableWrapperEl.style.display = state === 'table' ? 'block' : 'none';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(typeof window !== 'undefined' ? window : global);
