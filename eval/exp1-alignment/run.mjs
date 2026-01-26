import { VSABrains } from '../../src/index.mjs';
import { generateCleanSequence, generateAmbiguousSequence, injectNoise } from './scenarios.mjs';
import { SeededRandom } from '../../src/util/random.mjs';
import { Metrics } from '../common/Metrics.mjs';
import { Reporter } from '../common/Reporter.mjs';

export async function runExperiment1(config = {}) {
  const results = {
    scenarioA: await runScenarioA(config),
    scenarioB: await runScenarioB(config),
    scenarioC: await runScenarioC(config),
    scenarioD: await runScenarioD(config)
  };

  return Reporter.summarize('exp1-alignment', results);
}

async function runScenarioB(config) {
  const testCases = [];
  const numTrials = config.numTrials ?? 3;
  const seqLength = config.seqLength ?? 200;
  const vocabSize = config.vocabSize ?? 100;
  const dropRate = config.dropRate ?? 0.3;

  for (let i = 0; i < numTrials; i++) {
    const brain = new VSABrains({ ...config.brainConfig, numColumns: 1 });
    const writeLocKeys = [];
    const seq = generateCleanSequence(seqLength, vocabSize, i);
    const rng = new SeededRandom(i + 101);

    const windowSize = config.windowSize ?? 5;
    const view = [];
    for (let pos = 0; pos < seq.tokens.length; pos++) {
      const token = seq.tokens[pos];
      const { x, y } = brain.getState().columns[0].location;
      writeLocKeys.push(packLocKey(x, y));
      await brain.step(token);

      if (rng.nextFloat() > dropRate) {
        view.push(token);
        if (view.length >= windowSize) {
          const window = view.slice(view.length - windowSize);
          const candidates = await brain.localize(window);
          testCases.push({
            groundTruth: writeLocKeys[pos],
            top1: candidates[0]?.locKey,
            topK: candidates.slice(0, 5).map((c) => c.locKey),
            scores: candidates.slice(0, 5).map((c) => c.score)
          });
        }
      }
    }
  }

  return Metrics.computeLocalization(testCases);
}

async function runScenarioA(config) {
  const testCases = [];
  const numTrials = config.numTrials ?? 3;
  const seqLength = config.seqLength ?? 200;
  const vocabSize = config.vocabSize ?? 100;

  for (let i = 0; i < numTrials; i++) {
    const brain = new VSABrains({ ...config.brainConfig, numColumns: 1 });
    const writeLocKeys = [];
    const seq = generateCleanSequence(seqLength, vocabSize, i);

    const windowSize = config.windowSize ?? 5;
    for (let pos = 0; pos < seq.tokens.length; pos++) {
      const token = seq.tokens[pos];
      const { x, y } = brain.getState().columns[0].location;
      writeLocKeys.push(packLocKey(x, y));
      await brain.step(token);

      if (pos + 1 >= windowSize) {
        const window = seq.tokens.slice(pos + 1 - windowSize, pos + 1);
        const candidates = await brain.localize(window);
        testCases.push({
          groundTruth: writeLocKeys[pos],
          top1: candidates[0]?.locKey,
          topK: candidates.slice(0, 5).map((c) => c.locKey),
          scores: candidates.slice(0, 5).map((c) => c.score)
        });
      }
    }
  }

  return Metrics.computeLocalization(testCases);
}

async function runScenarioC(config) {
  const testCases = [];
  const numTrials = config.numTrials ?? 3;
  const seqLength = config.seqLength ?? 200;
  const vocabSize = config.vocabSize ?? 100;
  const noiseRate = config.noiseRate ?? 0.1;

  for (let i = 0; i < numTrials; i++) {
    const brain = new VSABrains({ ...config.brainConfig, numColumns: 1 });
    const writeLocKeys = [];
    const seq = generateCleanSequence(seqLength, vocabSize, i);
    const noisy = injectNoise(seq.tokens, noiseRate, vocabSize, i).noisyTokens;

    const windowSize = config.windowSize ?? 5;
    for (let pos = 0; pos < noisy.length; pos++) {
      const token = noisy[pos];
      const { x, y } = brain.getState().columns[0].location;
      writeLocKeys.push(packLocKey(x, y));
      await brain.step(token);

      if (pos + 1 >= windowSize) {
        const window = noisy.slice(pos + 1 - windowSize, pos + 1);
        const candidates = await brain.localize(window);
        testCases.push({
          groundTruth: writeLocKeys[pos],
          top1: candidates[0]?.locKey,
          topK: candidates.slice(0, 5).map((c) => c.locKey),
          scores: candidates.slice(0, 5).map((c) => c.score)
        });
      }
    }
  }

  return Metrics.computeLocalization(testCases);
}

async function runScenarioD(config) {
  const testCases = [];
  const numTrials = config.numTrials ?? 2;
  const seqLength = config.seqLength ?? 200;
  const vocabSize = config.vocabSize ?? 100;

  for (let i = 0; i < numTrials; i++) {
    const brain = new VSABrains({ ...config.brainConfig, numColumns: 1 });
    const seq = generateAmbiguousSequence(seqLength, 5, 3, i);
    const writeLocKeys = [];
    const windowSize = config.windowSize ?? 5;

    for (let pos = 0; pos < seq.tokens.length; pos++) {
      const token = seq.tokens[pos];
      const { x, y } = brain.getState().columns[0].location;
      writeLocKeys.push(packLocKey(x, y));
      await brain.step(token);

      if (pos + 1 >= windowSize) {
        const window = seq.tokens.slice(pos + 1 - windowSize, pos + 1);
        const candidates = await brain.localize(window);
        testCases.push({
          groundTruth: writeLocKeys[pos],
          top1: candidates[0]?.locKey,
          topK: candidates.slice(0, 5).map((c) => c.locKey),
          scores: candidates.slice(0, 5).map((c) => c.score)
        });
      }
    }
  }

  return Metrics.computeLocalization(testCases);
}

function packLocKey(x, y) {
  return (((x & 0xffff) << 16) | (y & 0xffff)) >>> 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await runExperiment1({
    windowSize: 5,
    vocabSize: 100,
    seqLength: 200,
    numTrials: 3,
    brainConfig: {
      numColumns: 1,
      mapConfig: { width: 64, height: 64, k: 4 },
      displacement: { contextLength: 2, maxStep: 3, seed: 0 }
    }
  });

  console.log(JSON.stringify(report, null, 2));
}
