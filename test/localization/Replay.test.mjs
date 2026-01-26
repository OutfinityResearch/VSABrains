import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Replayer } from '../../src/localization/Replay.mjs';
import { EpisodicStore } from '../../src/memory/EpisodicStore.mjs';
import { CheckpointManager } from '../../src/memory/Checkpoint.mjs';
import { Verifier } from '../../src/localization/Verifier.mjs';

describe('Replayer', () => {
  it('replays events into state', async () => {
    const store = new EpisodicStore({ maxChunks: 10 });
    await store.append({ step: 0, event: { action: 'inc' } });
    await store.append({ step: 1, event: { action: 'inc' } });

    const checkpoints = new CheckpointManager({ policy: 'fixed', interval: 10 });
    const model = {
      init: () => ({ count: 0 }),
      apply: (state, event) => { if (event.action === 'inc') state.count += 1; },
      clone: (state) => ({ ...state })
    };

    const replayer = new Replayer(checkpoints, store, model);
    const state = await replayer.replay(1);
    assert.strictEqual(state.count, 2);
  });

  it('returns violations in replayWithHistory', async () => {
    const store = new EpisodicStore({ maxChunks: 10 });
    await store.append({ step: 0, event: { action: 'bad' } });

    const checkpoints = new CheckpointManager({ policy: 'fixed', interval: 10 });
    const model = {
      init: () => ({}),
      apply: () => {},
      clone: (state) => ({ ...state })
    };
    const verifier = new Verifier([
      { name: 'no_bad', check: (prev, event) => event.action === 'bad' ? { valid: false, reason: 'bad' } : { valid: true } }
    ]);

    const replayer = new Replayer(checkpoints, store, model, verifier);
    const result = await replayer.replayWithHistory(0);
    assert.strictEqual(result.violations.length, 1);
  });
});
