export const Metrics = {
  // Localization metrics
  computeLocalization(testCases) {
    if (!testCases || testCases.length === 0) {
      return { top1Acc: 0, top5Acc: 0 };
    }
    const top1Acc = testCases.filter((t) => t.top1 === t.groundTruth).length / testCases.length;
    const top5Acc = testCases.filter((t) => (t.topK ?? []).includes(t.groundTruth)).length / testCases.length;
    return { top1Acc, top5Acc };
  },

  // Degradation analysis (log-linear fit)
  computeDegradationRate(lengthAccuracies) {
    if (!lengthAccuracies || lengthAccuracies.length < 2) return 0;
    const xs = lengthAccuracies.map((d) => Math.log(d.length));
    const ys = lengthAccuracies.map((d) => d.accuracy);
    const n = xs.length;
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;

    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - meanX) * (ys[i] - meanY);
      den += (xs[i] - meanX) ** 2;
    }

    const slope = den === 0 ? 0 : num / den;
    return -slope;
  },

  // RAG metrics
  computeRAGMetrics(results) {
    const supported = results.filter((r) => r.expected.verdict === 'supported');
    const unsupported = results.filter((r) => r.expected.verdict === 'unsupported');
    const conflicting = results.filter((r) => r.expected.verdict === 'conflicting');

    const supportedCorrect = supported.filter((r) => r.correct.overall).length;
    const supportedAnswered = results.filter((r) => r.actual.verdict === 'supported').length;

    const supportedPrecision = supportedAnswered === 0 ? 0 : supportedCorrect / supportedAnswered;
    const supportedRecall = supported.length === 0 ? 0 : supportedCorrect / supported.length;

    const refusalCorrect = unsupported.filter((r) => r.correct.refusalMatch).length;
    const refusalAccuracy = unsupported.length === 0 ? 0 : refusalCorrect / unsupported.length;

    const conflictDetected = results.filter((r) => r.actual.verdict === 'conflicting').length;
    const conflictPrecision = conflictDetected === 0 ? 0 : conflicting.filter((r) => r.correct.verdictMatch).length / conflictDetected;
    const conflictRecall = conflicting.length === 0 ? 0 : conflicting.filter((r) => r.correct.verdictMatch).length / conflicting.length;

    const hallucinationRate = results.length === 0
      ? 0
      : results.filter((r) => r.expected.verdict === 'unsupported' && r.actual.verdict === 'supported').length / results.length;

    return {
      supportedPrecision,
      supportedRecall,
      refusalAccuracy,
      conflictPrecision,
      conflictRecall,
      hallucinationRate
    };
  },

  // Extraction consistency (Exp3)
  computeExtractionConsistency(factRuns) {
    if (!factRuns || factRuns.length < 2) return { jaccardAvg: 1, jaccardMin: 1 };
    const pairs = [];
    for (let i = 0; i < factRuns.length; i++) {
      for (let j = i + 1; j < factRuns.length; j++) {
        pairs.push(jaccard(factRuns[i], factRuns[j]));
      }
    }
    const avg = pairs.reduce((a, b) => a + b, 0) / pairs.length;
    const min = Math.min(...pairs);
    return { jaccardAvg: avg, jaccardMin: min };
  },

  // Grid diagnostics (Exp1/Exp2)
  computeGridDiagnostics(stepDiagnostics) {
    if (!stepDiagnostics || stepDiagnostics.length === 0) {
      return { gridUtilization: 0, cellSaturation: 0, cellsAtFullCapacity: 0, nonEmptyCells: 0 };
    }
    const sum = stepDiagnostics.reduce((acc, d) => {
      acc.gridUtilization += d.gridUtilization ?? 0;
      acc.cellSaturation += d.cellSaturation ?? 0;
      acc.cellsAtFullCapacity += d.cellsAtFullCapacity ?? 0;
      acc.nonEmptyCells += d.nonEmptyCells ?? 0;
      return acc;
    }, { gridUtilization: 0, cellSaturation: 0, cellsAtFullCapacity: 0, nonEmptyCells: 0 });

    const n = stepDiagnostics.length;
    return {
      gridUtilization: sum.gridUtilization / n,
      cellSaturation: sum.cellSaturation / n,
      cellsAtFullCapacity: sum.cellsAtFullCapacity / n,
      nonEmptyCells: sum.nonEmptyCells / n
    };
  },

  // Compression threshold detection
  findCompressionThreshold(results) {
    if (!results || results.length < 2) return null;
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1].accuracy;
      const curr = results[i].accuracy;
      if (prev > 0 && (prev - curr) / prev > 0.1) return results[i].compressionLevel;
    }
    return null;
  }
};

function jaccard(aList, bList) {
  const a = new Set(aList);
  const b = new Set(bList);
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 1 : inter / union;
}
