/**
 * StepToken→location inverted index used by the Localizer (column-scoped).
 * Implementation: DS004 §6, DS006 §8.
 */
export class LocationIndex {
  constructor(config = {}) {
    this.maxLocationsPerToken = config.maxLocationsPerToken ?? 500;
    // Map<stepTokenId, Map<locKey, { count, lastSeen }>>
    this.tokenToLocations = new Map();
  }

  _getLocKey(x, y) {
    return (((x & 0xffff) << 16) | (y & 0xffff)) >>> 0;
  }

  /** Called when writing a stepTokenId at a location */
  update(stepTokenId, x, y, step) {
    const locKey = this._getLocKey(x, y);
    let locMap = this.tokenToLocations.get(stepTokenId);

    if (!locMap) {
      locMap = new Map();
      this.tokenToLocations.set(stepTokenId, locMap);
    }

    const entry = locMap.get(locKey) ?? { count: 0, lastSeen: 0 };
    entry.count += 1;
    entry.lastSeen = step;
    locMap.set(locKey, entry);

    if (locMap.size > this.maxLocationsPerToken) {
      this.prune(stepTokenId);
    }
  }

  /** Return top candidate locations for a stepTokenId (sorted by count/recency) */
  getCandidates(stepTokenId, limit = 100) {
    const locMap = this.tokenToLocations.get(stepTokenId);
    if (!locMap) return [];

    return [...locMap.entries()]
      .sort((a, b) => b[1].count - a[1].count || b[1].lastSeen - a[1].lastSeen)
      .slice(0, limit)
      .map(([locKey, data]) => ({ locKey, ...data }));
  }

  /** Optional pruning to cap memory */
  prune(stepTokenId, maxLocations = this.maxLocationsPerToken) {
    const locMap = this.tokenToLocations.get(stepTokenId);
    if (!locMap || locMap.size <= maxLocations) return;

    const sorted = [...locMap.entries()]
      .sort((a, b) => b[1].count - a[1].count || b[1].lastSeen - a[1].lastSeen);

    locMap.clear();
    for (let i = 0; i < maxLocations && i < sorted.length; i++) {
      locMap.set(sorted[i][0], sorted[i][1]);
    }
  }
}
