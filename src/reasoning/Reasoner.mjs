import { WorkSignature } from './WorkSignature.mjs';

/**
 * Derivation engine with verdict output (Exp3).
 */
export class Reasoner {
  constructor(factStore, generator, config = {}) {
    this.factStore = factStore;
    this.generator = generator;
    this.config = config;
  }

  /** Attempt to derive target from facts */
  async derive(target, maxSteps = 5) {
    const pattern = target instanceof WorkSignature ? target : WorkSignature.canonicalize(target, []);
    const direct = await this.factStore.matchSignature(pattern);
    if (direct.length > 0) {
      return { chain: [direct[0]], bindings: new Map(), steps: 1 };
    }

    if (this.config.ruleLibrary) {
      const ctx = { factStore: this.factStore };
      const result = await this._deriveWithRules(pattern, ctx, maxSteps);
      return result;
    }

    return null;
  }

  async _deriveWithRules(goalPattern, ctx, depth) {
    if (depth <= 0) return null;
    const direct = await this.factStore.matchSignature(goalPattern);
    if (direct.length > 0) return { chain: [direct[0]], bindings: new Map(), steps: 1 };

    for (const rule of this.config.ruleLibrary) {
      const unifier = WorkSignature.matchPattern(rule.head, goalPattern);
      if (!unifier) continue;

      const subChains = [];
      for (const subGoal of rule.body(unifier, ctx)) {
        const res = await this._deriveWithRules(subGoal, ctx, depth - 1);
        if (!res) { subChains.length = 0; break; }
        subChains.push(...res.chain);
      }
      if (subChains.length > 0) {
        const derived = rule.conclude(unifier, ctx, subChains);
        return { chain: [...subChains, derived], bindings: unifier, steps: subChains.length + 1 };
      }
    }

    return null;
  }

  /** Check for conflicts in fact set */
  async checkConflicts(facts, queryPlan = {}) {
    const conflicts = [];
    const keyOf = (f) => `${f.subject}::${f.predicate}`;
    const groups = new Map();

    for (const fact of facts) {
      const key = keyOf(fact);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(fact);
    }

    for (const group of groups.values()) {
      const filtered = queryPlan.version
        ? group.filter((f) => f.qualifiers?.version === queryPlan.version)
        : group;

      const values = new Map();
      for (const fact of filtered) {
        const valueKey = `${String(fact.object)}::${fact.polarity ?? 'affirm'}`;
        if (!values.has(valueKey)) values.set(valueKey, []);
        values.get(valueKey).push(fact);
      }

      if (values.size > 1) {
        const allFacts = filtered;
        for (let i = 0; i < allFacts.length; i++) {
          for (let j = i + 1; j < allFacts.length; j++) {
            const a = allFacts[i];
            const b = allFacts[j];
            if (a.object !== b.object || (a.polarity ?? 'affirm') !== (b.polarity ?? 'affirm')) {
              conflicts.push({ fact1: a, fact2: b, reason: 'conflict_key_mismatch' });
            }
          }
        }
      }
    }

    return conflicts;
  }

  /** Full answer with verdict and chain */
  async answer(query) {
    const plan = this.config.plan
      ? await this.config.plan(query)
      : (typeof query === 'object' ? query : { text: query });

    const facts = await this._retrieveFacts(plan);
    if (facts.length === 0) {
      return { text: null, verdict: 'unsupported', chunksUsed: [], factChain: [], supportScores: {}, conflicts: [] };
    }

    const conflicts = await this.checkConflicts(facts, plan);
    if (conflicts.length > 0) {
      return { text: null, verdict: 'conflicting', chunksUsed: [], factChain: [], supportScores: {}, conflicts };
    }

    const best = facts[0];

    // Deterministic evaluator for duration comparison (Exp3 MVP)
    if (plan.params?.inactivityMinutes != null && best.predicate === 'expires_after') {
      const expiresMinutes = parseDurationMinutes(best.object);
      if (expiresMinutes != null) {
        const inactive = Number(plan.params.inactivityMinutes);
        const expired = inactive > expiresMinutes;
        const derived = {
          subject: best.subject,
          predicate: 'session_expired',
          object: expired ? 'true' : 'false',
          qualifiers: best.qualifiers
        };
    return {
      text: expired ? 'No' : 'Yes',
      verdict: 'supported',
      chunksUsed: best.source?.chunkId != null ? [String(best.source.chunkId)] : [],
      factChain: [
        { factId: best.id ?? 'fact0', role: 'premise', fact: best },
        { factId: 'derived0', role: 'derived', fact: derived }
      ],
          supportScores: { [best.id ?? 'fact0']: best.confidence ?? 1, derived0: 1 },
          conflicts: []
        };
      }
    }

    return {
      text: String(best.object ?? ''),
      verdict: 'supported',
      chunksUsed: best.source?.chunkId != null ? [String(best.source.chunkId)] : [],
      factChain: [
        { factId: best.id ?? 'fact0', role: 'premise', fact: best }
      ],
      supportScores: { [best.id ?? 'fact0']: best.confidence ?? 1 },
      conflicts: []
    };
  }

  async _retrieveFacts(plan) {
    if (this.config.retrieve) {
      return this.config.retrieve(plan);
    }

    const predicate = plan.predicates?.[0] ?? plan.predicate;
    const subject = plan.subjects?.[0] ?? plan.subject;
    const criteria = { predicate, subject, version: plan.version };
    return this.factStore.query(criteria);
  }
}

function parseDurationMinutes(value) {
  if (value == null) return null;
  const text = String(value).toLowerCase();
  const match = text.match(/(\d+(?:\.\d+)?)\s*(minute|minutes|min|hour|hours|hr|hrs)/);
  if (!match) return null;
  const num = Number(match[1]);
  const unit = match[2];
  if (Number.isNaN(num)) return null;
  if (unit.startsWith('hour') || unit.startsWith('hr')) return num * 60;
  return num;
}
