import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Reasoner } from '../../src/reasoning/Reasoner.mjs';
import { FactStore } from '../../src/facts/FactStore.mjs';

describe('Reasoner', () => {
  it('returns supported when fact exists', async () => {
    const store = new FactStore();
    await store.add({
      subject: 'session_token',
      predicate: 'expires_after',
      object: '15 minutes',
      span: { start: 0, end: 0 },
      source: { docId: 'd', chunkId: 'c' }
    });

    const reasoner = new Reasoner(store, null, {});
    const answer = await reasoner.answer({ predicates: ['expires_after'], subjects: ['session_token'] });
    assert.strictEqual(answer.verdict, 'supported');
  });

  it('handles inactivity evaluator', async () => {
    const store = new FactStore();
    await store.add({
      subject: 'session_token',
      predicate: 'expires_after',
      object: '15 minutes',
      qualifiers: { version: '2.0' },
      span: { start: 0, end: 0 },
      source: { docId: 'd', chunkId: 'c' }
    });

    const reasoner = new Reasoner(store, null, {});
    const answer = await reasoner.answer({
      version: '2.0',
      predicates: ['expires_after'],
      subjects: ['session_token'],
      params: { inactivityMinutes: 20 }
    });
    assert.strictEqual(answer.text, 'No');
  });
});
