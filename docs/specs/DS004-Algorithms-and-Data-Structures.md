# DS004 - Core Algorithms and Data Structures

**Status:** Draft  
**Version:** 0.2  
**Last Updated:** 2026-01-26

---

## 1. Scope

This specification defines the **core discrete runtime** of VSABrains: how steps are represented, written into `GridMap`s, localized, replayed, and verified.

Out of scope (documented separately):
- Text ingestion and verifiable RAG integration (DS005)
- High-level architectural rationale (DS001)
- Concrete module breakdown and implementation sequencing (DS002)
- Experiment definitions and metrics (DS003)

---

## 2. Core Happy Path (Runtime)

The system is designed around a deterministic **step clock**.

### 2.1 Step Ingestion (per step)

1. Normalize input into a `StepInput` (see §3.2).
2. `Column.stepWrite(stepInput)`:
   - write `writeTokenIds` into the current cell
   - update `LocationIndex` for `stepTokenId`
   - append the event to the episodic store (optional; depends on experiment)
3. Compute displacement from the column’s displacement buffer (see §5).
4. `Column.stepMove({ dx, dy })` (wrap-around “Pac-Man style”; see [DS001 Glossary](DS001-Vision.md#4-glossary)).
5. Update diagnostics counters (see §11).

### 2.2 Query-Time (high level)

1. `Localizer.localize(windowStepTokenIds)` returns candidate locations (see §6).
2. Candidates are optionally **verified by replay** (`Verifier` + `Replayer`) before answering.
3. The system returns an explicit verdict: `supported`, `conflicting`, or `unsupported` (see DS005 for the full answer contract).

---

## 3. Data Model and Terminology

### 3.1 Tokens

- `tokenId` is the generic discrete symbol ID used everywhere.
- `stepTokenId` is the **primary** token ID for the step (used for displacement and localization indexing).
- `writeTokenIds` are the **auxiliary** token IDs written into the current cell for later retrieval/reasoning.

This distinction keeps indexing and displacement bounded while still allowing richer writes per step.

### 3.2 Step Input

```javascript
/**
 * @typedef {number} TokenId
 * @typedef {number} Step
 *
 * @typedef {{ x: number, y: number }} Location
 * @typedef {number} LocKey
 *
 * @typedef {{
 *   stepTokenId: TokenId,
 *   writeTokenIds: TokenId[],
 *   event?: object,
 * }} StepInput
 */
```

Normalization rules (baseline):
- If input is `tokenId: number` → `stepTokenId = tokenId`, `writeTokenIds = [tokenId]`
- If input is `tokenIds: number[]` → `writeTokenIds = tokenIds`, `stepTokenId = hashCombineU32(writeTokenIds)`
- If input is `{ stepTokenId, writeTokenIds }` → use as-is

### 3.3 Location Keys (`locKey`)

For fast equality checks, locations are represented as a packed 32-bit `locKey`:

```javascript
export function packLocKey(x, y) {
  return (((x & 0xffff) << 16) | (y & 0xffff)) >>> 0;
}

export function unpackLocKey(locKey) {
  return { x: locKey >>> 16, y: locKey & 0xffff };
}
```

Constraint: this packing assumes `0 <= x,y < 65536` (true for typical grid sizes).

### 3.4 Localization Candidate Shape

```javascript
/**
 * @typedef {{
 *   columnId: string,
 *   locKey: LocKey,
 *   location: Location,
 *   score: number,          // match ratio in [0, 1]
 *   matches?: number,       // number of tokens matched
 *   lastSeenMax?: Step,     // max recency among matched tokens
 *   verifiedScore?: number, // optional replay-based score
 * }} LocalizationCandidate
 */
```

---

## 4. GridMap and Heavy-Hitters Cells

A `GridMap` is a 2D grid (dense array or sparse hash-grid). Each cell stores a bounded **heavy-hitters** summary (see [DS001 Glossary](DS001-Vision.md#4-glossary)):
- Keep only the top-K token IDs by frequency (optionally with recency tie-breakers).
- Reads are deterministic and auditable: `readTopK(x, y, k)` returns a ranked list.

Required operations (conceptual contract):
- `update(x, y, tokenId, step)` → write one token into one cell
- `readTopK(x, y, k)` → `Array<[tokenId, count]>`
- `stats()` → utilization and saturation metrics

Saturation monitoring (recommended):
- `cellSaturation = cellsAtFullCapacity / nonEmptyCells`
- If `cellSaturation > 0.8`, increase grid size or reduce write rate.

---

## 5. Displacement (Order as Address)

Displacement turns a short history of `stepTokenId`s into a bounded `(dx, dy)` move.

### 5.1 Displacement Encoder (per column)

Each column owns a displacement context buffer:
- stores the last `contextLength` **step tokens**
- updated once per step after input normalization

### 5.2 Deterministic Displacement Function

```javascript
function computeDisplacement(recentStepTokenIds, config) {
  const contextLength = config.contextLength ?? 2;
  const maxStep = config.maxStep ?? 3;
  const seed = config.seed ?? 0;

  const recent = recentStepTokenIds.slice(-contextLength);
  const combined = hashCombineU32(recent, seed);
  const h = murmurHash32(combined, seed);

  let dx = (h % (2 * maxStep + 1)) - maxStep;
  let dy = ((h >>> 16) % (2 * maxStep + 1)) - maxStep;

  if (config.avoidZeroStep && dx === 0 && dy === 0) {
    const dir = (h >>> 24) & 3;
    if (dir === 0) dx = 1;
    else if (dir === 1) dx = -1;
    else if (dir === 2) dy = 1;
    else dy = -1;
  }

  return { dx, dy };
}
```

Wrapping (toroidal topology; see [DS001 Glossary](DS001-Vision.md#4-glossary)) is recommended:

```javascript
function wrap(n, size) {
  return ((n % size) + size) % size;
}
```

---

## 6. Localization (Top-K Frame Alignment)

Localization answers: “Given the recent window of step tokens, what are the most likely current locations?”

### 6.1 LocationIndex

Maintain an inverted index **per column**:

- `stepTokenId → Map<locKey, { count, lastSeen }>`

This index is updated during `Column.stepWrite()` for the `stepTokenId` only.

### 6.2 Baseline Localization Algorithm

Inputs:
- `windowStepTokenIds: TokenId[]`
- `candidatesPerToken` (bounded)
- `topK`

Algorithm sketch:
1. Get bounded candidate lists for each token from `LocationIndex`.
2. Anchor on the rarest token (smallest candidate list).
3. Intersect by `locKey` (anchor-based) and accumulate match counts.
4. Rank by `(matchRatio desc, lastSeenMax desc)`.
5. Return top-K `LocalizationCandidate`s.

### 6.3 Optional Verification by Replay

For each candidate location:
- Replay displacement over the same `windowStepTokenIds`
- At each visited cell, check whether the expected token exists in `GridMap.readTopK(...)`
- Accumulate a deterministic `verifiedScore`

Candidates can then be re-ranked by `verifiedScore` (or combined with the index score).

---

## 7. Replay and Checkpointing

Replay reconstructs state by applying events from an earlier checkpoint up to a target step.

### 7.1 What a Checkpoint Must Contain

Checkpoints must capture **minimal state needed to resume deterministically**. A recommended schema:

```javascript
const checkpointSchema = {
  step: 123,
  columns: [
    {
      id: 'primary',
      location: { x: 10, y: 22 },
      displacementBuffer: [111, 222], // last N stepTokenIds (contextLength)
    },
  ],

  // Optional, experiment-dependent:
  workpad: { bindings: [['?x', 'S:Alice']] },
  corefState: { lastEntityId: 'S:Alice' },
};
```

**Explicit non-goal:** serializing full `GridMap`s inside checkpoints (too large). Grid content is either:
- kept in-memory (online), or
- reconstructed by replay from the episodic store when needed.

### 7.2 When to Checkpoint

Baseline policies:
- fixed interval (e.g., every 100 steps), or
- adaptive triggers (scene reset, new entity introduced, prediction error spike, verifier conflict)

---

## 8. Reasoning Primitives (Work Signatures)

For auditable reasoning, VSABrains uses explicit structural bindings rather than vector superposition.

- `WorkSignature`: a role→value map (see [DS001 Glossary](DS001-Vision.md#4-glossary)).
- Pattern matching binds variables to constants.
- `Workpad` stores variable bindings and supports backtracking.

These primitives are intentionally deterministic and inspectable.

---

## 9. Multi-Timescale Memory (Slow Maps)

Slow maps store coarser summaries at a lower write frequency to mitigate fast-map saturation.

Minimal requirements for summaries:
- time range
- entity IDs
- key predicates / state changes

Summaries can be tokenized into a `summaryTokenId` (via hashing) and written into a slow map, while also storing a structured summary object for audit/replay.

---

## 10. Multi-Column Consensus and Regimes

Columns differ by:
- displacement seed
- initial location offset
- optional grid sizes / K values

Consensus (baseline):
- majority vote over per-column predictions
- confidence = winnerScore / totalScore

Regime selection (meta-controller) uses auditable triggers:
- prediction error MA spikes → switch to learning
- persistent saturation → consolidation (enable slow maps / increase capacity)
- low localization confidence → increase localization budget / keep multiple hypotheses

---

## 11. Diagnostics and Deterministic Failure Handling

Track (recommended):
- grid utilization, cell saturation
- revisit rate / zero-step rate
- localization entropy and top-1 confidence
- prediction error MA
- column agreement
- replay cost (avg replay steps)

When ambiguous or failing, degrade **auditably**:
- no candidates → widen window / increase topK / return `unsupported`
- low confidence → keep multiple hypotheses
- checkpoint missing → replay from earlier checkpoint; cap replay; otherwise refuse
- verifier conflict → return `conflicting` with minimal conflict chain
