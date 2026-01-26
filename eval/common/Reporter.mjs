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

      if (results?.scenarioB?.consensusGain != null) {
        criteria.push({
          criterion: 'consensusGain',
          passed: results.scenarioB.consensusGain > 0.05,
          actual: results.scenarioB.consensusGain,
          target: 0.05
        });
      }

      const noiseBase = results?.scenarioA?.top1Acc ?? 0;
      const noiseAcc = results?.scenarioC?.top1Acc ?? 0;
      const noiseRobustness = noiseBase > 0 ? noiseAcc / noiseBase : 0;
      criteria.push({
        criterion: 'noiseRobustness',
        passed: noiseRobustness > 0.9,
        actual: noiseRobustness,
        target: 0.9
      });

      const ambiguous = results?.scenarioD?.top1Acc ?? 0;
      criteria.push({
        criterion: 'ambiguousDisambiguation',
        passed: ambiguous > 0.7,
        actual: ambiguous,
        target: 0.7
      });
    }

    if (experimentName === 'exp2-narrative') {
      const acc = results?.baseline?.accuracies?.[0]?.accuracy ?? 0;
      criteria.push({ criterion: 'stateAccuracy', passed: acc > 0.85, actual: acc, target: 0.85 });

      const coref = results?.coref?.corefResolution ?? 0;
      criteria.push({ criterion: 'corefResolution', passed: coref > 0.9, actual: coref, target: 0.9 });

      const motifAcc = results?.motifs?.accuracies?.[0]?.accuracy ?? 0;
      criteria.push({ criterion: 'motifHandling', passed: motifAcc > 0.75, actual: motifAcc, target: 0.75 });

      const timeLoc = results?.timeLocalization?.timeLocAccuracy ?? 0;
      criteria.push({ criterion: 'timeLocAccuracy', passed: timeLoc > 0.8, actual: timeLoc, target: 0.8 });

      const conflict = results?.conflictDetection?.detectionRate ?? 0;
      criteria.push({ criterion: 'conflictDetection', passed: conflict > 0.9, actual: conflict, target: 0.9 });
    }

    if (experimentName === 'exp3-rag') {
      const supportedPrecision = results?.supported?.metrics?.supportedPrecision ?? 0;
      criteria.push({ criterion: 'supportedPrecision', passed: supportedPrecision > 0.95, actual: supportedPrecision, target: 0.95 });

      const supportedRecall = results?.supported?.metrics?.supportedRecall ?? 0;
      criteria.push({ criterion: 'supportedRecall', passed: supportedRecall > 0.85, actual: supportedRecall, target: 0.85 });

      const refusalAccuracy = results?.unsupported?.metrics?.refusalAccuracy ?? 0;
      criteria.push({ criterion: 'refusalAccuracy', passed: refusalAccuracy > 0.9, actual: refusalAccuracy, target: 0.9 });

      const advRefusal = results?.adversarial?.metrics?.refusalAccuracy ?? 0;
      criteria.push({ criterion: 'adversarialRefusal', passed: advRefusal > 0.8, actual: advRefusal, target: 0.8 });

      const conflictPrecision = results?.conflicting?.metrics?.conflictPrecision ?? 0;
      const conflictRecall = results?.conflicting?.metrics?.conflictRecall ?? 0;
      criteria.push({ criterion: 'conflictPrecision', passed: conflictPrecision > 0.85, actual: conflictPrecision, target: 0.85 });
      criteria.push({ criterion: 'conflictRecall', passed: conflictRecall > 0.8, actual: conflictRecall, target: 0.8 });

      const hallucination = results?.supported?.metrics?.hallucinationRate ?? 0;
      criteria.push({ criterion: 'hallucinationRate', passed: hallucination < 0.05, actual: hallucination, target: 0.05 });

      const extractionConsistency = results?.extractionConsistency?.jaccardAvg ?? null;
      if (extractionConsistency != null) {
        criteria.push({ criterion: 'extractionConsistency', passed: extractionConsistency >= 0.8, actual: extractionConsistency, target: 0.8 });
      }

      const predicateCoverage = results?.predicateCoverage ?? null;
      if (predicateCoverage != null) {
        criteria.push({ criterion: 'predicateCoverage', passed: predicateCoverage >= 1.0, actual: predicateCoverage, target: 1.0 });
      }
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
