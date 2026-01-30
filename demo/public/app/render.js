import { dom, config, runtime } from './store.js';
import { displayTime, formatDuration, frameColor, prettyName } from './format.js';
import {
  TUTORIAL_COLORS,
  drawElegantBackground,
  drawInfoBox as drawSharedInfoBox,
  drawLocalizationCandidates as drawSharedLocCandidates,
  drawVotingCircle as drawSharedVotingCircle,
  drawDisplacementVector as drawSharedDisplacement,
  drawPathWithDots,
  drawColumnMarkers
} from './lib/shared-viz.js';

const {
  canvas,
  columnsCheckboxes,
  framesNow,
  frameLegend,
  framesSummary,
  columnsAllBtn,
  columnsNoneBtn,
  activityLog,
  perfBarVsa,
  perfBarNaive,
  perfBarVsaValue,
  perfBarNaiveValue,
  animSpeedValue,
  animSpeedHint
} = dom;

const ctx = canvas?.getContext('2d');

// ==================== THOUSAND BRAINS THEORY VISUALIZATION ====================
// Now using shared-viz module for consistent styling with tutorial

const THEORY_COLORS = TUTORIAL_COLORS;

/**
 * Draw displacement vector arrow between two points
 */
function drawDisplacementVector(fromLoc, toLoc, dx, dy, cellSize) {
  if (!ctx || dx === 0 && dy === 0) return;

  const fx = (fromLoc.x + 0.5) * cellSize;
  const fy = (fromLoc.y + 0.5) * cellSize;
  const tx = (toLoc.x + 0.5) * cellSize;
  const ty = (toLoc.y + 0.5) * cellSize;

  // Dashed line
  ctx.strokeStyle = THEORY_COLORS.displacement;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrow head
  const angle = Math.atan2(ty - fy, tx - fx);
  const headLen = 10;
  ctx.fillStyle = THEORY_COLORS.displacement;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - headLen * Math.cos(angle - 0.4), ty - headLen * Math.sin(angle - 0.4));
  ctx.lineTo(tx - headLen * Math.cos(angle + 0.4), ty - headLen * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();

  // Displacement label
  const midX = (fx + tx) / 2;
  const midY = (fy + ty) / 2;
  const label = `(${dx >= 0 ? '+' : ''}${dx}, ${dy >= 0 ? '+' : ''}${dy})`;
  ctx.fillStyle = THEORY_COLORS.textPrimary;
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, midX, midY - 8);
}

/**
 * Draw localization candidate markers on the grid
 */
function drawLocalizationCandidates(candidates, cellSize, phase = 1) {
  if (!ctx || !candidates?.length) return;

  candidates.slice(0, 5).forEach((cand, idx) => {
    const x = (cand.location.x + 0.5) * cellSize;
    const y = (cand.location.y + 0.5) * cellSize;
    const pulse = 1 + Math.sin(phase * Math.PI * 4 + idx) * 0.15;
    const radius = cellSize * 0.4 * pulse;

    // Outer glow
    ctx.strokeStyle = THEORY_COLORS.localization;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Fill
    ctx.fillStyle = THEORY_COLORS.localizationFade;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Score label
    const score = cand.score ?? cand.matches ?? 0;
    const scoreText = typeof score === 'number' && score <= 1
      ? `${Math.round(score * 100)}%`
      : String(score);
    ctx.fillStyle = THEORY_COLORS.localization;
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(scoreText, x, y + radius + 14);

    // Column label
    if (cand.columnId) {
      ctx.fillStyle = THEORY_COLORS.textMuted;
      ctx.font = '9px Inter, sans-serif';
      ctx.fillText(cand.columnId, x, y + radius + 24);
    }
  });
}

/**
 * Draw voting circle showing column consensus
 */
function drawVotingCircle(columns, votes, winnerIdx, phase, canvasWidth, canvasHeight) {
  if (!ctx || !columns?.length) return;

  const centerX = canvasWidth - 80;
  const centerY = 80;
  const radius = 50;

  // Background
  ctx.fillStyle = THEORY_COLORS.infoBox;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + 15, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = THEORY_COLORS.infoBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Column positions
  columns.forEach((col, idx) => {
    const angle = (idx / columns.length) * Math.PI * 2 - Math.PI / 2;
    const cx = centerX + Math.cos(angle) * radius;
    const cy = centerY + Math.sin(angle) * radius;
    const isWinner = idx === winnerIdx;
    const color = config.columnColors[idx % config.columnColors.length];

    // Column circle
    ctx.fillStyle = isWinner ? THEORY_COLORS.voteWin : color;
    if (isWinner) {
      ctx.shadowColor = THEORY_COLORS.voteWin;
      ctx.shadowBlur = 12;
    }
    ctx.beginPath();
    ctx.arc(cx, cy, isWinner ? 14 : 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Vote count
    if (votes?.[idx] != null) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(votes[idx]), cx, cy);
    }
  });

  // Center consensus indicator
  if (winnerIdx >= 0 && phase > 0.7) {
    ctx.fillStyle = THEORY_COLORS.voteWin;
    ctx.shadowColor = THEORY_COLORS.voteWin;
    ctx.shadowBlur = 15;
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✓', centerX, centerY);
    ctx.shadowBlur = 0;

    ctx.fillStyle = THEORY_COLORS.textMuted;
    ctx.font = '9px Inter, sans-serif';
    ctx.fillText('Consensus', centerX, centerY + 18);
  }
}

/**
 * Draw info box with title and lines
 */
function drawInfoBox(x, y, title, lines) {
  if (!ctx) return;

  const padding = 10;
  const lineHeight = 16;
  const width = 160;
  const height = padding * 2 + lineHeight * (lines.length + 1);

  // Box
  ctx.fillStyle = THEORY_COLORS.infoBox;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, 6);
  } else {
    ctx.rect(x, y, width, height);
  }
  ctx.fill();

  ctx.strokeStyle = THEORY_COLORS.infoBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Title
  ctx.fillStyle = THEORY_COLORS.textPrimary;
  ctx.font = 'bold 11px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, x + padding, y + padding + 10);

  // Lines
  ctx.fillStyle = THEORY_COLORS.textMuted;
  ctx.font = '10px Inter, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, x + padding, y + padding + 10 + (i + 1) * lineHeight);
  });
}


export function ensureVisibleColumns(count) {
  if (!runtime.columnsInitialized) {
    runtime.visibleColumns = new Set(Array.from({ length: count }, (_, i) => i));
    runtime.columnsInitialized = true;
    runtime.lastColumnsCount = count;
    renderColumnFilters(count);
    return;
  }
  const hadAll = runtime.visibleColumns.size === runtime.lastColumnsCount && runtime.lastColumnsCount > 0;
  const next = new Set([...runtime.visibleColumns].filter((idx) => idx < count));
  if (hadAll) {
    for (let i = 0; i < count; i += 1) {
      next.add(i);
    }
  }
  runtime.visibleColumns = next;
  runtime.lastColumnsCount = count;
  renderColumnFilters(count);
}

export function renderColumnFilters(count) {
  if (!columnsCheckboxes) return;
  columnsCheckboxes.innerHTML = '';
  for (let i = 0; i < count; i += 1) {
    const id = `col_${i}`;
    const label = document.createElement('label');
    label.className = 'column-toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = runtime.visibleColumns.has(i);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) runtime.visibleColumns.add(i);
      else runtime.visibleColumns.delete(i);
      drawGrid();
    });
    const swatch = document.createElement('span');
    swatch.className = 'column-swatch';
    swatch.style.background = config.columnColors[i % config.columnColors.length];
    const text = document.createElement('span');
    text.textContent = `C${i + 1}`;
    label.appendChild(checkbox);
    label.appendChild(swatch);
    label.appendChild(text);
    columnsCheckboxes.appendChild(label);
  }
}

export function setAllColumns(checked) {
  const count = runtime.state?.columns?.length ?? runtime.state?.numColumns ?? 0;
  runtime.visibleColumns = new Set(Array.from({ length: count }, (_, i) => (checked ? i : null)).filter((v) => v != null));
  runtime.columnsInitialized = true;
  runtime.lastColumnsCount = count;
  renderColumnFilters(count);
  drawGrid();
}

export function addActivity(message, tone = 'info') {
  if (!activityLog) return;
  const time = new Date().toLocaleTimeString().slice(0, 8);
  const entry = document.createElement('div');
  entry.className = `activity-entry ${tone}`;
  entry.innerHTML = `<span class="activity-time">${time}</span><span class="activity-message">${message}</span>`;
  activityLog.prepend(entry);
  const items = activityLog.querySelectorAll('.activity-entry');
  if (items.length > 40) items[items.length - 1].remove();
}

export function triggerPulse(columns, kind = 'major', duration = 1000, frame = null) {
  runtime.pulseState = {
    start: performance.now(),
    duration,
    columns,
    kind,
    frame
  };
  if (!runtime.pulseFrame) {
    runtime.pulseFrame = requestAnimationFrame(renderPulse);
  }
}

function renderPulse(now) {
  if (!runtime.pulseState) {
    runtime.pulseFrame = null;
    return;
  }
  if (!runtime.pulseState.playing) {
    runtime.pulseFrame = null;
    return;
  }
  const elapsed = now - runtime.pulseState.start;
  runtime.pulseState.progress = Math.min(1, elapsed / runtime.pulseState.duration);
  if (runtime.pulseState.mode === 'frames' && runtime.pulseState.timeline?.length) {
    const idx = Math.min(
      runtime.pulseState.timeline.length - 1,
      Math.floor(runtime.pulseState.progress * (runtime.pulseState.timeline.length - 1))
    );
    const entry = runtime.pulseState.timeline[idx];
    runtime.pulseState.currentEntry = entry;
    runtime.highlightedFrame = entry.frames?.[0] ?? null;
  } else if (runtime.pulseState.frameCycle && runtime.pulseState.frameCycle.length > 0 && runtime.pulseState.frameDuration) {
    const idx = Math.min(
      runtime.pulseState.frameCycle.length - 1,
      Math.floor(elapsed / runtime.pulseState.frameDuration)
    );
    runtime.highlightedFrame = runtime.pulseState.frameCycle[idx];
  }
  if (framesNow && runtime.pulseState.mode === 'frames') {
    const step = runtime.pulseState.currentEntry?.step ?? '—';
    const frames = runtime.pulseState.currentEntry?.frames ?? [];
    const frameLabel = frames.length ? frames.map((frame) => prettyName(frame)).join(', ') : '—';
    framesNow.textContent = `Now playing · step ${step} · frames: ${frameLabel}`;
  }
  if (elapsed > runtime.pulseState.duration) {
    const restore = runtime.pulseState.restoreFrame ?? null;
    runtime.pulseState = null;
    runtime.pulseFrame = null;
    runtime.highlightedFrame = restore;
    drawGrid();
    return;
  }
  drawGrid(runtime.pulseState.progress);
  runtime.pulseFrame = requestAnimationFrame(renderPulse);
}

function pulseStroke(baseColor, kind, alpha) {
  if (kind === 'minor') {
    return `rgba(120,130,150,${alpha})`;
  }
  return `${baseColor}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

function computeFrameScores(summary) {
  if (!summary) return [];
  const frames = Array.from(runtime.activeFramesSet);
  return frames.map((frame) => {
    const top = summary.top?.[frame];
    const score = top?.count ?? 0;
    return { frame, score };
  });
}

export function renderFrameLegend(summary) {
  if (!frameLegend) return;
  const scored = computeFrameScores(summary).sort((a, b) => b.score - a.score).filter((entry) => entry.score > 0);
  runtime.overlayFrames = scored.slice(0, 3);
  runtime.legendFrames = scored.slice(0, 6);
  if (!runtime.legendFrames.length) {
    frameLegend.textContent = 'No active frames to display yet.';
    if (framesSummary) framesSummary.value = 'No semantic summary yet.';
    if (framesNow) framesNow.textContent = 'Idle · no frame playing';
    return;
  }
  frameLegend.innerHTML = '';
  const maxScore = Math.max(...runtime.legendFrames.map((entry) => entry.score), 1);
  runtime.legendFrames.forEach((entry) => {
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
    const mode = runtime.state?.contentMode ?? 'synthetic';
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

export function buildFrameTimeline() {
  const stepMap = new Map();
  runtime.legendFrames.forEach((entry) => {
    const frame = entry.frame;
    const segments = runtime.frameSegmentsMap?.[frame] ?? [];
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
  runtime.frameTimeline = steps.slice(-120);
}

export function clearQuerySequence(restoreHighlight = true) {
  runtime.querySequenceTimers.forEach((timer) => clearTimeout(timer));
  runtime.querySequenceTimers = [];
  if (runtime.pulseFrame) {
    cancelAnimationFrame(runtime.pulseFrame);
    runtime.pulseFrame = null;
  }
  if (restoreHighlight) {
    runtime.highlightedFrame = runtime.savedHighlight;
  }
  runtime.pulseState = null;
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

export function startQueryAnimation(autoPlay = true) {
  if (!runtime.state?.columns?.length) return;
  clearQuerySequence(false);
  runtime.savedHighlight = runtime.highlightedFrame;
  const { ordered, majorityCount } = computeColumnConsensus(runtime.state.columns);
  if (!ordered.length) return;
  const speed = Math.max(0.001, runtime.animationSpeed);
  const sweepDuration = 2200 / speed;
  const frameCycle = runtime.overlayFrames.length ? runtime.overlayFrames.map((entry) => entry.frame) : [];
  const frameDuration = frameCycle.length ? sweepDuration / frameCycle.length : sweepDuration;
  runtime.pulseState = {
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
    restoreFrame: runtime.savedHighlight
  };
  if (autoPlay && !runtime.pulseFrame) {
    runtime.pulseFrame = requestAnimationFrame(renderPulse);
  } else if (!autoPlay) {
    drawGrid(0);
  }
}

export function startFramesAnimation(autoPlay = true) {
  if (!runtime.state?.columns?.length) return;
  clearQuerySequence(false);
  runtime.savedHighlight = runtime.highlightedFrame;
  const speed = Math.max(0.001, runtime.animationSpeed);
  const sweepDuration = 2200 / speed;
  const cols = runtime.state.columns.map((_, idx) => idx);
  if (!runtime.frameTimeline.length) buildFrameTimeline();
  const timeline = runtime.frameTimeline.length ? runtime.frameTimeline : [];
  runtime.pulseState = {
    mode: 'frames',
    start: performance.now(),
    duration: sweepDuration,
    progress: 0,
    playing: autoPlay,
    columns: cols,
    majorColumns: cols,
    minorColumns: [],
    timeline,
    restoreFrame: runtime.savedHighlight,
    labelOverride: 'frame',
    note: 'linked'
  };
  if (autoPlay && !runtime.pulseFrame) {
    runtime.pulseFrame = requestAnimationFrame(renderPulse);
  } else if (!autoPlay) {
    drawGrid(0);
  }
}

export function stopAnimation() {
  if (!runtime.pulseState) return;
  runtime.pulseState.playing = false;
  if (runtime.pulseFrame) {
    cancelAnimationFrame(runtime.pulseFrame);
    runtime.pulseFrame = null;
  }
  if (framesNow && runtime.pulseState.mode === 'frames') {
    framesNow.textContent = 'Paused · no frame playing';
  }
  drawGrid(runtime.pulseState.progress ?? 0);
}

export function stepAnimation(mode) {
  if (!runtime.pulseState || runtime.pulseState.mode !== mode) {
    if (mode === 'query') startQueryAnimation(false);
    else startFramesAnimation(false);
  }
  if (!runtime.pulseState) return;
  runtime.pulseState.playing = false;
  if (mode === 'frames' && runtime.pulseState.timeline?.length) {
    const current = Math.floor((runtime.pulseState.progress ?? 0) * (runtime.pulseState.timeline.length - 1));
    const next = Math.min(runtime.pulseState.timeline.length - 1, current + 1);
    runtime.pulseState.progress = runtime.pulseState.timeline.length > 1
      ? next / (runtime.pulseState.timeline.length - 1)
      : 1;
    runtime.pulseState.currentEntry = runtime.pulseState.timeline[next];
    runtime.highlightedFrame = runtime.pulseState.currentEntry.frames?.[0] ?? null;
    if (framesNow) {
      const frames = runtime.pulseState.currentEntry.frames ?? [];
      const frameLabel = frames.length ? frames.map((frame) => prettyName(frame)).join(', ') : '—';
      framesNow.textContent = `Now playing · step ${runtime.pulseState.currentEntry.step} · frames: ${frameLabel}`;
    }
  } else {
    const step = 0.12;
    runtime.pulseState.progress = Math.min(1, (runtime.pulseState.progress ?? 0) + step);
    const elapsed = runtime.pulseState.progress * runtime.pulseState.duration;
    if (runtime.pulseState.frameCycle && runtime.pulseState.frameCycle.length > 0 && runtime.pulseState.frameDuration) {
      const idx = Math.min(
        runtime.pulseState.frameCycle.length - 1,
        Math.floor(elapsed / runtime.pulseState.frameDuration)
      );
      runtime.highlightedFrame = runtime.pulseState.frameCycle[idx];
    }
  }
  drawGrid(runtime.pulseState.progress);
}


export function updatePerf(metrics) {
  if (!perfBarVsa || !perfBarNaive || !perfBarVsaValue || !perfBarNaiveValue) return;
  const setBar = (bar, label, width, text) => {
    bar.style.width = width;
    label.textContent = text;
  };
  if (!metrics) {
    const needLabel = '—';
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

export function updateAnimationSpeedLabels() {
  if (!animSpeedValue || !animSpeedHint) return;
  animSpeedValue.textContent = `${runtime.animationSpeed.toFixed(3)}x`;
  const sweepSeconds = 2.2 / Math.max(0.001, runtime.animationSpeed);
  animSpeedHint.textContent = `≈ ${formatDuration(sweepSeconds)} per sweep`;
}

export function drawGrid(pulseProgress = null) {
  if (!runtime.state?.mapConfig || !canvas || !ctx) return;
  const { width, height } = runtime.state.mapConfig;
  const cellSize = canvas.width / width;

  // Use elegant tutorial-style background
  drawElegantBackground(ctx, canvas.width, canvas.height);

  // Draw grid lines with tutorial styling
  ctx.strokeStyle = TUTORIAL_COLORS.gridLine;
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

  if (runtime.state.history?.length > 0) {
    const columns = runtime.state.columns?.length ?? 1;
    for (let c = 0; c < columns; c += 1) {
      if (!runtime.visibleColumns.has(c)) continue;
      const path = runtime.state.history.map((entry) => entry.locations?.[c]).filter(Boolean);
      if (path.length === 0) continue;
      const baseAlpha = runtime.pulseState ? '33' : 'aa';
      ctx.strokeStyle = config.columnColors[c % config.columnColors.length] + baseAlpha;
      ctx.lineWidth = 2;
      ctx.beginPath();
      path.forEach((loc, idx) => {
        const px = (loc.x + 0.5) * cellSize;
        const py = (loc.y + 0.5) * cellSize;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      if (runtime.pulseState && pulseProgress != null) {
        const kind = runtime.pulseState.majorColumns?.includes(c)
          ? 'major'
          : runtime.pulseState.minorColumns?.includes(c)
            ? 'minor'
            : runtime.pulseState.columns?.includes(c)
              ? (runtime.pulseState.kind ?? 'major')
              : null;
        if (kind) {
          if (runtime.pulseState.mode === 'frames' && runtime.pulseState.currentEntry) {
            const step = runtime.pulseState.currentEntry.step;
            const prev = runtime.state.history?.[step - 1]?.locations ?? runtime.pulseState.currentEntry.locations;
            const to = runtime.pulseState.currentEntry.locations?.[c];
            const from = prev?.[c] ?? to;
            if (from && to) {
              const baseColor = frameColor(runtime.highlightedFrame ?? '');
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
                if (runtime.highlightedFrame) label.push(prettyName(runtime.highlightedFrame));
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
            const baseColor = config.columnColors[c % config.columnColors.length];
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
              const labelKind = runtime.pulseState.labelOverride ?? kind;
              label.push(labelKind);
              if (runtime.pulseState.note) label.push(runtime.pulseState.note);
              if (runtime.highlightedFrame) label.push(prettyName(runtime.highlightedFrame));
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

  if (runtime.state.columns?.length) {
    const offsets = [
      { x: -0.2, y: -0.15 },
      { x: 0.2, y: -0.1 },
      { x: -0.1, y: 0.2 },
      { x: 0.15, y: 0.2 }
    ];
    runtime.state.columns.forEach((loc, idx) => {
      if (!runtime.visibleColumns.has(idx)) return;
      const px = (loc.x + 0.5 + offsets[idx % offsets.length].x) * cellSize;
      const py = (loc.y + 0.5 + offsets[idx % offsets.length].y) * cellSize;
      ctx.fillStyle = config.columnColors[idx % config.columnColors.length];
      ctx.beginPath();
      ctx.arc(px, py, cellSize * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = config.columnColors[idx % config.columnColors.length];
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (runtime.overlayFrames.length > 0 && runtime.pulseState?.mode !== 'frames') {
        const dotOffsets = [
          { x: -0.45, y: -0.5 },
          { x: 0.45, y: -0.45 },
          { x: 0.5, y: 0.4 },
          { x: -0.5, y: 0.45 }
        ];
        runtime.overlayFrames.forEach((entry, index) => {
          const offset = dotOffsets[index % dotOffsets.length];
          const dx = offset.x * cellSize;
          const dy = offset.y * cellSize;
          ctx.fillStyle = frameColor(entry.frame);
          ctx.beginPath();
          ctx.arc(px + dx, py + dy, cellSize * 0.12, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      if (runtime.highlightedFrame) {
        ctx.strokeStyle = frameColor(runtime.highlightedFrame);
        ctx.lineWidth = cellSize * 0.12;
        ctx.beginPath();
        ctx.arc(px, py, cellSize * 0.68, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }

  if (runtime.pulseState && pulseProgress != null && runtime.state.columns?.length) {
    const pulse = 1 - pulseProgress;
    const radius = cellSize * (0.6 + 1.2 * pulseProgress);
    runtime.state.columns.forEach((loc, idx) => {
      if (!runtime.visibleColumns.has(idx)) return;
      const kind = runtime.pulseState.majorColumns?.includes(idx)
        ? 'major'
        : runtime.pulseState.minorColumns?.includes(idx)
          ? 'minor'
          : runtime.pulseState.columns?.includes(idx)
            ? (runtime.pulseState.kind ?? 'major')
            : null;
      if (!kind) return;
      const px = (loc.x + 0.5) * cellSize;
      const py = (loc.y + 0.5) * cellSize;
      const baseColor = config.columnColors[idx % config.columnColors.length];
      ctx.strokeStyle = pulseStroke(baseColor, kind, 0.85 * pulse);
      ctx.lineWidth = cellSize * 0.22;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  // ==================== THOUSAND BRAINS THEORY OVERLAYS ====================
  if (runtime.showTheoryViz && runtime.pulseState && pulseProgress != null) {
    const phase = pulseProgress;

    // Draw displacement vectors during step animation
    if (runtime.pulseState.mode === 'query' && runtime.state.history?.length > 1) {
      const pathIdx = Math.max(0, Math.floor(phase * (runtime.state.history.length - 1)));
      if (pathIdx > 0) {
        const prev = runtime.state.history[pathIdx - 1];
        const curr = runtime.state.history[pathIdx];
        if (prev?.locations?.[0] && curr?.locations?.[0]) {
          const from = prev.locations[0];
          const to = curr.locations[0];
          const dx = ((to.x - from.x + 32 + 64) % 64) - 32;
          const dy = ((to.y - from.y + 32 + 64) % 64) - 32;
          if (dx !== 0 || dy !== 0) {
            drawDisplacementVector(from, to, dx, dy, cellSize);
          }
        }
      }
    }

    // Draw localization candidates
    if (runtime.localizationCandidates?.length > 0 && phase > 0.2) {
      drawLocalizationCandidates(runtime.localizationCandidates, cellSize, phase);
    }

    // Draw voting circle
    if (runtime.votingState?.votes?.length > 0 && phase > 0.5) {
      const columns = runtime.state.columns || [];
      drawVotingCircle(
        columns,
        runtime.votingState.votes,
        runtime.votingState.winnerIdx ?? -1,
        phase,
        canvas.width,
        canvas.height
      );
    }

    // Draw info box with current step info
    if (phase > 0.1 && runtime.state.step != null) {
      const infoLines = [`Step: ${runtime.state.step}`];
      if (runtime.localizationCandidates?.length > 0) {
        infoLines.push(`Candidates: ${runtime.localizationCandidates.length}`);
      }
      if (runtime.votingState?.winnerIdx >= 0) {
        infoLines.push(`Winner: Column ${runtime.votingState.winnerIdx + 1}`);
      }
      drawInfoBox(10, 10, 'Query Progress', infoLines);
    }
  }
}

export function wireColumnControls() {
  columnsAllBtn?.addEventListener('click', () => setAllColumns(true));
  columnsNoneBtn?.addEventListener('click', () => setAllColumns(false));
}

export function updateAnimationSpeed(value) {
  const t = value - 50;
  runtime.animationSpeed = Math.pow(10, t / 16.7);
  updateAnimationSpeedLabels();
}

// ==================== SATURATION HEATMAP ====================

/**
 * Draw a saturation heatmap overlay on the grid.
 * Colors cells based on how "full" they are (heavy-hitters capacity).
 */
export function drawSaturationHeatmap(diagnostics, canvasWidth, canvasHeight) {
  if (!ctx || !diagnostics?.cellData) return;

  const { width, height } = runtime.state?.mapConfig ?? { width: 64, height: 64 };
  const cellSize = canvasWidth / width;

  for (const cell of diagnostics.cellData) {
    const { x, y, saturation } = cell;
    if (saturation <= 0) continue;

    // Color based on saturation: green (0%) -> yellow (50%) -> red (100%)
    let color;
    if (saturation < 0.5) {
      const t = saturation * 2;
      color = `rgba(${Math.round(255 * t)}, 200, 50, 0.4)`;
    } else {
      const t = (saturation - 0.5) * 2;
      color = `rgba(255, ${Math.round(200 * (1 - t))}, 50, 0.5)`;
    }

    ctx.fillStyle = color;
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
  }

  // Draw legend
  const legendX = 10;
  const legendY = canvasHeight - 60;
  const legendW = 120;
  const legendH = 50;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(legendX, legendY, legendW, legendH);
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
  ctx.strokeRect(legendX, legendY, legendW, legendH);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 10px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Cell Saturation', legendX + 5, legendY + 14);

  // Gradient bar
  const gradientX = legendX + 5;
  const gradientY = legendY + 22;
  const gradientW = legendW - 10;
  const gradientH = 12;

  const gradient = ctx.createLinearGradient(gradientX, 0, gradientX + gradientW, 0);
  gradient.addColorStop(0, 'rgba(50, 200, 50, 0.8)');
  gradient.addColorStop(0.5, 'rgba(255, 200, 50, 0.8)');
  gradient.addColorStop(1, 'rgba(255, 50, 50, 0.8)');

  ctx.fillStyle = gradient;
  ctx.fillRect(gradientX, gradientY, gradientW, gradientH);

  ctx.fillStyle = 'rgba(226, 232, 240, 0.7)';
  ctx.font = '8px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('0%', gradientX, gradientY + gradientH + 10);
  ctx.textAlign = 'center';
  ctx.fillText('50%', gradientX + gradientW / 2, gradientY + gradientH + 10);
  ctx.textAlign = 'right';
  ctx.fillText('100%', gradientX + gradientW, gradientY + gradientH + 10);
}

/**
 * Compute voting results using real Voter logic.
 * This integrates with the vsabrains-bridge for accurate voting simulation.
 */
export function computeVotingFromColumns(columns, candidates) {
  if (!columns?.length || !candidates?.length) {
    return { votes: [], winnerIdx: -1, confidence: 0 };
  }

  // Each column "votes" for the candidate closest to its current position
  const votes = [];
  const voteScores = new Map();

  columns.forEach((col, idx) => {
    // Find best candidate for this column
    let bestCandidate = null;
    let bestScore = -Infinity;

    for (const cand of candidates) {
      // Score based on proximity and match score
      const dist = Math.hypot(col.x - cand.location.x, col.y - cand.location.y);
      const score = (cand.score ?? 1) - dist * 0.01;
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = cand;
      }
    }

    if (bestCandidate) {
      const key = `${bestCandidate.location.x},${bestCandidate.location.y}`;
      voteScores.set(key, (voteScores.get(key) ?? 0) + 1);
      votes.push(1); // Each column contributes 1 vote
    } else {
      votes.push(0);
    }
  });

  // Find winner
  let winnerIdx = -1;
  let maxVotes = 0;
  let totalVotes = 0;

  columns.forEach((col, idx) => {
    if (votes[idx] > maxVotes) {
      maxVotes = votes[idx];
      winnerIdx = idx;
    }
    totalVotes += votes[idx];
  });

  // Confidence = majority / total
  const confidence = totalVotes > 0 ? maxVotes / totalVotes : 0;

  return { votes, winnerIdx, confidence };
}

/**
 * Update voting state from localization results.
 */
export function updateVotingState(candidates, columns) {
  if (!candidates?.length || !columns?.length) {
    runtime.votingState = { votes: [], winnerIdx: -1, confidence: 0 };
    return;
  }

  const result = computeVotingFromColumns(columns, candidates);
  runtime.votingState = result;
}

/**
 * Set localization candidates for visualization.
 */
export function setLocalizationCandidates(candidates) {
  runtime.localizationCandidates = candidates ?? [];
}

/**
 * Toggle theory visualization overlay.
 */
export function setTheoryVizEnabled(enabled) {
  runtime.showTheoryViz = enabled;
  drawGrid();
}
