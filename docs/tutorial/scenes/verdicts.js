/**
 * Scene renderer: Verdicts
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from '../config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from '../drawing.js';

/**
 * Render Verdicts Scene - Answer contract categories
 */
export function renderVerdictsScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  const segment = Math.min(2, Math.floor(phase * 3));
  const local = (phase * 3) - segment;
  const modes = ['supported', 'conflicting', 'unsupported'];
  const mode = modes[segment];

  const palette = {
    supported: COLORS.locMatch,
    conflicting: COLORS.displacement,
    unsupported: COLORS.muted
  };

  // Query box
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.beginPath();
  ctx.roundRect(60, 55, 520, 58, 10);
  ctx.fill();
  ctx.strokeStyle = COLORS.vote;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = COLORS.vote;
  ctx.font = 'bold 12px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Question', 78, 78);
  ctx.fillStyle = COLORS.text;
  ctx.font = '13px "Space Grotesk", sans-serif';
  ctx.fillText('"Where is Alice right now?"', 160, 78);

  // Evidence cards
  const cardY = 150;
  const cardW = 330;
  const cardH = 86;

  const cardsByMode = {
    supported: [
      { title: 'Fact (doc-12)', text: 'Alice enters kitchen @ t=200', color: COLORS.path1 },
      { title: 'Fact (doc-13)', text: 'No later movement found', color: COLORS.path2 }
    ],
    conflicting: [
      { title: 'Claim A (doc-12)', text: 'Alice.location = kitchen @ t=200', color: COLORS.path1 },
      { title: 'Claim B (doc-99)', text: 'Alice.location = lab @ t=200', color: COLORS.path4 }
    ],
    unsupported: [
      { title: 'Retrieval', text: 'No matching facts for entity=Alice', color: COLORS.muted },
      { title: 'Result', text: 'Evidence is insufficient to answer', color: COLORS.muted }
    ]
  };

  const cards = cardsByMode[mode];
  cards.forEach((card, idx) => {
    const showAt = 0.15 + idx * 0.2;
    if (local < showAt) return;
    const alpha = Math.min(1, (local - showAt) / 0.2);
    ctx.globalAlpha = alpha;

    const x = 90 + idx * (cardW + 40);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(x, cardY, cardW, cardH, 10);
    ctx.fill();
    ctx.strokeStyle = card.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = card.color;
    ctx.font = 'bold 11px "Space Grotesk", sans-serif';
    ctx.fillText(card.title, x + 14, cardY + 26);
    ctx.fillStyle = COLORS.text;
    ctx.font = '12px "Space Grotesk", monospace';
    ctx.fillText(card.text, x + 14, cardY + 54);

    ctx.globalAlpha = 1;
  });

  // Verdict chips
  const chipY = 290;
  const chipX = 80;
  const chipW = 200;
  const chipH = 44;
  const chipGap = 18;

  const chipOrder = [
    { id: 'supported', label: 'SUPPORTED', color: palette.supported },
    { id: 'conflicting', label: 'CONFLICTING', color: palette.conflicting },
    { id: 'unsupported', label: 'UNSUPPORTED', color: palette.unsupported }
  ];

  chipOrder.forEach((chip, idx) => {
    const x = chipX + idx * (chipW + chipGap);
    const active = chip.id === mode;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(x, chipY, chipW, chipH, 999);
    ctx.fill();

    ctx.strokeStyle = active ? chip.color : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = active ? 2.5 : 1;
    ctx.stroke();

    ctx.fillStyle = chip.color;
    ctx.font = 'bold 12px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(chip.label, x + chipW / 2, chipY + 28);
    ctx.textAlign = 'left';
  });

  // Explanation box
  const hint = {
    supported: 'Evidence chain fully backs the claim',
    conflicting: 'Credible evidence disagrees on the value',
    unsupported: 'Not enough evidence to answer safely'
  }[mode];

  drawInfoBox(ctx, baseWidth - 200, 50, 'Answer Contract', [
    'Never guess',
    'Always show provenance',
    hint,
    'Verdict is explicit'
  ]);
}

/**
 * Render Conflict Scene - When Facts Disagree
 */
