import { describe, it } from 'node:test';
import assert from 'node:assert';
import { FactExtractor } from '../../src/facts/FactExtractor.mjs';

describe('FactExtractor', () => {
  it('extracts and validates facts', async () => {
    const text = 'session_token expires after 15 minutes';
    const llmClient = {
      async complete() {
        return {
          content: JSON.stringify([
            {
              span: { start: 0, end: text.length },
              subject: 'session_token',
              predicate: 'expires_after',
              object: '15 minutes',
              source: { docId: 'd', chunkId: 'c' }
            }
          ])
        };
      }
    };

    const extractor = new FactExtractor({
      llmClient,
      predicateVocabulary: { expires_after: { argTypes: ['entity', 'duration'] } }
    });

    const facts = await extractor.extract(text);
    const valid = await extractor.validateAndFilter(facts, text);
    assert.strictEqual(valid.length, 1);
  });
});
