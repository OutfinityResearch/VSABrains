const $ = (selector) => document.querySelector(selector);

export const dom = {
  canvas: $('#gridCanvas'),
  storyField: $('#storyField'),
  storyAction: $('#storyAction'),
  storyActionRun: $('#storyActionRun'),
  contentMode: $('#contentMode'),
  columnsRange: $('#columnsRange'),
  columnsValue: $('#columnsValue'),
  applyColumnsBtn: $('#applyColumnsBtn'),
  animPlayBtn: $('#animPlayBtn'),
  animPauseBtn: $('#animPauseBtn'),
  animNextBtn: $('#animNextBtn'),
  animSpeed: $('#animSpeed'),
  animSpeedValue: $('#animSpeedValue'),
  animSpeedHint: $('#animSpeedHint'),
  statusMsg: $('#statusMsg'),
  stepValue: $('#stepValue'),
  eventsMeta: $('#eventsMeta'),
  columnsMeta: $('#columnsMeta'),
  contradictionsValue: $('#contradictionsValue'),
  tabButtons: document.querySelectorAll('.tab-btn'),
  tabPanels: document.querySelectorAll('.tab-panel'),
  queryType: $('#queryType'),
  queryEntity: $('#queryEntity'),
  queryTarget: $('#queryTarget'),
  queryItem: $('#queryItem'),
  queryLocation: $('#queryLocation'),
  queryStep: $('#queryStep'),
  queryLimit: $('#queryLimit'),
  queryEntityField: $('#queryEntityField'),
  queryTargetField: $('#queryTargetField'),
  queryItemField: $('#queryItemField'),
  queryLocationField: $('#queryLocationField'),
  queryStepField: $('#queryStepField'),
  queryLimitField: $('#queryLimitField'),
  runQueryBtn: $('#runQueryBtn'),
  queryAnswer: $('#queryAnswer'),
  perfBarVsa: $('#perfBarVsa'),
  perfBarNaive: $('#perfBarNaive'),
  perfBarVsaValue: $('#perfBarVsaValue'),
  perfBarNaiveValue: $('#perfBarNaiveValue'),
  busyOverlay: $('#busyOverlay'),
  busyMessage: $('#busyMessage'),
  mismatchOverlay: $('#mismatchOverlay'),
  mismatchCloseBtn: $('#mismatchCloseBtn'),
  mismatchType: $('#mismatchType'),
  mismatchStep: $('#mismatchStep'),
  mismatchVsa: $('#mismatchVsa'),
  mismatchNaive: $('#mismatchNaive'),
  spacesContainer: $('#spacesContainer'),
  spacesMeta: $('#spacesMeta'),
  spacesGroup: $('#spacesGroup'),
  spacesFilter: $('#spacesFilter'),
  frameProfile: $('#frameProfile'),
  cnlField: $('#cnlField'),
  frameLegend: $('#frameLegend'),
  framesSummary: $('#framesSummary'),
  framesNow: $('#framesNow'),
  columnsCheckboxes: $('#columnsCheckboxes'),
  columnsAllBtn: $('#columnsAllBtn'),
  columnsNoneBtn: $('#columnsNoneBtn'),
  activityLog: $('#activityLog'),
  subtabButtons: document.querySelectorAll('.subtab-btn'),
  subtabPanels: document.querySelectorAll('.subtab-panel'),
  theoryVizToggle: $('#theoryVizToggle')
};

export const config = {
  sessionId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  STORY_LENGTH: 1_000,
  APPEND_COUNT: 10_000,
  columnColors: ['#7b8dff', '#52f2c2', '#ffb454', '#ff6bb5', '#73e2ff', '#c2ff6b']
};

export const queryDefs = {
  BASE_QUERY_DEFS: [
    { value: 'where', label: 'Where is an entity (latest)?', fields: { entity: true } },
    { value: 'whereAt', label: 'Where is an entity (at step)?', fields: { entity: true, step: true } },
    { value: 'entitiesAt', label: 'Who is in a location?', fields: { location: true, step: true } },
    { value: 'inventory', label: 'What does an entity have?', fields: { entity: true } },
    { value: 'whoHas', label: 'Who has an item?', fields: { item: true } },
    { value: 'itemLocation', label: 'Where is an item?', fields: { item: true, step: true } },
    { value: 'isAlive', label: 'Is an entity alive?', fields: { entity: true } },
    { value: 'lastEvent', label: 'Last event for entity', fields: { entity: true } },
    { value: 'timeline', label: 'Timeline for entity', fields: { entity: true, limit: true } },
    { value: 'contradictions', label: 'All contradictions', fields: {} },
    { value: 'contradictionsFor', label: 'Contradictions for entity', fields: { entity: true } }
  ],
  LITERATURE_QUERY_DEFS: [
    { value: 'where', label: 'Where is an entity (latest)?', fields: { entity: true } },
    { value: 'whereAt', label: 'Where is an entity (at step)?', fields: { entity: true, step: true } },
    { value: 'entitiesAt', label: 'Who is in a location?', fields: { location: true, step: true } },
    { value: 'inventory', label: 'What does an entity have?', fields: { entity: true } },
    { value: 'whoHas', label: 'Who has an item?', fields: { item: true } },
    { value: 'itemLocation', label: 'Where is an item?', fields: { item: true, step: true } },
    { value: 'isAlive', label: 'Is an entity alive?', fields: { entity: true } },
    { value: 'lastEvent', label: 'Last event for entity', fields: { entity: true } },
    { value: 'timeline', label: 'Timeline for entity', fields: { entity: true, limit: true } },
    { value: 'contradictions', label: 'All contradictions', fields: {} },
    { value: 'contradictionsFor', label: 'Contradictions for entity', fields: { entity: true } },
    { value: 'dominantEmotion', label: 'Dominant emotion', fields: {} },
    { value: 'emotionalArc', label: 'Emotional arc trend', fields: {} },
    { value: 'dominantTheme', label: 'Dominant theme', fields: {} },
    { value: 'mainConflict', label: 'Main conflict type', fields: {} },
    { value: 'relationshipStatus', label: 'Relationship status (two entities)', fields: { entity: true, target: true } },
    { value: 'powerBalance', label: 'Power balance (two entities)', fields: { entity: true, target: true } },
    { value: 'narrativePhase', label: 'Narrative phase', fields: {} },
    { value: 'tone', label: 'Dominant tone', fields: {} },
    { value: 'motif', label: 'Dominant motif', fields: {} },
    { value: 'characterArc', label: 'Character arc', fields: { entity: true } },
    { value: 'secretHolder', label: 'Secret holder', fields: {} },
    { value: 'narratorReliability', label: 'Narrator reliability', fields: {} }
  ],
  CHAT_QUERY_DEFS: [
    { value: 'where', label: 'Where is an entity (latest)?', fields: { entity: true } },
    { value: 'whereAt', label: 'Where is an entity (at step)?', fields: { entity: true, step: true } },
    { value: 'entitiesAt', label: 'Who is in a location?', fields: { location: true, step: true } },
    { value: 'inventory', label: 'What does an entity have?', fields: { entity: true } },
    { value: 'whoHas', label: 'Who has an item?', fields: { item: true } },
    { value: 'itemLocation', label: 'Where is an item?', fields: { item: true, step: true } },
    { value: 'isAlive', label: 'Is an entity alive?', fields: { entity: true } },
    { value: 'lastEvent', label: 'Last event for entity', fields: { entity: true } },
    { value: 'timeline', label: 'Timeline for entity', fields: { entity: true, limit: true } },
    { value: 'contradictions', label: 'All contradictions', fields: {} },
    { value: 'contradictionsFor', label: 'Contradictions for entity', fields: { entity: true } },
    { value: 'dominantSentiment', label: 'Dominant sentiment', fields: {} },
    { value: 'topicFocus', label: 'Dominant topic', fields: {} },
    { value: 'agreementLevel', label: 'Agreement level', fields: {} },
    { value: 'conflictLevel', label: 'Conflict level', fields: {} },
    { value: 'politeness', label: 'Politeness level', fields: {} },
    { value: 'dominantSpeaker', label: 'Dominant speaker', fields: {} },
    { value: 'resolutionStatus', label: 'Resolution status', fields: {} },
    { value: 'trustLevel', label: 'Trust level (two entities)', fields: { entity: true, target: true } },
    { value: 'misinformationRisk', label: 'Misinformation risk', fields: {} },
    { value: 'intentDistribution', label: 'Intent distribution', fields: {} },
    { value: 'actionItems', label: 'Action items', fields: {} }
  ]
};

export const SPACE_GROUPS = [
  { label: 'Emotion & Affect', spaces: ['emotionState', 'emotionIntensity', 'moodTrend', 'tensionLevel'] },
  { label: 'Motivation & Intent', spaces: ['goalState', 'desireIntensity', 'planProgress', 'obstaclePressure'] },
  { label: 'Relationships', spaces: ['trustRelation', 'intimacyRelation', 'hostilityRelation', 'allianceRelation'] },
  { label: 'Power & Status', spaces: ['powerBalance', 'statusRank', 'authorityLegitimacy', 'dominanceMoves'] },
  { label: 'Conflict & Intrigue', spaces: ['conflictType', 'conflictEscalation', 'deceptionSignals', 'secretState'] },
  { label: 'Narrative Structure', spaces: ['narrativePhase', 'focalCharacter', 'plotTurns', 'pacingTempo'] },
  { label: 'Themes & Symbols', spaces: ['themeTags', 'motifRecurrence', 'symbolismType', 'moralTheme'] },
  { label: 'Dialogue & Pragmatics', spaces: ['dialogueAct', 'politenessLevel', 'stanceAgreement', 'persuasionTactic'] },
  { label: 'Epistemic & Reliability', spaces: ['beliefState', 'evidenceStrength', 'narratorReliability', 'uncertaintyLevel'] },
  { label: 'Character Psychology', spaces: ['mentalState', 'cognitiveBias', 'resilienceLevel', 'empathyLevel'] },
  { label: 'Style & Rhetoric', spaces: ['toneStyle', 'imageryDensity', 'rhetoricDevice', 'voiceRegister'] },
  { label: 'Reader Impact', spaces: ['predictedEmotion', 'emotionalAftertaste', 'memorabilityHook', 'cognitiveLoad'] }
];

export const FRAME_GROUP_COLORS = new Map([
  ['Emotion & Affect', '#ff6bb5'],
  ['Motivation & Intent', '#52f2c2'],
  ['Relationships', '#ffd27a'],
  ['Power & Status', '#ffb454'],
  ['Conflict & Intrigue', '#ff7a5a'],
  ['Narrative Structure', '#7b8dff'],
  ['Themes & Symbols', '#c084ff'],
  ['Dialogue & Pragmatics', '#73e2ff'],
  ['Epistemic & Reliability', '#9ae66e'],
  ['Character Psychology', '#f27d52'],
  ['Style & Rhetoric', '#a4b0ff'],
  ['Reader Impact', '#ff9bd5']
]);

export const runtime = {
  state: null,
  queryDefMap: new Map(queryDefs.BASE_QUERY_DEFS.map((def) => [def.value, def])),
  semanticSummaryCache: null,
  activeFramesSet: new Set(),
  visibleColumns: new Set(),
  columnsInitialized: false,
  lastColumnsCount: 0,
  highlightedFrame: null,
  overlayFrames: [],
  legendFrames: [],
  querySequenceTimers: [],
  savedHighlight: null,
  animationSpeed: 1,
  activeSubtab: 'query',
  pulseState: null,
  pulseFrame: null,
  frameSegmentsMap: {},
  frameTimeline: [],
  busyCount: 0,
  busyDisabledElements: [],
  // Thousand Brains Theory visualization state
  localizationCandidates: [],
  votingState: { votes: [], winnerIdx: -1 },
  showTheoryViz: true,
  // Visualization mode (matches tutorial phases)
  vizMode: 'grid', // 'grid', 'displacement', 'path', 'multicolumn', 'localization', 'voting', 'branching', 'prediction', 'heavyhitters', 'replay', 'slowmaps', 'reasoning'
  // Displacement vectors for visualization
  displacementData: [],
  // Saturation data for heavy-hitters visualization
  saturationData: null,
  // Checkpoint data for replay visualization
  checkpointData: null
};

export const FRAME_TO_GROUP = new Map(
  SPACE_GROUPS.flatMap((group) => group.spaces.map((space) => [space, group.label]))
);
