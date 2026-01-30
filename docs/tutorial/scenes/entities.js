/**
 * Scene renderer: Entities
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from '../config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from '../drawing.js';

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

}

/**
 * Render Knobs Scene - Visualize tunable parameters and their tradeoffs
 */
