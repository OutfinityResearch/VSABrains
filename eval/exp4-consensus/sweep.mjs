import { runExperiment4 } from './run.mjs';

const columnCounts = [1, 3, 5, 7, 9];
const noiseRates = [0.15, 0.25, 0.35];

const baseConfig = {
  numTrials: 3,
  seqLength: 400,
  vocabSize: 500,
  windowSize: 6,
  brainConfig: {
    mapConfig: { width: 64, height: 64, k: 4 },
    displacement: { contextLength: 2, maxStep: 3, seed: 0 }
  }
};

async function runSweep() {
  const rows = [];

  for (const noiseRate of noiseRates) {
    for (const numColumns of columnCounts) {
      const report = await runExperiment4({
        ...baseConfig,
        noiseRate,
        numColumns
      });
      const metrics = report.results?.consensus ?? {};
      rows.push({
        noiseRate,
        numColumns,
        consensusAcc: metrics.consensusAcc ?? 0,
        singleColumnAcc: metrics.singleColumnAcc ?? 0,
        baselineAcc: metrics.baselineAcc ?? 0,
        gainVsSingle: metrics.consensusGainOverSingle ?? 0,
        gainVsBaseline: metrics.consensusGainOverBaseline ?? 0,
        comparisonsPerQuery: metrics.baselineComparisonsPerQuery ?? 0
      });
    }
  }

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseConfig: {
      ...baseConfig,
      noiseRates,
      columnCounts
    },
    rows
  }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runSweep();
}

