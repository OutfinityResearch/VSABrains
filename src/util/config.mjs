/**
 * Simple configuration merge utility.
 */
export function mergeConfig(defaults, overrides) {
  if (overrides == null) return clone(defaults);

  const base = clone(defaults);
  for (const [key, value] of Object.entries(overrides)) {
    if (isPlainObject(value) && isPlainObject(base[key])) {
      base[key] = mergeConfig(base[key], value);
    } else {
      base[key] = value;
    }
  }
  return base;
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  if (Array.isArray(value)) return value.map((v) => clone(v));
  if (isPlainObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = clone(v);
    return out;
  }
  return value;
}
