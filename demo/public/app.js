const $ = (selector) => document.querySelector(selector);

const canvas = $('#gridCanvas');
const storyField = $('#storyField');
const generateCleanBtn = $('#generateCleanBtn');
const generateContradictBtn = $('#generateContradictBtn');
const addHundredBtn = $('#addHundredBtn');
const appendMode = $('#appendMode');
const statusMsg = $('#statusMsg');
const stepValue = $('#stepValue');
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
  contradictionsValue.textContent = `Contradictions: ${state.contradictionsCount ?? 0}`;
  storyField.value = state.storyText ?? '';
  drawGrid();
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
      body: JSON.stringify({ mode: 'consistent' })
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
      body: JSON.stringify({ mode: 'contradicting' })
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

async function runQuery() {
  try {
    const payload = {
      type: queryType.value,
      entity: queryEntity.value,
      item: queryItem.value,
      location: queryLocation.value
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
  } catch (err) {
    queryAnswer.value = err.message;
  }
}

function attachEvents() {
  generateCleanBtn.addEventListener('click', generateWorld);
  generateContradictBtn.addEventListener('click', generateContradictingStory);
  addHundredBtn.addEventListener('click', addHundredActions);
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
