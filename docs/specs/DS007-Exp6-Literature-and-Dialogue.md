---
title: DS007 - Experiment 6 (Literature & Dialogue Frames)
version: 0.1
status: Draft
---

# DS007 - Experiment 6: Literature & Dialogue Semantics

## 1) Goal

Demonstrate that semantic queries about **meaning, emotion, and discourse** can be answered **faster**
than a naive list scan when semantic facts are organized into **Frames** (DS006).

We assume a Semantic Encoder exists (simulated outputs are acceptable).

## 2) Hypotheses

1. **Speed:** Virtual spaces enable sub-linear semantic queries compared to naive full scans.
2. **Coverage:** The 48-space catalog supports a broad range of literary and conversational questions.
3. **Auditability:** Answers can be traced to explicit semantic facts.

## 3) Inputs

### 3.1 Literature Passages
Short works or excerpts (200–1,000 sentences) with:
- named characters,
- implied motives,
- thematic signals,
- narrative turns.

### 3.2 Dialogue Logs
Multi-speaker chat dialogues (200–1,000 turns) with:
- agreement/disagreement,
- persuasion attempts,
- emotional tone shifts,
- resolution or escalation.

### 3.3 Semantic Encoder Output (Simulated)
For each passage/dialogue:
- events (subject/action/object),
- semantic frame facts (DS006 format),
- confidence per fact.

## 4) Query Set (Representative)

### 4.1 Literature Queries
- “What is the dominant theme?”
- “Which character has a negative arc?”
- “Where does the narrative shift into climax?”
- “Who holds the central secret?”
- “What is the prevailing tone in the final third?”
- “Is the narrator reliable?”
- “Which relationship shows rising hostility?”
- “Does the emotional intensity rise or fall?”

### 4.2 Dialogue Queries
- “What is the dominant sentiment?”
- “Which speaker drives the conversation?”
- “Is the discussion resolving or escalating?”
- “Which topic dominates the exchange?”
- “Is there evidence of manipulation?”
- “What is the overall agreement level?”
- “What is the politeness trend?”

## 5) Baselines

### 5.1 Naive Baseline
Scan all semantic facts or all events every time a query is asked:
```
O(N) per query
```

### 5.2 VSA/Frames Baseline
Query only the relevant semantic frames with direct indexing and replay from checkpoints:
```
O(log N) or O(K) per query
```

## 6) Procedure

1. Generate synthetic literary and dialogue corpora.
2. Simulate semantic encoder output (facts + confidence).
3. Populate semantic frames.
4. Run query suite on:
   - naive list-scan
   - semantic spaces with replay/checkpoints
5. Record time + accuracy + evidence integrity.

## 7) Metrics

- **Query Latency (ms)**: median and P95.
- **Accuracy**: match against gold labels.
- **Evidence Coverage**: percentage of answers with valid fact references.
- **Conflict Rate**: percentage of queries with explicit contradictions.

## 8) Success Criteria

- **Latency**: Semantic spaces ≥ 4× faster than naive scan at 100k+ facts.
- **Accuracy**: ≥ 85% on curated queries.
- **Evidence**: ≥ 95% of answers cite at least one semantic fact.

## 9) Notes

- This experiment is **semantic-only** and does not require full LLM integration.
- Encoder simulation is acceptable for reproducibility.
- Results should be reported alongside Exp5 performance metrics.
