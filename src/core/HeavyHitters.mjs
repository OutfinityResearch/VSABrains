/**
 * Heavy-hitters cell maintaining top-K tokens by frequency.
 * Prevents local "muddiness" through bounded retention.
 */
export class HeavyHitters {
  constructor(k = 4) {
    this.k = k;
    // Map<tokenId, count>
    this.counts = new Map();
  }

  /**
   * Update with observed token.
   * @param {number} tokenId - uint32 token ID.
   * @param {number} weight - frequency increment.
   */
  update(tokenId, weight = 1.0) {
    const current = this.counts.get(tokenId) || 0;
    this.counts.set(tokenId, current + weight);

    if (this.counts.size > this.k) {
      this._prune();
    }
  }

  /**
   * Prune the least frequent token.
   */
  _prune() {
    let minToken = -1;
    let minCount = Infinity;

    for (const [tokenId, count] of this.counts.entries()) {
      if (count < minCount) {
        minCount = count;
        minToken = tokenId;
      }
    }

    if (minToken !== -1) {
      this.counts.delete(minToken);
    }
  }

  /**
   * Get top-N tokens with scores.
   * @returns {Array<[number, number]>}
   */
  topK(n = this.k) {
    return [...this.counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);
  }

  /**
   * Merge another HeavyHitters into this one.
   */
  merge(other) {
    for (const [tokenId, count] of other.counts.entries()) {
      const current = this.counts.get(tokenId) || 0;
      this.counts.set(tokenId, current + count);
    }
    while (this.counts.size > this.k) {
      this._prune();
    }
  }

  toJSON() {
    return {
      k: this.k,
      data: [...this.counts.entries()]
    };
  }

  static fromJSON(data) {
    const hh = new HeavyHitters(data.k);
    hh.counts = new Map(data.data);
    return hh;
  }
}
