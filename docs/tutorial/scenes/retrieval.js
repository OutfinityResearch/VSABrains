/**
 * Scene renderer: Retrieval
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from '../config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from '../drawing.js';

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

}

/**
 * Render Verdicts Scene - Answer contract categories
 */
