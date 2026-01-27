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
  writePolicy: 'stepTokenOnly'
};

let currentConfig = { ...DEMO_CONFIG };
let world = null;
let brain = null;
let vocab = null;
let corefState = null;
let history = [];
let stepTokens = [];
let contradictions = [];
let storyState = null;
let lastMode = 'consistent';
let lastQueryStats = null;

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

function initStoryState() {
  const entities = {};
  const items = {};
  for (const id of world.entities) {
    entities[id] = { location: null, inventory: [], alive: true };
  }
  for (const id of world.items) {
    items[id] = { location: null, heldBy: null };
  }
  return { entities, items };
}

function initDemo({ seed, numColumns } = {}) {
  if (seed != null) {
    world = buildWorld(seed);
  } else if (!world) {
    world = buildWorld();
  }

  currentConfig = {
    ...currentConfig,
    numColumns: Number.isFinite(numColumns) ? Math.max(1, Math.min(9, numColumns)) : currentConfig.numColumns
  };

  vocab = makeExp2Vocabulary();
  corefState = makeCorefState();
  brain = new VSABrains({
    ...currentConfig,
    columnOffsets: buildOffsets(currentConfig.numColumns, currentConfig.mapConfig),
    vocabulary: vocab,
    eventToStepInput: (event) => eventToStepInput(event, vocab, corefState)
  });

  history = [];
  stepTokens = [];
  contradictions = [];
  storyState = initStoryState();
  lastQueryStats = null;
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

function detectContradictions(event) {
  const reasons = [];
  const entity = storyState.entities[event.subject];
  const item = event.object ? storyState.items[event.object] : null;

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

async function addEvent(event) {
  const reasons = detectContradictions(event);
  applyEventToState(storyState, event);

  const stepInput = await brain.step({ event });
  const state = brain.getState();
  const step = state.step - 1;
  const stepTokenId = stepInput?.stepTokenId ?? null;
  if (stepTokenId != null) stepTokens.push(stepTokenId);
  const entry = {
    step,
    event,
    text: describeEvent(event),
    reasons,
    locations: state.columns.map((column) => column.location),
    stepTokenId
  };
  history.push(entry);

  if (reasons.length > 0) {
    contradictions.push({
      step,
      text: entry.text,
      reasons
    });
  }

  return entry;
}

function randomEvent(rng, allowAbsurd = true) {
  const subject = pick(rng, world.entities);
  const action = pick(rng, world.actions).id;
  const actionDef = ACTION_DEFS.find((a) => a.id === action) ?? { objectType: 'none' };

  let object = null;
  if (actionDef.objectType === 'location') {
    object = pick(rng, world.locations);
  }
  if (actionDef.objectType === 'item') {
    object = pick(rng, world.items);
  }

  if (allowAbsurd && rng() < 0.2) {
    const deadEntities = Object.entries(storyState.entities)
      .filter(([, data]) => data.alive === false)
      .map(([id]) => id);
    if (deadEntities.length > 0) {
      const absurdAction = pick(rng, ['moves_to', 'picks_up', 'drops']);
      let absurdObject = null;
      if (absurdAction === 'moves_to') absurdObject = pick(rng, world.locations);
      if (absurdAction === 'picks_up' || absurdAction === 'drops') absurdObject = pick(rng, world.items);
      return {
        subject: pick(rng, deadEntities),
        action: absurdAction,
        object: absurdObject
      };
    }
  }

  return { subject, action, object };
}

function safeEvent(rng) {
  const entities = world.entities;
  const items = world.items;
  const locations = world.locations;

  const subject = pick(rng, entities);
  const entity = storyState.entities[subject];
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
      const item = storyState.items[id];
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

async function generateEvents(count, seed, allowAbsurd = true) {
  const rng = makeRng(seed ?? Date.now());
  const total = Math.max(1, Math.min(500, Number(count) || 1));
  for (let i = 0; i < total; i += 1) {
    if (allowAbsurd) {
      await addEvent(randomEvent(rng, true));
    } else {
      let event = safeEvent(rng);
      let attempts = 0;
      while (detectContradictions(event).length > 0 && attempts < 10) {
        event = safeEvent(rng);
        attempts += 1;
      }
      await addEvent(event);
    }
  }
}

function formatStoryText() {
  const worldLines = [
    `World seed: ${world.seed}`,
    `Entities: ${world.entities.join(', ')}`,
    `Locations: ${world.locations.join(', ')}`,
    `Items: ${world.items.join(', ')}`,
    `Actions: ${world.actions.map((a) => a.id).join(', ')}`
  ];
  const storyLines = history.map((entry) => {
    const flag = entry.reasons.length > 0 ? '⚠' : '•';
    const reasons = entry.reasons.length > 0 ? ` [${entry.reasons.join(', ')}]` : '';
    return `${flag} #${entry.step} ${entry.text}${reasons}`;
  });
  if (storyLines.length === 0) storyLines.push('No events yet.');
  return [...worldLines, '', 'Story:', ...storyLines].join('\n');
}

function formatContradictionsText() {
  if (contradictions.length === 0) return 'No contradictions detected.';
  return contradictions
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

function stateAtStep(targetStep) {
  const temp = initStoryState();
  const limit = Math.max(0, Math.min(history.length - 1, Number.isFinite(targetStep) ? targetStep : history.length - 1));
  for (let i = 0; i <= limit; i += 1) {
    applyEventToState(temp, history[i].event);
  }
  return cloneState(temp);
}

function parseTargetStep(stepValue) {
  if (stepValue === undefined || stepValue === null || stepValue === '') {
    return history.length - 1;
  }
  const numeric = Number(stepValue);
  if (!Number.isFinite(numeric)) return history.length - 1;
  return Math.max(0, Math.min(Math.floor(numeric), history.length - 1));
}

function packLocKey(x, y) {
  return (((x & 0xffff) << 16) | (y & 0xffff)) >>> 0;
}

function corruptWindow(windowTokens, rng, noiseRate) {
  const maxId = Math.max(6, vocab?.nextId ?? 6);
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

function computeLocalizationMetrics(targetStep, payload) {
  if (!history.length || !stepTokens.length) return null;

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
  const cleanWindow = stepTokens.slice(windowStart, targetStep + 1);
  const list = stepTokens.slice(0, targetStep + 1);

  const rng = makeRng(targetStep * 2654435761);
  const noisyWindow = corruptWindow(cleanWindow, rng, noiseRate);

  const targetLoc = history[targetStep]?.locations?.[0];
  const targetLocKey = targetLoc ? packLocKey(targetLoc.x, targetLoc.y) : null;

  const vsaStart = performance.now();
  const votes = [];
  let vsaScoredLocations = 0;
  let vsaPerTokenCandidatesAvg = 0;
  let vsaColumnsUsed = 0;
  for (const column of brain.columns) {
    const debugResult = brain.localizer._localizeColumn(
      noisyWindow,
      column,
      5,
      { ...(currentConfig.localization ?? {}), debug: true }
    );
    const candidates = debugResult.candidates ?? [];
    const top1 = candidates[0];
    if (top1?.locKey != null) {
      votes.push({ value: top1.locKey, weight: top1.score ?? 1 });
    }
    const perTokenCandidates = debugResult.stats?.perTokenCandidates ?? [];
    const perTokenMean = perTokenCandidates.length > 0
      ? perTokenCandidates.reduce((sum, v) => sum + v, 0) / perTokenCandidates.length
      : 0;
    const scoredLocations = debugResult.stats?.scoredLocations ?? candidates.length;
    vsaPerTokenCandidatesAvg += perTokenMean;
    vsaScoredLocations += scoredLocations;
    vsaColumnsUsed += 1;
  }
  const winner = votes.length > 0 ? brain.voter.vote(votes) : null;
  const vsaTimeMs = performance.now() - vsaStart;
  const vsaPerTokenCandidates = vsaColumnsUsed > 0 ? vsaPerTokenCandidatesAvg / vsaColumnsUsed : 0;

  const naiveStart = performance.now();
  const baseline = naiveListLocalize(list, noisyWindow);
  const naiveTimeMs = performance.now() - naiveStart;
  const predictedStep = baseline.bestIndex + windowSize - 1;
  const naiveCorrect = baseline.bestScore === windowSize && predictedStep === targetStep;

  const workRatio = vsaScoredLocations > 0 ? baseline.comparisons / vsaScoredLocations : null;
  const vsaCorrect = targetLocKey != null && winner?.value === targetLocKey;

  return {
    targetStep,
    windowSize,
    noiseRate,
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

async function handleQuery(payload) {
  const type = payload.type;
  const entity = payload.entity;
  const item = payload.item;
  const location = payload.location;
  const targetStep = parseTargetStep(payload.step);

  if (!history.length) {
    lastQueryStats = null;
    return { answerText: 'No events yet.', metrics: null };
  }

  const snapshot = stateAtStep(targetStep);
  const metrics = computeLocalizationMetrics(targetStep, payload);

  if (type === 'where' || type === 'whereAt') {
    if (!snapshot.entities[entity]) {
      lastQueryStats = metrics;
      return { answerText: `Unknown entity: ${entity}`, metrics };
    }
    const loc = snapshot.entities[entity].location ?? 'unknown';
    lastQueryStats = metrics;
    return { answerText: `${entity} is at ${loc} (step ${targetStep}).`, metrics };
  }

  if (type === 'entitiesAt') {
    const list = Object.entries(snapshot.entities)
      .filter(([, data]) => data.location === location)
      .map(([id]) => id);
    lastQueryStats = metrics;
    return { answerText: (list.length > 0 ? `${location}: ${list.join(', ')}` : `${location}: nobody.`), metrics };
  }

  if (type === 'inventory') {
    const inv = snapshot.entities[entity]?.inventory ?? null;
    if (!inv) {
      lastQueryStats = metrics;
      return { answerText: `Unknown entity: ${entity}`, metrics };
    }
    lastQueryStats = metrics;
    return { answerText: (inv.length > 0 ? `${entity} has ${inv.join(', ')}` : `${entity} has nothing.`), metrics };
  }

  if (type === 'whoHas') {
    const holder = snapshot.items[item]?.heldBy ?? null;
    lastQueryStats = metrics;
    return { answerText: (holder ? `${item} is held by ${holder}.` : `${item} is not held.`), metrics };
  }

  if (type === 'itemLocation') {
    const itemState = snapshot.items[item];
    if (!itemState) {
      lastQueryStats = metrics;
      return { answerText: `Unknown item: ${item}`, metrics };
    }
    let answerText = `${item} location unknown.`;
    if (itemState.heldBy) answerText = `${item} is held by ${itemState.heldBy}.`;
    else if (itemState.location) answerText = `${item} is at ${itemState.location}.`;
    lastQueryStats = metrics;
    return { answerText, metrics };
  }

  if (type === 'isAlive') {
    const alive = snapshot.entities[entity]?.alive;
    if (alive == null) {
      lastQueryStats = metrics;
      return { answerText: `Unknown entity: ${entity}`, metrics };
    }
    lastQueryStats = metrics;
    return { answerText: (alive ? `${entity} is alive.` : `${entity} is dead.`), metrics };
  }

  if (type === 'lastEvent') {
    const events = history.filter((entry) => entry.event.subject === entity);
    if (events.length === 0) {
      lastQueryStats = metrics;
      return { answerText: `${entity} has no events.`, metrics };
    }
    const last = events[events.length - 1];
    lastQueryStats = metrics;
    return { answerText: `Last: #${last.step} ${last.text}`, metrics };
  }

  if (type === 'timeline') {
    const limit = Math.max(1, Math.min(20, Number(payload.limit) || 6));
    const events = history.filter((entry) => entry.event.subject === entity).slice(-limit);
    if (!events.length) {
      lastQueryStats = metrics;
      return { answerText: `${entity} has no events.`, metrics };
    }
    lastQueryStats = metrics;
    return { answerText: events.map((entry) => `#${entry.step} ${entry.text}`).join('\n'), metrics };
  }

  if (type === 'contradictions') {
    lastQueryStats = metrics;
    return { answerText: formatContradictionsText(), metrics };
  }

  if (type === 'contradictionsFor') {
    const list = contradictions.filter((entry) => entry.text.startsWith(entity));
    const answerText = list.length === 0
      ? `No contradictions for ${entity}.`
      : list.map((entry) => `#${entry.step} ${entry.text} → ${entry.reasons.join(', ')}`).join('\n');
    lastQueryStats = metrics;
    return { answerText, metrics };
  }

  lastQueryStats = metrics;
  return { answerText: 'Unknown query.', metrics };
}

async function getStatePayload() {
  const state = brain.getState();
  return {
    step: state.step,
    numColumns: currentConfig.numColumns,
    columns: state.columns.map((column) => column.location),
    mapConfig: currentConfig.mapConfig,
    history: history.map((entry) => ({ locations: entry.locations })),
    contradictionsCount: contradictions.length,
    storyText: formatStoryText(),
    contradictionsText: formatContradictionsText(),
    lastQueryStats,
    world: {
      entities: world?.entities ?? [],
      locations: world?.locations ?? [],
      items: world?.items ?? []
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

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/state') {
    const payload = await getStatePayload();
    return sendJson(res, 200, payload);
  }

  if (req.method === 'POST' && url.pathname === '/api/query') {
    try {
      const body = await readJson(req);
      const result = await handleQuery(body);
      return sendJson(res, 200, { ok: true, ...result });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/config') {
    try {
      const body = await readJson(req);
      const nextColumns = Number(body.numColumns);
      const numColumns = Number.isFinite(nextColumns)
        ? Math.max(1, Math.min(9, Math.floor(nextColumns)))
        : currentConfig.numColumns;
      const events = history.map((entry) => entry.event);
      const seed = world?.seed;
      initDemo({ seed, numColumns });
      for (const event of events) {
        await addEvent(event);
      }
      const payload = await getStatePayload();
      return sendJson(res, 200, { ok: true, state: payload });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/story/generate') {
    try {
      const body = await readJson(req);
      const mode = body.mode === 'contradicting' ? 'contradicting' : 'consistent';
      lastMode = mode;
      initDemo({ seed: body.seed, numColumns: body.numColumns });
      await generateEvents(body.length ?? 32, body.seed ?? world.seed, mode === 'contradicting');
      const payload = await getStatePayload();
      return sendJson(res, 200, { ok: true, state: payload });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/story/append') {
    try {
      const body = await readJson(req);
      const mode = body.mode ?? lastMode;
      await generateEvents(body.count ?? 100, body.seed ?? Date.now(), mode === 'contradicting');
      const payload = await getStatePayload();
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
    res.writeHead(200, { 'Content-Type': contentType });
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

initDemo();

server.listen(PORT, () => {
  console.log(`VSABrains demo running on http://localhost:${PORT}`);
});
