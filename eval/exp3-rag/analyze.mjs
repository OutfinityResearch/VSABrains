import { runExperiment3 } from './run.mjs';
import { Reporter } from '../common/Reporter.mjs';

const report = await runExperiment3({});
Reporter.print(report);
