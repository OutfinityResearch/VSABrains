import { runExperiment3 } from './run.mjs';

const report = await runExperiment3({});
console.log(JSON.stringify(report, null, 2));
