import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { VSABrains } from '../src/index.mjs';
import {
  makeExp2Vocabulary,
  makeCorefState,
  eventToStepInput
} from '../eval/exp2-narrative/encoding.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

const PORT = Number(process.env.PORT ?? 8787);
const DEFAULT_STORY_EVENTS = 1_000;
const MAX_STORY_EVENTS = 10_000;
const DEFAULT_PERF_RUNS = 500;
const MAX_PERF_RUNS = 20_000;
const MAX_COLUMNS = 9;

const BASE_ENTITIES = ['Alice', 'Bob', 'Charlie', 'Dana', 'Eli', 'Mara', 'Nora', 'Iris'];
const BASE_LOCATIONS = ['room_A', 'room_B', 'garden', 'lab', 'hall', 'library', 'kitchen', 'yard'];
const BASE_ITEMS = ['key', 'map', 'torch', 'apple', 'coin', 'ring', 'book', 'badge'];

const ACTION_DEFS = [
  { id: 'enters', objectType: 'location' },
  { id: 'moves_to', objectType: 'location' },
  { id: 'picks_up', objectType: 'item' },
  { id: 'drops', objectType: 'item' },
  { id: 'dies', objectType: 'none' },
  { id: 'revives', objectType: 'none' }
];

const DEMO_CONFIG = {
  numColumns: 3,
  mapConfig: { width: 64, height: 64, k: 4 },
  displacement: { contextLength: 2, maxStep: 3, seed: 7, avoidZeroStep: true },
  checkpoint: { policy: 'adaptive', interval: 100, minInterval: 20, maxInterval: 200 },
  episodicStore: { maxChunks: 2_000_000 },
  writePolicy: 'stepTokenOnly'
};

const sessions = new Map();

function getSessionId(req) {
  const raw = req.headers['x-session-id'];
  if (!raw) return 'default';
  return String(raw);
}

function createSession(id) {
  const session = {
    id,
    currentConfig: { ...DEMO_CONFIG },
    world: null,
    brain: null,
    vocab: null,
    corefState: null,
    history: [],
    stepTokens: [],
    contradictions: [],
    storyState: null,
    lastMode: 'consistent',
    lastQueryStats: null,
    snapshotCache: { step: -1, state: null }
  };
  initSession(session, {});
  return session;
}

function getSession(req) {
  const id = getSessionId(req);
  let session = sessions.get(id);
  if (!session) {
    session = createSession(id);
    sessions.set(id, session);
  }
  return session;
}

function makeRng(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

function shuffle(rng, list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildOffsets(numColumns, mapConfig) {
  const margin = 6;
  const spanX = Math.max(1, mapConfig.width - margin * 2);
  const spanY = Math.max(1, mapConfig.height - margin * 2);
  const offsets = [];
  for (let i = 0; i < numColumns; i++) {
    const t = numColumns === 1 ? 0.5 : i / (numColumns - 1);
    offsets.push({
      x: Math.round(margin + spanX * t),
      y: Math.round(margin + spanY * (0.3 + 0.4 * t))
    });
  }
  return offsets;
}

function buildWorld(seed = Date.now()) {
  const rng = makeRng(seed);
  const entityCount = Math.max(3, Math.min(6, 3 + Math.floor(rng() * 4)));
  const locationCount = Math.max(3, Math.min(6, 3 + Math.floor(rng() * 4)));
  const itemCount = Math.max(3, Math.min(6, 3 + Math.floor(rng() * 4)));

  const entities = shuffle(rng, BASE_ENTITIES).slice(0, entityCount);
  const locations = shuffle(rng, BASE_LOCATIONS).slice(0, locationCount);
  const items = shuffle(rng, BASE_ITEMS).slice(0, itemCount);

  const actions = shuffle(rng, ACTION_DEFS).slice(0, 5);
  if (!actions.find((a) => a.id === 'dies')) actions.push({ id: 'dies', objectType: 'none' });
  if (!actions.find((a) => a.id === 'revives')) actions.push({ id: 'revives', objectType: 'none' });
  if (!actions.find((a) => a.id === 'enters')) actions.push({ id: 'enters', objectType: 'location' });
  if (!actions.find((a) => a.id === 'moves_to')) actions.push({ id: 'moves_to', objectType: 'location' });

  return { seed, entities, locations, items, actions };
}

function initStoryState(session) {
  const entities = {};
  const items = {};
  for (const id of session.world.entities) {
    entities[id] = { location: null, inventory: [], alive: true };
  }
  for (const id of session.world.items) {
    items[id] = { location: null, heldBy: null };
  }
  return { entities, items };
}

function resetSnapshotCache(session) {
  session.snapshotCache = { step: -1, state: initStoryState(session) };
}

function clampColumns(session, value, fallback = session.currentConfig.numColumns) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return clamp(fallback, 1, MAX_COLUMNS);
  return clamp(Math.floor(numeric), 1, MAX_COLUMNS);
}

function clampStoryCount(value, fallback = DEFAULT_STORY_EVENTS) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return clamp(fallback, 1, MAX_STORY_EVENTS);
  return clamp(Math.floor(numeric), 1, MAX_STORY_EVENTS);
}

function normalizeMode(mode) {
  return mode === 'contradicting' ? 'contradicting' : 'consistent';
}

function initSession(session, { seed, numColumns } = {}) {
  if (seed != null) {
    session.world = buildWorld(seed);
  } else if (!session.world) {
    session.world = buildWorld();
  }

  const nextColumns = clampColumns(session, numColumns, session.currentConfig.numColumns);
  session.currentConfig = {
    ...DEMO_CONFIG,
    ...session.currentConfig,
    numColumns: nextColumns
  };

  session.vocab = makeExp2Vocabulary();
  session.corefState = makeCorefState();
  const vocab = session.vocab;
  const corefState = session.corefState;
  session.brain = new VSABrains({
    ...session.currentConfig,
    columnOffsets: buildOffsets(session.currentConfig.numColumns, session.currentConfig.mapConfig),
    vocabulary: vocab,
    eventToStepInput: (event) => eventToStepInput(event, vocab, corefState)
  });

  session.history = [];
  session.stepTokens = [];
  session.contradictions = [];
  session.storyState = initStoryState(session);
  session.lastQueryStats = null;
  resetSnapshotCache(session);
}

function describeEvent(event) {
  if (event.action === 'dies') return `${event.subject} dies`;
  if (event.action === 'revives') return `${event.subject} revives`;
  if (event.action === 'picks_up') return `${event.subject} picks up ${event.object}`;
  if (event.action === 'drops') return `${event.subject} drops ${event.object}`;
  if (event.action === 'enters') return `${event.subject} enters ${event.object}`;
  if (event.action === 'moves_to') return `${event.subject} moves to ${event.object}`;
  return `${event.subject} ${event.action} ${event.object ?? ''}`.trim();
}

function detectContradictions(session, event) {
  const reasons = [];
  const entity = session.storyState.entities[event.subject];
  const item = event.object ? session.storyState.items[event.object] : null;

  if (!entity) {
    reasons.push('unknown_entity');
  } else {
    if (entity.alive === false && event.action !== 'revives') {
      reasons.push('dead_entity_action');
    }
    if (event.action === 'dies' && entity.alive === false) {
      reasons.push('double_death');
    }
    if (event.action === 'revives' && entity.alive === true) {
      reasons.push('revive_alive');
    }
  }

  if (event.action === 'picks_up' && item) {
    if (item.heldBy && item.heldBy !== event.subject) {
      reasons.push('item_already_held');
    }
  }

  if (event.action === 'drops' && entity && item) {
    if (!entity.inventory.includes(event.object)) {
      reasons.push('drop_without_item');
    }
  }

  return reasons;
}

function applyEventToState(state, event) {
  const entity = state.entities[event.subject];
  if (!entity) return;

  switch (event.action) {
    case 'enters':
    case 'moves_to': {
      entity.location = event.object;
      break;
    }
    case 'picks_up': {
      const item = state.items[event.object];
      if (!item) break;
      if (!entity.inventory.includes(event.object)) {
        entity.inventory.push(event.object);
      }
      item.heldBy = event.subject;
      item.location = null;
      break;
    }
    case 'drops': {
      const item = state.items[event.object];
      if (!item) break;
      entity.inventory = entity.inventory.filter((i) => i !== event.object);
      item.heldBy = null;
      item.location = entity.location;
      break;
    }
    case 'dies': {
      entity.alive = false;
      break;
    }
    case 'revives': {
      entity.alive = true;
      break;
    }
    default:
      break;
  }
}

async function addEvent(session, event) {
  const reasons = detectContradictions(session, event);
  applyEventToState(session.storyState, event);

  const stepInput = await session.brain.step({ event });
  const state = session.brain.getState();
  const step = state.step - 1;
  const stepTokenId = stepInput?.stepTokenId ?? null;
  if (stepTokenId != null) session.stepTokens.push(stepTokenId);

  const previousStep = step - 1;
  if (session.snapshotCache.state && session.snapshotCache.step === previousStep) {
    applyEventToState(session.snapshotCache.state, event);
    session.snapshotCache.step = step;
  }

  const entry = {
    step,
    event,
    text: describeEvent(event),
    reasons,
    locations: state.columns.map((column) => column.location),
    stepTokenId
  };
  session.history.push(entry);

  if (reasons.length > 0) {
    session.contradictions.push({
      step,
      text: entry.text,
      reasons
    });
  }

  return entry;
}

function randomEvent(session, rng, allowAbsurd = true) {
  const subject = pick(rng, session.world.entities);
  const action = pick(rng, session.world.actions).id;
  const actionDef = ACTION_DEFS.find((a) => a.id === action) ?? { objectType: 'none' };

  let object = null;
  if (actionDef.objectType === 'location') {
    object = pick(rng, session.world.locations);
  }
  if (actionDef.objectType === 'item') {
    object = pick(rng, session.world.items);
  }

  if (allowAbsurd && rng() < 0.2) {
    const deadEntities = Object.entries(session.storyState.entities)
      .filter(([, data]) => data.alive === false)
      .map(([id]) => id);
    if (deadEntities.length > 0) {
      const absurdAction = pick(rng, ['moves_to', 'picks_up', 'drops']);
      let absurdObject = null;
      if (absurdAction === 'moves_to') absurdObject = pick(rng, session.world.locations);
      if (absurdAction === 'picks_up' || absurdAction === 'drops') absurdObject = pick(rng, session.world.items);
      return {
        subject: pick(rng, deadEntities),
        action: absurdAction,
        object: absurdObject
      };
    }
  }

  return { subject, action, object };
}

function safeEvent(session, rng) {
  const entities = session.world.entities;
  const items = session.world.items;
  const locations = session.world.locations;

  const subject = pick(rng, entities);
  const entity = session.storyState.entities[subject];
  if (!entity) return { subject, action: 'enters', object: pick(rng, locations) };

  if (entity.alive === false) {
    return { subject, action: 'revives', object: null };
  }

  const roll = rng();
  if (roll < 0.35) {
    return { subject, action: 'moves_to', object: pick(rng, locations) };
  }
  if (roll < 0.6) {
    const available = items.filter((id) => {
      const item = session.storyState.items[id];
      return item && item.heldBy == null;
    });
    if (available.length > 0) {
      return { subject, action: 'picks_up', object: pick(rng, available) };
    }
    return { subject, action: 'moves_to', object: pick(rng, locations) };
  }
  if (entity.inventory.length > 0) {
    return { subject, action: 'drops', object: pick(rng, entity.inventory) };
  }
  return { subject, action: 'enters', object: pick(rng, locations) };
}

async function generateEvents(session, count, seed, allowAbsurd = true) {
  const rng = makeRng(seed ?? Date.now());
  const total = clampStoryCount(count, DEFAULT_STORY_EVENTS);
  for (let i = 0; i < total; i += 1) {
    if (allowAbsurd) {
      await addEvent(session, randomEvent(session, rng, true));
    } else {
      let event = safeEvent(session, rng);
      let attempts = 0;
      while (detectContradictions(session, event).length > 0 && attempts < 10) {
        event = safeEvent(session, rng);
        attempts += 1;
      }
      await addEvent(session, event);
    }
  }
}

function formatStoryText(session) {
  const worldLines = [
    `World seed: ${session.world.seed}`,
    `Entities: ${session.world.entities.join(', ')}`,
    `Locations: ${session.world.locations.join(', ')}`,
    `Items: ${session.world.items.join(', ')}`,
    `Actions: ${session.world.actions.map((a) => a.id).join(', ')}`
  ];
  const storyLines = session.history.map((entry) => {
    const flag = entry.reasons.length > 0 ? '⚠' : '•';
    const reasons = entry.reasons.length > 0 ? ` [${entry.reasons.join(', ')}]` : '';
    return `${flag} #${entry.step} ${entry.text}${reasons}`;
  });
  if (storyLines.length === 0) storyLines.push('No events yet.');
  return [...worldLines, '', 'Story:', ...storyLines].join('\n');
}

function formatContradictionsText(session) {
  if (session.contradictions.length === 0) return 'No contradictions detected.';
  return session.contradictions
    .map((entry) => `#${entry.step} ${entry.text} → ${entry.reasons.join(', ')}`)
    .join('\n');
}

function cloneState(state) {
  return {
    entities: Object.fromEntries(Object.entries(state.entities).map(([id, data]) => [id, {
      location: data.location,
      inventory: [...data.inventory],
      alive: data.alive
    }])),
    items: Object.fromEntries(Object.entries(state.items).map(([id, data]) => [id, {
      location: data.location,
      heldBy: data.heldBy
    }]))
  };
}

function stateAtStep(session, targetStep) {
  if (session.history.length === 0) {
    return cloneState(initStoryState(session));
  }

  const limit = Math.max(
    0,
    Math.min(session.history.length - 1, Number.isFinite(targetStep) ? targetStep : session.history.length - 1)
  );
  if (!session.snapshotCache.state) resetSnapshotCache(session);

  if (limit < session.snapshotCache.step) {
    resetSnapshotCache(session);
  }

  for (let i = session.snapshotCache.step + 1; i <= limit; i += 1) {
    applyEventToState(session.snapshotCache.state, session.history[i].event);
  }
  session.snapshotCache.step = limit;

  return cloneState(session.snapshotCache.state);
}

function parseTargetStep(session, stepValue) {
  if (stepValue === undefined || stepValue === null || stepValue === '') {
    return session.history.length - 1;
  }
  const numeric = Number(stepValue);
  if (!Number.isFinite(numeric)) return session.history.length - 1;
  return Math.max(0, Math.min(Math.floor(numeric), session.history.length - 1));
}

function packLocKey(x, y) {
  return (((x & 0xffff) << 16) | (y & 0xffff)) >>> 0;
}

function corruptWindow(session, windowTokens, rng, noiseRate) {
  const maxId = Math.max(6, session.vocab?.nextId ?? 6);
  return windowTokens.map((tokenId) => {
    if (rng() >= noiseRate) return tokenId;
    const span = Math.max(1, maxId - 4);
    return 4 + Math.floor(rng() * span);
  });
}

function naiveListLocalize(list, windowTokens) {
  let bestIndex = 0;
  let bestScore = -1;
  let comparisons = 0;
  const limit = Math.max(0, list.length - windowTokens.length);
  for (let i = 0; i <= limit; i += 1) {
    let score = 0;
    for (let j = 0; j < windowTokens.length; j += 1) {
      comparisons += 1;
      if (list[i + j] === windowTokens[j]) score += 1;
    }
    if (score > bestScore || (score === bestScore && i > bestIndex)) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return { bestIndex, bestScore, comparisons };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function computeLocalizationMetrics(session, targetStep, payload) {
  if (!session.history.length || !session.stepTokens.length) return null;

  const windowSizeRaw = Number(payload.windowSize ?? 6);
  const windowSize = clamp(Number.isFinite(windowSizeRaw) ? windowSizeRaw : 6, 4, 12);
  if (targetStep < windowSize - 1) {
    return {
      windowSize,
      noiseRate: payload.noiseRate ?? 0.25,
      note: `Need at least ${windowSize} steps for localization metrics.`
    };
  }

  const noiseRaw = Number(payload.noiseRate ?? 0.25);
  const noiseRate = clamp(Number.isFinite(noiseRaw) ? noiseRaw : 0.25, 0, 0.6);
  const windowStart = targetStep - windowSize + 1;
  const cleanWindow = session.stepTokens.slice(windowStart, targetStep + 1);
  const list = session.stepTokens.slice(0, targetStep + 1);

  const rng = makeRng(targetStep * 2654435761);
  const noisyWindow = corruptWindow(session, cleanWindow, rng, noiseRate);

  const perfRunsRaw = Number(payload.perfRuns ?? DEFAULT_PERF_RUNS);
  const perfRuns = clamp(
    Number.isFinite(perfRunsRaw) ? Math.floor(perfRunsRaw) : DEFAULT_PERF_RUNS,
    1,
    MAX_PERF_RUNS
  );

  const targetLoc = session.history[targetStep]?.locations?.[0];
  const targetLocKey = targetLoc ? packLocKey(targetLoc.x, targetLoc.y) : null;

  const localizeOnce = (debug) => {
    const votes = [];
    let scoredLocationsSum = 0;
    let perTokenCandidatesSum = 0;
    let columnsUsed = 0;
    for (const column of session.brain.columns) {
      const result = session.brain.localizer._localizeColumn(
        noisyWindow,
        column,
        5,
        { ...(session.currentConfig.localization ?? {}), debug }
      );
      const candidates = result.candidates ?? [];
      const top1 = candidates[0];
      if (top1?.locKey != null) {
        votes.push({ value: top1.locKey, weight: top1.score ?? 1 });
      }
      if (debug) {
        const perTokenCandidates = result.stats?.perTokenCandidates ?? [];
        const perTokenMean = perTokenCandidates.length > 0
          ? perTokenCandidates.reduce((sum, v) => sum + v, 0) / perTokenCandidates.length
          : 0;
        const scoredLocations = result.stats?.scoredLocations ?? candidates.length;
        perTokenCandidatesSum += perTokenMean;
        scoredLocationsSum += scoredLocations;
        columnsUsed += 1;
      }
    }
    const winner = votes.length > 0 ? session.brain.voter.vote(votes) : null;
    const vsaPerTokenCandidates = columnsUsed > 0 ? perTokenCandidatesSum / columnsUsed : 0;
    return {
      winner,
      vsaScoredLocations: scoredLocationsSum,
      vsaPerTokenCandidates,
    };
  };

  const debugRun = localizeOnce(true);
  const winner = debugRun.winner;
  const vsaScoredLocations = debugRun.vsaScoredLocations;
  const vsaPerTokenCandidates = debugRun.vsaPerTokenCandidates;

  const baseline = naiveListLocalize(list, noisyWindow);

  const vsaStart = performance.now();
  for (let i = 0; i < perfRuns; i += 1) {
    localizeOnce(false);
  }
  const vsaTimeMs = performance.now() - vsaStart;

  const naiveStart = performance.now();
  for (let i = 0; i < perfRuns; i += 1) {
    naiveListLocalize(list, noisyWindow);
  }
  const naiveTimeMs = performance.now() - naiveStart;
  const predictedStep = baseline.bestIndex + windowSize - 1;
  const naiveCorrect = baseline.bestScore === windowSize && predictedStep === targetStep;

  const workRatio = vsaScoredLocations > 0 ? baseline.comparisons / vsaScoredLocations : null;
  const vsaCorrect = targetLocKey != null && winner?.value === targetLocKey;

  return {
    targetStep,
    windowSize,
    noiseRate,
    perfRuns,
    vsaTimeMs,
    naiveTimeMs,
    vsaScoredLocations,
    vsaPerTokenCandidates,
    naiveComparisons: baseline.comparisons,
    workRatio,
    vsaCorrect,
    naiveCorrect,
    targetLocKey,
    vsaWinnerLocKey: winner?.value ?? null,
    naiveBestScore: baseline.bestScore
  };
}

async function handleQuery(session, payload) {
  const type = payload.type;
  const entity = payload.entity;
  const item = payload.item;
  const location = payload.location;
  const targetStep = parseTargetStep(session, payload.step);

  if (!session.history.length) {
    session.lastQueryStats = null;
    return { answerText: 'No events yet.', metrics: null };
  }

  const snapshot = stateAtStep(session, targetStep);
  const metrics = computeLocalizationMetrics(session, targetStep, payload);
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

  return respond('Unknown query.');
}

async function getStatePayload(session) {
  const state = session.brain.getState();
  return {
    step: state.step,
    numColumns: session.currentConfig.numColumns,
    columns: state.columns.map((column) => column.location),
    mapConfig: session.currentConfig.mapConfig,
    history: session.history.map((entry) => ({ locations: entry.locations })),
    historyLength: session.history.length,
    contradictionsCount: session.contradictions.length,
    storyText: formatStoryText(session),
    contradictionsText: formatContradictionsText(session),
    lastQueryStats: session.lastQueryStats,
    world: {
      entities: session.world?.entities ?? [],
      locations: session.world?.locations ?? [],
      items: session.world?.items ?? []
    }
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function sendError(res, status, message) {
  sendJson(res, status, { ok: false, error: message });
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function rebuildBrainWithEvents(session, { seed, numColumns, events }) {
  initSession(session, { seed, numColumns });
  for (const event of events) {
    await addEvent(session, event);
  }
  return getStatePayload(session);
}

async function handleApi(req, res, url) {
  const session = getSession(req);

  if (req.method === 'GET' && url.pathname === '/api/state') {
    const payload = await getStatePayload(session);
    return sendJson(res, 200, payload);
  }

  if (req.method === 'POST' && url.pathname === '/api/query') {
    try {
      const body = await readJson(req);
      const result = await handleQuery(session, body);
      return sendJson(res, 200, { ok: true, ...result });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/config') {
    try {
      const body = await readJson(req);
      const events = session.history.map((entry) => entry.event);
      const seed = session.world?.seed;
      const numColumns = clampColumns(session, body.numColumns, session.currentConfig.numColumns);
      const payload = await rebuildBrainWithEvents(session, { seed, numColumns, events });
      return sendJson(res, 200, { ok: true, state: payload });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/story/generate') {
    try {
      const body = await readJson(req);
      const mode = normalizeMode(body.mode);
      session.lastMode = mode;
      const numColumns = clampColumns(session, body.numColumns, session.currentConfig.numColumns);
      initSession(session, { seed: body.seed, numColumns });
      const count = clampStoryCount(body.length, DEFAULT_STORY_EVENTS);
      const eventSeed = body.seed ?? session.world.seed;
      await generateEvents(session, count, eventSeed, mode === 'contradicting');
      const payload = await getStatePayload(session);
      return sendJson(res, 200, { ok: true, state: payload });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/story/append') {
    try {
      const body = await readJson(req);
      const mode = normalizeMode(body.mode ?? session.lastMode);
      const count = clampStoryCount(body.count, DEFAULT_STORY_EVENTS);
      const eventSeed = body.seed ?? Date.now();
      await generateEvents(session, count, eventSeed, mode === 'contradicting');
      const payload = await getStatePayload(session);
      return sendJson(res, 200, { ok: true, state: payload });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  return sendError(res, 404, 'Not found');
}

async function handleStatic(req, res, url) {
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = decodeURIComponent(filePath);
  const resolvedPath = path.normalize(path.join(publicDir, filePath));

  if (!resolvedPath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  try {
    const stat = await fs.stat(resolvedPath);
    if (stat.isDirectory()) {
      return handleStatic(req, res, new URL('/index.html', url));
    }
    const data = await fs.readFile(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.svg': 'image/svg+xml'
    }[ext] ?? 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store'
    });
    res.end(data);
  } catch (err) {
    res.writeHead(404);
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) {
    return handleApi(req, res, url);
  }
  return handleStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`VSABrains demo running on http://localhost:${PORT}`);
});
