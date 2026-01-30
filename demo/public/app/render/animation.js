import { dom, runtime } from '../store.js';
import { prettyName } from '../format.js';
import { drawGrid } from './grid.js';
import { buildFrameTimeline } from './legend.js';

const { framesNow } = dom;

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

