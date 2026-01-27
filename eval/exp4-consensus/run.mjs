import { VSABrains } from '../../src/index.mjs';
import { SeededRandom } from '../../src/util/random.mjs';
import { Reporter } from '../common/Reporter.mjs';

export async function runExperiment4(config = {}) {
  const results = {
    consensus: await runConsensusScenario(config)
  };

  return Reporter.summarize('exp4-consensus', results);
}

async function runConsensusScenario(config) {
  const numTrials = config.numTrials ?? 3;
  const seqLength = config.seqLength ?? 400;
  const vocabSize = config.vocabSize ?? 500;
  const windowSize = config.windowSize ?? 6;
  const noiseRate = config.noiseRate ?? 0.25;
  const numColumns = config.numColumns ?? 5;

  let consensusCorrect = 0;
  let bestColumnCorrect = 0;
  let singleColumnCorrect = 0;
  let baselineCorrect = 0;
  let baselineComparisons = 0;
  let baselineQueries = 0;
  let totalSteps = 0;
  let totalNonEmptyCells = 0;
  let totalFullCells = 0;
  const approxEntryBytes = config.approxEntryBytes ?? 8;
  const baselineTokenBytes = config.baselineTokenBytes ?? 4;
  const baselineMatchThreshold = config.baselineMatchThreshold ?? windowSize;

  for (let trial = 0; trial < numTrials; trial += 1) {
    const oracle = new VSABrains({ ...config.brainConfig, numColumns: 1 });
    const brain = new VSABrains({ ...config.brainConfig, numColumns });
    const rng = new SeededRandom(trial + 101);

    const perColumnHits = Array.from({ length: numColumns }, () => 0);
    const baselineList = [];
    const tokens = [];
    for (let i = 0; i < seqLength; i += 1) {
      tokens.push(1 + rng.nextInt(vocabSize));
    }

    const locKeys = [];

    for (let pos = 0; pos < tokens.length; pos += 1) {
      const token = tokens[pos];
      const { x, y } = oracle.getState().columns[0].location;
      locKeys.push(packLocKey(x, y));
      await oracle.step(token);

      baselineList.push(token);
      await brain.step(token);

      if (pos + 1 >= windowSize) {
        const cleanWindow = tokens.slice(pos + 1 - windowSize, pos + 1);
        const votes = [];
        for (let c = 0; c < numColumns; c += 1) {
          const noisyWindow = corruptWindow(cleanWindow, rng, noiseRate, vocabSize);
          const candidates = brain.localizer._localizeColumn(noisyWindow, brain.columns[c], 5, config.localization ?? {});
          const top1 = candidates[0]?.locKey;
          if (top1 != null) {
            votes.push({ value: top1, weight: candidates[0]?.score ?? 1 });
          }
          if (top1 === locKeys[pos]) perColumnHits[c] += 1;
        }

        if (votes.length > 0) {
          totalSteps += 1;
          const winner = brain.voter.vote(votes);
          if (winner.value === locKeys[pos]) consensusCorrect += 1;
        }

        const baselineWindow = corruptWindow(cleanWindow, rng, noiseRate, vocabSize);
        const baseline = naiveListLocalize(baselineList, baselineWindow);
        baselineComparisons += baseline.comparisons;
        baselineQueries += 1;
        if (baseline.bestScore >= baselineMatchThreshold) {
          const predictedStep = baseline.bestIndex + windowSize - 1;
          if (locKeys[predictedStep] === locKeys[pos]) baselineCorrect += 1;
        }
      }
    }

    if (totalSteps > 0) {
      bestColumnCorrect += Math.max(...perColumnHits);
      singleColumnCorrect += perColumnHits[0] ?? 0;
    }

    const mapStats = brain.columns.flatMap((column) => column.fastMaps.map((map) => map.stats()));
    const nonEmpty = mapStats.reduce((sum, stat) => sum + (stat.nonEmptyCells ?? 0), 0);
    const fullCells = mapStats.reduce((sum, stat) => sum + (stat.cellsAtFullCapacity ?? 0), 0);
    totalNonEmptyCells += nonEmpty;
    totalFullCells += fullCells;
  }

  const denominator = Math.max(1, totalSteps);
  const consensusAcc = consensusCorrect / denominator;
  const bestColumnAcc = bestColumnCorrect / denominator;
  const singleColumnAcc = singleColumnCorrect / denominator;
  const baselineAcc = baselineCorrect / Math.max(1, baselineQueries);
  const baselineComparisonsPerQuery = baselineQueries > 0 ? baselineComparisons / baselineQueries : 0;
  const vsaNonEmptyCellsAvg = totalNonEmptyCells / Math.max(1, numTrials);
  const vsaApproxBytesLowerBound = vsaNonEmptyCellsAvg * (config.brainConfig?.mapConfig?.k ?? 4) * approxEntryBytes;
  const baselineApproxBytesLowerBound = seqLength * baselineTokenBytes;

  return {
    consensusAcc,
    bestColumnAcc,
    singleColumnAcc,
    baselineAcc,
    baselineComparisons,
    baselineComparisonsPerQuery,
    vsaNonEmptyCellsAvg,
    vsaFullCellsAvg: totalFullCells / Math.max(1, numTrials),
    baselineTokens: seqLength,
    vsaApproxBytesLowerBound,
    baselineApproxBytesLowerBound,
    approxEntryBytes,
    baselineTokenBytes,
    baselineMatchThreshold,
    consensusGainOverBest: consensusAcc - bestColumnAcc,
    consensusGainOverSingle: consensusAcc - singleColumnAcc,
    consensusGainOverBaseline: consensusAcc - baselineAcc,
    config: { numTrials, seqLength, vocabSize, windowSize, noiseRate, numColumns, baselineMatchThreshold }
  };
}

function naiveListLocalize(list, window) {
  let bestIndex = 0;
  let bestScore = -1;
  let comparisons = 0;
  for (let i = 0; i <= list.length - window.length; i += 1) {
    let score = 0;
    for (let j = 0; j < window.length; j += 1) {
      comparisons += 1;
      if (list[i + j] === window[j]) score += 1;
    }
    if (score > bestScore || (score === bestScore && i > bestIndex)) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return { bestIndex, bestScore, comparisons };
}

function corruptWindow(window, rng, noiseRate, vocabSize) {
  return window.map((token) => {
    if (rng.nextFloat() < noiseRate) {
      return 1 + rng.nextInt(vocabSize);
    }
    return token;
  });
}

function packLocKey(x, y) {
  return (((x & 0xffff) << 16) | (y & 0xffff)) >>> 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await runExperiment4({
    numTrials: 3,
    seqLength: 400,
    vocabSize: 500,
    windowSize: 6,
    noiseRate: 0.25,
    numColumns: 5,
    brainConfig: {
      mapConfig: { width: 64, height: 64, k: 4 },
      displacement: { contextLength: 2, maxStep: 3, seed: 0 }
    }
  });

  console.log(JSON.stringify(report, null, 2));
}
