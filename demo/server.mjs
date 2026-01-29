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
const MAX_COLUMNS = 9;
const FRAME_SEGMENT_LIMIT = 250;

const BASE_ENTITIES = ['Alice', 'Bob', 'Charlie', 'Dana', 'Eli', 'Mara', 'Nora', 'Iris'];
const BASE_LOCATIONS = ['room_A', 'room_B', 'garden', 'lab', 'hall', 'library', 'kitchen', 'yard'];
const BASE_ITEMS = ['key', 'map', 'torch', 'apple', 'coin', 'ring', 'book', 'badge'];

const LIT_ENTITIES = ['Marina', 'Julian', 'Evelyn', 'Silas', 'Clara', 'Theo', 'Inez', 'Rowan'];
const LIT_LOCATIONS = ['manor', 'garden', 'study', 'harbor', 'chapel', 'railway', 'attic', 'courtyard'];
const LIT_ITEMS = ['letter', 'ring', 'diary', 'portrait', 'keycard', 'lantern', 'map', 'seal'];

const CHAT_ENTITIES = ['User_A', 'User_B', 'User_C', 'Moderator'];
const CHAT_LOCATIONS = ['channel_alpha', 'channel_beta', 'helpdesk', 'general'];
const CHAT_TOPICS = ['release', 'deadline', 'budget', 'incident', 'policy', 'onboarding', 'quality', 'roadmap'];

const ACTION_DEFS = [
  { id: 'enters', objectType: 'location' },
  { id: 'moves_to', objectType: 'location' },
  { id: 'picks_up', objectType: 'item' },
  { id: 'drops', objectType: 'item' },
  { id: 'dies', objectType: 'none' },
  { id: 'revives', objectType: 'none' }
];

const LIT_ACTION_DEFS = [
  { id: 'enters', objectType: 'location' },
  { id: 'moves_to', objectType: 'location' },
  { id: 'picks_up', objectType: 'item' },
  { id: 'drops', objectType: 'item' },
  { id: 'dies', objectType: 'none' },
  { id: 'revives', objectType: 'none' },
  { id: 'confesses_to', objectType: 'entity' },
  { id: 'accuses', objectType: 'entity' },
  { id: 'betrays', objectType: 'entity' },
  { id: 'vows_to', objectType: 'entity' },
  { id: 'reveals_to', objectType: 'entity' },
  { id: 'consoles', objectType: 'entity' },
  { id: 'threatens', objectType: 'entity' }
];

const CHAT_ACTION_DEFS = [
  { id: 'says', objectType: 'item' },
  { id: 'asks', objectType: 'item' },
  { id: 'agrees', objectType: 'item' },
  { id: 'disagrees', objectType: 'item' },
  { id: 'apologizes', objectType: 'none' },
  { id: 'insults', objectType: 'entity' },
  { id: 'shares', objectType: 'item' },
  { id: 'moderates', objectType: 'entity' },
  { id: 'leaves', objectType: 'none' }
];

const LIT_THEMES = ['loss', 'betrayal', 'duty', 'memory', 'freedom', 'identity', 'justice', 'forgiveness'];
const LIT_EMOTIONS = ['grief', 'awe', 'fear', 'hope', 'anger', 'relief', 'tenderness'];
const LIT_TONES = ['somber', 'intimate', 'ironic', 'formal', 'tender', 'cold'];
const LIT_CONFLICTS = ['interpersonal', 'internal', 'societal', 'mystery'];
const LIT_MOTIFS = ['rain', 'mirror', 'letter', 'lock', 'shadow', 'clock'];
const LIT_PLOT_TURNS = ['reveal', 'reversal', 'twist', 'none'];

const CHAT_SENTIMENTS = ['positive', 'neutral', 'frustrated', 'anxious', 'defensive'];
const CHAT_POLITENESS = ['high', 'neutral', 'low'];
const CHAT_PERSUASION = ['logic', 'appeal', 'threat', 'emotion'];
const CHAT_RESOLUTION = ['unresolved', 'partial', 'resolved'];

const DEMO_CONFIG = {
  numColumns: 3,
  mapConfig: { width: 64, height: 64, k: 4 },
  displacement: { contextLength: 2, maxStep: 3, seed: 7, avoidZeroStep: true },
  checkpoint: { policy: 'adaptive', interval: 100, minInterval: 20, maxInterval: 200 },
  episodicStore: { maxChunks: 2_000_000 },
  writePolicy: 'stepTokenOnly'
};

const CONTENT_MODES = new Set(['synthetic', 'literature', 'chat']);
const SEMANTIC_SERIES_LIMIT = 200;

const PROFILE_DEFS = [
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'General-purpose frame mix for mixed content.',
    frames: [
      'emotionState', 'emotionIntensity', 'tensionLevel',
      'themeTags', 'conflictType', 'conflictEscalation',
      'dialogueAct', 'politenessLevel', 'stanceAgreement',
      'goalState', 'planProgress',
      'toneStyle', 'narrativePhase'
    ]
  },
  {
    id: 'literature-critic',
    label: 'Literature Critic',
    description: 'Focus on themes, tone, narrative arc, and character dynamics.',
    frames: [
      'emotionState', 'emotionIntensity', 'tensionLevel',
      'themeTags', 'motifRecurrence', 'moralTheme',
      'toneStyle', 'imageryDensity', 'rhetoricDevice',
      'narrativePhase', 'plotTurns', 'pacingTempo',
      'characterArc', 'narratorReliability',
      'conflictType', 'conflictEscalation',
      'powerBalance', 'hostilityRelation', 'allianceRelation'
    ]
  },
  {
    id: 'dialogue-analyst',
    label: 'Dialogue Analyst',
    description: 'Focus on conversational dynamics, agreement, and social signals.',
    frames: [
      'emotionState', 'tensionLevel',
      'dialogueAct', 'politenessLevel', 'stanceAgreement', 'persuasionTactic',
      'trustRelation', 'hostilityRelation', 'powerBalance',
      'conflictEscalation', 'goalState', 'planProgress',
      'narrativePhase', 'toneStyle'
    ]
  }
];

const DEFAULT_PROFILE_BY_MODE = {
  synthetic: 'balanced',
  literature: 'literature-critic',
  chat: 'dialogue-analyst'
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
    contentMode: 'synthetic',
    profileId: DEFAULT_PROFILE_BY_MODE.synthetic,
    activeFrames: new Set(),
    profileCnl: '',
    world: null,
    brain: null,
    vocab: null,
    corefState: null,
    history: [],
    stepTokens: [],
    contradictions: [],
    storyState: null,
    semanticFacts: [],
    semanticState: null,
    semanticCache: { step: -1, state: null, factIndex: -1 },
    activeFactsCount: 0,
    lastMode: 'consistent',
    lastQueryStats: null,
    snapshotCache: { step: -1, state: null },
    targetLength: DEFAULT_STORY_EVENTS
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

function normalizeContentMode(mode) {
  if (!mode) return 'synthetic';
  const normalized = String(mode).toLowerCase();
  return CONTENT_MODES.has(normalized) ? normalized : 'synthetic';
}

function getProfileById(id) {
  return PROFILE_DEFS.find((profile) => profile.id === id) ?? null;
}

function defaultProfileIdForMode(mode) {
  return DEFAULT_PROFILE_BY_MODE[mode] ?? 'balanced';
}

function buildProfileCnl(profile) {
  const lines = [];
  lines.push(`Profile ${profile.label} activates Frames: ${profile.frames.join(', ')}.`);
  lines.push(`Profile ${profile.label} suppresses Frames: all others.`);
  return lines.join('\n');
}

function setProfile(session, profileId) {
  const mode = session.contentMode ?? 'synthetic';
  const fallbackId = defaultProfileIdForMode(mode);
  const profile = getProfileById(profileId) ?? getProfileById(fallbackId) ?? PROFILE_DEFS[0];
  session.profileId = profile.id;
  session.activeFrames = new Set(profile.frames);
  session.profileCnl = buildProfileCnl(profile);
  rebuildSemanticState(session);
}

function buildWorld(seed = Date.now(), contentMode = 'synthetic') {
  const rng = makeRng(seed);
  const mode = normalizeContentMode(contentMode);
  const presets = {
    synthetic: { entities: BASE_ENTITIES, locations: BASE_LOCATIONS, items: BASE_ITEMS, actions: ACTION_DEFS },
    literature: { entities: LIT_ENTITIES, locations: LIT_LOCATIONS, items: LIT_ITEMS, actions: LIT_ACTION_DEFS },
    chat: { entities: CHAT_ENTITIES, locations: CHAT_LOCATIONS, items: CHAT_TOPICS, actions: CHAT_ACTION_DEFS }
  };
  const preset = presets[mode] ?? presets.synthetic;

  const entityCount = Math.max(3, Math.min(preset.entities.length, 3 + Math.floor(rng() * 4)));
  const locationCount = Math.max(3, Math.min(preset.locations.length, 3 + Math.floor(rng() * 4)));
  const itemCount = Math.max(3, Math.min(preset.items.length, 3 + Math.floor(rng() * 4)));

  const entities = shuffle(rng, preset.entities).slice(0, entityCount);
  const locations = shuffle(rng, preset.locations).slice(0, locationCount);
  const items = shuffle(rng, preset.items).slice(0, itemCount);

  const actions = shuffle(rng, preset.actions).slice(0, 8);
  for (const required of ['dies', 'revives', 'enters', 'moves_to']) {
    if (!actions.find((a) => a.id === required) && preset.actions.find((a) => a.id === required)) {
      actions.push(preset.actions.find((a) => a.id === required));
    }
  }

  return { seed, entities, locations, items, actions, mode };
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

function initSemanticState(mode) {
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

function resetSemanticCache(session) {
  session.semanticCache = {
    step: -1,
    state: initSemanticState(session.contentMode),
    factIndex: -1
  };
}

function getFactFrameName(fact) {
  return fact?.frame ?? fact?.space ?? null;
}

function isFrameActive(session, frameName) {
  if (!frameName) return false;
  if (!session.activeFrames || session.activeFrames.size === 0) return true;
  return session.activeFrames.has(frameName);
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

function initSession(session, { seed, numColumns, contentMode, profileId } = {}) {
  const nextMode = normalizeContentMode(contentMode ?? session.contentMode);
  session.contentMode = nextMode;
  if (seed != null) {
    session.world = buildWorld(seed, nextMode);
  } else if (!session.world || session.world?.mode !== nextMode) {
    session.world = buildWorld(Date.now(), nextMode);
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
  session.semanticFacts = [];
  session.semanticState = initSemanticState(nextMode);
  session.activeFactsCount = 0;
  session.frameSegments = {};
  session.lastQueryStats = null;
  session.litContext = null;
  session.chatContext = null;
  resetSnapshotCache(session);
  resetSemanticCache(session);
  setProfile(session, profileId ?? defaultProfileIdForMode(nextMode));
}

function describeEvent(event) {
  if (event.text) return event.text;
  if (event.action === 'dies') return `${event.subject} dies`;
  if (event.action === 'revives') return `${event.subject} revives`;
  if (event.action === 'picks_up') return `${event.subject} picks up ${event.object}`;
  if (event.action === 'drops') return `${event.subject} drops ${event.object}`;
  if (event.action === 'enters') return `${event.subject} enters ${event.object}`;
  if (event.action === 'moves_to') return `${event.subject} moves to ${event.object}`;
  if (event.action === 'confesses_to') return `${event.subject} confesses to ${event.object}`;
  if (event.action === 'accuses') return `${event.subject} accuses ${event.object}`;
  if (event.action === 'betrays') return `${event.subject} betrays ${event.object}`;
  if (event.action === 'vows_to') return `${event.subject} vows loyalty to ${event.object}`;
  if (event.action === 'reveals_to') return `${event.subject} reveals a secret to ${event.object}`;
  if (event.action === 'consoles') return `${event.subject} consoles ${event.object}`;
  if (event.action === 'threatens') return `${event.subject} threatens ${event.object}`;
  if (event.action === 'says') return `${event.subject} says something about ${event.object}`;
  if (event.action === 'asks') return `${event.subject} asks about ${event.object}`;
  if (event.action === 'agrees') return `${event.subject} agrees about ${event.object}`;
  if (event.action === 'disagrees') return `${event.subject} disagrees about ${event.object}`;
  if (event.action === 'apologizes') return `${event.subject} apologizes`;
  if (event.action === 'insults') return `${event.subject} insults ${event.object}`;
  if (event.action === 'shares') return `${event.subject} shares about ${event.object}`;
  if (event.action === 'moderates') return `${event.subject} moderates ${event.object}`;
  if (event.action === 'leaves') return `${event.subject} leaves the channel`;
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

function pairKey(a, b) {
  return [a, b].sort().join('|');
}

function ensureBucket(map, key) {
  if (!map[key]) map[key] = {};
  return map[key];
}

function ensureSeries(map, key) {
  if (!map[key]) map[key] = [];
  return map[key];
}

function applySemanticFact(state, fact) {
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

function applySemanticFactsToState(state, facts = []) {
  for (const fact of facts) {
    applySemanticFact(state, fact);
  }
}

function rebuildSemanticState(session) {
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

function semanticStateAtStep(session, targetStep) {
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

function naiveSemanticReplayToStep(session, targetStep) {
  const state = initSemanticState(session.contentMode);
  const limit = clamp(targetStep, 0, session.history.length - 1);
  for (const fact of session.semanticFacts) {
    if (fact.step > limit) break;
    if (!isFrameActive(session, getFactFrameName(fact))) continue;
    applySemanticFact(state, fact);
  }
  return state;
}

function detectSemanticContradictions(session, event, semanticFacts = []) {
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

function summarizeSemanticFacts(facts = []) {
  const tags = [];
  for (const fact of facts) {
    const frame = getFactFrameName(fact);
    if (!frame || fact.value == null) continue;
    tags.push(`${frame}:${fact.value}`);
    if (tags.length >= 3) break;
  }
  return tags.length ? ` [${tags.join(', ')}]` : '';
}

function summarizeSemanticState(state) {
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
  const semanticFacts = Array.isArray(event.semanticFacts) ? event.semanticFacts : [];
  const coreEvent = {
    subject: event.subject,
    action: event.action,
    object: event.object ?? null,
    text: event.text
  };

  const reasons = [
    ...detectContradictions(session, coreEvent),
    ...detectSemanticContradictions(session, coreEvent, semanticFacts)
  ];

  applyEventToState(session.storyState, coreEvent);

  const stepInput = await session.brain.step({ event: coreEvent });
  const state = session.brain.getState();
  const step = state.step - 1;
  const stepTokenId = stepInput?.stepTokenId ?? null;
  if (stepTokenId != null) session.stepTokens.push(stepTokenId);

  const previousStep = step - 1;
  if (session.snapshotCache.state && session.snapshotCache.step === previousStep) {
    applyEventToState(session.snapshotCache.state, coreEvent);
    session.snapshotCache.step = step;
  }

  const semanticStartIndex = session.semanticFacts.length;
  if (semanticFacts.length > 0) {
    for (const fact of semanticFacts) {
      session.semanticFacts.push({ ...fact, step });
    }
    const activeFacts = semanticFacts.filter((fact) => isFrameActive(session, getFactFrameName(fact)));
    if (activeFacts.length > 0) {
      applySemanticFactsToState(session.semanticState, activeFacts);
      session.activeFactsCount += activeFacts.length;
      if (session.semanticCache.state && session.semanticCache.step === previousStep) {
        applySemanticFactsToState(session.semanticCache.state, activeFacts);
        session.semanticCache.step = step;
        session.semanticCache.factIndex = semanticStartIndex + semanticFacts.length - 1;
      }
    }
  }

  const entry = {
    step,
    event: coreEvent,
    text: `${describeEvent(coreEvent)}${summarizeSemanticFacts(semanticFacts)}`,
    reasons,
    locations: state.columns.map((column) => column.location),
    stepTokenId
  };
  session.history.push(entry);

  if (semanticFacts.length > 0) {
    const frames = new Set(
      semanticFacts.map((fact) => getFactFrameName(fact)).filter(Boolean)
    );
    frames.forEach((frame) => {
      if (!session.frameSegments[frame]) session.frameSegments[frame] = [];
      const list = session.frameSegments[frame];
      if (!list.length || list[list.length - 1].step !== step) {
        list.push({ step, locations: entry.locations });
        if (list.length > FRAME_SEGMENT_LIMIT) {
          list.splice(0, list.length - FRAME_SEGMENT_LIMIT);
        }
      }
    });
  }

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
  const actionDef = session.world.actions.find((a) => a.id === action) ?? { objectType: 'none' };

  let object = null;
  if (actionDef.objectType === 'location') {
    object = pick(rng, session.world.locations);
  }
  if (actionDef.objectType === 'item') {
    object = pick(rng, session.world.items);
  }
  if (actionDef.objectType === 'entity') {
    const options = session.world.entities.filter((id) => id !== subject);
    object = options.length > 0 ? pick(rng, options) : pick(rng, session.world.entities);
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

function narrativePhaseForStep(session, step) {
  const total = Math.max(1, session.targetLength ?? DEFAULT_STORY_EVENTS);
  const t = step / total;
  if (t < 0.25) return 'setup';
  if (t < 0.6) return 'conflict';
  if (t < 0.8) return 'climax';
  return 'resolution';
}

function makeFact(frame, payload = {}) {
  return { frame, ...payload };
}

function ensureLiteratureContext(session, rng) {
  if (!session.litContext) {
    session.litContext = {
      theme: pick(rng, LIT_THEMES),
      motif: pick(rng, LIT_MOTIFS),
      tone: pick(rng, LIT_TONES),
      conflict: pick(rng, LIT_CONFLICTS),
      plotTurn: pick(rng, LIT_PLOT_TURNS)
    };
  }
  const ctx = session.litContext;
  const step = session.history.length;
  if (step > 0 && step % 50 === 0) {
    ctx.theme = pick(rng, LIT_THEMES);
    ctx.motif = pick(rng, LIT_MOTIFS);
    ctx.tone = pick(rng, LIT_TONES);
    ctx.conflict = pick(rng, LIT_CONFLICTS);
    ctx.plotTurn = pick(rng, LIT_PLOT_TURNS);
  }
  return ctx;
}

function ensureChatContext(session, rng) {
  if (!session.chatContext) {
    session.chatContext = {
      topic: pick(rng, session.world.items),
      sentiment: pick(rng, CHAT_SENTIMENTS),
      politeness: pick(rng, CHAT_POLITENESS),
      persuasion: pick(rng, CHAT_PERSUASION),
      resolution: pick(rng, CHAT_RESOLUTION)
    };
  }
  const ctx = session.chatContext;
  const step = session.history.length;
  if (step > 0 && step % 60 === 0) {
    ctx.topic = pick(rng, session.world.items);
    ctx.sentiment = pick(rng, CHAT_SENTIMENTS);
    ctx.politeness = pick(rng, CHAT_POLITENESS);
    ctx.persuasion = pick(rng, CHAT_PERSUASION);
    ctx.resolution = pick(rng, CHAT_RESOLUTION);
  }
  return ctx;
}

function generateLiteratureEvent(session, rng, allowAbsurd = true) {
  const step = session.history.length;
  const subject = pick(rng, session.world.entities);
  const target = pick(rng, session.world.entities.filter((id) => id !== subject));
  const location = pick(rng, session.world.locations);
  const item = pick(rng, session.world.items);
  const phase = narrativePhaseForStep(session, step);
  const ctx = ensureLiteratureContext(session, rng);

  const beat = pick(rng, [
    'scene_move',
    'confession',
    'accusation',
    'betrayal',
    'vow',
    'secret',
    'consolation',
    'threat',
    'reveal'
  ]);

  const emotion = pick(rng, LIT_EMOTIONS);
  const tone = rng() < 0.25 ? pick(rng, LIT_TONES) : ctx.tone;
  const theme = rng() < 0.25 ? pick(rng, LIT_THEMES) : ctx.theme;
  const conflict = rng() < 0.2 ? pick(rng, LIT_CONFLICTS) : ctx.conflict;
  const motif = rng() < 0.25 ? pick(rng, LIT_MOTIFS) : ctx.motif;
  const plotTurn = rng() < 0.3 ? pick(rng, LIT_PLOT_TURNS) : ctx.plotTurn;

  const facts = [
    makeFact('emotionState', { kind: 'entity', subject, value: emotion, weight: 2 }),
    makeFact('toneStyle', { kind: 'tag', value: tone, weight: 2 }),
    makeFact('themeTags', { kind: 'tag', value: theme, weight: 3 }),
    makeFact('conflictType', { kind: 'tag', value: conflict, weight: 2 }),
    makeFact('motifRecurrence', { kind: 'tag', value: motif, weight: 2 }),
    makeFact('plotTurns', { kind: 'tag', value: plotTurn, weight: 2 }),
    makeFact('narrativePhase', { kind: 'tag', value: phase, weight: 2 }),
    makeFact('symbolismType', { kind: 'tag', value: pick(rng, ['mirror', 'storm', 'threshold', 'flame']), weight: 1 }),
    makeFact('moralTheme', { kind: 'tag', value: pick(rng, ['duty', 'desire', 'betrayal', 'redemption']), weight: 1 }),
    makeFact('imageryDensity', { kind: 'tag', value: pick(rng, ['sparse', 'lush', 'surreal']), weight: 1 }),
    makeFact('voiceRegister', { kind: 'tag', value: pick(rng, ['intimate', 'formal', 'lyrical']), weight: 1 }),
    makeFact('predictedEmotion', { kind: 'tag', value: pick(rng, ['melancholy', 'wonder', 'tension', 'hope']), weight: 1 }),
    makeFact('emotionalAftertaste', { kind: 'tag', value: pick(rng, ['bittersweet', 'uneasy', 'uplifted']), weight: 1 }),
    makeFact('tensionLevel', { kind: 'level', delta: rng() < 0.5 ? 1 : -1 }),
    makeFact('characterArc', { kind: 'entity', subject, value: rng() < 0.5 ? 'rising' : 'falling' }),
    makeFact('narratorReliability', { kind: 'tag', value: rng() < 0.8 ? 'reliable' : 'unreliable' }),
    makeFact('powerBalance', { kind: 'relation', subject, object: target, value: rng() < 0.5 ? 2 : -2 }),
    makeFact('goalState', { kind: 'tag', value: pick(rng, ['seek_truth', 'protect', 'escape', 'reconcile']), weight: 1 })
  ];

  if (rng() < 0.4) {
    facts.push(makeFact('emotionState', { kind: 'entity', subject: target, value: pick(rng, LIT_EMOTIONS), weight: 1 }));
  }

  if (beat === 'scene_move') {
    return {
      subject,
      action: 'moves_to',
      object: location,
      text: `${subject} moves to the ${location}, under a ${tone} mood.`,
      semanticFacts: facts
    };
  }

  if (beat === 'confession') {
    facts.push(makeFact('dialogueAct', { kind: 'entity', subject, value: 'confess' }));
    facts.push(makeFact('trustRelation', { kind: 'relation', subject, object: target, value: 2 }));
    facts.push(makeFact('stanceAgreement', { kind: 'stance', subject, object: theme, value: 'agree' }));
    return {
      subject,
      action: 'confesses_to',
      object: target,
      text: `${subject} confesses to ${target} about the ${theme}.`,
      semanticFacts: facts
    };
  }

  if (beat === 'accusation') {
    facts.push(makeFact('hostilityRelation', { kind: 'relation', subject, object: target, value: 3 }));
    facts.push(makeFact('dialogueAct', { kind: 'entity', subject, value: 'accuse' }));
    return {
      subject,
      action: 'accuses',
      object: target,
      text: `${subject} accuses ${target} near the ${location}.`,
      semanticFacts: facts
    };
  }

  if (beat === 'betrayal') {
    facts.push(makeFact('hostilityRelation', { kind: 'relation', subject, object: target, value: 5 }));
    facts.push(makeFact('conflictEscalation', { kind: 'level', delta: 2 }));
    facts.push(makeFact('secretState', { kind: 'entity', subject, value: 'holds_secret' }));
    return {
      subject,
      action: 'betrays',
      object: target,
      text: `${subject} betrays ${target}, deepening the conflict.`,
      semanticFacts: facts
    };
  }

  if (beat === 'vow') {
    facts.push(makeFact('allianceRelation', { kind: 'relation', subject, object: target, value: 'ally' }));
    facts.push(makeFact('dominanceMoves', { kind: 'entity', subject, value: 'yield' }));
    facts.push(makeFact('stanceAgreement', { kind: 'stance', subject, object: theme, value: 'agree' }));
    return {
      subject,
      action: 'vows_to',
      object: target,
      text: `${subject} vows loyalty to ${target}.`,
      semanticFacts: facts
    };
  }

  if (beat === 'secret') {
    facts.push(makeFact('secretState', { kind: 'entity', subject, value: 'holds_secret' }));
    facts.push(makeFact('deceptionSignals', { kind: 'entity', subject, value: 'high' }));
    return {
      subject,
      action: 'picks_up',
      object: item,
      text: `${subject} hides the ${item} without telling anyone.`,
      semanticFacts: facts
    };
  }

  if (beat === 'consolation') {
    facts.push(makeFact('emotionState', { kind: 'entity', subject: target, value: pick(rng, LIT_EMOTIONS) }));
    facts.push(makeFact('intimacyRelation', { kind: 'relation', subject, object: target, value: 2 }));
    return {
      subject,
      action: 'consoles',
      object: target,
      text: `${subject} consoles ${target} in the ${location}.`,
      semanticFacts: facts
    };
  }

  if (beat === 'threat') {
    facts.push(makeFact('conflictEscalation', { kind: 'level', delta: 2 }));
    facts.push(makeFact('dominanceMoves', { kind: 'entity', subject, value: 'assert' }));
    return {
      subject,
      action: 'threatens',
      object: target,
      text: `${subject} threatens ${target} about the ${theme}.`,
      semanticFacts: facts
    };
  }

  if (beat === 'reveal') {
    facts.push(makeFact('secretState', { kind: 'tag', value: 'revealed' }));
    facts.push(makeFact('plotTurns', { kind: 'tag', value: 'reveal' }));
    return {
      subject,
      action: 'reveals_to',
      object: target,
      text: `${subject} reveals a secret to ${target}.`,
      semanticFacts: facts
    };
  }

  if (allowAbsurd && rng() < 0.05) {
    return {
      subject: pick(rng, session.world.entities),
      action: 'dies',
      object: null,
      text: `${subject} collapses suddenly.`,
      semanticFacts: facts
    };
  }

  return {
    subject,
    action: 'moves_to',
    object: location,
    text: `${subject} moves to the ${location}.`,
    semanticFacts: facts
  };
}

function generateChatEvent(session, rng, allowAbsurd = true) {
  const step = session.history.length;
  const subject = pick(rng, session.world.entities);
  const target = pick(rng, session.world.entities.filter((id) => id !== subject));
  const ctx = ensureChatContext(session, rng);
  const topic = ctx.topic;
  const phase = narrativePhaseForStep(session, step);

  const sentiment = ctx.sentiment;
  const politeness = ctx.politeness;
  const persuasion = ctx.persuasion;
  const resolution = ctx.resolution;

  const facts = [
    makeFact('emotionState', { kind: 'entity', subject, value: sentiment, weight: 2 }),
    makeFact('themeTags', { kind: 'tag', value: topic, weight: 3 }),
    makeFact('politenessLevel', { kind: 'tag', value: politeness, weight: 2 }),
    makeFact('persuasionTactic', { kind: 'tag', value: persuasion, weight: 2 }),
    makeFact('narrativePhase', { kind: 'tag', value: phase, weight: 2 }),
    makeFact('beliefState', { kind: 'tag', value: pick(rng, ['uncertain', 'confident', 'skeptical']), weight: 1 }),
    makeFact('evidenceStrength', { kind: 'tag', value: pick(rng, ['low', 'medium', 'high']), weight: 1 }),
    makeFact('uncertaintyLevel', { kind: 'tag', value: pick(rng, ['low', 'moderate', 'high']), weight: 1 }),
    makeFact('conflictEscalation', { kind: 'level', delta: sentiment === 'frustrated' ? 2 : 0 }),
    makeFact('speakerTurns', { kind: 'tag', value: subject, weight: 2 }),
    makeFact('goalState', { kind: 'tag', value: pick(rng, ['align', 'decide', 'clarify', 'de-escalate']) }),
    makeFact('planProgress', { kind: 'tag', value: pick(rng, ['follow_up', 'assign_owner', 'next_step']) })
  ];

  const beat = pick(rng, ['ask', 'assert', 'agree', 'disagree', 'apology', 'insult', 'share', 'moderate']);

  if (beat === 'ask') {
    facts.push(makeFact('dialogueAct', { kind: 'entity', subject, value: 'ask' }));
    return {
      subject,
      action: 'asks',
      object: topic,
      text: `${subject}: Could we revisit the ${topic}?`,
      semanticFacts: facts
    };
  }

  if (beat === 'assert') {
    facts.push(makeFact('dialogueAct', { kind: 'entity', subject, value: 'assert' }));
    return {
      subject,
      action: 'says',
      object: topic,
      text: `${subject}: The ${topic} needs a clear owner.`,
      semanticFacts: facts
    };
  }

  if (beat === 'agree') {
    facts.push(makeFact('stanceAgreement', { kind: 'stance', subject, object: topic, value: 'agree' }));
    return {
      subject,
      action: 'agrees',
      object: topic,
      text: `${subject}: I agree on the ${topic}.`,
      semanticFacts: facts
    };
  }

  if (beat === 'disagree') {
    facts.push(makeFact('stanceAgreement', { kind: 'stance', subject, object: topic, value: 'disagree' }));
    facts.push(makeFact('conflictEscalation', { kind: 'level', delta: 1 }));
    return {
      subject,
      action: 'disagrees',
      object: topic,
      text: `${subject}: I disagree about the ${topic}.`,
      semanticFacts: facts
    };
  }

  if (beat === 'apology') {
    facts.push(makeFact('dialogueAct', { kind: 'entity', subject, value: 'apologize' }));
    return {
      subject,
      action: 'apologizes',
      object: null,
      text: `${subject}: Sorry for the confusion.`,
      semanticFacts: facts
    };
  }

  if (beat === 'insult') {
    facts.push(makeFact('dialogueAct', { kind: 'entity', subject, value: 'insult' }));
    facts.push(makeFact('hostilityRelation', { kind: 'relation', subject, object: target, value: 3 }));
    return {
      subject,
      action: 'insults',
      object: target,
      text: `${subject}: ${target}, that makes no sense.`,
      semanticFacts: facts
    };
  }

  if (beat === 'share') {
    facts.push(makeFact('dialogueAct', { kind: 'entity', subject, value: 'share' }));
    facts.push(makeFact('evidenceStrength', { kind: 'tag', value: 'medium' }));
    return {
      subject,
      action: 'shares',
      object: topic,
      text: `${subject}: Sharing notes on the ${topic}.`,
      semanticFacts: facts
    };
  }

  if (beat === 'moderate') {
    facts.push(makeFact('dominanceMoves', { kind: 'entity', subject, value: 'assert' }));
    facts.push(makeFact('narratorReliability', { kind: 'tag', value: resolution === 'resolved' ? 'reliable' : 'biased' }));
    return {
      subject,
      action: 'moderates',
      object: target,
      text: `${subject}: Let's keep this constructive.`,
      semanticFacts: facts
    };
  }

  if (allowAbsurd && rng() < 0.05) {
    return {
      subject,
      action: 'leaves',
      object: null,
      text: `${subject} leaves the channel abruptly.`,
      semanticFacts: facts
    };
  }

  return {
    subject,
    action: 'says',
    object: topic,
    text: `${subject}: Noted on the ${topic}.`,
    semanticFacts: facts
  };
}

function generateEventByMode(session, rng, allowAbsurd = true) {
  if (session.contentMode === 'literature') {
    return generateLiteratureEvent(session, rng, allowAbsurd);
  }
  if (session.contentMode === 'chat') {
    return generateChatEvent(session, rng, allowAbsurd);
  }
  return randomEvent(session, rng, allowAbsurd);
}

async function generateEvents(session, count, seed, allowAbsurd = true) {
  const rng = makeRng(seed ?? Date.now());
  const total = clampStoryCount(count, DEFAULT_STORY_EVENTS);
  session.targetLength = Math.max(total, session.history.length + total);
  for (let i = 0; i < total; i += 1) {
    if (allowAbsurd) {
      await addEvent(session, generateEventByMode(session, rng, true));
      continue;
    }
    let attempts = 0;
    let event = generateEventByMode(session, rng, false);
    let reasons = [
      ...detectContradictions(session, event),
      ...detectSemanticContradictions(session, event, event.semanticFacts ?? [])
    ];
    while (reasons.length > 0 && attempts < 12) {
      event = generateEventByMode(session, rng, false);
      reasons = [
        ...detectContradictions(session, event),
        ...detectSemanticContradictions(session, event, event.semanticFacts ?? [])
      ];
      attempts += 1;
    }
    await addEvent(session, event);
  }
}

function formatStoryText(session) {
  const worldLines = [
    `Content mode: ${session.contentMode}`,
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

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

function naiveReplayToStep(session, targetStep) {
  const state = initStoryState(session);
  if (session.history.length === 0) return state;
  const limit = clamp(targetStep, 0, session.history.length - 1);
  for (let i = 0; i <= limit; i += 1) {
    applyEventToState(state, session.history[i].event);
  }
  return state;
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

function topFromCounts(counts = {}) {
  let best = null;
  let bestScore = -Infinity;
  for (const [value, count] of Object.entries(counts)) {
    if (count > bestScore) {
      bestScore = count;
      best = value;
    }
  }
  return best ? { value: best, count: bestScore } : null;
}

function trendFromSeries(series = []) {
  if (series.length < 2) return 'flat';
  const delta = series[series.length - 1] - series[0];
  if (delta > 1) return 'rising';
  if (delta < -1) return 'falling';
  return 'flat';
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

async function getStatePayload(session) {
  const state = session.brain.getState();
  return {
    step: state.step,
    numColumns: session.currentConfig.numColumns,
    contentMode: session.contentMode,
    profileId: session.profileId,
    profileCnl: session.profileCnl,
    profiles: PROFILE_DEFS.map((profile) => ({
      id: profile.id,
      label: profile.label,
      description: profile.description
    })),
    activeFrames: Array.from(session.activeFrames ?? []),
    activeFramesCount: session.activeFrames?.size ?? 0,
    columns: state.columns.map((column) => column.location),
    mapConfig: session.currentConfig.mapConfig,
    history: session.history.map((entry) => ({ locations: entry.locations })),
    historyLength: session.history.length,
    contradictionsCount: session.contradictions.length,
    semanticFactsCount: session.semanticFacts.length,
    semanticActiveFactsCount: session.activeFactsCount ?? 0,
    semanticSummary: summarizeSemanticState(session.semanticState),
    frameSegments: session.frameSegments,
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

async function rebuildBrainWithEvents(session, { seed, numColumns, contentMode, profileId, events }) {
  initSession(session, { seed, numColumns, contentMode, profileId });
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

  if (req.method === 'POST' && url.pathname === '/api/profile') {
    try {
      const body = await readJson(req);
      const nextProfile = body.profileId ?? session.profileId;
      setProfile(session, nextProfile);
      const payload = await getStatePayload(session);
      return sendJson(res, 200, { ok: true, state: payload });
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
      const contentMode = normalizeContentMode(body.contentMode ?? session.contentMode);
      const profileId = body.profileId ?? session.profileId;
      const payload = await rebuildBrainWithEvents(session, { seed, numColumns, contentMode, profileId, events });
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
      const contentMode = normalizeContentMode(body.contentMode ?? session.contentMode);
      const profileId = body.profileId ?? session.profileId;
      initSession(session, { seed: body.seed, numColumns, contentMode, profileId });
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
      if (body.contentMode && normalizeContentMode(body.contentMode) !== session.contentMode) {
        initSession(session, {
          seed: body.seed ?? Date.now(),
          numColumns: session.currentConfig.numColumns,
          contentMode: body.contentMode,
          profileId: body.profileId ?? session.profileId
        });
      }
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
