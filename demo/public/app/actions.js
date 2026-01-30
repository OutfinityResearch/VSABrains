import { dom, config, runtime, queryDefs } from './store.js';
import {
  drawGrid,
  renderFrameLegend,
  updatePerf,
  startQueryAnimation,
  startFramesAnimation,
  stopAnimation,
  stepAnimation,
  ensureVisibleColumns,
  addActivity,
  updateAnimationSpeed,
  updateAnimationSpeedLabels,
  wireColumnControls
} from './render.js';
import { renderSpaces, wireSpacesFilters } from './spaces.js';

const {
  storyField,
  storyAction,
  storyActionRun,
  contentMode,
  columnsRange,
  columnsValue,
  applyColumnsBtn,
  animPlayBtn,
  animPauseBtn,
  animNextBtn,
  animSpeed,
  statusMsg,
  stepValue,
  eventsMeta,
  columnsMeta,
  contradictionsValue,
  tabButtons,
  tabPanels,
  queryType,
  queryEntity,
  queryTarget,
  queryItem,
  queryLocation,
  queryStep,
  queryLimit,
  queryEntityField,
  queryTargetField,
  queryItemField,
  queryLocationField,
  queryStepField,
  queryLimitField,
  runQueryBtn,
  queryAnswer,
  busyOverlay,
  busyMessage,
  mismatchOverlay,
  mismatchCloseBtn,
  mismatchType,
  mismatchStep,
  mismatchVsa,
  mismatchNaive,
  frameProfile,
  cnlField,
  subtabButtons,
  subtabPanels
} = dom;

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
  const defs = {
    synthetic: queryDefs.BASE_QUERY_DEFS,
    literature: queryDefs.LITERATURE_QUERY_DEFS,
    chat: queryDefs.CHAT_QUERY_DEFS
  }[mode] ?? queryDefs.BASE_QUERY_DEFS;

  runtime.queryDefMap = new Map(defs.map((def) => [def.value, def]));
  const previous = queryType.value;
  queryType.innerHTML = '';
  defs.forEach((def) => {
    const opt = document.createElement('option');
    opt.value = def.value;
    opt.textContent = def.label;
    queryType.appendChild(opt);
  });
  if (runtime.queryDefMap.has(previous)) {
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
    if (runtime.busyCount === 0) {
      runtime.busyDisabledElements = collectInteractiveElements().filter((el) => !el.disabled);
      runtime.busyDisabledElements.forEach((el) => { el.disabled = true; });
    }
    runtime.busyCount += 1;
    if (busyOverlay) busyOverlay.classList.add('active');
    if (busyMessage) busyMessage.textContent = message;
    document.body.classList.add('is-busy');
    return;
  }

  runtime.busyCount = Math.max(0, runtime.busyCount - 1);
  if (runtime.busyCount > 0) return;
  runtime.busyDisabledElements.forEach((el) => { el.disabled = false; });
  runtime.busyDisabledElements = [];
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
  const headers = { ...(fetchOptions.headers ?? {}), 'x-session-id': config.sessionId };
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

function updateQueryFields() {
  const def = runtime.queryDefMap.get(queryType.value) ?? null;
  const fields = def?.fields ?? {};
  queryEntityField.style.display = fields.entity ? '' : 'none';
  queryTargetField.style.display = fields.target ? '' : 'none';
  queryItemField.style.display = fields.item ? '' : 'none';
  queryLocationField.style.display = fields.location ? '' : 'none';
  queryStepField.style.display = fields.step ? '' : 'none';
  queryLimitField.style.display = fields.limit ? '' : 'none';
}

function updateUI() {
  if (!runtime.state) return;
  stepValue.textContent = `Step ${runtime.state.step ?? 0}`;
  eventsMeta.textContent = `Events: ${runtime.state.historyLength ?? 0}`;
  columnsMeta.textContent = `Columns: ${runtime.state.numColumns ?? 0}`;
  contradictionsValue.textContent = `Contradictions: ${runtime.state.contradictionsCount ?? 0}`;
  if (storyField) storyField.value = runtime.state.storyText ?? '';

  const world = runtime.state.world ?? {};
  populateSelect(queryEntity, world.entities ?? []);
  populateSelect(queryTarget, world.entities ?? []);
  populateSelect(queryItem, world.items ?? []);
  populateSelect(queryLocation, world.locations ?? []);

  const profileOptions = runtime.state.profiles ?? [];
  if (frameProfile) {
    frameProfile.innerHTML = '';
    profileOptions.forEach((profile) => {
      const opt = document.createElement('option');
      opt.value = profile.id;
      opt.textContent = profile.label;
      frameProfile.appendChild(opt);
    });
    frameProfile.value = runtime.state.profileId ?? profileOptions[0]?.id ?? 'balanced';
  }

  if (cnlField) cnlField.value = runtime.state.profileCnl ?? '';
  runtime.activeFramesSet = new Set(runtime.state.activeFrames ?? []);
  renderFrameLegend(runtime.state.semanticSummary);
  renderSpaces(runtime.state.semanticSummary);
  runtime.frameSegmentsMap = runtime.state.frameSegments ?? {};

  ensureVisibleColumns(runtime.state.numColumns ?? 1);
  drawGrid();
}

function setState(nextState) {
  runtime.state = nextState;
  updateUI();
}

async function refreshState() {
  const data = await fetchJson('/api/state');
  setState(data);
}

async function generateStory(mode) {
  const payload = {
    mode,
    length: config.STORY_LENGTH,
    numColumns: Number(columnsRange.value),
    contentMode: contentMode.value
  };
  const data = await fetchJson('/api/story/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  setState(data.state ?? data);
  addActivity(`Generated ${config.STORY_LENGTH.toLocaleString()} events (${mode}).`, 'good');
}

async function addMoreActions(mode) {
  const payload = {
    mode,
    count: config.APPEND_COUNT,
    contentMode: contentMode.value
  };
  const data = await fetchJson('/api/story/append', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  setState(data.state ?? data);
  addActivity(`Appended ${config.APPEND_COUNT.toLocaleString()} events (${mode}).`, 'good');
}

async function runStoryAction() {
  const [action, mode] = storyAction.value.split(':');
  if (action === 'reset') {
    await generateStory(mode);
  } else if (action === 'append') {
    await addMoreActions(mode);
  }
}

function setTab(tab) {
  tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  tabPanels.forEach((panel) => panel.classList.toggle('hidden', panel.dataset.panel !== tab));
  if (tab === 'grid') drawGrid();
}

function setSubTab(tab) {
  runtime.activeSubtab = tab;
  subtabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.subtab === tab));
  subtabPanels.forEach((panel) => panel.classList.toggle('hidden', panel.dataset.subpanel !== tab));
  if (tab === 'frames') {
    renderFrameLegend(runtime.state?.semanticSummary ?? null);
  }
}

async function applyColumns() {
  const payload = {
    numColumns: Number(columnsRange.value),
    contentMode: contentMode.value,
    profileId: frameProfile?.value
  };
  const data = await fetchJson('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  setState(data.state ?? data);
  addActivity(`Rebuilt brain with ${payload.numColumns} columns.`, 'good');
}

async function runQuery() {
  const payload = {
    type: queryType.value,
    entity: queryEntity.value,
    target: queryTarget.value,
    item: queryItem.value,
    location: queryLocation.value,
    step: queryStep.value,
    limit: queryLimit.value
  };
  const data = await fetchJson('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const answer = data.answerText ?? '';
  queryAnswer.value = answer;
  updatePerf(data.metrics);
  showMismatch(data.metrics);

  // Populate Thousand Brains theory visualization state
  runtime.localizationCandidates = data.localizationCandidates ?? [];
  runtime.votingState = data.votingState ?? { votes: [], winnerIdx: -1 };

  // If no localization data from server, generate sample data for visualization demo
  if (runtime.localizationCandidates.length === 0 && runtime.state?.columns?.length) {
    // Generate sample candidates based on current column positions
    runtime.localizationCandidates = runtime.state.columns.slice(0, 3).map((loc, idx) => ({
      location: { x: (loc.x + idx * 2) % 64, y: (loc.y + idx) % 64 },
      score: 0.95 - idx * 0.15,
      columnId: `column${idx}`
    }));
  }

  // If no voting data, generate sample votes
  if (runtime.votingState.votes.length === 0 && runtime.state?.columns?.length) {
    runtime.votingState = {
      votes: runtime.state.columns.map((_, idx) => Math.floor(Math.random() * 3) + 1),
      winnerIdx: 0
    };
  }

  if (runtime.activeSubtab === 'frames') {
    startFramesAnimation(true);
  } else {
    startQueryAnimation(true);
  }
  addActivity(`Query: ${payload.type}`, 'info');
}

async function applyProfile() {
  const payload = { profileId: frameProfile.value };
  const data = await fetchJson('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  setState(data.state ?? data);
  addActivity(`Profile: ${frameProfile.value}`, 'good');
}

function attachEvents() {
  storyActionRun?.addEventListener('click', runStoryAction);
  contentMode?.addEventListener('change', () => setQueryOptions(contentMode.value));
  columnsRange?.addEventListener('input', () => {
    columnsValue.textContent = columnsRange.value;
  });
  applyColumnsBtn?.addEventListener('click', applyColumns);
  queryType?.addEventListener('change', updateQueryFields);
  runQueryBtn?.addEventListener('click', runQuery);
  frameProfile?.addEventListener('change', applyProfile);
  mismatchCloseBtn?.addEventListener('click', hideMismatch);

  animPlayBtn?.addEventListener('click', () => {
    if (runtime.activeSubtab === 'frames') startFramesAnimation(true);
    else startQueryAnimation(true);
  });
  animPauseBtn?.addEventListener('click', stopAnimation);
  animNextBtn?.addEventListener('click', () => {
    if (runtime.activeSubtab === 'frames') stepAnimation('frames');
    else stepAnimation('query');
  });
  animSpeed?.addEventListener('input', (event) => {
    updateAnimationSpeed(Number(event.target.value));
  });

  tabButtons.forEach((btn) => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
  subtabButtons.forEach((btn) => btn.addEventListener('click', () => setSubTab(btn.dataset.subtab)));

  // Theory visualization toggle
  const { theoryVizToggle } = dom;
  theoryVizToggle?.addEventListener('change', () => {
    runtime.showTheoryViz = theoryVizToggle.checked;
    drawGrid();
  });

  wireSpacesFilters();
  wireColumnControls();
}

export async function boot() {
  if (columnsValue && columnsRange) columnsValue.textContent = columnsRange.value;
  if (animSpeed) updateAnimationSpeed(Number(animSpeed.value));
  updateAnimationSpeedLabels();
  setQueryOptions(contentMode.value);
  attachEvents();
  await refreshState();
}
