import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GridMap } from '../../src/core/GridMap.mjs';

describe('GridMap', () => {
  it('writes and reads top-K', () => {
    const map = new GridMap({ width: 8, height: 8, k: 2, sparse: false });
    map.update(1, 2, 11, 1);
    map.update(1, 2, 22, 2);
    map.update(1, 2, 33, 3);

    const top = map.readTopK(1, 2, 2).map(([id]) => id);
    assert.strictEqual(top.length, 2);
    assert.ok(top.includes(22));
    assert.ok(top.includes(33));
  });

  it('reports stats', () => {
    const map = new GridMap({ width: 4, height: 4, k: 2, sparse: true });
    map.update(0, 0, 1, 1);
    map.update(1, 1, 2, 1);
    const stats = map.stats();

    assert.strictEqual(stats.nonEmptyCells, 2);
    assert.ok(stats.gridUtilization > 0);
  });
});
