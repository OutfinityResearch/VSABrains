/**
 * Demo render module (barrel export)
 * Implementations live in ./render/*.js to keep files small and focused.
 */

export {
  drawGrid,
  drawSaturationHeatmap
} from './render/grid.js';

export {
  ensureVisibleColumns,
  renderColumnFilters,
  setAllColumns,
  wireColumnControls
} from './render/columns.js';

export { addActivity } from './render/activity.js';

export {
  renderFrameLegend,
  buildFrameTimeline
} from './render/legend.js';

export {
  triggerPulse,
  clearQuerySequence,
  startQueryAnimation,
  startFramesAnimation,
  stopAnimation,
  stepAnimation
} from './render/animation.js';

export {
  updatePerf,
  updateAnimationSpeedLabels,
  updateAnimationSpeed
} from './render/perf.js';

export {
  computeVotingFromColumns,
  updateVotingState,
  setLocalizationCandidates,
  setTheoryVizEnabled
} from './render/theory.js';

