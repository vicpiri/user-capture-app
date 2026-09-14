/**
 * Hiding the photos column
 *
 * With every photo option off in the Ver menu the photos column is hidden.
 * Selection mode adds a checkbox column first; the rule used to hide the fifth
 * column, which then was GRUPO. It must hide the photos column, the last one,
 * whether selection mode is on or not.
 */

const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '../../../src/renderer/styles/tables.css'), 'utf8');

describe('photos column', () => {
  const table = (withCheckbox) => `
    <table id="user-table" class="user-table hide-photos-column">
      <thead><tr>
        ${withCheckbox ? '<th class="checkbox-column"></th>' : ''}
        <th>NOMBRE</th><th>APELLIDOS</th><th>ID</th><th>GRUPO</th><th id="photos-column-header">FOTOS</th>
      </tr></thead>
      <tbody><tr>
        ${withCheckbox ? '<td><input type="checkbox"></td>' : ''}
        <td>ANA</td><td>GARCIA</td><td>1001</td><td id="group-cell">1ESOA</td><td id="photos-cell"></td>
      </tr></tbody>
    </table>
  `;

  const hidden = (id) => window.getComputedStyle(document.getElementById(id)).display === 'none';

  beforeEach(() => {
    document.head.innerHTML = `<style>${css}</style>`;
  });

  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  test.each([
    ['normally', false],
    ['in selection mode', true]
  ])('should hide the photos column and keep GRUPO %s', (label, withCheckbox) => {
    document.body.innerHTML = table(withCheckbox);

    expect(hidden('photos-column-header')).toBe(true);
    expect(hidden('photos-cell')).toBe(true);
    expect(hidden('group-cell')).toBe(false);
  });

  test('should show every column when a photo option is on', () => {
    document.body.innerHTML = table(true);
    document.getElementById('user-table').classList.remove('hide-photos-column');

    expect(hidden('photos-cell')).toBe(false);
    expect(hidden('group-cell')).toBe(false);
  });
});
