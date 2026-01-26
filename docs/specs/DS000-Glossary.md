# DS000 - Glossary

**Status:** Draft  
**Version:** 0.1  
**Last Updated:** 2026-01-26

---

This glossary defines project terms used across the design specifications.

---

## Core Terms

### Token ID (`tokenId`)

A deterministic integer used to represent a discrete symbol (word token, entity ID, predicate ID, summary token, etc.).

### Step Token ID (`stepTokenId`)

The primary `tokenId` for a step. It drives:
- displacement (movement)
- localization indexing (`LocationIndex`)

### Write Tokens (`writeTokenIds`)

Zero or more auxiliary `tokenId`s written into the current grid cell for later retrieval/reasoning.

### Location Key (`locKey`)

A packed 32-bit integer derived from `(x, y)` grid coordinates for fast equality checks.

---

## Algorithms and Concepts

### Heavy-Hitters

A streaming algorithm that keeps an approximate (or exact, depending on implementation) **top-K** set of most frequent items seen so far, using bounded memory.

In VSABrains, each grid cell maintains a heavy-hitters summary of token IDs to prevent local “muddiness” (cell saturation).

### Toroidal Topology (“Pac-Man wrap”)

A grid topology where moving past an edge wraps around to the opposite edge:
- `x = wrap(x + dx, width)`
- `y = wrap(y + dy, height)`

This avoids edge effects and keeps movement rules uniform.

### Coreference Resolution

Resolving references like pronouns (“he”, “she”, “it”) or aliases back to the entity they refer to.

In Exp2, this typically means tracking the most recently mentioned entity so “he” can be mapped to the correct subject.

### Work Signature

An explicit role→value map used for auditable reasoning.

Analogy: a JavaScript `Map` (or plain object) that binds roles like `subject`, `predicate`, `object` to concrete values, optionally including variables for pattern matching.

