import { Column } from './core/Column.mjs';
import { LocationIndex } from './localization/LocationIndex.mjs';
import { Localizer } from './localization/Localizer.mjs';
import { Verifier } from './localization/Verifier.mjs';
import { Replayer } from './localization/Replay.mjs';
import { EpisodicStore } from './memory/EpisodicStore.mjs';
import { Index } from './memory/Index.mjs';
import { CheckpointManager } from './memory/Checkpoint.mjs';
import { SlowMapManager } from './memory/SlowMap.mjs';
import { Tokenizer } from './util/Tokenizer.mjs';
import { Vocabulary } from './util/Vocabulary.mjs';
import { Voter } from './consensus/Voter.mjs';
import { Aggregator } from './consensus/Aggregator.mjs';
import { Generator } from './reasoning/Generator.mjs';
import { Reasoner } from './reasoning/Reasoner.mjs';
import { FactStore } from './facts/FactStore.mjs';
import { FactExtractor } from './facts/FactExtractor.mjs';
import { Controller } from './control/Controller.mjs';
import { MetaController } from './control/MetaController.mjs';
import { mergeConfig } from './util/config.mjs';
import { hashCombineU32 } from './util/hash.mjs';
import { packLocKey } from './util/locKey.mjs';
import fs from 'node:fs/promises';

/**
 * VSABrains main API.
 */
export class VSABrains {
  constructor(config = {}) {
    const defaults = {
      numColumns: 1,
      numFastMaps: 2,
      numSlowMaps: 0,
      mapConfig: { width: 64, height: 64, k: 4 },
      displacement: { contextLength: 2, maxStep: 3, seed: 0 },
      localization: { candidatesPerToken: 50, minMatchesRatio: 0.6 },
      checkpoint: { policy: 'adaptive', interval: 100, minInterval: 20, maxInterval: 200 },
      slowMaps: { enabled: false, windowSize: 20, indexSummaries: false },
      tokenizer: { mode: 'simple', lowercase: true },
      writePolicy: 'allWriteTokens'
    };

    this.config = mergeConfig(defaults, config);

    this.vocabulary = config.vocabulary ?? new Vocabulary(config.vocab ?? {});
    this.tokenizer = new Tokenizer({ ...this.config.tokenizer, vocabulary: this.vocabulary });

    this.episodicStore = new EpisodicStore(config.episodicStore);
    this.index = new Index();
    this.checkpointManager = new CheckpointManager(this.config.checkpoint);

    this.columns = [];
    for (let i = 0; i < this.config.numColumns; i++) {
      const locationIndex = new LocationIndex(config.locationIndex);
      let slowMapManager = null;

      if (this.config.slowMaps?.enabled) {
        const slowIndex = this.config.slowMaps.indexSummaries ? new LocationIndex() : null;
        slowMapManager = new SlowMapManager({
          windowSize: this.config.slowMaps.windowSize,
          locationIndex: slowIndex,
          mapConfig: this.config.mapConfig
        });
      }

      const offset = this.config.columnOffsets?.[i] ?? { x: 0, y: 0 };
      const column = new Column({
        id: `column${i}`,
        numFastMaps: this.config.numFastMaps,
        numSlowMaps: this.config.numSlowMaps,
        mapConfig: this.config.mapConfig,
        offset,
        locationIndex,
        indexMapId: 0,
        slowMapManager,
        episodicStore: this.episodicStore,
        displacement: this.config.displacement,
        writePolicy: this.config.writePolicy
      });
      this.columns.push(column);
    }

    this.controller = new Controller(this.columns, config.controller);
    this.metaController = new MetaController(this.controller, config.metaController);
    this.localizer = new Localizer(this.columns);
    this.verifier = new Verifier(config.transitionRules ?? []);

    this.voter = new Voter(config.voter);
    this.aggregator = new Aggregator(this.columns, this.voter);
    this.generator = new Generator(this.columns, this.aggregator, config.generator);

    this.factStore = new FactStore();
    this.predicateVocabulary = this.config.predicateVocabulary ?? {};
    this.factExtractor = config.extractor?.enabled
      ? new FactExtractor({
        ...config.extractor,
        llmClient: config.extractor?.llmClient,
        predicateVocabulary: config.extractor?.predicateVocabulary ?? this.predicateVocabulary
      })
      : null;
    this.reasoner = new Reasoner(this.factStore, this.generator, config.reasoner);

    this.exp2State = initializeState();
    this.exp2StateModel = {
      init: () => initializeState(),
      apply: (state, event) => applyEventToState(state, event),
      clone: (state) => structuredClone(state)
    };

    this.replayer = new Replayer(
      this.checkpointManager,
      this.episodicStore,
      this.exp2StateModel,
      this.verifier
    );

    this.lastCheckpointStep = 0;
    this.stepDiagnostics = [];
    this.lastReplaySteps = 0;
  }

  /** Ingest text/document */
  async ingest(text, metadata = {}) {
    const chunks = [{ text, metadata }];

    for (const chunk of chunks) {
      const chunkId = await this.episodicStore.append({
        ...chunk,
        signature: chunk.signature ?? null
      });

      if (this.factExtractor) {
        const extracted = await this.factExtractor.extract(chunk.text);
        const validated = await this.factExtractor.validateAndFilter(extracted, chunk.text);
        for (const fact of validated) {
          await this.factStore.add({ ...fact, source: { docId: metadata.docId ?? 'doc', chunkId } });
        }
      }

      if (this.config.ingestWritesSteps !== false) {
        const tokenIds = this.tokenizer.encode(chunk.text);
        for (const tokenId of tokenIds) {
          await this.step(tokenId);
        }
      }
    }
  }

  /**
   * Process one step.
   * Supported inputs:
   * - tokenId: number
   * - tokenIds: number[]
   * - { stepTokenId, writeTokenIds, event }
   * - event: object (requires config.eventToStepInput)
   */
  async step(input) {
    let stepInput = input;

    if (input && typeof input === 'object' && !Array.isArray(input)) {
      if ('tokenIds' in input && Array.isArray(input.tokenIds)) {
        stepInput = { stepTokenId: hashCombineU32(input.tokenIds), writeTokenIds: input.tokenIds, event: input.event };
      } else if ('event' in input && !('stepTokenId' in input)) {
        if (typeof this.config.eventToStepInput === 'function') {
          stepInput = this.config.eventToStepInput(input.event);
        } else {
          throw new Error('eventToStepInput is required when calling step(event)');
        }
      }
    }

    const currentStep = this.controller.stepCounter;
    const normalized = await this.controller.step(stepInput);

    if (normalized?.event) {
      applyEventToState(this.exp2State, normalized.event);
    }
    if (normalized?.perColumn) {
      for (const entry of normalized.perColumn) {
        if (entry?.event) applyEventToState(this.exp2State, entry.event);
      }
    }

    if (this.checkpointManager.shouldCheckpoint(currentStep, this.lastCheckpointStep, normalized.event, {})) {
      await this.checkpointManager.save(currentStep, this._captureState());
      this.lastCheckpointStep = currentStep;
    }

    const diagnostics = this.getDiagnostics();
    this.stepDiagnostics.push({ step: currentStep, ...diagnostics.aggregate });

    return normalized;
  }

  /** Localize from context */
  async localize(context) {
    const windowStepTokens = Array.isArray(context)
      ? context
      : context?.windowStepTokens ?? context;

    const config = context?.config ?? this.config.localization;
    return this.localizer.localize(windowStepTokens, context?.topK ?? 20, config ?? {});
  }

  /** Retrieve relevant chunks */
  async retrieve(query, limit = 10) {
    const signatures = query?.signatures
      ?? (typeof query === 'string' ? this.tokenizer.tokenize(query) : []);

    if (!signatures || signatures.length === 0) return [];
    const chunkIds = this.index.query(signatures, limit);
    return this.episodicStore.getMany(chunkIds);
  }

  /** Answer with verdict */
  async answer(question) {
    if (typeof question === 'string' && question.startsWith('STATE?')) {
      return this._answerExp2(question);
    }

    return this.reasoner.answer(question);
  }

  /** Get fact extraction stats */
  async getFactStats() {
    const totalFacts = this.factStore?.facts?.size ?? 0;
    const byPredicate = {};
    if (this.factStore?.facts) {
      for (const fact of this.factStore.facts.values()) {
        const pred = fact.predicate;
        byPredicate[pred] = (byPredicate[pred] ?? 0) + 1;
      }
    }
    return { totalFacts, byPredicate };
  }

  /** Get diagnostic aggregates */
  getDiagnostics() {
    const perColumn = this.columns.map((column) => ({
      columnId: column.id,
      ...column.getDiagnostics()
    }));

    const aggregate = aggregateDiagnostics(perColumn);
    const agreement = computeColumnAgreement(this.columns);
    aggregate.columnAgreement = agreement.agreement;
    aggregate.locationEntropy = agreement.entropy;
    aggregate.step = this.controller.stepCounter;

    return { perColumn, aggregate };
  }

  /** Get diagnostic history */
  getDiagnosticsHistory() {
    return [...this.stepDiagnostics];
  }

  /** Replay stats (last run) */
  getReplayStats() {
    return { lastReplaySteps: this.lastReplaySteps };
  }

  /** Checkpoint stats */
  getCheckpointStats() {
    return { count: this.checkpointManager.list().length };
  }

  /** Get system state */
  getState() {
    return {
      step: this.controller.stepCounter,
      columns: this.columns.map((column) => ({
        id: column.id,
        location: column.location,
        locations: column.locations,
        displacementBuffer: [...column.displacementEncoder.buffer]
      }))
    };
  }

  /** Save system */
  async save(path) {
    const data = {
      config: this.config,
      state: this._captureState(),
      vocabulary: this.vocabulary.toJSON()
    };
    await fs.writeFile(path, JSON.stringify(data, null, 2));
  }

  /** Load system */
  static async load(path) {
    const raw = await fs.readFile(path, 'utf8');
    const data = JSON.parse(raw);
    const brain = new VSABrains(data.config);
    if (data.vocabulary) brain.vocabulary = Vocabulary.fromJSON(data.vocabulary);
    brain._restoreState(data.state);
    return brain;
  }

  async _answerExp2(query) {
    const parsed = parseExp2Query(query);
    if (!parsed) {
      return { verdict: 'unsupported', text: null, reason: 'invalid_query' };
    }

    const state = await this.replay(parsed.targetStep);
    const entity = state.entities?.[parsed.entityId];
    if (!entity) return { verdict: 'unsupported', text: null, reason: 'entity_not_found' };
    const value = entity[parsed.attribute];
    if (value === undefined) return { verdict: 'unsupported', text: null, reason: 'attribute_not_found' };
    return { verdict: 'supported', text: Array.isArray(value) ? value.join(', ') : String(value) };
  }

  async replay(targetStep) {
    const checkpoint = await this.checkpointManager.loadBefore(targetStep);
    const startStep = checkpoint?.step ?? 0;
    const state = await this.replayer.replay(targetStep);
    this.lastReplaySteps = Math.max(0, targetStep - startStep);
    return state;
  }

  _captureState() {
    return {
      step: this.controller.stepCounter,
      columns: this.columns.map((column) => ({
        id: column.id,
        location: column.location,
        displacementBuffer: [...column.displacementEncoder.buffer]
      })),
      exp2State: structuredClone(this.exp2State)
    };
  }

  _restoreState(state) {
    if (!state) return;
    this.controller.stepCounter = state.step ?? this.controller.stepCounter;
    for (const columnState of state.columns ?? []) {
      const column = this.columns.find((c) => c.id === columnState.id);
      if (!column) continue;
      column.location = { ...columnState.location };
      column.fastMapLocations = column.fastMapLocations.map(() => ({ ...columnState.location }));
      column.slowMapLocations = column.slowMapLocations.map(() => ({ ...columnState.location }));
      column.displacementEncoder.buffer = [...(columnState.displacementBuffer ?? [])];
    }
    if (state.exp2State) {
      this.exp2State = structuredClone(state.exp2State);
    }
  }
}

function parseExp2Query(query) {
  const match = query.match(/STATE\?\s+time=(\d+)\s+entity=([^\s]+)\s+attribute=([^\s]+)/);
  if (!match) return null;
  return {
    targetStep: Number(match[1]),
    entityId: match[2],
    attribute: match[3]
  };
}

function initializeState() {
  return { entities: {}, items: {} };
}

function ensureEntity(state, entityId) {
  if (!state.entities[entityId]) {
    state.entities[entityId] = { location: null, inventory: [], alive: true };
  }
  return state.entities[entityId];
}

function ensureItem(state, itemId) {
  if (!state.items[itemId]) {
    state.items[itemId] = { location: null, heldBy: null };
  }
  return state.items[itemId];
}

function applyEventToState(state, event) {
  const subject = event.resolvedSubject ?? event.subject;
  const action = event.action;
  const obj = event.object;

  switch (action) {
    case 'enters':
    case 'moves_to': {
      const entity = ensureEntity(state, subject);
      entity.location = obj;
      break;
    }

    case 'picks_up': {
      const entity = ensureEntity(state, subject);
      const item = ensureItem(state, obj);

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
      const entity = ensureEntity(state, subject);
      const item = ensureItem(state, obj);
      entity.inventory = entity.inventory.filter((i) => i !== obj);
      item.heldBy = null;
      item.location = entity.location;
      break;
    }

    case 'dies': {
      const entity = ensureEntity(state, subject);
      entity.alive = false;
      break;
    }

    case 'SCENE_RESET': {
      break;
    }

    default:
      break;
  }
}

export { packLocKey };

function aggregateDiagnostics(perColumn) {
  if (!perColumn || perColumn.length === 0) {
    return { gridUtilization: 0, cellSaturation: 0, cellsAtFullCapacity: 0, nonEmptyCells: 0, zeroStepRate: 0 };
  }

  const sum = perColumn.reduce((acc, d) => {
    acc.gridUtilization += d.gridUtilization ?? 0;
    acc.cellSaturation += d.cellSaturation ?? 0;
    acc.cellsAtFullCapacity += d.cellsAtFullCapacity ?? 0;
    acc.nonEmptyCells += d.nonEmptyCells ?? 0;
    acc.zeroStepRate += d.zeroStepRate ?? 0;
    return acc;
  }, { gridUtilization: 0, cellSaturation: 0, cellsAtFullCapacity: 0, nonEmptyCells: 0, zeroStepRate: 0 });

  const n = perColumn.length;
  return {
    gridUtilization: sum.gridUtilization / n,
    cellSaturation: sum.cellSaturation / n,
    cellsAtFullCapacity: sum.cellsAtFullCapacity / n,
    nonEmptyCells: sum.nonEmptyCells / n,
    zeroStepRate: sum.zeroStepRate / n
  };
}

function computeColumnAgreement(columns) {
  if (!columns || columns.length === 0) return { agreement: 0, entropy: 0 };
  const counts = new Map();
  for (const column of columns) {
    const key = packLocKey(column.location.x, column.location.y);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const maxCount = Math.max(...counts.values());
  const total = columns.length;

  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / total;
    entropy -= p * Math.log2(p);
  }

  return { agreement: maxCount / total, entropy };
}
