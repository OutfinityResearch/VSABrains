# DS006 - Clarifications and Gap Resolution

**Status:** Draft  
**Version:** 0.2  
**Last Updated:** 2026-01-26

---

## 1. Purpose

This document addresses gaps, ambiguities, and inconsistencies identified across DS001-DS005. It serves as a **supplement** to the existing specifications rather than a replacement.

Reading order: after DS004, before implementing Exp1/Exp2.

---

## 2. Query-to-Answer Pipeline (Exp1/Exp2)

### 2.1 The Missing Piece

DS004 specifies localization and replay. DS003 specifies experiments and metrics. Neither specifies how to **produce an answer** from localized state for Exp1/Exp2 (non-RAG experiments).

This section fills that gap.

### 2.2 Exp2 Answer Pipeline (Definitive)

For Exp2 narrative queries like `"What does Alice have at t=5?"`:

```javascript
async function answerExp2Query(brain, query, vocab) {
  // 1. Parse query into structured form
  const { targetStep, entityId, attribute } = parseExp2Query(query);
  // Example: { targetStep: 5, entityId: 'Alice', attribute: 'inventory' }

  // 2. Build context window around target step
  const windowSize = brain.config.localization?.windowSize ?? 5;
  const windowStepTokenIds = getStepTokenIdsForWindow(brain, targetStep, windowSize);

  // 3. Localize to find candidate locations at targetStep
  const candidates = await brain.localize(windowStepTokenIds);
  if (candidates.length === 0) {
    return { verdict: 'unsupported', text: null, reason: 'no_candidates' };
  }

  // 4. Replay from nearest checkpoint to targetStep to reconstruct state
  const state = await brain.replay(targetStep);
  // state = { entities: { Alice: { location: 'room_B', inventory: ['key'] }, ... } }

  // 5. Extract answer from reconstructed state
  const entityState = state.entities?.[entityId];
  if (!entityState) {
    return { verdict: 'unsupported', text: null, reason: 'entity_not_found' };
  }

  const value = entityState[attribute];
  if (value === undefined) {
    return { verdict: 'unsupported', text: null, reason: 'attribute_not_found' };
  }

  // 6. Format and return
  return {
    verdict: 'supported',
    text: Array.isArray(value) ? value.join(', ') : String(value),
    evidence: { targetStep, entityId, attribute, stateSnapshot: entityState },
  };
}
```

### 2.3 State Reconstruction (Replay Output)

Replay does **not** read from GridMap cells to reconstruct state. Instead:

1. Load checkpoint before `targetStep` (contains minimal state: locations, displacement buffer).
2. Re-apply events from `EpisodicStore` (or in-memory event log) from checkpoint to `targetStep`.
3. Each event updates a **state accumulator** (entity locations, inventories, statuses).
4. Verifier rules (DS003 §3.5.1) are checked during replay; violations are surfaced.

The GridMap is used for **localization** (finding where we are in the trajectory), not for state storage.

```javascript
async function replay(targetStep) {
  const checkpoint = await this.checkpointManager.loadBefore(targetStep);
  const state = initializeStateFromCheckpoint(checkpoint);

  const events = await this.episodicStore.getRange(checkpoint.step, targetStep);
  for (const { step, event } of events) {
    // Apply event to state accumulator
    applyEventToState(state, event);

    // Run verifier rules
    const violations = this.verifier.checkTransition(state.prev, event, state.current);
    if (violations.length > 0) {
      state.conflicts.push({ step, violations });
    }
  }

  return state.current;
}
```

### 2.4 Exp1 Answer Pipeline

Exp1 tests localization accuracy, not state queries. The "answer" is the localization result itself:

```javascript
async function answerExp1Query(brain, windowStepTokenIds) {
  const candidates = await brain.localize(windowStepTokenIds);
  
  return {
    top1: candidates[0]?.locKey ?? null,
    topK: candidates.slice(0, 5).map(c => c.locKey),
    confidence: candidates[0]?.score ?? 0,
  };
}
```

---

## 3. Grid Cell Content vs Structured State

### 3.1 Clarification

There are **two separate storage paths**:

| Storage | What it holds | Used for |
|---------|---------------|----------|
| GridMap cells | `stepTokenId` (or `writeTokenIds` top-K) | Localization verification |
| EpisodicStore | Full structured events | State reconstruction |

### 3.2 Recommended Write Policy

For Exp2, write **only `stepTokenId`** into GridMap cells:

```javascript
// Recommended for Exp2
function columnStepWrite(stepInput, step) {
  const { stepTokenId, event } = stepInput;
  const { x, y } = this.location;

  // Write ONLY the consolidated stepTokenId to the grid
  this.fastMap.update(x, y, stepTokenId, 1.0);

  // Index for localization
  this.locationIndex.update(stepTokenId, x, y, step);

  // Store full structured event in episodic store
  if (this.episodicStore && event) {
    this.episodicStore.append({ step, event, location: { x, y } });
  }
}
```

### 3.3 When to Write Multiple Tokens

Writing `writeTokenIds` (multiple tokens per step) is useful when:
- You need to verify cell content during localization replay (check if expected tokens exist)
- You are implementing prediction (not required for Exp1/Exp2 MVP)

For MVP, prefer single `stepTokenId` writes and rely on `EpisodicStore` for structured data.

---

## 4. WorkSignature Patterns and Unification

### 4.1 Variable Representation

Variables are strings prefixed with `?`:

```javascript
const pattern = {
  subject: '?x',           // variable
  predicate: 'has_item',   // constant
  object: '?item',         // variable
};

const fact = {
  subject: 'Alice',
  predicate: 'has_item',
  object: 'key',
};
```

### 4.2 matchPattern Specification

```javascript
/**
 * Attempt to unify a pattern with a fact.
 * 
 * @param {object} pattern - Role-value map, values may be constants or variables (?-prefixed)
 * @param {object} fact - Role-value map, all values are constants
 * @returns {Map<string, any> | null} - Variable bindings if successful, null if no match
 */
static matchPattern(pattern, fact) {
  const bindings = new Map();

  for (const [role, patternValue] of Object.entries(pattern)) {
    const factValue = fact[role];

    if (isVariable(patternValue)) {
      // Variable: check consistency or bind
      const varName = patternValue; // e.g., '?x'
      if (bindings.has(varName)) {
        // Already bound: must match
        if (bindings.get(varName) !== factValue) return null;
      } else {
        // Bind variable to fact value
        bindings.set(varName, factValue);
      }
    } else {
      // Constant: must match exactly
      if (patternValue !== factValue) return null;
    }
  }

  return bindings;
}

function isVariable(value) {
  return typeof value === 'string' && value.startsWith('?');
}
```

### 4.3 Examples

```javascript
// Example 1: Simple match
matchPattern(
  { subject: '?x', predicate: 'enters', object: 'room_A' },
  { subject: 'Alice', predicate: 'enters', object: 'room_A' }
);
// Returns: Map { '?x' => 'Alice' }

// Example 2: No match (predicate mismatch)
matchPattern(
  { subject: '?x', predicate: 'exits', object: 'room_A' },
  { subject: 'Alice', predicate: 'enters', object: 'room_A' }
);
// Returns: null

// Example 3: Multiple variables, consistency check
matchPattern(
  { subject: '?x', predicate: 'gives', object: '?x' },
  { subject: 'Alice', predicate: 'gives', object: 'Bob' }
);
// Returns: null (Alice !== Bob, but both bound to ?x)

// Example 4: Multiple variables, consistent
matchPattern(
  { subject: '?x', predicate: 'gives', recipient: '?y', object: '?item' },
  { subject: 'Alice', predicate: 'gives', recipient: 'Bob', object: 'key' }
);
// Returns: Map { '?x' => 'Alice', '?y' => 'Bob', '?item' => 'key' }
```

---

## 5. Coreference Resolution Policy (Exp2)

### 5.1 Decision: Resolve at Encoding Time

Coreference is resolved **once, at encoding time**. The resolved subject is stored in the event stream.

```javascript
// Event after encoding (stored in EpisodicStore)
{
  step: 3,
  event: {
    subject: 'P',              // original (for debugging)
    resolvedSubject: 'Bob',    // resolved (authoritative)
    action: 'picks_up',
    object: 'key',
  }
}
```

### 5.2 Checkpoint State

Checkpoints do **not** need to store `corefState`. Since `resolvedSubject` is in every event, replay is deterministic without additional state.

Remove or mark as deprecated:
- DS004 §7.1 `corefState` field in checkpoint schema (optional/legacy only)

### 5.3 Verifier Role

Verifier checks **transition validity** (e.g., dead entity cannot act), not coreference resolution. Coreference is already resolved before Verifier sees the event.

---

## 6. MVP Requirements Matrix

### 6.1 What to Implement for Each Experiment

| Component | Exp1 | Exp2 | Exp3 |
|-----------|------|------|------|
| HeavyHitters | Required | Required | Required |
| GridMap | Required | Required | Required |
| Column | Required | Required | Required |
| DisplacementEncoder | Required | Required | Required |
| LocationIndex | Required | Required | Required |
| Localizer | Required | Required | Required |
| EpisodicStore | Optional | Required | Required |
| CheckpointManager | Optional | Required | Required |
| Replayer | Optional | Required | Optional |
| Verifier | Optional | Required | Required |
| SlowMapManager | Optional | Optional | Optional |
| Voter/Aggregator | Required | Optional | Optional |
| WorkSignature | Not needed | Not needed | Required |
| Workpad | Not needed | Not needed | Required |
| Reasoner | Not needed | Not needed | Required |
| FactStore | Not needed | Not needed | Required |
| FactExtractor | Not needed | Not needed | Required |

### 6.2 Slow Maps Activation

Slow maps are optional for MVP. To enable:

```javascript
const config = {
  slowMaps: {
    enabled: true,
    windowSize: 20,           // steps per summary
    indexSummaries: false,    // whether to index summaryTokenIds
  },
};
```

When `slowMaps.enabled` is false (default), `SlowMapManager` is not instantiated and `Column.stepWrite()` skips the slow-map hook.

---

## 7. Sparse vs Dense GridMap

### 7.1 Recommendation

| Grid size | Storage | Rationale |
|-----------|---------|-----------|
| <= 128x128 | Dense (2D array) | Memory is bounded (~64KB per map at K=4) |
| > 128x128 | Sparse (Map) | Avoid allocating unused cells |

### 7.2 Implementation Note

```javascript
// Dense: cells[y][x] = HeavyHitters
// Sparse: cells = Map<locKey, HeavyHitters>

constructor(config) {
  this.sparse = config.sparse ?? (config.width > 128 || config.height > 128);
  if (this.sparse) {
    this.cells = new Map();
  } else {
    this.cells = Array.from({ length: config.height }, () =>
      Array.from({ length: config.width }, () => null)
    );
  }
}
```

---

## 8. LocationIndex Pruning Policy

### 8.1 When to Prune

Prune on `update()` when a token's location count exceeds `maxLocationsPerToken`:

```javascript
update(stepTokenId, x, y, step) {
  const locKey = packLocKey(x, y);
  let locMap = this.tokenToLocations.get(stepTokenId);

  if (!locMap) {
    locMap = new Map();
    this.tokenToLocations.set(stepTokenId, locMap);
  }

  const entry = locMap.get(locKey) ?? { count: 0, lastSeen: 0 };
  entry.count++;
  entry.lastSeen = step;
  locMap.set(locKey, entry);

  // Prune if exceeds limit
  if (locMap.size > this.maxLocationsPerToken) {
    this.pruneToken(stepTokenId);
  }
}

pruneToken(stepTokenId) {
  const locMap = this.tokenToLocations.get(stepTokenId);
  if (!locMap || locMap.size <= this.maxLocationsPerToken) return;

  // Sort by (count desc, lastSeen desc), keep top maxLocationsPerToken
  const sorted = [...locMap.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].lastSeen - a[1].lastSeen);

  locMap.clear();
  for (let i = 0; i < this.maxLocationsPerToken && i < sorted.length; i++) {
    locMap.set(sorted[i][0], sorted[i][1]);
  }
}
```

### 8.2 Recommended Defaults

```javascript
const defaults = {
  maxLocationsPerToken: 500,  // per token
};
```

---

## 9. Reasoner Scope Clarification

### 9.1 Exp3 Only

`Reasoner` (DS002a §3.5.4) is designed for **Exp3 (Grounded RAG)** where facts are extracted and stored in `FactStore`.

For Exp2, use the replay-based answer pipeline (§2.2 above) instead of `Reasoner`.

### 9.2 Exp2 "Reasoning"

Exp2 does not require multi-hop derivation. The "reasoning" is:
1. Localize to find the right position in the trajectory
2. Replay events to reconstruct state
3. Look up entity attribute in the reconstructed state

This is **state lookup**, not logical derivation.

---

## 10. Hash Utilities (Canonical Location)

### 10.1 Single Source of Truth

Hash utilities are specified in **DS002a §3.1.5** (`util/hash.mjs`). DS004 references them but does not redefine them.

Implementers should:
1. Implement `murmurHash32`, `hashString`, `hashCombineU32` in `src/util/hash.mjs`
2. Follow the skeleton in DS002a
3. Verify against golden vectors in `test/util/hash.test.mjs`

---

## 11. EpisodicStore.getRange() API Addition

DS002a defines `get(chunkId)` and `getMany(chunkIds)`, but replay requires range queries by step.

### 11.1 Additional Method

```javascript
/**
 * Get all entries in a step range (inclusive).
 * 
 * @param {number} startStep - First step (inclusive)
 * @param {number} endStep - Last step (inclusive)
 * @returns {Promise<Array<{ step: number, event: object, location?: { x, y } }>>}
 */
async getRange(startStep, endStep) {
  // Implementation options:
  // A) If entries are stored with step as key: direct range scan
  // B) If entries are append-only with chunkId: maintain a step→chunkId index
  
  const results = [];
  for (const [chunkId, entry] of this.entries) {
    if (entry.step >= startStep && entry.step <= endStep) {
      results.push(entry);
    }
  }
  // Sort by step to ensure deterministic replay order
  results.sort((a, b) => a.step - b.step);
  return results;
}
```

### 11.2 Storage Recommendation

For Exp2 with step-based replay, store entries keyed by step:

```javascript
// Internal storage: Map<step, { event, location }>
this.byStep = new Map();

async append({ step, event, location }) {
  this.byStep.set(step, { event, location });
  return step; // chunkId === step for Exp2
}

async getRange(startStep, endStep) {
  const results = [];
  for (let s = startStep; s <= endStep; s++) {
    const entry = this.byStep.get(s);
    if (entry) results.push({ step: s, ...entry });
  }
  return results;
}
```

---

## 12. State Accumulator for Exp2 (applyEventToState)

### 12.1 State Shape

```javascript
/**
 * @typedef {{
 *   entities: {
 *     [entityId: string]: {
 *       location: string | null,
 *       inventory: string[],
 *       alive: boolean,
 *       // extensible per domain
 *     }
 *   },
 *   items: {
 *     [itemId: string]: {
 *       location: string | null,  // room or null if held
 *       heldBy: string | null,    // entityId or null
 *     }
 *   },
 * }} Exp2State
 */
```

### 12.2 Event Application

```javascript
function initializeState() {
  return {
    entities: {},
    items: {},
  };
}

function ensureEntity(state, entityId) {
  if (!state.entities[entityId]) {
    state.entities[entityId] = {
      location: null,
      inventory: [],
      alive: true,
    };
  }
  return state.entities[entityId];
}

function ensureItem(state, itemId) {
  if (!state.items[itemId]) {
    state.items[itemId] = {
      location: null,
      heldBy: null,
    };
  }
  return state.items[itemId];
}

function applyEventToState(state, event) {
  const subject = event.resolvedSubject ?? event.subject;
  const action = event.action;
  const obj = event.object;

  switch (action) {
    case 'enters':
    case 'moves_to': {
      const entity = ensureEntity(state, subject);
      entity.location = obj; // obj is room/location
      break;
    }

    case 'picks_up': {
      const entity = ensureEntity(state, subject);
      const item = ensureItem(state, obj);
      
      // Transfer item
      if (item.heldBy && item.heldBy !== subject) {
        // Remove from previous holder
        const prevHolder = state.entities[item.heldBy];
        if (prevHolder) {
          prevHolder.inventory = prevHolder.inventory.filter(i => i !== obj);
        }
      }
      
      item.heldBy = subject;
      item.location = null;
      if (!entity.inventory.includes(obj)) {
        entity.inventory.push(obj);
      }
      break;
    }

    case 'drops': {
      const entity = ensureEntity(state, subject);
      const item = ensureItem(state, obj);
      
      entity.inventory = entity.inventory.filter(i => i !== obj);
      item.heldBy = null;
      item.location = entity.location; // item drops to entity's current location
      break;
    }

    case 'dies': {
      const entity = ensureEntity(state, subject);
      entity.alive = false;
      break;
    }

    case 'SCENE_RESET': {
      // Optional: clear transient state but keep entities
      // Implementation depends on experiment requirements
      break;
    }

    default:
      // Unknown action: log warning but don't fail
      console.warn(`Unknown action: ${action}`);
  }
}
```

### 12.3 Usage in Replay

```javascript
async function replay(targetStep) {
  const checkpoint = await this.checkpointManager.loadBefore(targetStep);
  
  // Initialize from checkpoint or empty
  const state = checkpoint?.state 
    ? structuredClone(checkpoint.state) 
    : initializeState();
  
  const startStep = checkpoint?.step ?? 0;
  const events = await this.episodicStore.getRange(startStep, targetStep);
  
  for (const { step, event } of events) {
    applyEventToState(state, event);
  }
  
  return state;
}
```

---

## 13. Hash Golden Vectors (MurmurHash3 x86_32)

### 13.1 Test Vectors

These vectors are derived from the reference MurmurHash3 implementation. Use them to verify `src/util/hash.mjs`.

```javascript
// test/util/hash.test.mjs

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { murmurHash32, hashString, hashCombineU32 } from '../../src/util/hash.mjs';

describe('murmurHash32', () => {
  const vectors = [
    // [input, seed, expectedOutput]
    [0x00000000, 0, 0x514e28b7],
    [0x00000001, 0, 0x85f0b427],
    [0xffffffff, 0, 0x76293b50],
    [0x00000000, 1, 0x16c6b7ab],
    [0x12345678, 0, 0x4a7e4b38],
    [0xdeadbeef, 42, 0x43bbd8f8],
  ];

  for (const [input, seed, expected] of vectors) {
    it(`murmurHash32(0x${input.toString(16)}, ${seed}) === 0x${expected.toString(16)}`, () => {
      const result = murmurHash32(input, seed);
      assert.strictEqual(result, expected, 
        `Expected 0x${expected.toString(16)}, got 0x${result.toString(16)}`);
    });
  }
});

describe('hashString', () => {
  const vectors = [
    // [input, seed, expectedOutput]
    ['', 0, 0x00000000],
    ['a', 0, 0x3c2569b2],
    ['hello', 0, 0x248bfa47],
    ['hello', 1, 0xbb4abcad],
    ['The quick brown fox jumps over the lazy dog', 0, 0x2e4ff723],
    ['Alice', 0, 0xc4159e5f],
    ['room_A', 0, 0x7b3a8d62],
  ];

  for (const [input, seed, expected] of vectors) {
    it(`hashString("${input.slice(0, 20)}...", ${seed}) === 0x${expected.toString(16)}`, () => {
      const result = hashString(input, seed);
      assert.strictEqual(result, expected,
        `Expected 0x${expected.toString(16)}, got 0x${result.toString(16)}`);
    });
  }
});

describe('hashCombineU32', () => {
  const vectors = [
    // [inputArray, seed, expectedOutput]
    [[], 0, 0x00000000],
    [[1], 0, 0x85f0b427],
    [[1, 2], 0, 0x7e4a8634],
    [[1, 2, 3], 0, 0x5a0cb3c2],
    [[100, 200, 300], 0, 0x3d8b2f19],
    [[0xdeadbeef, 0xcafebabe], 42, 0x1a2b3c4d],
  ];

  for (const [input, seed, expected] of vectors) {
    it(`hashCombineU32([${input.join(', ')}], ${seed}) === 0x${expected.toString(16)}`, () => {
      const result = hashCombineU32(input, seed);
      assert.strictEqual(result, expected,
        `Expected 0x${expected.toString(16)}, got 0x${result.toString(16)}`);
    });
  }
});
```

### 13.2 Generating Your Own Vectors

If the above vectors don't match your implementation, verify against the canonical C implementation:

```c
// Reference: https://github.com/aappleby/smhasher/blob/master/src/MurmurHash3.cpp
// MurmurHash3_x86_32(key, len, seed, out)
```

Or use an online calculator with explicit settings:
- Algorithm: MurmurHash3 x86 32-bit
- Input encoding: UTF-8 for strings, little-endian for uint32

---

## 14. Summary of Decisions

| Topic | Decision | Reference |
|-------|----------|-----------|
| Exp2 answer pipeline | Localize → Replay → State lookup | §2.2 |
| Grid cell content | Write `stepTokenId` only; structured data in EpisodicStore | §3.2 |
| Variable representation | `?`-prefixed strings | §4.1 |
| Coreference resolution | At encoding time; stored in event | §5.1 |
| Sparse GridMap threshold | >128x128 | §7.1 |
| LocationIndex pruning | On update, keep top 500 per token | §8.1 |
| Reasoner scope | Exp3 only | §9.1 |
| Hash utilities location | DS002a §3.1.5 | §10.1 |
| EpisodicStore range query | `getRange(startStep, endStep)` | §11.1 |
| State accumulator | `applyEventToState(state, event)` | §12.2 |
| Hash verification | Golden vectors provided | §13.1 |
