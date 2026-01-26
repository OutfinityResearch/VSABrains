import { describe, it } from 'node:test';
import assert from 'node:assert';
import { VSABrains } from '../../src/index.mjs';
import { makeExp2Vocabulary, makeCorefState, eventToStepInput, queryToQuestion } from '../../eval/exp2-narrative/encoding.mjs';

describe('E2E Exp2', () => {
  it('answers state queries', async () => {
    const brain = new VSABrains({ writePolicy: 'stepTokenOnly' });
    const vocab = makeExp2Vocabulary();
    const corefState = makeCorefState();

    const events = [
      { time: 0, subject: 'Alice', action: 'enters', object: 'room_A' }
    ];

    for (const event of events) {
      await brain.step(eventToStepInput(event, vocab, corefState));
    }

    const answer = await brain.answer(queryToQuestion({ time: 0, entity: 'Alice', attribute: 'location' }));
    assert.strictEqual(answer.verdict, 'supported');
  });
});
