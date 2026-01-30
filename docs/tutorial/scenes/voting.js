/**
 * Scene renderer: Voting
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from '../config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from '../drawing.js';

/**
 * Render Voting Scene
 */
export function renderVotingScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);
  drawGrid(ctx, [], null, false);

  const colors = [COLORS.path1, COLORS.path2, COLORS.path3];
  PATHS.forEach((path, idx) => {
    drawPath(ctx, path.slice(0, 5), colors[idx], 1, false);
  });

  const columns = [
    { color: COLORS.path1 },
    { color: COLORS.path2 },
    { color: COLORS.path3 }
  ];

  const votes = [3, 2, 3];
  const winnerIdx = phase > 0.7 ? 0 : -1;

  drawVotingCircle(ctx, columns, votes, winnerIdx, phase, baseWidth, baseHeight);

  drawInfoBox(ctx, 55, 380, 'Voting Process', [
    '1. Each column proposes location',
    '2. Votes are shared laterally',
    phase > 0.7 ? '3. Consensus reached!' : '3. Counting votes...'
  ]);

}

/**
 * Render Branching Scene
 */
