import { VSABrains } from '../../src/index.mjs';
import {
  makeExp2Vocabulary,
  makeCorefState,
  eventToStepInput
} from '../../eval/exp2-narrative/encoding.mjs';
import {
  CONTENT_MODES,
  DEFAULT_PROFILE_BY_MODE,
  DEFAULT_STORY_EVENTS,
  DEMO_CONFIG,
  MAX_COLUMNS,
  MAX_STORY_EVENTS,
  PROFILE_DEFS
} from './constants.mjs';
import { clamp } from './utils.mjs';
import { buildWorld, initStoryState, normalizeContentMode } from './world.mjs';
import { initSemanticState, resetSemanticCache, rebuildSemanticState } from './semantic.mjs';

const sessions = new Map();

export function getSessionId(req) {
  const raw = req.headers['x-session-id'];
  if (!raw) return 'default';
  return String(raw);
}

export function getSession(req) {
  const id = getSessionId(req);
  let session = sessions.get(id);
  if (!session) {
    session = createSession(id);
    sessions.set(id, session);
  }
  return session;
}

export function createSession(id) {
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
    targetLength: DEFAULT_STORY_EVENTS,
    frameSegments: {},
    litContext: null,
    chatContext: null
  };
  initSession(session, {});
  return session;
}

export function clampColumns(session, value, fallback = session.currentConfig.numColumns) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return clamp(fallback, 1, MAX_COLUMNS);
  return clamp(Math.floor(numeric), 1, MAX_COLUMNS);
}

export function clampStoryCount(value, fallback = DEFAULT_STORY_EVENTS) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return clamp(fallback, 1, MAX_STORY_EVENTS);
  return clamp(Math.floor(numeric), 1, MAX_STORY_EVENTS);
}

export function normalizeMode(mode) {
  return mode === 'contradicting' ? 'contradicting' : 'consistent';
}

export function defaultProfileIdForMode(mode) {
  return DEFAULT_PROFILE_BY_MODE[mode] ?? 'balanced';
}

export function getProfileById(id) {
  return PROFILE_DEFS.find((profile) => profile.id === id) ?? null;
}

export function buildProfileCnl(profile) {
  const lines = [];
  lines.push(`Profile ${profile.label} activates Frames: ${profile.frames.join(', ')}.`);
  lines.push(`Profile ${profile.label} suppresses Frames: all others.`);
  return lines.join('\n');
}

export function setProfile(session, profileId) {
  const mode = session.contentMode ?? 'synthetic';
  const fallbackId = defaultProfileIdForMode(mode);
  const profile = getProfileById(profileId) ?? getProfileById(fallbackId) ?? PROFILE_DEFS[0];
  session.profileId = profile.id;
  session.activeFrames = new Set(profile.frames);
  session.profileCnl = buildProfileCnl(profile);
  rebuildSemanticState(session);
}

function buildOffsets(numColumns, mapConfig) {
  const margin = 6;
  const spanX = Math.max(1, mapConfig.width - margin * 2);
  const spanY = Math.max(1, mapConfig.height - margin * 2);
  const offsets = [];
  for (let i = 0; i < numColumns; i += 1) {
    const t = numColumns === 1 ? 0.5 : i / (numColumns - 1);
    offsets.push({
      x: Math.round(margin + spanX * t),
      y: Math.round(margin + spanY * (0.3 + 0.4 * t))
    });
  }
  return offsets;
}

export function resetSnapshotCache(session) {
  session.snapshotCache = { step: -1, state: initStoryState(session) };
}

export function initSession(session, { seed, numColumns, contentMode, profileId } = {}) {
  const nextMode = normalizeContentMode(contentMode ?? session.contentMode, CONTENT_MODES);
  session.contentMode = nextMode;
  if (seed != null) {
    session.world = buildWorld(seed, nextMode, CONTENT_MODES);
  } else if (!session.world || session.world?.mode !== nextMode) {
    session.world = buildWorld(Date.now(), nextMode, CONTENT_MODES);
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
