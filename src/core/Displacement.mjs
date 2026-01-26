import { murmurHash32, hashCombineU32 } from '../util/hash.mjs';

/**
 * Displacement computation from tokens.
 * Implements DS004 §5: Order as Address.
 */
export class DisplacementEncoder {
  constructor(config = {}) {
    this.method = config.method ?? 'hash_ngram';
    this.contextLength = config.contextLength ?? 2;
    this.maxStep = config.maxStep ?? 3;
    this.seed = config.seed ?? 0;
    this.avoidZeroStep = config.avoidZeroStep ?? false;

    const gridSize = config.gridSize ?? null;
    this.gridWidth = gridSize ?? config.width ?? 64;
    this.gridHeight = gridSize ?? config.height ?? 64;

    // Internal context buffer
    this.buffer = [];
  }

  /**
   * Pure function: compute displacement from a window of step tokens.
   */
  encode(recentStepTokenIds) {
    if (this.method !== 'hash_ngram') {
      throw new Error(`Unsupported displacement method: ${this.method}`);
    }
    const context = recentStepTokenIds.slice(-this.contextLength);
    const combined = hashCombineU32(context, this.seed);
    const h = murmurHash32(combined, this.seed);

    const range = 2 * this.maxStep + 1;
    let dx = (h % range) - this.maxStep;
    let dy = ((h >>> 16) % range) - this.maxStep;

    if (this.avoidZeroStep && dx === 0 && dy === 0) {
      const dir = (h >>> 24) & 3;
      if (dir === 0) dx = 1;
      else if (dir === 1) dx = -1;
      else if (dir === 2) dy = 1;
      else dy = -1;
    }

    return { dx, dy };
  }

  /**
   * Update the internal context buffer and return displacement.
   * DS004 §2.1: current token influences its own movement.
   */
  step(stepTokenId) {
    this.buffer.push(stepTokenId);
    if (this.buffer.length > this.contextLength) {
      this.buffer.shift();
    }
    return this.encode(this.buffer);
  }

  /**
   * Apply displacement to location with wrapping.
   */
  apply(location, displacement, gridConfig = null) {
    const { x, y } = location;
    const { dx, dy } = displacement;
    const width = gridConfig?.width ?? this.gridWidth;
    const height = gridConfig?.height ?? this.gridHeight;

    return {
      x: ((x + dx) % width + width) % width,
      y: ((y + dy) % height + height) % height
    };
  }

  reset() {
    this.buffer = [];
  }
}
