/**
 * Scene renderer: Knobs
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from '../config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from '../drawing.js';

/**
 * Render Knobs Scene - Visualize tunable parameters and their tradeoffs
 */
export function renderKnobsScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  const knobs = [
    {
      label: 'Context length',
      range: [1, 6],
      value: 2,
      note: 'More context reduces collisions but costs compute.'
    },
    {
      label: 'Top-K per cell',
      range: [2, 12],
      value: 4,
      note: 'More capacity reduces forgetting but increases muddiness.'
    },
    {
      label: 'Number of columns',
      range: [1, 9],
      value: 3,
      note: 'More columns improve consensus but increase cost.'
    },
    {
      label: 'Checkpoint interval',
      range: [20, 300],
      value: 100,
      note: 'More checkpoints speed replay but use storage.'
    }
  ];

  const highlightIdx = Math.min(knobs.length - 1, Math.floor(phase * knobs.length));

  const startX = 80;
  const startY = 110;
  const rowH = 72;
  const barW = 420;
  const barH = 10;

  knobs.forEach((knob, idx) => {
    const y = startY + idx * rowH;
    const active = idx === highlightIdx;
    const color = active ? COLORS.vote : COLORS.gridLine;

    // Label
    ctx.fillStyle = active ? COLORS.text : COLORS.muted;
    ctx.font = 'bold 13px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(knob.label, startX, y);

    // Range
    ctx.fillStyle = COLORS.muted;
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.fillText(`${knob.range[0]} … ${knob.range[1]}`, startX + barW - 60, y);

    // Bar background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.roundRect(startX, y + 18, barW, barH, 999);
    ctx.fill();

    // Bar fill + marker
    const t = (knob.value - knob.range[0]) / (knob.range[1] - knob.range[0]);
    const fillW = Math.max(6, barW * Math.min(1, Math.max(0, t)));
    ctx.fillStyle = active ? 'rgba(123, 141, 255, 0.55)' : 'rgba(123, 141, 255, 0.22)';
    ctx.beginPath();
    ctx.roundRect(startX, y + 18, fillW, barH, 999);
    ctx.fill();

    const mx = startX + fillW;
    const my = y + 23;
    ctx.fillStyle = active ? COLORS.vote : COLORS.muted;
    ctx.beginPath();
    ctx.arc(mx, my, active ? 7 : 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = active ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(startX - 12, y - 14, barW + 24, 46, 14);
    ctx.stroke();
  });

  drawInfoBox(ctx, baseWidth - 200, 50, 'Tunable Tradeoffs', [
    'Interpretable parameters',
    'No hidden magic',
    knobs[highlightIdx]?.note ?? 'Tune for your workload'
  ]);
}
