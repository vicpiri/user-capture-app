/**
 * Ver > Fotografías por grupo: colour scale, percentages and ordering
 *
 * @jest-environment node
 */

const {
  coverageRatio,
  coveragePercent,
  heatHue,
  sortGroups,
  summarize
} = require('../../../src/renderer/group-coverage');

const group = (code, total, withImage) => ({
  code,
  name: code,
  total,
  withImage,
  withoutImage: total - withImage
});

describe('group photo coverage', () => {
  test('should go from red with no photos, through yellow, to green when complete', () => {
    expect(heatHue(coverageRatio(group('A', 20, 0)))).toBe(0);
    expect(heatHue(coverageRatio(group('A', 20, 10)))).toBe(60);
    expect(heatHue(coverageRatio(group('A', 20, 20)))).toBe(120);
  });

  test('should only read 100 % when the group is complete', () => {
    expect(coveragePercent(coverageRatio(group('A', 200, 199)))).toBe(99);
    expect(coveragePercent(coverageRatio(group('A', 200, 200)))).toBe(100);
  });

  test('should treat a group with nobody in it as complete', () => {
    expect(coverageRatio(group('A', 0, 0))).toBe(1);
  });

  test('should sort by group code in natural order', () => {
    const sorted = sortGroups([group('2ESO', 1, 0), group('10ESO', 1, 0), group('1ESO', 1, 0)], 'code');

    expect(sorted.map((g) => g.code)).toEqual(['1ESO', '2ESO', '10ESO']);
  });

  test('should put the least advanced groups first, the biggest gap breaking ties', () => {
    const sorted = sortGroups([
      group('A', 10, 10),
      group('B', 10, 0),
      group('C', 10, 5),
      group('D', 30, 0)
    ], 'progress');

    expect(sorted.map((g) => g.code)).toEqual(['D', 'B', 'C', 'A']);
  });

  test('should not reorder the list it was given', () => {
    const groups = [group('B', 1, 0), group('A', 1, 0)];
    sortGroups(groups, 'code');

    expect(groups.map((g) => g.code)).toEqual(['B', 'A']);
  });

  test('should add up the totals for the header', () => {
    expect(summarize([group('A', 10, 10), group('B', 10, 0), group('C', 10, 4)])).toEqual({
      groups: 3,
      complete: 1,
      empty: 1,
      total: 30,
      withImage: 14
    });
  });
});
