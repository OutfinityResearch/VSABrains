import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DisplacementEncoder } from '../../src/core/Displacement.mjs';

describe('DisplacementEncoder', () => {
  it('is deterministic for same inputs', () => {
    const a = new DisplacementEncoder({ contextLength: 2, maxStep: 3, seed: 0 });
    const b = new DisplacementEncoder({ contextLength: 2, maxStep: 3, seed: 0 });

    const d1 = a.step(100);
    const d2 = a.step(200);
    const e1 = b.step(100);
    const e2 = b.step(200);

    assert.deepStrictEqual(d1, e1);
    assert.deepStrictEqual(d2, e2);
  });
});
