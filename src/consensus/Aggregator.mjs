/**
 * Multi-column prediction aggregation.
 */
export class Aggregator {
  constructor(columns, voter) {
    this.columns = columns;
    this.voter = voter;
  }

  /** Get consensus prediction across columns */
  async aggregate(context) {
    const individuals = await this.getIndividualPredictions(context);
    const votes = individuals.map((p) => {
      const pred = p.prediction;
      if (pred && typeof pred === 'object') {
        return { value: pred.value ?? pred.tokenId ?? pred, score: pred.score ?? pred.weight ?? 1 };
      }
      return { value: pred, score: 1 };
    });

    const winner = this.voter.vote(votes);
    return {
      winner,
      confidence: this.voter.confidence(),
      individuals
    };
  }

  /** Get individual column predictions for analysis */
  async getIndividualPredictions(context) {
    const results = [];
    for (const column of this.columns) {
      if (typeof column.predict !== 'function') continue;
      const prediction = await column.predict(context);
      results.push({ columnId: column.id, prediction });
    }
    return results;
  }
}
