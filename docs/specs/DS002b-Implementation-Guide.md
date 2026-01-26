# DS002b - Implementation Guide

**Status:** Draft  
**Version:** 0.1  
**Last Updated:** 2026-01-26

---

## 1. Overview

This document defines the implementation plan for VSABrains. All code uses ES modules (`.mjs` extension) with `async/await` patterns. The project is organized into three main directories:

Source of truth:
- DS004 defines the **definitive runtime semantics** (step ordering, displacement, localization, replay, checkpoints).
- DS005 defines **non-core integrations** (text ingestion, LLM extraction, validation, retrieval, conflict rules, derivation, answer contract).
- DS002 is split into DS002b (this implementation guide) and DS002a (file-level API reference). `DS002-Plan.md` is the index.

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
│       ├── DS002-Plan.md                    # Index / reading order
│       ├── DS002a-API-Reference.md          # File-level module APIs and contracts
│       ├── DS002b-Implementation-Guide.md   # Phases + end-to-end examples
│       ├── DS003-Eval.md
│       ├── DS004-Algorithms-and-Data-Structures.md
│       └── DS005-Integrations-and-Non-Core.md
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

## 3. Implementation Guide

This guide focuses on **how to implement incrementally** and how pieces fit together.

For definitive file-level APIs, see [DS002a - API Reference](DS002a-API-Reference.md).

### 3.1 Phases (high level)

- Phase 1: Core Data Structures (Week 1-2)
- Phase 2: Memory Systems (Week 2-3)
- Phase 3: Localization (Week 3-4)
- Phase 4: Consensus (Week 4)
- Phase 5: Reasoning (Week 5-6)
- Phase 6: Facts Pipeline (Week 6-7)
- Phase 7: Control (Week 7-8)
- Phase 8: Integration (Week 8-9)

### 3.2 Entry Points and Responsibilities

| Method | When to use | What it does (internally) |
|--------|-------------|---------------------------|
| `VSABrains.ingest(text, metadata)` | Natural-language / document ingestion | Chunk → tokenize and/or extract facts (DS005) → validate → `step(...)` loop |
| `VSABrains.step(input)` | Discrete events or token IDs (Exp1/Exp2) | Normalize → `Controller.step(input)` |
| `Controller.step(input)` | Internal orchestration | Normalize → `Column.stepWrite(stepInput, step)` → displacement → `Column.stepMove(...)` (see DS004 §2.1 for definitive ordering) |
| `Column.stepWrite(stepInput, step)` | Internal column write stage | Write (pre-move) → update `LocationIndex` (with `lastSeen=step`) → optional slow-map/episodic hooks (see DS004 §2.1) |
| `Column.stepMove({dx, dy})` | Internal column move stage | Update column location with wrap |

Ownership and wiring (baseline):
- `VSABrains` constructs a **column-scoped** `LocationIndex` for each column and injects it into the `Column` constructor (dependency injection).
- `Column.locationIndex` indexes per-step `stepTokenId` writes (fast-map).
- `SlowMapManager.locationIndex` (optional) indexes `summaryTokenId` writes (slow-map) for coarse localization.

### 3.3 End-to-End Example (Happy Path)

Minimal discrete ingestion (Exp1/Exp2 style):

```javascript
const brain = new VSABrains(config);

// Tokenizer.encode(text) returns TokenId[] (numbers).
const tokens = brain.tokenizer.encode('Alice enters room_A. Bob picks up the key.');

for (const tokenId of tokens) {
  // step(tokenId) normalizes to { stepTokenId: tokenId, writeTokenIds: [tokenId] }
  // then runs: stepWrite → displacement → stepMove.
  await brain.step(tokenId);
}

// Query-time is: localize → replay → reasoner → verdict.
const result = await brain.answer('Where is Alice?');
```

Document ingestion with verifiable facts (Exp3 style):

```javascript
const brain = new VSABrains({
  ...config,
  extractor: { enabled: true }, // see DS005
});

await brain.ingest('Alice enters room_A. Bob picks up the key.', { docId: 'demo' });
const result = await brain.answer('Where is Alice?');
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
