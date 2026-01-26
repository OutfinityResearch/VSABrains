# DS005 - Integrations and Non-Core Implementation

**Status:** Draft  
**Version:** 0.1  
**Last Updated:** 2026-01-26

---

## 1. Scope

This specification covers **optional integrations** that are not required for the core discrete runtime:

- Text ingestion (chunking + tokenization)
- LLM-backed fact extraction (provider-agnostic)
- Fact validation (schema + span validation + predicate vocabulary)
- Verifiable RAG answer contract (verdict + evidence chain)

Core algorithms (GridMaps, displacement, localization, replay, reasoning primitives) are specified in DS004.

---

## 2. End-to-End Example (Text → Verdict)

This is the intended “happy path” for Exp3-style usage.

```javascript
import { VSABrains } from '../src/index.mjs';

const brain = new VSABrains({
  tokenizer: { mode: 'simple', lowercase: true },
  extractor: { enabled: true },
});

// Step 1: ingest text (chunk → extract/validate facts → step loop)
await brain.ingest('Alice enters room_A. Bob picks up the key.', { docId: 'demo' });

// Step 2: ask a question (retrieve → reason → verdict + evidence)
const result = await brain.answer('Where is Alice?');

// result.verdict ∈ {'supported','conflicting','unsupported'}
// result.factChain is auditable, result.chunksUsed points to source text.
```

Internal flow (conceptual):

1. `ingest(text, metadata)`
2. `chunk(text)` → chunks
3. For each chunk:
   - `FactExtractor.extract(chunk)` (optional)
   - `FactExtractor.validateAndFilter(facts, chunkText)`
   - write validated facts to `FactStore`
   - optionally emit discrete step inputs and call `step(...)` to populate maps for localization
4. `answer(question)`
   - retrieve candidate chunks/facts
   - run deterministic reasoning + verification
   - return `supported` / `conflicting` / `unsupported` with an evidence chain

---

## 3. LLM Client Interface (Provider-Agnostic)

Any provider (OpenAI/Anthropic/local) must implement a single minimal interface.

```javascript
/**
 * Provider-agnostic LLM client interface.
 *
 * @typedef {{
 *   complete: (prompt: string, options?: {
 *     model?: string,
 *     temperature?: number,
 *     seed?: number,
 *     responseFormat?: 'json' | 'text',
 *     maxTokens?: number,
 *   }) => Promise<{ content: string }>
 * }} LLMClient
 */
```

Requirements:
- Deterministic settings when possible (`temperature=0`, fixed model, stable seed).
- The client returns raw `content` (string) or throws an error; parsing/validation happens outside.

---

## 4. Fact Schema and Validation

### 4.1 Fact Schema (Normalized)

Mandatory fields:
- `span`: `{ start, end }` character offsets into the source chunk
- `subject`: canonical entity string
- `predicate`: a value from the fixed predicate vocabulary
- `object`: value (string/number/boolean)
- `source`: `{ docId, chunkId }`

Optional but recommended:
- `qualifiers`: key/value qualifiers (e.g. `{ version, time, condition }`)
- `polarity`: `"affirm"` or `"negate"`
- `confidence`: number in `[0, 1]`

### 4.2 Predicate Vocabulary

The predicate vocabulary is fixed for a given domain to prevent extractor drift:

```javascript
const predicateVocabulary = {
  // Temporal
  'expires_after': { argTypes: ['entity', 'duration'] },
  'valid_for': { argTypes: ['entity', 'duration'] },
  'created_at': { argTypes: ['entity', 'timestamp'] },

  // Relational
  'requires': { argTypes: ['entity', 'entity'] },
  'contains': { argTypes: ['entity', 'entity'] },
  'part_of': { argTypes: ['entity', 'entity'] },

  // Properties
  'has_value': { argTypes: ['entity', 'value'] },
  'has_type': { argTypes: ['entity', 'type'] },
  'has_status': { argTypes: ['entity', 'status'] },
};
```

Note: predicate IDs are domain strings (often `snake_case`). The JavaScript **API fields** in this project are standardized on `camelCase`.

### 4.3 Span Validation (Evidence Hygiene)

Span validation ensures extracted facts are traceable to the source chunk:

- subject should appear in the span (or an allowed canonical variant)
- numeric objects should appear verbatim
- negation should be consistent with `polarity`

---

## 5. Verifiable Answer Contract (camelCase)

Every answer must be accompanied by auditable artifacts.

```javascript
const answerContract = {
  text: 'string|null',
  verdict: 'supported|conflicting|unsupported',

  chunksUsed: ['string'], // chunk IDs used as evidence

  factChain: [
    {
      factId: 'string',
      role: 'premise|derived|conclusion',
      fact: 'object',
    },
  ],

  supportScores: { factId: 'number' },

  conflicts: [
    {
      fact1: 'object',
      fact2: 'object',
      reason: 'string',
    },
  ],
};
```

If the system cannot produce these artifacts, it must refuse (`unsupported`) rather than guess.

---

## 6. Extraction Consistency (Evaluation Requirement)

LLM extraction is treated as a noisy front-end. For evaluation:
- run extraction `R` times on the same chunk
- compute average Jaccard similarity over normalized facts
- if `< 0.8`, treat extraction as unreliable and fall back to gold/validated facts

