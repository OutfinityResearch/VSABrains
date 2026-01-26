import { describe, it } from 'node:test';
import assert from 'node:assert';
import { FactStore } from '../../src/facts/FactStore.mjs';

describe('FactStore', () => {
  it('indexes and queries facts', async () => {
    const store = new FactStore();
    await store.add({
      subject: 'A',
      predicate: 'p',
      object: 'o',
      span: { start: 0, end: 0 },
      source: { docId: 'd', chunkId: 'c' }
    });

    const res = await store.query({ predicate: 'p' });
    assert.strictEqual(res.length, 1);
  });
});
