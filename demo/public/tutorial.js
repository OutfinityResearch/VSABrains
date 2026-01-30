/**
 * Thousand Brains Tutorial - Grid-Based Path Visualization
 * Based on VSABrains: Column, GridMap, Displacement
 * 
 * Key concepts:
 * - Columns maintain location (x,y) on a 2D grid
 * - Each step: write token at location → compute displacement → move
 * - Paths through space = memory formation
 * - Multiple columns = parallel models that vote
 */

const canvas = document.getElementById('tutorialCanvas');
const ctx = canvas.getContext('2d');
const playBtn = document.getElementById('tutorialPlay');
const pauseBtn = document.getElementById('tutorialPause');
const nextBtn = document.getElementById('tutorialNext');
const speedInput = document.getElementById('tutorialSpeed');
const speedValue = document.getElementById('tutorialSpeedValue');
const speedHint = document.getElementById('tutorialSpeedHint');
const stepsContainer = document.getElementById('tutorialSteps');

const sceneTitle = document.getElementById('sceneTitle');
const sceneSummary = document.getElementById('sceneSummary');
const sceneBullets = document.getElementById('sceneBullets');
const sceneKey = document.getElementById('sceneKey');
const sceneSignals = document.getElementById('sceneSignals');

// High-DPI canvas setup
const dpr = window.devicePixelRatio || 1;
const baseWidth = canvas.width;
const baseHeight = canvas.height;
canvas.width = Math.floor(baseWidth * dpr);
canvas.height = Math.floor(baseHeight * dpr);
ctx.scale(dpr, dpr);

// Colors
const COLORS = {
  bg: '#0f172a',
  grid: 'rgba(99, 102, 241, 0.15)',
  gridLine: 'rgba(99, 102, 241, 0.25)',
  cell: 'rgba(99, 102, 241, 0.3)',
  cellActive: '#818cf8',
  cellHighlight: '#a5b4fc',

  // Paths for different columns
  path1: '#f472b6',
  path2: '#22d3ee',
  path3: '#4ade80',
  path4: '#fbbf24',

  token: '#e879f9',
  tokenFade: 'rgba(232, 121, 249, 0.3)',

  displacement: '#f97316',
  displacementArrow: '#fb923c',

  locMatch: '#22c55e',
  locMatchFade: 'rgba(34, 197, 94, 0.2)',

  vote: '#8b5cf6',
  voteWin: '#22c55e',

  text: '#e2e8f0',
  muted: 'rgba(226, 232, 240, 0.5)',
  textDark: 'rgba(0, 0, 0, 0.7)'
};

// Scene definitions
const SCENES = [
  {
    id: 'grid',
    title: 'The Grid - Where Memory Lives',
    summary: 'Memory is stored in a 2D grid. Each cell can hold multiple tokens. As the column moves through the grid, it writes tokens at each location it visits.',
    bullets: [
      'Grid is 64×64 cells (we show a zoomed portion)',
      'Each cell holds top-K tokens (like a mini-memory)',
      'Writing tokens = forming memories',
      'Location + token = addressable content'
    ],
    key: 'The grid is a 2D address space. Tokens at locations form the memory substrate.',
    signals: ['cell write', 'token storage', 'grid location'],
    duration: 9
  },
  {
    id: 'displacement',
    title: 'Displacement - Context Determines Movement',
    summary: 'Movement through the grid isn\'t random. The last N tokens are hashed to compute (dx, dy). Same context → same displacement. Different context → different path.',
    bullets: [
      'Hash recent tokens → displacement vector',
      'Context window = 2 tokens',
      'Max step = ±3 cells in each direction',
      'Deterministic: same input → same path'
    ],
    key: 'Movement is determined by content. Similar sequences follow similar paths.',
    signals: ['context hash', 'dx/dy vector', 'path determinism'],
    duration: 9
  },
  {
    id: 'path',
    title: 'A Path Through Space',
    summary: 'A column traces a path through the grid as it processes tokens. At each step: (1) write tokens at current location, (2) compute displacement, (3) move. The path IS the representation.',
    bullets: [
      'Each step: write then move',
      'Path = sequence of (location, token) pairs',
      'The trajectory encodes the sequence order',
      'Time becomes space'
    ],
    key: 'Sequences are stored as paths. The trajectory through space IS the memory.',
    signals: ['path trace', 'step sequence', 'spatial encoding'],
    duration: 9
  },
  {
    id: 'multicolumn',
    title: 'Multiple Columns, Different Views',
    summary: 'Multiple columns process the same input but start at different locations. They trace different paths but create correlated patterns. Each column is an independent "witness".',
    bullets: [
      'Same tokens, different starting offsets',
      'Paths differ but have similar structure',
      'Each column = independent model',
      'Redundancy enables robust consensus'
    ],
    key: 'Many columns = many perspectives on the same sequence.',
    signals: ['column offsets', 'parallel paths', 'multi-model'],
    duration: 9
  },
  {
    id: 'localization',
    title: 'Localization - Finding Where You Are',
    summary: 'Given a context window, localization finds matching locations in the stored grid. It returns candidate positions with confidence scores. This is how the system "remembers" where it was.',
    bullets: [
      'Query: recent token window',
      'Search: find cells with matching tokens',
      'Result: candidate locations + scores',
      'Enables: replay from any point'
    ],
    key: 'Localization = pattern matching on the grid to find stored contexts.',
    signals: ['query window', 'candidate cells', 'match score'],
    duration: 9
  },
  {
    id: 'voting',
    title: 'Voting & Consensus',
    summary: 'Each column proposes a location. Through lateral connections, columns share beliefs and converge on the most-supported answer. Majority wins, conflicts are detected.',
    bullets: [
      'Each column: "I think we\'re at X"',
      'Columns share via lateral connections',
      'Votes accumulate for each candidate',
      'Winner = highest vote count'
    ],
    key: 'Consensus: independent models voting produces robust answers.',
    signals: ['candidate votes', 'lateral share', 'consensus winner'],
    duration: 9
  },
  {
    id: 'branching',
    title: 'Branching Paths & Complexity',
    summary: 'Paths can branch when contexts match multiple stored patterns. The system maintains multiple hypotheses until evidence disambiguates. This handles ambiguity gracefully.',
    bullets: [
      'Ambiguous context → multiple matches',
      'Branches represent alternative hypotheses',
      'New evidence prunes unlikely branches',
      'Checkpoints enable efficient replay'
    ],
    key: 'Branching paths = multiple hypotheses maintained until evidence decides.',
    signals: ['branch point', 'hypothesis', 'disambiguation'],
    duration: 9
  },
  {
    id: 'prediction',
    title: 'Prediction Loop - Anticipate Before Observe',
    summary: 'Columns predict the next token BEFORE receiving input. When the actual token arrives, prediction error signals learning. This is core to Thousand Brains: predict, observe, update.',
    bullets: [
      'Each column predicts next token at current location',
      'Prediction comes from GridMap top-K at (x, y)',
      'Actual token arrives → compute prediction error',
      'Error drives learning and hypothesis pruning'
    ],
    key: 'The system anticipates before it observes. Prediction error is the learning signal.',
    signals: ['predict', 'observe', 'error', 'update'],
    duration: 9
  },
  {
    id: 'heavyhitters',
    title: 'Heavy-Hitters - Bounded Memory per Cell',
    summary: 'Each grid cell can only store K tokens (e.g., K=4). When a 5th token arrives, the least frequent is evicted. This prevents cells from becoming "muddy" with too many tokens.',
    bullets: [
      'Each cell keeps top-K tokens by frequency',
      'New token: increment count or evict minimum',
      'Prevents unbounded memory per cell',
      'Quality degrades gracefully under saturation'
    ],
    key: 'Heavy-hitters keep cells focused. Eviction prevents muddiness.',
    signals: ['top-K', 'eviction', 'saturation', 'frequency'],
    duration: 9
  },
  {
    id: 'replay',
    title: 'Replay & Checkpoints',
    summary: 'To answer a query about past state, the system replays from a checkpoint. Checkpoints save column positions and displacement buffers. Replay reconstructs state deterministically.',
    bullets: [
      'Checkpoint = saved column positions + buffers',
      'Replay = apply events from checkpoint to target',
      'State is reconstructed, not stored',
      'Trade-off: checkpoint frequency vs replay cost'
    ],
    key: 'State is not stored directly—it is reconstructed by replay from checkpoints.',
    signals: ['checkpoint', 'replay', 'state reconstruction'],
    duration: 9
  },
  {
    id: 'slowmaps',
    title: 'Slow Maps - Multi-Timescale Memory',
    summary: 'Fast maps write every step. Slow maps write summaries every N steps (e.g., N=10). This mirrors cortical hierarchy: higher levels process at slower timescales.',
    bullets: [
      'Fast map: writes every step (detailed)',
      'Slow map: writes summary every N steps (abstract)',
      'Summaries capture entities, predicates, trends',
      'Enables efficient long-range retrieval'
    ],
    key: 'Multiple timescales: fast for detail, slow for abstraction.',
    signals: ['fast map', 'slow map', 'window summary', 'timescale'],
    duration: 9
  },
  {
    id: 'reasoning',
    title: 'Work Signatures - Auditable Reasoning',
    summary: 'For auditable reasoning, facts are stored as role→value maps (Work Signatures). Pattern matching with variables (?x) enables rule-based inference with explicit bindings.',
    bullets: [
      'Fact = { subject, predicate, object }',
      'Pattern = signature with variables (?x)',
      'Unification binds variables to values',
      'Chains form auditable derivations'
    ],
    key: 'Reasoning is explicit and inspectable. No hidden vectors, just bindings.',
    signals: ['WorkSignature', 'unification', 'binding', 'derivation'],
    duration: 9
  }
];

const TOTAL_DURATION = SCENES.reduce((acc, s) => acc + s.duration, 0);

// Animation state
let playing = true;
let lastTime = performance.now();
let timeline = 0;
let speed = sliderToSpeed(Number(speedInput.value));

// Precomputed paths for visualization
const GRID_VIEW = { startX: 10, startY: 10, size: 12 }; // 12x12 visible portion
const CELL_SIZE = 38;
const GRID_OFFSET = { x: 60, y: 50 };

// Generate sample paths
function generatePath(startX, startY, tokens, seed) {
  const path = [{ x: startX, y: startY, token: tokens[0] }];
  let x = startX, y = startY;

  for (let i = 1; i < tokens.length; i++) {
    // Simple hash-like displacement
    const hash = (tokens[i] * 31 + tokens[i - 1] * 17 + seed) >>> 0;
    const dx = (hash % 7) - 3;
    const dy = ((hash >>> 8) % 7) - 3;

    x = ((x + dx) % 64 + 64) % 64;
    y = ((y + dy) % 64 + 64) % 64;

    path.push({ x, y, token: tokens[i], dx, dy });
  }
  return path;
}

// Sample token sequence
const TOKENS = [42, 17, 89, 23, 56, 78, 34, 91, 45, 12, 67, 88, 33, 55, 77, 99, 11, 44, 66, 22];

// Generate paths for multiple columns
const PATHS = [
  generatePath(15, 14, TOKENS, 0),
  generatePath(18, 16, TOKENS, 100),
  generatePath(13, 18, TOKENS, 200)
];

// ==================== DRAWING FUNCTIONS ====================

function drawGridBackground() {
  // Background
  const gradient = ctx.createRadialGradient(baseWidth / 2, baseHeight / 2, 0, baseWidth / 2, baseHeight / 2, baseWidth);
  gradient.addColorStop(0, '#1e293b');
  gradient.addColorStop(1, COLORS.bg);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, baseWidth, baseHeight);
}

function drawGrid(highlightCells = [], activeCell = null, showTokens = false) {
  const { startX, startY, size } = GRID_VIEW;

  // Draw cells
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const gx = startX + col;
      const gy = startY + row;
      const px = GRID_OFFSET.x + col * CELL_SIZE;
      const py = GRID_OFFSET.y + row * CELL_SIZE;

      // Cell background
      const isHighlighted = highlightCells.some(c => c.x === gx && c.y === gy);
      const isActive = activeCell && activeCell.x === gx && activeCell.y === gy;

      if (isActive) {
        ctx.fillStyle = COLORS.cellActive;
        ctx.shadowColor = COLORS.cellActive;
        ctx.shadowBlur = 15;
      } else if (isHighlighted) {
        ctx.fillStyle = COLORS.cellHighlight;
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = COLORS.cell;
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.roundRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2, 4);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw tokens in cell if requested
      if (showTokens && isHighlighted) {
        const cellTokens = highlightCells.find(c => c.x === gx && c.y === gy)?.tokens || [];
        drawCellTokens(px, py, cellTokens);
      }
    }
  }

  // Grid lines
  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth = 1;

  for (let i = 0; i <= size; i++) {
    // Vertical
    ctx.beginPath();
    ctx.moveTo(GRID_OFFSET.x + i * CELL_SIZE, GRID_OFFSET.y);
    ctx.lineTo(GRID_OFFSET.x + i * CELL_SIZE, GRID_OFFSET.y + size * CELL_SIZE);
    ctx.stroke();

    // Horizontal
    ctx.beginPath();
    ctx.moveTo(GRID_OFFSET.x, GRID_OFFSET.y + i * CELL_SIZE);
    ctx.lineTo(GRID_OFFSET.x + size * CELL_SIZE, GRID_OFFSET.y + i * CELL_SIZE);
    ctx.stroke();
  }

  // Axis labels
  ctx.fillStyle = COLORS.muted;
  ctx.font = '10px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';

  for (let i = 0; i < size; i += 2) {
    // X axis
    ctx.fillText(String(startX + i), GRID_OFFSET.x + i * CELL_SIZE + CELL_SIZE / 2, GRID_OFFSET.y - 8);
    // Y axis
    ctx.textAlign = 'right';
    ctx.fillText(String(startY + i), GRID_OFFSET.x - 8, GRID_OFFSET.y + i * CELL_SIZE + CELL_SIZE / 2 + 3);
    ctx.textAlign = 'center';
  }
}

function drawCellTokens(px, py, tokens) {
  const maxTokens = 4;
  const tokenSize = 6;
  const positions = [
    { dx: 8, dy: 10 },
    { dx: 22, dy: 10 },
    { dx: 8, dy: 24 },
    { dx: 22, dy: 24 }
  ];

  tokens.slice(0, maxTokens).forEach((token, i) => {
    ctx.fillStyle = COLORS.token;
    ctx.beginPath();
    ctx.arc(px + positions[i].dx, py + positions[i].dy, tokenSize, 0, Math.PI * 2);
    ctx.fill();

    // Token value
    ctx.fillStyle = COLORS.textDark;
    ctx.font = 'bold 7px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(token % 100), px + positions[i].dx, py + positions[i].dy);
  });
}

function gridToPixel(gx, gy) {
  const { startX, startY } = GRID_VIEW;
  return {
    x: GRID_OFFSET.x + (gx - startX) * CELL_SIZE + CELL_SIZE / 2,
    y: GRID_OFFSET.y + (gy - startY) * CELL_SIZE + CELL_SIZE / 2
  };
}

function isInView(gx, gy) {
  const { startX, startY, size } = GRID_VIEW;
  return gx >= startX && gx < startX + size && gy >= startY && gy < startY + size;
}

function drawPath(path, color, progress, showDisplacement = false) {
  const visibleSteps = Math.floor(progress * path.length);
  if (visibleSteps < 1) return;

  // Draw path line
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  let started = false;

  for (let i = 0; i < visibleSteps && i < path.length; i++) {
    const point = path[i];
    if (!isInView(point.x, point.y)) continue;

    const { x, y } = gridToPixel(point.x, point.y);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // Draw points on path
  for (let i = 0; i < visibleSteps && i < path.length; i++) {
    const point = path[i];
    if (!isInView(point.x, point.y)) continue;

    const { x, y } = gridToPixel(point.x, point.y);
    const isCurrent = i === visibleSteps - 1;

    ctx.beginPath();
    ctx.fillStyle = isCurrent ? '#fff' : color;
    ctx.shadowColor = isCurrent ? '#fff' : 'transparent';
    ctx.shadowBlur = isCurrent ? 12 : 0;
    ctx.arc(x, y, isCurrent ? 8 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Step number
    if (isCurrent || i === 0) {
      ctx.fillStyle = COLORS.textDark;
      ctx.font = 'bold 9px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i), x, y);
    }

    // Displacement arrow
    if (showDisplacement && i > 0 && i === visibleSteps - 1 && point.dx !== undefined) {
      drawDisplacementArrow(x, y, point.dx, point.dy);
    }
  }
}

function drawDisplacementArrow(x, y, dx, dy) {
  const arrowLen = 25;
  const angle = Math.atan2(dy, dx);
  const endX = x + Math.cos(angle) * arrowLen;
  const endY = y + Math.sin(angle) * arrowLen;

  // Arrow line
  ctx.strokeStyle = COLORS.displacement;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 2]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrow head
  const headLen = 8;
  ctx.fillStyle = COLORS.displacement;
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - headLen * Math.cos(angle - 0.4), endY - headLen * Math.sin(angle - 0.4));
  ctx.lineTo(endX - headLen * Math.cos(angle + 0.4), endY - headLen * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();

  // Label
  ctx.fillStyle = COLORS.text;
  ctx.font = '11px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`(${dx >= 0 ? '+' : ''}${dx}, ${dy >= 0 ? '+' : ''}${dy})`, endX + 20, endY);
}

function drawLocalizationMatch(candidates, phase) {
  candidates.forEach((cand, idx) => {
    if (!isInView(cand.x, cand.y)) return;

    const { x, y } = gridToPixel(cand.x, cand.y);
    const pulse = 1 + Math.sin(phase * Math.PI * 4 + idx) * 0.2;

    // Match circle
    ctx.strokeStyle = COLORS.locMatch;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 18 * pulse, 0, Math.PI * 2);
    ctx.stroke();

    // Confidence score
    ctx.fillStyle = COLORS.locMatch;
    ctx.font = 'bold 11px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${(cand.score * 100).toFixed(0)}%`, x, y + 32);
  });
}

function drawVotingCircle(columns, votes, winnerIdx, phase) {
  const centerX = baseWidth - 150;
  const centerY = baseHeight / 2;
  const radius = 80;

  // Background circle
  ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + 20, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Column positions
  columns.forEach((col, idx) => {
    const angle = (idx / columns.length) * Math.PI * 2 - Math.PI / 2;
    const cx = centerX + Math.cos(angle) * radius;
    const cy = centerY + Math.sin(angle) * radius;

    const isWinner = idx === winnerIdx;

    // Column circle
    ctx.fillStyle = isWinner ? COLORS.voteWin : col.color;
    ctx.shadowColor = isWinner ? COLORS.voteWin : 'transparent';
    ctx.shadowBlur = isWinner ? 15 : 0;
    ctx.beginPath();
    ctx.arc(cx, cy, isWinner ? 18 : 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Vote count
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(votes[idx]), cx, cy);

    // Column label
    ctx.fillStyle = COLORS.muted;
    ctx.font = '10px "Space Grotesk", sans-serif';
    ctx.fillText(`C${idx + 1}`, cx, cy + 28);
  });

  // Center consensus
  if (winnerIdx >= 0 && phase > 0.6) {
    ctx.fillStyle = COLORS.voteWin;
    ctx.shadowColor = COLORS.voteWin;
    ctx.shadowBlur = 20;
    ctx.font = 'bold 28px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✓', centerX, centerY);
    ctx.shadowBlur = 0;

    ctx.fillStyle = COLORS.text;
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.fillText('Consensus', centerX, centerY + 25);
  }
}

function drawContextWindow(tokens, idx, x, y) {
  const windowSize = 2;
  const start = Math.max(0, idx - windowSize + 1);
  const windowTokens = tokens.slice(start, idx + 1);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.beginPath();
  ctx.roundRect(x - 50, y - 15, 100, 50, 8);
  ctx.fill();

  ctx.strokeStyle = COLORS.displacement;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = COLORS.muted;
  ctx.font = '10px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Context Window', x, y);

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 14px "Space Grotesk", sans-serif';
  ctx.fillText(`[${windowTokens.join(', ')}]`, x, y + 20);
}

function drawBranchingPath(paths, phase) {
  // Main path
  const mainPath = paths[0];
  const branchPoint = 8;

  // Draw main path up to branch point
  ctx.strokeStyle = COLORS.path1;
  ctx.lineWidth = 3;
  ctx.beginPath();

  for (let i = 0; i < branchPoint && i < mainPath.length; i++) {
    const { x, y } = gridToPixel(mainPath[i].x, mainPath[i].y);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Draw branch point marker
  if (phase > 0.3) {
    const bp = mainPath[branchPoint];
    if (isInView(bp.x, bp.y)) {
      const { x, y } = gridToPixel(bp.x, bp.y);
      const pulse = 1 + Math.sin(phase * 8) * 0.15;

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 15 * pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = COLORS.text;
      ctx.font = '10px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Branch', x, y - 25);
    }
  }

  // Draw branches after branch point
  if (phase > 0.5) {
    const branchPhase = (phase - 0.5) / 0.5;
    const visibleAfterBranch = Math.floor(branchPhase * (mainPath.length - branchPoint));

    // Branch 1 (original path)
    ctx.strokeStyle = COLORS.path1;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    for (let i = branchPoint; i < branchPoint + visibleAfterBranch && i < mainPath.length; i++) {
      const { x, y } = gridToPixel(mainPath[i].x, mainPath[i].y);
      if (i === branchPoint) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Branch 2 (alternative)
    if (paths[1]) {
      ctx.strokeStyle = COLORS.path2;
      ctx.beginPath();
      for (let i = branchPoint; i < branchPoint + visibleAfterBranch && i < paths[1].length; i++) {
        const { x, y } = gridToPixel(paths[1][i].x, paths[1][i].y);
        if (i === branchPoint) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // Labels
  if (phase > 0.7) {
    ctx.fillStyle = COLORS.path1;
    ctx.font = '10px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Hypothesis A', baseWidth - 140, 80);

    ctx.fillStyle = COLORS.path2;
    ctx.fillText('Hypothesis B', baseWidth - 140, 100);
  }
}

function drawLabel(x, y, text, style = 'normal', align = 'center') {
  ctx.fillStyle = style === 'highlight' ? COLORS.text : COLORS.muted;
  ctx.font = style === 'highlight' ? 'bold 13px "Space Grotesk", sans-serif' : '12px "Space Grotesk", sans-serif';
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

function drawInfoBox(x, y, title, lines) {
  const padding = 12;
  const lineHeight = 18;
  const width = 180;
  const height = padding * 2 + lineHeight * (lines.length + 1);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 8);
  ctx.fill();

  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 12px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, x + padding, y + padding + 12);

  ctx.fillStyle = COLORS.muted;
  ctx.font = '11px "Space Grotesk", sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, x + padding, y + padding + 12 + (i + 1) * lineHeight);
  });
}

// ==================== SCENE RENDERERS ====================

function renderGridScene(phase) {
  drawGridBackground();

  // Highlight some cells with tokens
  const highlightedCells = [
    { x: 12, y: 12, tokens: [42, 17] },
    { x: 14, y: 13, tokens: [89, 23, 56] },
    { x: 15, y: 15, tokens: [78] },
    { x: 13, y: 16, tokens: [34, 91, 45, 12] }
  ];

  // Active cell animates
  const activeIdx = Math.floor(phase * 4) % highlightedCells.length;
  const activeCell = highlightedCells[activeIdx];

  drawGrid(highlightedCells, activeCell, true);

  // Info box
  drawInfoBox(baseWidth - 200, 50, 'Grid Cell', [
    'Stores top-K tokens',
    'Each write adds to cell',
    'Location = address'
  ]);

  // Animated write indicator
  const { x, y } = gridToPixel(activeCell.x, activeCell.y);
  const pulse = Math.sin(phase * Math.PI * 6) * 0.5 + 0.5;

  ctx.strokeStyle = `rgba(232, 121, 249, ${pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 22 + pulse * 5, 0, Math.PI * 2);
  ctx.stroke();

  drawLabel(x, y - 35, 'Writing token...', 'highlight');

  // Title
  drawLabel(baseWidth / 2, baseHeight - 25, 'Memory = tokens written at locations in a 2D grid', 'highlight');
}

function renderDisplacementScene(phase) {
  drawGridBackground();
  drawGrid([], null, false);

  const path = PATHS[0];
  const stepIdx = Math.floor(phase * (path.length - 1));
  const currentStep = path[stepIdx];

  // Draw partial path
  drawPath(path, COLORS.path1, (stepIdx + 1) / path.length, true);

  // Show context window
  if (stepIdx > 0) {
    drawContextWindow(TOKENS, stepIdx, baseWidth - 120, baseHeight - 80);
  }

  // Info about displacement
  if (currentStep && currentStep.dx !== undefined) {
    drawInfoBox(baseWidth - 200, 50, 'Displacement', [
      `Context: [${TOKENS[Math.max(0, stepIdx - 1)]}, ${TOKENS[stepIdx]}]`,
      `Hash → (dx, dy)`,
      `Move: (${currentStep.dx}, ${currentStep.dy})`
    ]);
  }

  drawLabel(baseWidth / 2, baseHeight - 25, 'Context tokens are hashed to compute displacement vector', 'highlight');
}

function renderPathScene(phase) {
  drawGridBackground();

  const path = PATHS[0];
  const visibleCells = path.slice(0, Math.floor(phase * path.length)).map(p => ({ x: p.x, y: p.y, tokens: [p.token] }));

  drawGrid(visibleCells, null, true);
  drawPath(path, COLORS.path1, phase, false);

  // Step counter
  const stepCount = Math.floor(phase * path.length);
  drawInfoBox(baseWidth - 200, 50, 'Path Progress', [
    `Step: ${stepCount} / ${path.length}`,
    `Tokens written: ${stepCount}`,
    `Cells visited: ${new Set(path.slice(0, stepCount).map(p => `${p.x},${p.y}`)).size}`
  ]);

  drawLabel(baseWidth / 2, baseHeight - 25, 'The path through space encodes the sequence - time becomes space', 'highlight');
}

function renderMultiColumnScene(phase) {
  drawGridBackground();
  drawGrid([], null, false);

  const colors = [COLORS.path1, COLORS.path2, COLORS.path3];

  // Draw all paths
  PATHS.forEach((path, idx) => {
    drawPath(path, colors[idx], phase, false);
  });

  // Column legend
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

  drawLabel(baseWidth / 2, baseHeight - 25, 'Same input, different starting positions → different but correlated paths', 'highlight');
}

function renderLocalizationScene(phase) {
  drawGridBackground();

  // Show some path
  const path = PATHS[0];
  drawGrid(path.slice(0, 10).map(p => ({ x: p.x, y: p.y, tokens: [p.token] })), null, false);
  drawPath(path.slice(0, 10), COLORS.path1, 1, false);

  // Localization candidates
  const candidates = [
    { x: 15, y: 15, score: 0.92 },
    { x: 17, y: 14, score: 0.67 },
    { x: 14, y: 17, score: 0.45 }
  ];

  if (phase > 0.3) {
    drawLocalizationMatch(candidates.slice(0, Math.ceil(phase * 3)), phase);
  }

  // Query window
  drawInfoBox(baseWidth - 200, 50, 'Localization Query', [
    `Window: [${TOKENS[6]}, ${TOKENS[7]}]`,
    'Searching stored patterns...',
    phase > 0.5 ? `Found ${Math.ceil(phase * 3)} matches` : 'Scanning...'
  ]);

  drawLabel(baseWidth / 2, baseHeight - 25, 'Localization finds where in the grid the current context matches', 'highlight');
}

function renderVotingScene(phase) {
  drawGridBackground();
  drawGrid([], null, false);

  // Show paths converging
  const colors = [COLORS.path1, COLORS.path2, COLORS.path3];
  PATHS.forEach((path, idx) => {
    drawPath(path.slice(0, 5), colors[idx], 1, false);
  });

  // Voting visualization
  const columns = [
    { color: COLORS.path1 },
    { color: COLORS.path2 },
    { color: COLORS.path3 }
  ];

  const votes = [3, 2, 3]; // Votes for their proposed location
  const winnerIdx = phase > 0.7 ? 0 : -1; // Column 1 wins (tied, but first)

  drawVotingCircle(columns, votes, winnerIdx, phase);

  drawInfoBox(55, 380, 'Voting Process', [
    '1. Each column proposes location',
    '2. Votes are shared laterally',
    phase > 0.7 ? '3. Consensus reached!' : '3. Counting votes...'
  ]);

  drawLabel(baseWidth / 2, baseHeight - 25, 'Columns vote on location - majority wins, conflicts detected', 'highlight');
}

function renderBranchingScene(phase) {
  drawGridBackground();
  drawGrid([], null, false);

  drawBranchingPath(PATHS, phase);

  drawInfoBox(baseWidth - 200, 150, 'Branching', [
    'Ambiguous context detected',
    'Multiple hypotheses active',
    phase > 0.7 ? 'Evidence will disambiguate' : 'Exploring alternatives...'
  ]);

  if (phase > 0.8) {
    drawInfoBox(55, 380, 'Resolution', [
      'New tokens arrive',
      'One branch becomes unlikely',
      'System prunes hypothesis'
    ]);
  }

  drawLabel(baseWidth / 2, baseHeight - 25, 'Paths can branch when context is ambiguous - pruned by new evidence', 'highlight');
}

// ==================== NEW SCENES: Prediction, Heavy-Hitters, Replay, Slow Maps ====================

function renderPredictionScene(phase) {
  drawGridBackground();
  drawGrid([], null, false);

  const path = PATHS[0];
  const stepIdx = Math.min(Math.floor(phase * 8) + 3, path.length - 1);

  // Draw path up to current position
  drawPath(path.slice(0, stepIdx), COLORS.path1, 1, false);

  // Current position
  const current = path[stepIdx];
  if (current && isInView(current.x, current.y)) {
    const { x, y } = gridToPixel(current.x, current.y);

    // Prediction bubble
    const predPhase = (phase * 4) % 1;
    if (predPhase < 0.5) {
      // Show prediction
      ctx.fillStyle = 'rgba(139, 92, 246, 0.3)';
      ctx.beginPath();
      ctx.arc(x, y, 25 + predPhase * 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#a78bfa';
      ctx.font = 'bold 11px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Predicting...', x, y - 35);

      // Show predicted token
      const nextToken = path[stepIdx + 1]?.token ?? '?';
      ctx.fillStyle = COLORS.vote;
      ctx.font = 'bold 14px "Space Grotesk", sans-serif';
      ctx.fillText(`→ ${nextToken}`, x + 40, y);
    } else {
      // Show actual token arrival
      const actualToken = path[stepIdx]?.token ?? 0;
      ctx.fillStyle = COLORS.locMatch;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(actualToken), x, y + 4);

      // Show prediction error indicator
      const error = predPhase > 0.7;
      if (error) {
        ctx.fillStyle = error ? COLORS.locMatch : '#ef4444';
        ctx.font = '10px "Space Grotesk", sans-serif';
        ctx.fillText(error ? '✓ Match' : '✗ Error', x, y + 38);
      }
    }
  }

  // Info box
  drawInfoBox(baseWidth - 200, 50, 'Prediction Loop', [
    '1. Read top-K at location',
    '2. Predict next token',
    '3. Observe actual token',
    phase > 0.5 ? '4. Compute error → learn' : '4. Waiting...'
  ]);

  drawLabel(baseWidth / 2, baseHeight - 25, 'Columns predict BEFORE observing. Prediction error drives learning.', 'highlight');
}

function renderHeavyHittersScene(phase) {
  drawGridBackground();

  // Show a single cell being filled
  const cellX = 14;
  const cellY = 14;
  const px = GRID_OFFSET.x + (cellX - GRID_VIEW.startX) * CELL_SIZE;
  const py = GRID_OFFSET.y + (cellY - GRID_VIEW.startY) * CELL_SIZE;

  // Draw grid with one highlighted cell
  drawGrid([{ x: cellX, y: cellY, tokens: [] }], { x: cellX, y: cellY }, false);

  // Simulate tokens arriving at the cell
  const K = 4;
  const tokensArriving = [42, 17, 89, 23, 56]; // 5 tokens, K=4
  const numArrived = Math.min(Math.floor(phase * 6), tokensArriving.length);

  // Draw cell contents
  const cellContents = tokensArriving.slice(0, Math.min(numArrived, K));
  const evicted = numArrived > K ? tokensArriving[0] : null; // First token gets evicted

  // Token positions in cell
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

  // Show incoming token
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

    // Arrow head
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

  // Show eviction if K exceeded
  if (evicted && phase > 0.8) {
    ctx.fillStyle = '#ef4444';
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Evicted: ${evicted} (least frequent)`, px - 10, py + CELL_SIZE + 20);
  }

  // Info box
  drawInfoBox(baseWidth - 200, 50, 'Heavy-Hitters (K=4)', [
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

  drawLabel(baseWidth / 2, baseHeight - 25, 'Each cell keeps only top-K tokens. Eviction prevents muddiness.', 'highlight');
}

function renderReplayScene(phase) {
  drawGridBackground();
  drawGrid([], null, false);

  const path = PATHS[0];

  // Show full path faded
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

  // Target query position
  const targetStep = Math.min(checkpointStep + Math.floor(phase * 10) + 1, path.length - 1);
  const targetPos = path[targetStep];

  // Show replay progress
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

    // Current replay position
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

  // Info box
  drawInfoBox(baseWidth - 200, 50, 'Replay from Checkpoint', [
    `Checkpoint: step ${checkpointStep}`,
    `Target: step ${targetStep}`,
    `Replay steps: ${targetStep - checkpointStep}`,
    phase > 0.8 ? 'State reconstructed!' : 'Replaying events...'
  ]);

  drawLabel(baseWidth / 2, baseHeight - 25, 'State is reconstructed by replaying events from the nearest checkpoint.', 'highlight');
}

function renderSlowMapsScene(phase) {
  drawGridBackground();

  // Draw two grids side by side: fast map and slow map
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

  // Draw mini grids
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

    // Draw path
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

      // Simple displacement
      const dx = ((i * 7) % 3) - 1;
      const dy = ((i * 11) % 3) - 1;
      x = ((x + dx) % miniGridSize + miniGridSize) % miniGridSize;
      y = ((y + dy) % miniGridSize + miniGridSize) % miniGridSize;
    }
    ctx.stroke();

    // Current position
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

  // Slow map only writes every 5 steps
  const slowPhase = Math.floor(phase * 15 / 5) * 5 / 15;
  drawMiniGrid(slowGridOffset, COLORS.path2, slowPhase);

  // Window indicator on slow map
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

  // Arrow head
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

  // Info boxes
  drawInfoBox(40, 360, 'Fast Map', [
    `Steps written: ${fastSteps}`,
    'Writes every step',
    'Detailed trajectory'
  ]);

  drawInfoBox(480, 360, 'Slow Map', [
    `Windows written: ${Math.floor(slowPhase * 3) + 1}`,
    'Writes every 5 steps',
    'Abstract summaries'
  ]);

  drawLabel(baseWidth / 2, baseHeight - 25, 'Fast maps for detail, slow maps for abstraction. Like cortical hierarchy.', 'highlight');
}

function renderReasoningScene(phase) {
  drawGridBackground();

  // Draw Work Signature visualization
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

  // Draw fact content
  const fact = {
    subject: 'Alice',
    predicate: 'enters',
    object: 'room_A'
  };

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

  // Pattern with variable
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
  ctx.fillStyle = '#fbbf24'; // Variable color
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
    ctx.fillStyle = COLORS.text;
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

  drawInfoBox(baseWidth - 200, 50, 'Reasoning Primitives', [
    'Facts = structured bindings',
    'Patterns = templates with ?vars',
    'Unification = matching + binding',
    phase > 0.7 ? 'Chains = auditable derivations' : 'Building chain...'
  ]);

  drawLabel(baseWidth / 2, baseHeight - 25, 'Reasoning is explicit: facts, patterns, bindings, derivation chains.', 'highlight');
}

// ==================== MAIN RENDER LOOP ====================

function render() {
  const { scene, index, local } = getSceneAtTime(timeline);
  const phase = local / scene.duration;

  switch (scene.id) {
    case 'grid':
      renderGridScene(phase);
      break;
    case 'displacement':
      renderDisplacementScene(phase);
      break;
    case 'path':
      renderPathScene(phase);
      break;
    case 'multicolumn':
      renderMultiColumnScene(phase);
      break;
    case 'localization':
      renderLocalizationScene(phase);
      break;
    case 'voting':
      renderVotingScene(phase);
      break;
    case 'branching':
      renderBranchingScene(phase);
      break;
    case 'prediction':
      renderPredictionScene(phase);
      break;
    case 'heavyhitters':
      renderHeavyHittersScene(phase);
      break;
    case 'replay':
      renderReplayScene(phase);
      break;
    case 'slowmaps':
      renderSlowMapsScene(phase);
      break;
    case 'reasoning':
      renderReasoningScene(phase);
      break;
  }

  updateSidePanel(scene, index);
  updateStepChips(index);
}

function getSceneAtTime(t) {
  let acc = 0;
  for (let i = 0; i < SCENES.length; i++) {
    acc += SCENES[i].duration;
    if (t < acc) return { scene: SCENES[i], index: i, local: t - (acc - SCENES[i].duration) };
  }
  return { scene: SCENES[SCENES.length - 1], index: SCENES.length - 1, local: SCENES[SCENES.length - 1].duration };
}

function sceneStart(index) {
  let t = 0;
  for (let i = 0; i < index; i++) t += SCENES[i].duration;
  return t;
}

function sliderToSpeed(value) {
  const t = value / 100;
  return Math.pow(10, (t - 0.5) * 1.1);
}

function updateSpeedLabels() {
  speedValue.textContent = `${speed.toFixed(2)}x`;
  const perScene = (SCENES[0].duration / speed).toFixed(1);
  speedHint.textContent = `≈ ${perScene}s per scene`;
}

function buildStepsUI() {
  stepsContainer.innerHTML = '';
  SCENES.forEach((scene, idx) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tutorial-step';
    chip.textContent = `${idx + 1}. ${scene.title.split(' - ')[0]}`;
    chip.addEventListener('click', () => {
      timeline = sceneStart(idx);
      render();
    });
    stepsContainer.appendChild(chip);
  });
}

function updateSidePanel(scene, index) {
  sceneTitle.textContent = scene.title;
  sceneSummary.textContent = scene.summary;
  sceneBullets.innerHTML = '';
  scene.bullets.forEach((bullet) => {
    const li = document.createElement('li');
    li.textContent = bullet;
    sceneBullets.appendChild(li);
  });
  sceneKey.textContent = scene.key;
  sceneSignals.innerHTML = '';
  scene.signals.forEach((signal) => {
    const tag = document.createElement('span');
    tag.className = 'tutorial-signal';
    tag.textContent = signal;
    sceneSignals.appendChild(tag);
  });
}

function updateStepChips(activeIndex) {
  Array.from(stepsContainer.children).forEach((chip, idx) => {
    chip.classList.toggle('active', idx === activeIndex);
  });
}

function tick(now) {
  const delta = (now - lastTime) / 1000;
  lastTime = now;
  if (playing) {
    timeline += delta * speed;
    if (timeline > TOTAL_DURATION) timeline -= TOTAL_DURATION;
  }
  render();
  requestAnimationFrame(tick);
}

// Event listeners
playBtn.addEventListener('click', () => {
  playing = true;
});

pauseBtn.addEventListener('click', () => {
  playing = false;
});

nextBtn.addEventListener('click', () => {
  const { index } = getSceneAtTime(timeline);
  timeline = sceneStart((index + 1) % SCENES.length);
  render();
});

speedInput.addEventListener('input', (event) => {
  speed = sliderToSpeed(Number(event.target.value));
  updateSpeedLabels();
});

// Lesson navigation
const lessonNav = document.getElementById('lessonNav');
if (lessonNav) {
  lessonNav.addEventListener('click', (event) => {
    const btn = event.target.closest('.lesson-nav-item');
    if (!btn) return;

    const lessonIdx = parseInt(btn.dataset.lesson, 10);
    if (!isNaN(lessonIdx) && lessonIdx >= 0 && lessonIdx < SCENES.length) {
      timeline = sceneStart(lessonIdx);
      playing = false; // Pause when manually selecting
      render();
    }
  });
}

function updateLessonNav(activeIndex) {
  if (!lessonNav) return;

  Array.from(lessonNav.children).forEach((btn, idx) => {
    btn.classList.toggle('active', idx === activeIndex);
    // Mark completed lessons
    if (idx < activeIndex) {
      btn.classList.add('completed');
    } else {
      btn.classList.remove('completed');
    }
  });
}

// Override updateStepChips to also update lesson nav
const originalUpdateStepChips = updateStepChips;
function updateStepChipsAndNav(activeIndex) {
  originalUpdateStepChips(activeIndex);
  updateLessonNav(activeIndex);
}

// Patch the render function to use new update
const originalRender = render;
render = function () {
  const { scene, index, local } = getSceneAtTime(timeline);
  const phase = local / scene.duration;

  switch (scene.id) {
    case 'grid':
      renderGridScene(phase);
      break;
    case 'displacement':
      renderDisplacementScene(phase);
      break;
    case 'path':
      renderPathScene(phase);
      break;
    case 'multicolumn':
      renderMultiColumnScene(phase);
      break;
    case 'localization':
      renderLocalizationScene(phase);
      break;
    case 'voting':
      renderVotingScene(phase);
      break;
    case 'branching':
      renderBranchingScene(phase);
      break;
    case 'prediction':
      renderPredictionScene(phase);
      break;
    case 'heavyhitters':
      renderHeavyHittersScene(phase);
      break;
    case 'replay':
      renderReplayScene(phase);
      break;
    case 'slowmaps':
      renderSlowMapsScene(phase);
      break;
    case 'reasoning':
      renderReasoningScene(phase);
      break;
  }

  updateSidePanel(scene, index);
  updateStepChips(index);
  updateLessonNav(index);
};

// Initialize
buildStepsUI();
updateSpeedLabels();
updateLessonNav(0);
render();
requestAnimationFrame(tick);
