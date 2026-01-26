import { FactSchema } from './FactSchema.mjs';

/**
 * LLM-based fact extraction wrapper.
 */
export class FactExtractor {
  constructor(config = {}) {
    this.llmClient = config.llmClient ?? null;
    this.model = config.model ?? 'gpt-4.1';
    this.temperature = config.temperature ?? 0;
    this.seed = config.seed ?? 0;
    this.schema = config.schema ?? FactSchema;
    this.predicateVocabulary = config.predicateVocabulary ?? {};
    this.maxRetries = config.maxRetries ?? 1;
    this.promptBuilder = config.promptBuilder ?? defaultPromptBuilder;
  }

  /** Extract facts from text chunk */
  async extract(chunk) {
    if (!this.llmClient) {
      throw new Error('FactExtractor requires llmClient');
    }

    const text = typeof chunk === 'string' ? chunk : chunk.text ?? '';
    const prompt = this.promptBuilder(text, this.predicateVocabulary);

    let attempts = 0;
    while (attempts <= this.maxRetries) {
      attempts++;
      const response = await this.llmClient.complete(prompt, {
        model: this.model,
        temperature: this.temperature,
        seed: this.seed,
        responseFormat: 'json'
      });

      try {
        const parsed = JSON.parse(response.content);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        if (attempts > this.maxRetries) throw err;
      }
    }

    return [];
  }

  /** Validate and filter extracted facts */
  async validateAndFilter(facts, sourceText) {
    const filtered = [];
    for (const fact of facts) {
      const { valid } = this.schema.validate(fact);
      if (!valid) continue;
      if (!this.schema.validateSpan(fact, sourceText)) continue;
      if (fact.predicate && !this.predicateVocabulary[fact.predicate]) continue;
      filtered.push(this.schema.normalize(fact));
    }
    return filtered;
  }

  /** Optional: measure extraction consistency across repeated runs */
  async consistencyCheck(chunk, runs = 5) {
    const normalizedRuns = [];
    for (let i = 0; i < runs; i++) {
      const facts = await this.extract(chunk);
      const norm = facts.map((f) => JSON.stringify(this.schema.normalize(f)));
      normalizedRuns.push(norm);
    }

    return computeJaccardStats(normalizedRuns);
  }
}

function defaultPromptBuilder(text, predicateVocabulary) {
  const predicates = Object.keys(predicateVocabulary || {}).join(', ');
  return [
    'Extract facts as JSON array with fields: span, subject, predicate, object, source, qualifiers, polarity, confidence.',
    `Allowed predicates: ${predicates}`,
    'Text:',
    text
  ].join('\n');
}

function computeJaccardStats(runs) {
  if (runs.length < 2) return { jaccardAvg: 1, jaccardMin: 1 };

  const jaccards = [];
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      jaccards.push(jaccard(runs[i], runs[j]));
    }
  }

  const avg = jaccards.reduce((a, b) => a + b, 0) / jaccards.length;
  const min = Math.min(...jaccards);
  return { jaccardAvg: avg, jaccardMin: min };
}

function jaccard(aList, bList) {
  const a = new Set(aList);
  const b = new Set(bList);
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 1 : inter / union;
}
