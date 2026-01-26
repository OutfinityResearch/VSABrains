import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EpisodicStore } from '../../src/memory/EpisodicStore.mjs';

describe('EpisodicStore', () => {
  it('appends and retrieves by range', async () => {
    const store = new EpisodicStore({ maxChunks: 10 });
    await store.append({ step: 0, event: { action: 'a' } });
    await store.append({ step: 1, event: { action: 'b' } });

    const range = await store.getRange(0, 1);
    assert.strictEqual(range.length, 2);
    assert.strictEqual(range[0].event.action, 'a');
    assert.strictEqual(range[1].event.action, 'b');
  });
});
