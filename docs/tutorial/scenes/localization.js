/**
 * Scene renderer: Localization
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from '../config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from '../drawing.js';

/**
 * Render Localization Scene
 */
export function renderLocalizationScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  const path = PATHS[0];
  drawGrid(ctx, path.slice(0, 10).map(p => ({ x: p.x, y: p.y, tokens: [p.token] })), null, false);
  drawPath(ctx, path.slice(0, 10), COLORS.path1, 1, false);

  const candidates = [
    { x: 15, y: 15, score: 0.92 },
    { x: 17, y: 14, score: 0.67 },
    { x: 14, y: 17, score: 0.45 }
  ];

  if (phase > 0.3) {
    drawLocalizationMatch(ctx, candidates.slice(0, Math.ceil(phase * 3)), phase);
  }

  drawInfoBox(ctx, baseWidth - 200, 50, 'Localization Query', [
    `Window: [${TOKENS[6]}, ${TOKENS[7]}]`,
    'Searching stored patterns...',
    phase > 0.5 ? `Found ${Math.ceil(phase * 3)} matches` : 'Scanning...'
  ]);

}

/**
 * Render Voting Scene
 */
