import {
  BASE_ENTITIES,
  BASE_LOCATIONS,
  BASE_ITEMS,
  LIT_ENTITIES,
  LIT_LOCATIONS,
  LIT_ITEMS,
  CHAT_ENTITIES,
  CHAT_LOCATIONS,
  CHAT_TOPICS,
  ACTION_DEFS,
  LIT_ACTION_DEFS,
  CHAT_ACTION_DEFS,
  DEFAULT_STORY_EVENTS
} from './constants.mjs';
import { makeRng, pick, shuffle } from './utils.mjs';

export function normalizeContentMode(mode, contentModes) {
  if (!mode) return 'synthetic';
  const normalized = String(mode).toLowerCase();
  return contentModes.has(normalized) ? normalized : 'synthetic';
}

export function buildWorld(seed = Date.now(), contentMode = 'synthetic', contentModes) {
  const rng = makeRng(seed);
  const mode = normalizeContentMode(contentMode, contentModes);
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

export function initStoryState(session) {
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

export function describeEvent(event) {
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

export function detectContradictions(session, event) {
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

export function applyEventToState(state, event) {
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

export function narrativePhaseForStep(session, step) {
  const total = Math.max(1, session.targetLength ?? DEFAULT_STORY_EVENTS);
  const t = step / total;
  if (t < 0.25) return 'setup';
  if (t < 0.6) return 'conflict';
  if (t < 0.8) return 'climax';
  return 'resolution';
}
