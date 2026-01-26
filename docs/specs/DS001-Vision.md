# DS001 - Vision: Discrete CPU-First Learning Architecture

**Status:** Draft  
**Version:** 0.3  
**Last Updated:** 2026-01-26

---

## 1. Executive Summary

This document describes the architectural vision for VSABrains: a discrete, CPU-first learning system inspired by *A Thousand Brains* (Hawkins et al.). The goal is to demonstrate that robust intelligence can emerge from parallel models operating in reference frames, achieving consensus through voting, without requiring GPU-accelerated dense neural networks.

The system targets two concrete use cases:
1. **Domain Expert**: Incremental absorption of domain knowledge with version management, paraphrase unification, rule composition, and long-context coherence.
2. **Verifiable RAG**: Retrieval-augmented generation where every emitted proposition is traceable to source facts, with explicit verdicts (`supported`, `conflicting`, `unsupported`).

---

## 2. The Fundamental Problem: Why Not Global Superposition?

### 2.1 The "Muddiness" Problem

Vector Symbolic Architectures (VSA) and related global superposition schemes attempt to compress entire timelines into single holographic vectors. Our experiments revealed a structural limitation: **performance collapses rapidly with sequence length**.

The probability of correctly recovering a window of L consecutive steps decreases dramatically as more events are superposed. This is not an implementation issue—it is inherent to global superposition.

### 2.2 Our Solution: Order as Address

Instead of encoding temporal order as superposed content, we encode it as **location/address** in memory:

| Global Superposition | Our Approach |
|---------------------|--------------|
| Events mixed into one vector | Events written along trajectories |
| Order encoded in content | Order encoded as position |
| Retrieval is probabilistic | Retrieval is deterministic |
| Verification is weak | Verification is strong (auditable) |

This architectural choice makes verification powerful: verdicts (`supported`/`conflicting`/`unsupported`) are based on deterministic reconstruction from addressable evidence, not on "trust" in a saturated global representation.

---

## 3. Architecture Overview

### 3.1 Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Meta-Controller                          │
│         (regime selection based on error/conflict)              │
└─────────────────────────────────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Column 0    │    │   Column 1    │    │   Column N    │
│ ┌───────────┐ │    │ ┌───────────┐ │    │ ┌───────────┐ │
│ │  GridMaps │ │    │ │  GridMaps │ │    │ │  GridMaps │ │
│ │  (fast)   │ │    │ │  (fast)   │ │    │ │  (fast)   │ │
│ ├───────────┤ │    │ ├───────────┤ │    │ ├───────────┤ │
│ │  GridMaps │ │    │ │  GridMaps │ │    │ │  GridMaps │ │
│ │  (slow)   │ │    │ │  (slow)   │ │    │ │  (slow)   │ │
│ ├───────────┤ │    │ ├───────────┤ │    │ ├───────────┤ │
│ │  Location │ │    │ │  Location │ │    │ │  Location │ │
│ │  State    │ │    │ │  State    │ │    │ │  State    │ │
│ └───────────┘ │    └───────────────┘    │ └───────────┘ │
└───────────────┘                          └───────────────┘
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               ▼
                    ┌───────────────────┐
                    │    Consensus      │
                    │    (voting)       │
                    └───────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Localizer   │    │   Episodic    │    │   Reasoner    │
│   (top-K)     │    │   Store       │    │   (chaining)  │
└───────────────┘    └───────────────┘    └───────────────┘
```

### 3.2 GridMap: The Discrete Memory Structure

Each GridMap is a 2D grid (dense or sparse hash-grid). Each cell contains a **Heavy-Hitters summary**:

```
┌─────────────────────────────────────────┐
│ Cell at (x, y)                          │
│ ┌─────────────────────────────────────┐ │
│ │ Heavy-Hitters (k=4)                 │ │
│ │ ──────────────────────────────────  │ │
│ │ token_id: 42    count: 15  recency  │ │
│ │ token_id: 17    count: 8   recency  │ │
│ │ token_id: 93    count: 5   recency  │ │
│ │ token_id: 7     count: 3   recency  │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Key properties:**
- Online learning: cells update incrementally
- Bounded memory: only top-K items retained
- Local anti-muddiness: pruning prevents saturation within cells
- Deterministic retrieval: query cell, get ranked tokens

**Recommended grid sizes:**
- Small experiments: 64×64 (4K cells)
- Medium scale: 128×128 (16K cells)
- Large scale: 256×256 or sparse hash-grid with dynamic expansion

**Saturation monitoring:** Track `cells_with_full_capacity / total_non_empty_cells`. If > 80%, increase grid size or reduce heavy-hitters K.

---

### 3.3 Tokens, Tokenization, and Vocabulary

All core components operate on **discrete token IDs** (`tokenId`). A `tokenId` is a deterministic integer used by:
- `GridMap` cells (heavy-hitters counts)
- displacement computation (hashing recent token IDs)
- `LocationIndex` (token → candidate locations)

There are two supported input modes:

1. **Synthetic experiments (Exp1/Exp2):** generators produce token IDs directly. No text tokenization is required.
2. **Text pipelines (Exp3 / domain ingestion):** text is converted into structured facts (preferred) or into lexical tokens via a tokenizer, then mapped to token IDs via a vocabulary.

**Recommended baseline tokenizer (CPU-first, deterministic):**
- Split into tokens using a simple regex/Unicode-aware lexer: words, numbers, and punctuation as separate tokens.
- Optional normalization: `lowercase`, collapse whitespace, normalize quotes.
- Produce an array of string tokens, then map them to IDs via a vocabulary.

**Vocabulary policy (mapping string → `tokenId`):**
- `dynamic` mode: assign incremental IDs to new tokens until `maxSize`; overflow maps to `UNK`.
- `hash` mode: `tokenId = hashString(token) % vocabSize` (bounded memory, collision-prone, acceptable for early prototypes).

Reserved IDs (recommended):
`PAD=0`, `BOS=1`, `EOS=2`, `UNK=3`, `SEP=4`.

For structured inputs (events, facts), keep namespaces explicit by prefixing strings before encoding:
- `S:Alice`, `P:move_to`, `O:room_B`, `Q:time=5`, etc.

#### 3.3.1 Step Tokens (Primary vs. Auxiliary)

The architecture advances on a **step clock**. Each step produces exactly one movement update, but may write multiple tokens into the current cell.

Define two token sets per step:

- **`stepTokenId` (primary):** one token ID used for displacement buffering and for localization indexing.
- **`writeTokenIds` (auxiliary):** zero or more token IDs written into the current cell for later retrieval/reasoning.

Default normalization:

- If the input is a single `tokenId`, then `stepTokenId = tokenId` and `writeTokenIds = [tokenId]`.
- If the input is a bundle of token IDs, then `writeTokenIds` are written as-is and `stepTokenId` is derived deterministically from the bundle (e.g., `stepTokenId = hashCombine(writeTokenIds)`).

Only **one movement** is applied per step, **after** all writes complete.

Indexing policy (recommended baseline):
- `LocationIndex` indexes `stepTokenId` (not every auxiliary token) to keep candidate sets bounded and to keep displacement/localization consistent.

### 3.4 Hashing Utilities (Deterministic, Non-Cryptographic)

The architecture relies on deterministic, fast, non-cryptographic hashing for:
- displacement (`recentStepTokens` → `(dx, dy)`)
- summary tokens (`WindowSummary` → `tokenId`)
- bounded vocabularies (`hash` mode)

Canonical utilities live in `src/util/hash.mjs` and must define:

```javascript
/**
 * MurmurHash3 x86_32 for integer inputs (used with deterministic 32-bit operations).
 * Returns a deterministic non-negative integer.
 */
function murmurHash32(value, seed = 0) {}

/**
 * MurmurHash3 x86_32 for UTF-8 strings.
 * Returns a deterministic non-negative integer.
 */
function hashString(str, seed = 0) {}

/**
 * Fold multiple integer values into one integer (used for stepTokenId from bundles).
 */
function hashCombine(values, seed = 0) {}
```

Implementation note: use MurmurHash3 x86_32 (public domain reference) with a stable `fmix32` finalizer.

---

## 4. Displacement: The Concrete Mechanism

### 4.1 The Problem Displacement Solves

Displacement transforms **temporal order into spatial trajectory**. Without a well-designed displacement function, different sequences may collide into the same trajectory, making localization impossible.

### 4.2 Chosen Approach: Content-Hash Displacement

We use a **hash-based displacement** that depends on recent token context:

```javascript
function computeDisplacement(recentStepTokens, config) {
  // recentStepTokens: array of last N stepTokenIds (see §3.3.1)
  // Returns: { dx, dy }
  
  const N = config.contextLength || 2;
  
  // Combine recent tokens into a single value
  let combined = 0;
  for (let i = 0; i < Math.min(N, recentStepTokens.length); i++) {
    combined = (combined * 31 + recentStepTokens[i]) >>> 0; // unsigned 32-bit
  }
  
  // Hash to get pseudo-random but deterministic displacement
  const hash = murmurHash32(combined, config.seed || 0);
  
  // Map to displacement range [-maxStep, +maxStep]
  const maxStep = config.maxStep || 3;
  const dx = (hash % (2 * maxStep + 1)) - maxStep;
  const dy = ((hash >>> 16) % (2 * maxStep + 1)) - maxStep;
  
  return { dx, dy };
}
```

#### 4.2.1 Context Buffer Ownership (Per Column)

`computeDisplacement()` is a pure function, but something must maintain the rolling context.

Specification:
- Each **column** owns a displacement context buffer (implemented by `DisplacementEncoder`).
- The buffer stores the last `contextLength` **`stepTokenId`s** (not auxiliary `writeTokenIds`).
- The buffer is updated **once per step** after deriving `stepTokenId` (see §3.3.1).
- A convenience method `DisplacementEncoder.step(stepTokenId)` may both update the buffer and return `{dx, dy}` for the movement applied at the end of the step.

### 4.3 Why This Works

1. **Determinism**: Same token sequence → same displacement → reproducible trajectories
2. **Diversity**: Different n-grams produce different displacements via hash
3. **Bounded steps**: `maxStep` prevents trajectory from jumping too far
4. **Context sensitivity**: Using N>1 tokens means displacement depends on local context, not just current token

### 4.4 Configuration Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `contextLength` | 2 | Number of recent tokens used for displacement |
| `maxStep` | 3 | Maximum displacement per axis (-3 to +3) |
| `gridSize` | 64 | Grid dimension (for wrapping) |
| `seed` | 0 | Hash seed (different per column for diversity) |

### 4.5 Column Diversity via Seeds

Each column uses a different seed, producing different trajectories for the same sequence:

```javascript
const columns = [
  new Column({ displacementSeed: 0 }),
  new Column({ displacementSeed: 12345 }),
  new Column({ displacementSeed: 67890 }),
  new Column({ displacementSeed: 11111 }),
];
```

This ensures columns maintain **diverse internal representations** that can vote meaningfully.

### 4.6 Wrapping vs. Clamping

When location exceeds grid bounds:
- **Wrapping** (recommended): `x = ((x % gridSize) + gridSize) % gridSize`
- **Clamping**: `x = Math.max(0, Math.min(gridSize - 1, x))`

Wrapping provides a toroidal topology that avoids edge effects.

### 4.7 Collisions, Revisit Rate, and Trajectory Diversity

No deterministic displacement function can guarantee zero collisions (different token contexts producing the same `(dx, dy)` sequence) once you quantize into a small step range and a finite grid. The architecture treats collisions as an engineering reality and mitigates them via:

1. **Context dependence**: use `contextLength >= 2` so displacement depends on a short n-gram, not a single token.
2. **Column diversity**: use different per-column seeds so the same sequence produces different trajectories across columns.
3. **Sufficient map capacity**: increase grid size and/or use sparse maps when `cellSaturation` rises.
4. **Verification**: localization is not “displacement-only”; candidates are verified by replaying the window and checking the actual tokens at visited cells.

**Recommended acceptance checks (Exp1 diagnostics):**

| Diagnostic | Meaning | Action if bad |
|-----------|---------|---------------|
| `cellSaturation > 0.8` | Too many collisions per cell (heavy-hitters truncating) | Increase grid size, reduce write rate, or add sparse map |
| `revisitRate` high (short cycles) | Trajectory not mixing; windows overlap too often | Increase `maxStep`, increase `contextLength`, change seed |
| `zeroStepRate` high | Too many `(dx,dy)=(0,0)` causing overwrites | Enable `avoidZeroStep` remapping |

Optional improvement: remap `(dx, dy) = (0, 0)` to a non-zero step deterministically:

```javascript
function avoidZeroStep(dx, dy, hash) {
  if (dx !== 0 || dy !== 0) return { dx, dy };
  // Derive a non-zero fallback from higher hash bits.
  const dir = (hash >>> 24) & 3;
  if (dir === 0) return { dx: 1, dy: 0 };
  if (dir === 1) return { dx: -1, dy: 0 };
  if (dir === 2) return { dx: 0, dy: 1 };
  return { dx: 0, dy: -1 };
}
```

---

## 5. Localization: Efficient Top-K Search

### 5.1 The Problem

Given a window of recent **step tokens** (`stepTokenId`s), find the top-K locations in the grid that best match this pattern. Naive exhaustive search over all cells is O(gridSize²), which is too slow.

### 5.2 Solution: Inverted Index

Maintain an **inverted index** from step tokens to their observed locations:

```javascript
class LocationIndex {
  constructor() {
    // stepTokenId → map of locationKey → {count, lastSeen}
    this.tokenToLocations = new Map();
  }
  
  // Called when writing a step token at location.
  // locKey packs (x,y) into a single numeric key and assumes x,y < 65536.
  update(stepTokenId, x, y, step) {
    const locKey = (((x & 0xffff) << 16) | (y & 0xffff)) >>> 0;
    if (!this.tokenToLocations.has(stepTokenId)) {
      this.tokenToLocations.set(stepTokenId, new Map());
    }
    const locs = this.tokenToLocations.get(stepTokenId);
    const existing = locs.get(locKey) || { count: 0, lastSeen: 0 };
    locs.set(locKey, { count: existing.count + 1, lastSeen: step });
  }
  
  // Get candidate locations for a token
  getCandidates(stepTokenId, limit = 100) {
    const locs = this.tokenToLocations.get(stepTokenId);
    if (!locs) return [];
    return Array.from(locs.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([key, data]) => {
        const x = key >>> 16;
        const y = key & 0xffff;
        return { x, y, count: data.count, lastSeen: data.lastSeen };
      });
  }
}
```

#### 5.2.1 Index Scope (Columns and Maps)

In a multi-column system, trajectories differ per column (different seeds/offsets), so localization should treat indices as **column-scoped**:

- **Recommended baseline:** one `LocationIndex` per column for the map used by localization (typically a fast map holding `stepTokenId`s).
- Optional: additional indices per column for slow maps (summary tokens) to support coarse-to-fine localization.

Alternative design (also valid): a single global index keyed by `(columnId, x, y)` instead of just `(x, y)`.

### 5.3 Localization Algorithm

```javascript
async function localize(windowStepTokens, index, gridMap, topK = 20, config = {}) {
  const candidatesPerToken = config.candidatesPerToken ?? 50;
  const minMatches = config.minMatches ?? Math.ceil(windowStepTokens.length * 0.6);

  // Step 1: Fetch candidate lists (token → locations).
  const perToken = windowStepTokens.map(tok => index.getCandidates(tok, candidatesPerToken));

  // Step 2: Anchor on the rarest token (smallest candidate list) to reduce work.
  let anchorIdx = 0;
  for (let i = 1; i < perToken.length; i++) {
    if (perToken[i].length < perToken[anchorIdx].length) anchorIdx = i;
  }

  const locationScores = new Map(); // locKey → {matches, lastSeenMax}

  // Seed candidates from the anchor token.
  for (const c of perToken[anchorIdx]) {
    const locKey = (((c.x & 0xffff) << 16) | (c.y & 0xffff)) >>> 0;
    locationScores.set(locKey, { matches: 1, lastSeenMax: c.lastSeen });
  }

  // Step 3: Soft-intersect by adding evidence from other tokens.
  // (Soft intersection handles noise; strict intersection is too brittle.)
  for (let i = 0; i < windowStepTokens.length; i++) {
    if (i === anchorIdx) continue;
    for (const c of perToken[i]) {
      const locKey = (((c.x & 0xffff) << 16) | (c.y & 0xffff)) >>> 0;
      const cur = locationScores.get(locKey);
      if (!cur) continue; // Anchor-based intersection for speed.
      cur.matches++;
      cur.lastSeenMax = Math.max(cur.lastSeenMax, c.lastSeen);
    }
  }

  // Step 4: Rank by match ratio, then recency.
  const ranked = Array.from(locationScores.entries())
    .map(([key, data]) => {
      const x = key >>> 16;
      const y = key & 0xffff;
      const matchRatio = data.matches / windowStepTokens.length;
      return { x, y, score: matchRatio, matches: data.matches, lastSeenMax: data.lastSeenMax };
    })
    .filter(c => c.matches >= minMatches)
    .sort((a, b) => b.score - a.score || b.lastSeenMax - a.lastSeenMax)
    .slice(0, topK);

  return ranked;
}
```

### 5.4 Trajectory Verification

For top candidates, verify by **replaying the displacement sequence**:

```javascript
async function verifyCandidate(candidate, windowStepTokens, displacementFn, gridMap) {
  let { x, y } = candidate;
  let score = 0;
  
  for (let i = 0; i < windowStepTokens.length; i++) {
    // Check if token exists at this location
    const cellTokens = gridMap.readTopK(x, y, 4);
    const found = cellTokens.find(([id, _]) => id === windowStepTokens[i]);
    if (found) {
      score += found[1]; // Add count as score
    }
    
    // Apply displacement to get next location
    if (i < windowStepTokens.length - 1) {
      const recent = windowStepTokens.slice(Math.max(0, i - 1), i + 1);
      const disp = displacementFn(recent);
      x = ((x + disp.dx) % gridMap.width + gridMap.width) % gridMap.width;
      y = ((y + disp.dy) % gridMap.height + gridMap.height) % gridMap.height;
    }
  }
  
  return { ...candidate, verifiedScore: score };
}
```

### 5.5 Computational Complexity

- Index lookup: O(windowLength × candidatesPerToken)
- Scoring: O(totalCandidates)
- Verification: O(topK × windowLength)

Total: **O(W × C + K × W)** where W=window length, C=candidates per token, K=top-K

This is much better than O(gridSize²) exhaustive search.

### 5.6 End-to-End Workflow: localize → verify → replay

The system uses two kinds of “replay”:

1. **Trajectory replay (localization verification):** replay displacement over `windowStepTokens` and check whether the expected step tokens are present in visited cells.
2. **State replay (query answering):** replay events from a checkpoint to reconstruct entity/world state at a target step/time.

Recommended orchestration:

```javascript
async function localizeAndVerify(windowStepTokens, columns, config) {
  const results = [];

  for (const column of columns) {
    const candidates = await column.localizer.localize(windowStepTokens, config.topK);
    const verified = [];

    for (const c of candidates.slice(0, config.verifyTopK)) {
      const v = await verifyCandidate(
        c,
        windowStepTokens,
        (recent) => column.displacementEncoder.encode(recent),
        column.fastMap
      );
      verified.push(v);
    }

    verified.sort((a, b) => (b.verifiedScore ?? 0) - (a.verifiedScore ?? 0));
    results.push({ columnId: column.id, candidates: verified });
  }

  return results;
}

async function answerStateQuery(query, windowStepTokens, columns, checkpointManager, replayer, verifier) {
  const localized = await localizeAndVerify(windowStepTokens, columns, { topK: 20, verifyTopK: 10 });
  const best = pickBestHypothesis(localized); // may keep multiple hypotheses if confidence is low
  const ckpt = await checkpointManager.loadBefore(best.step);
  const state = await replayer.replay(best.step, ckpt);
  verifier.verify(state.history);
  return state.answer(query);
}
```

---

## 6. Work Signatures: Structural Binding for Reasoning

### 6.1 The Problem

To perform reasoning (deduction, induction, abduction), we need to:
1. Represent facts with typed structure (subject, predicate, object, qualifiers)
2. Match patterns with variables (generalization)
3. Instantiate variables to produce concrete conclusions

### 6.2 Chosen Approach: Explicit Role-Value Maps

We use **explicit structured maps** rather than VSA-style tensor binding. This provides:
- Full auditability (can inspect exactly what's bound)
- Deterministic matching
- No interference between bindings

In this model:
- `BIND(role, value)` is a deterministic insertion into a map from role to value.
- `⊕` (combine) is a conflict-checked merge of role-value bindings.

```javascript
class WorkSignature {
  constructor() {
    // role → value mapping
    this.bindings = new Map();
    // Tracks which roles contain variables vs constants
    this.variables = new Set();
  }
  
  bind(role, value, isVariable = false) {
    this.bindings.set(role, value);
    if (isVariable) {
      this.variables.add(role);
    }
    return this;
  }
  
  unbind(role) {
    return this.bindings.get(role);
  }
  
  hasVariable(role) {
    return this.variables.has(role);
  }
  
  // Get all role-value pairs
  entries() {
    return Array.from(this.bindings.entries());
  }
  
  // Create a hash for indexing
  toHash() {
    const parts = this.entries()
      .filter(([role, _]) => !this.variables.has(role))
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([role, value]) => `${role}:${value}`);
    return parts.join('|');
  }

  // Merge bindings; returns null on conflict.
  merge(other) {
    const merged = new WorkSignature();
    for (const [role, value] of this.entries()) {
      merged.bind(role, value, this.hasVariable(role));
    }
    for (const [role, value] of other.entries()) {
      const existing = merged.unbind(role);
      if (existing !== undefined && existing !== value) return null;
      merged.bind(role, value, other.hasVariable(role));
    }
    return merged;
  }
}
```

### 6.3 Canonicalization for Generalization

To learn patterns that generalize, we replace specific entities with **canonical variables**:

```javascript
function canonicalize(fact, variableRoles = ['subject', 'object']) {
  const signature = new WorkSignature();
  const varMap = new Map(); // original value → variable name
  let varCounter = 0;
  
  for (const [role, value] of Object.entries(fact)) {
    if (variableRoles.includes(role)) {
      // Replace with canonical variable
      if (!varMap.has(value)) {
        varMap.set(value, `X${varCounter++}`);
      }
      signature.bind(role, varMap.get(value), true);
    } else {
      signature.bind(role, value, false);
    }
  }
  
  return { signature, variableMap: varMap };
}

// Example:
// Input: { subject: "Alice", predicate: "parent_of", object: "Bob" }
// Output: signature with { subject: X0, predicate: "parent_of", object: X1 }
//         variableMap: { "Alice" → "X0", "Bob" → "X1" }
```

### 6.4 Pattern Matching

Match a pattern (with variables) against a fact (concrete):

```javascript
function matchPattern(pattern, fact) {
  const bindings = new Map(); // variable → concrete value
  
  for (const [role, patternValue] of pattern.entries()) {
    const factValue = fact.unbind(role);
    
    if (factValue === undefined) {
      return null; // Role missing in fact
    }
    
    if (pattern.hasVariable(role)) {
      // Variable: check consistency or bind
      if (bindings.has(patternValue)) {
        if (bindings.get(patternValue) !== factValue) {
          return null; // Inconsistent binding
        }
      } else {
        bindings.set(patternValue, factValue);
      }
    } else {
      // Constant: must match exactly
      if (patternValue !== factValue) {
        return null;
      }
    }
  }
  
  return bindings;
}
```

### 6.5 Workpad: Variable-to-Constant Context

During reasoning, a **Workpad** maintains the current variable bindings:

```javascript
class Workpad {
  constructor() {
    this.bindings = new Map(); // variable → constant
    this.history = []; // for backtracking
  }
  
  bind(variable, constant) {
    if (this.bindings.has(variable)) {
      if (this.bindings.get(variable) !== constant) {
        return false; // Conflict
      }
      return true; // Already bound to same value
    }
    this.history.push({ variable, previousValue: undefined });
    this.bindings.set(variable, constant);
    return true;
  }
  
  resolve(variable) {
    return this.bindings.get(variable);
  }
  
  // Instantiate a signature by replacing variables with bound constants
  instantiate(signature) {
    const result = new WorkSignature();
    for (const [role, value] of signature.entries()) {
      if (signature.hasVariable(role) && this.bindings.has(value)) {
        result.bind(role, this.bindings.get(value), false);
      } else {
        result.bind(role, value, signature.hasVariable(role));
      }
    }
    return result;
  }
  
  // Checkpoint for backtracking
  checkpoint() {
    return this.history.length;
  }
  
  // Rollback to checkpoint
  rollback(checkpoint) {
    while (this.history.length > checkpoint) {
      const { variable, previousValue } = this.history.pop();
      if (previousValue === undefined) {
        this.bindings.delete(variable);
      } else {
        this.bindings.set(variable, previousValue);
      }
    }
  }
  
  clear() {
    this.bindings.clear();
    this.history = [];
  }
}
```

---

## 7. Multi-Timescale: Slow Maps and Summaries

### 7.1 The Problem

Fast maps capture fine-grained token sequences but saturate over long timelines. Slow maps must capture **coarse-grained structure** without losing critical information.

### 7.2 Summary Structure

A summary captures a **window of events** (e.g., 10-50 steps) with the following structure:

```javascript
class WindowSummary {
  constructor(startStep, endStep) {
    this.timeRange = { start: startStep, end: endStep }; // inclusive/exclusive by convention
    this.entitiesMentioned = new Set(); // Entity IDs mentioned
    this.predicatesUsed = new Map();    // predicate → count
    this.keyFacts = [];                // Top-N facts by score (e.g., top-3)
    this.stateChanges = [];            // Entity state transitions
  }
  
  addEvent(event) {
    if (event.subject) this.entitiesMentioned.add(event.subject);
    if (event.object) this.entitiesMentioned.add(event.object);
    
    if (event.predicate) {
      const count = this.predicatesUsed.get(event.predicate) || 0;
      this.predicatesUsed.set(event.predicate, count + 1);
    }
    
    // Track state changes
    if (event.type === 'state_change') {
      this.stateChanges.push({
        entity: event.subject,
        attribute: event.attribute,
        oldValue: event.oldValue,
        newValue: event.newValue,
        step: event.step,
      });
    }
  }
  
  // Convert to token for slow map
  toToken() {
    // Create a discrete token ID from summary content
    const parts = [
      `E:${this.entitiesMentioned.size}`,
      `P:${Array.from(this.predicatesUsed.keys()).sort().join(',')}`,
      `SC:${this.stateChanges.length}`,
    ];
    return hashString(parts.join('|'));
  }
  
  // Preserve critical arguments (who/what/where)
  getCriticalArguments() {
    return {
      timeRange: this.timeRange,
      entities: Array.from(this.entitiesMentioned),
      mainPredicates: Array.from(this.predicatesUsed.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([p, _]) => p),
      stateChanges: this.stateChanges,
    };
  }
}
```

### 7.3 Slow Map Update Policy

Slow maps are updated **periodically**, not every step:

```javascript
class SlowMapManager {
  constructor(config) {
    this.windowSize = config.windowSize || 20;
    this.currentWindow = null;
    this.stepCounter = 0;
  }
  
  onStep(event, fastMapLocation) {
    if (!this.currentWindow) {
      this.currentWindow = new WindowSummary(this.stepCounter, null);
    }
    
    this.currentWindow.addEvent(event);
    this.stepCounter++;
    
    // Flush window periodically
    if (this.stepCounter % this.windowSize === 0) {
      this.flushWindow(fastMapLocation);
    }
  }
  
  flushWindow(location) {
    if (!this.currentWindow) return;
    
    this.currentWindow.timeRange.end = this.stepCounter;
    const token = this.currentWindow.toToken();
    
    // Write to slow map at current location
    this.slowMap.update(location.x, location.y, token);
    
    // Store summary for retrieval
    this.summaryStore.set(token, this.currentWindow);
    
    // Start new window
    this.currentWindow = new WindowSummary(this.stepCounter, null);
  }
}
```

### 7.4 Critical Insight: What Summaries Must Preserve

From experiments, summaries that discard **who/what/where** cannot support localization or verification. The minimum preserved information is:

| Must Preserve | Why |
|---------------|-----|
| Entity IDs | Required for coreference resolution |
| State changes | Required for state reconstruction |
| Main predicates | Required for fact matching |
| Time range | Required for temporal queries |

### 7.5 Checkpointing: Bounding Replay Cost

Replay is how the system reconstructs state at time `t` from an addressable location plus the event stream. Checkpoints bound replay latency.

**Baseline:** fixed-interval checkpoints (e.g., every 100 steps).

**Recommended:** adaptive checkpointing with a min/max interval and event/metric triggers:

- **Scene reset detected** → checkpoint immediately (context boundary).
- **New entity introduced** → checkpoint (coreference anchor changes).
- **Prediction error spike** → checkpoint (avoids long unstable replay).
- **Low localization confidence** (`top1Confidence` below threshold) → checkpoint (preserve ambiguity boundary).
- **Verifier conflict** → checkpoint (isolate and audit conflict windows).

```javascript
function shouldCheckpoint(step, lastCheckpointStep, event, metrics, config) {
  const since = step - lastCheckpointStep;
  if (since < config.minInterval) return false;
  if (since >= config.maxInterval) return true;

  if (event?.type === 'scene_reset') return true;
  if (event?.type === 'entity_introduced') return true;

  if ((metrics.predictionErrorMA ?? 0) > (config.errorMAThreshold ?? 0.5)) return true;
  if ((metrics.top1Confidence ?? 1) < (config.confidenceThreshold ?? 0.3)) return true;
  if (metrics.verifierConflict === true) return true;

  return false;
}
```

### 7.6 Slow Maps for Coarse-to-Fine Localization (Optional)

Slow maps can be used as a **coarse localization stage** when:
- fast-map localization is highly ambiguous (many near-tied candidates), or
- narratives are long enough that fast maps saturate and candidate sets grow.

Specification:
- Each column may maintain a **separate `LocationIndex` for slow maps** that indexes `summaryTokenId`s (the output of `WindowSummary.toToken()`).
- Coarse-to-fine workflow:
  1. Use the slow-map index to propose coarse candidate locations (and thus coarse time ranges via stored summaries).
  2. Refine within those candidate regions using fast-map localization on `stepTokenId`s.

This keeps the “address search” CPU-friendly while preserving auditability: coarse candidates are tied to explicit summary windows, and fine candidates are verified by trajectory replay (see §5.4).

---

## 8. Multi-Column Architecture

### 8.1 Column Configuration

Each column has independent:
- Displacement seed (different trajectories)
- Initial location offset
- Optionally: different grid sizes or heavy-hitter K values

```javascript
const defaultColumnConfigs = [
  { seed: 0,     offset: { x: 0, y: 0 },   name: 'primary' },
  { seed: 12345, offset: { x: 16, y: 8 },  name: 'alt1' },
  { seed: 67890, offset: { x: 8, y: 24 },  name: 'alt2' },
  { seed: 11111, offset: { x: 32, y: 32 }, name: 'alt3' },
];
```

### 8.2 Consensus Mechanism

#### Simple Majority Vote (Recommended for Start)

```javascript
function majorityVote(predictions) {
  // predictions: array of { columnId, tokenId, score }
  const votes = new Map(); // tokenId → total score
  
  for (const pred of predictions) {
    const current = votes.get(pred.tokenId) || 0;
    votes.set(pred.tokenId, current + pred.score);
  }
  
  // Find winner
  let winner = null;
  let maxScore = -1;
  for (const [tokenId, score] of votes) {
    if (score > maxScore) {
      maxScore = score;
      winner = tokenId;
    }
  }
  
  // Compute confidence: winner score / total score
  const totalScore = Array.from(votes.values()).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? maxScore / totalScore : 0;
  
  return { winner, confidence, votes };
}
```

#### Weighted Vote (After Baseline Works)

Weights based on recent prediction accuracy and localization confidence:

```javascript
class WeightedVoter {
  constructor(numColumns, config = {}) {
    this.weights = new Array(numColumns).fill(1.0);
    this.accuracyHistory = new Array(numColumns).fill(null).map(() => []);
    this.localizationConfidenceMA = new Array(numColumns).fill(1.0);
    this.historyLength = 100;
    this.alpha = config.alpha ?? 0.1; // EMA factor for confidence
  }
  
  recordOutcome(columnId, predicted, actual, localizationConfidence = 1.0) {
    const correct = predicted === actual ? 1 : 0;
    this.accuracyHistory[columnId].push(correct);
    if (this.accuracyHistory[columnId].length > this.historyLength) {
      this.accuracyHistory[columnId].shift();
    }
    this.localizationConfidenceMA[columnId] =
      (1 - this.alpha) * this.localizationConfidenceMA[columnId] +
      this.alpha * Math.max(0, Math.min(1, localizationConfidence));
    this.updateWeight(columnId);
  }
  
  updateWeight(columnId) {
    const history = this.accuracyHistory[columnId];
    if (history.length < 10) return;
    const accuracy = history.reduce((a, b) => a + b, 0) / history.length;
    const conf = this.localizationConfidenceMA[columnId];
    const raw = (0.5 + accuracy) * (0.5 + conf);
    this.weights[columnId] = Math.max(0.25, Math.min(2.0, raw));
  }
  
  vote(predictions) {
    const votes = new Map();
    for (const pred of predictions) {
      const weight = this.weights[pred.columnId];
      const current = votes.get(pred.tokenId) || 0;
      votes.set(pred.tokenId, current + pred.score * weight);
    }
    // ... same winner selection as majority vote
  }
}
```

### 8.3 When Columns Disagree

If consensus confidence is low (< 0.5), maintain **multiple hypotheses**:

```javascript
function getHypotheses(votes, minConfidence = 0.2) {
  const total = Array.from(votes.values()).reduce((a, b) => a + b, 0);
  return Array.from(votes.entries())
    .map(([tokenId, score]) => ({ tokenId, confidence: score / total }))
    .filter(h => h.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence);
}
```

### 8.4 Meta-Controller Regimes (Regime Selection)

The Meta-Controller (`selectRegime(metrics)`) chooses an operating regime that configures:
- which maps are **active** for write/predict (fast, slow, both)
- checkpoint policy (`fixed` vs `adaptive`, min/max intervals)
- localization budget (e.g., `topK`, `verifyTopK`, slow-first vs fast-only)
- whether writes are enabled (learning) or frozen (inference)

Example baseline regimes:

```javascript
const regimes = {
  fast_learning: {
    writeMaps: ['fast'],
    checkpoint: { policy: 'adaptive', minInterval: 20, maxInterval: 100 },
    localization: { topK: 20, verifyTopK: 10, useSlowStage: false },
  },
  consolidation: {
    writeMaps: ['fast', 'slow'],
    checkpoint: { policy: 'adaptive', minInterval: 50, maxInterval: 200 },
    localization: { topK: 50, verifyTopK: 20, useSlowStage: true },
  },
  inference: {
    writeMaps: [],
    checkpoint: { policy: 'fixed', interval: 0 },
    localization: { topK: 50, verifyTopK: 30, useSlowStage: true },
  },
};
```

Recommended trigger heuristics (all auditable):
- If `predictionErrorMA` spikes → switch to `fast_learning`.
- If `cellSaturation` rises persistently → switch to `consolidation` and/or increase grid size.
- If `top1Confidence` is low or ambiguity persists → increase localization budget and enable `useSlowStage`.
- If answering queries without new ingestion → prefer `inference` (freeze writes).

---

## 9. Verifiable RAG: The Anti-Hallucination Pipeline

### 9.1 Design Principle

The LLM is used **only as a structured extractor** (parser). The discrete system performs grounding and reasoning. The LLM is not the source of truth.

#### Extraction Consistency and Determinism (Evaluation Requirement)

LLM extraction must be treated as a noisy front-end. For Exp3, require:

- **Fixed predicate vocabulary**: unknown predicates are rejected (see §9.4).
- **Deterministic settings** when possible: `temperature = 0`, fixed model version, and provider `seed` if available.
- **Consistency check**: run extraction `R` times on the same chunk and compute overlap of normalized facts. If average Jaccard similarity < 0.8, treat extraction as unreliable and fall back to (a) manual facts for the evaluation suite or (b) human-validated gold facts.

### 9.2 Fact Extraction Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Chunk     │ ──▶ │  LLM        │ ──▶ │  Validator  │
│   (text)    │     │  Extractor  │     │  (schema +  │
│             │     │  (JSON out) │     │   span)     │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  FactStore  │
                                        │  (indexed)  │
                                        └─────────────┘
```

#### 9.2.1 Extractor Prompt Template (JSON-Only)

The extractor must return **valid JSON only** (no Markdown, no prose). The preferred response is a JSON array of fact objects:

```json
[
  {
    "span": { "start": 0, "end": 42 },
    "subject": "session_token",
    "predicate": "expires_after",
    "object": "15 minutes",
    "qualifiers": { "version": "2.0" },
    "polarity": "affirm",
    "confidence": 0.9,
    "source": { "docId": "spec-auth-v2", "chunkId": "c001" }
  }
]
```

Prompt requirements:
- Provide the **predicate vocabulary** (allowed predicates + argument slots).
- Require `span.start/end` as **character offsets into the exact chunk string**.
- Require stable settings: `temperature=0` and fixed `seed` if available.
- If the chunk contains negation, require `polarity: "negate"`.

#### 9.2.2 Response Parsing and Fallbacks

The parser/validator must be robust to extractor failures:

1. Parse as JSON (`JSON.parse`).
2. If parsing fails, attempt to extract the first top-level JSON array/object substring.
3. Validate schema + span plausibility; reject unknown predicates.
4. On failure, either:
   - retry once with a stricter prompt (“return JSON only”), or
   - mark the chunk as extraction-failed (do not ingest unvalidated facts).

### 9.3 Fact Schema (Mandatory Fields)

Mandatory fields:
- `span`: `{ start, end }` character offsets into the source chunk
- `subject`: canonical entity string
- `predicate`: a value from the fixed predicate vocabulary
- `object`: value (usually a string; may be a number/boolean when appropriate)
- `source`: `{ docId, chunkId }`

Optional but recommended:
- `qualifiers`: key/value qualifiers (e.g., `{ version, time, condition }`)
- `polarity`: `"affirm"` or `"negate"`
- `confidence`: a score in `[0, 1]`

Example fact:

```json
{
  "span": { "start": 120, "end": 182 },
  "subject": "session_key",
  "predicate": "expires_after_inactivity",
  "object": "10min",
  "qualifiers": { "version": "v2.1" },
  "polarity": "affirm",
  "confidence": 0.82,
  "source": { "docId": "spec-21", "chunkId": "c017" }
}
```

### 9.4 Predicate Vocabulary

**Critical**: Define a fixed predicate vocabulary for the domain. This prevents LLM from inventing inconsistent predicates.

```javascript
// Example for a technical documentation domain
const predicateVocabulary = {
  // Temporal
  'expires_after': { args: ['entity', 'duration'] },
  'valid_for': { args: ['entity', 'duration'] },
  'created_at': { args: ['entity', 'timestamp'] },
  
  // Relational
  'requires': { args: ['entity', 'entity'] },
  'contains': { args: ['entity', 'entity'] },
  'part_of': { args: ['entity', 'entity'] },
  
  // Properties
  'has_value': { args: ['entity', 'value'] },
  'has_type': { args: ['entity', 'type'] },
  'has_status': { args: ['entity', 'status'] },
  
  // Actions
  'stores_in': { args: ['entity', 'location'] },
  'encrypts_with': { args: ['entity', 'algorithm'] },
};
```

### 9.5 Span Validation

The validator checks that the span actually contains key elements:

```javascript
function validateSpan(fact, sourceText) {
  const spanText = sourceText.slice(fact.span.start, fact.span.end);
  const errors = [];
  
  // Check subject appears in span (or close variant)
  if (!spanContains(spanText, fact.subject)) {
    errors.push(`Subject "${fact.subject}" not found in span`);
  }
  
  // Check object appears in span (especially numbers)
  if (typeof fact.object === 'number' || /^\d/.test(fact.object)) {
    if (!spanContains(spanText, String(fact.object))) {
      errors.push(`Numeric object "${fact.object}" not found in span`);
    }
  }
  
  // Check for negation consistency
  const hasNegation = /\b(not|no|never|without|cannot|don't|doesn't)\b/i.test(spanText);
  if (hasNegation && fact.polarity !== 'negate') {
    errors.push(`Span contains negation but polarity is "${fact.polarity}"`);
  }
  
  return { valid: errors.length === 0, errors };
}
```

### 9.6 Query-Time Reasoning

```
Question → Target Facts → Retrieval → Reasoner → Verdict + Chain
```

The Reasoner attempts to derive the target by chaining over work signatures:

| Condition | Verdict |
|-----------|---------|
| Target derivable from facts | `supported` |
| Negation derivable, or incompatible facts under same qualifiers | `conflicting` |
| Neither derivable | `unsupported` |

### 9.7 Output Contract

Every answer must include:

```javascript
const answerContract = {
  text: 'string|null',           // The answer text, or null if unsupported
  chunks_used: ['string'],       // List of chunk IDs
  fact_chain: [{                 // Reasoning chain
    fact_id: 'string',
    role: 'premise|derived|conclusion',
    fact: 'object',              // The actual fact
  }],
  support_scores: { 'fact_id': 'number' },  // Confidence per fact
  verdict: 'supported|conflicting|unsupported',
  conflicts: [{                  // Only if verdict is 'conflicting'
    fact1: 'object',
    fact2: 'object',
    reason: 'string',
  }],
};
```

If the system cannot produce these artifacts, it is not operationally anti-hallucination.

---

## 10. Diagnostic Metrics

### 10.1 Per-Step Diagnostics

Track these metrics during operation for debugging:

```javascript
const stepDiagnostics = {
  // Grid utilization
  gridUtilization: nonEmptyCells / totalCells,
  cellSaturation: cellsAtFullCapacity / nonEmptyCells,

  // Trajectory quality
  revisitRate: trajectoryStats.revisitRate,
  zeroStepRate: trajectoryStats.zeroStepRate,
  
  // Localization quality
  localizationEntropy: -sum(p * log(p)) for top-K candidates,
  top1Confidence: topCandidate.score / sum(allScores),
  
  // Prediction quality
  predictionError: predicted !== actual ? 1 : 0,
  predictionErrorMA: movingAverage(predictionErrors, 100),
  
  // Column agreement
  columnAgreement: columnsAgreeingWithConsensus / totalColumns,
  
  // Memory
  episodicStoreSize: store.chunkCount,
  checkpointCount: checkpointManager.count,

  // Replay cost (queries)
  avgReplaySteps: replayStats.avgSteps,

  // Extraction quality (Exp3)
  extractionConsistency: extractorStats.jaccardAvg,
};
```

### 10.2 Warning Thresholds

| Metric | Warning Threshold | Action |
|--------|-------------------|--------|
| `cellSaturation` | > 0.8 | Increase grid size |
| `top1Confidence` | < 0.3 | Localization ambiguous, use top-K |
| `predictionErrorMA` | > 0.5 | Learning not working |
| `columnAgreement` | < 0.5 | Columns too divergent |
| `avgReplaySteps` | rising sharply | Tighten checkpoint policy (`maxInterval`), add triggers |
| `extractionConsistency` | < 0.8 | Treat extractor as unreliable; use manual/gold facts |

### 10.3 Failure Handling and Recovery (Deterministic)

When core subsystems fail or become ambiguous, the system should degrade **auditably** (no silent guessing):

- **Localization fails (no candidates):** widen the context window, increase `topK`, enable slow-stage localization (§7.6), or return `unsupported` with diagnostics.
- **Localization ambiguous (low confidence):** keep multiple hypotheses (§8.3) and defer commitment until additional evidence arrives.
- **Checkpoint unavailable/corrupt:** replay from the nearest earlier checkpoint; if none exists, replay from start up to a configured cap; if the cap is exceeded, refuse the query (`unsupported`) rather than returning an unverified answer.
- **Verifier conflict:** emit `conflicting` with the minimal conflicting transition chain and checkpoint near the conflict for auditability.
- **Extractor failure:** do not ingest unvalidated facts; retry once with a stricter JSON-only prompt; otherwise mark the chunk as extraction-failed and exclude it from evidence chains.

---

## 11. Success Criteria

The architecture succeeds if:

1. **Coherence scales**: Long narratives do not cause catastrophic interference
2. **Localization is robust**: Top-K + replay handles repetitive motifs
3. **Verdicts are accurate**: `supported` answers are correct; `unsupported` triggers refusal
4. **Conflicts are detected**: Incompatible facts are surfaced, not silently resolved
5. **Generalization works**: Patterns learned with canonical variables apply to new entities

---

## 12. References

- Hawkins, J., et al. *A Thousand Brains: A New Theory of Intelligence* (2021)
- Kanerva, P. *Hyperdimensional Computing: An Introduction to Computing in Distributed Representation* (2009)
- Project experiments: Internal simulation logs (VSA interference tests, localization under repetition, binding/unbinding OOD tests)
