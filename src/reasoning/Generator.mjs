/**
 * Internal prediction and chaining (optional).
 * Not required for the MVP path of Exp1/Exp2.
 */
export class Generator {
  constructor(columns, aggregator, config = {}) {
    this.columns = columns;
    this.aggregator = aggregator;
    this.maxDepth = config.maxDepth ?? 3;
  }

  /** Generate next token(s) */
  async step(state) {
    if (!this.aggregator) return null;
    return this.aggregator.aggregate(state);
  }

  /** Generate chain of N steps */
  async chain(state, steps) {
    const results = [];
    let current = state;
    for (let i = 0; i < steps; i++) {
      const next = await this.step(current);
      results.push(next);
      current = next;
    }
    return results;
  }

  /** Generate until stopping condition */
  async generateUntil(state, stopCondition) {
    const results = [];
    let current = state;
    for (let i = 0; i < this.maxDepth; i++) {
      const next = await this.step(current);
      results.push(next);
      if (stopCondition?.(next, i)) break;
      current = next;
    }
    return results;
  }
}
