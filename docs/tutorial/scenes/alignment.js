/**
 * Scene renderer: Alignment
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from '../config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from '../drawing.js';

/**
 * Render Alignment Scene - Mapping different column frames into a shared frame
 */
export function renderAlignmentScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);
  drawGrid(ctx, [], null, false);

  const colors = [COLORS.path1, COLORS.path2, COLORS.path3];

  // Draw paths and current positions.
  PATHS.forEach((path, idx) => {
    drawPath(ctx, path, colors[idx], phase, false);
  });

  const stepIdx = Math.floor(phase * (TOKENS.length - 1));
  const current = PATHS.map(path => path[Math.min(stepIdx, path.length - 1)]);

  current.forEach((pos, idx) => {
    const { x, y } = gridToPixel(pos.x, pos.y);
    ctx.fillStyle = colors[idx];
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
  });

  // Frame origins (start positions)
  const starts = PATHS.map(path => path[0]);
  const anchor = starts[0];
  const anchorPx = gridToPixel(anchor.x, anchor.y);

  // Highlight anchor frame origin.
  ctx.strokeStyle = COLORS.locMatch;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(anchorPx.x, anchorPx.y, 14, 0, Math.PI * 2);
  ctx.stroke();

  // Draw alignment vectors between frame origins.
  if (phase > 0.45) {
    const alpha = Math.min(1, (phase - 0.45) / 0.15);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = COLORS.displacement;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);

    for (let i = 1; i < starts.length; i++) {
      const from = gridToPixel(starts[i].x, starts[i].y);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(anchorPx.x, anchorPx.y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  const offsets = starts.map(s => ({ dx: anchor.x - s.x, dy: anchor.y - s.y }));

  drawInfoBox(ctx, baseWidth - 200, 50, 'Frame Alignment', [
    'Each column has its own origin',
    `Offsets → shared frame`,
    `C1 offset: (${offsets[0].dx}, ${offsets[0].dy})`,
    phase > 0.55 ? `C2/C3: (${offsets[1].dx}, ${offsets[1].dy}), (${offsets[2].dx}, ${offsets[2].dy})` : 'Aligning candidates...'
  ]);
}

/**
 * Render Localization Scene
 */
