# Experiment 5: Performance at 1M Facts

This experiment stress-tests VSABrains against a naive list-scan baseline on a **very large synthetic narrative**.

The goals are:

- Measure ingestion throughput at scale.
- Compare replay-based state queries against a naive full replay from step `0`.
- Compare localization-style window matching against a naive sliding-window scan.

The generator follows the demo-style event schema:

- Entities: `E0..En`
- Locations: `L0..Ln`
- Items: `I0..In`
- Actions: `enters`, `moves_to`, `picks_up`, `drops`, `dies`

All queries and metrics are computed using the same event stream.

## Run

Default run targets **10,000 facts** (fast local sanity check):

```bash
node eval/exp5-performance/run.mjs
```

You can override key parameters (example for larger runs):

```bash
node eval/exp5-performance/run.mjs \
  --facts 1000000 \
  --queries 24 \
  --columns 1 \
  --checkpointInterval 20000 \
  --entities 48 \
  --locations 48 \
  --items 96
```

## Parameters

- `--facts`: number of generated events (clamped to `10,000..1,000,000`)
- `--queries`: number of replay-based queries (clamped to `6..60`)
- `--localizationRuns`: number of localization timing runs (default: `--queries`, clamped to `1..2,000`)
- `--columns`: number of columns (clamped to `1..5`)
- `--checkpointInterval`: fixed checkpoint interval in steps (clamped to `1,000..200,000`)
- `--entities`, `--locations`, `--items`: world sizes
- `--seed`: RNG seed
- `--progressEvery`: progress log cadence during ingestion

## Notes

- The naive baseline intentionally replays from the beginning on every query.
- VSABrains uses fixed-interval checkpoints to reduce replay distance.
- At 1M facts, this experiment can take significant CPU time and memory.
