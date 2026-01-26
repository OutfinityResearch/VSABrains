import fs from 'node:fs/promises';

export const Reporter = {
  summarize(experimentName, results) {
    return {
      experiment: experimentName,
      timestamp: new Date().toISOString(),
      results,
      summary: this.generateSummary(results),
      passedCriteria: this.checkCriteria(experimentName, results)
    };
  },

  generateSummary(results) {
    if (!results) return 'No results.';
    return 'Evaluation completed.';
  },

  checkCriteria(experimentName, results) {
    const criteria = [];

    if (experimentName === 'exp1-alignment') {
      const top1 = results?.scenarioA?.top1Acc ?? 0;
      const top5 = results?.scenarioA?.top5Acc ?? 0;
      criteria.push({ criterion: 'top1Acc', passed: top1 > 0.85, actual: top1, target: 0.85 });
      criteria.push({ criterion: 'top5Acc', passed: top5 > 0.95, actual: top5, target: 0.95 });
    }

    if (experimentName === 'exp2-narrative') {
      const acc = results?.baseline?.accuracies?.[0]?.accuracy ?? 0;
      criteria.push({ criterion: 'stateAccuracy', passed: acc > 0.85, actual: acc, target: 0.85 });
    }

    if (experimentName === 'exp3-rag') {
      const supportedPrecision = results?.supported?.metrics?.supportedPrecision ?? 0;
      criteria.push({ criterion: 'supportedPrecision', passed: supportedPrecision > 0.95, actual: supportedPrecision, target: 0.95 });
    }

    return criteria;
  },

  async exportJSON(report, path) {
    await fs.writeFile(path, JSON.stringify(report, null, 2));
  },

  async exportMarkdown(report, path) {
    const content = `# ${report.experiment}\n\n${report.summary}\n`;
    await fs.writeFile(path, content);
  }
};
