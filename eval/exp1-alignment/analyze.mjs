import { runExperiment1 } from './run.mjs';
import { Reporter } from '../common/Reporter.mjs';

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

Reporter.print(report);
