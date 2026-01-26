import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
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

const DEMO_CONFIG = {
  numColumns: 3,
  mapConfig: { width: 64, height: 64, k: 4 },
  displacement: { contextLength: 2, maxStep: 3, seed: 7, avoidZeroStep: true },
  checkpoint: { policy: 'adaptive', interval: 100, minInterval: 20, maxInterval: 200 },
  writePolicy: 'stepTokenOnly'
};

const ENTITY_IDS = ['Alice', 'Bob', 'Charlie', 'Dana'];
const LOCATIONS = ['room_A', 'room_B', 'garden', 'lab', 'hall'];
const ITEMS = ['key', 'map', 'torch', 'apple', 'coin'];

const ACTIONS = [
  { id: 'enters', label: 'enters', objectType: 'location' },
  { id: 'moves_to', label: 'moves to', objectType: 'location' },
  { id: 'picks_up', label: 'picks up', objectType: 'item' },
  { id: 'drops', label: 'drops', objectType: 'item' },
  { id: 'dies', label: 'dies', objectType: 'none' }
];

let brain = null;
let vocab = null;
let corefState = null;
let history = [];
let stepTokenIds = [];

function initDemo() {
  vocab = makeExp2Vocabulary();
  corefState = makeCorefState();
  brain = new VSABrains({
    ...DEMO_CONFIG,
    vocabulary: vocab,
    eventToStepInput: (event) => eventToStepInput(event, vocab, corefState)
  });
  history = [];
  stepTokenIds = [];
}

initDemo();

function formatEvent(event) {
  const subject = event.subject === 'P'
    ? `P(${event.resolvedSubject ?? '?'})`
    : event.subject;
  if (event.action === 'dies') return `${subject} dies`;
  if (event.action === 'picks_up') return `${subject} picks up ${event.object}`;
  if (event.action === 'drops') return `${subject} drops ${event.object}`;
  if (event.action === 'enters') return `${subject} enters ${event.object}`;
  if (event.action === 'moves_to') return `${subject} moves to ${event.object}`;
  return `${subject} ${event.action} ${event.object ?? ''}`.trim();
}

function getResolvedSubject(event) {
  if (event.subject !== 'P') return event.subject;
  return event.resolvedSubject ?? null;
}

async function getStatePayload() {
  const state = brain.getState();
  const diagnostics = brain.getDiagnostics();
  const localize = await computeLocalization(6);
  return {
    step: state.step,
    columns: state.columns.map((column) => ({
      id: column.id,
      location: column.location
    })),
    diagnostics: diagnostics.aggregate,
    historyLength: history.length,
    mapConfig: DEMO_CONFIG.mapConfig,
    localize
  };
}

async function computeLocalization(windowSize) {
  if (stepTokenIds.length === 0) {
    return { window: 0, candidates: [] };
  }
  const window = stepTokenIds.slice(-windowSize);
  const candidates = await brain.localize(window, 6, { minMatchesRatio: 0.5 });
  return { window: window.length, candidates };
}

function validateEventInput(payload) {
  const subject = payload.subject?.trim();
  const action = payload.action;
  const object = payload.object ?? null;

  const validSubjects = new Set([...ENTITY_IDS, 'P']);
  if (!validSubjects.has(subject)) {
    return { ok: false, error: 'Invalid subject.' };
  }

  const actionDef = ACTIONS.find((a) => a.id === action);
  if (!actionDef) {
    return { ok: false, error: 'Invalid action.' };
  }

  if (actionDef.objectType === 'location' && !LOCATIONS.includes(object)) {
    return { ok: false, error: 'This action requires a location.' };
  }

  if (actionDef.objectType === 'item' && !ITEMS.includes(object)) {
    return { ok: false, error: 'This action requires an item.' };
  }

  if (actionDef.objectType === 'none') {
    return { ok: true, event: { subject, action, object: null } };
  }

  return { ok: true, event: { subject, action, object } };
}

function buildEvidence(entries, query) {
  if (!entries || entries.length === 0) return [];
  const targetStep = query.targetStep ?? entries[entries.length - 1].step;

  const scoped = entries.filter((e) => e.step <= targetStep);
  if (scoped.length === 0) return [];

  if (query.type === 'where') {
    const hits = scoped.filter((e) => {
      const subject = getResolvedSubject(e.event);
      return subject === query.entity && ['enters', 'moves_to'].includes(e.event.action);
    });
    return hits.slice(-2);
  }

  if (query.type === 'inventory') {
    const hits = scoped.filter((e) => {
      const subject = getResolvedSubject(e.event);
      return subject === query.entity && ['picks_up', 'drops'].includes(e.event.action);
    });
    return hits.slice(-4);
  }

  if (query.type === 'whoHas') {
    const hits = scoped.filter((e) => e.event.object === query.item && ['picks_up', 'drops'].includes(e.event.action));
    return hits.slice(-4);
  }

  if (query.type === 'alive') {
    const hits = scoped.filter((e) => {
      const subject = getResolvedSubject(e.event);
      return subject === query.entity && e.event.action === 'dies';
    });
    return hits.slice(-1);
  }

  return scoped.slice(-3);
}

async function answerQuery(payload) {
  const type = payload.type;
  const state = brain.getState();
  const targetStep = Math.max(0, state.step - 1);

  if (state.step === 0) {
    return { verdict: 'unsupported', text: null, reason: 'no_events' };
  }

  if (type === 'where' || type === 'inventory' || type === 'alive') {
    const attribute = type === 'where' ? 'location' : type === 'inventory' ? 'inventory' : 'alive';
    const question = `STATE? time=${targetStep} entity=${payload.entity} attribute=${attribute}`;
    const result = await brain.answer(question);
    return {
      ...result,
      evidence: buildEvidence(history, { type, entity: payload.entity, targetStep })
    };
  }

  if (type === 'whoHas') {
    const replay = await brain.replay(targetStep);
    const item = replay.items?.[payload.item];
    if (!item) {
      return { verdict: 'unsupported', text: null, reason: 'item_not_found' };
    }
    if (item.heldBy) {
      return {
        verdict: 'supported',
        text: item.heldBy,
        evidence: buildEvidence(history, { type, item: payload.item, targetStep })
      };
    }
    if (item.location) {
      return {
        verdict: 'supported',
        text: `Nobody (lying in ${item.location})`,
        evidence: buildEvidence(history, { type, item: payload.item, targetStep })
      };
    }
    return { verdict: 'supported', text: 'Nobody', evidence: [] };
  }

  return { verdict: 'unsupported', text: null, reason: 'unknown_query' };
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
  if (req.method === 'GET' && url.pathname === '/api/config') {
    return sendJson(res, 200, {
      entities: ENTITY_IDS,
      locations: LOCATIONS,
      items: ITEMS,
      actions: ACTIONS
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/state') {
    const payload = await getStatePayload();
    return sendJson(res, 200, payload);
  }

  if (req.method === 'GET' && url.pathname === '/api/history') {
    return sendJson(res, 200, { events: history });
  }

  if (req.method === 'POST' && url.pathname === '/api/event') {
    try {
      const body = await readJson(req);
      const validation = validateEventInput(body);
      if (!validation.ok) return sendError(res, 400, validation.error);

      let event = validation.event;
      if (event.subject === 'P') {
        if (!corefState.lastEntityId) {
          return sendError(res, 400, 'Coreference failed: no previous entity.');
        }
        event = { ...event, resolvedSubject: corefState.lastEntityId };
      }

      const stepInput = await brain.step({ event });
      const state = brain.getState();
      const step = state.step - 1;
      const entry = {
        step,
        event,
        stepTokenId: stepInput.stepTokenId,
        locations: state.columns.map((column) => column.location),
        text: formatEvent(event)
      };
      history.push(entry);
      stepTokenIds.push(stepInput.stepTokenId);

      const payload = await getStatePayload();
      return sendJson(res, 200, { ok: true, entry, state: payload });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/query') {
    try {
      const body = await readJson(req);
      const answer = await answerQuery(body);
      return sendJson(res, 200, { ok: true, answer });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/reset') {
    initDemo();
    const payload = await getStatePayload();
    return sendJson(res, 200, { ok: true, state: payload });
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

server.listen(PORT, () => {
  console.log(`VSABrains demo running on http://localhost:${PORT}`);
});
