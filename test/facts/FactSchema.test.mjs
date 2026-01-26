import { describe, it } from 'node:test';
import assert from 'node:assert';
import { FactSchema } from '../../src/facts/FactSchema.mjs';

describe('FactSchema', () => {
  it('validates required fields', () => {
    const fact = {
      span: { start: 0, end: 5 },
      subject: 'A',
      predicate: 'p',
      object: 'o',
      source: { docId: 'd', chunkId: 'c' }
    };
    const res = FactSchema.validate(fact);
    assert.strictEqual(res.valid, true);
  });
});
