/**
 * Checkpoint management for replay.
 */
export class CheckpointManager {
  constructor(config = {}) {
    this.policy = config.policy ?? 'adaptive';
    this.interval = config.interval ?? 100;
    this.minInterval = config.minInterval ?? 20;
    this.maxInterval = config.maxInterval ?? 200;
    this.errorMAThreshold = config.errorMAThreshold ?? 0.5;
    this.confidenceThreshold = config.confidenceThreshold ?? 0.3;

    this.checkpoints = []; // [{ step, state }]
  }

  /** Decide whether to checkpoint at this step */
  shouldCheckpoint(step, lastCheckpointStep, event, metrics = {}) {
    if (this.policy === 'fixed') {
      return step - lastCheckpointStep >= this.interval;
    }

    if (step - lastCheckpointStep < this.minInterval) return false;
    if (step - lastCheckpointStep >= this.maxInterval) return true;

    if (metrics.errorMA != null && metrics.errorMA >= this.errorMAThreshold) return true;
    if (metrics.confidence != null && metrics.confidence <= this.confidenceThreshold) return true;

    const action = event?.action ?? event?.type;
    if (action === 'SCENE_RESET') return true;

    return false;
  }

  /** Save checkpoint at current step */
  async save(step, state) {
    this.checkpoints.push({ step, state });
    this.checkpoints.sort((a, b) => a.step - b.step);
  }

  /** Load nearest checkpoint before step */
  async loadBefore(step) {
    for (let i = this.checkpoints.length - 1; i >= 0; i--) {
      if (this.checkpoints[i].step <= step) return this.checkpoints[i];
    }
    return null;
  }

  /** List all checkpoints */
  list() {
    return [...this.checkpoints];
  }
}
