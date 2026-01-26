import { hashCombineU32, hashString } from '../util/hash.mjs';

/**
 * Structural binding with role-value pairs.
 */
export class WorkSignature {
  constructor() {
    this.bindings = new Map(); // role -> { value, isVariable }
  }

  /** Bind role to value */
  bind(role, value, isVariable = false) {
    this.bindings.set(role, { value, isVariable });
  }

  /** Unbind to get value for role */
  unbind(role) {
    return this.bindings.get(role)?.value;
  }

  /** Whether the role is a canonical variable */
  hasVariable(role) {
    return this.bindings.get(role)?.isVariable ?? false;
  }

  /** Get all role-value pairs */
  entries() {
    return [...this.bindings.entries()].map(([role, data]) => [role, data.value]);
  }

  /** Stable hash for indexing constants (variables excluded) */
  toHash() {
    const pairs = [...this.bindings.entries()]
      .filter(([, data]) => !data.isVariable)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([role, data]) => hashString(`${role}:${String(data.value)}`));
    return hashCombineU32(pairs);
  }

  /** Create signature with canonical variables */
  static canonicalize(fact, variableRoles = ['subject', 'object']) {
    const sig = new WorkSignature();
    for (const [role, value] of Object.entries(fact)) {
      if (variableRoles.includes(role)) {
        sig.bind(role, `?${role}`, true);
      } else {
        sig.bind(role, value, false);
      }
    }
    return sig;
  }

  /** Merge bindings; returns null on conflict */
  merge(other) {
    const merged = new WorkSignature();

    for (const [role, data] of this.bindings.entries()) {
      merged.bind(role, data.value, data.isVariable);
    }

    for (const [role, data] of other.bindings.entries()) {
      const existing = merged.bindings.get(role);
      if (!existing) {
        merged.bind(role, data.value, data.isVariable);
        continue;
      }

      if (existing.value === data.value) continue;

      if (existing.isVariable && !data.isVariable) {
        merged.bind(role, data.value, false);
        continue;
      }

      if (!existing.isVariable && data.isVariable) {
        continue;
      }

      return null;
    }

    return merged;
  }

  /** Pattern match (unification); returns variable→constant map or null */
  static matchPattern(pattern, fact) {
    const p = pattern instanceof WorkSignature
      ? Object.fromEntries(pattern.entries())
      : pattern;
    const f = fact instanceof WorkSignature
      ? Object.fromEntries(fact.entries())
      : fact;

    const bindings = new Map();

    for (const [role, patternValue] of Object.entries(p)) {
      const factValue = f[role];
      if (isVariable(patternValue)) {
        const varName = patternValue;
        if (bindings.has(varName)) {
          if (bindings.get(varName) !== factValue) return null;
        } else {
          bindings.set(varName, factValue);
        }
      } else {
        if (patternValue !== factValue) return null;
      }
    }

    return bindings;
  }
}

function isVariable(value) {
  return typeof value === 'string' && value.startsWith('?');
}
