import { hashString } from './hash.mjs';

/**
 * String↔tokenId mapping. Token IDs are uint32.
 */
export class Vocabulary {
  constructor(config = {}) {
    this.mode = config.mode ?? 'dynamic';
    this.maxSize = config.maxSize ?? 100000;
    this.unkTokenId = config.unkTokenId ?? 3;
    this.hash = config.hash ?? { vocabSize: 1048576, seed: 0 };

    this.tokenToId = new Map();
    this.idToToken = new Map();
    this.nextId = 4; // Reserve 0-3 for special tokens if needed
  }

  /** Map a token string to a tokenId */
  id(token) {
    if (this.mode === 'hash') {
      const { vocabSize, seed } = this.hash;
      if (!vocabSize || vocabSize <= 0) return this.unkTokenId;
      return (hashString(token, seed) % vocabSize) >>> 0;
    }

    if (this.tokenToId.has(token)) {
      return this.tokenToId.get(token);
    }

    if (this.tokenToId.size >= this.maxSize) {
      return this.unkTokenId;
    }

    const id = this.nextId++;
    this.tokenToId.set(token, id);
    this.idToToken.set(id, token);
    return id;
  }

  /** Optional reverse mapping (only for dynamic mode) */
  token(tokenId) {
    if (this.mode !== 'dynamic') return null;
    return this.idToToken.get(tokenId) ?? null;
  }

  /** Current vocabulary size (dynamic mode) */
  size() {
    return this.tokenToId.size;
  }

  toJSON() {
    return {
      mode: this.mode,
      maxSize: this.maxSize,
      unkTokenId: this.unkTokenId,
      hash: this.hash,
      nextId: this.nextId,
      tokenToId: [...this.tokenToId.entries()],
      idToToken: [...this.idToToken.entries()]
    };
  }

  static fromJSON(data) {
    const v = new Vocabulary(data);
    v.nextId = data.nextId ?? v.nextId;
    v.tokenToId = new Map(data.tokenToId ?? []);
    v.idToToken = new Map(data.idToToken ?? []);
    return v;
  }
}
