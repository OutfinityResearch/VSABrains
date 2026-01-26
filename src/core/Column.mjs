import { GridMap } from './GridMap.mjs';
import { DisplacementEncoder } from './Displacement.mjs';
import { LocationIndex } from '../localization/LocationIndex.mjs';

/**
 * Single column with multiple maps and location state.
 */
export class Column {
  constructor(config = {}) {
    this.id = config.id ?? 'column0';
    this.numFastMaps = config.numFastMaps ?? 2;
    this.numSlowMaps = config.numSlowMaps ?? 0;
    this.mapConfig = config.mapConfig ?? { width: 64, height: 64, k: 4 };
    this.offset = config.offset ?? { x: 0, y: 0 };

    const initialLocation = config.initialLocation ?? {
      x: this.offset.x,
      y: this.offset.y
    };

    this.fastMaps = config.fastMaps ?? Array.from({ length: this.numFastMaps }, () => new GridMap(this.mapConfig));
    this.slowMaps = config.slowMaps ?? Array.from({ length: this.numSlowMaps }, () => new GridMap(this.mapConfig));

    this.fastMapLocations = this.fastMaps.map(() => ({ ...initialLocation }));
    this.slowMapLocations = this.slowMaps.map(() => ({ ...initialLocation }));
    this.location = { ...initialLocation };
    this.initialLocation = { ...initialLocation };

    this.displacementEncoder = config.displacementEncoder || new DisplacementEncoder({
      ...config.displacement,
      width: this.mapConfig.width,
      height: this.mapConfig.height
    });

    // Injected by VSABrains or created here
    this.locationIndex = config.locationIndex || new LocationIndex();
    this.indexMapId = config.indexMapId ?? 0;
    this.slowMapManager = config.slowMapManager ?? null;
    this.episodicStore = config.episodicStore ?? null;

    // Write policy: 'allWriteTokens' | 'stepTokenOnly'
    this.writePolicy = config.writePolicy ?? 'allWriteTokens';

    this.stepCounter = 0;
    this.zeroStepCount = 0;
    this.lastDisplacement = { dx: 0, dy: 0 };
  }

  /** Current location on each map */
  get locations() {
    return { fast: this.fastMapLocations, slow: this.slowMapLocations };
  }

  /**
   * Write one step at the current location.
   * DS004 §2.1: Write happens at PRE-MOVE location.
   */
  stepWrite({ stepTokenId, writeTokenIds = [], event, skipWrite = false, skipIndex = false }, step) {
    const tokensToWrite = this.writePolicy === 'stepTokenOnly'
      ? [stepTokenId]
      : (writeTokenIds.length > 0 ? writeTokenIds : [stepTokenId]);

    if (!skipWrite) {
      for (let i = 0; i < this.fastMaps.length; i++) {
        const { x, y } = this.fastMapLocations[i];
        for (const tokenId of tokensToWrite) {
          this.fastMaps[i].update(x, y, tokenId, 1.0);
        }
      }
    }

    const indexLocation = this.fastMapLocations[this.indexMapId] ?? this.location;
    if (!skipIndex) {
      this.locationIndex.update(stepTokenId, indexLocation.x, indexLocation.y, step);
    }

    if (this.slowMapManager) {
      this.slowMapManager.onStep(event, { ...indexLocation }, step);
    }

    if (this.episodicStore && event) {
      this.episodicStore.append({ step, event, location: { ...indexLocation } });
    }
  }

  /** Update location by displacement */
  stepMove(displacement) {
    this.stepCounter++;
    this.lastDisplacement = displacement;
    if (displacement.dx === 0 && displacement.dy === 0) {
      this.zeroStepCount++;
    }

    for (let i = 0; i < this.fastMapLocations.length; i++) {
      this.fastMapLocations[i] = this.displacementEncoder.apply(
        this.fastMapLocations[i],
        displacement,
        this.mapConfig
      );
    }

    for (let i = 0; i < this.slowMapLocations.length; i++) {
      this.slowMapLocations[i] = this.displacementEncoder.apply(
        this.slowMapLocations[i],
        displacement,
        this.mapConfig
      );
    }

    this.location = this.fastMapLocations[this.indexMapId] ?? this.location;
  }

  /** Diagnostics for this column */
  getDiagnostics() {
    const mapStats = this.fastMaps.map((map) => map.stats());
    const aggregate = aggregateStats(mapStats);
    const zeroStepRate = this.stepCounter > 0 ? this.zeroStepCount / this.stepCounter : 0;
    return {
      ...aggregate,
      zeroStepRate,
      stepCount: this.stepCounter
    };
  }

  reset() {
    this.location = { ...this.initialLocation };
    this.fastMapLocations = this.fastMaps.map(() => ({ ...this.initialLocation }));
    this.slowMapLocations = this.slowMaps.map(() => ({ ...this.initialLocation }));
    this.displacementEncoder.reset();
    this.stepCounter = 0;
    this.zeroStepCount = 0;
    this.lastDisplacement = { dx: 0, dy: 0 };
  }
}

function aggregateStats(stats) {
  if (!stats || stats.length === 0) {
    return { gridUtilization: 0, cellSaturation: 0, cellsAtFullCapacity: 0, nonEmptyCells: 0 };
  }

  const sum = stats.reduce((acc, s) => {
    acc.gridUtilization += s.gridUtilization ?? 0;
    acc.cellSaturation += s.cellSaturation ?? 0;
    acc.cellsAtFullCapacity += s.cellsAtFullCapacity ?? 0;
    acc.nonEmptyCells += s.nonEmptyCells ?? 0;
    return acc;
  }, { gridUtilization: 0, cellSaturation: 0, cellsAtFullCapacity: 0, nonEmptyCells: 0 });

  const n = stats.length;
  return {
    gridUtilization: sum.gridUtilization / n,
    cellSaturation: sum.cellSaturation / n,
    cellsAtFullCapacity: sum.cellsAtFullCapacity / n,
    nonEmptyCells: sum.nonEmptyCells / n
  };
}
