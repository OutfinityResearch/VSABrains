/**
 * Append-only storage for text chunks or structured events.
 */
export class EpisodicStore {
  constructor(config = {}) {
    this.maxChunks = config.maxChunks ?? 100000;
    this.chunks = new Map();
    this.byStep = new Map();
    this.nextId = 0;
  }

  /** Append chunk, returns chunkId */
  async append(chunk) {
    if (this.chunks.size >= this.maxChunks) {
      throw new Error('EpisodicStore capacity exceeded');
    }

    const chunkId = chunk.chunkId ?? this.nextId++;
    this.chunks.set(chunkId, chunk);

    if (typeof chunk.step === 'number') {
      this.byStep.set(chunk.step, { chunkId, ...chunk });
    }

    return chunkId;
  }

  /** Get chunk by ID */
  async get(chunkId) {
    return this.chunks.get(chunkId) ?? null;
  }

  /** Get multiple chunks */
  async getMany(chunkIds) {
    return chunkIds.map((id) => this.chunks.get(id)).filter((v) => v != null);
  }

  /** Get all signatures for indexing */
  async getAllSignatures() {
    const signatures = [];
    for (const [chunkId, chunk] of this.chunks.entries()) {
      if (chunk.signature != null) {
        signatures.push({ signature: chunk.signature, chunkId });
      }
    }
    return signatures;
  }

  /**
   * Get all entries in a step range (inclusive).
   * Returns entries sorted by step.
   */
  async getRange(startStep, endStep) {
    const results = [];

    if (this.byStep.size > 0) {
      for (let s = startStep; s <= endStep; s++) {
        const entry = this.byStep.get(s);
        if (entry) results.push(entry);
      }
    } else {
      for (const chunk of this.chunks.values()) {
        if (typeof chunk.step !== 'number') continue;
        if (chunk.step >= startStep && chunk.step <= endStep) {
          results.push(chunk);
        }
      }
      results.sort((a, b) => a.step - b.step);
    }

    return results;
  }
}
