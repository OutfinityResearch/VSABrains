import { describe, it } from 'node:test';
import assert from 'node:assert';
import { LocationIndex } from '../../src/localization/LocationIndex.mjs';

describe('LocationIndex', () => {
  it('returns candidates sorted by count', () => {
    const index = new LocationIndex({ maxLocationsPerToken: 10 });
    index.update(1, 0, 0, 1);
    index.update(1, 0, 0, 2);
    index.update(1, 1, 1, 3);

    const candidates = index.getCandidates(1, 10);
    assert.strictEqual(candidates.length, 2);
    assert.ok(candidates[0].count >= candidates[1].count);
  });
});
