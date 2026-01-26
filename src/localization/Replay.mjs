/**
 * Replay from checkpoint to reconstruct structured state (experiment-dependent).
 */
export class Replayer {
  /**
   * @param {CheckpointManager} checkpointManager
   * @param {EpisodicStore} episodicStore
   * @param {{ init: () => any, apply: (state: any, event: any) => void, clone?: (state: any) => any }} stateModel
   * @param {Verifier|null} verifier
   */
  constructor(checkpointManager, episodicStore, stateModel, verifier = null) {
    this.checkpointManager = checkpointManager;
    this.episodicStore = episodicStore;
    this.stateModel = stateModel;
    this.verifier = verifier;
  }

  /** Replay from checkpoint to target step */
  async replay(targetStep) {
    const checkpoint = await this.checkpointManager.loadBefore(targetStep);
    const startStep = checkpoint?.step ?? 0;

    let state = null;
    if (checkpoint?.state) {
      const checkpointState = checkpoint.state.exp2State ?? checkpoint.state;
      state = this._clone(checkpointState);
    } else {
      state = this.stateModel.init();
    }

    const events = this.episodicStore
      ? await this.episodicStore.getRange(startStep, targetStep)
      : [];

    for (const entry of events) {
      this.stateModel.apply(state, entry.event);
    }

    return state;
  }

  /** Replay and return intermediate states */
  async replayWithHistory(targetStep) {
    const checkpoint = await this.checkpointManager.loadBefore(targetStep);
    const startStep = checkpoint?.step ?? 0;

    let state = null;
    if (checkpoint?.state) {
      const checkpointState = checkpoint.state.exp2State ?? checkpoint.state;
      state = this._clone(checkpointState);
    } else {
      state = this.stateModel.init();
    }

    const events = this.episodicStore
      ? await this.episodicStore.getRange(startStep, targetStep)
      : [];

    const history = [];
    const violations = [];

    for (const entry of events) {
      const prev = this._clone(state);
      this.stateModel.apply(state, entry.event);
      const next = this._clone(state);

      if (this.verifier) {
        const stepViolations = this.verifier.checkTransition(prev, entry.event, next);
        if (stepViolations.length > 0) {
          violations.push({ step: entry.step, violations: stepViolations });
        }
      }

      history.push({ step: entry.step, prev, event: entry.event, next });
    }

    return { history, violations };
  }

  _clone(state) {
    if (this.stateModel.clone) return this.stateModel.clone(state);
    return structuredClone(state);
  }
}
