export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function makeRng(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function shuffle(rng, list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pairKey(a, b) {
  return [a, b].sort().join('|');
}

export function ensureBucket(map, key) {
  if (!map[key]) map[key] = {};
  return map[key];
}

export function ensureSeries(map, key) {
  if (!map[key]) map[key] = [];
  return map[key];
}

export function topFromCounts(counts = {}) {
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

export function trendFromSeries(series = []) {
  if (series.length < 2) return 'flat';
  const delta = series[series.length - 1] - series[0];
  if (delta > 1) return 'rising';
  if (delta < -1) return 'falling';
  return 'flat';
}
