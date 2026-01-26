# DS002 - Implementation Plan

**Status:** Draft  
**Version:** 0.2  
**Last Updated:** 2026-01-26

---

## 1. Overview

This document defines the implementation plan for VSABrains. All code uses ES modules (`.mjs` extension) with `async/await` patterns. The project is organized into three main directories:

```
src/           Core implementation modules
test/          Unit tests (one test file per module)
eval/          Evaluation suites for the three main experiments
```

### 1.1 Priority Checklist (P0/P1/P2)

| Priority | Action | Why it matters |
|----------|--------|----------------|
| P0 | Implement hash-n-gram displacement (`DisplacementEncoder`) | Without a concrete displacement, trajectories and localization are undefined |
| P0 | Implement `LocationIndex` + indexed localization | Avoids O(gridSize²) exhaustive search |
| P0 | Implement `WorkSignature` as explicit role→value map | Enables auditable binding and unification for reasoning |
| P1 | Add grid saturation diagnostics + sweep in Exp2 | Detects heavy-hitters truncation and capacity collapse |
| P1 | Lock predicate vocabulary + extraction validation in Exp3 | Prevents extractor drift and predicate proliferation |
| P1 | Add per-step diagnostics (utilization, entropy, agreement) | Makes failure modes observable and debuggable |
| P2 | Add adaptive checkpoint policy | Trades replay latency vs memory more safely than fixed intervals |
| P2 | Define and test summary structure for slow maps | Ensures summaries preserve who/what/when for replay/localization |

---

## 2. Directory Structure

```
VSABrains/
├── AGENTS.md
├── README.md
├── package.json
├── docs/
│   ├── index.html
│   └── specs/
│       ├── DS001-Vision.md
│       ├── DS002-Plan.md
│       └── DS003-Eval.md
├── src/
│   ├── index.mjs              # Main entry point, exports public API
│   ├── core/
│   │   ├── HeavyHitters.mjs   # Heavy-hitters cell implementation
│   │   ├── GridMap.mjs        # Discrete grid map with cells
│   │   ├── Column.mjs         # Single column with maps + location
│   │   └── Displacement.mjs   # Displacement computation
│   ├── memory/
│   │   ├── EpisodicStore.mjs  # Append-only chunk storage
│   │   ├── Index.mjs          # Inverted index for retrieval
│   │   ├── Checkpoint.mjs     # Checkpoint management
│   │   ├── Summary.mjs        # Window summaries for slow maps
│   │   └── SlowMap.mjs        # Slow-map manager + summary store
│   ├── localization/
│   │   ├── LocationIndex.mjs  # Token→location inverted index
│   │   ├── Localizer.mjs      # Top-K frame alignment
│   │   ├── Verifier.mjs       # Consistency verification
│   │   └── Replay.mjs         # Replay from checkpoints
│   ├── consensus/
│   │   ├── Voter.mjs          # Weighted voting mechanism
│   │   └── Aggregator.mjs     # Multi-column aggregation
│   ├── reasoning/
│   │   ├── WorkSignature.mjs  # Structural binding
│   │   ├── Workpad.mjs        # Variable-to-constant mapping
│   │   ├── Generator.mjs      # Prediction and chaining
│   │   └── Reasoner.mjs       # Derivation and verdict
│   ├── facts/
│   │   ├── FactSchema.mjs     # Fact structure and validation
│   │   ├── FactStore.mjs      # Indexed fact storage
│   │   └── FactExtractor.mjs  # LLM-based extraction wrapper
│   ├── control/
│   │   ├── Controller.mjs     # Displacement + regime selection
│   │   └── MetaController.mjs # High-level regime management
│   └── util/
│       ├── hash.mjs           # Hashing utilities
│       ├── random.mjs         # Seeded random for reproducibility
│       ├── Tokenizer.mjs      # Deterministic tokenization + encoding
│       ├── Vocabulary.mjs     # String↔tokenId mapping policies
│       └── config.mjs         # Configuration management
├── test/
│   ├── core/
│   │   ├── HeavyHitters.test.mjs
│   │   ├── GridMap.test.mjs
│   │   ├── Column.test.mjs
│   │   └── Displacement.test.mjs
│   ├── memory/
│   │   ├── EpisodicStore.test.mjs
│   │   ├── Index.test.mjs
│   │   ├── Checkpoint.test.mjs
│   │   ├── Summary.test.mjs
│   │   └── SlowMap.test.mjs
│   ├── localization/
│   │   ├── LocationIndex.test.mjs
│   │   ├── Localizer.test.mjs
│   │   ├── Verifier.test.mjs
│   │   └── Replay.test.mjs
│   ├── consensus/
│   │   ├── Voter.test.mjs
│   │   └── Aggregator.test.mjs
│   ├── reasoning/
│   │   ├── WorkSignature.test.mjs
│   │   ├── Workpad.test.mjs
│   │   ├── Generator.test.mjs
│   │   └── Reasoner.test.mjs
│   ├── facts/
│   │   ├── FactSchema.test.mjs
│   │   ├── FactStore.test.mjs
│   │   └── FactExtractor.test.mjs
│   ├── integration/
│   │   ├── pipeline.test.mjs
│   │   └── e2e.test.mjs
│   └── util/
│       ├── hash.test.mjs
│       ├── Tokenizer.test.mjs
│       └── Vocabulary.test.mjs
└── eval/
    ├── common/
    │   ├── DataGenerator.mjs  # Synthetic data generation
    │   ├── Metrics.mjs        # Metric computation
    │   └── Reporter.mjs       # Results reporting
    ├── exp1-alignment/
    │   ├── run.mjs            # Experiment runner
    │   ├── scenarios.mjs      # Test scenarios
    │   └── analyze.mjs        # Result analysis
    ├── exp2-narrative/
    │   ├── run.mjs
    │   ├── stories.mjs        # Story generation
    │   ├── rules.mjs          # Narrative verifier rules (Exp2)
    │   ├── encoding.mjs       # eventToTokens/queryToQuestion helpers
    │   └── analyze.mjs
    └── exp3-rag/
        ├── run.mjs
        ├── corpus.mjs         # Test corpus management
        ├── questions.mjs      # Question sets
        └── analyze.mjs
```

---

## 3. Implementation Phases

### Phase 1: Core Data Structures (Week 1-2)

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
    locationIndex: null,     // LocationIndex for fast-map step tokens (column-scoped)
    indexMapId: 0,           // which map is indexed for localization

    // Slow maps
    slowMapManager: null,
  });
  
  /** Current location on each map */
  get locations();
  
  /**
   * Write one step at the current location (no movement).
   *
   * Semantics:
   * - All `writeTokenIds` are written into the current cell (each updates HeavyHitters).
   * - `locationIndex` is updated with `stepTokenId` at the indexed map location.
   * - Optional: `slowMapManager.onStep(event, location, step)` is called to build window summaries.
   * - Movement happens exactly once per step, after write, via `stepMove(...)`.
   */
  stepWrite({ stepTokenId, writeTokenIds, event }, step);
  
  /** Update location by displacement */
  stepMove(displacement);
  
  /** Predict next tokens using transition maps */
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

### Phase 2: Memory Systems (Week 2-3)

#### 3.2.1 EpisodicStore.mjs

```javascript
/**
 * Append-only storage for text chunks with signatures.
 */
export class EpisodicStore {
  constructor(config = { maxChunks: 100000 });
  
  /** Append chunk, returns chunkId */
  async append(chunk);
  
  /** Get chunk by ID */
  async get(chunkId);
  
  /** Get multiple chunks */
  async getMany(chunkIds);
  
  /** Get all signatures for indexing */
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
 */
export class SlowMapManager {
  constructor(config = { windowSize: 20, locationIndex: null });

  /** Called on every step (after write, before move) */
  onStep(event, location, step);

  /** Flushes the current window into the slow map(s) */
  flushWindow(location, step);
}
```

### Phase 3: Localization (Week 3-4)

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
  // If config.debug is true, return:
  // { candidates: [{ columnId, x, y, score, ... }...], stats: { perTokenCandidates: number[], anchorIdx: number, scoredLocations: number } }
  
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
  constructor(transitionRules);
  
  /** Check if transition sequence is valid */
  verify(stateSequence);
  
  /** Score plausibility of state sequence */
  score(stateSequence);
}
```

#### 3.3.4 Replay.mjs

```javascript
/**
 * Replay from checkpoint to reconstruct state.
 */
export class Replayer {
  constructor(checkpointManager, columns);
  
  /** Replay from checkpoint to target step */
  async replay(targetStep);
  
  /** Replay and return intermediate states */
  async replayWithHistory(targetStep);
}
```

### Phase 4: Consensus (Week 4)

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

### Phase 5: Reasoning (Week 5-6)

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
 * Internal prediction and chaining.
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

### Phase 6: Facts Pipeline (Week 6-7)

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
  constructor(config = {
    // Provider-agnostic LLM client (OpenAI/Anthropic/local/etc).
    // Must expose a single method that returns parsed JSON or throws.
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

### Phase 7: Control (Week 7-8)

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
  
  /** Select regime based on metrics (see DS001 §8.4 for baseline regimes) */
  selectRegime(metrics);
  
  /** Register new theory/regime */
  registerRegime(name, config);
  
  /** Get current regime info */
  currentRegime();
}
```

### Phase 8: Integration (Week 8-9)

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

---

## 4. Testing Strategy

### 4.1 Unit Tests

Each module has a corresponding test file. Tests use Node.js built-in test runner:

```javascript
// test/core/HeavyHitters.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { HeavyHitters } from '../../src/core/HeavyHitters.mjs';

describe('HeavyHitters', () => {
  it('should maintain top-K items', async () => {
    const hh = new HeavyHitters(4);
    hh.update(11, 10);
    hh.update(22, 5);
    hh.update(33, 3);
    hh.update(44, 1);
    hh.update(55, 2);
    
    const top = hh.topK(4);
    assert.strictEqual(top[0][0], 11);
    assert.strictEqual(top.length, 4);
    assert.ok(!top.find(([id]) => id === 44)); // tokenId=44 should be pruned
  });
});
```

### 4.1.1 Critical Component Test Cases (Concrete)

Localization and displacement are extremely sensitive to determinism and indexing behavior. Add the following concrete tests:

- `test/util/hash.test.mjs`: verify deterministic outputs for a fixed set of `(input, seed)` pairs (golden vectors taken from the MurmurHash3 x86_32 reference).
- `test/util/Tokenizer.test.mjs`: tokenize/encode a fixed string and assert stable token sequence (including punctuation) and stable `UNK` behavior once `maxSize` is exceeded.
- `test/localization/LocationIndex.test.mjs`:
  - Insert `N=10_000` writes for a small vocab and assert `getCandidates(tokenId, limit)` returns at most `limit`, sorted by `(count desc, lastSeen desc)`.
  - Prune and ensure memory is bounded per token.
- `test/localization/Localizer.test.mjs` (complexity-by-count, not timing):
  - Build an index where one token has `10` candidate locations and others have `500`.
  - Call `localize(windowStepTokens, topK, { candidatesPerToken: 500, debug: true })`.
  - Assert `stats.scoredLocations <= 10` (anchor-based intersection) and `stats.perTokenCandidates.length === windowStepTokens.length`.

### 4.2 Integration Tests

```javascript
// test/integration/pipeline.test.mjs
describe('Full Pipeline', () => {
  it('should ingest, localize, and answer', async () => {
    const brain = new VSABrains(config);
    await brain.ingest(testDocument);
    const answer = await brain.answer('What is X?');
    assert.ok(['supported', 'conflicting', 'unsupported'].includes(answer.verdict));
  });
});
```

### 4.3 Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- test/core/HeavyHitters.test.mjs

# Run with coverage
npm run test:coverage
```

---

## 5. Dependencies

### 5.1 package.json

```json
{
  "name": "vsabrains",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.mjs",
  "scripts": {
    "test": "node --test",
    "test:coverage": "node --test --experimental-test-coverage",
    "eval:exp1": "node eval/exp1-alignment/run.mjs",
    "eval:exp2": "node eval/exp2-narrative/run.mjs",
    "eval:exp3": "node eval/exp3-rag/run.mjs",
    "eval:all": "npm run eval:exp1 && npm run eval:exp2 && npm run eval:exp3"
  },
  "devDependencies": {}
}
```

### 5.2 External Dependencies (Minimal)

The core system has **zero external dependencies** for the discrete components. Optional dependencies:

- **LLM integration** (for FactExtractor): `openai` or similar
- **Persistence** (optional): `better-sqlite3` for large episodic stores

---

## 6. Milestones

| Week | Milestone | Deliverables |
|------|-----------|--------------|
| 1-2 | Core structures | HeavyHitters, GridMap, Column, Displacement, Tokenizer/Vocabulary, hash + tests |
| 2-3 | Memory systems | EpisodicStore, Index, Checkpoint, Summary/SlowMap + tests |
| 3-4 | Localization | LocationIndex, Localizer, Verifier, Replay + tests |
| 4 | Consensus | Voter, Aggregator + tests |
| 5-6 | Reasoning | WorkSignature, Workpad, Generator, Reasoner + tests |
| 6-7 | Facts pipeline | FactSchema, FactStore, FactExtractor + tests |
| 7-8 | Control | Controller, MetaController + tests |
| 8-9 | Integration | Main API, integration tests, eval framework |
| 9-10 | Evaluation | Run all three experiments, analyze results |

---

## 7. Success Criteria for Each Phase

### Phase 1 (Core)
- [ ] HeavyHitters maintains exactly K items under any update sequence
- [ ] GridMap read/write round-trips correctly
- [ ] Column location updates deterministically with displacement
- [ ] hash utilities match golden vectors (MurmurHash3 x86_32)
- [ ] Tokenizer + Vocabulary produce deterministic token IDs

### Phase 2 (Memory)
- [ ] EpisodicStore append/get works for 10K+ chunks
- [ ] Index queries return correct chunks
- [ ] Checkpoints enable state reconstruction
- [ ] Summaries preserve critical arguments (who/what/when) and hash deterministically
- [ ] Slow maps write periodic summary tokens and support retrieval by token

### Phase 3 (Localization)
- [ ] Localizer returns top-K candidates with scores
- [ ] LocationIndex returns bounded candidate sets per token
- [ ] Verifier correctly identifies impossible transitions
- [ ] Replay reconstructs state matching direct computation

### Phase 4 (Consensus)
- [ ] Voter produces correct weighted aggregate
- [ ] Multi-column consensus beats single-column accuracy

### Phase 5 (Reasoning)
- [ ] WorkSignature binding/unbinding is reversible
- [ ] Generator produces coherent multi-step chains
- [ ] Reasoner correctly identifies supported/unsupported/conflicting

### Phase 6 (Facts)
- [ ] FactSchema validates correct facts, rejects malformed
- [ ] FactStore indexes and retrieves efficiently
- [ ] FactExtractor produces schema-compliant output

### Phase 7 (Control)
- [ ] Controller selects appropriate displacements
- [ ] MetaController switches regimes based on metrics

### Phase 8 (Integration)
- [ ] Full pipeline processes documents end-to-end
- [ ] Answer API returns properly structured verdicts
