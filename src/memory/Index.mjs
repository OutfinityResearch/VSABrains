/**
 * Inverted index from signatures to chunk IDs.
 */
export class Index {
  constructor() {
    this.map = new Map(); // signature -> Set<chunkId>
  }

  /** Add signature -> chunkId mapping */
  add(signature, chunkId) {
    if (signature == null) return;
    let set = this.map.get(signature);
    if (!set) {
      set = new Set();
      this.map.set(signature, set);
    }
    set.add(chunkId);
  }

  /** Query chunks by signatures */
  query(signatures, limit = 10) {
    const counts = new Map();

    for (const sig of signatures) {
      const set = this.map.get(sig);
      if (!set) continue;
      for (const id of set) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, limit)
      .map(([id]) => id);
  }

  /** Rebuild index from store */
  async rebuild(store) {
    this.map.clear();
    const signatures = await store.getAllSignatures();
    for (const { signature, chunkId } of signatures) {
      this.add(signature, chunkId);
    }
  }
}
