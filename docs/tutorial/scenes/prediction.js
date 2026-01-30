/**
 * Scene renderer: Prediction
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from '../config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from '../drawing.js';

/**
 * Render Prediction Scene
 */
export function renderPredictionScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);
  drawGrid(ctx, [], null, false);

  const path = PATHS[0];
  const stepIdx = Math.min(Math.floor(phase * 8) + 3, path.length - 1);

  drawPath(ctx, path.slice(0, stepIdx), COLORS.path1, 1, false);

  const current = path[stepIdx];
  if (current && isInView(current.x, current.y)) {
    const { x, y } = gridToPixel(current.x, current.y);

    const predPhase = (phase * 4) % 1;
    if (predPhase < 0.5) {
      ctx.fillStyle = 'rgba(139, 92, 246, 0.3)';
      ctx.beginPath();
      ctx.arc(x, y, 25 + predPhase * 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#a78bfa';
      ctx.font = 'bold 11px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Predicting...', x, y - 35);

      const nextToken = path[stepIdx + 1]?.token ?? '?';
      ctx.fillStyle = COLORS.vote;
      ctx.font = 'bold 14px "Space Grotesk", sans-serif';
      ctx.fillText(`→ ${nextToken}`, x + 40, y);
    } else {
      const actualToken = path[stepIdx]?.token ?? 0;
      ctx.fillStyle = COLORS.locMatch;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(actualToken), x, y + 4);

      const error = predPhase > 0.7;
      if (error) {
        ctx.fillStyle = COLORS.locMatch;
        ctx.font = '10px "Space Grotesk", sans-serif';
        ctx.fillText('✓ Match', x, y + 38);
      }
    }
  }

  drawInfoBox(ctx, baseWidth - 200, 50, 'Prediction Loop', [
    '1. Read top-K at location',
    '2. Predict next token',
    '3. Observe actual token',
    phase > 0.5 ? '4. Compute error → learn' : '4. Waiting...'
  ]);

}

/**
 * Render Heavy-Hitters Scene
 */
