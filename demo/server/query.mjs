import { performance } from 'node:perf_hooks';
import { pairKey, topFromCounts, trendFromSeries } from './utils.mjs';
import { isFrameActive, semanticStateAtStep, naiveSemanticReplayToStep } from './semantic.mjs';
import { formatContradictionsText, parseTargetStep, stateAtStep, naiveReplayToStep } from './state.mjs';

const STATE_BASED_TYPES = new Set([
  'where',
  'whereAt',
  'entitiesAt',
  'inventory',
  'whoHas',
  'itemLocation',
  'isAlive'
]);

const SEMANTIC_QUERY_TYPES = new Set([
  'dominantEmotion',
  'emotionalArc',
  'dominantTheme',
  'mainConflict',
  'relationshipStatus',
  'powerBalance',
  'narrativePhase',
  'tone',
  'motif',
  'characterArc',
  'secretHolder',
  'narratorReliability',
  'dominantSentiment',
  'topicFocus',
  'agreementLevel',
  'conflictLevel',
  'politeness',
  'dominantSpeaker',
  'resolutionStatus',
  'trustLevel',
  'misinformationRisk',
  'intentDistribution',
  'actionItems'
]);

const SEMANTIC_QUERY_REQUIREMENTS = {
  dominantEmotion: ['emotionState'],
  emotionalArc: ['emotionIntensity', 'tensionLevel'],
  dominantTheme: ['themeTags'],
  mainConflict: ['conflictType', 'conflictEscalation'],
  relationshipStatus: ['trustRelation', 'hostilityRelation'],
  powerBalance: ['powerBalance'],
  narrativePhase: ['narrativePhase'],
  tone: ['toneStyle'],
  motif: ['motifRecurrence'],
  characterArc: ['characterArc'],
  secretHolder: ['secretState'],
  narratorReliability: ['narratorReliability'],
  dominantSentiment: ['emotionState'],
  topicFocus: ['themeTags'],
  agreementLevel: ['stanceAgreement'],
  conflictLevel: ['conflictEscalation'],
  politeness: ['politenessLevel'],
  dominantSpeaker: ['speakerTurns'],
  resolutionStatus: ['narrativePhase'],
  trustLevel: ['trustRelation'],
  misinformationRisk: ['evidenceStrength'],
  intentDistribution: ['goalState'],
  actionItems: ['planProgress']
};

function isStateBasedQuery(type) {
  return STATE_BASED_TYPES.has(type);
}

function isSemanticQuery(type) {
  return SEMANTIC_QUERY_TYPES.has(type);
}

function answerFromState(state, payload) {
  const type = payload.type;
  const entity = payload.entity;
  const item = payload.item;
  const location = payload.location;

  if (type === 'where' || type === 'whereAt') {
    return state.entities[entity]?.location ?? null;
  }

  if (type === 'entitiesAt') {
    return Object.entries(state.entities)
      .filter(([, data]) => data.location === location)
      .map(([id]) => id)
      .sort();
  }

  if (type === 'inventory') {
    return [...(state.entities[entity]?.inventory ?? [])].sort();
  }

  if (type === 'whoHas') {
    return state.items[item]?.heldBy ?? null;
  }

  if (type === 'itemLocation') {
    const itemState = state.items[item];
    if (!itemState) return null;
    if (itemState.heldBy) return state.entities[itemState.heldBy]?.location ?? null;
    return itemState.location ?? null;
  }

  if (type === 'isAlive') {
    const alive = state.entities[entity]?.alive;
    return alive === false ? false : true;
  }

  return null;
}

function answerSemanticQuery(state, payload) {
  const type = payload.type;
  const entity = payload.entity;
  const target = payload.target;

  if (!state) return { text: 'No semantic facts yet.' };

  if (type === 'dominantEmotion' || type === 'dominantSentiment') {
    const top = topFromCounts(state.counts.emotionState ?? {});
    return { text: top ? `Dominant emotion: ${top.value}` : 'No emotion tags yet.' };
  }

  if (type === 'emotionalArc') {
    const trend = trendFromSeries(state.series.tensionLevel ?? state.series.emotionIntensity ?? []);
    return { text: `Emotional arc is ${trend}.` };
  }

  if (type === 'dominantTheme' || type === 'topicFocus') {
    const top = topFromCounts(state.counts.themeTags ?? {});
    return { text: top ? `Dominant theme/topic: ${top.value}` : 'No theme tags yet.' };
  }

  if (type === 'mainConflict' || type === 'conflictLevel') {
    const top = topFromCounts(state.counts.conflictType ?? {});
    if (type === 'conflictLevel') {
      const level = state.last.conflictEscalation ?? 0;
      return { text: `Conflict level: ${Math.round(level)}` };
    }
    return { text: top ? `Main conflict: ${top.value}` : 'No conflict tags yet.' };
  }

  if (type === 'relationshipStatus') {
    if (!entity || !target) return { text: 'Pick two entities.' };
    const key = pairKey(entity, target);
    const trust = state.relations.trustRelation?.[key];
    const hostility = state.relations.hostilityRelation?.[key];
    if (trust == null && hostility == null) return { text: 'No relationship facts yet.' };
    return { text: `Relationship ${entity} ↔ ${target}: trust ${trust ?? 0}, hostility ${hostility ?? 0}.` };
  }

  if (type === 'powerBalance') {
    if (!entity || !target) return { text: 'Pick two entities.' };
    const key = pairKey(entity, target);
    const value = state.relations.powerBalance?.[key];
    if (value == null) return { text: 'No power facts yet.' };
    const leader = value > 0 ? entity : value < 0 ? target : 'balanced';
    return { text: `Power balance: ${leader}.` };
  }

  if (type === 'narrativePhase' || type === 'resolutionStatus') {
    const phase = state.last.narrativePhase ?? 'unknown';
    return { text: `Narrative phase: ${phase}.` };
  }

  if (type === 'tone') {
    const top = topFromCounts(state.counts.toneStyle ?? {});
    return { text: top ? `Dominant tone: ${top.value}` : 'No tone tags yet.' };
  }

  if (type === 'motif') {
    const top = topFromCounts(state.counts.motifRecurrence ?? {});
    return { text: top ? `Dominant motif: ${top.value}` : 'No motif tags yet.' };
  }

  if (type === 'characterArc') {
    if (!entity) return { text: 'Pick an entity.' };
    const arc = state.byEntity.characterArc?.[entity];
    return { text: arc ? `${entity} arc: ${arc}` : `No arc data for ${entity}.` };
  }

  if (type === 'secretHolder') {
    const holder = state.flags.secretHolder;
    return { text: holder ? `Secret holder: ${holder}` : 'No secrets tracked.' };
  }

  if (type === 'narratorReliability') {
    const reliability = state.last.narratorReliability ?? 'unknown';
    return { text: `Narrator reliability: ${reliability}.` };
  }

  if (type === 'agreementLevel') {
    const agree = state.counts.stanceAgreement?.agree ?? 0;
    const disagree = state.counts.stanceAgreement?.disagree ?? 0;
    const total = agree + disagree;
    if (!total) return { text: 'No agreement facts yet.' };
    const ratio = Math.round((agree / total) * 100);
    return { text: `Agreement level: ${ratio}% agree.` };
  }

  if (type === 'politeness') {
    const top = topFromCounts(state.counts.politenessLevel ?? {});
    return { text: top ? `Politeness: ${top.value}` : 'No politeness tags yet.' };
  }

  if (type === 'dominantSpeaker') {
    const top = topFromCounts(state.counts.speakerTurns ?? {});
    return { text: top ? `Dominant speaker: ${top.value}` : 'No speaker turns tracked.' };
  }

  if (type === 'trustLevel') {
    if (!entity || !target) return { text: 'Pick two entities.' };
    const key = pairKey(entity, target);
    const trust = state.relations.trustRelation?.[key];
    return { text: trust == null ? 'No trust facts yet.' : `Trust ${entity} ↔ ${target}: ${trust}` };
  }

  if (type === 'misinformationRisk') {
    const strength = state.last.evidenceStrength ?? 'unknown';
    const risk = strength === 'weak' ? 'high' : strength === 'strong' ? 'low' : 'medium';
    return { text: `Misinformation risk: ${risk}.` };
  }

  if (type === 'intentDistribution') {
    const top = topFromCounts(state.counts.goalState ?? {});
    return { text: top ? `Dominant intent: ${top.value}` : 'No intent facts yet.' };
  }

  if (type === 'actionItems') {
    const top = topFromCounts(state.counts.planProgress ?? {});
    return { text: top ? `Action focus: ${top.value}` : 'No action items tagged.' };
  }

  return { text: 'No semantic answer for this query.' };
}

async function computePerformanceMetrics(session, targetStep, payload) {
  if (isSemanticQuery(payload.type)) {
    const naiveStart = performance.now();
    const naiveState = naiveSemanticReplayToStep(session, targetStep);
    const naiveTimeMs = performance.now() - naiveStart;

    const beforeStep = session.semanticCache.step;
    const vsaStart = performance.now();
    const semanticState = semanticStateAtStep(session, targetStep);
    const vsaTimeMs = performance.now() - vsaStart;

    const naiveAnswer = answerSemanticQuery(naiveState, payload).text;
    const vsaAnswer = answerSemanticQuery(semanticState, payload).text;
    const mismatch = naiveAnswer !== vsaAnswer;

    const metrics = {
      targetStep,
      historyLength: session.history.length,
      naiveTimeMs,
      vsaTimeMs,
      naiveReplaySteps: targetStep + 1,
      vsaReplaySteps: Math.max(0, targetStep - beforeStep),
      mismatch,
      mismatchDetails: mismatch
        ? {
          type: payload.type,
          naiveAnswer,
          vsaAnswer
        }
        : null
    };

    return { metrics, semanticState };
  }

  if (!isStateBasedQuery(payload.type)) {
    return { metrics: null, snapshot: stateAtStep(session, targetStep) };
  }

  const naiveStart = performance.now();
  const naiveState = naiveReplayToStep(session, targetStep);
  const naiveTimeMs = performance.now() - naiveStart;

  const vsaStart = performance.now();
  const snapshot = await session.brain.replay(targetStep);
  const vsaTimeMs = performance.now() - vsaStart;
  const vsaReplaySteps = session.brain.lastReplaySteps ?? 0;

  const naiveAnswer = answerFromState(naiveState, payload);
  const vsaAnswer = answerFromState(snapshot, payload);
  const mismatch = JSON.stringify(naiveAnswer) !== JSON.stringify(vsaAnswer);

  const metrics = {
    targetStep,
    historyLength: session.history.length,
    naiveTimeMs,
    vsaTimeMs,
    naiveReplaySteps: targetStep + 1,
    vsaReplaySteps,
    mismatch,
    mismatchDetails: mismatch
      ? {
        type: payload.type,
        naiveAnswer,
        vsaAnswer
      }
      : null
  };

  return { metrics, snapshot };
}

export async function handleQuery(session, payload) {
  const type = payload.type;
  const entity = payload.entity;
  const item = payload.item;
  const location = payload.location;
  const targetStep = parseTargetStep(session, payload.step);

  if (!session.history.length) {
    session.lastQueryStats = null;
    return { answerText: 'No events yet.', metrics: null };
  }

  const perf = await computePerformanceMetrics(session, targetStep, payload);
  const snapshot = perf.snapshot;
  const semanticState = perf.semanticState ?? (isSemanticQuery(type) ? semanticStateAtStep(session, targetStep) : null);
  const metrics = perf.metrics;
  const respond = (answerText) => {
    session.lastQueryStats = metrics;
    return { answerText, metrics };
  };

  if (type === 'where' || type === 'whereAt') {
    if (!snapshot.entities[entity]) {
      return respond(`Unknown entity: ${entity}`);
    }
    const loc = snapshot.entities[entity].location ?? 'unknown';
    return respond(`${entity} is at ${loc} (step ${targetStep}).`);
  }

  if (type === 'entitiesAt') {
    const list = Object.entries(snapshot.entities)
      .filter(([, data]) => data.location === location)
      .map(([id]) => id);
    return respond(list.length > 0 ? `${location}: ${list.join(', ')}` : `${location}: nobody.`);
  }

  if (type === 'inventory') {
    const inv = snapshot.entities[entity]?.inventory ?? null;
    if (!inv) {
      return respond(`Unknown entity: ${entity}`);
    }
    return respond(inv.length > 0 ? `${entity} has ${inv.join(', ')}` : `${entity} has nothing.`);
  }

  if (type === 'whoHas') {
    const holder = snapshot.items[item]?.heldBy ?? null;
    return respond(holder ? `${item} is held by ${holder}.` : `${item} is not held.`);
  }

  if (type === 'itemLocation') {
    const itemState = snapshot.items[item];
    if (!itemState) {
      return respond(`Unknown item: ${item}`);
    }
    let answerText = `${item} location unknown.`;
    if (itemState.heldBy) answerText = `${item} is held by ${itemState.heldBy}.`;
    else if (itemState.location) answerText = `${item} is at ${itemState.location}.`;
    return respond(answerText);
  }

  if (type === 'isAlive') {
    const alive = snapshot.entities[entity]?.alive;
    if (alive == null) {
      return respond(`Unknown entity: ${entity}`);
    }
    return respond(alive ? `${entity} is alive.` : `${entity} is dead.`);
  }

  if (type === 'lastEvent') {
    const events = session.history.filter((entry) => entry.event.subject === entity);
    if (events.length === 0) {
      return respond(`${entity} has no events.`);
    }
    const last = events[events.length - 1];
    return respond(`Last: #${last.step} ${last.text}`);
  }

  if (type === 'timeline') {
    const limit = Math.max(1, Math.min(20, Number(payload.limit) || 6));
    const events = session.history.filter((entry) => entry.event.subject === entity).slice(-limit);
    if (!events.length) {
      return respond(`${entity} has no events.`);
    }
    return respond(events.map((entry) => `#${entry.step} ${entry.text}`).join('\n'));
  }

  if (type === 'contradictions') {
    return respond(formatContradictionsText(session));
  }

  if (type === 'contradictionsFor') {
    const list = session.contradictions.filter((entry) => entry.text.startsWith(entity));
    const answerText = list.length === 0
      ? `No contradictions for ${entity}.`
      : list.map((entry) => `#${entry.step} ${entry.text} → ${entry.reasons.join(', ')}`).join('\n');
    return respond(answerText);
  }

  if (isSemanticQuery(type)) {
    const required = SEMANTIC_QUERY_REQUIREMENTS[type] ?? [];
    const active = required.filter((frame) => isFrameActive(session, frame));
    if (required.length > 0 && active.length === 0) {
      return respond(`Frame inactive by profile: ${required.join(', ')}`);
    }
    const semanticAnswer = answerSemanticQuery(semanticState, payload);
    return respond(semanticAnswer.text);
  }

  return respond('Unknown query.');
}
