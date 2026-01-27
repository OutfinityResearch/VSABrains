# Experiment 4: Consensus vs Single-Stream Noise

This experiment is designed to highlight the architectural advantage of **multi-column consensus** under noisy inputs, compared to a single noisy stream and a **naive list-scan baseline**.

## What it measures

- **singleColumnAcc**: localization accuracy using the first column only.
- **bestColumnAcc**: the best-performing column (upper bound without consensus).
- **baselineAcc**: naive list-scan accuracy (content matching only).
- **baselineComparisonsPerQuery**: approximate cost of list scanning.
- **vsaApproxBytesLowerBound**: lower-bound storage proxy for VSA cells (non-empty cells × k × entryBytes).
- **baselineApproxBytesLowerBound**: lower-bound storage proxy for list baseline (tokens × tokenBytes).
- **baselineMatchThreshold**: minimum exact matches required by the naive list baseline (defaults to full window size).
- **consensusAcc**: majority vote across columns.
- **consensusGainOverSingle / consensusGainOverBest / consensusGainOverBaseline**: improvement from consensus.

## Why this matters

A purely symbolic list that consumes a single noisy stream has no independent viewpoints to vote on and must scan linearly to match context windows. With multiple columns, noise is averaged out, and the consensus location is more stable and auditable. This experiment makes that effect visible with numeric metrics.

The storage proxies are intentionally conservative. They assume fixed-width values (e.g., 4–8 bytes) and ignore real runtime overhead. They are used only to highlight scaling trends, not as exact memory measurements.

## Run

```
node eval/exp4-consensus/run.mjs
```

You can adjust parameters in the run call (numColumns, noiseRate, seqLength, etc.).
