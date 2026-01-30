import { SEMANTIC_SERIES_LIMIT } from './constants.mjs';
import { clamp, ensureBucket, ensureSeries, pairKey, topFromCounts } from './utils.mjs';

export function initSemanticState(mode) {
  return {
    mode,
    counts: {},
    last: {},
    byEntity: {},
    relations: {},
    series: {},
    flags: {}
  };
}

export function getFactFrameName(fact) {
  return fact?.frame ?? fact?.space ?? null;
}

export function isFrameActive(session, frameName) {
  if (!frameName) return false;
  if (!session.activeFrames || session.activeFrames.size === 0) return true;
  return session.activeFrames.has(frameName);
}

export function resetSemanticCache(session) {
  session.semanticCache = {
    step: -1,
    state: initSemanticState(session.contentMode),
    factIndex: -1
  };
}

export function applySemanticFact(state, fact) {
  const frame = getFactFrameName(fact);
  if (!fact || !frame) return;
  const space = frame;
  const kind = fact.kind ?? 'tag';
  const weight = Number.isFinite(fact.weight) ? fact.weight : 1;

  if (kind === 'level') {
    const current = Number.isFinite(state.last[space]) ? state.last[space] : 0;
    const next = Number.isFinite(fact.value)
      ? fact.value
      : current + (Number.isFinite(fact.delta) ? fact.delta : 0);
    state.last[space] = next;
    const series = ensureSeries(state.series, space);
    series.push(next);
    if (series.length > SEMANTIC_SERIES_LIMIT) series.shift();
    return;
  }

  if (kind === 'entity') {
    if (!fact.subject) return;
    const bucket = ensureBucket(state.byEntity, space);
    bucket[fact.subject] = fact.value;
    state.last[space] = fact.value;
    if (typeof fact.value === 'string') {
      const counts = ensureBucket(state.counts, space);
      counts[fact.value] = (counts[fact.value] ?? 0) + weight;
    }
    if (space === 'secretState' && fact.value === 'holds_secret') {
      state.flags.secretHolder = fact.subject;
    }
    return;
  }

  if (kind === 'relation') {
    if (!fact.subject || !fact.object) return;
    const bucket = ensureBucket(state.relations, space);
    bucket[pairKey(fact.subject, fact.object)] = fact.value;
    state.last[space] = fact.value;
    if (typeof fact.value === 'string') {
      const counts = ensureBucket(state.counts, space);
      counts[fact.value] = (counts[fact.value] ?? 0) + weight;
    }
    if (space === 'allianceRelation') {
      const loyalty = ensureBucket(state.flags, 'loyalty');
      loyalty[pairKey(fact.subject, fact.object)] = fact.value === 'ally';
    }
    return;
  }

  if (kind === 'stance') {
    if (!fact.subject || !fact.object) return;
    const bucket = ensureBucket(state.flags, 'stance');
    bucket[`${fact.subject}|${fact.object}`] = fact.value;
    const counts = ensureBucket(state.counts, space);
    counts[fact.value] = (counts[fact.value] ?? 0) + weight;
    state.last[space] = fact.value;
    return;
  }

  const counts = ensureBucket(state.counts, space);
  if (fact.value != null) {
    counts[fact.value] = (counts[fact.value] ?? 0) + weight;
    state.last[space] = fact.value;
  }

  if (space === 'secretState') {
    if (fact.value === 'holds_secret') {
      state.flags.secretHolder = fact.subject ?? state.flags.secretHolder;
    }
    if (fact.value === 'revealed') {
      state.flags.secretHolder = null;
    }
  }
}

export function applySemanticFactsToState(state, facts = []) {
  for (const fact of facts) {
    applySemanticFact(state, fact);
  }
}

export function rebuildSemanticState(session) {
  session.semanticState = initSemanticState(session.contentMode);
  resetSemanticCache(session);
  session.activeFactsCount = 0;
  if (!session.semanticFacts.length) return;
  for (let i = 0; i < session.semanticFacts.length; i += 1) {
    const fact = session.semanticFacts[i];
    if (isFrameActive(session, getFactFrameName(fact))) {
      applySemanticFact(session.semanticState, fact);
      session.activeFactsCount += 1;
    }
    session.semanticCache.step = fact.step;
    session.semanticCache.factIndex = i;
  }
}

export function semanticStateAtStep(session, targetStep) {
  if (!session.semanticFacts.length) {
    return structuredClone(initSemanticState(session.contentMode));
  }

  const limit = clamp(targetStep, 0, session.history.length - 1);
  if (!session.semanticCache.state) resetSemanticCache(session);

  if (limit < session.semanticCache.step) {
    resetSemanticCache(session);
  }

  for (let i = session.semanticCache.factIndex + 1; i < session.semanticFacts.length; i += 1) {
    const fact = session.semanticFacts[i];
    if (fact.step > limit) break;
    if (isFrameActive(session, getFactFrameName(fact))) {
      applySemanticFact(session.semanticCache.state, fact);
    }
    session.semanticCache.factIndex = i;
    session.semanticCache.step = fact.step;
  }

  return structuredClone(session.semanticCache.state);
}

export function naiveSemanticReplayToStep(session, targetStep) {
  const state = initSemanticState(session.contentMode);
  const limit = clamp(targetStep, 0, session.history.length - 1);
  for (const fact of session.semanticFacts) {
    if (fact.step > limit) break;
    if (!isFrameActive(session, getFactFrameName(fact))) continue;
    applySemanticFact(state, fact);
  }
  return state;
}

export function detectSemanticContradictions(session, event, semanticFacts = []) {
  const reasons = [];
  const stanceMap = session.semanticState?.flags?.stance ?? {};

  for (const fact of semanticFacts) {
    if (fact.kind === 'stance' && fact.subject && fact.object) {
      const key = `${fact.subject}|${fact.object}`;
      const last = stanceMap[key];
      if (last && last !== fact.value) reasons.push('stance_flip');
    }
  }

  if (event.action === 'betrays' && event.object) {
    const loyalty = session.semanticState?.flags?.loyalty?.[pairKey(event.subject, event.object)];
    if (loyalty === true) reasons.push('betrayal_after_vow');
  }

  if (event.action === 'reveals_to' && !session.semanticState?.flags?.secretHolder) {
    reasons.push('reveal_without_secret');
  }

  return reasons;
}

export function summarizeSemanticFacts(facts = []) {
  const tags = [];
  for (const fact of facts) {
    const frame = getFactFrameName(fact);
    if (!frame || fact.value == null) continue;
    tags.push(`${frame}:${fact.value}`);
    if (tags.length >= 3) break;
  }
  return tags.length ? ` [${tags.join(', ')}]` : '';
}

export function summarizeSemanticState(state) {
  if (!state) return null;
  const top = {};
  for (const [space, counts] of Object.entries(state.counts ?? {})) {
    top[space] = topFromCounts(counts);
  }
  const series = {};
  for (const [space, values] of Object.entries(state.series ?? {})) {
    series[space] = values.slice(-12);
  }
  const relations = {};
  for (const [space, map] of Object.entries(state.relations ?? {})) {
    const rows = Object.entries(map)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 3)
      .map(([pair, value]) => ({ pair, value }));
    if (rows.length > 0) relations[space] = rows;
  }
  return {
    top,
    last: state.last ?? {},
    series,
    relations,
    byEntity: state.byEntity ?? {},
    flags: state.flags ?? {}
  };
}
