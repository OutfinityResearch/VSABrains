const $ = (selector) => document.querySelector(selector);

const canvas = $('#gridCanvas');
const storyField = $('#storyField');
const storyAction = $('#storyAction');
const storyActionRun = $('#storyActionRun');
const contentMode = $('#contentMode');
const columnsRange = $('#columnsRange');
const columnsValue = $('#columnsValue');
const applyColumnsBtn = $('#applyColumnsBtn');
const animPlayBtn = $('#animPlayBtn');
const animPauseBtn = $('#animPauseBtn');
const animNextBtn = $('#animNextBtn');
const animSpeed = $('#animSpeed');
const animSpeedValue = $('#animSpeedValue');
const animSpeedHint = $('#animSpeedHint');
const statusMsg = $('#statusMsg');
const stepValue = $('#stepValue');
const eventsMeta = $('#eventsMeta');
const columnsMeta = $('#columnsMeta');
const contradictionsValue = $('#contradictionsValue');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

const queryType = $('#queryType');
const queryEntity = $('#queryEntity');
const queryTarget = $('#queryTarget');
const queryItem = $('#queryItem');
const queryLocation = $('#queryLocation');
const queryStep = $('#queryStep');
const queryLimit = $('#queryLimit');
const queryEntityField = $('#queryEntityField');
const queryTargetField = $('#queryTargetField');
const queryItemField = $('#queryItemField');
const queryLocationField = $('#queryLocationField');
const queryStepField = $('#queryStepField');
const queryLimitField = $('#queryLimitField');
const runQueryBtn = $('#runQueryBtn');
const queryAnswer = $('#queryAnswer');
const perfBarVsa = $('#perfBarVsa');
const perfBarNaive = $('#perfBarNaive');
const perfBarVsaValue = $('#perfBarVsaValue');
const perfBarNaiveValue = $('#perfBarNaiveValue');
const busyOverlay = $('#busyOverlay');
const busyMessage = $('#busyMessage');
const mismatchOverlay = $('#mismatchOverlay');
const mismatchCloseBtn = $('#mismatchCloseBtn');
const mismatchType = $('#mismatchType');
const mismatchStep = $('#mismatchStep');
const mismatchVsa = $('#mismatchVsa');
const mismatchNaive = $('#mismatchNaive');
const spacesContainer = $('#spacesContainer');
const spacesMeta = $('#spacesMeta');
const spacesGroup = $('#spacesGroup');
const spacesFilter = $('#spacesFilter');
const frameProfile = $('#frameProfile');
const cnlField = $('#cnlField');
const frameLegend = $('#frameLegend');
const framesSummary = $('#framesSummary');
const framesNow = $('#framesNow');
const columnsCheckboxes = $('#columnsCheckboxes');
const columnsAllBtn = $('#columnsAllBtn');
const columnsNoneBtn = $('#columnsNoneBtn');
const activityLog = $('#activityLog');
const subtabButtons = document.querySelectorAll('.subtab-btn');
const subtabPanels = document.querySelectorAll('.subtab-panel');

let state = null;
const sessionId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const STORY_LENGTH = 1_000;
const APPEND_COUNT = 10_000;
const columnColors = ['#7b8dff', '#52f2c2', '#ffb454', '#ff6bb5', '#73e2ff', '#c2ff6b'];
let busyCount = 0;
let busyDisabledElements = [];

const BASE_QUERY_DEFS = [
  { value: 'where', label: 'Where is an entity (latest)?', fields: { entity: true } },
  { value: 'whereAt', label: 'Where is an entity (at step)?', fields: { entity: true, step: true } },
  { value: 'entitiesAt', label: 'Who is in a location?', fields: { location: true, step: true } },
  { value: 'inventory', label: 'What does an entity have?', fields: { entity: true } },
  { value: 'whoHas', label: 'Who has an item?', fields: { item: true } },
  { value: 'itemLocation', label: 'Where is an item?', fields: { item: true, step: true } },
  { value: 'isAlive', label: 'Is an entity alive?', fields: { entity: true } },
  { value: 'lastEvent', label: 'Last event for entity', fields: { entity: true } },
  { value: 'timeline', label: 'Timeline for entity', fields: { entity: true, limit: true } },
  { value: 'contradictions', label: 'All contradictions', fields: {} },
  { value: 'contradictionsFor', label: 'Contradictions for entity', fields: { entity: true } }
];

const LITERATURE_QUERY_DEFS = [
  ...BASE_QUERY_DEFS,
  { value: 'dominantEmotion', label: 'Dominant emotion', fields: {} },
  { value: 'emotionalArc', label: 'Emotional arc trend', fields: {} },
  { value: 'dominantTheme', label: 'Dominant theme', fields: {} },
  { value: 'mainConflict', label: 'Main conflict type', fields: {} },
  { value: 'relationshipStatus', label: 'Relationship status (two entities)', fields: { entity: true, target: true } },
  { value: 'powerBalance', label: 'Power balance (two entities)', fields: { entity: true, target: true } },
  { value: 'narrativePhase', label: 'Narrative phase', fields: {} },
  { value: 'tone', label: 'Dominant tone', fields: {} },
  { value: 'motif', label: 'Dominant motif', fields: {} },
  { value: 'characterArc', label: 'Character arc', fields: { entity: true } },
  { value: 'secretHolder', label: 'Secret holder', fields: {} },
  { value: 'narratorReliability', label: 'Narrator reliability', fields: {} }
];

const CHAT_QUERY_DEFS = [
  ...BASE_QUERY_DEFS,
  { value: 'dominantSentiment', label: 'Dominant sentiment', fields: {} },
  { value: 'topicFocus', label: 'Dominant topic', fields: {} },
  { value: 'agreementLevel', label: 'Agreement level', fields: {} },
  { value: 'conflictLevel', label: 'Conflict level', fields: {} },
  { value: 'politeness', label: 'Politeness level', fields: {} },
  { value: 'dominantSpeaker', label: 'Dominant speaker', fields: {} },
  { value: 'resolutionStatus', label: 'Resolution status', fields: {} },
  { value: 'trustLevel', label: 'Trust level (two entities)', fields: { entity: true, target: true } },
  { value: 'misinformationRisk', label: 'Misinformation risk', fields: {} },
  { value: 'intentDistribution', label: 'Intent distribution', fields: {} },
  { value: 'actionItems', label: 'Action items', fields: {} }
];

const QUERY_DEFS = {
  synthetic: BASE_QUERY_DEFS,
  literature: LITERATURE_QUERY_DEFS,
  chat: CHAT_QUERY_DEFS
};

let queryDefMap = new Map(BASE_QUERY_DEFS.map((def) => [def.value, def]));
let semanticSummaryCache = null;
let activeFramesSet = new Set();
let visibleColumns = new Set();
let columnsInitialized = false;
let lastColumnsCount = 0;
let highlightedFrame = null;
let overlayFrames = [];
let legendFrames = [];
let querySequenceTimers = [];
let savedHighlight = null;
let animationSpeed = 1;
let activeSubtab = 'query';
let pulseState = null;
let pulseFrame = null;
let frameSegmentsMap = {};
let frameTimeline = [];

const SEMANTIC_QUERY_REQUIREMENTS = {
  dominantEmotion: ['emotionState'],
  emotionalArc: ['emotionIntensity', 'tensionLevel'],
  dominantTheme: ['themeTags'],
  mainConflict: ['conflictType', 'conflictEscalation'],
  relationshipStatus: ['trustRelation', 'hostilityRelation'],
  powerBalance: ['powerBalance'],
  narrativePhase: ['narrativePhase'],
  tone: ['toneStyle'],
  motif: ['motifRecurrence'],
  characterArc: ['characterArc'],
  secretHolder: ['secretState'],
  narratorReliability: ['narratorReliability'],
  dominantSentiment: ['emotionState'],
  topicFocus: ['themeTags'],
  agreementLevel: ['stanceAgreement'],
  conflictLevel: ['conflictEscalation'],
  politeness: ['politenessLevel'],
  dominantSpeaker: ['speakerTurns'],
  resolutionStatus: ['narrativePhase'],
  trustLevel: ['trustRelation'],
  misinformationRisk: ['evidenceStrength'],
  intentDistribution: ['goalState'],
  actionItems: ['planProgress']
};

const SPACE_GROUPS = [
  { label: 'Emotion & Affect', spaces: ['emotionState', 'emotionIntensity', 'moodTrend', 'tensionLevel'] },
  { label: 'Motivation & Intent', spaces: ['goalState', 'desireIntensity', 'planProgress', 'obstaclePressure'] },
  { label: 'Relationships', spaces: ['trustRelation', 'intimacyRelation', 'hostilityRelation', 'allianceRelation'] },
  { label: 'Power & Status', spaces: ['powerBalance', 'statusRank', 'authorityLegitimacy', 'dominanceMoves'] },
  { label: 'Conflict & Intrigue', spaces: ['conflictType', 'conflictEscalation', 'deceptionSignals', 'secretState'] },
  { label: 'Narrative Structure', spaces: ['narrativePhase', 'focalCharacter', 'plotTurns', 'pacingTempo'] },
  { label: 'Themes & Symbols', spaces: ['themeTags', 'motifRecurrence', 'symbolismType', 'moralTheme'] },
  { label: 'Dialogue & Pragmatics', spaces: ['dialogueAct', 'politenessLevel', 'stanceAgreement', 'persuasionTactic'] },
  { label: 'Epistemic & Reliability', spaces: ['beliefState', 'evidenceStrength', 'narratorReliability', 'uncertaintyLevel'] },
  { label: 'Character Psychology', spaces: ['mentalState', 'cognitiveBias', 'resilienceLevel', 'empathyLevel'] },
  { label: 'Style & Rhetoric', spaces: ['toneStyle', 'imageryDensity', 'rhetoricDevice', 'voiceRegister'] },
  { label: 'Reader Impact', spaces: ['predictedEmotion', 'emotionalAftertaste', 'memorabilityHook', 'cognitiveLoad'] }
];

const FRAME_GROUP_COLORS = new Map([
  ['Emotion & Affect', '#ff6bb5'],
  ['Motivation & Intent', '#52f2c2'],
  ['Relationships', '#ffd27a'],
  ['Power & Status', '#ffb454'],
  ['Conflict & Intrigue', '#ff7a5a'],
  ['Narrative Structure', '#7b8dff'],
  ['Themes & Symbols', '#c084ff'],
  ['Dialogue & Pragmatics', '#73e2ff'],
  ['Epistemic & Reliability', '#9ae66e'],
  ['Character Psychology', '#f27d52'],
  ['Style & Rhetoric', '#a4b0ff'],
  ['Reader Impact', '#ff9bd5']
]);

const FRAME_TO_GROUP = new Map();
SPACE_GROUPS.forEach((group) => {
  group.spaces.forEach((space) => {
    FRAME_TO_GROUP.set(space, group.label);
  });
});

function populateSelect(select, values) {
  if (!select) return;
  select.innerHTML = '';
  values.forEach((value) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  });
}

function setQueryOptions(mode = 'synthetic') {
  const defs = QUERY_DEFS[mode] ?? QUERY_DEFS.synthetic;
  queryDefMap = new Map(defs.map((def) => [def.value, def]));
  const previous = queryType.value;
  queryType.innerHTML = '';
  defs.forEach((def) => {
    const opt = document.createElement('option');
    opt.value = def.value;
    opt.textContent = def.label;
    queryType.appendChild(opt);
  });
  if (queryDefMap.has(previous)) {
    queryType.value = previous;
  }
  updateQueryFields();
}

function collectInteractiveElements() {
  return [...document.querySelectorAll('button, input, select, textarea')]
    .filter((el) => el.id !== 'storyField' && el.id !== 'queryAnswer');
}

function setBusy(active, message = 'Working…') {
  if (active) {
    if (busyCount === 0) {
      busyDisabledElements = collectInteractiveElements().filter((el) => !el.disabled);
      busyDisabledElements.forEach((el) => { el.disabled = true; });
    }
    busyCount += 1;
    if (busyOverlay) busyOverlay.classList.add('active');
    if (busyMessage) busyMessage.textContent = message;
    document.body.classList.add('is-busy');
    return;
  }

  busyCount = Math.max(0, busyCount - 1);
  if (busyCount > 0) return;
  busyDisabledElements.forEach((el) => { el.disabled = false; });
  busyDisabledElements = [];
  if (busyOverlay) busyOverlay.classList.remove('active');
  document.body.classList.remove('is-busy');
}

function inferBusyMessage(url, fallback) {
  if (fallback) return fallback;
  if (url.includes('/api/story/generate')) return 'Generating story on server…';
  if (url.includes('/api/story/append')) return 'Appending actions on server…';
  if (url.includes('/api/config')) return 'Rebuilding columns on server…';
  if (url.includes('/api/query')) return 'Running query on server…';
  if (url.includes('/api/state')) return 'Loading state from server…';
  return 'Working…';
}

async function fetchJson(url, options) {
  const { busyMessage: busyText, ...fetchOptions } = options ?? {};
  setBusy(true, inferBusyMessage(url, busyText));
  const headers = { ...(fetchOptions.headers ?? {}), 'x-session-id': sessionId };
  try {
    const res = await fetch(url, { ...fetchOptions, headers });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  } finally {
    setBusy(false);
  }
}

function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return String(value);
  }
}

function hideMismatch() {
  if (mismatchOverlay) mismatchOverlay.classList.remove('active');
}

function showMismatch(metrics) {
  if (!metrics?.mismatch || !metrics.mismatchDetails) {
    hideMismatch();
    return;
  }
  const details = metrics.mismatchDetails;
  if (mismatchType) mismatchType.textContent = `Type: ${details.type ?? metrics.type ?? 'unknown'}`;
  if (mismatchStep) mismatchStep.textContent = `Step: ${metrics.targetStep ?? 'latest'}`;
  if (mismatchVsa) mismatchVsa.value = safeStringify(details.vsaAnswer);
  if (mismatchNaive) mismatchNaive.value = safeStringify(details.naiveAnswer);
  if (mismatchOverlay) mismatchOverlay.classList.add('active');
}

function setStatus(message, tone = 'error') {
  if (!message) {
    statusMsg.textContent = '';
    return;
  }
  statusMsg.textContent = message;
  statusMsg.style.color = tone === 'error' ? '#f7b4b4' : '#a2f5d6';
}

function displayTime(ms) {
  if (!Number.isFinite(ms)) return { label: '—', scaleSeconds: NaN };
  const safeMs = Math.max(0, ms);
  const seconds = safeMs / 1000;
  if (seconds >= 1) {
    const roundedSeconds = Math.max(1, Math.round(seconds));
    return { label: `${roundedSeconds}s`, scaleSeconds: seconds };
  }
  if (safeMs < 1) {
    return { label: '<1 ms', scaleSeconds: 0.001 };
  }
  const msLabel = safeMs < 10
    ? safeMs.toFixed(2)
    : safeMs < 100
      ? safeMs.toFixed(1)
      : String(Math.round(safeMs));
  return { label: `${msLabel} ms`, scaleSeconds: seconds };
}

function ensureVisibleColumns(count) {
  if (!columnsInitialized) {
    visibleColumns = new Set(Array.from({ length: count }, (_, i) => i));
    columnsInitialized = true;
    lastColumnsCount = count;
    renderColumnFilters(count);
    return;
  }
  const hadAll = visibleColumns.size === lastColumnsCount && lastColumnsCount > 0;
  const next = new Set([...visibleColumns].filter((idx) => idx < count));
  if (hadAll) {
    for (let i = 0; i < count; i += 1) {
      next.add(i);
    }
  }
  visibleColumns = next;
  lastColumnsCount = count;
  renderColumnFilters(count);
}

function renderColumnFilters(count) {
  if (!columnsCheckboxes) return;
  columnsCheckboxes.innerHTML = '';
  for (let i = 0; i < count; i += 1) {
    const id = `col_${i}`;
    const label = document.createElement('label');
    label.className = 'column-toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = visibleColumns.has(i);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) visibleColumns.add(i);
      else visibleColumns.delete(i);
      drawGrid();
    });
    const swatch = document.createElement('span');
    swatch.className = 'column-swatch';
    swatch.style.background = columnColors[i % columnColors.length];
    const text = document.createElement('span');
    text.textContent = `C${i + 1}`;
    label.appendChild(checkbox);
    label.appendChild(swatch);
    label.appendChild(text);
    columnsCheckboxes.appendChild(label);
  }
}

function setAllColumns(checked) {
  const count = state?.columns?.length ?? state?.numColumns ?? 0;
  visibleColumns = new Set(Array.from({ length: count }, (_, i) => (checked ? i : null)).filter((v) => v != null));
  columnsInitialized = true;
  lastColumnsCount = count;
  renderColumnFilters(count);
  drawGrid();
}

function addActivity(message, tone = 'info') {
  if (!activityLog) return;
  const time = new Date().toLocaleTimeString().slice(0, 8);
  const entry = document.createElement('div');
  entry.className = `activity-entry ${tone}`;
  entry.innerHTML = `<span class="activity-time">${time}</span><span class="activity-message">${message}</span>`;
  activityLog.prepend(entry);
  const items = activityLog.querySelectorAll('.activity-entry');
  if (items.length > 40) items[items.length - 1].remove();
}

function triggerPulse(columns, kind = 'major', duration = 1000, frame = null) {
  pulseState = {
    start: performance.now(),
    duration,
    columns,
    kind,
    frame
  };
  if (!pulseFrame) {
    pulseFrame = requestAnimationFrame(renderPulse);
  }
}

function renderPulse(now) {
  if (!pulseState) {
    pulseFrame = null;
    return;
  }
  if (!pulseState.playing) {
    pulseFrame = null;
    return;
  }
  const elapsed = now - pulseState.start;
  pulseState.progress = Math.min(1, elapsed / pulseState.duration);
  if (pulseState.mode === 'frames' && pulseState.timeline?.length) {
    const idx = Math.min(
      pulseState.timeline.length - 1,
      Math.floor(pulseState.progress * (pulseState.timeline.length - 1))
    );
    const entry = pulseState.timeline[idx];
    pulseState.currentEntry = entry;
    highlightedFrame = entry.frames?.[0] ?? null;
  } else if (pulseState.frameCycle && pulseState.frameCycle.length > 0 && pulseState.frameDuration) {
    const idx = Math.min(
      pulseState.frameCycle.length - 1,
      Math.floor(elapsed / pulseState.frameDuration)
    );
    highlightedFrame = pulseState.frameCycle[idx];
  }
  if (framesNow && pulseState.mode === 'frames') {
    const step = pulseState.currentEntry?.step ?? '—';
    const frames = pulseState.currentEntry?.frames ?? [];
    const frameLabel = frames.length ? frames.map((frame) => prettyName(frame)).join(', ') : '—';
    framesNow.textContent = `Now playing · step ${step} · frames: ${frameLabel}`;
  }
  if (elapsed > pulseState.duration) {
    const restore = pulseState.restoreFrame ?? null;
    pulseState = null;
    pulseFrame = null;
    highlightedFrame = restore;
    drawGrid();
    return;
  }
  drawGrid(pulseState.progress);
  pulseFrame = requestAnimationFrame(renderPulse);
}

function pulseStroke(baseColor, kind, alpha) {
  if (kind === 'minor') {
    return `rgba(120,130,150,${alpha})`;
  }
  return `${baseColor}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 1) return '<1s';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function prettyName(id) {
  if (!id) return '';
  return id
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function frameColor(frame) {
  const group = FRAME_TO_GROUP.get(frame);
  return FRAME_GROUP_COLORS.get(group) ?? '#7b8dff';
}

function computeFrameScores(summary) {
  if (!summary) return [];
  const frames = Array.from(activeFramesSet);
  return frames.map((frame) => {
    const top = summary.top?.[frame];
    const score = top?.count ?? 0;
    return { frame, score };
  });
}

function renderFrameLegend(summary) {
  if (!frameLegend) return;
  const scored = computeFrameScores(summary).sort((a, b) => b.score - a.score).filter((entry) => entry.score > 0);
  overlayFrames = scored.slice(0, 3);
  legendFrames = scored.slice(0, 6);
  if (!legendFrames.length) {
    frameLegend.textContent = 'No active frames to display yet.';
    if (framesSummary) framesSummary.value = 'No semantic summary yet.';
    if (framesNow) framesNow.textContent = 'Idle · no frame playing';
    return;
  }
  frameLegend.innerHTML = '';
  const maxScore = Math.max(...legendFrames.map((entry) => entry.score), 1);
  legendFrames.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'frame-row';
    const name = document.createElement('div');
    name.className = 'frame-name';
    const dot = document.createElement('span');
    dot.className = 'frame-dot';
    dot.style.background = frameColor(entry.frame);
    const label = document.createElement('span');
    label.textContent = prettyName(entry.frame);
    name.appendChild(dot);
    name.appendChild(label);

    const bar = document.createElement('div');
    bar.className = 'frame-bar';
    const fill = document.createElement('span');
    fill.style.background = frameColor(entry.frame);
    fill.style.transform = `scaleX(${Math.max(0.05, entry.score / maxScore)})`;
    bar.appendChild(fill);

    const count = document.createElement('div');
    count.className = 'frame-count';
    count.textContent = entry.score.toLocaleString();

    row.appendChild(name);
    row.appendChild(bar);
    row.appendChild(count);
    frameLegend.appendChild(row);
  });
  if (framesSummary) {
    const summaryLines = [];
    const pickTop = (frame) => summary?.top?.[frame]?.value ?? null;
    const mode = state?.contentMode ?? 'synthetic';
    if (mode === 'literature') {
      const theme = pickTop('themeTags');
      const tone = pickTop('toneStyle');
      const conflict = pickTop('conflictType');
      const motif = pickTop('motifRecurrence');
      const emotion = pickTop('emotionState');
      summaryLines.push(`Theme: ${theme ?? '—'}`);
      summaryLines.push(`Tone: ${tone ?? '—'}`);
      summaryLines.push(`Conflict: ${conflict ?? '—'}`);
      summaryLines.push(`Motif: ${motif ?? '—'}`);
      summaryLines.push(`Emotion: ${emotion ?? '—'}`);
    } else if (mode === 'chat') {
      const topic = pickTop('themeTags');
      const sentiment = pickTop('emotionState');
      const politeness = pickTop('politenessLevel');
      const persuasion = pickTop('persuasionTactic');
      summaryLines.push(`Topic: ${topic ?? '—'}`);
      summaryLines.push(`Sentiment: ${sentiment ?? '—'}`);
      summaryLines.push(`Politeness: ${politeness ?? '—'}`);
      summaryLines.push(`Persuasion: ${persuasion ?? '—'}`);
    } else {
      const emotion = pickTop('emotionState');
      const intent = pickTop('goalState');
      const stance = pickTop('stanceAgreement');
      summaryLines.push(`Emotion: ${emotion ?? '—'}`);
      summaryLines.push(`Intent: ${intent ?? '—'}`);
      summaryLines.push(`Stance: ${stance ?? '—'}`);
    }
    const top = scored.slice(0, 3).map((entry) => `${prettyName(entry.frame)} (${entry.score})`).join(', ');
    summaryLines.push(`Top frames: ${top || '—'}`);
    framesSummary.value = summaryLines.join('\n');
  }
  buildFrameTimeline();
}

function buildFrameTimeline() {
  const stepMap = new Map();
  legendFrames.forEach((entry) => {
    const frame = entry.frame;
    const segments = frameSegmentsMap?.[frame] ?? [];
    segments.forEach((seg) => {
      const key = String(seg.step);
      if (!stepMap.has(key)) {
        stepMap.set(key, { step: seg.step, frames: [frame], locations: seg.locations });
      } else {
        const item = stepMap.get(key);
        if (!item.frames.includes(frame)) item.frames.push(frame);
      }
    });
  });
  const steps = Array.from(stepMap.values()).sort((a, b) => a.step - b.step);
  frameTimeline = steps.slice(-120);
}

function startFramePreview() {
  if (!legendFrames.length) return;
  clearQuerySequence(false);
  savedHighlight = highlightedFrame;
  const speed = Math.max(0.1, animationSpeed);
  const stepDelay = 320 / speed;
  const pulseDuration = 900 / speed;
  legendFrames.forEach((entry, index) => {
    const timer = setTimeout(() => {
      highlightedFrame = entry.frame;
      triggerPulse([...visibleColumns], 'major', pulseDuration, entry.frame);
    }, stepDelay * index);
    querySequenceTimers.push(timer);
  });
  const endTimer = setTimeout(() => {
    highlightedFrame = savedHighlight;
    pulseState = null;
    drawGrid();
  }, stepDelay * legendFrames.length + 200);
  querySequenceTimers.push(endTimer);
}

function clearQuerySequence(restoreHighlight = true) {
  querySequenceTimers.forEach((timer) => clearTimeout(timer));
  querySequenceTimers = [];
  if (pulseFrame) {
    cancelAnimationFrame(pulseFrame);
    pulseFrame = null;
  }
  if (restoreHighlight) {
    highlightedFrame = savedHighlight;
  }
  pulseState = null;
  drawGrid();
}

function computeColumnConsensus(columns = []) {
  if (!columns.length) return { centroid: null, ordered: [], majorityCount: 0 };
  const centroid = columns.reduce((acc, loc) => {
    acc.x += loc.x;
    acc.y += loc.y;
    return acc;
  }, { x: 0, y: 0 });
  centroid.x /= columns.length;
  centroid.y /= columns.length;
  const ordered = columns
    .map((loc, idx) => {
      const dx = loc.x - centroid.x;
      const dy = loc.y - centroid.y;
      return { idx, dist: Math.hypot(dx, dy) };
    })
    .sort((a, b) => a.dist - b.dist);
  const majorityCount = Math.max(1, Math.ceil(columns.length / 2));
  return { centroid, ordered, majorityCount };
}

function startQueryAnimation(autoPlay = true) {
  if (!state?.columns?.length) return;
  clearQuerySequence(false);
  savedHighlight = highlightedFrame;
  const { ordered, majorityCount } = computeColumnConsensus(state.columns);
  if (!ordered.length) return;
  const speed = Math.max(0.001, animationSpeed);
  const sweepDuration = 2200 / speed;
  const frameCycle = overlayFrames.length ? overlayFrames.map((entry) => entry.frame) : [];
  const frameDuration = frameCycle.length ? sweepDuration / frameCycle.length : sweepDuration;
  pulseState = {
    mode: 'query',
    start: performance.now(),
    duration: sweepDuration,
    progress: 0,
    playing: autoPlay,
    columns: ordered.map((entry) => entry.idx),
    majorColumns: ordered.slice(0, majorityCount).map((entry) => entry.idx),
    minorColumns: ordered.slice(majorityCount).map((entry) => entry.idx),
    frameCycle,
    frameDuration,
    restoreFrame: savedHighlight
  };
  if (autoPlay && !pulseFrame) {
    pulseFrame = requestAnimationFrame(renderPulse);
  } else if (!autoPlay) {
    drawGrid(0);
  }
}

function startFramesAnimation(autoPlay = true) {
  if (!state?.columns?.length) return;
  clearQuerySequence(false);
  savedHighlight = highlightedFrame;
  const speed = Math.max(0.001, animationSpeed);
  const sweepDuration = 2200 / speed;
  const cols = state.columns.map((_, idx) => idx);
  if (!frameTimeline.length) buildFrameTimeline();
  const timeline = frameTimeline.length ? frameTimeline : [];
  pulseState = {
    mode: 'frames',
    start: performance.now(),
    duration: sweepDuration,
    progress: 0,
    playing: autoPlay,
    columns: cols,
    majorColumns: cols,
    minorColumns: [],
    timeline,
    restoreFrame: savedHighlight,
    labelOverride: 'frame',
    note: 'linked'
  };
  if (autoPlay && !pulseFrame) {
    pulseFrame = requestAnimationFrame(renderPulse);
  } else if (!autoPlay) {
    drawGrid(0);
  }
}

function stopAnimation() {
  if (!pulseState) return;
  pulseState.playing = false;
  if (pulseFrame) {
    cancelAnimationFrame(pulseFrame);
    pulseFrame = null;
  }
  if (framesNow && pulseState.mode === 'frames') {
    framesNow.textContent = 'Paused · no frame playing';
  }
  drawGrid(pulseState.progress ?? 0);
}

function stepAnimation(mode) {
  if (!pulseState || pulseState.mode !== mode) {
    if (mode === 'query') startQueryAnimation(false);
    else startFramesAnimation(false);
  }
  if (!pulseState) return;
  pulseState.playing = false;
  if (mode === 'frames' && pulseState.timeline?.length) {
    const current = Math.floor((pulseState.progress ?? 0) * (pulseState.timeline.length - 1));
    const next = Math.min(pulseState.timeline.length - 1, current + 1);
    pulseState.progress = pulseState.timeline.length > 1
      ? next / (pulseState.timeline.length - 1)
      : 1;
    pulseState.currentEntry = pulseState.timeline[next];
    highlightedFrame = pulseState.currentEntry.frames?.[0] ?? null;
    if (framesNow) {
      const frames = pulseState.currentEntry.frames ?? [];
      const frameLabel = frames.length ? frames.map((frame) => prettyName(frame)).join(', ') : '—';
      framesNow.textContent = `Now playing · step ${pulseState.currentEntry.step} · frames: ${frameLabel}`;
    }
  } else {
    const step = 0.12;
    pulseState.progress = Math.min(1, (pulseState.progress ?? 0) + step);
    const elapsed = pulseState.progress * pulseState.duration;
    if (pulseState.frameCycle && pulseState.frameCycle.length > 0 && pulseState.frameDuration) {
      const idx = Math.min(
        pulseState.frameCycle.length - 1,
        Math.floor(elapsed / pulseState.frameDuration)
      );
      highlightedFrame = pulseState.frameCycle[idx];
    }
  }
  drawGrid(pulseState.progress);
}

function renderSparkline(series) {
  if (!Array.isArray(series) || series.length < 2) return '';
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const points = series.map((value, idx) => {
    const x = (idx / (series.length - 1)) * 100;
    const y = 100 - ((value - min) / span) * 100;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `
    <svg class="space-spark" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline points="${points}" fill="none" stroke="rgba(123,141,255,0.9)" stroke-width="2" />
    </svg>
  `;
}

function renderSpaces(summary) {
  if (!spacesContainer) return;
  spacesContainer.innerHTML = '';

  if (!summary) {
    spacesContainer.textContent = 'No semantic facts yet.';
    return;
  }

  const groupFilter = spacesGroup?.value ?? 'all';
  const textFilter = (spacesFilter?.value ?? '').trim().toLowerCase();

  const matchesText = (space) => {
    if (!textFilter) return true;
    return space.toLowerCase().includes(textFilter) || prettyName(space).toLowerCase().includes(textFilter);
  };

  let any = false;

  SPACE_GROUPS.forEach((group) => {
    if (groupFilter !== 'all' && group.label !== groupFilter) return;
    const spaces = group.spaces.filter(matchesText);
    if (spaces.length === 0) return;
    any = true;
    const groupLabel = document.createElement('div');
    groupLabel.className = 'space-group';
    groupLabel.textContent = group.label;
    spacesContainer.appendChild(groupLabel);

    spaces.forEach((space) => {
      const card = document.createElement('div');
      const isActive = activeFramesSet.size === 0 || activeFramesSet.has(space);
      card.className = `space-card${isActive ? '' : ' inactive'}`;

      const top = summary.top?.[space];
      const last = summary.last?.[space];
      const relation = summary.relations?.[space]?.[0];
      const series = summary.series?.[space] ?? [];

      const topText = top?.value != null ? `${top.value} (${top.count})` : '—';
      const lastText = last != null ? String(last) : '—';
      const relationText = relation ? `${relation.pair} (${relation.value})` : null;

      card.innerHTML = `
        <div class="space-title">${prettyName(space)}</div>
        <div class="space-meta">
          <span>Top: ${topText}</span>
          <span>Last: ${lastText}</span>
          ${relationText ? `<span>Pair: ${relationText}</span>` : ''}
        </div>
        ${renderSparkline(series)}
      `;
      spacesContainer.appendChild(card);
    });
  });

  if (!any) {
    spacesContainer.textContent = 'No frames match the current filter.';
  }
}

function updatePerf(metrics) {
  const setBar = (barEl, valueEl, width, label) => {
    if (barEl) barEl.style.width = width;
    if (valueEl) valueEl.textContent = label;
  };

  if (!metrics) {
    setBar(perfBarVsa, perfBarVsaValue, '0%', '—');
    setBar(perfBarNaive, perfBarNaiveValue, '0%', '—');
    return;
  }

  if (metrics.note) {
    const needLabel = `Need ≥ ${metrics.windowSize ?? 6} steps`;
    setBar(perfBarVsa, perfBarVsaValue, '0%', needLabel);
    setBar(perfBarNaive, perfBarNaiveValue, '0%', needLabel);
    return;
  }

  const vsaTime = Number.isFinite(metrics.vsaTimeMs) ? metrics.vsaTimeMs : NaN;
  const naiveTime = Number.isFinite(metrics.naiveTimeMs) ? metrics.naiveTimeMs : NaN;
  const vsaDisplay = displayTime(vsaTime);
  const naiveDisplay = displayTime(naiveTime);
  const safeVsa = Number.isFinite(vsaDisplay.scaleSeconds) ? vsaDisplay.scaleSeconds : 0;
  const safeNaive = Number.isFinite(naiveDisplay.scaleSeconds) ? naiveDisplay.scaleSeconds : 0;
  const maxTime = Math.max(safeVsa, safeNaive, 1e-9);
  const scaleWidth = (cost) => {
    if (!Number.isFinite(cost) || cost <= 0) return 0;
    const pct = (cost / maxTime) * 100;
    return Math.max(2, Math.min(100, pct));
  };

  const mismatchLabel = metrics.mismatch ? ' · mismatch' : '';
  const vsaLabel = Number.isFinite(vsaDisplay.scaleSeconds) ? `${vsaDisplay.label}${mismatchLabel}` : '—';
  const naiveLabel = Number.isFinite(naiveDisplay.scaleSeconds)
    ? `${naiveDisplay.label}${mismatchLabel}`
    : '—';

  setBar(perfBarVsa, perfBarVsaValue, `${scaleWidth(vsaDisplay.scaleSeconds)}%`, vsaLabel);
  setBar(perfBarNaive, perfBarNaiveValue, `${scaleWidth(naiveDisplay.scaleSeconds)}%`, naiveLabel);
}

function drawGrid(pulseProgress = null) {
  if (!state?.mapConfig) return;
  const ctx = canvas.getContext('2d');
  const { width, height } = state.mapConfig;
  const cellSize = canvas.width / width;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0b0f1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 4) {
    ctx.beginPath();
    ctx.moveTo(x * cellSize, 0);
    ctx.lineTo(x * cellSize, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y * cellSize);
    ctx.lineTo(canvas.width, y * cellSize);
    ctx.stroke();
  }

  if (state.history?.length > 0) {
    const columns = state.columns?.length ?? 1;
    for (let c = 0; c < columns; c++) {
      if (!visibleColumns.has(c)) continue;
      const path = state.history.map((entry) => entry.locations?.[c]).filter(Boolean);
      if (path.length === 0) continue;
      const baseAlpha = pulseState ? '33' : 'aa';
      ctx.strokeStyle = columnColors[c % columnColors.length] + baseAlpha;
      ctx.lineWidth = 2;
      ctx.beginPath();
      path.forEach((loc, idx) => {
        const px = (loc.x + 0.5) * cellSize;
        const py = (loc.y + 0.5) * cellSize;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      if (pulseState && pulseProgress != null) {
        const kind = pulseState.majorColumns?.includes(c)
          ? 'major'
          : pulseState.minorColumns?.includes(c)
            ? 'minor'
            : pulseState.columns?.includes(c)
              ? (pulseState.kind ?? 'major')
              : null;
        if (kind) {
          if (pulseState.mode === 'frames' && pulseState.currentEntry) {
            const step = pulseState.currentEntry.step;
            const prev = state.history?.[step - 1]?.locations ?? pulseState.currentEntry.locations;
            const to = pulseState.currentEntry.locations?.[c];
            const from = prev?.[c] ?? to;
            if (from && to) {
              const baseColor = frameColor(highlightedFrame ?? '');
              ctx.strokeStyle = pulseStroke(baseColor, 'major', 0.95);
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.moveTo((from.x + 0.5) * cellSize, (from.y + 0.5) * cellSize);
              ctx.lineTo((to.x + 0.5) * cellSize, (to.y + 0.5) * cellSize);
              ctx.stroke();
              if (c === 0) {
                const hx = (to.x + 0.5) * cellSize;
                const hy = (to.y + 0.5) * cellSize;
                ctx.fillStyle = pulseStroke(baseColor, 'major', 1);
                ctx.beginPath();
                ctx.arc(hx, hy, cellSize * 0.18, 0, Math.PI * 2);
                ctx.fill();
                const label = [];
                label.push(`Step ${step}`);
                label.push('frame');
                if (highlightedFrame) label.push(prettyName(highlightedFrame));
                const labelText = label.join(' · ');
                ctx.font = `${Math.max(10, Math.round(cellSize * 0.22))}px Inter, sans-serif`;
                const textWidth = ctx.measureText(labelText).width;
                const pad = 4;
                const boxW = textWidth + pad * 2;
                const boxH = Math.max(14, cellSize * 0.28);
                const boxX = hx + cellSize * 0.25;
                const boxY = hy - boxH * 0.5;
                ctx.fillStyle = 'rgba(8, 12, 24, 0.8)';
                ctx.fillRect(boxX, boxY, boxW, boxH);
                ctx.strokeStyle = pulseStroke(baseColor, 'major', 0.6);
                ctx.strokeRect(boxX, boxY, boxW, boxH);
                ctx.fillStyle = '#e6ecff';
                ctx.fillText(labelText, boxX + pad, boxY + boxH - pad);
              }
            }
          } else {
            const baseColor = columnColors[c % columnColors.length];
            const segmentLength = Math.min(10, path.length);
            const pathIndex = Math.max(0, Math.floor(pulseProgress * (path.length - 1)));
            const startIndex = Math.max(0, pathIndex - segmentLength + 1);
            const segment = path.slice(startIndex, pathIndex + 1);
            ctx.strokeStyle = pulseStroke(baseColor, kind, 0.95);
            ctx.lineWidth = 4;
            ctx.beginPath();
            segment.forEach((loc, idx) => {
              const px = (loc.x + 0.5) * cellSize;
              const py = (loc.y + 0.5) * cellSize;
              if (idx === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            });
            ctx.stroke();
            const head = segment[segment.length - 1];
            if (head) {
              const hx = (head.x + 0.5) * cellSize;
              const hy = (head.y + 0.5) * cellSize;
              ctx.fillStyle = pulseStroke(baseColor, kind, 1);
              ctx.beginPath();
              ctx.arc(hx, hy, cellSize * 0.18, 0, Math.PI * 2);
              ctx.fill();
              const label = [];
              label.push(`C${c + 1}`);
              const labelKind = pulseState.labelOverride ?? kind;
              label.push(labelKind);
              if (pulseState.note) label.push(pulseState.note);
              if (highlightedFrame) label.push(prettyName(highlightedFrame));
              const labelText = label.join(' · ');
              ctx.font = `${Math.max(10, Math.round(cellSize * 0.22))}px Inter, sans-serif`;
              const textWidth = ctx.measureText(labelText).width;
              const pad = 4;
              const boxW = textWidth + pad * 2;
              const boxH = Math.max(14, cellSize * 0.28);
              const boxX = hx + cellSize * 0.25;
              const boxY = hy - boxH * 0.5;
              ctx.fillStyle = 'rgba(8, 12, 24, 0.8)';
              ctx.fillRect(boxX, boxY, boxW, boxH);
              ctx.strokeStyle = pulseStroke(baseColor, kind, 0.6);
              ctx.strokeRect(boxX, boxY, boxW, boxH);
              ctx.fillStyle = '#e6ecff';
              ctx.fillText(labelText, boxX + pad, boxY + boxH - pad);
            }
          }
        }
      }
    }
  }

  if (state.columns?.length) {
    const offsets = [
      { x: -0.2, y: -0.15 },
      { x: 0.2, y: -0.1 },
      { x: -0.1, y: 0.2 },
      { x: 0.15, y: 0.2 }
    ];
    state.columns.forEach((loc, idx) => {
      if (!visibleColumns.has(idx)) return;
      const px = (loc.x + 0.5 + offsets[idx % offsets.length].x) * cellSize;
      const py = (loc.y + 0.5 + offsets[idx % offsets.length].y) * cellSize;
      ctx.fillStyle = columnColors[idx % columnColors.length];
      ctx.beginPath();
      ctx.arc(px, py, cellSize * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = columnColors[idx % columnColors.length];
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (overlayFrames.length > 0 && pulseState?.mode !== 'frames') {
        const dotOffsets = [
          { x: -0.45, y: -0.5 },
          { x: 0.45, y: -0.45 },
          { x: 0.5, y: 0.4 },
          { x: -0.5, y: 0.45 }
        ];
        overlayFrames.forEach((entry, index) => {
          const offset = dotOffsets[index % dotOffsets.length];
          const dx = offset.x * cellSize;
          const dy = offset.y * cellSize;
          ctx.fillStyle = frameColor(entry.frame);
          ctx.beginPath();
          ctx.arc(px + dx, py + dy, cellSize * 0.12, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      if (highlightedFrame) {
        ctx.strokeStyle = frameColor(highlightedFrame);
        ctx.lineWidth = cellSize * 0.12;
        ctx.beginPath();
        ctx.arc(px, py, cellSize * 0.68, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }

  if (pulseState && pulseProgress != null && state.columns?.length) {
    const pulse = 1 - pulseProgress;
    const radius = cellSize * (0.6 + 1.2 * pulseProgress);
    state.columns.forEach((loc, idx) => {
      if (!visibleColumns.has(idx)) return;
      const kind = pulseState.majorColumns?.includes(idx)
        ? 'major'
        : pulseState.minorColumns?.includes(idx)
          ? 'minor'
          : pulseState.columns?.includes(idx)
            ? (pulseState.kind ?? 'major')
            : null;
      if (!kind) return;
      const px = (loc.x + 0.5) * cellSize;
      const py = (loc.y + 0.5) * cellSize;
      const baseColor = columnColors[idx % columnColors.length];
      ctx.strokeStyle = pulseStroke(baseColor, kind, 0.85 * pulse);
      ctx.lineWidth = cellSize * 0.22;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
}

function updateUI() {
  if (!state) return;
  stepValue.textContent = `Step ${state.step ?? 0}`;
  const eventsCount = state.historyLength ?? state.history?.length ?? 0;
  if (eventsMeta) eventsMeta.textContent = `Events: ${eventsCount}`;
  const cols = state.numColumns ?? state.columns?.length ?? 1;
  columnsMeta.textContent = `Columns: ${cols}`;
  ensureVisibleColumns(cols);
  if (columnsRange && columnsValue) {
    columnsRange.value = String(cols);
    columnsValue.textContent = String(cols);
  }
  contradictionsValue.textContent = `Contradictions: ${state.contradictionsCount ?? 0}`;
  if (spacesMeta) {
    const facts = state.semanticFactsCount ?? 0;
    const frames = state.activeFramesCount ?? 0;
    const activeFacts = state.semanticActiveFactsCount ?? 0;
    spacesMeta.textContent = `Facts: ${facts.toLocaleString()} · Active: ${activeFacts.toLocaleString()} · Frames: ${frames}`;
  }
  storyField.value = state.storyText ?? '';
  drawGrid();
  updatePerf(state.lastQueryStats ?? null);
  semanticSummaryCache = state.semanticSummary ?? null;
  renderFrameLegend(semanticSummaryCache);
  frameSegmentsMap = state.frameSegments ?? {};
}

function setState(nextState) {
  state = nextState;
  activeFramesSet = new Set(state?.activeFrames ?? []);
  updateUI();
  if (state?.world) {
    const { entities, items, locations } = state.world;
    populateSelect(queryEntity, entities ?? []);
    populateSelect(queryTarget, entities ?? []);
    populateSelect(queryItem, items ?? []);
    populateSelect(queryLocation, locations ?? []);
  }
  if (contentMode) {
    contentMode.value = state?.contentMode ?? 'synthetic';
  }
  if (frameProfile && state?.profiles) {
    frameProfile.innerHTML = '';
    state.profiles.forEach((profile) => {
      const opt = document.createElement('option');
      opt.value = profile.id;
      opt.textContent = profile.label;
      frameProfile.appendChild(opt);
    });
    frameProfile.value = state?.profileId ?? frameProfile.value;
  }
  if (cnlField) {
    cnlField.value = state?.profileCnl ?? '';
  }
  setQueryOptions(state?.contentMode ?? 'synthetic');
}

async function refreshState() {
  const result = await fetchJson('/api/state');
  setState(result);
}

async function generateStory(mode) {
  try {
    setStatus('');
    const result = await fetchJson('/api/story/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        length: STORY_LENGTH,
        numColumns: Number(columnsRange?.value ?? state?.numColumns ?? 3),
        contentMode: contentMode?.value ?? state?.contentMode,
        profileId: frameProfile?.value ?? state?.profileId
      })
    });
    setState(result.state);
    const label = mode === 'contradicting'
      ? 'Story reset: Contradicting (1,000).'
      : 'Story reset: Clean (1,000).';
    setStatus(label, 'success');
  } catch (err) {
    setStatus(err.message);
  }
}

async function addMoreActions(mode) {
  try {
    setStatus('');
    const result = await fetchJson('/api/story/append', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        count: APPEND_COUNT,
        mode: mode ?? 'consistent',
        contentMode: state?.contentMode ?? contentMode?.value,
        profileId: frameProfile?.value ?? state?.profileId
      })
    });
    setState(result.state);
    setStatus('');
  } catch (err) {
    setStatus(err.message);
  }
}

async function runStoryAction() {
  if (!storyAction) return;
  const [kind, mode] = String(storyAction.value ?? '').split(':');
  if (kind === 'reset') {
    await generateStory(mode === 'contradicting' ? 'contradicting' : 'consistent');
    return;
  }
  if (kind === 'append') {
    await addMoreActions(mode === 'contradicting' ? 'contradicting' : 'consistent');
    return;
  }
  setStatus('Unknown action.', 'error');
}

function setTab(tab) {
  tabButtons.forEach((btn) => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('active', isActive);
  });
  tabPanels.forEach((panel) => {
    const isActive = panel.dataset.panel === tab;
    panel.classList.toggle('hidden', !isActive);
  });
}

function setSubTab(tab) {
  subtabButtons.forEach((btn) => {
    const isActive = btn.dataset.subtab === tab;
    btn.classList.toggle('active', isActive);
  });
  subtabPanels.forEach((panel) => {
    const isActive = panel.dataset.subpanel === tab;
    panel.classList.toggle('hidden', !isActive);
  });
  activeSubtab = tab;
  if (tab === 'frames' && framesNow) {
    framesNow.textContent = 'Idle · press Play to preview frames';
  }
}

function updateQueryFields() {
  const type = queryType.value;
  const def = queryDefMap.get(type) ?? { fields: {} };
  const fields = def.fields ?? {};

  const showEntity = Boolean(fields.entity);
  const showTarget = Boolean(fields.target);
  const showItem = Boolean(fields.item);
  const showLocation = Boolean(fields.location);
  const showStep = Boolean(fields.step);
  const showLimit = Boolean(fields.limit);

  queryEntityField.style.display = showEntity ? 'block' : 'none';
  queryTargetField.style.display = showTarget ? 'block' : 'none';
  queryItemField.style.display = showItem ? 'block' : 'none';
  queryLocationField.style.display = showLocation ? 'block' : 'none';
  queryStepField.style.display = showStep ? 'block' : 'none';
  queryLimitField.style.display = showLimit ? 'block' : 'none';
}

async function applyColumns() {
  try {
    setStatus('');
    if (applyColumnsBtn) applyColumnsBtn.disabled = true;
    const numColumns = Number(columnsRange?.value ?? state?.numColumns ?? 3);
    const result = await fetchJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numColumns,
        contentMode: state?.contentMode ?? contentMode?.value,
        profileId: frameProfile?.value ?? state?.profileId
      })
    });
    state = result.state;
    updateUI();
    setStatus(`Reconfigured to ${numColumns} columns.`, 'success');
  } catch (err) {
    setStatus(err.message);
  } finally {
    if (applyColumnsBtn) applyColumnsBtn.disabled = false;
  }
}

async function runQuery() {
  try {
    hideMismatch();
    const def = queryDefMap.get(queryType.value);
    const label = def?.label ?? queryType.value;
    const payload = {
      type: queryType.value,
      entity: queryEntity.value,
      target: queryTarget?.value,
      item: queryItem.value,
      location: queryLocation.value,
      windowSize: 6,
      noiseRate: 0.25
    };
    if (queryStepField.style.display !== 'none' && queryStep.value !== '') {
      payload.step = Number(queryStep.value);
    }
    if (queryLimitField.style.display !== 'none') {
      payload.limit = Number(queryLimit.value || 6);
    }
    const stepLabel = payload.step != null ? `step ${payload.step}` : 'latest step';
    addActivity(`Query: ${label} · ${stepLabel}`, 'info');
    const requiredFrames = SEMANTIC_QUERY_REQUIREMENTS[payload.type] ?? [];
    if (requiredFrames.length > 0) {
      const active = requiredFrames.filter((frame) => activeFramesSet.has(frame));
      if (active.length === 0) {
        addActivity(`Frames inactive: ${requiredFrames.join(', ')}`, 'warn');
      } else {
        addActivity(`Frames active: ${active.join(', ')}`, 'info');
      }
    }
    startQueryAnimation(true);
    const result = await fetchJson('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    queryAnswer.value = result.answerText ?? '';
    updatePerf(result.metrics ?? null);
    showMismatch(result.metrics ?? null);
    if (result.metrics) {
      const vsaSteps = result.metrics.vsaReplaySteps ?? '—';
      const naiveSteps = result.metrics.naiveReplaySteps ?? '—';
      addActivity(`Replay steps: VSA ${vsaSteps} · Naive ${naiveSteps}`, 'info');
      const vsaLabel = displayTime(result.metrics.vsaTimeMs).label;
      const naiveLabel = displayTime(result.metrics.naiveTimeMs).label;
      addActivity(`Time: VSA ${vsaLabel} · Naive ${naiveLabel}`, 'info');
      if (result.metrics.mismatch) {
        addActivity('Mismatch between VSA and naive answers.', 'warn');
      }
    } else {
      addActivity('Answer ready.', 'success');
    }
  } catch (err) {
    queryAnswer.value = err.message;
    addActivity(`Query failed: ${err.message}`, 'error');
    updatePerf(null);
    hideMismatch();
  }
}

async function applyProfile() {
  if (!frameProfile) return;
  try {
    setStatus('');
    const result = await fetchJson('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: frameProfile.value })
    });
    setState(result.state);
    setStatus(`Profile set to ${frameProfile.value}.`, 'success');
  } catch (err) {
    setStatus(err.message);
  }
}

function attachEvents() {
  if (storyActionRun) storyActionRun.addEventListener('click', runStoryAction);
  if (columnsAllBtn) columnsAllBtn.addEventListener('click', () => setAllColumns(true));
  if (columnsNoneBtn) columnsNoneBtn.addEventListener('click', () => setAllColumns(false));
  if (columnsRange && columnsValue) {
    columnsRange.addEventListener('input', () => {
      columnsValue.textContent = columnsRange.value;
    });
  }
  if (animSpeed && animSpeedValue) {
    animSpeed.addEventListener('input', () => {
      const t = Number(animSpeed.value) || 50;
      animationSpeed = Math.pow(10, (t - 50) / 16.7);
      animSpeedValue.textContent = `${animationSpeed.toFixed(3)}x`;
      if (animSpeedHint) {
        const sweepSeconds = 2.2 / Math.max(0.001, animationSpeed);
        animSpeedHint.textContent = `≈ ${formatDuration(sweepSeconds)} per sweep`;
      }
    });
    const initial = Number(animSpeed.value) || 50;
    animationSpeed = Math.pow(10, (initial - 50) / 16.7);
    animSpeedValue.textContent = `${animationSpeed.toFixed(3)}x`;
    if (animSpeedHint) {
      const sweepSeconds = 2.2 / Math.max(0.001, animationSpeed);
      animSpeedHint.textContent = `≈ ${formatDuration(sweepSeconds)} per sweep`;
    }
  }
  if (applyColumnsBtn) applyColumnsBtn.addEventListener('click', applyColumns);
  tabButtons.forEach((btn) => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
  queryType.addEventListener('change', updateQueryFields);
  if (contentMode) contentMode.addEventListener('change', () => setQueryOptions(contentMode.value));
  if (spacesGroup) spacesGroup.addEventListener('change', () => renderSpaces(semanticSummaryCache));
  if (spacesFilter) spacesFilter.addEventListener('input', () => renderSpaces(semanticSummaryCache));
  if (frameProfile) frameProfile.addEventListener('change', applyProfile);
  if (animPlayBtn) animPlayBtn.addEventListener('click', () => {
    if (activeSubtab === 'frames') startFramesAnimation(true);
    else startQueryAnimation(true);
  });
  if (animPauseBtn) animPauseBtn.addEventListener('click', stopAnimation);
  if (animNextBtn) animNextBtn.addEventListener('click', () => {
    const mode = activeSubtab === 'frames' ? 'frames' : 'query';
    stepAnimation(mode);
  });
  subtabButtons.forEach((btn) => btn.addEventListener('click', () => setSubTab(btn.dataset.subtab)));
  runQueryBtn.addEventListener('click', runQuery);
  if (mismatchCloseBtn) mismatchCloseBtn.addEventListener('click', hideMismatch);
}

async function boot() {
  await refreshState();
  updateQueryFields();
  setTab('grid');
  setSubTab('query');
  attachEvents();
}

boot();
