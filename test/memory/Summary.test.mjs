import { describe, it } from 'node:test';
import assert from 'node:assert';
import { WindowSummary } from '../../src/memory/Summary.mjs';

describe('WindowSummary', () => {
  it('produces deterministic tokenId', () => {
    const s1 = new WindowSummary(0, 2);
    const s2 = new WindowSummary(0, 2);
    s1.addEvent({ subject: 'A', action: 'enters', object: 'room' });
    s2.addEvent({ subject: 'A', action: 'enters', object: 'room' });

    assert.strictEqual(s1.toTokenId(), s2.toTokenId());
  });
});
