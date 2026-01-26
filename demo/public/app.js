const $ = (selector) => document.querySelector(selector);

const subjectSelect = $('#subjectSelect');
const actionSelect = $('#actionSelect');
const objectSelect = $('#objectSelect');
const objectField = $('#objectField');
const objectLabel = $('#objectLabel');
const addEventBtn = $('#addEventBtn');
const resetBtn = $('#resetBtn');
const randomBtn = $('#randomBtn');
const statusMsg = $('#statusMsg');

const stepValue = $('#stepValue');
const agreementValue = $('#agreementValue');
const utilValue = $('#utilValue');
const satValue = $('#satValue');
const localizeValue = $('#localizeValue');

const canvas = $('#gridCanvas');
const scrubRange = $('#scrubRange');
const scrubStart = $('#scrubStart');
const scrubEnd = $('#scrubEnd');
const timelineList = $('#timelineList');

const queryType = $('#queryType');
const queryEntity = $('#queryEntity');
const queryItem = $('#queryItem');
const queryEntityField = $('#queryEntityField');
const queryItemField = $('#queryItemField');
const queryBtn = $('#queryBtn');
const answerText = $('#answerText');
const answerVerdict = $('#answerVerdict');
const evidenceList = $('#evidenceList');

let config = null;
let history = [];
let state = null;
let focusIndex = 0;

const columnColors = ['#7b8dff', '#52f2c2', '#ffb454'];

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function populateSelect(select, values, options = {}) {
  select.innerHTML = '';
  if (options.placeholder) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = options.placeholder;
    select.appendChild(opt);
  }
  values.forEach((value) => {
    const opt = document.createElement('option');
    opt.value = value.id ?? value;
    opt.textContent = value.label ?? value;
    select.appendChild(opt);
  });
}

function updateObjectField() {
  const action = config.actions.find((a) => a.id === actionSelect.value);
  if (!action || action.objectType === 'none') {
    objectField.style.display = 'none';
    return;
  }
  objectField.style.display = 'block';
  if (action.objectType === 'location') {
    objectLabel.textContent = 'Location';
    populateSelect(objectSelect, config.locations);
  } else {
    objectLabel.textContent = 'Item';
    populateSelect(objectSelect, config.items);
  }
}

function updateQueryFields() {
  if (queryType.value === 'whoHas') {
    queryItemField.style.display = 'block';
    queryEntityField.style.display = 'none';
  } else {
    queryItemField.style.display = 'none';
    queryEntityField.style.display = 'block';
  }
}

function renderTimeline() {
  timelineList.innerHTML = '';
  history.forEach((entry, index) => {
    const li = document.createElement('li');
    const loc = entry.locations?.[0];
    li.textContent = `#${entry.step} · ${entry.text} · (${loc?.x ?? '—'}, ${loc?.y ?? '—'})`;
    if (index === focusIndex) li.classList.add('active');
    timelineList.appendChild(li);
  });
}

function updateScrubber() {
  if (history.length === 0) {
    scrubRange.disabled = true;
    scrubRange.min = 0;
    scrubRange.max = 0;
    scrubRange.value = 0;
    scrubStart.textContent = '0';
    scrubEnd.textContent = '0';
    focusIndex = 0;
    return;
  }
  scrubRange.disabled = false;
  scrubRange.min = 0;
  scrubRange.max = history.length - 1;
  focusIndex = Math.min(focusIndex, history.length - 1);
  scrubRange.value = focusIndex;
  scrubStart.textContent = '0';
  scrubEnd.textContent = String(history[history.length - 1].step);
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

  if (history.length > 0) {
    const path = history.slice(0, focusIndex + 1).map((entry) => entry.locations?.[0]);
    ctx.strokeStyle = 'rgba(123,141,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    path.forEach((loc, idx) => {
      if (!loc) return;
      const px = (loc.x + 0.5) * cellSize;
      const py = (loc.y + 0.5) * cellSize;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  const focusEntry = history[focusIndex];
  const locations = focusEntry?.locations ?? state.columns?.map((c) => c.location) ?? [];
  const offsets = [
    { x: -0.2, y: -0.15 },
    { x: 0.2, y: -0.1 },
    { x: -0.1, y: 0.2 }
  ];

  locations.forEach((loc, idx) => {
    if (!loc) return;
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

  const best = state.localize?.candidates?.[0];
  if (best?.location) {
    const px = (best.location.x + 0.5) * cellSize;
    const py = (best.location.y + 0.5) * cellSize;
    ctx.strokeStyle = '#52f2c2';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(px - cellSize * 0.5, py - cellSize * 0.5, cellSize, cellSize);
    ctx.setLineDash([]);
  }
}

function updateTelemetry() {
  if (!state?.diagnostics) return;
  stepValue.textContent = state.step ?? 0;
  agreementValue.textContent = (state.diagnostics.columnAgreement ?? 0).toFixed(2);
  utilValue.textContent = (state.diagnostics.gridUtilization ?? 0).toFixed(2);
  satValue.textContent = (state.diagnostics.cellSaturation ?? 0).toFixed(2);

  if (state.localize?.candidates?.length > 0) {
    const best = state.localize.candidates[0];
    localizeValue.textContent = `(${best.location.x}, ${best.location.y}) · ${best.score.toFixed(2)}`;
  } else {
    localizeValue.textContent = '—';
  }
}

function renderEvidence(evidence = []) {
  evidenceList.innerHTML = '';
  if (!evidence || evidence.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No evidence trail for this query yet.';
    evidenceList.appendChild(li);
    return;
  }
  evidence.forEach((entry) => {
    const li = document.createElement('li');
    li.textContent = `#${entry.step} · ${entry.text}`;
    evidenceList.appendChild(li);
  });
}

function setStatus(message, tone = 'error') {
  if (!message) {
    statusMsg.textContent = '';
    return;
  }
  statusMsg.textContent = message;
  statusMsg.style.color = tone === 'error' ? '#f7b4b4' : '#a2f5d6';
}

async function refreshAll() {
  const [historyRes, stateRes] = await Promise.all([
    fetchJson('/api/history'),
    fetchJson('/api/state')
  ]);
  history = historyRes.events ?? [];
  state = stateRes;
  focusIndex = history.length > 0 ? history.length - 1 : 0;
  updateScrubber();
  renderTimeline();
  drawGrid();
  updateTelemetry();
}

async function addEvent() {
  try {
    setStatus('');
    const payload = {
      subject: subjectSelect.value,
      action: actionSelect.value,
      object: objectField.style.display === 'none' ? null : objectSelect.value
    };
    const result = await fetchJson('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    history.push(result.entry);
    state = result.state;
    focusIndex = history.length - 1;
    updateScrubber();
    renderTimeline();
    drawGrid();
    updateTelemetry();
  } catch (err) {
    setStatus(err.message);
  }
}

async function runQuery() {
  try {
    const payload = {
      type: queryType.value,
      entity: queryEntity.value,
      item: queryItem.value
    };
    const result = await fetchJson('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const answer = result.answer;
    answerText.textContent = answer.text ?? '—';
    answerVerdict.textContent = answer.verdict ?? 'unknown';
    renderEvidence(answer.evidence);
  } catch (err) {
    answerText.textContent = '—';
    answerVerdict.textContent = err.message;
    renderEvidence([]);
  }
}

function randomChoice(list) {
  return list[Math.floor(Math.random() * list.length)];
}

async function addRandomEvent() {
  const action = randomChoice(config.actions);
  const subject = randomChoice(config.entities);
  let object = null;
  if (action.objectType === 'location') object = randomChoice(config.locations);
  if (action.objectType === 'item') object = randomChoice(config.items);
  subjectSelect.value = subject;
  actionSelect.value = action.id;
  updateObjectField();
  if (object) objectSelect.value = object;
  await addEvent();
}

async function resetScene() {
  await fetchJson('/api/reset', { method: 'POST' });
  await refreshAll();
  answerText.textContent = '—';
  answerVerdict.textContent = '—';
  renderEvidence([]);
  setStatus('Scene reset.', 'success');
}

function attachEvents() {
  actionSelect.addEventListener('change', updateObjectField);
  addEventBtn.addEventListener('click', addEvent);
  resetBtn.addEventListener('click', resetScene);
  randomBtn.addEventListener('click', addRandomEvent);
  queryType.addEventListener('change', updateQueryFields);
  queryBtn.addEventListener('click', runQuery);
  scrubRange.addEventListener('input', (event) => {
    focusIndex = Number(event.target.value);
    renderTimeline();
    drawGrid();
  });
}

async function boot() {
  config = await fetchJson('/api/config');
  const subjectOptions = config.entities.map((id) => ({ id, label: id }));
  subjectOptions.push({ id: 'P', label: 'P (previous)' });
  populateSelect(subjectSelect, subjectOptions);
  populateSelect(actionSelect, config.actions);
  populateSelect(queryEntity, config.entities);
  populateSelect(queryItem, config.items);
  updateObjectField();
  updateQueryFields();
  await refreshAll();
  attachEvents();
}

boot();
