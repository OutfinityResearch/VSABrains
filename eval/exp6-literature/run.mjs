import { performance } from 'node:perf_hooks';
import { Reporter } from '../common/Reporter.mjs';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const raw = process.argv[i];
  if (!raw.startsWith('--')) continue;
  const key = raw.slice(2);
  const value = process.argv[i + 1];
  args.set(key, value);
}

const facts = clampNumber(args.get('facts'), 100000, 1000, 500000);
const queries = clampNumber(args.get('queries'), 40, 10, 200);
const seed = clampNumber(args.get('seed'), 7, 1, 9999);

const FRAMES = [
  'emotionState',
  'emotionIntensity',
  'moodTrend',
  'tensionLevel',
  'goalState',
  'desireIntensity',
  'planProgress',
  'obstaclePressure',
  'trustRelation',
  'intimacyRelation',
  'hostilityRelation',
  'allianceRelation',
  'powerBalance',
  'statusRank',
  'authorityLegitimacy',
  'dominanceMoves',
  'conflictType',
  'conflictEscalation',
  'deceptionSignals',
  'secretState',
  'narrativePhase',
  'focalCharacter',
  'plotTurns',
  'pacingTempo',
  'themeTags',
  'motifRecurrence',
  'symbolismType',
  'moralTheme',
  'dialogueAct',
  'politenessLevel',
  'stanceAgreement',
  'persuasionTactic',
  'beliefState',
  'evidenceStrength',
  'narratorReliability',
  'uncertaintyLevel',
  'mentalState',
  'cognitiveBias',
  'resilienceLevel',
  'empathyLevel',
  'toneStyle',
  'imageryDensity',
  'rhetoricDevice',
  'voiceRegister',
  'predictedEmotion',
  'emotionalAftertaste',
  'memorabilityHook',
  'cognitiveLoad'
];

const THEMES = ['loss', 'betrayal', 'hope', 'identity', 'duty', 'freedom', 'memory', 'truth'];
const EMOTIONS = ['grief', 'fear', 'joy', 'anger', 'awe', 'shame', 'relief'];
const TONES = ['somber', 'intimate', 'ironic', 'formal', 'tender'];
const TOPICS = ['family', 'power', 'war', 'love', 'home', 'truth', 'legacy'];
const CHARACTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const rng = makeRng(seed);

const factStream = [];
for (let i = 0; i < facts; i += 1) {
  const frame = pick(rng, FRAMES);
  const subject = pick(rng, CHARACTERS);
  const value = sampleValue(frame, rng);
  factStream.push({ frame, subject, value });
}

const index = buildIndex(factStream);

const queryList = [];
for (let i = 0; i < queries; i += 1) {
  const frame = pick(rng, FRAMES);
  queryList.push({ frame });
}

const naiveStart = performance.now();
for (const q of queryList) {
  naiveTopValue(factStream, q.frame);
}
const naiveMs = performance.now() - naiveStart;

const indexStart = performance.now();
for (const q of queryList) {
  indexedTopValue(index, q.frame);
}
const indexMs = performance.now() - indexStart;

const report = {
  experiment: 'exp6-literature',
  timestamp: new Date().toISOString(),
  facts,
  queries,
  naiveMs,
  indexedMs: indexMs,
  speedup: naiveMs / Math.max(indexMs, 0.0001)
};
Reporter.print(report);

function buildIndex(stream) {
  const counts = new Map();
  for (const fact of stream) {
    if (!counts.has(fact.frame)) counts.set(fact.frame, new Map());
    const map = counts.get(fact.frame);
    map.set(fact.value, (map.get(fact.value) ?? 0) + 1);
  }
  return counts;
}

function naiveTopValue(stream, frame) {
  const map = new Map();
  for (const fact of stream) {
    if (fact.frame !== frame) continue;
    map.set(fact.value, (map.get(fact.value) ?? 0) + 1);
  }
  return topFromMap(map);
}

function indexedTopValue(index, frame) {
  const map = index.get(frame);
  if (!map) return null;
  return topFromMap(map);
}

function topFromMap(map) {
  let best = null;
  let bestScore = -Infinity;
  for (const [value, count] of map.entries()) {
    if (count > bestScore) {
      bestScore = count;
      best = value;
    }
  }
  return best;
}

function sampleValue(space, rand) {
  if (space.includes('emotion')) return pick(rand, EMOTIONS);
  if (space.includes('theme') || space.includes('motif') || space.includes('symbol')) return pick(rand, THEMES);
  if (space.includes('tone') || space.includes('voice')) return pick(rand, TONES);
  if (space.includes('belief') || space.includes('stance') || space.includes('topic')) return pick(rand, TOPICS);
  return pick(rand, ['low', 'medium', 'high', 'rise', 'fall', 'neutral']);
}

function makeRng(seedValue) {
  let t = seedValue >>> 0;
  return function rand() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rand, list) {
  return list[Math.floor(rand() * list.length)];
}

function clampNumber(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(numeric)));
}
