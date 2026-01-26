import { WorkSignature } from './WorkSignature.mjs';

/**
 * Variable-to-constant mapping for reasoning.
 */
export class Workpad {
  constructor() {
    this.bindings = new Map();
  }

  /** Bind canonical variable to constant */
  bind(variable, constant) {
    this.bindings.set(variable, constant);
  }

  /** Get constant for variable */
  resolve(variable) {
    return this.bindings.get(variable);
  }

  /** Apply bindings to signature */
  instantiate(signature) {
    const sig = new WorkSignature();
    for (const [role, value] of signature.entries()) {
      if (typeof value === 'string' && value.startsWith('?')) {
        const bound = this.resolve(value);
        sig.bind(role, bound ?? value, bound == null);
      } else {
        sig.bind(role, value, false);
      }
    }
    return sig;
  }

  /** Clear bindings */
  clear() {
    this.bindings.clear();
  }
}
