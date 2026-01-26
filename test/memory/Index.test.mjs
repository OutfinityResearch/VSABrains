import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Index } from '../../src/memory/Index.mjs';

describe('Index', () => {
  it('indexes and queries signatures', () => {
    const index = new Index();
    index.add('sig1', 1);
    index.add('sig1', 2);
    index.add('sig2', 2);

    const res = index.query(['sig1', 'sig2'], 10);
    assert.strictEqual(res[0], 2);
  });
});
