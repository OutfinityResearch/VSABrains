import { runExperiment2 } from './run.mjs';

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
