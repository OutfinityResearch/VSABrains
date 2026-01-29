# Experiment 6: Literature & Dialogue Semantics

This experiment simulates a **semantic encoder** and measures query speed on the
semantic frames defined in `DS006`.

The goal is to compare:

- **Naive scan:** iterate all semantic facts per query
- **Indexed frames:** pre-aggregated counts and per-frame indexes

## Run

```bash
node eval/exp6-literature/run.mjs
```

Override parameters:

```bash
node eval/exp6-literature/run.mjs \
  --facts 100000 \
  --queries 40 \
  --seed 7
```

## Notes

- This is a **proxy** experiment for semantic frame performance.
- It does **not** require an LLM or real encoder output.
- It is intended to show the impact of **space-level indexing** on complex queries.
