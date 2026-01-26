import { hashCombineU32 } from '../util/hash.mjs';

/**
 * Displacement and regime selection.
 */
export class Controller {
  constructor(columns, config = {}) {
    this.columns = columns;
    this.config = config;
    this.stepCounter = 0;
  }

  /** Compute displacement for the current step (from stepTokenId) */
  computeDisplacement(stepTokenId, column) {
    return column.displacementEncoder.step(stepTokenId);
  }

  /** Select active maps for current regime */
  selectMaps(regime) {
    if (this.config.regimes && regime && this.config.regimes[regime]) {
      return this.config.regimes[regime];
    }
    return null;
  }

  /**
   * Execute one processing step:
   * 1) normalize input → { stepTokenId, writeTokenIds, event }
   * 2) column.stepWrite(...)
   * 3) displacement = column.displacementEncoder.step(stepTokenId)
   * 4) column.stepMove(displacement)
   */
  async step(input) {
    const step = this.stepCounter;

    if (input && typeof input === 'object' && Array.isArray(input.perColumn)) {
      const perColumn = input.perColumn;
      const normalizedInputs = [];
      for (let i = 0; i < this.columns.length; i++) {
        const column = this.columns[i];
        const columnInput = perColumn[i] ?? perColumn[perColumn.length - 1];
        const stepInput = normalizeInput(columnInput);
        normalizedInputs.push(stepInput);
        column.stepWrite(stepInput, step);
        const displacement = this.computeDisplacement(stepInput.stepTokenId, column);
        column.stepMove(displacement);
      }
      this.stepCounter++;
      return { perColumn: normalizedInputs };
    } else {
      const stepInput = normalizeInput(input);
      for (const column of this.columns) {
        column.stepWrite(stepInput, step);
        const displacement = this.computeDisplacement(stepInput.stepTokenId, column);
        column.stepMove(displacement);
      }
      this.stepCounter++;
      return stepInput;
    }
  }
}

function normalizeInput(input) {
  if (typeof input === 'number') {
    return { stepTokenId: input, writeTokenIds: [input] };
  }
  if (Array.isArray(input)) {
    return { stepTokenId: hashCombineU32(input), writeTokenIds: input };
  }
  return input; // { stepTokenId, writeTokenIds, event? }
}
