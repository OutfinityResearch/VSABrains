import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Workpad } from '../../src/reasoning/Workpad.mjs';
import { WorkSignature } from '../../src/reasoning/WorkSignature.mjs';

describe('Workpad', () => {
  it('instantiates variables', () => {
    const workpad = new Workpad();
    workpad.bind('?x', 'Alice');

    const sig = new WorkSignature();
    sig.bind('subject', '?x', true);
    sig.bind('predicate', 'enters');

    const instantiated = workpad.instantiate(sig);
    assert.strictEqual(instantiated.unbind('subject'), 'Alice');
  });
});
