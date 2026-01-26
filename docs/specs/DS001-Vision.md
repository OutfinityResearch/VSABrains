# DS001 - Vision: Discrete CPU-First Learning Architecture

**Status:** Draft  
**Version:** 0.5  
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


### 3.2 Where the Detailed Specs Live

To keep specs smaller and easier to implement, detailed specifications are split into:

- [DS004 - Core Algorithms and Data Structures](DS004-Algorithms-and-Data-Structures.md): the discrete runtime (steps, `GridMap`s, displacement, localization, replay/checkpoints, reasoning primitives, diagnostics).
- [DS005 - Integrations and Non-Core Implementation](DS005-Integrations-and-Non-Core.md): text ingestion, LLM-backed extraction, fact validation, and the verifiable answer contract.
- [DS000 - Glossary](DS000-Glossary.md): shared terminology used across DS001–DS005.

## 4. Success Criteria

The architecture succeeds if:

1. **Coherence scales**: Long narratives do not cause catastrophic interference
2. **Localization is robust**: Top-K + replay handles repetitive motifs
3. **Verdicts are accurate**: `supported` answers are correct; `unsupported` triggers refusal
4. **Conflicts are detected**: Incompatible facts are surfaced, not silently resolved
5. **Generalization works**: Patterns learned with canonical variables apply to new entities

---

## 5. References

- Hawkins, J., et al. *A Thousand Brains: A New Theory of Intelligence* (2021)
- Kanerva, P. *Hyperdimensional Computing: An Introduction to Computing in Distributed Representation* (2009)
- Project experiments: Internal simulation logs (VSA interference tests, localization under repetition, binding/unbinding OOD tests)
