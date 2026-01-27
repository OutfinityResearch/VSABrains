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
const perfVsaTime = $('#perfVsaTime');
const perfVsaWork = $('#perfVsaWork');
const perfNaiveTime = $('#perfNaiveTime');
const perfNaiveWork = $('#perfNaiveWork');
const perfWorkRatio = $('#perfWorkRatio');
const perfCorrectness = $('#perfCorrectness');
const perfWinner = $('#perfWinner');
const perfSpeedup = $('#perfSpeedup');
const perfBarVsa = $('#perfBarVsa');
const perfBarNaive = $('#perfBarNaive');

let state = null;
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
  const res = await fetch(url, options);
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

function formatMs(value) {
  if (!Number.isFinite(value)) return '—';
  if (value < 1) return `${value.toFixed(2)} ms`;
  return `${value.toFixed(1)} ms`;
}

function formatCompact(value) {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return value.toLocaleString('en-US');
  return value.toFixed(2);
}

function updatePerf(metrics) {
  if (!metrics) {
    perfVsaTime.textContent = '—';
    perfVsaWork.textContent = '—';
    perfNaiveTime.textContent = '—';
    perfNaiveWork.textContent = '—';
    perfWorkRatio.textContent = '—';
    perfCorrectness.textContent = 'Run a query';
    if (perfWinner) perfWinner.textContent = '—';
    if (perfWinner) perfWinner.style.color = '';
    if (perfSpeedup) perfSpeedup.textContent = '—';
    if (perfBarVsa) perfBarVsa.style.width = '0%';
    if (perfBarNaive) perfBarNaive.style.width = '0%';
    return;
  }

  perfVsaTime.textContent = formatMs(metrics.vsaTimeMs);
  perfNaiveTime.textContent = formatMs(metrics.naiveTimeMs);

  const vsaWork = Number.isFinite(metrics.vsaScoredLocations)
    ? `${formatCompact(metrics.vsaScoredLocations)} scored`
    : '—';
  const perToken = Number.isFinite(metrics.vsaPerTokenCandidates)
    ? `${formatCompact(metrics.vsaPerTokenCandidates)} / token`
    : '';
  perfVsaWork.textContent = [vsaWork, perToken].filter(Boolean).join('\n');

  perfNaiveWork.textContent = Number.isFinite(metrics.naiveComparisons)
    ? `${metrics.naiveComparisons.toLocaleString('en-US')} comparisons`
    : '—';

  if (metrics.note) {
    perfWorkRatio.textContent = metrics.note;
    perfCorrectness.textContent = `Need ≥ ${metrics.windowSize ?? 6} steps`;
    if (perfWinner) perfWinner.textContent = 'Not enough data';
    if (perfWinner) perfWinner.style.color = '';
    if (perfSpeedup) perfSpeedup.textContent = 'Add more steps';
    if (perfBarVsa) perfBarVsa.style.width = '0%';
    if (perfBarNaive) perfBarNaive.style.width = '0%';
    return;
  }

  perfWorkRatio.textContent = Number.isFinite(metrics.workRatio)
    ? `~${formatCompact(metrics.workRatio)}×`
    : '—';

  const vsaCheck = metrics.vsaCorrect ? 'VSA ✓' : 'VSA ✗';
  const naiveCheck = metrics.naiveCorrect ? 'Naive ✓' : 'Naive ✗';
  perfCorrectness.textContent = `${vsaCheck}  •  ${naiveCheck}`;

  const vsaCost = Number.isFinite(metrics.vsaScoredLocations) ? metrics.vsaScoredLocations : NaN;
  const naiveCost = Number.isFinite(metrics.naiveComparisons) ? metrics.naiveComparisons : NaN;

  if (perfWinner && perfSpeedup) {
    if (Number.isFinite(vsaCost) && Number.isFinite(naiveCost) && vsaCost > 0 && naiveCost > 0) {
      const ratio = naiveCost / vsaCost;
      const vsaFaster = ratio >= 1;
      perfWinner.textContent = vsaFaster ? 'VSABrains faster' : 'Naive faster';
      const shownRatio = vsaFaster ? ratio : 1 / ratio;
      perfSpeedup.textContent = `~${formatCompact(shownRatio)}×`;
      perfWinner.style.color = vsaFaster ? '#a2f5d6' : '#f7b4b4';
    } else {
      perfWinner.textContent = 'Speed proxy unavailable';
      perfSpeedup.textContent = '—';
      perfWinner.style.color = '';
    }
  }

  if (perfBarVsa && perfBarNaive) {
    const safeVsa = Number.isFinite(vsaCost) ? vsaCost : 0;
    const safeNaive = Number.isFinite(naiveCost) ? naiveCost : 0;
    const maxCost = Math.max(safeVsa, safeNaive, 1);
    const denom = Math.log10(maxCost + 1);
    const scaleWidth = (cost) => {
      if (!Number.isFinite(cost) || denom <= 0) return 0;
      const pct = (Math.log10(cost + 1) / denom) * 100;
      return Math.max(6, Math.min(100, pct));
    };
    perfBarVsa.style.width = `${scaleWidth(vsaCost)}%`;
    perfBarNaive.style.width = `${scaleWidth(naiveCost)}%`;
  }
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

async function refreshState() {
  const result = await fetchJson('/api/state');
  state = result;
  updateUI();
  if (state?.world) {
    const { entities, items, locations } = state.world;
    populateSelect(queryEntity, entities ?? []);
    populateSelect(queryItem, items ?? []);
    populateSelect(queryLocation, locations ?? []);
  }
}

async function generateWorld() {
  try {
    setStatus('');
    const result = await fetchJson('/api/story/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'consistent',
        numColumns: Number(columnsRange?.value ?? state?.numColumns ?? 3)
      })
    });
    state = result.state;
    updateUI();
    if (appendMode) appendMode.value = 'consistent';
    setStatus('Clean story generated.', 'success');
  } catch (err) {
    setStatus(err.message);
  }
}

async function addHundredActions() {
  try {
    setStatus('');
    const result = await fetchJson('/api/story/append', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 100, mode: appendMode?.value ?? 'consistent' })
    });
    state = result.state;
    updateUI();
    setStatus('Added 100 actions.', 'success');
  } catch (err) {
    setStatus(err.message);
  }
}

async function generateContradictingStory() {
  try {
    setStatus('');
    const result = await fetchJson('/api/story/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'contradicting',
        numColumns: Number(columnsRange?.value ?? state?.numColumns ?? 3)
      })
    });
    state = result.state;
    updateUI();
    if (appendMode) appendMode.value = 'contradicting';
    setStatus('Contradicting story generated.', 'success');
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
  } catch (err) {
    queryAnswer.value = err.message;
    updatePerf(null);
  }
}

function attachEvents() {
  generateCleanBtn.addEventListener('click', generateWorld);
  generateContradictBtn.addEventListener('click', generateContradictingStory);
  addHundredBtn.addEventListener('click', addHundredActions);
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
