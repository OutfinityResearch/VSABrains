import { PROFILE_DEFS } from './constants.mjs';
import { summarizeSemanticState } from './semantic.mjs';
import { formatContradictionsText, formatStoryText } from './state.mjs';

export async function getStatePayload(session) {
  const state = session.brain.getState();
  return {
    step: state.step,
    numColumns: session.currentConfig.numColumns,
    contentMode: session.contentMode,
    profileId: session.profileId,
    profileCnl: session.profileCnl,
    profiles: PROFILE_DEFS.map((profile) => ({
      id: profile.id,
      label: profile.label,
      description: profile.description
    })),
    activeFrames: Array.from(session.activeFrames ?? []),
    activeFramesCount: session.activeFrames?.size ?? 0,
    columns: state.columns.map((column) => column.location),
    mapConfig: session.currentConfig.mapConfig,
    history: session.history.map((entry) => ({ locations: entry.locations })),
    historyLength: session.history.length,
    contradictionsCount: session.contradictions.length,
    semanticFactsCount: session.semanticFacts.length,
    semanticActiveFactsCount: session.activeFactsCount ?? 0,
    semanticSummary: summarizeSemanticState(session.semanticState),
    frameSegments: session.frameSegments,
    storyText: formatStoryText(session),
    contradictionsText: formatContradictionsText(session),
    lastQueryStats: session.lastQueryStats,
    world: {
      entities: session.world?.entities ?? [],
      locations: session.world?.locations ?? [],
      items: session.world?.items ?? []
    }
  };
}
