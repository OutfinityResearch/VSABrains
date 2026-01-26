# AGENTS.md - Project Guidelines for AI Assistants

## Language Policy

- **All generated code, documentation, specifications, and comments must be written in English.**
- **Discussions and conversations with the user may be conducted in Romanian** (or any language the user prefers).
- This ensures the codebase remains accessible to international contributors while allowing natural communication.

## Project Overview

VSABrains is an experimental project implementing a discrete, CPU-first learning architecture inspired by *A Thousand Brains* (Hawkins et al.). The system aims to demonstrate that robust intelligence can emerge from parallel models operating in reference frames, achieving consensus through voting mechanisms.

## Core Principles

1. **Order as Address, Not Superposition**: Temporal order is encoded as location/address in memory, not as superposed content. This avoids the "muddiness" problem of global superposition schemes.

2. **Multi-Column Consensus**: Multiple parallel columns provide redundancy and multi-hypothesis tracking. Consensus is achieved through weighted voting.

3. **Addressable Memory**: Events are written along trajectories in discrete maps. Retrieval is deterministic and auditable.

4. **Verifiable Reasoning**: Any emitted proposition must be traceable to source facts. The system outputs explicit verdicts: `supported`, `conflicting`, or `unsupported`.

## Directory Structure

```
src/           - Core implementation (ES modules, .mjs files with async/await)
test/          - Unit tests
eval/          - Evaluation suites for the three main experiments
docs/          - Documentation
docs/specs/    - Design specifications (DS001, DS002, DS003, ...)
```

## Coding Standards

- Use ES modules (`.mjs` extension)
- Use `async/await` for asynchronous operations
- Prefer functional patterns where appropriate
- All public APIs must be documented with JSDoc comments
- Unit tests required for all core components

## Key Experiments

1. **Reference-Frame Alignment & Consensus** - Validates multi-column localization under ambiguity
2. **Narrative Coherence** - Tests long-horizon state tracking without representational collapse
3. **Grounded RAG** - Verifiable retrieval-augmented generation with explicit evidence chains

## When Making Changes

- Consult `docs/specs/DS001-Vision.md` for architectural rationale
- Consult `docs/specs/DS004-Algorithms-and-Data-Structures.md` for concrete algorithm/data-structure specifications
- Follow the implementation plan in `docs/specs/DS002-Plan.md`
- Ensure changes don't break evaluation criteria in `docs/specs/DS003-Eval.md`
