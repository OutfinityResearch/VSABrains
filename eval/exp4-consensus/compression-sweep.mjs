import { runExperiment4 } from './run.mjs';

const baseExperiment = {
  numTrials: 3,
  seqLength: 400,
  vocabSize: 500,
  windowSize: 6,
  noiseRate: 0.25,
  numColumns: 5,
  brainConfig: {
    mapConfig: { width: 64, height: 64, k: 4 },
    displacement: { contextLength: 2, maxStep: 3, seed: 0 },
    localization: { candidatesPerToken: 50, minMatchesRatio: 0.6 },
    locationIndex: { maxLocationsPerToken: 500 }
  }
};

const variants = [
  {
    id: 'baseline',
    label: 'Baseline (64x64, k=4, maxLoc=500)',
    brainConfig: {}
  },
  {
    id: 'k2',
    label: 'Lower K (64x64, k=2, maxLoc=500)',
    brainConfig: {
      mapConfig: { width: 64, height: 64, k: 2 }
    }
  },
  {
    id: 'maxLoc100',
    label: 'Index cap (64x64, k=4, maxLoc=100)',
    brainConfig: {
      locationIndex: { maxLocationsPerToken: 100 }
    }
  },
  {
    id: 'grid32',
    label: 'Smaller grid (32x32, k=4, maxLoc=200)',
    brainConfig: {
      mapConfig: { width: 32, height: 32, k: 4 },
      locationIndex: { maxLocationsPerToken: 200 }
    }
  },
  {
    id: 'grid32k2',
    label: 'Aggressive (32x32, k=2, maxLoc=100)',
    brainConfig: {
      mapConfig: { width: 32, height: 32, k: 2 },
      locationIndex: { maxLocationsPerToken: 100 }
    }
  }
];

function mergeBrainConfig(base, override) {
  return {
    ...base,
    ...override,
    mapConfig: {
      ...(base.mapConfig ?? {}),
      ...(override.mapConfig ?? {})
    },
    displacement: {
      ...(base.displacement ?? {}),
      ...(override.displacement ?? {})
    },
    localization: {
      ...(base.localization ?? {}),
      ...(override.localization ?? {})
    },
    locationIndex: {
      ...(base.locationIndex ?? {}),
      ...(override.locationIndex ?? {})
    }
  };
}

async function runCompressionSweep() {
  const rows = [];

  for (const variant of variants) {
    const brainConfig = mergeBrainConfig(baseExperiment.brainConfig, variant.brainConfig);
    const report = await runExperiment4({
      ...baseExperiment,
      brainConfig
    });
    const metrics = report.results?.consensus ?? {};

    rows.push({
      id: variant.id,
      label: variant.label,
      consensusAcc: metrics.consensusAcc ?? 0,
      gainVsSingle: metrics.consensusGainOverSingle ?? 0,
      vsaBytes: metrics.vsaTotalApproxBytesLowerBound ?? 0,
      mapBytes: metrics.vsaApproxBytesLowerBound ?? 0,
      indexBytes: metrics.locationIndexApproxBytesLowerBound ?? 0,
      baselineBytes: metrics.baselineApproxBytesLowerBound ?? 0,
      workPerQuery: metrics.vsaScoredLocationsPerQueryAvg ?? 0,
      baselineWorkPerQuery: metrics.baselineComparisonsPerQuery ?? 0,
      workRatio: metrics.vsaVsBaselineWorkRatio ?? 0,
      nonEmptyCells: metrics.vsaNonEmptyCellsAvg ?? 0,
      fullCells: metrics.vsaFullCellsAvg ?? 0,
      locationIndexEntries: metrics.locationIndexEntriesAvg ?? 0,
      config: metrics.config ?? {}
    });
  }

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseExperiment,
    rows
  }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runCompressionSweep();
}

