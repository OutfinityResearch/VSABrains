import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Verifier } from '../../src/localization/Verifier.mjs';

describe('Verifier', () => {
  it('returns violations for invalid transitions', () => {
    const rules = [
      {
        name: 'no_bad',
        check(prev, event) {
          if (event.action === 'bad') return { valid: false, reason: 'bad_action' };
          return { valid: true };
        }
      }
    ];

    const verifier = new Verifier(rules);
    const violations = verifier.checkTransition({}, { action: 'bad' }, {});
    assert.strictEqual(violations.length, 1);
  });
});
