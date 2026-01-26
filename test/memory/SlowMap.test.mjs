import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SlowMapManager } from '../../src/memory/SlowMap.mjs';

describe('SlowMapManager', () => {
  it('flushes window summaries', () => {
    const slow = new SlowMapManager({ windowSize: 2 });
    slow.onStep({ subject: 'A', action: 'enters', object: 'room' }, { x: 0, y: 0 }, 0);
    slow.onStep({ subject: 'A', action: 'moves_to', object: 'room2' }, { x: 0, y: 0 }, 1);

    assert.strictEqual(slow.summaryStore.size, 1);
  });
});
