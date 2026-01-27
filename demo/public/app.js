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
const perfRunsInput = $('#perfRuns');
const runQueryBtn = $('#runQueryBtn');
const queryAnswer = $('#queryAnswer');
const perfBarVsa = $('#perfBarVsa');
const perfBarNaive = $('#perfBarNaive');
const perfBarVsaValue = $('#perfBarVsaValue');
const perfBarNaiveValue = $('#perfBarNaiveValue');

let state = null;
const sessionId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const STORY_LENGTH = 1_000;
const APPEND_COUNT = 10_000;
const DEFAULT_PERF_RUNS = 500;
const columnColors = ['#7b8dff', '#52f2c2', '#ffb454', '#ff6bb5', '#73e2ff', '#c2ff6b'];

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

async function fetchJson(url, options) {
  const headers = { ...(options?.headers ?? {}), 'x-session-id': sessionId };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function setStatus(message, tone = 'error') {
  if (!message) {
    statusMsg.textContent = '';
    return;
  }
  statusMsg.textContent = message;
  statusMsg.style.color = tone === 'error' ? '#f7b4b4' : '#a2f5d6';
}

function displaySeconds(ms) {
  if (!Number.isFinite(ms)) return { label: '—', seconds: NaN };
  const seconds = ms / 1000;
  if (seconds < 1) return { label: '<1s', seconds: 1 };
  const rounded = Math.max(1, Math.round(seconds));
  return { label: `${rounded}s`, seconds: rounded };
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
  const vsaDisplay = displaySeconds(vsaTime);
  const naiveDisplay = displaySeconds(naiveTime);
  const safeVsa = Number.isFinite(vsaDisplay.seconds) ? vsaDisplay.seconds : 0;
  const safeNaive = Number.isFinite(naiveDisplay.seconds) ? naiveDisplay.seconds : 0;
  const maxTime = Math.max(safeVsa, safeNaive, 1);
  const denom = Math.log10(maxTime + 1);
  const scaleWidth = (cost) => {
    if (!Number.isFinite(cost) || denom <= 0) return 0;
    const pct = (Math.log10(cost + 1) / denom) * 100;
    return Math.max(6, Math.min(100, pct));
  };

  const runs = Number.isFinite(metrics.perfRuns)
    ? metrics.perfRuns
    : Math.max(1, Math.floor(Number(perfRunsInput?.value ?? DEFAULT_PERF_RUNS)));
  const runsLabel = `${runs} runs`;
  const vsaLabel = Number.isFinite(vsaDisplay.seconds)
    ? `${vsaDisplay.label} · ${runsLabel}`
    : '—';
  const naiveLabel = Number.isFinite(naiveDisplay.seconds)
    ? `${naiveDisplay.label} · ${runsLabel}`
    : '—';

  setBar(perfBarVsa, perfBarVsaValue, `${scaleWidth(vsaDisplay.seconds)}%`, vsaLabel);
  setBar(perfBarNaive, perfBarNaiveValue, `${scaleWidth(naiveDisplay.seconds)}%`, naiveLabel);
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
    const payload = {
      type: queryType.value,
      entity: queryEntity.value,
      item: queryItem.value,
      location: queryLocation.value,
      windowSize: 6,
      noiseRate: 0.25,
      perfRuns: Math.max(1, Math.floor(Number(perfRunsInput?.value ?? DEFAULT_PERF_RUNS)))
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
  } catch (err) {
    queryAnswer.value = err.message;
    updatePerf(null);
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
}

async function boot() {
  await refreshState();
  updateQueryFields();
  setTab('grid');
  attachEvents();
}

boot();
