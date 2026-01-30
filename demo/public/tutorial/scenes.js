/**
 * Tutorial Scene Renderers
 * Individual rendering functions for each tutorial scene
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from './config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from './drawing.js';

/**
 * Render Grid Scene - Where Memory Lives
 */
export function renderGridScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  const highlightedCells = [
    { x: 12, y: 12, tokens: [42, 17] },
    { x: 14, y: 13, tokens: [89, 23, 56] },
    { x: 15, y: 15, tokens: [78] },
    { x: 13, y: 16, tokens: [34, 91, 45, 12] }
  ];

  const activeIdx = Math.floor(phase * 4) % highlightedCells.length;
  const activeCell = highlightedCells[activeIdx];

  drawGrid(ctx, highlightedCells, activeCell, true);
  drawInfoBox(ctx, baseWidth - 200, 50, 'Grid Cell', [
    'Stores top-K tokens',
    'Each write adds to cell',
    'Location = address'
  ]);

  const { x, y } = gridToPixel(activeCell.x, activeCell.y);
  const pulse = Math.sin(phase * Math.PI * 6) * 0.5 + 0.5;

  ctx.strokeStyle = `rgba(232, 121, 249, ${pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 22 + pulse * 5, 0, Math.PI * 2);
  ctx.stroke();

  drawLabel(ctx, x, y - 35, 'Writing token...', 'highlight');
  drawLabel(ctx, baseWidth / 2, baseHeight - 25, 'Memory = tokens written at locations in a 2D grid', 'highlight');
}

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

  drawLabel(ctx, baseWidth / 2, baseHeight - 25, 'Context tokens are hashed to compute displacement vector', 'highlight');
}

/**
 * Render Path Scene
 */
export function renderPathScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  const path = PATHS[0];
  const visibleCells = path.slice(0, Math.floor(phase * path.length)).map(p => ({ x: p.x, y: p.y, tokens: [p.token] }));

  drawGrid(ctx, visibleCells, null, true);
  drawPath(ctx, path, COLORS.path1, phase, false);

  const stepCount = Math.floor(phase * path.length);
  drawInfoBox(ctx, baseWidth - 200, 50, 'Path Progress', [
    `Step: ${stepCount} / ${path.length}`,
    `Tokens written: ${stepCount}`,
    `Cells visited: ${new Set(path.slice(0, stepCount).map(p => `${p.x},${p.y}`)).size}`
  ]);

  drawLabel(ctx, baseWidth / 2, baseHeight - 25, 'The path through space encodes the sequence - time becomes space', 'highlight');
}

/**
 * Render Multi-Column Scene
 */
export function renderMultiColumnScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);
  drawGrid(ctx, [], null, false);

  const colors = [COLORS.path1, COLORS.path2, COLORS.path3];

  PATHS.forEach((path, idx) => {
    drawPath(ctx, path, colors[idx], phase, false);
  });

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 12px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';

  colors.forEach((color, idx) => {
    const ly = 60 + idx * 25;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(baseWidth - 180, ly, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.text;
    ctx.fillText(`Column ${idx + 1} (offset: ${[15, 18, 13][idx]}, ${[14, 16, 18][idx]})`, baseWidth - 165, ly + 4);
  });

  drawLabel(ctx, baseWidth / 2, baseHeight - 25, 'Same input, different starting positions → different but correlated paths', 'highlight');
}

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

  drawLabel(ctx, baseWidth / 2, baseHeight - 25, 'Localization finds where in the grid the current context matches', 'highlight');
}

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

  drawLabel(ctx, baseWidth / 2, baseHeight - 25, 'Columns vote on location - majority wins, conflicts detected', 'highlight');
}

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

  drawLabel(ctx, baseWidth / 2, baseHeight - 25, 'Paths can branch when context is ambiguous - pruned by new evidence', 'highlight');
}

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

  drawLabel(ctx, baseWidth / 2, baseHeight - 25, 'Columns predict BEFORE observing. Prediction error drives learning.', 'highlight');
}

/**
 * Render Heavy-Hitters Scene
 */
export function renderHeavyHittersScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  const cellX = 14;
  const cellY = 14;
  const px = GRID_OFFSET.x + (cellX - GRID_VIEW.startX) * CELL_SIZE;
  const py = GRID_OFFSET.y + (cellY - GRID_VIEW.startY) * CELL_SIZE;

  drawGrid(ctx, [{ x: cellX, y: cellY, tokens: [] }], { x: cellX, y: cellY }, false);

  const K = 4;
  const tokensArriving = [42, 17, 89, 23, 56];
  const numArrived = Math.min(Math.floor(phase * 6), tokensArriving.length);

  const cellContents = tokensArriving.slice(0, Math.min(numArrived, K));
  const evicted = numArrived > K ? tokensArriving[0] : null;

  const positions = [
    { dx: 8, dy: 10 },
    { dx: 22, dy: 10 },
    { dx: 8, dy: 24 },
    { dx: 22, dy: 24 }
  ];

  cellContents.forEach((token, i) => {
    const isEvicted = evicted && i === 0 && numArrived > K;
    ctx.fillStyle = isEvicted ? 'rgba(239, 68, 68, 0.5)' : COLORS.token;
    ctx.beginPath();
    ctx.arc(px + positions[i].dx, py + positions[i].dy, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isEvicted ? '#fca5a5' : '#fff';
    ctx.font = 'bold 8px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(token), px + positions[i].dx, py + positions[i].dy);
  });

  if (numArrived < tokensArriving.length) {
    const incomingToken = tokensArriving[numArrived];
    const arrowX = px + CELL_SIZE + 30;
    const arrowY = py + CELL_SIZE / 2;

    ctx.strokeStyle = COLORS.displacement;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(arrowX + 40, arrowY);
    ctx.lineTo(arrowX, arrowY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = COLORS.displacement;
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX + 8, arrowY - 5);
    ctx.lineTo(arrowX + 8, arrowY + 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLORS.token;
    ctx.beginPath();
    ctx.arc(arrowX + 55, arrowY, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px "Space Grotesk", sans-serif';
    ctx.fillText(String(incomingToken), arrowX + 55, arrowY + 3);
  }

  if (evicted && phase > 0.8) {
    ctx.fillStyle = '#ef4444';
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Evicted: ${evicted} (least frequent)`, px - 10, py + CELL_SIZE + 20);
  }

  drawInfoBox(ctx, baseWidth - 200, 50, 'Heavy-Hitters (K=4)', [
    `Tokens arrived: ${numArrived}`,
    `Cell capacity: ${K}`,
    numArrived > K ? 'Eviction triggered!' : 'Storing...',
    'Keeps top-K by frequency'
  ]);

  // Saturation meter
  const saturation = Math.min(numArrived / K, 1);
  const meterX = baseWidth - 200;
  const meterY = 180;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(meterX, meterY, 160, 40);
  ctx.strokeStyle = COLORS.muted;
  ctx.strokeRect(meterX, meterY, 160, 40);

  ctx.fillStyle = COLORS.muted;
  ctx.font = '10px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Cell Saturation', meterX + 10, meterY + 15);

  ctx.fillStyle = saturation >= 1 ? '#ef4444' : COLORS.locMatch;
  ctx.fillRect(meterX + 10, meterY + 22, 140 * saturation, 10);

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 9px "Space Grotesk", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(saturation * 100)}%`, meterX + 150, meterY + 31);

  drawLabel(ctx, baseWidth / 2, baseHeight - 25, 'Each cell keeps only top-K tokens. Eviction prevents muddiness.', 'highlight');
}

/**
 * Render Replay Scene
 */
export function renderReplayScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);
  drawGrid(ctx, [], null, false);

  const path = PATHS[0];

  // Faded full path
  ctx.strokeStyle = COLORS.path1 + '33';
  ctx.lineWidth = 2;
  ctx.beginPath();
  path.forEach((point, idx) => {
    if (!isInView(point.x, point.y)) return;
    const { x, y } = gridToPixel(point.x, point.y);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Checkpoint marker
  const checkpointStep = 5;
  const checkpointPos = path[checkpointStep];
  if (checkpointPos && isInView(checkpointPos.x, checkpointPos.y)) {
    const { x, y } = gridToPixel(checkpointPos.x, checkpointPos.y);
    ctx.strokeStyle = COLORS.vote;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = COLORS.vote;
    ctx.font = 'bold 9px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Checkpoint', x, y - 28);
    ctx.fillText(`Step ${checkpointStep}`, x, y + 32);
  }

  const targetStep = Math.min(checkpointStep + Math.floor(phase * 10) + 1, path.length - 1);
  const targetPos = path[targetStep];

  // Replay progress
  if (phase > 0.2) {
    const replayProgress = Math.min((phase - 0.2) / 0.6, 1);
    const replayEnd = checkpointStep + Math.floor(replayProgress * (targetStep - checkpointStep));

    ctx.strokeStyle = COLORS.locMatch;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = checkpointStep; i <= replayEnd && i < path.length; i++) {
      const point = path[i];
      if (!isInView(point.x, point.y)) continue;
      const { x, y } = gridToPixel(point.x, point.y);
      if (i === checkpointStep) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const replayPos = path[replayEnd];
    if (replayPos && isInView(replayPos.x, replayPos.y)) {
      const { x, y } = gridToPixel(replayPos.x, replayPos.y);
      ctx.fillStyle = COLORS.locMatch;
      ctx.shadowColor = COLORS.locMatch;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // Target marker
  if (targetPos && isInView(targetPos.x, targetPos.y)) {
    const { x, y } = gridToPixel(targetPos.x, targetPos.y);
    ctx.strokeStyle = COLORS.displacement;
    ctx.setLineDash([4, 2]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = COLORS.displacement;
    ctx.font = '9px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Query target', x, y - 22);
    ctx.fillText(`Step ${targetStep}`, x, y + 28);
  }

  drawInfoBox(ctx, baseWidth - 200, 50, 'Replay from Checkpoint', [
    `Checkpoint: step ${checkpointStep}`,
    `Target: step ${targetStep}`,
    `Replay steps: ${targetStep - checkpointStep}`,
    phase > 0.8 ? 'State reconstructed!' : 'Replaying events...'
  ]);

  drawLabel(ctx, baseWidth / 2, baseHeight - 25, 'State is reconstructed by replaying events from the nearest checkpoint.', 'highlight');
}

/**
 * Render Slow Maps Scene
 */
export function renderSlowMapsScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  const fastGridOffset = { x: 40, y: 80 };
  const slowGridOffset = { x: 480, y: 80 };
  const miniCellSize = 28;
  const miniGridSize = 8;

  // Labels
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 14px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Fast Map (every step)', fastGridOffset.x + miniGridSize * miniCellSize / 2, fastGridOffset.y - 20);
  ctx.fillText('Slow Map (every 5 steps)', slowGridOffset.x + miniGridSize * miniCellSize / 2, slowGridOffset.y - 20);

  function drawMiniGrid(offset, color, pathProgress) {
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    for (let i = 0; i <= miniGridSize; i++) {
      ctx.beginPath();
      ctx.moveTo(offset.x + i * miniCellSize, offset.y);
      ctx.lineTo(offset.x + i * miniCellSize, offset.y + miniGridSize * miniCellSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(offset.x, offset.y + i * miniCellSize);
      ctx.lineTo(offset.x + miniGridSize * miniCellSize, offset.y + i * miniCellSize);
      ctx.stroke();
    }

    const pathSteps = Math.floor(pathProgress * 15);
    let x = 2, y = 2;
    const visited = [];

    ctx.strokeStyle = color + 'aa';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < pathSteps; i++) {
      const px = offset.x + (x + 0.5) * miniCellSize;
      const py = offset.y + (y + 0.5) * miniCellSize;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);

      visited.push({ x, y });

      const dx = ((i * 7) % 3) - 1;
      const dy = ((i * 11) % 3) - 1;
      x = ((x + dx) % miniGridSize + miniGridSize) % miniGridSize;
      y = ((y + dy) % miniGridSize + miniGridSize) % miniGridSize;
    }
    ctx.stroke();

    if (pathSteps > 0) {
      const last = visited[visited.length - 1];
      const px = offset.x + (last.x + 0.5) * miniCellSize;
      const py = offset.y + (last.y + 0.5) * miniCellSize;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    return pathSteps;
  }

  const fastSteps = drawMiniGrid(fastGridOffset, COLORS.path1, phase);
  const slowPhase = Math.floor(phase * 15 / 5) * 5 / 15;
  drawMiniGrid(slowGridOffset, COLORS.path2, slowPhase);

  if (phase > 0.3) {
    const windowNum = Math.floor(phase * 3);
    ctx.fillStyle = COLORS.vote;
    ctx.font = '10px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Window ${windowNum + 1} summary`, slowGridOffset.x + miniGridSize * miniCellSize / 2, slowGridOffset.y + miniGridSize * miniCellSize + 20);
  }

  // Arrow between grids
  const arrowY = fastGridOffset.y + miniGridSize * miniCellSize / 2;
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(fastGridOffset.x + miniGridSize * miniCellSize + 20, arrowY);
  ctx.lineTo(slowGridOffset.x - 20, arrowY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = COLORS.muted;
  ctx.beginPath();
  ctx.moveTo(slowGridOffset.x - 20, arrowY);
  ctx.lineTo(slowGridOffset.x - 30, arrowY - 6);
  ctx.lineTo(slowGridOffset.x - 30, arrowY + 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COLORS.muted;
  ctx.font = '9px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Summary', (fastGridOffset.x + miniGridSize * miniCellSize + slowGridOffset.x) / 2, arrowY - 10);
  ctx.fillText('every N steps', (fastGridOffset.x + miniGridSize * miniCellSize + slowGridOffset.x) / 2, arrowY + 15);

  drawInfoBox(ctx, 40, 360, 'Fast Map', [
    `Steps written: ${fastSteps}`,
    'Writes every step',
    'Detailed trajectory'
  ]);

  drawInfoBox(ctx, 480, 360, 'Slow Map', [
    `Windows written: ${Math.floor(slowPhase * 3) + 1}`,
    'Writes every 5 steps',
    'Abstract summaries'
  ]);

  drawLabel(ctx, baseWidth / 2, baseHeight - 25, 'Fast maps for detail, slow maps for abstraction. Like cortical hierarchy.', 'highlight');
}

/**
 * Render Reasoning Scene
 */
export function renderReasoningScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  const sigX = 100;
  const sigY = 100;
  const sigW = 300;
  const sigH = 120;

  // Fact signature box
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.beginPath();
  ctx.roundRect(sigX, sigY, sigW, sigH, 8);
  ctx.fill();
  ctx.strokeStyle = COLORS.vote;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 14px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Fact (Work Signature)', sigX + 15, sigY + 25);

  const fact = { subject: 'Alice', predicate: 'enters', object: 'room_A' };

  ctx.font = '13px "Space Grotesk", monospace';
  ctx.fillStyle = '#a5b4fc';
  ctx.fillText('subject:', sigX + 20, sigY + 55);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`"${fact.subject}"`, sigX + 100, sigY + 55);

  ctx.fillStyle = '#a5b4fc';
  ctx.fillText('predicate:', sigX + 20, sigY + 75);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`"${fact.predicate}"`, sigX + 100, sigY + 75);

  ctx.fillStyle = '#a5b4fc';
  ctx.fillText('object:', sigX + 20, sigY + 95);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`"${fact.object}"`, sigX + 100, sigY + 95);

  // Pattern box
  const patX = 500;
  const patY = 100;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.beginPath();
  ctx.roundRect(patX, patY, sigW, sigH, 8);
  ctx.fill();
  ctx.strokeStyle = COLORS.displacement;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 14px "Space Grotesk", sans-serif';
  ctx.fillText('Pattern (with variable)', patX + 15, patY + 25);

  ctx.font = '13px "Space Grotesk", monospace';
  ctx.fillStyle = '#a5b4fc';
  ctx.fillText('subject:', patX + 20, patY + 55);
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('?x', patX + 100, patY + 55);

  ctx.fillStyle = '#a5b4fc';
  ctx.fillText('predicate:', patX + 20, patY + 75);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`"enters"`, patX + 100, patY + 75);

  ctx.fillStyle = '#a5b4fc';
  ctx.fillText('object:', patX + 20, patY + 95);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`"room_A"`, patX + 100, patY + 95);

  // Unification arrow
  if (phase > 0.3) {
    const arrowY = sigY + sigH + 50;
    ctx.strokeStyle = COLORS.locMatch;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(sigX + sigW / 2, sigY + sigH + 10);
    ctx.quadraticCurveTo(baseWidth / 2, arrowY + 30, patX + sigW / 2, patY + sigH + 10);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = COLORS.locMatch;
    ctx.font = 'bold 12px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Unification', baseWidth / 2, arrowY + 20);
  }

  // Bindings result
  if (phase > 0.5) {
    const bindX = baseWidth / 2 - 100;
    const bindY = 320;

    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
    ctx.beginPath();
    ctx.roundRect(bindX, bindY, 200, 60, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.locMatch;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.locMatch;
    ctx.font = 'bold 13px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Bindings', bindX + 100, bindY + 22);

    ctx.font = '14px "Space Grotesk", monospace';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('?x', bindX + 40, bindY + 45);
    ctx.fillStyle = COLORS.text;
    ctx.fillText('→', bindX + 70, bindY + 45);
    ctx.fillText('"Alice"', bindX + 130, bindY + 45);
  }

  // Derivation chain
  if (phase > 0.7) {
    const chainX = 150;
    const chainY = 420;

    ctx.fillStyle = COLORS.muted;
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Derivation Chain:', chainX, chainY);

    const steps = [
      { label: 'Premise', text: 'Alice enters room_A' },
      { label: 'Rule', text: 'IF enters(X, Y) THEN location(X) = Y' },
      { label: 'Derived', text: 'location(Alice) = room_A' }
    ];

    steps.forEach((step, i) => {
      const stepY = chainY + 25 + i * 25;
      const alpha = Math.min(1, (phase - 0.7) / 0.1 * (i + 1));

      ctx.fillStyle = `rgba(139, 92, 246, ${alpha})`;
      ctx.fillText(`${i + 1}. [${step.label}]`, chainX, stepY);

      ctx.fillStyle = `rgba(226, 232, 240, ${alpha})`;
      ctx.fillText(step.text, chainX + 120, stepY);
    });
  }

  drawInfoBox(ctx, baseWidth - 200, 50, 'Reasoning Primitives', [
    'Facts = structured bindings',
    'Patterns = templates with ?vars',
    'Unification = matching + binding',
    phase > 0.7 ? 'Chains = auditable derivations' : 'Building chain...'
  ]);

  drawLabel(ctx, baseWidth / 2, baseHeight - 25, 'Reasoning is explicit: facts, patterns, bindings, derivation chains.', 'highlight');
}

/**
 * Render VSA Index Scene - Semantic Addressing
 */
export function renderVSAIndexScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  // Draw hypervector visualization
  const hvX = 80;
  const hvY = 80;
  const hvW = 320;
  const hvH = 60;

  // Container for hypervector
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.beginPath();
  ctx.roundRect(hvX, hvY, hvW, hvH, 8);
  ctx.fill();
  ctx.strokeStyle = COLORS.token;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 12px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Hypervector (d=1024)', hvX + 10, hvY + 18);

  // Draw binary pattern
  const patternY = hvY + 35;
  const patternW = 300;
  const bitWidth = patternW / 64;
  
  for (let i = 0; i < 64; i++) {
    const bit = Math.sin(i * 0.5 + phase * 10) > 0 ? 1 : 0;
    ctx.fillStyle = bit ? COLORS.token : 'rgba(232, 121, 249, 0.2)';
    ctx.fillRect(hvX + 10 + i * bitWidth, patternY, bitWidth - 1, 15);
  }

  // Show bundling operation
  if (phase > 0.2) {
    const bundleX = 450;
    const bundleY = 80;
    
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(bundleX, bundleY, 280, 120, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.locMatch;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 13px "Space Grotesk", sans-serif';
    ctx.fillText('Bundling Operation (+)', bundleX + 15, bundleY + 22);

    ctx.font = '12px "Space Grotesk", monospace';
    ctx.fillStyle = COLORS.path1;
    ctx.fillText('V(cat)', bundleX + 20, bundleY + 50);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText('+', bundleX + 90, bundleY + 50);
    ctx.fillStyle = COLORS.path2;
    ctx.fillText('V(dog)', bundleX + 110, bundleY + 50);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText('+', bundleX + 180, bundleY + 50);
    ctx.fillStyle = COLORS.path3;
    ctx.fillText('V(bird)', bundleX + 200, bundleY + 50);

    // Result
    ctx.fillStyle = COLORS.muted;
    ctx.fillText('=', bundleX + 60, bundleY + 80);
    ctx.fillStyle = COLORS.locMatch;
    ctx.fillText('V(animals)', bundleX + 85, bundleY + 80);

    // Explanation
    ctx.fillStyle = COLORS.muted;
    ctx.font = '10px "Space Grotesk", sans-serif';
    ctx.fillText('Similar to all three inputs', bundleX + 20, bundleY + 105);
  }

  // Show binding operation
  if (phase > 0.4) {
    const bindX = 450;
    const bindY = 220;
    
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(bindX, bindY, 280, 100, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.displacement;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 13px "Space Grotesk", sans-serif';
    ctx.fillText('Binding Operation (⊗)', bindX + 15, bindY + 22);

    ctx.font = '12px "Space Grotesk", monospace';
    ctx.fillStyle = COLORS.vote;
    ctx.fillText('V(capital)', bindX + 20, bindY + 50);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText('⊗', bindX + 105, bindY + 50);
    ctx.fillStyle = COLORS.path1;
    ctx.fillText('V(France)', bindX + 125, bindY + 50);

    ctx.fillStyle = COLORS.muted;
    ctx.fillText('=', bindX + 60, bindY + 75);
    ctx.fillStyle = COLORS.displacement;
    ctx.fillText('V(capital-France)', bindX + 85, bindY + 75);
  }

  // Show semantic clustering on grid
  if (phase > 0.5) {
    const clusterX = 100;
    const clusterY = 200;
    
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(clusterX, clusterY, 280, 220, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.cellActive;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 13px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Semantic Clustering on Grid', clusterX + 15, clusterY + 22);

    // Draw mini grid with semantic clusters
    const miniGridX = clusterX + 20;
    const miniGridY = clusterY + 40;
    const miniSize = 30;
    const gridCells = 7;

    // Grid lines
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridCells; i++) {
      ctx.beginPath();
      ctx.moveTo(miniGridX + i * miniSize, miniGridY);
      ctx.lineTo(miniGridX + i * miniSize, miniGridY + gridCells * miniSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(miniGridX, miniGridY + i * miniSize);
      ctx.lineTo(miniGridX + gridCells * miniSize, miniGridY + i * miniSize);
      ctx.stroke();
    }

    // Animal cluster (green)
    const animalCluster = [
      { x: 2, y: 1, label: 'cat' },
      { x: 3, y: 1, label: 'dog' },
      { x: 2, y: 2, label: 'bird' },
      { x: 3, y: 2, label: 'fish' }
    ];

    const cityCluster = [
      { x: 5, y: 4, label: 'Paris' },
      { x: 6, y: 4, label: 'London' },
      { x: 5, y: 5, label: 'Tokyo' }
    ];

    const clusterAlpha = Math.min(1, (phase - 0.5) / 0.2);

    // Draw animal cluster
    ctx.fillStyle = `rgba(34, 197, 94, ${0.3 * clusterAlpha})`;
    ctx.beginPath();
    ctx.arc(miniGridX + 2.5 * miniSize, miniGridY + 1.5 * miniSize, 45, 0, Math.PI * 2);
    ctx.fill();

    animalCluster.forEach(item => {
      const px = miniGridX + (item.x + 0.5) * miniSize;
      const py = miniGridY + (item.y + 0.5) * miniSize;
      ctx.fillStyle = `rgba(34, 197, 94, ${clusterAlpha})`;
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 255, 255, ${clusterAlpha})`;
      ctx.font = '8px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, px, py + 3);
    });

    // Draw city cluster
    ctx.fillStyle = `rgba(139, 92, 246, ${0.3 * clusterAlpha})`;
    ctx.beginPath();
    ctx.arc(miniGridX + 5.5 * miniSize, miniGridY + 4.5 * miniSize, 40, 0, Math.PI * 2);
    ctx.fill();

    cityCluster.forEach(item => {
      const px = miniGridX + (item.x + 0.5) * miniSize;
      const py = miniGridY + (item.y + 0.5) * miniSize;
      ctx.fillStyle = `rgba(139, 92, 246, ${clusterAlpha})`;
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 255, 255, ${clusterAlpha})`;
      ctx.font = '8px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, px, py + 3);
    });
  }

  drawInfoBox(ctx, baseWidth - 200, 50, 'VSA Properties', [
    'High-dimensional (~1024-10000)',
    'Similarity = dot product',
    'Bundling = superposition',
    phase > 0.5 ? 'Similar → nearby on grid' : 'Binding = association'
  ]);

  drawLabel(ctx, baseWidth / 2, baseHeight - 25, 'VSA enables semantic addressing: similar meanings map to nearby grid locations.', 'highlight');
}

/**
 * Render Retrieval Scene - Grounded RAG
 */
export function renderRetrievalScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  // Query box at top
  const queryX = 60;
  const queryY = 60;
  
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.beginPath();
  ctx.roundRect(queryX, queryY, 340, 60, 8);
  ctx.fill();
  ctx.strokeStyle = COLORS.vote;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = COLORS.vote;
  ctx.font = 'bold 12px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Query', queryX + 15, queryY + 22);

  ctx.fillStyle = COLORS.text;
  ctx.font = '13px "Space Grotesk", sans-serif';
  ctx.fillText('"Where is Alice now?"', queryX + 70, queryY + 22);

  // Sub-query decomposition
  if (phase > 0.15) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = '10px "Space Grotesk", sans-serif';
    ctx.fillText('Decomposed: entity=Alice, predicate=location, time=now', queryX + 15, queryY + 45);
  }

  // Evidence chain visualization
  const evidenceStartY = 150;
  const boxWidth = 260;
  const boxHeight = 70;
  const boxSpacing = 90;

  const evidenceBoxes = [
    { 
      title: 'Fact 1 (Source: doc-42)', 
      content: 'Alice enters room_A @ t=100',
      color: COLORS.path1,
      showAt: 0.25
    },
    { 
      title: 'Fact 2 (Source: doc-43)', 
      content: 'Alice leaves room_A @ t=150',
      color: COLORS.path2,
      showAt: 0.4
    },
    { 
      title: 'Derived (Rule: movement)', 
      content: 'Alice.location = room_A (t<150)',
      color: COLORS.locMatch,
      showAt: 0.55
    }
  ];

  evidenceBoxes.forEach((box, i) => {
    if (phase < box.showAt) return;
    
    const alpha = Math.min(1, (phase - box.showAt) / 0.1);
    const boxX = 80 + i * (boxWidth + 30);
    const boxY = evidenceStartY;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
    ctx.fill();
    ctx.strokeStyle = box.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = box.color;
    ctx.font = 'bold 10px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(box.title, boxX + 10, boxY + 18);

    ctx.fillStyle = COLORS.text;
    ctx.font = '12px "Space Grotesk", monospace';
    ctx.fillText(box.content, boxX + 10, boxY + 42);

    // Draw arrow between boxes
    if (i > 0 && phase > box.showAt + 0.05) {
      const prevBoxX = 80 + (i - 1) * (boxWidth + 30);
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(prevBoxX + boxWidth + 5, boxY + boxHeight / 2);
      ctx.lineTo(boxX - 5, boxY + boxHeight / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrow head
      ctx.fillStyle = COLORS.muted;
      ctx.beginPath();
      ctx.moveTo(boxX - 5, boxY + boxHeight / 2);
      ctx.lineTo(boxX - 12, boxY + boxHeight / 2 - 5);
      ctx.lineTo(boxX - 12, boxY + boxHeight / 2 + 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

  // Final answer box
  if (phase > 0.7) {
    const answerX = 200;
    const answerY = 280;
    const alpha = Math.min(1, (phase - 0.7) / 0.15);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
    ctx.beginPath();
    ctx.roundRect(answerX, answerY, 500, 100, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.locMatch;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.locMatch;
    ctx.font = 'bold 14px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Answer', answerX + 15, answerY + 25);

    ctx.fillStyle = COLORS.text;
    ctx.font = '13px "Space Grotesk", sans-serif';
    ctx.fillText('"Alice was in room_A as of t=100, left at t=150"', answerX + 85, answerY + 25);

    ctx.fillStyle = COLORS.muted;
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.fillText('Confidence: 0.95 | Citations: [doc-42:L17, doc-43:L3]', answerX + 15, answerY + 50);
    ctx.fillText('Evidence chain: 2 source facts + 1 derived fact', answerX + 15, answerY + 70);

    // Verdict badge
    ctx.fillStyle = COLORS.locMatch;
    ctx.font = 'bold 12px "Space Grotesk", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('✓ SUPPORTED', answerX + 480, answerY + 85);
    ctx.globalAlpha = 1;
  }

  drawInfoBox(ctx, baseWidth - 200, 50, 'Grounded RAG', [
    'Query → sub-queries',
    'Retrieve with provenance',
    'Build evidence chain',
    phase > 0.7 ? 'Emit supported answer' : 'Aggregating...'
  ]);

  drawLabel(ctx, baseWidth / 2, baseHeight - 25, 'Every answer traces back to source facts with explicit evidence chains.', 'highlight');
}

/**
 * Render Conflict Scene - When Facts Disagree
 */
export function renderConflictScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  // Two conflicting source boxes
  const source1X = 60;
  const source2X = 450;
  const sourceY = 80;
  const sourceW = 300;
  const sourceH = 120;

  // Source A
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.beginPath();
  ctx.roundRect(source1X, sourceY, sourceW, sourceH, 8);
  ctx.fill();
  ctx.strokeStyle = COLORS.path1;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = COLORS.path1;
  ctx.font = 'bold 13px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Source A (news-2024-01)', source1X + 15, sourceY + 22);

  ctx.fillStyle = COLORS.text;
  ctx.font = '12px "Space Grotesk", monospace';
  ctx.fillText('company: "Acme Corp"', source1X + 20, sourceY + 50);
  ctx.fillText('ceo: "John Smith"', source1X + 20, sourceY + 70);
  ctx.fillText('timestamp: 2024-01-15', source1X + 20, sourceY + 90);

  // Source B
  if (phase > 0.2) {
    const alpha = Math.min(1, (phase - 0.2) / 0.15);
    ctx.globalAlpha = alpha;
    
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(source2X, sourceY, sourceW, sourceH, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.path2;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.path2;
    ctx.font = 'bold 13px "Space Grotesk", sans-serif';
    ctx.fillText('Source B (press-2024-03)', source2X + 15, sourceY + 22);

    ctx.fillStyle = COLORS.text;
    ctx.font = '12px "Space Grotesk", monospace';
    ctx.fillText('company: "Acme Corp"', source2X + 20, sourceY + 50);
    ctx.fillStyle = '#ef4444';
    ctx.fillText('ceo: "Jane Doe"', source2X + 20, sourceY + 70);
    ctx.fillStyle = COLORS.text;
    ctx.fillText('timestamp: 2024-03-20', source2X + 20, sourceY + 90);
    ctx.globalAlpha = 1;
  }

  // Conflict detection
  if (phase > 0.35) {
    const conflictY = 230;
    const alpha = Math.min(1, (phase - 0.35) / 0.15);

    ctx.globalAlpha = alpha;
    
    // Lightning bolt between sources
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(source1X + sourceW + 20, sourceY + sourceH / 2);
    ctx.lineTo(source1X + sourceW + 50, sourceY + sourceH / 2 - 15);
    ctx.lineTo(source1X + sourceW + 40, sourceY + sourceH / 2);
    ctx.lineTo(source1X + sourceW + 70, sourceY + sourceH / 2 + 15);
    ctx.stroke();

    // Conflict box
    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
    ctx.beginPath();
    ctx.roundRect(200, conflictY, 450, 80, 8);
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 14px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('⚠ CONFLICT DETECTED', 220, conflictY + 25);

    ctx.fillStyle = COLORS.text;
    ctx.font = '12px "Space Grotesk", sans-serif';
    ctx.fillText('Entity: Acme Corp | Predicate: ceo', 220, conflictY + 48);
    ctx.fillText('Source A says "John Smith" ≠ Source B says "Jane Doe"', 220, conflictY + 68);
    ctx.globalAlpha = 1;
  }

  // Resolution strategies
  if (phase > 0.55) {
    const resX = 100;
    const resY = 340;
    const alpha = Math.min(1, (phase - 0.55) / 0.2);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(resX, resY, 650, 100, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.vote;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.vote;
    ctx.font = 'bold 13px "Space Grotesk", sans-serif';
    ctx.fillText('Resolution Strategies', resX + 15, resY + 25);

    const strategies = [
      { label: 'Recency', value: 'Source B wins (newer)', color: COLORS.locMatch },
      { label: 'Credibility', value: 'Check source trust scores', color: COLORS.muted },
      { label: 'Voting', value: 'Other sources agree with...', color: COLORS.muted }
    ];

    strategies.forEach((strat, i) => {
      const stratX = resX + 20 + i * 210;
      ctx.fillStyle = strat.color;
      ctx.font = 'bold 11px "Space Grotesk", sans-serif';
      ctx.fillText(strat.label, stratX, resY + 50);
      ctx.fillStyle = COLORS.text;
      ctx.font = '10px "Space Grotesk", sans-serif';
      ctx.fillText(strat.value, stratX, resY + 68);
    });

    // Winner indication
    if (phase > 0.75) {
      ctx.fillStyle = COLORS.locMatch;
      ctx.font = 'bold 12px "Space Grotesk", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('→ Jane Doe (recency wins)', resX + 630, resY + 88);
    }
    ctx.globalAlpha = 1;
  }

  drawInfoBox(ctx, baseWidth - 200, 50, 'Conflict Resolution', [
    'Detect via pattern match',
    'Surface contradictions',
    'Apply resolution rules',
    phase > 0.75 ? 'Emit with confidence' : 'Evaluating...'
  ]);

  drawLabel(ctx, baseWidth / 2, baseHeight - 25, 'Conflicts are surfaced, not hidden. The system reports disagreements explicitly.', 'highlight');
}

/**
 * Render Derivation Scene - Building Knowledge
 */
export function renderDerivationScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  // Premises at top
  const premiseY = 70;
  const premiseH = 65;
  
  // Premise 1
  const p1X = 80;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.beginPath();
  ctx.roundRect(p1X, premiseY, 280, premiseH, 6);
  ctx.fill();
  ctx.strokeStyle = COLORS.path1;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = COLORS.path1;
  ctx.font = 'bold 11px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Premise 1 (fact)', p1X + 10, premiseY + 18);

  ctx.fillStyle = COLORS.text;
  ctx.font = '12px "Space Grotesk", monospace';
  ctx.fillText('parent(Alice, Bob)', p1X + 10, premiseY + 42);

  // Premise 2
  if (phase > 0.15) {
    const p2X = 400;
    const alpha = Math.min(1, (phase - 0.15) / 0.1);
    ctx.globalAlpha = alpha;
    
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(p2X, premiseY, 280, premiseH, 6);
    ctx.fill();
    ctx.strokeStyle = COLORS.path2;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.path2;
    ctx.font = 'bold 11px "Space Grotesk", sans-serif';
    ctx.fillText('Premise 2 (fact)', p2X + 10, premiseY + 18);

    ctx.fillStyle = COLORS.text;
    ctx.font = '12px "Space Grotesk", monospace';
    ctx.fillText('parent(Bob, Carol)', p2X + 10, premiseY + 42);
    ctx.globalAlpha = 1;
  }

  // Rule box
  if (phase > 0.3) {
    const ruleY = 170;
    const alpha = Math.min(1, (phase - 0.3) / 0.15);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
    ctx.beginPath();
    ctx.roundRect(180, ruleY, 500, 70, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.vote;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.vote;
    ctx.font = 'bold 13px "Space Grotesk", sans-serif';
    ctx.fillText('Rule: grandparent', 200, ruleY + 22);

    ctx.fillStyle = COLORS.text;
    ctx.font = '13px "Space Grotesk", monospace';
    ctx.fillText('IF parent(?X, ?Y) AND parent(?Y, ?Z)', 200, ruleY + 45);
    ctx.fillText('THEN grandparent(?X, ?Z)', 200, ruleY + 62);
    ctx.globalAlpha = 1;
  }

  // Unification arrows
  if (phase > 0.45) {
    const alpha = Math.min(1, (phase - 0.45) / 0.1);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = COLORS.displacement;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);

    // Arrow from premise 1 to rule
    ctx.beginPath();
    ctx.moveTo(220, premiseY + premiseH + 5);
    ctx.lineTo(300, 170);
    ctx.stroke();

    // Arrow from premise 2 to rule
    ctx.beginPath();
    ctx.moveTo(540, premiseY + premiseH + 5);
    ctx.lineTo(500, 170);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Bindings
  if (phase > 0.55) {
    const bindY = 265;
    const alpha = Math.min(1, (phase - 0.55) / 0.15);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(280, bindY, 300, 50, 6);
    ctx.fill();
    ctx.strokeStyle = COLORS.displacement;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.displacement;
    ctx.font = 'bold 12px "Space Grotesk", sans-serif';
    ctx.fillText('Bindings:', 295, bindY + 22);

    ctx.fillStyle = COLORS.text;
    ctx.font = '12px "Space Grotesk", monospace';
    ctx.fillText('?X=Alice, ?Y=Bob, ?Z=Carol', 375, bindY + 22);
    ctx.globalAlpha = 1;
  }

  // Derived fact
  if (phase > 0.7) {
    const derivedY = 340;
    const alpha = Math.min(1, (phase - 0.7) / 0.15);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
    ctx.beginPath();
    ctx.roundRect(200, derivedY, 460, 80, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.locMatch;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.locMatch;
    ctx.font = 'bold 14px "Space Grotesk", sans-serif';
    ctx.fillText('✓ Derived Fact', 220, derivedY + 25);

    ctx.fillStyle = COLORS.text;
    ctx.font = '14px "Space Grotesk", monospace';
    ctx.fillText('grandparent(Alice, Carol)', 220, derivedY + 50);

    ctx.fillStyle = COLORS.muted;
    ctx.font = '10px "Space Grotesk", sans-serif';
    ctx.fillText('Lineage: rule=grandparent, premises=[P1, P2], bindings={X→Alice, Y→Bob, Z→Carol}', 220, derivedY + 70);
    ctx.globalAlpha = 1;
  }

  drawInfoBox(ctx, baseWidth - 200, 50, 'Derivation Chain', [
    'Premises = source facts',
    'Rules = inference templates',
    'Unification binds variables',
    phase > 0.7 ? 'Lineage is preserved' : 'Deriving...'
  ]);

  drawLabel(ctx, baseWidth / 2, baseHeight - 25, 'Derivation chains are explicit. Ask "why?" and get the full reasoning path.', 'highlight');
}

/**
 * Render Entities Scene - Entity Resolution
 */
export function renderEntitiesScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  // Scattered mentions at top
  const mentionY = 80;
  const mentions = [
    { x: 60, text: '"Dr. Smith"', source: 'doc-1', color: COLORS.path1 },
    { x: 220, text: '"John Smith"', source: 'doc-2', color: COLORS.path2 },
    { x: 400, text: '"J. Smith, PhD"', source: 'doc-3', color: COLORS.path3 },
    { x: 580, text: '"Professor Smith"', source: 'doc-4', color: COLORS.path4 }
  ];

  mentions.forEach((m, i) => {
    const showAt = i * 0.08;
    if (phase < showAt) return;
    
    const alpha = Math.min(1, (phase - showAt) / 0.1);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(m.x, mentionY, 140, 55, 6);
    ctx.fill();
    ctx.strokeStyle = m.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = m.color;
    ctx.font = '10px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(m.source, m.x + 8, mentionY + 15);

    ctx.fillStyle = COLORS.text;
    ctx.font = '12px "Space Grotesk", monospace';
    ctx.fillText(m.text, m.x + 8, mentionY + 38);
    ctx.globalAlpha = 1;
  });

  // Context similarity detection
  if (phase > 0.35) {
    const simY = 160;
    const alpha = Math.min(1, (phase - 0.35) / 0.15);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(150, simY, 550, 60, 6);
    ctx.fill();
    ctx.strokeStyle = COLORS.vote;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.vote;
    ctx.font = 'bold 12px "Space Grotesk", sans-serif';
    ctx.fillText('Context Similarity Analysis', 170, simY + 22);

    ctx.fillStyle = COLORS.text;
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.fillText('All mentions: affiliated with "MIT", field = "Computer Science", role = "Professor"', 170, simY + 45);
    ctx.globalAlpha = 1;
  }

  // Merging arrows
  if (phase > 0.5) {
    const alpha = Math.min(1, (phase - 0.5) / 0.15);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = COLORS.displacement;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);

    const targetY = 280;
    const targetX = baseWidth / 2;

    mentions.forEach(m => {
      ctx.beginPath();
      ctx.moveTo(m.x + 70, mentionY + 60);
      ctx.quadraticCurveTo(m.x + 70, targetY - 40, targetX, targetY);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Canonical entity
  if (phase > 0.65) {
    const canonY = 270;
    const alpha = Math.min(1, (phase - 0.65) / 0.15);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
    ctx.beginPath();
    ctx.roundRect(220, canonY, 420, 100, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.locMatch;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = COLORS.locMatch;
    ctx.font = 'bold 14px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Canonical Entity: PERSON-0042', 240, canonY + 25);

    ctx.fillStyle = COLORS.text;
    ctx.font = '12px "Space Grotesk", monospace';
    ctx.fillText('name: "John Smith"', 240, canonY + 50);
    ctx.fillText('aliases: ["Dr. Smith", "J. Smith, PhD", "Professor Smith"]', 240, canonY + 70);
    ctx.fillText('references: [doc-1, doc-2, doc-3, doc-4]', 240, canonY + 90);
    ctx.globalAlpha = 1;
  }

  // Cross-reference tracking
  if (phase > 0.8) {
    const xrefY = 400;
    const alpha = Math.min(1, (phase - 0.8) / 0.15);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(250, xrefY, 360, 50, 6);
    ctx.fill();
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = COLORS.muted;
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.fillText('Cross-reference Index:', 270, xrefY + 20);
    ctx.fillStyle = COLORS.text;
    ctx.fillText('"Dr. Smith" → PERSON-0042 (confidence: 0.94)', 270, xrefY + 38);
    ctx.globalAlpha = 1;
  }

  drawInfoBox(ctx, baseWidth - 200, 50, 'Entity Resolution', [
    'Detect aliases via context',
    'Assign canonical IDs',
    'Track cross-references',
    phase > 0.8 ? 'Unified knowledge graph' : 'Resolving...'
  ]);

  drawLabel(ctx, baseWidth / 2, baseHeight - 25, 'Entity resolution unifies scattered mentions into coherent knowledge.', 'highlight');
}
