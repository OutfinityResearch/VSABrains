/**
 * High-level regime management.
 */
export class MetaController {
  constructor(controller, config = {}) {
    this.controller = controller;
    this.config = config;
    this.regimes = new Map();
    this.current = config.defaultRegime ?? null;

    if (config.regimes) {
      for (const [name, regime] of Object.entries(config.regimes)) {
        this.registerRegime(name, regime);
      }
    }
  }

  /** Select regime based on metrics */
  selectRegime(metrics) {
    if (typeof this.config.selectRegime === 'function') {
      const name = this.config.selectRegime(metrics);
      if (name) this.current = name;
    }
    return this.current;
  }

  /** Register new theory/regime */
  registerRegime(name, config) {
    this.regimes.set(name, config);
    if (!this.current) this.current = name;
  }

  /** Get current regime info */
  currentRegime() {
    return this.current ? { name: this.current, config: this.regimes.get(this.current) } : null;
  }
}
