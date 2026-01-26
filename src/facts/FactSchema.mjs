import { WorkSignature } from '../reasoning/WorkSignature.mjs';

/**
 * Fact structure and validation.
 */
export const FactSchema = {
  validate(fact) {
    const errors = [];
    if (!fact || typeof fact !== 'object') errors.push('fact_not_object');
    if (!fact?.span || typeof fact.span.start !== 'number' || typeof fact.span.end !== 'number') {
      errors.push('span_missing');
    }
    if (!fact?.subject) errors.push('subject_missing');
    if (!fact?.predicate) errors.push('predicate_missing');
    if (!('object' in fact)) errors.push('object_missing');
    if (!fact?.source?.docId || !fact?.source?.chunkId) errors.push('source_missing');

    return { valid: errors.length === 0, errors };
  },

  /** Check span contains key elements */
  validateSpan(fact, sourceText) {
    if (!fact?.span || typeof sourceText !== 'string') return false;
    const { start, end } = fact.span;
    if (start < 0 || end > sourceText.length || end <= start) return false;
    const snippet = sourceText.slice(start, end);
    if (fact.subject && !snippet.includes(String(fact.subject))) return false;
    if (typeof fact.object === 'number' && !snippet.includes(String(fact.object))) return false;
    return true;
  },

  /** Normalize fact for storage */
  normalize(fact) {
    return {
      span: fact.span,
      subject: String(fact.subject),
      predicate: String(fact.predicate),
      object: fact.object,
      qualifiers: fact.qualifiers ?? {},
      polarity: fact.polarity ?? 'affirm',
      confidence: fact.confidence ?? 1,
      source: fact.source
    };
  }
};

export class Fact {
  constructor(data) {
    this.data = FactSchema.normalize(data);
    this.id = data.id;
  }

  get span() { return this.data.span; }
  get subject() { return this.data.subject; }
  get predicate() { return this.data.predicate; }
  get object() { return this.data.object; }
  get qualifiers() { return this.data.qualifiers; }
  get polarity() { return this.data.polarity; }
  get confidence() { return this.data.confidence; }
  get source() { return this.data.source; }

  /** Convert to work signature */
  toSignature() {
    const sig = new WorkSignature();
    sig.bind('subject', this.subject);
    sig.bind('predicate', this.predicate);
    sig.bind('object', this.object);
    sig.bind('qualifiers', this.qualifiers);
    return sig;
  }
}
