import { VSABrains } from '../../src/index.mjs';
import { generateStory, generateQueries } from './stories.mjs';
import { makeExp2Vocabulary, makeCorefState, eventToTokens, eventToStepInput, queryToQuestion } from './encoding.mjs';
import { Metrics } from '../common/Metrics.mjs';
import { Reporter } from '../common/Reporter.mjs';
import { transitionRules } from './rules.mjs';
import { hashCombineU32 } from '../../src/util/hash.mjs';
import { DisplacementEncoder } from '../../src/core/Displacement.mjs';

export async function runExperiment2(config = {}) {
  const results = {
    baseline: await runLengthSweep(config, [100]),
    coref: await runCorefTest(config),
    motifs: await runMotifTest(config),
    compression: await runCompressionSweep(config),
    saturation: await runGridSaturationDiagnostic(config),
    checkpointing: await runCheckpointSweep(config),
    timeLocalization: await runTimeLocalizationTest(config),
    conflictDetection: await runConflictDetectionTest(config)
  };

  return Reporter.summarize('exp2-narrative', results);
}

async function runCorefTest(config) {
  const storyConfig = { ...(config.storyConfig ?? {}), corefRate: 0.05, resetRate: 0 };
  const accuracies = [];
  const vocab = makeExp2Vocabulary();

  const length = 100;
  const story = generateStory({ ...storyConfig, numEvents: length });
  let queries = generateQueries(story, config.numQueries ?? 10);
  const locationOnly = queries.filter((q) => q.attribute === 'location');
  if (locationOnly.length > 0) queries = locationOnly;

  const corefState = makeCorefState();
  const brain = new VSABrains({
    ...config.brainConfig,
    writePolicy: 'stepTokenOnly',
    transitionRules
  });

  let corefTotal = 0;
  let corefCorrect = 0;

  for (const event of story.events) {
    if (event.subject === 'P') {
      corefTotal++;
      if (event.resolvedSubject === corefState.lastEntityId) corefCorrect++;
    }
    await brain.step(eventToStepInput(event, vocab, corefState));
  }

  let correct = 0;
  for (const q of queries) {
    const answer = await brain.answer(queryToQuestion(q));
    if (answer.text === q.expectedAnswer) correct++;
  }

  accuracies.push({ length, accuracy: queries.length > 0 ? correct / queries.length : 0 });
  return {
    accuracies,
    degradationRate: Metrics.computeDegradationRate(accuracies),
    corefResolution: corefTotal > 0 ? corefCorrect / corefTotal : 1
  };
}

async function runMotifTest(config) {
  const storyConfig = { ...(config.storyConfig ?? {}), motifRate: 0.1, motifLength: 3 };
  return runLengthSweep({ ...config, storyConfig }, [100]);
}

async function runCompressionSweep(config) {
  const compressionLevels = [1.0, 0.8, 0.6, 0.4, 0.2];
  const results = [];

  for (const level of compressionLevels) {
    const brainConfig = {
      ...config.brainConfig,
      slowMaps: { enabled: true, windowSize: Math.max(5, Math.round(20 / level)), indexSummaries: false },
      writePolicy: 'stepTokenOnly'
    };

    const story = generateStory({ ...config.storyConfig, numEvents: config.storyConfig?.numEvents ?? 100 });
    const queries = generateQueries(story, config.numQueries ?? 10);
    const vocab = makeExp2Vocabulary();
    const corefState = makeCorefState();
    const brain = new VSABrains({ ...brainConfig, transitionRules });

    for (const event of story.events) {
      await brain.step(eventToStepInput(event, vocab, corefState));
    }

    let correct = 0;
    for (const q of queries) {
      const answer = await brain.answer(queryToQuestion(q));
      if (answer.text === q.expectedAnswer) correct++;
    }

    results.push({ compressionLevel: level, accuracy: queries.length > 0 ? correct / queries.length : 0 });
  }

  const threshold = Metrics.findCompressionThreshold(results);
  return { results, threshold };
}

async function runGridSaturationDiagnostic(config) {
  const gridSizes = config.gridSizes || [64, 128, 256];
  const results = [];

  for (const size of gridSizes) {
    const brain = new VSABrains({
      ...config.brainConfig,
      mapConfig: { ...(config.brainConfig?.mapConfig || {}), width: size, height: size },
      writePolicy: 'stepTokenOnly',
      transitionRules
    });

    const story = generateStory({ ...config.storyConfig, numEvents: config.storyConfig?.numEvents ?? 200 });
    const vocab = makeExp2Vocabulary();
    const corefState = makeCorefState();
    for (const event of story.events) {
      await brain.step(eventToStepInput(event, vocab, corefState));
    }

    const diagnostics = brain.getDiagnostics();
    results.push({ gridSize: size, diagnostics: diagnostics.aggregate });
  }

  return { results };
}

async function runCheckpointSweep(config) {
  const policies = [
    { policy: 'fixed', interval: 100 },
    { policy: 'adaptive', minInterval: 20, maxInterval: 200 }
  ];
  const results = [];

  for (const cp of policies) {
    const brain = new VSABrains({
      ...config.brainConfig,
      checkpoint: cp,
      writePolicy: 'stepTokenOnly',
      transitionRules
    });

    const story = generateStory({ ...config.storyConfig, numEvents: config.storyConfig?.numEvents ?? 200 });
    const vocab = makeExp2Vocabulary();
    const corefState = makeCorefState();
    for (const event of story.events) {
      await brain.step(eventToStepInput(event, vocab, corefState));
    }

    results.push({
      checkpoint: cp,
      replay: brain.getReplayStats(),
      checkpoints: brain.getCheckpointStats()
    });
  }

  return { results };
}

async function runLengthSweep(config, lengths) {
  const accuracies = [];
  const vocab = makeExp2Vocabulary();

  for (const length of lengths) {
    const story = generateStory({ ...config.storyConfig, numEvents: length });
    const queries = generateQueries(story, config.numQueries ?? 10);
    const corefState = makeCorefState();

    const brain = new VSABrains({
      ...config.brainConfig,
      writePolicy: 'stepTokenOnly',
      transitionRules
    });

    for (const event of story.events) {
      await brain.step(eventToStepInput(event, vocab, corefState));
    }

    let correct = 0;
    let replaySteps = 0;
    for (const q of queries) {
      const answer = await brain.answer(queryToQuestion(q));
      if (answer.text === q.expectedAnswer) correct++;
      replaySteps += brain.getReplayStats().lastReplaySteps;
    }

    accuracies.push({
      length,
      accuracy: queries.length > 0 ? correct / queries.length : 0,
      avgReplaySteps: queries.length > 0 ? replaySteps / queries.length : 0
    });
  }

  return {
    accuracies,
    degradationRate: Metrics.computeDegradationRate(accuracies)
  };
}

async function runTimeLocalizationTest(config) {
  const story = generateStory({ ...(config.storyConfig ?? {}), numEvents: 200 });
  const vocab = makeExp2Vocabulary();
  const corefState = makeCorefState();
  const brain = new VSABrains({
    ...config.brainConfig,
    writePolicy: 'stepTokenOnly',
    transitionRules
  });

  const stepTokens = [];
  const locKeys = [];

  for (const event of story.events) {
    const eventTokens = eventToTokens(event, vocab, corefState);
    const timeToken = vocab.id(`T:${event.time}`);
    const stepTokenId = hashCombineU32([...eventTokens, timeToken]);
    const stepInput = { stepTokenId, writeTokenIds: [stepTokenId], event };

    stepTokens.push(stepTokenId);

    const { x, y } = brain.getState().columns[0].location;
    locKeys.push(packLocKey(x, y));

    await brain.step(stepInput);
  }

  const windowSize = config.timeLocalizationWindow ?? 15;
  const confidenceThreshold = config.timeLocalizationConfidence ?? 0.8;
  let correct = 0;
  let total = 0;
  let covered = 0;

  const column = brain.columns[0];
  const map = column.fastMaps[column.indexMapId] ?? column.fastMaps[0];
  const encoderConfig = {
    contextLength: column.displacementEncoder.contextLength,
    maxStep: column.displacementEncoder.maxStep,
    seed: column.displacementEncoder.seed,
    width: column.mapConfig.width,
    height: column.mapConfig.height
  };

  for (let pos = windowSize - 1; pos < stepTokens.length; pos++) {
    const window = stepTokens.slice(pos + 1 - windowSize, pos + 1);
    const displacements = computeDisplacements(window, encoderConfig);
    const lastToken = window[window.length - 1];
    const candidates = column.locationIndex.getCandidates(lastToken, 50);

    let best = null;
    for (const candidate of candidates) {
      const score = verifyWindowCandidate(candidate.locKey, window, displacements, map, column.mapConfig);
      if (!best || score > best.score) {
        best = { locKey: candidate.locKey, score };
      }
    }

    total++;
    if (best && best.score >= confidenceThreshold) {
      covered++;
      if (best.locKey === locKeys[pos]) correct++;
    }
  }

  return {
    timeLocAccuracy: covered > 0 ? correct / covered : 0,
    coverage: total > 0 ? covered / total : 0
  };
}

async function runConflictDetectionTest(config) {
  const brain = new VSABrains({
    ...config.brainConfig,
    writePolicy: 'stepTokenOnly',
    transitionRules
  });
  const vocab = makeExp2Vocabulary();
  const corefState = makeCorefState();

  const events = [
    { time: 0, subject: 'E1', action: 'dies', object: null },
    { time: 1, subject: 'E1', action: 'enters', object: 'room_A' }
  ];

  for (const event of events) {
    await brain.step(eventToStepInput(event, vocab, corefState));
  }

  const result = await brain.replayer.replayWithHistory(1);
  return { detectionRate: result.violations.length > 0 ? 1 : 0 };
}

function packLocKey(x, y) {
  return (((x & 0xffff) << 16) | (y & 0xffff)) >>> 0;
}

function unpackLocKey(locKey) {
  return { x: locKey >>> 16, y: locKey & 0xffff };
}

function computeDisplacements(tokens, config) {
  const encoder = new DisplacementEncoder(config);
  return tokens.map((token) => encoder.step(token));
}

function verifyWindowCandidate(locKey, tokens, displacements, map, mapConfig) {
  let { x, y } = unpackLocKey(locKey);
  let matches = 0;

  for (let i = tokens.length - 1; i >= 0; i--) {
    const top = map.readTopK(x, y, mapConfig.k ?? 4);
    if (top.some(([id]) => id === tokens[i])) matches++;

    if (i > 0) {
      const disp = displacements[i - 1];
      x = wrap(x - disp.dx, mapConfig.width);
      y = wrap(y - disp.dy, mapConfig.height);
    }
  }

  return tokens.length > 0 ? matches / tokens.length : 0;
}

function wrap(n, size) {
  return ((n % size) + size) % size;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await runExperiment2({
    storyConfig: { numEntities: 3, numEvents: 100, corefRate: 0.1, resetRate: 0 },
    numQueries: 10,
    brainConfig: {
      numColumns: 1,
      mapConfig: { width: 64, height: 64, k: 4 },
      displacement: { contextLength: 2, maxStep: 3, seed: 0 }
    }
  });

  console.log(JSON.stringify(report, null, 2));
}
