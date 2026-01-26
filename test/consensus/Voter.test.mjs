import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Voter } from '../../src/consensus/Voter.mjs';

describe('Voter', () => {
  it('returns weighted winner', () => {
    const voter = new Voter();
    const winner = voter.vote([
      { value: 'A', weight: 1 },
      { value: 'B', weight: 3 },
      { value: 'A', weight: 2 }
    ]);
    assert.strictEqual(winner.value, 'A');
    assert.ok(voter.confidence() >= 0.5);
  });
});
