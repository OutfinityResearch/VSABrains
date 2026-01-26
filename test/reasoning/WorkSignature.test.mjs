import { describe, it } from 'node:test';
import assert from 'node:assert';
import { WorkSignature } from '../../src/reasoning/WorkSignature.mjs';

describe('WorkSignature', () => {
  it('matches patterns with variables', () => {
    const bindings = WorkSignature.matchPattern(
      { subject: '?x', predicate: 'enters', object: 'room_A' },
      { subject: 'Alice', predicate: 'enters', object: 'room_A' }
    );
    assert.strictEqual(bindings.get('?x'), 'Alice');
  });
});
