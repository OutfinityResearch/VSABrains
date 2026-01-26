import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Column } from '../../src/core/Column.mjs';
import { LocationIndex } from '../../src/localization/LocationIndex.mjs';

describe('Column', () => {
  it('writes and indexes step tokens', () => {
    const locationIndex = new LocationIndex();
    const column = new Column({
      mapConfig: { width: 8, height: 8, k: 2 },
      numFastMaps: 1,
      locationIndex,
      writePolicy: 'stepTokenOnly'
    });

    column.stepWrite({ stepTokenId: 42, writeTokenIds: [1, 2] }, 0);
    const candidates = locationIndex.getCandidates(42, 10);
    assert.strictEqual(candidates.length, 1);
  });
});
