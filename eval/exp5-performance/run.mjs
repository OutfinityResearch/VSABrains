import { performance } from 'node:perf_hooks';
import { VSABrains } from '../../src/index.mjs';
import { packLocKey } from '../../src/util/locKey.mjs';
import { Reporter } from '../common/Reporter.mjs';
import {
  makeExp2Vocabulary,
  makeCorefState,
  eventToStepInput
} from '../exp2-narrative/encoding.mjs';

const ACTION_DEFS = [
  { id: 'enters', objectType: 'location' },
  { id: 'moves_to', objectType: 'location' },
  { id: 'picks_up', objectType: 'item' },
  { id: 'drops', objectType: 'item' },
  { id: 'dies', objectType: 'none' }
];

function parseArgs(argv) {
  const config = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      config[key] = next;
      i += 1;
    } else {
      config[key] = 'true';
    }
  }
  return config;
}

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeRng(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickIndex(rng, size) {
  return Math.floor(rng() * size);
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

function buildWorld({ entitiesCount, locationsCount, itemsCount }) {
  const entities = Array.from({ length: entitiesCount }, (_, i) => `E${i}`);
  const locations = Array.from({ length: locationsCount }, (_, i) => `L${i}`);
  const items = Array.from({ length: itemsCount }, (_, i) => `I${i}`);
  const itemIndex = new Map(items.map((id, i) => [id, i]));
  return { entities, locations, items, itemIndex, actions: ACTION_DEFS };
}

function initState(world) {
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

function applyEventToState(state, event) {
  const subject = event.resolvedSubject ?? event.subject;
  const action = event.action;
  const obj = event.object;

  switch (action) {
    case 'enters':
    case 'moves_to': {
      const entity = state.entities[subject];
      if (entity) entity.location = obj;
      break;
    }
    case 'picks_up': {
      const entity = state.entities[subject];
      const item = state.items[obj];
      if (!entity || !item) break;
      if (item.heldBy && item.heldBy !== subject) {
        const prevHolder = state.entities[item.heldBy];
        if (prevHolder) {
          prevHolder.inventory = prevHolder.inventory.filter((i) => i !== obj);
        }
      }
      item.heldBy = subject;
      item.location = null;
      if (!entity.inventory.includes(obj)) entity.inventory.push(obj);
      break;
    }
    case 'drops': {
      const entity = state.entities[subject];
      const item = state.items[obj];
      if (!entity || !item) break;
      entity.inventory = entity.inventory.filter((i) => i !== obj);
      item.heldBy = null;
      item.location = entity.location;
      break;
    }
    case 'dies': {
      const entity = state.entities[subject];
      if (entity) entity.alive = false;
      break;
    }
    default:
      break;
  }
}

function generateEventIndices(rng, state, world) {
  const subjectIdx = pickIndex(rng, world.entities.length);
  const subject = world.entities[subjectIdx];
  const entity = state.entities[subject];

  const roll = rng();
  let actionIdx = 0;
  if (roll < 0.45) actionIdx = 1;
  else if (roll < 0.7) actionIdx = 2;
  else if (roll < 0.92) actionIdx = 3;
  else actionIdx = 4;

  const action = world.actions[actionIdx];
  let objectIdx = -1;

  if (action.objectType === 'location') {
    objectIdx = pickIndex(rng, world.locations.length);
  }

  if (action.objectType === 'item') {
    if (action.id === 'drops' && entity?.inventory?.length > 0) {
      const itemId = entity.inventory[pickIndex(rng, entity.inventory.length)];
      objectIdx = world.itemIndex.get(itemId) ?? -1;
    } else {
      objectIdx = pickIndex(rng, world.items.length);
    }
  }

  if (action.id === 'drops' && (!entity || entity.inventory.length === 0)) {
    actionIdx = 1;
    objectIdx = pickIndex(rng, world.locations.length);
  }

  return { subjectIdx, actionIdx, objectIdx };
}

function toEventObject(indices, world) {
  const action = world.actions[indices.actionIdx];
  let object = null;
  if (indices.objectIdx >= 0) {
    object = action.objectType === 'location'
      ? world.locations[indices.objectIdx]
      : world.items[indices.objectIdx];
  }
  return {
    subject: world.entities[indices.subjectIdx],
    action: action.id,
    object
  };
}

function naiveReplayToStep(events, world, targetStep) {
  const state = initState(world);
  for (let step = 0; step <= targetStep; step += 1) {
    const event = events[step];
    applyEventToState(state, event);
  }
  return state;
}

function naiveListLocalize(list, window) {
  let bestIndex = 0;
  let bestScore = -1;
  let comparisons = 0;
  for (let i = 0; i <= list.length - window.length; i += 1) {
    let score = 0;
    for (let j = 0; j < window.length; j += 1) {
      comparisons += 1;
      if (list[i + j] === window[j]) score += 1;
    }
    if (score > bestScore || (score === bestScore && i > bestIndex)) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return { bestIndex, bestScore, comparisons };
}

function corruptWindow(window, rng, vocabSize) {
  return window.map((token) => {
    if (rng() < 0.2) {
      return 1 + Math.floor(rng() * vocabSize);
    }
    return token;
  });
}

function buildQueries(world, facts, count, seed) {
  const rng = makeRng(seed);
  const types = ['whereAt', 'entitiesAt', 'inventory', 'whoHas', 'itemLocation', 'isAlive'];
  const queries = [];

  for (let i = 0; i < count; i += 1) {
    const type = types[i % types.length];
    const step = clamp(Math.floor(rng() * facts), 0, facts - 1);
    const entityIdx = pickIndex(rng, world.entities.length);
    const itemIdx = pickIndex(rng, world.items.length);
    const locationIdx = pickIndex(rng, world.locations.length);
    queries.push({ type, step, entityIdx, itemIdx, locationIdx });
  }

  return queries;
}

function answerFromState(state, query, world) {
  const entityId = world.entities[query.entityIdx];
  const itemId = world.items[query.itemIdx];
  const locationId = world.locations[query.locationIdx];

  switch (query.type) {
    case 'whereAt': {
      return state.entities[entityId]?.location ?? null;
    }
    case 'entitiesAt': {
      const list = Object.entries(state.entities)
        .filter(([, data]) => data.location === locationId)
        .map(([id]) => id);
      return list.sort();
    }
    case 'inventory': {
      return [...(state.entities[entityId]?.inventory ?? [])].sort();
    }
    case 'whoHas': {
      return state.items[itemId]?.heldBy ?? null;
    }
    case 'itemLocation': {
      const item = state.items[itemId];
      if (!item) return null;
      if (item.heldBy) {
        return state.entities[item.heldBy]?.location ?? null;
      }
      return item.location ?? null;
    }
    case 'isAlive': {
      const alive = state.entities[entityId]?.alive;
      return alive === false ? false : true;
    }
    default:
      return null;
  }
}

async function runExperiment5(userConfig = {}) {
  const facts = clamp(toInt(userConfig.facts, 10_000), 10_000, 1_000_000);
  const queriesCount = clamp(toInt(userConfig.queries, 18), 6, 60);
  const numColumns = clamp(toInt(userConfig.columns, 1), 1, 5);
  const seed = toInt(userConfig.seed, 1337);
  const defaultCheckpoint = Math.max(200, Math.min(5000, Math.round(facts / 20)));
  const checkpointInterval = clamp(toInt(userConfig.checkpointInterval, defaultCheckpoint), 200, 200_000);
  const entitiesCount = clamp(toInt(userConfig.entities, 48), 8, 128);
  const locationsCount = clamp(toInt(userConfig.locations, 48), 8, 128);
  const itemsCount = clamp(toInt(userConfig.items, 96), 16, 256);
  const progressEvery = clamp(toInt(userConfig.progressEvery, 100_000), 10_000, 250_000);
  const localizationRuns = clamp(toInt(userConfig.localizationRuns, queriesCount), 1, 2_000);

  const mapConfig = { width: 96, height: 96, k: 4 };
  const displacement = { contextLength: 2, maxStep: 3, seed: seed ^ 0x9e3779b9, avoidZeroStep: true };

  const world = buildWorld({ entitiesCount, locationsCount, itemsCount });
  const vocab = makeExp2Vocabulary();
  const corefState = makeCorefState();
  const brain = new VSABrains({
    numColumns,
    mapConfig,
    displacement,
    checkpoint: { policy: 'fixed', interval: checkpointInterval },
    episodicStore: { maxChunks: facts * numColumns + 10 },
    writePolicy: 'stepTokenOnly',
    columnOffsets: buildOffsets(numColumns, mapConfig),
    vocabulary: vocab,
    eventToStepInput: (event) => eventToStepInput(event, vocab, corefState)
  });

  const generatorState = initState(world);
  const events = new Array(facts);
  const stepTokenIds = new Uint32Array(facts);
  const locKeys = new Uint32Array(facts);

  const ingestStart = performance.now();
  const rng = makeRng(seed);

  for (let i = 0; i < facts; i += 1) {
    const indices = generateEventIndices(rng, generatorState, world);
    const event = toEventObject(indices, world);
    events[i] = event;
    applyEventToState(generatorState, event);

    const stepInput = await brain.step({ event });
    stepTokenIds[i] = stepInput.stepTokenId >>> 0;
    const state = brain.getState();
    const loc = state.columns[0]?.location ?? { x: 0, y: 0 };
    locKeys[i] = packLocKey(loc.x, loc.y);

    if ((i + 1) % progressEvery === 0) {
      const elapsed = (performance.now() - ingestStart) / 1000;
      console.log(`[exp5] Ingested ${i + 1}/${facts} facts in ${elapsed.toFixed(1)}s`);
    }
  }

  const ingestMs = performance.now() - ingestStart;
  const ingestSeconds = ingestMs / 1000;

  const queries = buildQueries(world, facts, queriesCount, seed ^ 0xabcddcba);
  let mismatches = 0;
  const naiveTimes = new Array(queries.length).fill(0);
  const vsaTimes = new Array(queries.length).fill(0);
  const replayStepsArr = new Array(queries.length).fill(0);
  const naiveStepsArr = new Array(queries.length).fill(0);

  const naiveStart = performance.now();
  const naiveAnswers = new Array(queries.length);
  for (let i = 0; i < queries.length; i += 1) {
    const q = queries[i];
    const t0 = performance.now();
    const state = naiveReplayToStep(events, world, q.step);
    const answer = answerFromState(state, q, world);
    const t1 = performance.now();
    naiveAnswers[i] = answer;
    naiveTimes[i] = t1 - t0;
    naiveStepsArr[i] = q.step + 1;
  }
  const naiveMs = performance.now() - naiveStart;

  const vsaStart = performance.now();
  for (let i = 0; i < queries.length; i += 1) {
    const q = queries[i];
    const t0 = performance.now();
    const state = await brain.replay(q.step);
    const answer = answerFromState(state, q, world);
    const t1 = performance.now();
    const replaySteps = brain.lastReplaySteps ?? 0;
    vsaTimes[i] = t1 - t0;
    replayStepsArr[i] = replaySteps;

    const naiveAnswer = naiveAnswers[i];
    const equal = JSON.stringify(naiveAnswer) === JSON.stringify(answer);
    if (!equal) mismatches += 1;
  }
  const vsaMs = performance.now() - vsaStart;
  const avgReplaySteps = replayStepsArr.length > 0
    ? replayStepsArr.reduce((a, b) => a + b, 0) / replayStepsArr.length
    : 0;
  const avgNaiveSteps = naiveStepsArr.length > 0
    ? naiveStepsArr.reduce((a, b) => a + b, 0) / naiveStepsArr.length
    : 0;
  const stepReduction = avgReplaySteps > 0 ? avgNaiveSteps / avgReplaySteps : null;

  const perTypeStats = {};
  for (let i = 0; i < queries.length; i += 1) {
    const type = queries[i].type;
    const entry = perTypeStats[type] ?? {
      count: 0,
      naiveMs: 0,
      vsaMs: 0,
      replaySteps: 0
    };
    entry.count += 1;
    entry.naiveMs += naiveTimes[i] ?? 0;
    entry.vsaMs += vsaTimes[i] ?? 0;
    entry.replaySteps += replayStepsArr[i] ?? 0;
    perTypeStats[type] = entry;
  }

  const localization = await runLocalizationBenchmark({
    brain,
    stepTokenIds,
    locKeys,
    facts,
    seed,
    perfRuns: localizationRuns
  });

  const perType = Object.fromEntries(
    Object.entries(perTypeStats).map(([type, stat]) => {
      const naiveAvgMs = stat.count > 0 ? stat.naiveMs / stat.count : 0;
      const vsaAvgMs = stat.count > 0 ? stat.vsaMs / stat.count : 0;
      const avgReplaySteps = stat.count > 0 ? stat.replaySteps / stat.count : 0;
      return [type, {
        count: stat.count,
        naiveAvgMs,
        vsaAvgMs,
        speedup: vsaAvgMs > 0 ? naiveAvgMs / vsaAvgMs : null,
        avgReplaySteps
      }];
    })
  );

  return {
    experiment: 'exp5-performance',
    config: {
      facts,
      queriesCount,
      localizationRuns,
      numColumns,
      seed,
      checkpointInterval,
      entitiesCount,
      locationsCount,
      itemsCount,
      mapConfig,
      displacement
    },
    ingest: {
      facts,
      ingestSeconds,
      factsPerSecond: ingestSeconds > 0 ? facts / ingestSeconds : null
    },
    queries: {
      totalQueries: queries.length,
      naiveSeconds: naiveMs / 1000,
      vsaSeconds: vsaMs / 1000,
      speedup: vsaMs > 0 ? naiveMs / vsaMs : null,
      avgNaiveSteps,
      avgReplaySteps,
      stepReduction,
      mismatches,
      perType
    },
    localization
  };
}

async function runLocalizationBenchmark({ brain, stepTokenIds, locKeys, facts, seed, perfRuns }) {
  const windowSize = 6;
  const runs = clamp(toInt(perfRuns, 24), 1, 2_000);
  const targetStep = facts - 1;
  const windowStart = Math.max(0, targetStep - windowSize + 1);
  const cleanWindow = Array.from(stepTokenIds.slice(windowStart, targetStep + 1));
  const list = Array.from(stepTokenIds.slice(0, targetStep + 1));

  const rng = makeRng(seed ^ 0x1234567);
  const vocabSize = brain.vocabulary?.size ?? 100_000;
  const noisyWindow = corruptWindow(cleanWindow, rng, vocabSize);
  const targetLocKey = locKeys[targetStep] ?? 0;

  const localizeOnce = (debug) => {
    const votes = [];
    let scoredLocations = 0;
    for (const column of brain.columns) {
      const result = brain.localizer._localizeColumn(
        noisyWindow,
        column,
        5,
        { ...(brain.config.localization ?? {}), debug }
      );
      const candidates = result.candidates ?? [];
      const top1 = candidates[0];
      if (top1?.locKey != null) {
        votes.push({ value: top1.locKey, weight: top1.score ?? 1 });
      }
      if (debug) {
        scoredLocations += result.stats?.scoredLocations ?? candidates.length;
      }
    }
    const winner = votes.length > 0 ? brain.voter.vote(votes) : null;
    return { winner, scoredLocations };
  };

  const debugRun = localizeOnce(true);
  const vsaScoredLocations = debugRun.scoredLocations;
  const vsaCorrect = debugRun.winner?.value === targetLocKey;

  const baseline = naiveListLocalize(list, noisyWindow);
  const predictedStep = baseline.bestIndex + windowSize - 1;
  const naiveCorrect = predictedStep === targetStep && baseline.bestScore === windowSize;

  const vsaStart = performance.now();
  for (let i = 0; i < runs; i += 1) {
    localizeOnce(false);
  }
  const vsaMs = performance.now() - vsaStart;

  const naiveStart = performance.now();
  for (let i = 0; i < runs; i += 1) {
    naiveListLocalize(list, noisyWindow);
  }
  const naiveMs = performance.now() - naiveStart;

  return {
    windowSize,
    perfRuns: runs,
    vsaSeconds: vsaMs / 1000,
    naiveSeconds: naiveMs / 1000,
    speedup: vsaMs > 0 ? naiveMs / vsaMs : null,
    vsaScoredLocations,
    naiveComparisons: baseline.comparisons,
    workRatio: vsaScoredLocations > 0 ? baseline.comparisons / vsaScoredLocations : null,
    vsaCorrect,
    naiveCorrect
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const report = await runExperiment5(args);
  Reporter.print(report);
}

export { runExperiment5 };
