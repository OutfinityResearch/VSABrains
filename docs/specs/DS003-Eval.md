# DS003 - Evaluation Framework

**Status:** Draft  
**Version:** 0.2  
**Last Updated:** 2026-01-26

---

## 1. Overview

This document describes the three evaluation suites (experiments) used to validate the VSABrains architecture. Each experiment targets a specific hypothesis from the project vision and provides quantitative metrics for success.

The evaluation framework lives in `eval/` with the following structure:

```
eval/
├── common/
│   ├── DataGenerator.mjs    # Synthetic data generation utilities
│   ├── Metrics.mjs          # Metric computation library
│   └── Reporter.mjs         # Results reporting and export
├── exp1-alignment/          # Experiment 1: Reference-Frame Alignment
├── exp2-narrative/          # Experiment 2: Narrative Coherence  
└── exp3-rag/                # Experiment 3: Grounded RAG
```

---

## 2. Experiment 1: Reference-Frame Alignment and Consensus

### 2.1 Hypothesis

**H1**: When the same latent situation is observed through different partial views and offsets, multiple columns can independently infer consistent internal frames and converge via consensus, yielding robust identification and prediction under noise and ambiguity.

### 2.2 Objective

Validate that the multi-column architecture with localization produces better frame alignment than any single column, especially under:
- Partial observability
- Offset variations between columns
- Noise in observations
- Ambiguous contexts (multiple valid interpretations)

### 2.3 Test Scenarios

#### Scenario A: Clean Alignment
- Generate sequences with unique patterns
- All columns observe the same sequence with different offsets
- Measure localization accuracy

#### Scenario B: Partial Observability
- Each column receives only a subset of tokens (e.g., 70%)
- Different columns miss different tokens
- Measure consensus recovery

#### Scenario C: Noise Injection
- Add random token substitutions (5%, 10%, 20% noise)
- Measure degradation curves

#### Scenario D: Ambiguous Contexts
- Design sequences where short windows match multiple locations
- Measure top-K localization precision
- Measure consensus disambiguation rate

### 2.4 Data Generation

```javascript
// eval/exp1-alignment/scenarios.mjs

export function generateCleanSequence(length, vocabSize) {
  // Returns: { tokens: [...], groundTruth: { locations: [...] } }
}

export function generatePartialViews(sequence, numColumns, dropRate) {
  // Returns: { views: [[...], [...]], dropMasks: [[...], [...]] }
}

export function injectNoise(tokens, noiseRate, vocabSize) {
  // Returns: { noisyTokens: [...], noisePositions: [...] }
}

export function generateAmbiguousSequence(length, motifLength, numMotifs) {
  // Creates sequences with repeated motifs that create localization ambiguity
  // Returns: { tokens: [...], motifPositions: {...} }
}
```

### 2.5 Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| **Loc@1** | Top-1 localization accuracy | > 85% (clean) |
| **Loc@K** | Correct location in top-K candidates | > 95% (K=5) |
| **Consensus Gain** | Consensus accuracy minus best single column | > 5% |
| **Noise Robustness** | Accuracy at 10% noise / accuracy at 0% | > 0.9 |
| **Recovery Rate** | Correct recovery after perturbation | > 80% |
| **Avg Candidates/Token** | Mean candidate locations per window token | <= 50 (by config) |
| **Cell Saturation** | Cells at heavy-hitters capacity / non-empty cells | < 0.8 (clean) |

### 2.5.1 Go/No-Go Gate (Smoke Test)

Before running the full Exp1 suite, run a small clean scenario and require:

- **Loc@5 ≥ 70%** on clean sequences (window=5, no noise).
- **No capacity collapse**: `cellSaturation` stays below 0.8.

Recommended smoke configuration (baseline):

```javascript
const smokeConfig = {
  windowSize: 5,
  vocabSize: 100,
  seqLength: 200,
  noiseRate: 0,
  numTrials: 10,
  brainConfig: {
    numColumns: 1,
    gridSize: 64,
    k: 4,
    displacement: { contextLength: 2, maxStep: 3, seed: 0 },
  },
};
```

If the smoke test fails, treat the issue as foundational (displacement, indexing, or replay verification) rather than “tuning”.

### 2.6 Implementation

```javascript
// eval/exp1-alignment/run.mjs

import { VSABrains } from '../../src/index.mjs';
import { generateCleanSequence, generateAmbiguousSequence } from './scenarios.mjs';
import { Metrics } from '../common/Metrics.mjs';
import { Reporter } from '../common/Reporter.mjs';

export async function runExperiment1(config = {}) {
  const results = {
    scenarioA: await runScenarioA(config),
    scenarioB: await runScenarioB(config),
    scenarioC: await runScenarioC(config),
    scenarioD: await runScenarioD(config),
  };
  
  return Reporter.summarize('exp1-alignment', results);
}

async function runScenarioA(config) {
  const testCases = [];

  function packLocKey(x, y) {
    return (((x & 0xffff) << 16) | (y & 0xffff)) >>> 0;
  }
  
  for (let i = 0; i < config.numTrials; i++) {
    // Baseline localization metrics are computed for a single column.
    const brain = new VSABrains({ ...config.brainConfig, numColumns: 1 });
    const writeLocKeys = [];

    const seq = generateCleanSequence(config.seqLength, config.vocabSize);
    
    // Train
    for (const token of seq.tokens) {
      // Record the write location (location before stepMove).
      const { x, y } = brain.getState().columns[0].location;
      writeLocKeys.push(packLocKey(x, y));
      await brain.step(token);
    }
    
    // Test localization
    const windowSize = config.windowSize || 5;
    for (let pos = windowSize; pos < seq.tokens.length; pos++) {
      const window = seq.tokens.slice(pos - windowSize, pos);
      const candidates = await brain.localize(window);
      
      testCases.push({
        // Compare packed locKeys for deterministic equality.
        groundTruth: writeLocKeys[pos - 1],
        top1: candidates[0]?.locKey,
        topK: candidates.slice(0, 5).map(c => c.locKey),
        scores: candidates.slice(0, 5).map(c => c.score),
      });
    }
  }
  
  return Metrics.computeLocalization(testCases);
}
```

### 2.7 Success Criteria

The experiment succeeds if:

- [ ] Top-1 localization accuracy > 85% on clean sequences
- [ ] Top-5 localization accuracy > 95% on clean sequences
- [ ] Consensus accuracy exceeds best single column by at least 5%
- [ ] Accuracy at 10% noise is at least 90% of clean accuracy
- [ ] Under ambiguous contexts, consensus correctly disambiguates > 70% of cases

---

## 3. Experiment 2: Narrative Coherence (State Tracking)

### 3.1 Hypothesis

**H2**: Representing temporal order as addressable state (location plus displacement) and preserving raw episodes in an indexed store prevents the catastrophic interference typical of global superposition schemes. As narrative length grows, performance should degrade slowly and controllably.

### 3.2 Objective

Validate that the system maintains coherent state tracking over long sequences with:
- Entity state changes
- Coreference (pronouns referring to previous entities; see [DS001 Glossary](DS001-Vision.md#4-glossary))
- Scene resets (context changes)
- Repetitive motifs (creating localization challenges)

### 3.2.1 Recommended Phased Baselines

To de-risk the architecture, evaluate Exp2 in phases:

1. **Baseline (no coreference):** `corefRate = 0`, `resetRate = 0`, low motif repetition.
2. **Motifs first:** introduce repetitive motifs while keeping `corefRate = 0`.
3. **Coreference next:** add pronouns once localization and replay are stable.
4. **Scene resets last:** add explicit reset events and verify checkpoint + replay behavior.

### 3.3 Test Task: Story State Queries

The system processes a "story" - a sequence of events that update entity states. Then it answers queries about entity states at specific times.

Example story:
```
t=1: Alice enters room_A
t=2: Bob enters room_A  
t=3: P picks up key      (P = Bob, last mentioned)
t=4: Alice moves to room_B
t=5: P drops key         (P = Alice)
t=6: [SCENE RESET]
t=7: Carol enters room_C
t=8: P picks up sword    (P = Carol)
```

Query: "What does Alice have at t=5?" → Answer: "key"
Query: "Where is Bob at t=5?" → Answer: "room_A"

### 3.4 Data Generation

```javascript
// eval/exp2-narrative/stories.mjs

export function generateStory(config) {
  // config: { numEntities, numEvents, corefRate, resetRate, motifRate }
  // Returns: {
  //   events: [{ time, subject, action, object, resolvedSubject }],
  //   groundTruth: Map<(entity, time) -> state>,
  //   motifs: [{ start, end, pattern }]
  // }
}

export function generateQueries(story, numQueries) {
  // Returns: [{ time, entity, attribute, expectedAnswer }]
}

export function generateAdversarialQueries(story) {
  // Queries that require precise localization due to motif repetition
  // Returns queries where similar contexts exist at multiple times
}
```

### 3.4.1 Event Encoding (eventToTokens) and Query Encoding

Exp2 evaluates reference-frame memory and replay; it should not depend on a natural-language tokenizer.

Encode each event as:
- `writeTokenIds`: a small bundle of discrete tokens written into the current cell
- `stepTokenId`: a single primary token that drives displacement and localization

If `stepTokenId` is not provided explicitly, it is derived deterministically as `hashCombineU32(writeTokenIds)` (see DS004 §3.2).

Recommended helpers:

```javascript
// eval/exp2-narrative/encoding.mjs

import { Vocabulary } from '../../src/util/Vocabulary.mjs';
import { hashCombineU32 } from '../../src/util/hash.mjs';

export function makeExp2Vocabulary() {
  return new Vocabulary({ mode: 'dynamic', maxSize: 100000 });
}

export function makeCorefState() {
  return { lastEntityId: null };
}

function resolveSubjectEntityId(event, corefState) {
  if (event.subject !== 'P') return event.subject;
  // Prefer generator-provided resolution, otherwise fall back to the running coref state.
  const resolved = event.resolvedSubject ?? corefState.lastEntityId;
  if (!resolved) {
    throw new Error('Coreference failed: subject="P" but no resolvedSubject and corefState.lastEntityId is null');
  }
  return resolved;
}

export function eventToTokens(event, vocab, corefState) {
  // Keep namespaces explicit to avoid accidental collisions.
  if (event.action === 'SCENE_RESET') {
    corefState.lastEntityId = null;
    return [vocab.id('EV:scene_reset')];
  }

  // Coreference is resolved at encoding time for Exp2.
  const subjectEntityId = resolveSubjectEntityId(event, corefState);
  corefState.lastEntityId = subjectEntityId;

  const subject = vocab.id(`S:${subjectEntityId}`);
  const predicate = vocab.id(`P:${event.action}`);
  const object = event.object == null ? vocab.id('O:∅') : vocab.id(`O:${event.object}`);
  return [subject, predicate, object];
}

export function eventToStepInput(event, vocab, corefState) {
  const writeTokenIds = eventToTokens(event, vocab, corefState);
  const stepTokenId = hashCombineU32(writeTokenIds);
  return { stepTokenId, writeTokenIds, event };
}

export function queryToQuestion(q) {
  // Use a stable, machine-readable string to avoid LLM variability.
  return `STATE? time=${q.time} entity=${q.entity} attribute=${q.attribute}`;
}
```

Coreference resolution for Exp2 is handled at encoding time:
1. `encoding.mjs` maintains a `corefState` with `lastEntityId`.
2. When `event.subject === 'P'`, resolve to `event.resolvedSubject` (preferred) or `corefState.lastEntityId`.
3. After encoding a non-reset event, update `corefState.lastEntityId` to the resolved subject.
4. `SCENE_RESET` clears `corefState.lastEntityId`.
5. Canonical approach: store `resolvedSubject` in the event stream so replay remains deterministic without additional state. Persist `corefState` in checkpoints only for legacy/raw events that do not store resolution.

### 3.5 Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| **Time Loc Accuracy** | Correct time identification from context window | > 80% |
| **State Accuracy** | Correct entity state at queried time | > 85% |
| **Coref Resolution** | Correct pronoun resolution | > 90% |
| **Degradation Rate** | Accuracy loss per 2x story length | < 10% |
| **Motif Handling** | Accuracy under repetitive patterns | > 75% |
| **Conflict Detection** | Detect impossible transitions | > 90% |
| **Grid Utilization** | Non-empty cells / total cells | reported |
| **Cell Saturation** | Cells at heavy-hitters capacity / non-empty cells | < 0.8 |
| **Avg Replay Steps** | Mean replay steps per query | bounded by checkpoint policy |

### 3.5.1 Transition Rules (Verifier)

For Exp2, verifier rules are hardcoded narrative constraints (auditable, domain-specific). Define them explicitly in `eval/exp2-narrative/rules.mjs` and pass them into `Verifier`.

Rule contract (recommended):

```javascript
// Minimal state shape used by Exp2 rules (extend as needed):
// {
//   entities: { [entityId]: { alive?: boolean, location?: string|null, inventory?: string[] } },
//   items?: { [itemId]: { heldBy?: string|null } },
// }
//
// prev/next are state snapshots produced by replay. Keep them explicit and testable.
// Returns: { valid: boolean, reason?: string }
export const ruleContract = {
  name: 'string',
  check(prev, event, next) {
    return { valid: true };
  },
};
```

When rules run (baseline):
- Replay computes `next` from `prev + event`.
- `Verifier` applies all rules to `(prev, event, next)`.
- If any rule returns `{ valid: false }`, the transition is invalid and should be surfaced as a conflict (for Exp2: fail the query or mark the run as inconsistent).

Minimal rule set (recommended):
- **Dead entity cannot act:** if `alive=false`, then `move/pick/drop` is invalid unless the action is `REVIVE`.
- **Unique item ownership:** an item cannot be held by two entities at the same time.
- **Pick/drop consistency:** after `PICK(item)`, item is in subject inventory; after `DROP(item)`, it is not.
- **Scene reset semantics:** `SCENE_RESET` clears coreference state (`lastEntity`) and any short-term workpad variables.

```javascript
// eval/exp2-narrative/rules.mjs

export const transitionRules = [
  {
    name: 'dead_cannot_act',
    check(prev, event, next) {
      const subject = event.resolvedSubject ?? event.subject;
      const alive = prev.entities?.[subject]?.alive ?? true;
      const action = event.action;
      const isAct = ['move', 'pick', 'drop', 'MOVE', 'PICK', 'DROP'].includes(action);
      if (alive === false && isAct && action !== 'REVIVE') {
        return { valid: false, reason: `${subject} is dead and cannot ${action}` };
      }
      return { valid: true };
    },
  },
  { name: 'unique_item_ownership', check(prev, event, next) { return { valid: true }; } },
  { name: 'pick_drop_consistency', check(prev, event, next) { return { valid: true }; } },
  { name: 'scene_reset_clears_coref', check(prev, event, next) { return { valid: true }; } },
];
```

### 3.6 Implementation

```javascript
// eval/exp2-narrative/run.mjs

import { VSABrains } from '../../src/index.mjs';
import { generateStory, generateQueries } from './stories.mjs';
import { makeExp2Vocabulary, makeCorefState, eventToStepInput, queryToQuestion } from './encoding.mjs';
import { Metrics } from '../common/Metrics.mjs';
import { Reporter } from '../common/Reporter.mjs';

export async function runExperiment2(config = {}) {
  const results = {
    baseline: await runLengthSweep(config, [100, 200, 500, 1000, 2000]),
    coref: await runCorefTest(config),
    motifs: await runMotifTest(config),
    compression: await runCompressionSweep(config),
    saturation: await runGridSaturationDiagnostic(config),
    checkpointing: await runCheckpointSweep(config),
  };
  
  return Reporter.summarize('exp2-narrative', results);
}

async function runLengthSweep(config, lengths) {
  const accuracies = [];
  const vocab = makeExp2Vocabulary();
  
  for (const length of lengths) {
    const story = generateStory({ ...config.storyConfig, numEvents: length });
    const queries = generateQueries(story, config.numQueries);
    const corefState = makeCorefState();
    
    const brain = new VSABrains(config.brainConfig);
    
    // Ingest story
    for (const event of story.events) {
      await brain.step(eventToStepInput(event, vocab, corefState));
    }
    
    // Answer queries
    let correct = 0;
    for (const q of queries) {
      const answer = await brain.answer(queryToQuestion(q));
      if (answer.text === q.expectedAnswer) correct++;
    }
    
    accuracies.push({
      length,
      accuracy: correct / queries.length,
    });
  }
  
  return {
    accuracies,
    degradationRate: Metrics.computeDegradationRate(accuracies),
  };
}
```

### 3.7 Analysis: Compression Impact

A key insight from the architecture is that summaries must preserve critical arguments. This experiment includes a compression sweep:

```javascript
async function runCompressionSweep(config) {
  const compressionLevels = [1.0, 0.8, 0.6, 0.4, 0.2]; // 1.0 = no compression
  const results = [];
  
  for (const level of compressionLevels) {
    const brain = new VSABrains({
      ...config.brainConfig,
      summaryCompression: level,
    });
    
    // ... run evaluation ...
    
    results.push({ compressionLevel: level, accuracy });
  }
  
  // Find threshold where accuracy drops significantly
  const threshold = Metrics.findCompressionThreshold(results);
  return { results, threshold };
}
```

### 3.7.1 Analysis: Grid Saturation Diagnostic

Heavy-hitters truncation is the primary failure mode when too many distinct tokens collide into the same cells. Track utilization and saturation as story length grows, and sweep grid sizes when needed.

```javascript
async function runGridSaturationDiagnostic(config) {
  // Example: evaluate multiple grid sizes to detect saturation cliffs.
  const gridSizes = config.gridSizes || [64, 128, 256];
  const results = [];

  for (const size of gridSizes) {
    const brain = new VSABrains({
      ...config.brainConfig,
      mapConfig: { ...(config.brainConfig?.mapConfig || {}), width: size, height: size },
    });

    // ... ingest story, then collect diagnostic aggregates ...
    // Expected: { gridUtilization, cellSaturation, cellsAtFullCapacity, nonEmptyCells }
    results.push({ gridSize: size, diagnostics: await brain.getDiagnostics?.() });
  }

  return { results };
}
```

### 3.7.2 Analysis: Checkpoint Policy Sweep

Checkpointing trades memory overhead for bounded replay latency. Compare fixed-interval vs adaptive policies using replay-cost metrics.

```javascript
async function runCheckpointSweep(config) {
  const policies = [
    { policy: 'fixed', interval: 100 },
    { policy: 'adaptive', minInterval: 20, maxInterval: 200 },
  ];
  const results = [];

  for (const cp of policies) {
    const brain = new VSABrains({
      ...config.brainConfig,
      checkpoint: cp,
    });

    // ... ingest story, answer queries, collect avg/p95 replay steps and checkpoint count ...
    results.push({ checkpoint: cp, replay: await brain.getReplayStats?.(), checkpoints: await brain.getCheckpointStats?.() });
  }

  return { results };
}
```

### 3.8 Success Criteria

The experiment succeeds if:

- [ ] State accuracy > 85% for stories up to 1000 events
- [ ] Degradation rate < 10% per 2x length increase
- [ ] Coreference resolution > 90%
- [ ] Motif handling accuracy > 75%
- [ ] Clear compression threshold identified (accuracy cliff point)
- [ ] No catastrophic collapse (accuracy never drops below 50% for any tested length)

---

## 4. Experiment 3: Grounded RAG with Verification

### 4.1 Hypothesis

**H3**: If natural-language claims are converted into typed, source-linked "facts" (work signatures), then answers can be generated only when derivable from retrieved evidence. The system should detect contradictions, refuse unsupported assertions, and support primitive reasoning.

### 4.2 Objective

Validate the anti-hallucination pipeline:
1. Facts are correctly extracted and validated
2. Supported questions receive correct answers with evidence chains
3. Unsupported questions are refused (not hallucinated)
4. Conflicting facts are detected and reported

### 4.2.1 Recommended Baselines

To isolate failure sources, run Exp3 in stages:

1. **Manual facts baseline:** ingest a small corpus with hand-authored facts to validate `FactStore` + `Reasoner` without extractor variance.
2. **Extractor-enabled run:** enable the LLM extractor only after the manual baseline passes.

### 4.2.2 Rule Sources (Validation + Verification)

- **Validation rules:** schema validation, span plausibility, predicate vocabulary enforcement.
- **Verification rules:** schema-derived constraints (predicate arg types, qualifier compatibility) plus any domain-specific invariants.

### 4.3 Test Corpus

The test corpus contains documents with:
- Clear factual statements (extractable)
- Version-qualified facts (X is true in v2.0, Y is true in v2.1)
- Implicit facts (require inference)
- Contradictions (across documents or versions)

```javascript
// eval/exp3-rag/corpus.mjs

export const testCorpus = [
  {
    docId: 'spec-auth-v1',
    version: '1.0',
    text: `
      Session tokens expire after 30 minutes of inactivity.
      Maximum session duration is 8 hours.
      Tokens are stored in HttpOnly cookies.
    `,
  },
  {
    docId: 'spec-auth-v2',
    version: '2.0', 
    text: `
      Session tokens expire after 15 minutes of inactivity.
      Maximum session duration is 24 hours.
      Tokens are stored in HttpOnly cookies with SameSite=Strict.
    `,
  },
  // ... more documents
];
```

### 4.4 Question Categories

#### Category A: Answerable (Supported)
Questions with clear answers derivable from extracted facts.

```javascript
{
  question: "How long before session tokens expire from inactivity in v2.0?",
  expectedVerdict: "supported",
  expectedAnswer: "15 minutes",
  requiredEvidence: ["spec-auth-v2"],
}
```

#### Category B: Unanswerable (Unsupported)
Questions about topics not in the corpus.

```javascript
{
  question: "What encryption algorithm is used for tokens?",
  expectedVerdict: "unsupported",
  expectedAnswer: null, // System should refuse
}
```

#### Category C: Adversarial Unsupported
Questions that seem related but aren't actually supported.

```javascript
{
  question: "Can session tokens be stored in localStorage?",
  expectedVerdict: "unsupported", // Corpus says cookies, doesn't mention localStorage
}
```

#### Category D: Conflicting
Questions where the corpus contains contradictory information.

```javascript
{
  question: "How long before session tokens expire from inactivity?",
  expectedVerdict: "conflicting", // 30min in v1.0, 15min in v2.0
  conflictingFacts: [
    { source: "spec-auth-v1", value: "30 minutes" },
    { source: "spec-auth-v2", value: "15 minutes" },
  ],
}
```

#### Category E: Multi-hop Reasoning
Questions requiring chaining multiple facts.

```javascript
{
  question: "If a user is inactive for 20 minutes in v2.0, is their session valid?",
  expectedVerdict: "supported",
  expectedAnswer: "No", // Requires: (1) timeout is 15min, (2) 20 > 15, (3) therefore expired
  reasoningSteps: 2,
}
```

### 4.5 Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| **Supported Precision** | Correct answers / answers marked supported | > 95% |
| **Supported Recall** | Correct supported / all answerable questions | > 85% |
| **Refusal Accuracy** | Correct refusals / all unanswerable questions | > 90% |
| **Conflict Detection P** | True conflicts / detected conflicts | > 85% |
| **Conflict Detection R** | Detected conflicts / true conflicts | > 80% |
| **Chain Correctness** | Valid reasoning chains / chains produced | > 90% |
| **Hallucination Rate** | Unsupported answers / total answers | < 5% |
| **Extraction Consistency** | Jaccard overlap of normalized facts across repeated runs | >= 0.8 |
| **Predicate Coverage** | Facts using allowed predicates / total facts | 100% |

### 4.6 Implementation

```javascript
// eval/exp3-rag/run.mjs

import { VSABrains } from '../../src/index.mjs';
import { testCorpus } from './corpus.mjs';
import { allQuestions, categorizeQuestions } from './questions.mjs';
import { Metrics } from '../common/Metrics.mjs';
import { Reporter } from '../common/Reporter.mjs';

export async function runExperiment3(config = {}) {
  const brain = new VSABrains(config.brainConfig);
  
  // Ingest corpus
  console.log('Ingesting corpus...');
  for (const doc of testCorpus) {
    await brain.ingest(doc.text, { docId: doc.docId, version: doc.version });
  }
  
  // Get fact extraction stats
  const extractionStats = await brain.getFactStats();
  
  // Run questions by category
  const questions = categorizeQuestions(allQuestions);
  const results = {
    extraction: extractionStats,
    supported: await runCategory(brain, questions.supported),
    unsupported: await runCategory(brain, questions.unsupported),
    adversarial: await runCategory(brain, questions.adversarial),
    conflicting: await runCategory(brain, questions.conflicting),
    multihop: await runCategory(brain, questions.multihop),
  };
  
  return Reporter.summarize('exp3-rag', results);
}

async function runCategory(brain, questions) {
  const results = [];
  
  for (const q of questions) {
    const answer = await brain.answer(q.question);
    
    results.push({
      question: q.question,
      expected: {
        verdict: q.expectedVerdict,
        answer: q.expectedAnswer,
      },
      actual: {
        verdict: answer.verdict,
        answer: answer.text,
        chunks: answer.chunksUsed,
        chain: answer.factChain,
        scores: answer.supportScores,
      },
      correct: evaluateAnswer(q, answer),
    });
  }
  
  return {
    results,
    metrics: Metrics.computeRAGMetrics(results),
  };
}

function evaluateAnswer(question, answer) {
  // Verdict match
  const verdictMatch = answer.verdict === question.expectedVerdict;
  
  // Answer match (for supported questions)
  let answerMatch = true;
  if (question.expectedVerdict === 'supported' && question.expectedAnswer) {
    answerMatch = normalizeAnswer(answer.text) === normalizeAnswer(question.expectedAnswer);
  }
  
  // Refusal match (for unsupported questions)
  let refusalMatch = true;
  if (question.expectedVerdict === 'unsupported') {
    refusalMatch = answer.verdict === 'unsupported' || answer.text === null;
  }
  
  return {
    verdictMatch,
    answerMatch,
    refusalMatch,
    overall: verdictMatch && answerMatch && refusalMatch,
  };
}
```

### 4.6.1 Extraction Consistency Check

Measure extractor stability by running the extractor multiple times on the same chunk and computing overlap of **normalized** facts.

```javascript
function normalizeFact(f) {
  return JSON.stringify({
    subject: f.subject,
    predicate: f.predicate,
    object: f.object,
    qualifiers: f.qualifiers || {},
    polarity: f.polarity || 'affirm',
  });
}

function jaccard(aSet, bSet) {
  const a = new Set(aSet);
  const b = new Set(bSet);
  const inter = [...a].filter(x => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 1 : inter / union;
}
```

### 4.7 Output Contract Validation

Every answer must include the required artifacts (contract specified in DS005):

```javascript
function validateOutputContract(answer) {
  const required = ['text', 'chunksUsed', 'factChain', 'supportScores', 'verdict'];
  const missing = required.filter(field => !(field in answer));
  
  if (missing.length > 0) {
    throw new Error(`Output contract violation: missing ${missing.join(', ')}`);
  }
  
  // Validate verdict is one of allowed values
  if (!['supported', 'conflicting', 'unsupported'].includes(answer.verdict)) {
    throw new Error(`Invalid verdict: ${answer.verdict}`);
  }
  
  // Validate chain structure
  if (answer.verdict === 'supported' && answer.factChain.length === 0) {
    throw new Error('Supported verdict requires non-empty fact chain');
  }
  
  return true;
}
```

### 4.8 Success Criteria

The experiment succeeds if:

- [ ] Supported precision > 95%
- [ ] Supported recall > 85%
- [ ] Refusal accuracy on unsupported questions > 90%
- [ ] Refusal accuracy on adversarial questions > 80%
- [ ] Conflict detection precision > 85%
- [ ] Conflict detection recall > 80%
- [ ] Multi-hop chain correctness > 90%
- [ ] Overall hallucination rate < 5%
- [ ] Extraction consistency (Jaccard) >= 0.8 when extractor enabled (otherwise the configuration fails; run a gold/manual-facts baseline separately)
- [ ] Predicate coverage = 100% (no out-of-vocabulary predicates)
- [ ] All answers satisfy output contract

---

## 5. Common Infrastructure

### 5.1 Metrics Library

```javascript
// eval/common/Metrics.mjs

export const Metrics = {
  // Localization metrics
  computeLocalization(testCases) {
    // testCases groundTruth/topK/top1 are packed locKeys (uint32) for equality checks.
    const top1Acc = testCases.filter(t => t.top1 === t.groundTruth).length / testCases.length;
    const top5Acc = testCases.filter(t => t.topK.includes(t.groundTruth)).length / testCases.length;
    return { top1Acc, top5Acc };
  },
  
  // Degradation analysis
  computeDegradationRate(lengthAccuracies) {
    // Fit log-linear model: accuracy = a - b * log(length)
    // Return b as degradation rate
  },
  
  // RAG metrics
  computeRAGMetrics(results) {
    const supported = results.filter(r => r.expected.verdict === 'supported');
    const unsupported = results.filter(r => r.expected.verdict === 'unsupported');
    const conflicting = results.filter(r => r.expected.verdict === 'conflicting');
    
    return {
      supportedPrecision: /* ... */,
      supportedRecall: /* ... */,
      refusalAccuracy: /* ... */,
      conflictPrecision: /* ... */,
      conflictRecall: /* ... */,
      hallucinationRate: /* ... */,
    };
  },

  // Extraction consistency (Exp3)
  computeExtractionConsistency(factRuns) {
    // factRuns: normalized fact arrays per run (e.g., [run1Facts, run2Facts, ...])
    // Return: { jaccardAvg, jaccardMin }
  },

  // Grid diagnostics (Exp1/Exp2)
  computeGridDiagnostics(stepDiagnostics) {
    // Return aggregated utilization/saturation statistics across steps.
  },
  
  // Compression threshold detection
  findCompressionThreshold(results) {
    // Find point where accuracy drops > 10%
  },
};
```

### 5.2 Reporter

```javascript
// eval/common/Reporter.mjs

export const Reporter = {
  summarize(experimentName, results) {
    return {
      experiment: experimentName,
      timestamp: new Date().toISOString(),
      results,
      summary: this.generateSummary(results),
      passedCriteria: this.checkCriteria(experimentName, results),
    };
  },
  
  generateSummary(results) {
    // Human-readable summary
  },
  
  checkCriteria(experimentName, results) {
    // Check against success criteria
    // Returns: { criterion: string, passed: boolean, actual: number, target: number }[]
  },
  
  exportJSON(report, path) {
    // Export to JSON file
  },
  
  exportMarkdown(report, path) {
    // Export to Markdown report
  },
};
```

---

## 6. Running Evaluations

### 6.1 Individual Experiments

```bash
# Run Experiment 1: Reference-Frame Alignment
npm run eval:exp1

# Run Experiment 2: Narrative Coherence
npm run eval:exp2

# Run Experiment 3: Grounded RAG
npm run eval:exp3
```

### 6.2 Full Suite

```bash
# Run all experiments
npm run eval:all
```

### 6.3 Configuration

Each experiment accepts configuration via JSON files or command-line arguments:

```bash
node eval/exp1-alignment/run.mjs --config eval/configs/exp1-default.json
```

---

## 7. Interpreting Results

### 7.1 What Success Means

If all three experiments pass their success criteria:

1. **Exp1 Success** → Multi-column consensus provides robust frame alignment, validating the "many models voting" principle from *A Thousand Brains*

2. **Exp2 Success** → Addressable memory with replay avoids catastrophic interference, validating the "order as address" architectural choice

3. **Exp3 Success** → The system achieves operational anti-hallucination: answers are traceable, conflicts are detected, and unsupported claims are refused

### 7.2 Failure Analysis

If experiments fail:

| Failure Mode | Likely Cause | Investigation |
|--------------|--------------|---------------|
| Exp1: Low consensus gain | Column diversity too low | Increase offset variation |
| Exp1: Poor noise robustness | Heavy-hitters K too small | Increase K, test |
| Exp1/Exp2: High cell saturation | Grid too small or displacement too collisional | Increase grid size, switch to sparse maps, adjust `contextLength/maxStep` |
| Exp2: Early degradation | Summary over-compression | Analyze compression threshold |
| Exp2: Coref failures | Workpad not tracking correctly | Debug workpad state |
| Exp2: Slow queries | Checkpoint interval too large | Enable adaptive checkpointing, lower `maxInterval` |
| Exp3: High hallucination | Fact extraction quality | Review validator strictness |
| Exp3: Low extraction consistency | Extractor nondeterminism/prompt drift | Temperature=0, fixed vocabulary, add gold facts/human review |
| Exp3: Low conflict detection | Qualifier matching too loose | Tighten qualifier comparison |

---

## 8. Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2025-01-26 | Initial draft |
| 0.2 | 2026-01-26 | Added smoke gates, saturation/checkpoint diagnostics, extraction consistency requirements |
