# DS002a - API Reference

**Status:** Draft  
**Version:** 0.1  
**Last Updated:** 2026-01-26

---

## 1. Purpose

This document is the **file-level API reference** for VSABrains.

Source of truth:

- DS004 defines the definitive runtime semantics (step ordering, displacement, localization, replay, checkpoints).
- DS005 defines non-core integrations (text ingestion, LLM extraction, validation, retrieval, conflict rules, derivation, answer contract).

Use DS002a when implementing modules under `src/`.

---

## 2. Module APIs

### Phase 1: Core Data Structures

#### 3.1.1 HeavyHitters.mjs

```javascript
/**
 * Heavy-hitters cell maintaining top-K tokens by frequency.
 * Prevents local "muddiness" through bounded retention.
 */
export class HeavyHitters {
  constructor(k = 4);
  
  /** Update with observed token (`tokenId` is uint32) */
  update(tokenId, weight = 1.0);
  
  /** Get top-N tokens with scores */
  topK(n = 4);
  
  /** Merge another HeavyHitters into this one */
  merge(other);
  
  /** Serialize for checkpointing */
  toJSON();
  static fromJSON(data);
}
```

#### 3.1.2 GridMap.mjs

```javascript
/**
 * 2D discrete map with HeavyHitters cells.
 * Supports dense or sparse (hash-grid) storage.
 */
export class GridMap {
  constructor(config = { width: 64, height: 64, k: 4, sparse: false });
  
  /** Write token at location (`tokenId` is uint32) */
  update(x, y, tokenId, weight = 1.0);
  
  /** Read top-K at location */
  readTopK(x, y, n = 4);
  
  /** Get all non-empty cells (for sparse maps) */
  nonEmptyCells();
  
  /** Serialize for checkpointing */
  toJSON();
  static fromJSON(data);
}
```

#### 3.1.3 Column.mjs

```javascript
/**
 * Single column with multiple maps and location state.
 * Owns its own DisplacementEncoder (context buffer) and LocationIndex (for localization).
 */
export class Column {
  constructor(config = { 
    numFastMaps: 2, 
    numSlowMaps: 1,
    mapConfig: { width: 64, height: 64, k: 4 },
    offset: { x: 0, y: 0 },

    // Indexing (used by Localizer)
    // Recommended: index the per-step primary token (`stepTokenId`), not all auxiliary writes.
    locationIndex: null,     // LocationIndex for fast-map step tokens (column-scoped); injected by VSABrains in the default wiring
    indexMapId: 0,           // which map is indexed for localization

    // Slow maps
    slowMapManager: null,
  });
  
  /** Current location on each map */
  get locations();
  
  /**
   * Write one step at the current location (no movement).
   *
   * See DS004 §2.1 for definitive ordering and semantics.
   *
   * Notes:
   * - Writes all `writeTokenIds` into the current (pre-move) cell.
   * - Updates `locationIndex` with `stepTokenId` for localization (pre-move location, `lastSeen = step`).
   * - Calls optional hooks (`slowMapManager`, episodic store) but does not move.
   */
  stepWrite({ stepTokenId, writeTokenIds, event }, step);
  
  /** Update location by displacement */
  stepMove(displacement);
  
  /** Predict next tokens (optional; not required for Exp1/Exp2 MVP) */
  async predict(context);
  
  /** Reset to initial state */
  reset();
}
```

#### 3.1.4 Displacement.mjs

```javascript
/**
 * Displacement computation from tokens or actions.
 */
export class DisplacementEncoder {
  constructor(config = {
    method: 'hash_ngram',
    contextLength: 2,
    maxStep: 3,
    seed: 0,
    gridSize: 64,
    avoidZeroStep: false,
  });
  
  /** Compute displacement from recent step token IDs (pure) */
  encode(recentStepTokenIds);

  /**
   * Update the internal context buffer with `stepTokenId` and return displacement.
   * Called exactly once per step (after deriving `stepTokenId`).
   *
   * Definitive ordering is specified in DS004 §2.1 / DS004 §5 (the current step token influences its own movement).
   */
  step(stepTokenId);
  
  /** Apply displacement to location */
  apply(location, displacement);

  /** Reset internal context buffer */
  reset();
}
```

#### 3.1.5 util/hash.mjs

```javascript
/**
 * Deterministic non-cryptographic hashing utilities (32-bit).
 * Used for displacement, summary tokens, and bounded vocabularies.
 */
export function murmurHash32(u32, seed = 0);
export function hashString(str, seed = 0);
export function hashCombineU32(values, seed = 0);

// Implementation requirement:
// - MurmurHash3 x86_32 (stable reference implementation)
// - Uses Math.imul for 32-bit multiplication
// - Returns unsigned uint32 (>>> 0)
//
// Reference skeleton (MurmurHash3 x86_32):
// function fmix32(h) {
//   h ^= h >>> 16;
//   h = Math.imul(h, 0x85ebca6b);
//   h ^= h >>> 13;
//   h = Math.imul(h, 0xc2b2ae35);
//   h ^= h >>> 16;
//   return h >>> 0;
// }
//
// export function murmurHash32(u32, seed = 0) {
//   let h = seed >>> 0;
//   let k = u32 >>> 0;
//   k = Math.imul(k, 0xcc9e2d51);
//   k = (k << 15) | (k >>> 17);
//   k = Math.imul(k, 0x1b873593);
//   h ^= k;
//   h = (h << 13) | (h >>> 19);
//   h = (Math.imul(h, 5) + 0xe6546b64) >>> 0;
//   h ^= 4; // length in bytes
//   return fmix32(h);
// }
//
// export function hashString(str, seed = 0) {
//   // Convert to UTF-8 bytes; process 4-byte little-endian blocks; handle tail; finalize with length.
// }
//
// export function hashCombineU32(values, seed = 0) {
//   // values: uint32[]
//   // Fold using murmurHash32 with the running hash as the seed:
//   //   let h = seed >>> 0;
//   //   for (const v of values) h = murmurHash32(v >>> 0, h);
//   //   return h >>> 0;
// }
```

#### 3.1.6 util/Vocabulary.mjs

```javascript
/**
 * String↔tokenId mapping. Token IDs are uint32.
 * Supports dynamic growth or bounded hash-based IDs.
 */
export class Vocabulary {
  constructor(config = {
    mode: 'dynamic', // 'dynamic' | 'hash'
    maxSize: 100000,
    unkTokenId: 3,
    hash: { vocabSize: 1048576, seed: 0 },
  });
  // Collision policy:
  // - mode='dynamic' guarantees uniqueness (no collisions).
  // - mode='hash' can collide (different strings mapping to the same tokenId); treat collisions as acceptable noise for early prototypes.
  //   For critical evaluation and reasoning, prefer mode='dynamic' (see DS004 §3.5).

  /** Map a token string to a tokenId */
  id(token);

  /** Optional reverse mapping (only for dynamic mode) */
  token(tokenId);

  /** Current vocabulary size (dynamic mode) */
  size();

  toJSON();
  static fromJSON(data);
}
```

#### 3.1.7 util/Tokenizer.mjs

```javascript
/**
 * Deterministic tokenization + encoding into token IDs.
 * Baseline is a simple lexer (words, numbers, punctuation).
 */
export class Tokenizer {
  constructor(config = {
    mode: 'simple',
    lowercase: true,
    vocabulary: new Vocabulary(),
  });

  /** Tokenize text into string tokens */
  tokenize(text);

  /** Encode text into token IDs */
  encode(text);

  /** Encode pre-tokenized string tokens into token IDs */
  encodeTokens(tokens);
}
```

### Phase 2: Memory Systems

#### 3.2.1 EpisodicStore.mjs

```javascript
/**
 * Append-only storage for episodic entries.
 *
 * Typical uses:
 * - Exp2: step-keyed structured events for deterministic replay
 * - Exp3 (optional): chunk entries for evidence display or additional retrieval layers
 */
export class EpisodicStore {
  constructor(config = { maxEntries: 100000 });
  
  /** Append entry, returns entryId */
  async append(entry);
  
  /** Get entry by ID */
  async get(entryId);
  
  /** Get multiple entries */
  async getMany(entryIds);

  /**
   * Get entries in a step range (inclusive). Required for replay-based experiments.
   * For non-step-keyed entries, implementations may return an empty list.
   */
  async getRange(startStep, endStep);
  
  /** Get all signatures for indexing (optional; chunk-mode only) */
  async getAllSignatures();
}
```

#### 3.2.2 Index.mjs

```javascript
/**
 * Inverted index from signatures to chunk IDs.
 */
export class Index {
  constructor();
  
  /** Add signature -> chunkId mapping */
  add(signature, chunkId);
  
  /** Query chunks by signatures */
  query(signatures, limit = 10);
  
  /** Rebuild index from store */
  async rebuild(store);
}
```

#### 3.2.3 Checkpoint.mjs

```javascript
/**
 * Checkpoint management for replay.
 */
export class CheckpointManager {
  constructor(config = {
    policy: 'adaptive', // 'fixed' | 'adaptive'
    interval: 100,      // used when policy === 'fixed'
    minInterval: 20,
    maxInterval: 200,
    errorMAThreshold: 0.5,
    confidenceThreshold: 0.3,
  });

  /** Decide whether to checkpoint at this step */
  shouldCheckpoint(step, lastCheckpointStep, event, metrics);
  
  /** Save checkpoint at current step */
  async save(step, state);
  
  /** Load nearest checkpoint before step */
  async loadBefore(step);
  
  /** List all checkpoints */
  list();
}
```

Checkpoint state schema (recommended; see DS004 §7.1):
See DS004 §7.1 for the schema and checkpointing rationale (minimal state, no full `GridMap` serialization).

#### 3.2.4 Summary.mjs

```javascript
/**
 * Window summaries written into slow maps and stored for later replay/querying.
 */
export class WindowSummary {
  constructor(startStep, endStep = null);

  /** Update summary with one event */
  addEvent(event);

  /** Deterministic summary tokenId (hash of canonical fields) */
  toTokenId(hash = { hashString });

  /** Minimal preserved arguments for replay/localization */
  getCriticalArguments();

  toJSON();
  static fromJSON(data);
}
```

#### 3.2.5 SlowMap.mjs

```javascript
/**
 * Slow-map manager: accumulates WindowSummary and periodically writes a summary token
 * into one or more slow GridMaps, plus keeps a summary store for retrieval.
 * If `config.locationIndex` is provided, it indexes `summaryTokenId` for coarse localization.
 *
 * Definitive behavior (window semantics + flush procedure) is specified in DS004 §9.
 */
export class SlowMapManager {
  constructor(config = { windowSize: 20, locationIndex: null });

  /** Called on every step (after write, before move) */
  onStep(event, location, step);

  /** Flushes the current window into the slow map(s) */
  flushWindow(location, step);
}
```

### Phase 3: Localization

#### 3.3.1 LocationIndex.mjs

```javascript
/**
 * StepToken→location inverted index used by the Localizer (column-scoped).
 * Reduces localization from O(gridSize²) to O(window × candidatesPerToken).
 * Implementation note: prefer packed numeric location keys over string keys for performance.
 */
export class LocationIndex {
  constructor();

  /** Called when writing a stepTokenId at a location */
  update(stepTokenId, x, y, step);

  /** Return top candidate locations for a stepTokenId (sorted by count/recency) */
  getCandidates(stepTokenId, limit = 100);

  /** Optional pruning to cap memory */
  prune(tokenId, maxLocations);
}
```

#### 3.3.2 Localizer.mjs

```javascript
/**
 * Top-K frame alignment from context window.
 */
export class Localizer {
  constructor(columns);
  // Each column must have its own column-scoped LocationIndex updated during ingestion (see Column.stepWrite).
  
  /** Find candidate locations from token window */
  async localize(windowStepTokens, topK = 20, config = {
    candidatesPerToken: 50,
    minMatchesRatio: 0.6,
    debug: false,
  });
  // Candidates use the DS004 "LocalizationCandidate" shape:
  // { columnId, locKey, location: { x, y }, score, matches, lastSeenMax, verifiedScore? }
  //
  // If config.debug is true, return:
  // { candidates: LocalizationCandidate[], stats: { perTokenCandidates: number[], anchorIdx: number, scoredLocations: number } }
  
  /** Score candidates by replay consistency */
  async scoreWithReplay(candidates, windowStepTokens, verifier);
}
```

#### 3.3.3 Verifier.mjs

```javascript
/**
 * Consistency verification for transitions.
 * - Exp2: hardcoded narrative rules (e.g., dead entities cannot move)
 * - Exp3: schema-derived constraints (predicate arg types, qualifier compatibility)
 */
export class Verifier {
  // Rule contract (recommended):
  // { name: string, check(prev, event, next): { valid: boolean, reason?: string } }
  constructor(transitionRules);
  
  /** Check if transition sequence is valid (returns structured violations for auditability) */
  verify(stateSequence);
  
  /** Score plausibility of state sequence */
  score(stateSequence);
}
```

#### 3.3.4 Replay.mjs

```javascript
/**
 * Replay from checkpoint to reconstruct structured state (experiment-dependent).
 *
 * Replay is deterministic but the state semantics are domain-specific. The replayer
 * is therefore parameterized by a state model (how to initialize and apply events).
 */
export class Replayer {
  /**
   * @typedef {{
   *   init: () => any,
   *   apply: (state: any, event: any) => void,
   *   clone?: (state: any) => any, // optional; required when verifier needs prev/next snapshots
   * }} ReplayStateModel
   */

  constructor(checkpointManager, episodicStore, stateModel, verifier = null);
  
  /**
   * Replay from checkpoint to target step.
   * Returns the reconstructed domain state (shape defined by `stateModel`).
   */
  async replay(targetStep);
  
  /**
   * Replay and return intermediate states (for debugging/audit).
   * If a verifier is provided, return structured violations alongside the history.
   */
  async replayWithHistory(targetStep);
}
```

### Phase 4: Consensus

#### 3.4.1 Voter.mjs

```javascript
/**
 * Weighted voting mechanism.
 */
export class Voter {
  constructor(config = { method: 'weighted' });
  
  /** Aggregate predictions from multiple sources */
  vote(predictions);
  
  /** Get confidence of winning prediction */
  confidence();
}
```

#### 3.4.2 Aggregator.mjs

```javascript
/**
 * Multi-column prediction aggregation.
 */
export class Aggregator {
  constructor(columns, voter);
  
  /** Get consensus prediction across columns */
  async aggregate(context);
  
  /** Get individual column predictions for analysis */
  async getIndividualPredictions(context);
}
```

### Phase 5: Reasoning

#### 3.5.1 WorkSignature.mjs

```javascript
/**
 * Structural binding with role-value pairs.
 */
export class WorkSignature {
  constructor();
  
  /** Bind role to value */
  bind(role, value, isVariable = false);
  
  /** Unbind to get value for role */
  unbind(role);

  /** Whether the role is a canonical variable */
  hasVariable(role);

  /** Get all role-value pairs */
  entries();

  /** Stable hash for indexing constants (variables excluded) */
  toHash();
  
  /** Create signature with canonical variables */
  static canonicalize(fact, variableRoles = ['subject', 'object']);
  
  /** Merge bindings; returns null on conflict */
  merge(other);

  /** Pattern match (unification); returns variable→constant map or null */
  static matchPattern(pattern, fact);
}
```

#### 3.5.2 Workpad.mjs

```javascript
/**
 * Variable-to-constant mapping for reasoning.
 */
export class Workpad {
  constructor();
  
  /** Bind canonical variable to constant */
  bind(variable, constant);
  
  /** Get constant for variable */
  resolve(variable);
  
  /** Apply bindings to signature */
  instantiate(signature);
  
  /** Clear bindings */
  clear();
}
```

#### 3.5.3 Generator.mjs

```javascript
/**
 * Internal prediction and chaining (optional).
 * Not required for the MVP path of Exp1/Exp2. If implemented, it must be deterministic and auditable.
 */
export class Generator {
  constructor(columns, aggregator, config = { maxDepth: 3 });
  
  /** Generate next token(s) */
  async step(state);
  
  /** Generate chain of N steps */
  async chain(state, steps);
  
  /** Generate until stopping condition */
  async generateUntil(state, stopCondition);
}
```

#### 3.5.4 Reasoner.mjs

```javascript
/**
 * Derivation engine with verdict output.
 *
 * Exp3-oriented derivation strategy, retrieval plumbing, and conflict semantics are specified in DS005.
 */
export class Reasoner {
  constructor(factStore, generator, config);
  
  /** Attempt to derive target from facts */
  async derive(target, maxSteps = 5);
  
  /** Check for conflicts in fact set */
  async checkConflicts(facts);
  
  /** Full answer with verdict and chain */
  async answer(query);
}
```

### Phase 6: Facts Pipeline

#### 3.6.1 FactSchema.mjs

```javascript
/**
 * Fact structure and validation.
 */
export const FactSchema = {
  validate(fact),
  
  /** Check span contains key elements */
  validateSpan(fact, sourceText),
  
  /** Normalize fact for storage */
  normalize(fact)
};

export class Fact {
  constructor(data);
  
  get span();
  get subject();
  get predicate();
  get object();
  get qualifiers();
  get polarity();
  get confidence();
  get source();
  
  /** Convert to work signature */
  toSignature();
}
```

#### 3.6.2 FactStore.mjs

```javascript
/**
 * Indexed storage for validated facts.
 */
export class FactStore {
  constructor();
  
  /** Add validated fact */
  async add(fact);
  
  /** Query facts by predicate/subject/object */
  async query(criteria);
  
  /** Get facts for chunk */
  async getByChunk(chunkId);
  
  /** Get all facts matching signature pattern */
  async matchSignature(pattern);
}
```

#### 3.6.3 FactExtractor.mjs

```javascript
/**
 * LLM-based fact extraction wrapper.
 */
export class FactExtractor {
  /**
   * Provider-agnostic LLM client interface (see DS005).
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
  
  constructor(config = {
    // Provider-agnostic LLM client (OpenAI/Anthropic/local/etc).
    // Must implement LLMClient.complete() and return raw string content (parsing/validation happens here).
    llmClient: null,
    model: 'gpt-4.1',
    temperature: 0,
    seed: 0,
    schema: FactSchema,
    predicateVocabulary: {},
    maxRetries: 1,
  });
  
  /** Extract facts from text chunk */
  async extract(chunk);
  
  /** Validate and filter extracted facts */
  async validateAndFilter(facts, sourceText);

  /** Optional: measure extraction consistency across repeated runs */
  async consistencyCheck(chunk, runs = 5);
}
```

### Phase 7: Control

#### 3.7.1 Controller.mjs

```javascript
/**
 * Displacement and regime selection.
 */
export class Controller {
  constructor(columns, config);
  
  /** Compute displacement for the current step (from stepTokenId) */
  computeDisplacement(stepTokenId);
  
  /** Select active maps for current regime */
  selectMaps(regime);
  
  /**
   * Execute one processing step:
   * 1) normalize input → { stepTokenId, writeTokenIds, event }
   * 2) column.stepWrite(...)
   * 3) displacement = column.displacementEncoder.step(stepTokenId)
   * 4) column.stepMove(displacement)
   */
  async step(input);
}
```

#### 3.7.2 MetaController.mjs

```javascript
/**
 * High-level regime management.
 */
export class MetaController {
  constructor(controller, config);
  
  /** Select regime based on metrics (see DS004: "Multi-Column Consensus and Regimes") */
  selectRegime(metrics);
  
  /** Register new theory/regime */
  registerRegime(name, config);
  
  /** Get current regime info */
  currentRegime();
}
```

### Phase 8: Integration

#### 3.8.1 Main Entry Point (index.mjs)

```javascript
/**
 * VSABrains main API.
 */
export class VSABrains {
  constructor(config);
  
  /** Ingest text/document */
  async ingest(text, metadata);
  
  /**
   * Process one step.
   * Supported inputs:
   * - `tokenId: number`
   * - `tokenIds: number[]` (auxiliary tokens written together at the current location, then move once)
   * - `{ stepTokenId: number, writeTokenIds: number[], event?: object }` (explicit primary+aux tokens)
   * - `event: object` (evaluation code may map events to `{ stepTokenId, writeTokenIds }`)
   *
   * Default behavior for `tokenIds: number[]`:
   * - `writeTokenIds = tokenIds`
   * - `stepTokenId = hashCombineU32(writeTokenIds)` (deterministic)
   */
  async step(input);
  
  /** Localize from context */
  async localize(context);
  
  /** Retrieve relevant chunks */
  async retrieve(query, limit);
  
  /** Answer with verdict */
  async answer(question);
  
  /** Get system state */
  getState();
  
  /** Save/load system */
  async save(path);
  static async load(path);
}
```
