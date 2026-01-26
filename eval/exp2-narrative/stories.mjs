import { SeededRandom } from '../../src/util/random.mjs';

export function generateStory(config = {}) {
  const rng = new SeededRandom(config.seed ?? 0);
  const numEntities = config.numEntities ?? 3;
  const numEvents = config.numEvents ?? 50;
  const corefRate = config.corefRate ?? 0;
  const resetRate = config.resetRate ?? 0;
  const motifRate = config.motifRate ?? 0;
  const motifLength = config.motifLength ?? 3;

  const entities = Array.from({ length: numEntities }, (_, i) => `E${i + 1}`);
  const rooms = ['room_A', 'room_B', 'room_C'];
  const items = ['key', 'sword', 'book'];

  const events = [];
  const groundTruth = new Map();
  let lastEntity = null;
  const motifs = [];

  const motifPattern = Array.from({ length: motifLength }, (_, i) => {
    const subject = entities[i % entities.length];
    const action = i % 2 === 0 ? 'enters' : 'picks_up';
    const object = action === 'enters' ? rooms[i % rooms.length] : items[i % items.length];
    return { subject, action, object };
  });
  let motifIndex = 0;

  const state = { entities: {}, items: {} };

  for (let t = 0; t < numEvents; t++) {
    const doReset = rng.nextFloat() < resetRate;
    if (doReset) {
      events.push({ time: t, subject: 'SYS', action: 'SCENE_RESET', object: null, resolvedSubject: null });
      lastEntity = null;
      continue;
    }

    const useMotif = rng.nextFloat() < motifRate && events.length >= motifLength;
    let subject;
    let resolvedSubject;
    let action;
    let object;

    if (useMotif) {
      const motif = motifPattern[motifIndex % motifPattern.length];
      motifIndex++;
      subject = motif.subject;
      resolvedSubject = subject;
      action = motif.action;
      object = motif.object;
      motifs.push({ start: t, pattern: motifPattern.map((m) => m.action) });
    } else {
      const useCoref = lastEntity && rng.nextFloat() < corefRate;
      subject = useCoref ? 'P' : entities[rng.nextInt(entities.length)];
      resolvedSubject = useCoref ? lastEntity : subject;
      action = rng.nextFloat() < 0.5 ? 'enters' : (rng.nextFloat() < 0.5 ? 'picks_up' : 'drops');
      object = action === 'enters' ? rooms[rng.nextInt(rooms.length)] : items[rng.nextInt(items.length)];
    }

    events.push({ time: t, subject, action, object, resolvedSubject });
    lastEntity = resolvedSubject;

    applyEventToState(state, events[events.length - 1]);
    for (const [entityId, data] of Object.entries(state.entities)) {
      groundTruth.set(`${entityId}:${t}:location`, data.location ?? null);
      groundTruth.set(`${entityId}:${t}:inventory`, (data.inventory ?? []).join(', '));
    }
  }

  return { events, groundTruth, motifs };
}

export function generateQueries(story, numQueries = 10) {
  const queries = [];
  const times = story.events.map((e) => e.time);
  const entities = new Set();
  for (const key of story.groundTruth.keys()) {
    const [entityId] = key.split(':');
    entities.add(entityId);
  }

  const entityList = [...entities];
  for (let i = 0; i < numQueries; i++) {
    const time = times[Math.floor(Math.random() * times.length)] ?? 0;
    const entity = entityList[Math.floor(Math.random() * entityList.length)] ?? 'E1';
    const attribute = Math.random() < 0.5 ? 'location' : 'inventory';
    const expectedAnswer = story.groundTruth.get(`${entity}:${time}:${attribute}`) ?? null;
    queries.push({ time, entity, attribute, expectedAnswer });
  }

  return queries;
}

export function generateAdversarialQueries() {
  return [];
}

function ensureEntity(state, entityId) {
  state.entities[entityId] ??= { location: null, inventory: [], alive: true };
  return state.entities[entityId];
}

function ensureItem(state, itemId) {
  state.items[itemId] ??= { location: null, heldBy: null };
  return state.items[itemId];
}

function applyEventToState(state, event) {
  const subject = event.resolvedSubject ?? event.subject;
  const action = event.action;
  const obj = event.object;

  switch (action) {
    case 'enters': {
      const entity = ensureEntity(state, subject);
      entity.location = obj;
      break;
    }

    case 'picks_up': {
      const entity = ensureEntity(state, subject);
      const item = ensureItem(state, obj);
      item.heldBy = subject;
      item.location = null;
      if (!entity.inventory.includes(obj)) entity.inventory.push(obj);
      break;
    }

    case 'drops': {
      const entity = ensureEntity(state, subject);
      const item = ensureItem(state, obj);
      entity.inventory = entity.inventory.filter((i) => i !== obj);
      item.heldBy = null;
      item.location = entity.location;
      break;
    }
  }
}
