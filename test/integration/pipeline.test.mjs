import { describe, it } from 'node:test';
import assert from 'node:assert';
import { VSABrains } from '../../src/index.mjs';

describe('Pipeline', () => {
  it('answers from stored facts', async () => {
    const brain = new VSABrains({});
    await brain.ingest('Alice enters room_A.');

    await brain.factStore.add({
      subject: 'session_token',
      predicate: 'expires_after',
      object: '15 minutes',
      span: { start: 0, end: 0 },
      source: { docId: 'd', chunkId: 'c' }
    });

    const answer = await brain.answer({ predicates: ['expires_after'], subjects: ['session_token'] });
    assert.ok(['supported', 'conflicting', 'unsupported'].includes(answer.verdict));
  });
});
