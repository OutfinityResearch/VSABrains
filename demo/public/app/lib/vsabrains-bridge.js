/**
 * VSABrains Bridge - Connects demo/tutorial with real implementation.
 * 
 * This module provides a clean interface to the core VSABrains algorithms
 * for visualization and demonstration purposes.
 */

// Re-export core modules for use in demo visualizations
// Note: In a bundled setup, these would be actual imports from src/
// For browser usage, we provide equivalent implementations

/**
 * Displacement computation matching src/core/Displacement.mjs
 */
export class DisplacementEncoder {
  constructor(config = {}) {
    this.contextLength = config.contextLength ?? 2;
    this.maxStep = config.maxStep ?? 3;
    this.seed = config.seed ?? 0;
    this.avoidZeroStep = config.avoidZeroStep ?? false;
    this.gridWidth = config.width ?? 64;
    this.gridHeight = config.height ?? 64;
    this.buffer = [];
  }

  /**
   * MurmurHash3 x86_32 - matches src/util/hash.mjs
   */
  static murmurHash32(h, seed = 0) {
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return (h ^ seed) >>> 0;
  }

  /**
   * Combine multiple token IDs - matches src/util/hash.mjs
   */
  static hashCombineU32(tokens, seed = 0) {
    let h = seed >>> 0;
    for (const t of tokens) {
      h = (h * 31 + (t >>> 0)) >>> 0;
    }
    return h;
  }

  encode(recentTokens) {
    const context = recentTokens.slice(-this.contextLength);
    const combined = DisplacementEncoder.hashCombineU32(context, this.seed);
    const h = DisplacementEncoder.murmurHash32(combined, this.seed);

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

  step(stepTokenId) {
    this.buffer.push(stepTokenId);
    if (this.buffer.length > this.contextLength) {
      this.buffer.shift();
    }
    return this.encode(this.buffer);
  }

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

/**
 * Heavy-Hitters cell matching src/core/HeavyHitters.mjs
 */
export class HeavyHitters {
  constructor(k = 4) {
    this.k = k;
    this.counts = new Map();
  }

  update(tokenId, weight = 1.0) {
    const current = this.counts.get(tokenId) ?? 0;
    this.counts.set(tokenId, current + weight);
    this._prune();
  }

  _prune() {
    if (this.counts.size <= this.k) return;

    // Find minimum and remove
    const entries = [...this.counts.entries()];
    entries.sort((a, b) => a[1] - b[1]);
    const toRemove = entries.slice(0, entries.length - this.k);
    for (const [key] of toRemove) {
      this.counts.delete(key);
    }
  }

  topK(n = null) {
    const limit = n ?? this.k;
    const entries = [...this.counts.entries()];
    entries.sort((a, b) => b[1] - a[1]);
    return entries.slice(0, limit);
  }

  isFull() {
    return this.counts.size >= this.k;
  }
}

/**
 * Voter for multi-column consensus - matches src/consensus/Voter.mjs
 */
export class Voter {
  constructor() {
    this.lastVotes = [];
    this.lastWinner = null;
    this.lastConfidence = 0;
  }

  vote(predictions) {
    if (!predictions || predictions.length === 0) {
      return { value: null, totalScore: 0 };
    }

    // Aggregate votes by value
    const aggregated = new Map();
    for (const pred of predictions) {
      const value = pred.value ?? pred;
      const score = pred.score ?? 1;
      const current = aggregated.get(value) ?? 0;
      aggregated.set(value, current + score);
    }

    // Find winner
    let winner = null;
    let maxScore = 0;
    let totalScore = 0;

    for (const [value, score] of aggregated.entries()) {
      totalScore += score;
      if (score > maxScore) {
        maxScore = score;
        winner = value;
      }
    }

    this.lastVotes = predictions;
    this.lastWinner = winner;
    this.lastConfidence = totalScore > 0 ? maxScore / totalScore : 0;

    return { value: winner, totalScore: maxScore };
  }

  confidence() {
    return this.lastConfidence;
  }

  getVoteCounts() {
    const counts = [];
    for (const pred of this.lastVotes) {
      counts.push(pred.score ?? 1);
    }
    return counts;
  }
}

/**
 * Generate a path through the grid using displacement
 * This is the visualization-friendly version used in tutorials
 */
export function generatePath(startX, startY, tokens, config = {}) {
  const encoder = new DisplacementEncoder(config);
  const path = [{ x: startX, y: startY, token: tokens[0] }];
  let x = startX, y = startY;

  for (let i = 1; i < tokens.length; i++) {
    const { dx, dy } = encoder.step(tokens[i]);
    x = ((x + dx) % 64 + 64) % 64;
    y = ((y + dy) % 64 + 64) % 64;
    path.push({ x, y, token: tokens[i], dx, dy });
  }

  return path;
}

/**
 * Simulate prediction from grid contents
 */
export function simulatePrediction(gridContents, location) {
  // Returns mock prediction for visualization
  // In real usage, this would read from GridMap
  return {
    value: gridContents[0]?.token ?? null,
    score: 0.8,
    alternatives: gridContents.slice(1).map(t => ({ tokenId: t.token, score: 0.1 }))
  };
}

/**
 * Pack location to locKey - matches src/util/locKey.mjs
 */
export function packLocKey(x, y) {
  return (((x & 0xffff) << 16) | (y & 0xffff)) >>> 0;
}

/**
 * Unpack locKey to location - matches src/util/locKey.mjs
 */
export function unpackLocKey(locKey) {
  return { x: locKey >>> 16, y: locKey & 0xffff };
}
