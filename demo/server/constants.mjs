export const PORT = Number(process.env.PORT ?? 8787);
export const DEFAULT_STORY_EVENTS = 1_000;
export const MAX_STORY_EVENTS = 10_000;
export const MAX_COLUMNS = 9;
export const FRAME_SEGMENT_LIMIT = 250;
export const SEMANTIC_SERIES_LIMIT = 200;

export const DEMO_CONFIG = {
  numColumns: 3,
  mapConfig: { width: 64, height: 64, k: 4 },
  displacement: { contextLength: 2, maxStep: 3, seed: 7, avoidZeroStep: true },
  checkpoint: { policy: 'adaptive', interval: 100, minInterval: 20, maxInterval: 200 },
  episodicStore: { maxChunks: 2_000_000 },
  writePolicy: 'stepTokenOnly'
};

export const CONTENT_MODES = new Set(['synthetic', 'literature', 'chat']);

export const BASE_ENTITIES = ['Alice', 'Bob', 'Charlie', 'Dana', 'Eli', 'Mara', 'Nora', 'Iris'];
export const BASE_LOCATIONS = ['room_A', 'room_B', 'garden', 'lab', 'hall', 'library', 'kitchen', 'yard'];
export const BASE_ITEMS = ['key', 'map', 'torch', 'apple', 'coin', 'ring', 'book', 'badge'];

export const LIT_ENTITIES = ['Marina', 'Julian', 'Evelyn', 'Silas', 'Clara', 'Theo', 'Inez', 'Rowan'];
export const LIT_LOCATIONS = ['manor', 'garden', 'study', 'harbor', 'chapel', 'railway', 'attic', 'courtyard'];
export const LIT_ITEMS = ['letter', 'ring', 'diary', 'portrait', 'keycard', 'lantern', 'map', 'seal'];

export const CHAT_ENTITIES = ['User_A', 'User_B', 'User_C', 'Moderator'];
export const CHAT_LOCATIONS = ['channel_alpha', 'channel_beta', 'helpdesk', 'general'];
export const CHAT_TOPICS = ['release', 'deadline', 'budget', 'incident', 'policy', 'onboarding', 'quality', 'roadmap'];

export const ACTION_DEFS = [
  { id: 'enters', objectType: 'location' },
  { id: 'moves_to', objectType: 'location' },
  { id: 'picks_up', objectType: 'item' },
  { id: 'drops', objectType: 'item' },
  { id: 'dies', objectType: 'none' },
  { id: 'revives', objectType: 'none' }
];

export const LIT_ACTION_DEFS = [
  { id: 'enters', objectType: 'location' },
  { id: 'moves_to', objectType: 'location' },
  { id: 'picks_up', objectType: 'item' },
  { id: 'drops', objectType: 'item' },
  { id: 'dies', objectType: 'none' },
  { id: 'revives', objectType: 'none' },
  { id: 'confesses_to', objectType: 'entity' },
  { id: 'accuses', objectType: 'entity' },
  { id: 'betrays', objectType: 'entity' },
  { id: 'vows_to', objectType: 'entity' },
  { id: 'reveals_to', objectType: 'entity' },
  { id: 'consoles', objectType: 'entity' },
  { id: 'threatens', objectType: 'entity' }
];

export const CHAT_ACTION_DEFS = [
  { id: 'says', objectType: 'item' },
  { id: 'asks', objectType: 'item' },
  { id: 'agrees', objectType: 'item' },
  { id: 'disagrees', objectType: 'item' },
  { id: 'apologizes', objectType: 'none' },
  { id: 'insults', objectType: 'entity' },
  { id: 'shares', objectType: 'item' },
  { id: 'moderates', objectType: 'entity' },
  { id: 'leaves', objectType: 'none' }
];

export const LIT_THEMES = ['loss', 'betrayal', 'duty', 'memory', 'freedom', 'identity', 'justice', 'forgiveness'];
export const LIT_EMOTIONS = ['grief', 'awe', 'fear', 'hope', 'anger', 'relief', 'tenderness'];
export const LIT_TONES = ['somber', 'intimate', 'ironic', 'formal', 'tender', 'cold'];
export const LIT_CONFLICTS = ['interpersonal', 'internal', 'societal', 'mystery'];
export const LIT_MOTIFS = ['rain', 'mirror', 'letter', 'lock', 'shadow', 'clock'];
export const LIT_PLOT_TURNS = ['reveal', 'reversal', 'twist', 'none'];

export const CHAT_SENTIMENTS = ['positive', 'neutral', 'frustrated', 'anxious', 'defensive'];
export const CHAT_POLITENESS = ['high', 'neutral', 'low'];
export const CHAT_PERSUASION = ['logic', 'appeal', 'threat', 'emotion'];
export const CHAT_RESOLUTION = ['unresolved', 'partial', 'resolved'];

export const PROFILE_DEFS = [
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'General-purpose frame mix for mixed content.',
    frames: [
      'emotionState', 'emotionIntensity', 'tensionLevel',
      'themeTags', 'conflictType', 'conflictEscalation',
      'dialogueAct', 'politenessLevel', 'stanceAgreement',
      'goalState', 'planProgress',
      'toneStyle', 'narrativePhase'
    ]
  },
  {
    id: 'literature-critic',
    label: 'Literature Critic',
    description: 'Focus on themes, tone, narrative arc, and character dynamics.',
    frames: [
      'emotionState', 'emotionIntensity', 'tensionLevel',
      'themeTags', 'motifRecurrence', 'moralTheme',
      'toneStyle', 'imageryDensity', 'rhetoricDevice',
      'narrativePhase', 'plotTurns', 'pacingTempo',
      'characterArc', 'narratorReliability',
      'conflictType', 'conflictEscalation',
      'powerBalance', 'hostilityRelation', 'allianceRelation'
    ]
  },
  {
    id: 'dialogue-analyst',
    label: 'Dialogue Analyst',
    description: 'Focus on conversational dynamics, agreement, and social signals.',
    frames: [
      'emotionState', 'tensionLevel',
      'dialogueAct', 'politenessLevel', 'stanceAgreement', 'persuasionTactic',
      'trustRelation', 'hostilityRelation', 'powerBalance',
      'conflictEscalation', 'goalState', 'planProgress',
      'narrativePhase', 'toneStyle'
    ]
  }
];

export const DEFAULT_PROFILE_BY_MODE = {
  synthetic: 'balanced',
  literature: 'literature-critic',
  chat: 'dialogue-analyst'
};
