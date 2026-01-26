/**
 * Weighted voting mechanism.
 */
export class Voter {
  constructor(config = {}) {
    this.method = config.method ?? 'weighted';
    this.lastTotals = new Map();
    this.lastWinner = null;
    this.lastTotalScore = 0;
  }

  /** Aggregate predictions from multiple sources */
  vote(predictions) {
    this.lastTotals.clear();
    this.lastWinner = null;
    this.lastTotalScore = 0;

    for (const pred of predictions) {
      const value = typeof pred === 'object' ? pred.value ?? pred.prediction ?? pred : pred;
      const weight = typeof pred === 'object'
        ? (pred.weight ?? pred.score ?? pred.confidence ?? 1)
        : 1;

      if (value == null) continue;
      this.lastTotals.set(value, (this.lastTotals.get(value) ?? 0) + weight);
      this.lastTotalScore += weight;
    }

    let bestValue = null;
    let bestScore = -Infinity;
    for (const [value, score] of this.lastTotals.entries()) {
      if (score > bestScore) {
        bestScore = score;
        bestValue = value;
      }
    }

    this.lastWinner = { value: bestValue, score: bestScore };
    return this.lastWinner;
  }

  /** Get confidence of winning prediction */
  confidence() {
    if (!this.lastWinner || this.lastTotalScore <= 0) return 0;
    return this.lastWinner.score / this.lastTotalScore;
  }
}
