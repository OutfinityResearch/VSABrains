/**
 * Scene renderer: Displacement
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from '../config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from '../drawing.js';

/**
 * Render Displacement Scene
 */
export function renderDisplacementScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);
  drawGrid(ctx, [], null, false);

  const path = PATHS[0];
  const stepIdx = Math.floor(phase * (path.length - 1));
  const currentStep = path[stepIdx];

  drawPath(ctx, path, COLORS.path1, (stepIdx + 1) / path.length, true);

  if (stepIdx > 0) {
    drawContextWindow(ctx, TOKENS, stepIdx, baseWidth - 120, baseHeight - 80);
  }

  if (currentStep && currentStep.dx !== undefined) {
    drawInfoBox(ctx, baseWidth - 200, 50, 'Displacement', [
      `Context: [${TOKENS[Math.max(0, stepIdx - 1)]}, ${TOKENS[stepIdx]}]`,
      `Hash → (dx, dy)`,
      `Move: (${currentStep.dx}, ${currentStep.dy})`
    ]);
  }

}

/**
 * Render Path Scene
 */
