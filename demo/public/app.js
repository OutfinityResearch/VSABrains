const $ = (selector) => document.querySelector(selector);

const canvas = $('#gridCanvas');
const storyField = $('#storyField');
const generateCleanBtn = $('#generateCleanBtn');
const generateContradictBtn = $('#generateContradictBtn');
const addHundredBtn = $('#addHundredBtn');
const appendMode = $('#appendMode');
const columnsRange = $('#columnsRange');
const columnsValue = $('#columnsValue');
const applyColumnsBtn = $('#applyColumnsBtn');
const statusMsg = $('#statusMsg');
const stepValue = $('#stepValue');
const eventsMeta = $('#eventsMeta');
const columnsMeta = $('#columnsMeta');
const contradictionsValue = $('#contradictionsValue');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

const queryType = $('#queryType');
const queryEntity = $('#queryEntity');
const queryItem = $('#queryItem');
const queryLocation = $('#queryLocation');
const queryStep = $('#queryStep');
const queryLimit = $('#queryLimit');
const queryEntityField = $('#queryEntityField');
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

let state = null;
const sessionId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const STORY_LENGTH = 1_000;
const APPEND_COUNT = 10_000;
const columnColors = ['#7b8dff', '#52f2c2', '#ffb454', '#ff6bb5', '#73e2ff', '#c2ff6b'];
let busyCount = 0;
let busyDisabledElements = [];

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

function drawGrid() {
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
      const path = state.history.map((entry) => entry.locations?.[c]).filter(Boolean);
      if (path.length === 0) continue;
      ctx.strokeStyle = columnColors[c % columnColors.length] + 'aa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      path.forEach((loc, idx) => {
        const px = (loc.x + 0.5) * cellSize;
        const py = (loc.y + 0.5) * cellSize;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
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
  if (columnsRange && columnsValue) {
    columnsRange.value = String(cols);
    columnsValue.textContent = String(cols);
  }
  contradictionsValue.textContent = `Contradictions: ${state.contradictionsCount ?? 0}`;
  storyField.value = state.storyText ?? '';
  drawGrid();
  updatePerf(state.lastQueryStats ?? null);
}

function setState(nextState) {
  state = nextState;
  updateUI();
  if (state?.world) {
    const { entities, items, locations } = state.world;
    populateSelect(queryEntity, entities ?? []);
    populateSelect(queryItem, items ?? []);
    populateSelect(queryLocation, locations ?? []);
  }
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
        numColumns: Number(columnsRange?.value ?? state?.numColumns ?? 3)
      })
    });
    setState(result.state);
    if (appendMode) appendMode.value = mode;
    const label = mode === 'contradicting' ? 'Contradicting story generated.' : 'Clean story generated.';
    setStatus(label, 'success');
  } catch (err) {
    setStatus(err.message);
  }
}

async function addMoreActions() {
  try {
    setStatus('');
    const result = await fetchJson('/api/story/append', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: APPEND_COUNT, mode: appendMode?.value ?? 'consistent' })
    });
    setState(result.state);
    setStatus('');
  } catch (err) {
    setStatus(err.message);
  }
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

function updateQueryFields() {
  const type = queryType.value;
  const showEntity = ['where', 'whereAt', 'inventory', 'whoHas', 'isAlive', 'lastEvent', 'timeline', 'contradictionsFor'].includes(type);
  const showItem = ['whoHas', 'itemLocation'].includes(type);
  const showLocation = ['entitiesAt'].includes(type);
  const showStep = ['whereAt', 'entitiesAt', 'itemLocation'].includes(type);
  const showLimit = ['timeline'].includes(type);

  queryEntityField.style.display = showEntity ? 'block' : 'none';
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
      body: JSON.stringify({ numColumns })
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
    const payload = {
      type: queryType.value,
      entity: queryEntity.value,
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
    const result = await fetchJson('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    queryAnswer.value = result.answerText ?? '';
    updatePerf(result.metrics ?? null);
    showMismatch(result.metrics ?? null);
  } catch (err) {
    queryAnswer.value = err.message;
    updatePerf(null);
    hideMismatch();
  }
}

function attachEvents() {
  generateCleanBtn.addEventListener('click', () => generateStory('consistent'));
  generateContradictBtn.addEventListener('click', () => generateStory('contradicting'));
  addHundredBtn.addEventListener('click', addMoreActions);
  if (columnsRange && columnsValue) {
    columnsRange.addEventListener('input', () => {
      columnsValue.textContent = columnsRange.value;
    });
  }
  if (applyColumnsBtn) applyColumnsBtn.addEventListener('click', applyColumns);
  tabButtons.forEach((btn) => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
  queryType.addEventListener('change', updateQueryFields);
  runQueryBtn.addEventListener('click', runQuery);
  if (mismatchCloseBtn) mismatchCloseBtn.addEventListener('click', hideMismatch);
}

async function boot() {
  await refreshState();
  updateQueryFields();
  setTab('grid');
  attachEvents();
}

boot();
