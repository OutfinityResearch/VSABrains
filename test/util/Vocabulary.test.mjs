import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Vocabulary } from '../../src/util/Vocabulary.mjs';

describe('Vocabulary', () => {
  it('assigns deterministic ids in dynamic mode', () => {
    const vocab = new Vocabulary({ mode: 'dynamic', maxSize: 10 });
    const id1 = vocab.id('alice');
    const id2 = vocab.id('alice');
    assert.strictEqual(id1, id2);
  });

  it('returns unk when maxSize exceeded', () => {
    const vocab = new Vocabulary({ mode: 'dynamic', maxSize: 1, unkTokenId: 3 });
    vocab.id('a');
    const id = vocab.id('b');
    assert.strictEqual(id, 3);
  });
});
