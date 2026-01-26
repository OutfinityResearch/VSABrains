import { Fact } from './FactSchema.mjs';
import { WorkSignature } from '../reasoning/WorkSignature.mjs';

/**
 * Indexed storage for validated facts.
 */
export class FactStore {
  constructor() {
    this.facts = new Map();
    this.nextId = 0;
    this.byPredicate = new Map();
    this.bySubject = new Map();
    this.byObject = new Map();
    this.byChunk = new Map();
  }

  /** Add validated fact */
  async add(fact) {
    const f = fact instanceof Fact ? fact : new Fact(fact);
    if (!f.id) f.id = `f${this.nextId++}`;
    this.facts.set(f.id, f);

    this._index(this.byPredicate, f.predicate, f.id);
    this._index(this.bySubject, f.subject, f.id);
    this._index(this.byObject, f.object, f.id);
    if (f.source?.chunkId) this._index(this.byChunk, f.source.chunkId, f.id);

    return f;
  }

  _index(map, key, id) {
    if (key == null) return;
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(id);
  }

  /** Query facts by predicate/subject/object */
  async query(criteria = {}) {
    const sets = [];
    if (criteria.predicate) sets.push(this.byPredicate.get(criteria.predicate) ?? new Set());
    if (criteria.subject) sets.push(this.bySubject.get(criteria.subject) ?? new Set());
    if (criteria.object) sets.push(this.byObject.get(criteria.object) ?? new Set());

    let candidateIds = null;
    for (const set of sets) {
      if (candidateIds == null) {
        candidateIds = new Set(set);
      } else {
        for (const id of candidateIds) {
          if (!set.has(id)) candidateIds.delete(id);
        }
      }
    }

    if (candidateIds == null) {
      candidateIds = new Set(this.facts.keys());
    }

    const results = [];
    for (const id of candidateIds) {
      const fact = this.facts.get(id);
      if (!fact) continue;
      if (criteria.version && fact.qualifiers?.version !== criteria.version) continue;
      results.push(fact);
    }

    return results;
  }

  /** Get facts for chunk */
  async getByChunk(chunkId) {
    const ids = this.byChunk.get(chunkId);
    if (!ids) return [];
    return [...ids].map((id) => this.facts.get(id)).filter(Boolean);
  }

  /** Get all facts matching signature pattern */
  async matchSignature(pattern) {
    const p = pattern instanceof WorkSignature
      ? Object.fromEntries(pattern.entries())
      : pattern;

    const results = [];
    for (const fact of this.facts.values()) {
      if (p.qualifiers) {
        let ok = true;
        for (const [k, v] of Object.entries(p.qualifiers)) {
          if (fact.qualifiers?.[k] !== v) { ok = false; break; }
        }
        if (!ok) continue;
      }

      const bindings = WorkSignature.matchPattern(
        { subject: p.subject, predicate: p.predicate, object: p.object },
        { subject: fact.subject, predicate: fact.predicate, object: fact.object }
      );
      if (bindings) results.push(fact);
    }
    return results;
  }
}
