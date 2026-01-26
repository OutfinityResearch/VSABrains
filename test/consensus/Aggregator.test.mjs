import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Aggregator } from '../../src/consensus/Aggregator.mjs';
import { Voter } from '../../src/consensus/Voter.mjs';

describe('Aggregator', () => {
  it('aggregates column predictions', async () => {
    const columns = [
      { id: 'c1', predict: async () => ({ value: 'X', score: 1 }) },
      { id: 'c2', predict: async () => ({ value: 'X', score: 2 }) },
      { id: 'c3', predict: async () => ({ value: 'Y', score: 1 }) }
    ];

    const aggregator = new Aggregator(columns, new Voter());
    const result = await aggregator.aggregate({});
    assert.strictEqual(result.winner.value, 'X');
  });
});
