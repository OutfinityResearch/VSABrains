import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Localizer } from '../../src/localization/Localizer.mjs';

describe('Localizer', () => {
  it('anchors on smallest candidate list', async () => {
    const candidatesByToken = {
      1: [
        { locKey: 1, count: 2, lastSeen: 5 },
        { locKey: 2, count: 1, lastSeen: 3 },
        { locKey: 3, count: 1, lastSeen: 2 }
      ],
      2: Array.from({ length: 20 }, (_, i) => ({ locKey: i + 1, count: 1, lastSeen: 1 })),
      3: Array.from({ length: 20 }, (_, i) => ({ locKey: i + 1, count: 1, lastSeen: 1 }))
    };

    const column = {
      id: 'column0',
      locationIndex: {
        getCandidates(tokenId, limit) {
          return candidatesByToken[tokenId].slice(0, limit);
        }
      }
    };

    const localizer = new Localizer([column]);
    const result = await localizer.localize([1, 2, 3], 5, { candidatesPerToken: 20, debug: true });

    assert.strictEqual(result.stats.perColumn[0].anchorIdx, 0);
    assert.ok(result.stats.perColumn[0].scoredLocations <= 3);
  });
});
