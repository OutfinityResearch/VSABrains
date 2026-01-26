import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Tokenizer } from '../../src/util/Tokenizer.mjs';

describe('Tokenizer', () => {
  it('tokenizes deterministically', () => {
    const tokenizer = new Tokenizer({ lowercase: true });
    const tokens = tokenizer.tokenize('Alice enters room_A.');
    assert.deepStrictEqual(tokens, ['alice', 'enters', 'room_a', '.']);
  });
});
