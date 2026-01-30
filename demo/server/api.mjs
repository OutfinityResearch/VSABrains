import { generateEvents } from './generator.mjs';
import { handleQuery } from './query.mjs';
import { getSession, clampColumns, clampStoryCount, normalizeMode } from './session.mjs';
import { getStatePayload } from './payload.mjs';
import { initSession, setProfile } from './session.mjs';
import { normalizeContentMode } from './world.mjs';
import { CONTENT_MODES, DEFAULT_STORY_EVENTS } from './constants.mjs';
import { addEvent } from './state.mjs';

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function sendError(res, status, message) {
  sendJson(res, status, { ok: false, error: message });
}

function readJson(req) {
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

export async function handleApi(req, res, url) {
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
      const contentMode = normalizeContentMode(body.contentMode ?? session.contentMode, CONTENT_MODES);
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
      const contentMode = normalizeContentMode(body.contentMode ?? session.contentMode, CONTENT_MODES);
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
      if (body.contentMode && normalizeContentMode(body.contentMode, CONTENT_MODES) !== session.contentMode) {
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
