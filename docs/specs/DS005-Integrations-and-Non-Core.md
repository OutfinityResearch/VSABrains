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
- Exp3-oriented retrieval (question → candidate facts/chunks)
- Exp3-oriented derivation + conflict detection (how answers become `supported` / `conflicting` / `unsupported`)
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

{% raw %}
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
{% endraw %}

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

### 4.4 Conflict Detection and Versioning (Exp3)

Conflict detection is an **answer-time** operation over the candidate facts relevant to a query context.

Definitions:
- `version` is carried in `fact.qualifiers.version` (string) when available (often copied from document metadata).
- A fact’s **conflict key** is:
  - `(subject, predicate)` by default, and
  - may be extended by relevant qualifiers (e.g., `condition`) if the predicate semantics require it.

Baseline rules:
1. If the query specifies `version`, only facts with `qualifiers.version === version` participate. Within that filtered set, two facts conflict if they have the same conflict key but different `(object, polarity)`.
2. If the query does **not** specify `version`, and multiple versions provide different answers for the same conflict key, the answer must be `conflicting` (do not silently choose one).
3. Polarity mismatch (`affirm` vs `negate`) for the same conflict key is always a conflict.

Minimal conflict artifact (for the answer contract):
- Include the smallest set of conflicting fact pairs needed to justify `conflicting`.
- Prefer returning `text: null` for `conflicting` unless the question explicitly asks for “list differences”.

---

## 5. Question → Retrieval Pipeline (Exp3)

Retrieval must be **deterministic** and **auditable**: every returned fact must point to a source chunk, and `chunksUsed` must be derivable from those facts.

### 5.1 QueryPlan (Structured Form)

For stable behavior (especially in evaluation), the system should operate on a structured query plan:

{% raw %}
```javascript
/**
 * @typedef {{
 *   // Optional disambiguation (often copied from question or evaluation metadata).
 *   version?: string,
 *
 *   // Retrieval hints (may be empty; the planner can still fall back to keyword/entity extraction).
 *   subjects?: string[],    // canonical entity IDs (e.g. ['session_token', 'S:Alice'])
 *   predicates?: string[],  // predicate vocabulary entries (e.g. ['expires_after'])
 *
 *   // Goal-directed reasoning (optional). Patterns may contain variables like '?x'.
 *   // Use a WorkSignature-like shape with roles: { subject, predicate, object, qualifiers }.
 *   // Values may be constants or variables (e.g., '?duration').
 *   goal?: { subject?: any, predicate: any, object?: any, qualifiers?: object },
 *
 *   // Extra parameters for derived questions (e.g. inactivityMinutes=20).
 *   params?: object,
 * }} QueryPlan
 */
```
{% endraw %}

### 5.2 Deterministic Planning (Recommended)

For Exp3 evaluation, do **not** rely on an LLM to interpret questions. Prefer:
- constrained question templates parsed by regex/grammar, or
- structured query plans stored alongside question text in the eval suite.

If an LLM is used, it must:
- output a `QueryPlan` as JSON, and
- pass strict validation (predicate vocabulary, allowed fields, spans, etc.).

### 5.3 Baseline Retrieval Strategy

Given a `QueryPlan`, retrieval proceeds as:

1. Determine a bounded set of candidate facts:
   - if `predicates` is present: call `FactStore.query({ predicate, version, subject })` per predicate
   - if `goal` is present: convert it into a `WorkSignature` pattern and call `FactStore.matchSignature(pattern)`
2. Filter by `version` when provided.
3. Rank candidates (deterministic tie-breakers):
   - exact predicate match
   - exact subject match
   - higher `confidence` (if present)
   - stable source ordering (e.g., `docId`, `chunkId`)
4. Return at most `limitFacts` facts and set:
   - `chunksUsed = unique(facts.map(f => f.source.chunkId))`, capped by `limitChunks`

This is intentionally simple; the goal is deterministic behavior and auditable evidence, not semantic search.

Example (planner output):

```javascript
// "How long before session tokens expire from inactivity?"
const plan = {
  subjects: ['session_token'],
  predicates: ['expires_after'],
  goal: { subject: 'session_token', predicate: 'expires_after', object: '?duration' },
};
```

---

## 6. Derivation and Verdict (Exp3)

Derivation is goal-directed and produces an explicit evidence chain.

DS004 defines the core binding/unification primitives (`WorkSignature`, `Workpad`). DS005 defines how those primitives are used in Exp3-style answering.

### 6.1 Derivation Strategy (Baseline: Backward Chaining)

Backward chaining is recommended because queries are goal-directed (you know what you want to prove).

Conceptual algorithm:

```javascript
async function derive(goalPattern, ctx, depth) {
  if (depth <= 0) return null;

  // 1) Direct fact support
  const direct = await factStore.matchSignature(goalPattern);
  if (direct.length > 0) return { chain: [direct[0]], bindings: {} };

  // 2) Rule-based expansion (domain-specific)
  for (const rule of ruleLibrary) {
    const unifier = WorkSignature.matchPattern(rule.head, goalPattern);
    if (!unifier) continue;

    const subChains = [];
    for (const subGoal of rule.body(unifier, ctx)) {
      const res = await derive(subGoal, ctx, depth - 1);
      if (!res) { subChains.length = 0; break; }
      subChains.push(...res.chain);
    }
    if (subChains.length > 0) {
      const derived = rule.conclude(unifier, ctx, subChains);
      return { chain: [...subChains, derived], bindings: unifier };
    }
  }

  return null;
}
```

Notes:
- `ruleLibrary` is deterministic and **hand-written** for the domain/predicate vocabulary.
- `depth` bounds multi-hop reasoning cost and prevents infinite loops.

### 6.2 Built-in Evaluators (Deterministic)

Some questions require deterministic evaluation beyond pattern matching (e.g., comparing durations).

For Exp3 MVP, keep evaluators minimal:
- parse durations/timestamps into canonical numeric forms (e.g., minutes, epoch ms)
- compare (`>`, `<`, `==`) using explicit query parameters (e.g., inactivityMinutes)
- never “guess”: if required parameters are missing, return `unsupported`

### 6.3 Worked Example: Session Validity (Multi-hop)

Facts in store (simplified):

```javascript
{
  subject: 'session_token',
  predicate: 'expires_after',
  object: '15 minutes',
  qualifiers: { version: 'v2.0' },
  source: { docId: 'spec-v2', chunkId: 'c17' },
}
```

Question:
- “If a user is inactive for 20 minutes in v2.0, is their session valid?”

Planner output:

```javascript
const plan = {
  version: 'v2.0',
  subjects: ['session_token'],
  predicates: ['expires_after'],
  params: { inactivityMinutes: 20 },
};
```

Derivation:
1. Retrieve `expires_after(session_token, 15 minutes, version=v2.0)` (premise).
2. Evaluate `20 > 15` deterministically → derived fact `session_expired(session_token)` (derived).
3. Conclude “session valid?” → `No` (conclusion).

Answer:
- `verdict = 'supported'`
- `text = 'No'`
- `chunksUsed = ['c17']`
- `factChain` contains the premise + derived step + conclusion (auditable).

### 6.4 Conflict Handling in Derivation

Before returning `supported`, run conflict detection (see §4.4) over the candidate fact set required by the chain:
- If conflicts exist within the query context (e.g., two different `expires_after` values in `v2.0`), return `conflicting`.
- If the query has no version and multiple versions disagree, return `conflicting`.

---

## 7. Verifiable Answer Contract (camelCase)

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

## 8. Extraction Consistency (Evaluation Requirement)

LLM extraction is treated as a noisy front-end. For evaluation:
- run extraction `R` times on the same chunk
- compute average Jaccard similarity over normalized facts
- if `< 0.8`, treat extraction as unreliable for that configuration (see DS003 success criteria); use a gold/manual-facts baseline separately if needed
