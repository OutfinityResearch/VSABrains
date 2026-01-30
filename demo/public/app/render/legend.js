import { dom, runtime } from '../store.js';
import { frameColor, prettyName } from '../format.js';

const {
  frameLegend,
  framesSummary,
  framesNow
} = dom;

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

