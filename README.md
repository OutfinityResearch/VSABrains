### Experiment Description (English)

We propose an experiment suite to evaluate a discrete, CPU-first learning architecture inspired by *A Thousand Brains* (Hawkins et al.). The core inspiration is that robust intelligence can emerge from many parallel models, each operating in its own reference frame, updating its internal state via movement, and reaching stable interpretations through consensus. Our architecture operationalizes this as multiple “columns,” each containing discrete maps with an internal location state, deterministic discrete displacement, frame realignment (localization), episodic memory with addressable retrieval, and structural binding (“work signatures”) for compositional reasoning. The experiments are designed to test whether this system achieves three properties that matter for general-purpose, grounded intelligence: stable reference-frame alignment under ambiguity, long-horizon narrative/state coherence without representational “muddiness,” and retrieval-augmented answering with explicit support and conflict detection.

---

### Hypotheses

**H1 (Reference-frame consensus):** When the same latent situation is observed through different partial views and offsets, multiple columns can independently infer consistent internal frames and converge via consensus, yielding robust identification and prediction under noise and ambiguity.

**H2 (Long-horizon coherence without global superposition):** Representing temporal order as addressable state (location plus displacement) and preserving raw episodes in an indexed store prevents the catastrophic interference typical of global superposition schemes. As narrative length grows, performance should degrade slowly and controllably (primarily due to local ambiguity), rather than collapsing.

**H3 (Grounded reasoning via structural binding + retrieval):** If natural-language claims are converted into typed, source-linked “facts” (work signatures), then answers can be generated only when derivable from retrieved evidence. The system should detect contradictions, refuse unsupported assertions, and support primitive induction, deduction, and abduction over the extracted fact structures.

---

### Experimental Setup

#### Architecture (high-level)

Each column maintains discrete maps. At each step it writes a discrete token at its current location, updates location using a discrete displacement, and consults transition/constraint maps to predict next tokens. A localizer aligns the current short context window to stored map patterns, yielding one or more candidate frame states. Columns’ predictions are merged by a consensus mechanism. Episodic memory stores source segments (chunks) with signatures and provides retrieval; retrieved chunks inject activations back into maps. Structural binding converts typed facts into compact discrete signatures so that rules can generalize across entities via canonical variables and unbinding through a scratchpad mapping.

#### Data

We use synthetic but targeted tasks that isolate the fundamental failure mode under discussion: preserving order and compositional meaning over long timelines with ambiguity, while maintaining auditability.

---

### Experiments

#### Experiment 1: Reference-Frame Alignment and Consensus

**Task:** The same latent state is observed via several channels (columns) with controlled offsets, partial observability, and noise. Each column receives a slightly different view of the same underlying sequence.
**Procedure:** Provide sequences where multiple context windows partially match multiple places in memory. Measure whether localization returns the correct frame candidates and whether consensus selects the correct interpretation.
**Metrics:** localization exactness (top-1 / top-k), consensus accuracy, robustness under noise, recovery after perturbations.

**Expected outcome:** Even when a single column is ambiguous, the ensemble converges on the correct frame more often than any individual column, mirroring the “many models voting” claim from *A Thousand Brains*.

---

#### Experiment 2: Narrative / State Tracking with Coreference Under Repetition

**Task:** A long “story” is a timeline of events that updates entity states (e.g., location, alive/dead). Events include coreference such as pronouns (“P” = last mentioned entity) and periodic “scene resets” that clear reference. The story is built from repeating motifs to create many near-matches for localization windows.
**Procedure:** The system receives the event stream and must answer queries of the form “what is the state of entity E at time t,” where t is either given or inferred via localization from a context window. Answers require replay from the nearest checkpoint summary and correct handling of the workpad (e.g., lastEntity). A consistency verifier penalizes impossible transitions (e.g., a dead entity moving without a revive).
**Metrics:** time localization accuracy, state reconstruction accuracy, coverage (fraction of queries where localization is confident), and consistency/conflict detection rates.

**Expected outcome:** Accuracy remains high as story length increases; any degradation is gradual and attributable to ambiguity or insufficient context window length, not catastrophic interference. This supports the claim that addressing + replay avoids “muddiness” that plagues global superposition approaches.

---

#### Experiment 3: Grounded RAG with Fact Extraction, Verification, and Reasoning

**Task:** Evaluate whether the system can verify and reason over retrieved evidence rather than hallucinating. Documents are chunked; each chunk is translated into typed facts with explicit spans and provenance. We allow using an LLM strictly as a structured extractor (parser), while the discrete system performs grounding and reasoning.
**Procedure:**

1. Ingest corpus: chunk text → LLM extracts typed facts (JSON with spans) → deterministic validator checks schema and span plausibility → facts are bound into work signatures and stored with indices.
2. Query time: question → candidate target facts → retrieval returns top chunks/facts → reasoner attempts to derive the target and checks for conflicts.
3. Output: answer is emitted only if “supported”; otherwise output is “conflicting” or “unsupported,” with the list of supporting chunks and fact chain.
   **Metrics:** supported answer rate on answerable questions, refusal correctness on unanswerable/adversarial questions, conflict detection precision/recall, and chain correctness for multi-step derivations.

**Expected outcome:** The system produces fewer unsupported assertions because generation is constrained by derivability from retrieved facts. Conflicts are surfaced rather than silently resolved.

---

### Conclusions (What the Suite Establishes If Successful)

If these experiments succeed, we can claim more than superficial resemblance to *A Thousand Brains*. We can demonstrate a concrete mechanism—multiple discrete reference-frame models with localization and consensus—that yields robust interpretation and prediction. We can show that long-horizon coherence is achieved by addressable memory plus replay and summaries, rather than by compressing the entire past into a single representation that inevitably saturates. Finally, we can show that using structured fact binding and episodic retrieval enables auditable, grounded reasoning (inductive pattern generalization via canonical variables; deductive multi-step chaining; abductive hypothesis proposal) while allowing an LLM to be used safely as a front-end parser rather than as the source of truth.
