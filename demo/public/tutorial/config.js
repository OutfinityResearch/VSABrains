/**
 * Tutorial Configuration - Constants, Colors, and Scene Definitions
 * VSABrains Thousand Brains Theory Tutorial
 * 
 * Narrations are loaded separately from JSON files in /narrations/
 */

// Colors palette
export const COLORS = {
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

// Scene definitions (narrations loaded from JSON files)
export const SCENES = [
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
    duration: 12
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
    duration: 14
  },
  {
    id: 'path',
    title: 'A Path Through Space - Time Becomes Geometry',
    summary: 'A column traces a path through the grid as it processes tokens. At each step: (1) write tokens at current location, (2) compute displacement, (3) move. The path IS the representation.',
    bullets: [
      'Each step: write then move',
      'Path = sequence of (location, token) pairs',
      'The trajectory encodes the sequence order',
      'Time becomes space'
    ],
    key: 'Sequences are stored as paths. The trajectory through space IS the memory.',
    signals: ['path trace', 'step sequence', 'spatial encoding'],
    duration: 14
  },
  {
    id: 'multicolumn',
    title: 'Multiple Columns - Many Minds, One Truth',
    summary: 'Multiple columns process the same input but start at different locations. They trace different paths but create correlated patterns. Each column is an independent "witness".',
    bullets: [
      'Same tokens, different starting offsets',
      'Paths differ but have similar structure',
      'Each column = independent model',
      'Redundancy enables robust consensus'
    ],
    key: 'Many columns = many perspectives on the same sequence.',
    signals: ['column offsets', 'parallel paths', 'multi-model'],
    duration: 14
  },
  {
    id: 'localization',
    title: 'Localization - Where Am I in Memory Space?',
    summary: 'Given a context window, localization finds matching locations in the stored grid. It returns candidate positions with confidence scores. This is how the system "remembers" where it was.',
    bullets: [
      'Query: recent token window',
      'Search: find cells with matching tokens',
      'Result: candidate locations + scores',
      'Enables: replay from any point'
    ],
    key: 'Localization = pattern matching on the grid to find stored contexts.',
    signals: ['query window', 'candidate cells', 'match score'],
    duration: 14
  },
  {
    id: 'voting',
    title: 'Voting & Consensus - Democracy of Neural Columns',
    summary: 'Each column proposes a location. Through lateral connections, columns share beliefs and converge on the most-supported answer. Majority wins, conflicts are detected.',
    bullets: [
      'Each column: "I think we\'re at X"',
      'Columns share via lateral connections',
      'Votes accumulate for each candidate',
      'Winner = highest vote count'
    ],
    key: 'Consensus: independent models voting produces robust answers.',
    signals: ['candidate votes', 'lateral share', 'consensus winner'],
    duration: 14
  },
  {
    id: 'branching',
    title: 'Branching Paths - Holding Multiple Hypotheses',
    summary: 'Paths can branch when contexts match multiple stored patterns. The system maintains multiple hypotheses until evidence disambiguates. This handles ambiguity gracefully.',
    bullets: [
      'Ambiguous context → multiple matches',
      'Branches represent alternative hypotheses',
      'New evidence prunes unlikely branches',
      'Checkpoints enable efficient replay'
    ],
    key: 'Branching paths = multiple hypotheses maintained until evidence decides.',
    signals: ['branch point', 'hypothesis', 'disambiguation'],
    duration: 14
  },
  {
    id: 'prediction',
    title: 'Prediction Loop - The Brain is a Prediction Machine',
    summary: 'Columns predict the next token BEFORE receiving input. When the actual token arrives, prediction error signals learning. This is core to Thousand Brains: predict, observe, update.',
    bullets: [
      'Each column predicts next token at current location',
      'Prediction comes from GridMap top-K at (x, y)',
      'Actual token arrives → compute prediction error',
      'Error drives learning and hypothesis pruning'
    ],
    key: 'The system anticipates before it observes. Prediction error is the learning signal.',
    signals: ['predict', 'observe', 'error', 'update'],
    duration: 14
  },
  {
    id: 'heavyhitters',
    title: 'Heavy-Hitters - Bounded Memory, Graceful Forgetting',
    summary: 'Each grid cell can only store K tokens (e.g., K=4). When a 5th token arrives, the least frequent is evicted. This prevents cells from becoming "muddy" with too many tokens.',
    bullets: [
      'Each cell keeps top-K tokens by frequency',
      'New token: increment count or evict minimum',
      'Prevents unbounded memory per cell',
      'Quality degrades gracefully under saturation'
    ],
    key: 'Heavy-hitters keep cells focused. Eviction prevents muddiness.',
    signals: ['top-K', 'eviction', 'saturation', 'frequency'],
    duration: 14
  },
  {
    id: 'replay',
    title: 'Replay & Checkpoints - Reconstructing the Past',
    summary: 'To answer a query about past state, the system replays from a checkpoint. Checkpoints save column positions and displacement buffers. Replay reconstructs state deterministically.',
    bullets: [
      'Checkpoint = saved column positions + buffers',
      'Replay = apply events from checkpoint to target',
      'State is reconstructed, not stored',
      'Trade-off: checkpoint frequency vs replay cost'
    ],
    key: 'State is not stored directly—it is reconstructed by replay from checkpoints.',
    signals: ['checkpoint', 'replay', 'state reconstruction'],
    duration: 14
  },
  {
    id: 'slowmaps',
    title: 'Slow Maps - Multiple Timescales of Memory',
    summary: 'Fast maps write every step. Slow maps write summaries every N steps (e.g., N=10). This mirrors cortical hierarchy: higher levels process at slower timescales.',
    bullets: [
      'Fast map: writes every step (detailed)',
      'Slow map: writes summary every N steps (abstract)',
      'Summaries capture entities, predicates, trends',
      'Enables efficient long-range retrieval'
    ],
    key: 'Multiple timescales: fast for detail, slow for abstraction.',
    signals: ['fast map', 'slow map', 'window summary', 'timescale'],
    duration: 14
  },
  {
    id: 'reasoning',
    title: 'Work Signatures - Auditable, Inspectable Reasoning',
    summary: 'For auditable reasoning, facts are stored as role→value maps (Work Signatures). Pattern matching with variables (?x) enables rule-based inference with explicit bindings.',
    bullets: [
      'Fact = { subject, predicate, object }',
      'Pattern = signature with variables (?x)',
      'Unification binds variables to values',
      'Chains form auditable derivations'
    ],
    key: 'Reasoning is explicit and inspectable. No hidden vectors, just bindings.',
    signals: ['WorkSignature', 'unification', 'binding', 'derivation'],
    duration: 16
  },
  {
    id: 'vsaindex',
    title: 'VSA as Index - Semantic Addressing',
    summary: 'VSA hypervectors serve as semantic addresses. Similar meanings cluster together. The index maps concepts to grid locations, enabling content-addressable memory.',
    bullets: [
      'Hypervector = high-dimensional binary/bipolar vector',
      'Similar concepts → similar vectors → nearby addresses',
      'Bundling combines multiple meanings',
      'Binding creates structured associations'
    ],
    key: 'VSA provides semantic hashing: similar content gets similar addresses.',
    signals: ['hypervector', 'bundling', 'binding', 'semantic hash'],
    duration: 14
  },
  {
    id: 'retrieval',
    title: 'Grounded RAG - Evidence-Based Retrieval',
    summary: 'Retrieval-Augmented Generation with explicit evidence chains. Every retrieved fact links back to source. No hallucination—only grounded, verifiable answers.',
    bullets: [
      'Query decomposes into sub-queries',
      'Each fact retrieved with provenance',
      'Evidence chains track source → derivation',
      'Answer includes confidence + citations'
    ],
    key: 'Every answer traces back to source facts. Retrieval is auditable.',
    signals: ['provenance', 'evidence chain', 'citation', 'grounding'],
    duration: 14
  },
  {
    id: 'conflict',
    title: 'Conflict Detection - When Facts Disagree',
    summary: 'When multiple sources provide conflicting information, the system detects and reports conflicts. Temporal ordering and source credibility help resolution.',
    bullets: [
      'Same entity, contradictory predicates',
      'Detect via pattern matching on signatures',
      'Report: "A says X, B says Y"',
      'Resolution: recency, credibility, voting'
    ],
    key: 'Conflicts are surfaced, not hidden. The system says "I don\'t know" when appropriate.',
    signals: ['contradiction', 'temporal order', 'credibility', 'resolution'],
    duration: 14
  },
  {
    id: 'derivation',
    title: 'Fact Derivation - Building Knowledge',
    summary: 'New facts are derived from existing ones via rules. Each derivation records its premises. The knowledge graph grows with explicit lineage.',
    bullets: [
      'Rule: IF pattern THEN conclude',
      'Premises bound via unification',
      'Derived fact stores rule + bindings',
      'Lineage enables explanation'
    ],
    key: 'Derivation chains are explicit. Ask "why?" and get the reasoning path.',
    signals: ['rule application', 'premises', 'conclusion', 'lineage'],
    duration: 14
  },
  {
    id: 'entities',
    title: 'Entity Resolution - Who is Who?',
    summary: 'The same entity may appear under different names. Entity resolution links aliases and tracks identity across contexts. Essential for knowledge integration.',
    bullets: [
      'Alias detection via context similarity',
      'Canonical ID assigned to resolved entity',
      'Cross-reference maintains links',
      'Merge facts under unified identity'
    ],
    key: 'Entity resolution unifies scattered mentions into coherent knowledge.',
    signals: ['alias', 'canonical ID', 'coreference', 'identity merge'],
    duration: 14
  }
];

export const TOTAL_DURATION = SCENES.reduce((acc, s) => acc + s.duration, 0);

// Grid view configuration
export const GRID_VIEW = { startX: 10, startY: 10, size: 12 };
export const CELL_SIZE = 38;
export const GRID_OFFSET = { x: 60, y: 50 };

// Sample token sequence for demos
export const TOKENS = [42, 17, 89, 23, 56, 78, 34, 91, 45, 12, 67, 88, 33, 55, 77, 99, 11, 44, 66, 22];

/**
 * Generate a sample path for visualization
 */
export function generatePath(startX, startY, tokens, seed) {
  const path = [{ x: startX, y: startY, token: tokens[0] }];
  let x = startX, y = startY;

  for (let i = 1; i < tokens.length; i++) {
    const hash = (tokens[i] * 31 + tokens[i - 1] * 17 + seed) >>> 0;
    const dx = (hash % 7) - 3;
    const dy = ((hash >>> 8) % 7) - 3;

    x = ((x + dx) % 64 + 64) % 64;
    y = ((y + dy) % 64 + 64) % 64;

    path.push({ x, y, token: tokens[i], dx, dy });
  }
  return path;
}

// Pre-generated paths for multiple columns
export const PATHS = [
  generatePath(15, 14, TOKENS, 0),
  generatePath(18, 16, TOKENS, 100),
  generatePath(13, 18, TOKENS, 200)
];
