const canvas = document.getElementById('tutorialCanvas');
const ctx = canvas.getContext('2d');
const playBtn = document.getElementById('tutorialPlay');
const pauseBtn = document.getElementById('tutorialPause');
const nextBtn = document.getElementById('tutorialNext');
const speedInput = document.getElementById('tutorialSpeed');
const speedValue = document.getElementById('tutorialSpeedValue');
const speedHint = document.getElementById('tutorialSpeedHint');
const stepsContainer = document.getElementById('tutorialSteps');

const sceneTitle = document.getElementById('sceneTitle');
const sceneSummary = document.getElementById('sceneSummary');
const sceneBullets = document.getElementById('sceneBullets');
const sceneKey = document.getElementById('sceneKey');
const sceneSignals = document.getElementById('sceneSignals');

const dpr = window.devicePixelRatio || 1;
const baseWidth = canvas.width;
const baseHeight = canvas.height;
canvas.width = Math.floor(baseWidth * dpr);
canvas.height = Math.floor(baseHeight * dpr);
ctx.scale(dpr, dpr);

const GRID = { cols: 12, rows: 8 };
const CELL = { w: baseWidth / GRID.cols, h: baseHeight / GRID.rows };
const COLORS = {
  a: '#7b8dff',
  b: '#52f2c2',
  c: '#ffd166',
  d: '#f78ff0',
  event: '#f97316',
  trail: 'rgba(123,141,255,0.25)',
  grid: 'rgba(255,255,255,0.08)',
  text: '#e6ecff',
  muted: 'rgba(230,236,255,0.6)'
};

const SCENES = [
  {
    id: 'reference',
    title: 'Reference frames',
    summary: 'Each column has its own local coordinate system. They observe the same sensory event, but from different positions.',
    bullets: [
      'Columns are independent “witnesses.”',
      'Same event → different coordinates.',
      'Diversity makes consensus possible.'
    ],
    key: 'Reference frames mean each column tracks the world from its own perspective.',
    signals: ['sensory input', 'column locations', 'local coordinates'],
    duration: 7
  },
  {
    id: 'learning',
    title: 'Learning & writing',
    summary: 'Columns move and write tokens into the grid. Each step creates a traceable path.',
    bullets: [
      'Write tokens at the current cell.',
      'Move by a deterministic displacement.',
      'The path becomes the memory.'
    ],
    key: 'Time is stored as space: “when” becomes “where.”',
    signals: ['write pulse', 'trajectory trail', 'cell activation'],
    duration: 7
  },
  {
    id: 'movement',
    title: 'Movement signals',
    summary: 'Movement is not random. It is computed from the recent token context, so similar events move similarly.',
    bullets: [
      'Displacement depends on recent tokens.',
      'Similar context → similar movement.',
      'This enables localization.'
    ],
    key: 'Movement encodes the context window without superposition.',
    signals: ['context buffer', 'direction cue', 'step window'],
    duration: 7
  },
  {
    id: 'consensus',
    title: 'Consensus voting',
    summary: 'Each column proposes a candidate location. The system aggregates votes into a single, robust answer.',
    bullets: [
      'Columns disagree under noise.',
      'Consensus selects the most supported location.',
      'Disagreement is measured, not hidden.'
    ],
    key: 'Consensus reduces noise without losing traceability.',
    signals: ['candidate points', 'vote ring', 'consensus marker'],
    duration: 7
  },
  {
    id: 'growth',
    title: 'New columns & specialization',
    summary: 'A new column can be formed when novelty is high. It specializes on a new aspect of the story.',
    bullets: [
      'New column appears when needed.',
      'Specialization reduces overload.',
      'Old columns keep their own maps.'
    ],
    key: 'The system can grow more “brains” when the story demands it.',
    signals: ['novelty pulse', 'new column', 'specialization'],
    duration: 7
  },
  {
    id: 'semantic',
    title: 'Frames (semantic lenses)',
    summary: 'Frames track higher-level meaning: emotion, theme, conflict, tone. They sit on top of events.',
    bullets: [
      'Frames are tags, not new columns.',
      'They are fast to query.',
      'They make summaries possible.'
    ],
    key: 'Frames are the semantic shortcut layer.',
    signals: ['emotion pulse', 'theme tag', 'conflict highlight'],
    duration: 7
  },
  {
    id: 'replay',
    title: 'Replay & recall',
    summary: 'When a question is asked, the system replays from a checkpoint to rebuild state and verify answers.',
    bullets: [
      'Checkpoint saves the past.',
      'Replay rebuilds the timeline.',
      'Answers cite evidence.'
    ],
    key: 'Replay makes answers auditable, not guessed.',
    signals: ['rewind trail', 'checkpoint', 'evidence chain'],
    duration: 7
  }
];

const TOTAL_DURATION = SCENES.reduce((acc, scene) => acc + scene.duration, 0);
const STEPS_PER_SCENE = 18;
const stepPaths = buildPaths(STEPS_PER_SCENE * SCENES.length);

let playing = true;
let lastTime = performance.now();
let timeline = 0;
let speed = sliderToSpeed(Number(speedInput.value));

function buildPaths(steps) {
  const paths = [
    { color: COLORS.a, points: [] },
    { color: COLORS.b, points: [] },
    { color: COLORS.c, points: [] },
    { color: COLORS.d, points: [] }
  ];

  for (let i = 0; i < steps; i += 1) {
    const t = i / steps;
    paths[0].points.push(wrapPoint(2 + Math.sin(t * 6.2) * 3, 2 + Math.cos(t * 5.4) * 2));
    paths[1].points.push(wrapPoint(5 + Math.sin(t * 4.8 + 1.1) * 3.2, 3 + Math.cos(t * 6.1 + 0.7) * 2.4));
    paths[2].points.push(wrapPoint(8 + Math.sin(t * 5.2 + 2.2) * 2.8, 5 + Math.cos(t * 4.3 + 1.7) * 2.2));
    paths[3].points.push(wrapPoint(3 + Math.sin(t * 6.6 + 0.4) * 3.1, 6 + Math.cos(t * 5.8 + 2.4) * 2.0));
  }
  return paths;
}

function wrapPoint(x, y) {
  const nx = (x % GRID.cols + GRID.cols) % GRID.cols;
  const ny = (y % GRID.rows + GRID.rows) % GRID.rows;
  return { x: nx, y: ny };
}

function sliderToSpeed(value) {
  const t = value / 100;
  return Math.pow(10, (t - 0.5) * 1.1);
}

function updateSpeedLabels() {
  speedValue.textContent = `${speed.toFixed(2)}x`;
  const perScene = (SCENES[0].duration / speed).toFixed(1);
  speedHint.textContent = `≈ ${perScene}s per scene`;
}

function buildStepsUI() {
  stepsContainer.innerHTML = '';
  SCENES.forEach((scene, idx) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tutorial-step';
    chip.textContent = `${idx + 1}. ${scene.title}`;
    chip.addEventListener('click', () => {
      timeline = sceneStart(idx);
      render();
    });
    stepsContainer.appendChild(chip);
  });
}

function sceneStart(index) {
  let t = 0;
  for (let i = 0; i < index; i += 1) t += SCENES[i].duration;
  return t;
}

function getSceneAtTime(t) {
  let acc = 0;
  for (let i = 0; i < SCENES.length; i += 1) {
    acc += SCENES[i].duration;
    if (t < acc) return { scene: SCENES[i], index: i, local: t - (acc - SCENES[i].duration) };
  }
  return { scene: SCENES[SCENES.length - 1], index: SCENES.length - 1, local: 0 };
}

function render() {
  ctx.clearRect(0, 0, baseWidth, baseHeight);
  drawGrid();

  const { scene, index, local } = getSceneAtTime(timeline);
  const stepIndex = Math.floor((local / scene.duration) * STEPS_PER_SCENE);
  const globalStep = index * STEPS_PER_SCENE + stepIndex;

  const activeColumns = index >= 4 ? 4 : 3;
  drawTrails(globalStep, scene, activeColumns);
  drawColumns(globalStep, scene, activeColumns);
  drawSceneOverlays(globalStep, scene, local / scene.duration);

  updateSidePanel(scene, index);
  updateStepChips(index);
}

function drawGrid() {
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let c = 0; c <= GRID.cols; c += 1) {
    const x = c * CELL.w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, baseHeight);
    ctx.stroke();
  }
  for (let r = 0; r <= GRID.rows; r += 1) {
    const y = r * CELL.h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(baseWidth, y);
    ctx.stroke();
  }
}

function drawTrails(step, scene, count) {
  const tail = scene.id === 'replay' ? 14 : 8;
  for (let i = 0; i < count; i += 1) {
    const path = stepPaths[i].points;
    const start = Math.max(0, step - tail);
    ctx.beginPath();
    for (let s = start; s <= step; s += 1) {
      const p = path[s % path.length];
      const px = p.x * CELL.w + CELL.w / 2;
      const py = p.y * CELL.h + CELL.h / 2;
      if (s === start) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = stepPaths[i].color + '55';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function drawColumns(step, scene, count) {
  for (let i = 0; i < count; i += 1) {
    const p = stepPaths[i].points[step % stepPaths[i].points.length];
    const px = p.x * CELL.w + CELL.w / 2;
    const py = p.y * CELL.h + CELL.h / 2;
    ctx.beginPath();
    ctx.fillStyle = stepPaths[i].color;
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  if (scene.id === 'growth') {
    const stepIndex = step % stepPaths[3].points.length;
    const p = stepPaths[3].points[stepIndex];
    const alpha = Math.min(1, stepIndex / STEPS_PER_SCENE);
    ctx.beginPath();
    ctx.fillStyle = `rgba(247,143,240,${alpha})`;
    ctx.arc(p.x * CELL.w + CELL.w / 2, p.y * CELL.h + CELL.h / 2, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSceneOverlays(step, scene, phase) {
  const center = { x: baseWidth * 0.5, y: baseHeight * 0.5 };
  const pulse = 0.5 + Math.sin(phase * Math.PI * 2) * 0.5;

  if (scene.id === 'reference') {
    drawPulse(center.x, center.y, COLORS.event, 16 + pulse * 6);
    drawLabel(center.x, center.y - 20, 'sensory event');
    drawReferenceAxes();
  }

  if (scene.id === 'learning') {
    const p = stepPaths[0].points[step % stepPaths[0].points.length];
    drawPulse(p.x * CELL.w + CELL.w / 2, p.y * CELL.h + CELL.h / 2, COLORS.event, 14 + pulse * 6);
    drawLabel(p.x * CELL.w + CELL.w / 2 + 16, p.y * CELL.h + CELL.h / 2 - 12, 'write');
  }

  if (scene.id === 'movement') {
    const a = stepPaths[1].points[step % stepPaths[1].points.length];
    const b = stepPaths[1].points[(step + 1) % stepPaths[1].points.length];
    ctx.strokeStyle = COLORS.event;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(a.x * CELL.w + CELL.w / 2, a.y * CELL.h + CELL.h / 2);
    ctx.lineTo(b.x * CELL.w + CELL.w / 2, b.y * CELL.h + CELL.h / 2);
    ctx.stroke();
    drawLabel(b.x * CELL.w + CELL.w / 2 + 12, b.y * CELL.h + CELL.h / 2 - 10, 'displacement');
  }

  if (scene.id === 'consensus') {
    const candidates = stepPaths.slice(0, 3).map((path) => path.points[step % path.points.length]);
    const avg = candidates.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    avg.x /= candidates.length;
    avg.y /= candidates.length;
    candidates.forEach((p) => {
      drawPulse(p.x * CELL.w + CELL.w / 2, p.y * CELL.h + CELL.h / 2, 'rgba(123,141,255,0.6)', 10);
    });
    drawPulse(avg.x * CELL.w + CELL.w / 2, avg.y * CELL.h + CELL.h / 2, '#ffffff', 18 + pulse * 6);
    drawLabel(avg.x * CELL.w + CELL.w / 2 + 14, avg.y * CELL.h + CELL.h / 2 - 10, 'consensus');
  }

  if (scene.id === 'growth') {
    drawPulse(center.x * 0.75, center.y * 0.4, COLORS.event, 20 + pulse * 8);
    drawLabel(center.x * 0.75 + 20, center.y * 0.4 - 10, 'novelty spike');
  }

  if (scene.id === 'semantic') {
    drawFrameBadges(center.x, center.y, phase);
  }

  if (scene.id === 'replay') {
    ctx.strokeStyle = 'rgba(82,242,194,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(baseWidth * 0.8, baseHeight * 0.2);
    ctx.lineTo(baseWidth * 0.2, baseHeight * 0.7);
    ctx.stroke();
    drawLabel(baseWidth * 0.2 + 14, baseHeight * 0.7 - 10, 'replay path');
  }
}

function drawPulse(x, y, color, radius) {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.shadowBlur = 18;
  ctx.shadowColor = color;
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawLabel(x, y, text) {
  ctx.fillStyle = COLORS.text;
  ctx.font = '12px "Space Grotesk", sans-serif';
  ctx.fillText(text, x, y);
}

function drawReferenceAxes() {
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(baseWidth * 0.15, baseHeight * 0.15);
  ctx.lineTo(baseWidth * 0.15, baseHeight * 0.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(baseWidth * 0.15, baseHeight * 0.15);
  ctx.lineTo(baseWidth * 0.45, baseHeight * 0.15);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawFrameBadges(x, y, phase) {
  const frames = [
    { label: 'emotion', color: '#fca5a5' },
    { label: 'theme', color: '#a7f3d0' },
    { label: 'conflict', color: '#fcd34d' }
  ];
  frames.forEach((frame, idx) => {
    const angle = phase * Math.PI * 2 + idx * 2.1;
    const rx = x + Math.cos(angle) * 120;
    const ry = y + Math.sin(angle) * 80;
    ctx.beginPath();
    ctx.fillStyle = frame.color;
    ctx.arc(rx, ry, 10, 0, Math.PI * 2);
    ctx.fill();
    drawLabel(rx + 12, ry + 4, frame.label);
  });
}

function updateSidePanel(scene, index) {
  sceneTitle.textContent = scene.title;
  sceneSummary.textContent = scene.summary;
  sceneBullets.innerHTML = '';
  scene.bullets.forEach((bullet) => {
    const li = document.createElement('li');
    li.textContent = bullet;
    sceneBullets.appendChild(li);
  });
  sceneKey.textContent = scene.key;
  sceneSignals.innerHTML = '';
  scene.signals.forEach((signal) => {
    const tag = document.createElement('span');
    tag.className = 'tutorial-signal';
    tag.textContent = signal;
    sceneSignals.appendChild(tag);
  });
}

function updateStepChips(activeIndex) {
  Array.from(stepsContainer.children).forEach((chip, idx) => {
    chip.classList.toggle('active', idx === activeIndex);
  });
}

function tick(now) {
  const delta = (now - lastTime) / 1000;
  lastTime = now;
  if (playing) {
    timeline += delta * speed;
    if (timeline > TOTAL_DURATION) timeline -= TOTAL_DURATION;
  }
  render();
  requestAnimationFrame(tick);
}

playBtn.addEventListener('click', () => {
  playing = true;
});

pauseBtn.addEventListener('click', () => {
  playing = false;
});

nextBtn.addEventListener('click', () => {
  const { index } = getSceneAtTime(timeline);
  timeline = sceneStart((index + 1) % SCENES.length);
  render();
});

speedInput.addEventListener('input', (event) => {
  speed = sliderToSpeed(Number(event.target.value));
  updateSpeedLabels();
});

buildStepsUI();
updateSpeedLabels();
render();
requestAnimationFrame(tick);
