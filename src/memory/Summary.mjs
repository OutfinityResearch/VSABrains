import { hashString } from '../util/hash.mjs';

/**
 * Window summaries written into slow maps and stored for later replay/querying.
 */
export class WindowSummary {
  constructor(startStep, endStep = null) {
    this.startStep = startStep;
    this.endStep = endStep;
    this.events = [];
    this.entities = new Set();
    this.predicates = new Set();
    this.objects = new Set();
  }

  /** Update summary with one event */
  addEvent(event) {
    if (!event) return;
    this.events.push(event);

    if (event.subject) this.entities.add(String(event.subject));
    if (event.resolvedSubject) this.entities.add(String(event.resolvedSubject));
    if (event.action) this.predicates.add(String(event.action));
    if (event.object != null) this.objects.add(String(event.object));
  }

  /** Deterministic summary tokenId (hash of canonical fields) */
  toTokenId(hash = { hashString }) {
    const canon = {
      startStep: this.startStep,
      endStep: this.endStep,
      entities: [...this.entities].sort(),
      predicates: [...this.predicates].sort(),
      objects: [...this.objects].sort()
    };
    const text = JSON.stringify(canon);
    return hash.hashString(text) >>> 0;
  }

  /** Minimal preserved arguments for replay/localization */
  getCriticalArguments() {
    return {
      startStep: this.startStep,
      endStep: this.endStep,
      entities: [...this.entities],
      predicates: [...this.predicates],
      objects: [...this.objects]
    };
  }

  toJSON() {
    return {
      startStep: this.startStep,
      endStep: this.endStep,
      events: this.events,
      entities: [...this.entities],
      predicates: [...this.predicates],
      objects: [...this.objects]
    };
  }

  static fromJSON(data) {
    const summary = new WindowSummary(data.startStep, data.endStep ?? null);
    summary.events = data.events ?? [];
    summary.entities = new Set(data.entities ?? []);
    summary.predicates = new Set(data.predicates ?? []);
    summary.objects = new Set(data.objects ?? []);
    return summary;
  }
}
