---
title: DS006 - Semantic Encoder (CNL) and Frames
version: 0.2
status: Draft
---

# DS006 - Semantic Encoder (CNL) and Frames

## 1) Purpose

This document defines:
1) A **CNL (Constraint Natural Language)** used to declare semantic frames.
2) The **Semantic Encoder** contract that emits frame facts.

Frames are **not new columns**. They are **semantic sub-frames** attached to columns or created as
specialized columns when activated by the runtime. This keeps the core architecture intact while enabling
fast semantic queries for literature and dialogue.

## 2) Design Goals

- **Discreteness:** convert “meaning” into explicit, auditable facts.
- **Separation:** each frame stores a narrow semantic aspect.
- **Queryability:** support sophisticated literary and dialogue analysis.
- **Replayability:** facts are replayable and verifiable.
- **Scalability:** indexed frames enable fast semantic queries.
- **Configurability:** users can change focus via CNL without code changes.

## 3) Why 48 Frames?

We need enough frames to support **distinct question families** without forcing unrelated facts into the
same map. Too few frames mixes semantics; too many fragments the evidence and adds overhead.

After analyzing literature and dialogue tasks, we identified **12 independent semantic families** that
cannot be cleanly merged without losing query precision. For each family we need:

1. **State** (what is true now)
2. **Dynamics** (how it changes)
3. **Evidence** (what supports it)
4. **Uncertainty** (how confident we are)

That yields **12 × 4 = 48 frames**. This is the minimal set that:
- preserves separability of question types,
- avoids conflating emotion, intent, rhetoric, and narrative structure,
- remains feasible for indexing and replay.

Therefore this spec defines **48 core frames**. Adding fewer breaks coverage; adding more adds redundancy.

## 4) Encoder Contract

### 4.1 Input

```json
{
  "text": "raw passage or chat logs",
  "metadata": {
    "mode": "literature | chat | synthetic",
    "source": "string",
    "language": "en",
    "time": "optional timestamp"
  }
}
```

### 4.2 Output

```json
{
  "events": [
    {
      "subject": "EntityId",
      "action": "action_id",
      "object": "EntityId|LocationId|ItemId|null",
      "text": "optional human-readable sentence",
      "time": 123
    }
  ],
  "semanticFacts": [
    {
      "frame": "emotionState",
      "kind": "tag|level|entity|relation|stance",
      "subject": "EntityId|scene|dialogue|null",
      "object": "EntityId|TopicId|null",
      "value": "label or numeric",
      "delta": "optional numeric delta",
      "weight": 1,
      "confidence": 0.0,
      "sourceSpan": "optional text span",
      "justification": "short explanation"
    }
  ]
}
```

### 4.3 Notes

- `events` feed the core VSA trajectory model.
- `semanticFacts` feed the semantic frames (this DS).
- The encoder must **only** emit facts it can justify.

## 5) CNL (Constraint Natural Language)

The CNL is a human-readable configuration language. It declares frames, mappings, and queries.

### 5.1 Frame Declarations

```
Frame Emotion is active when emotion frequency > 5%.
Frame Emotion stores facts: emotionState, emotionIntensity, moodTrend, tensionLevel.
Frame Emotion focuses on entities.
Frame Emotion budgets: maxColumns=2, maxFacts=5000.
```

### 5.2 Mappings (Semantics → Facts)

```
When sentence expresses emotion
  emit emotionState for subject with label and confidence.
When sentence expresses intensity
  emit emotionIntensity for subject with score and confidence.
```

### 5.3 Queries

```
Query emotionalArc uses Frame Emotion.
Query emotionalArc reads series emotionIntensity.
Query emotionalArc returns trend.
```

### 5.4 Profiles (Pragmatic Focus)

```
Profile LiteratureCritic activates Frames: Emotion, Theme, Motif, NarrativeArc, Conflict.
Profile LiteratureCritic suppresses Frames: Dialogue, Politeness.
```

### 5.5 Dynamic Allocation Rules

```
Allocate new frame column for Emotion if Emotion conflicts exceed 3.
Prune frame column if inactivity > 200 steps.
```

## 6) Frame Catalog (48 Core Frames)

Each frame is a discrete map keyed by **step** and **fact**. Its job is to store **only one semantic aspect**.

### 5.1 Emotion & Affect (4)

1. **emotionState**  
   - Schema: `{ subject, value, confidence }`  
   - Example: `emotionState(Alice)=grief`

2. **emotionIntensity**  
   - Schema: `{ subject, value: 0..10 }`  
   - Example: `emotionIntensity(scene)=7`

3. **moodTrend**  
   - Schema: `{ subject, value: rising|falling|flat }`

4. **tensionLevel**  
   - Schema: `{ value: 0..10 }`

### 5.2 Motivation & Intent (4)

5. **goalState**  
   - Schema: `{ subject, value: goal_label }`

6. **desireIntensity**  
   - Schema: `{ subject, value: 0..10 }`

7. **planProgress**  
   - Schema: `{ subject, value: 0..1 }`

8. **obstaclePressure**  
   - Schema: `{ subject, value: 0..10 }`

### 5.3 Relationships & Social (4)

9. **trustRelation**  
   - Schema: `{ subject, object, value: -10..10 }`

10. **intimacyRelation**  
   - Schema: `{ subject, object, value: 0..10 }`

11. **hostilityRelation**  
   - Schema: `{ subject, object, value: 0..10 }`

12. **allianceRelation**  
   - Schema: `{ subject, object, value: ally|neutral|rival }`

### 5.4 Power & Status (4)

13. **powerBalance**  
   - Schema: `{ subject, object, value: -10..10 }`

14. **statusRank**  
   - Schema: `{ subject, value: low|mid|high }`

15. **authorityLegitimacy**  
   - Schema: `{ subject, value: legit|contested }`

16. **dominanceMoves**  
   - Schema: `{ subject, value: assert|yield }`

### 5.5 Conflict & Intrigue (4)

17. **conflictType**  
   - Schema: `{ value: interpersonal|internal|societal|mystery }`

18. **conflictEscalation**  
   - Schema: `{ value: 0..10 }`

19. **deceptionSignals**  
   - Schema: `{ subject, value: none|low|high }`

20. **secretState**  
   - Schema: `{ subject, value: holds_secret|revealed }`

### 5.6 Narrative Structure (4)

21. **narrativePhase**  
   - Schema: `{ value: setup|conflict|climax|resolution }`

22. **focalCharacter**  
   - Schema: `{ value: EntityId }`

23. **plotTurns**  
   - Schema: `{ value: reveal|reversal|twist|none }`

24. **pacingTempo**  
   - Schema: `{ value: slow|medium|fast }`

### 5.7 Themes & Symbols (4)

25. **themeTags**  
   - Schema: `{ value: theme_label }`

26. **motifRecurrence**  
   - Schema: `{ value: motif_label }`

27. **symbolismType**  
   - Schema: `{ value: symbol_label }`

28. **moralTheme**  
   - Schema: `{ value: redemption|betrayal|justice|loss|hope }`

### 5.8 Dialogue & Pragmatics (4)

29. **dialogueAct**  
   - Schema: `{ subject, value: ask|assert|deny|agree|promise }`

30. **politenessLevel**  
   - Schema: `{ subject, value: low|neutral|high }`

31. **stanceAgreement**  
   - Schema: `{ subject, object: topic, value: agree|disagree }`

32. **persuasionTactic**  
   - Schema: `{ subject, value: appeal|threat|logic|emotion }`

### 5.9 Epistemic & Reliability (4)

33. **beliefState**  
   - Schema: `{ subject, value: belief_label }`

34. **evidenceStrength**  
   - Schema: `{ value: weak|medium|strong }`

35. **narratorReliability**  
   - Schema: `{ value: reliable|biased|unreliable }`

36. **uncertaintyLevel**  
   - Schema: `{ value: 0..10 }`

### 5.10 Character Psychology (4)

37. **mentalState**  
   - Schema: `{ subject, value: stable|fragile|fractured }`

38. **cognitiveBias**  
   - Schema: `{ subject, value: confirmation|projection|none }`

39. **resilienceLevel**  
   - Schema: `{ subject, value: 0..10 }`

40. **empathyLevel**  
   - Schema: `{ subject, value: 0..10 }`

### 5.11 Style & Rhetoric (4)

41. **toneStyle**  
   - Schema: `{ value: formal|intimate|ironic|somber }`

42. **imageryDensity**  
   - Schema: `{ value: low|medium|high }`

43. **rhetoricDevice**  
   - Schema: `{ value: metaphor|parallelism|contrast|none }`

44. **voiceRegister**  
   - Schema: `{ value: first_person|third_person|choral }`

### 5.12 Reader Impact (4)

45. **predictedEmotion**  
   - Schema: `{ value: awe|sadness|fear|joy|ambivalence }`

46. **emotionalAftertaste**  
   - Schema: `{ value: lingering|resolved|unsettled }`

47. **memorabilityHook**  
   - Schema: `{ value: image|line|twist|character }`

48. **cognitiveLoad**  
   - Schema: `{ value: low|medium|high }`

## 7) Example Encoding (Literature)

Input:

```
“Marina reads the letter, hides it, and lies to Julian. The room feels colder.”
```

Output sketch:

```json
{
  "events": [
    { "subject": "Marina", "action": "picks_up", "object": "letter", "text": "Marina reads the letter." },
    { "subject": "Marina", "action": "hides", "object": "letter", "text": "Marina hides the letter." },
    { "subject": "Marina", "action": "lies_to", "object": "Julian", "text": "Marina lies to Julian." }
  ],
  "semanticFacts": [
    { "frame": "deceptionSignals", "kind": "entity", "subject": "Marina", "value": "high", "confidence": 0.78 },
    { "frame": "emotionState", "kind": "entity", "subject": "Julian", "value": "unease", "confidence": 0.62 },
    { "frame": "toneStyle", "kind": "tag", "value": "somber", "confidence": 0.71 },
    { "frame": "tensionLevel", "kind": "level", "value": 6, "confidence": 0.66 }
  ]
}
```

## 8) Implementation Notes

- The encoder can be **simulated** for experiments (Exp6).
- All semantic facts must include confidence and justification.
- Replay is required to verify semantic answers.
- No semantic fact should be emitted without a source span.
