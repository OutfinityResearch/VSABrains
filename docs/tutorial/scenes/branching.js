/**
 * Scene renderer: Branching
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from '../config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from '../drawing.js';

/**
 * Render Branching Scene
 */
export function renderBranchingScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);
  drawGrid(ctx, [], null, false);

  drawBranchingPath(ctx, PATHS, phase, baseWidth);

  drawInfoBox(ctx, baseWidth - 200, 150, 'Branching', [
    'Ambiguous context detected',
    'Multiple hypotheses active',
    phase > 0.7 ? 'Evidence will disambiguate' : 'Exploring alternatives...'
  ]);

  if (phase > 0.8) {
    drawInfoBox(ctx, 55, 380, 'Resolution', [
      'New tokens arrive',
      'One branch becomes unlikely',
      'System prunes hypothesis'
    ]);
  }

}

/**
 * Render Prediction Scene
 */
