import { VSABrains } from '../../src/index.mjs';
import { generateStory, generateQueries } from './stories.mjs';
import { makeExp2Vocabulary, makeCorefState, eventToStepInput, queryToQuestion } from './encoding.mjs';
import { Metrics } from '../common/Metrics.mjs';
import { Reporter } from '../common/Reporter.mjs';

export async function runExperiment2(config = {}) {
  const results = {
    baseline: await runLengthSweep(config, [100]),
    coref: await runCorefTest(config),
    motifs: await runMotifTest(config),
    compression: await runCompressionSweep(config),
    saturation: await runGridSaturationDiagnostic(config),
    checkpointing: await runCheckpointSweep(config)
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
    writePolicy: 'stepTokenOnly'
  });

  for (const event of story.events) {
    await brain.step(eventToStepInput(event, vocab, corefState));
  }

  let correct = 0;
  for (const q of queries) {
    const answer = await brain.answer(queryToQuestion(q));
    if (answer.text === q.expectedAnswer) correct++;
  }

  accuracies.push({ length, accuracy: queries.length > 0 ? correct / queries.length : 0 });
  return { accuracies, degradationRate: Metrics.computeDegradationRate(accuracies) };
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
    const brain = new VSABrains(brainConfig);

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
      writePolicy: 'stepTokenOnly'
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
      writePolicy: 'stepTokenOnly'
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
      writePolicy: 'stepTokenOnly'
    });

    for (const event of story.events) {
      await brain.step(eventToStepInput(event, vocab, corefState));
    }

    let correct = 0;
    for (const q of queries) {
      const answer = await brain.answer(queryToQuestion(q));
      if (answer.text === q.expectedAnswer) correct++;
    }

    accuracies.push({ length, accuracy: queries.length > 0 ? correct / queries.length : 0 });
  }

  return {
    accuracies,
    degradationRate: Metrics.computeDegradationRate(accuracies)
  };
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
