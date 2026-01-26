import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Generator } from '../../src/reasoning/Generator.mjs';

describe('Generator', () => {
  it('chains predictions', async () => {
    const generator = new Generator([], { aggregate: async () => ({ value: 'X' }) }, { maxDepth: 2 });
    const chain = await generator.chain({}, 2);
    assert.strictEqual(chain.length, 2);
  });
});
