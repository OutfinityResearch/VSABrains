import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CheckpointManager } from '../../src/memory/Checkpoint.mjs';

describe('CheckpointManager', () => {
  it('saves and loads checkpoints', async () => {
    const manager = new CheckpointManager({ policy: 'fixed', interval: 2 });
    await manager.save(0, { state: 'a' });
    await manager.save(2, { state: 'b' });

    const cp = await manager.loadBefore(2);
    assert.strictEqual(cp.step, 2);
    assert.strictEqual(cp.state.state, 'b');
  });
});
