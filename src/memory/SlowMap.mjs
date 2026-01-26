import { GridMap } from '../core/GridMap.mjs';
import { WindowSummary } from './Summary.mjs';

/**
 * Slow-map manager: accumulates WindowSummary and periodically writes a summary token
 * into one or more slow GridMaps, plus keeps a summary store for retrieval.
 */
export class SlowMapManager {
  constructor(config = {}) {
    this.windowSize = config.windowSize ?? 20;
    this.locationIndex = config.locationIndex ?? null;
    this.mapConfig = config.mapConfig ?? { width: 64, height: 64, k: 4 };
    this.maps = config.maps ?? [new GridMap(this.mapConfig)];

    this.summaryStore = new Map(); // summaryTokenId -> WindowSummary
    this.currentSummary = null;
  }

  /** Called on every step (after write, before move) */
  onStep(event, location, step) {
    if (!this.currentSummary) {
      this.currentSummary = new WindowSummary(step);
    }

    this.currentSummary.addEvent(event);

    if ((step + 1) % this.windowSize === 0) {
      this.flushWindow(location, step);
    }
  }

  /** Flushes the current window into the slow map(s) */
  flushWindow(location, step) {
    if (!this.currentSummary) return;

    this.currentSummary.endStep = step;
    const summaryTokenId = this.currentSummary.toTokenId();

    for (const map of this.maps) {
      map.update(location.x, location.y, summaryTokenId, 1.0);
    }

    this.summaryStore.set(summaryTokenId, this.currentSummary);

    if (this.locationIndex) {
      this.locationIndex.update(summaryTokenId, location.x, location.y, step);
    }

    this.currentSummary = new WindowSummary(step + 1);
  }
}
