import { describe, it } from 'node:test';
import assert from 'node:assert';
import { HeavyHitters } from '../../src/core/HeavyHitters.mjs';

describe('HeavyHitters', () => {
  it('keeps top-K tokens', () => {
    const hh = new HeavyHitters(2);
    hh.update(1, 1);
    hh.update(2, 2);
    hh.update(3, 3); // should evict token 1

    const top = hh.topK(2).map(([id]) => id);
    assert.strictEqual(top.length, 2);
    assert.ok(top.includes(2));
    assert.ok(top.includes(3));
  });
});
