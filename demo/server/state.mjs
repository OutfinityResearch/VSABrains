import { FRAME_SEGMENT_LIMIT } from './constants.mjs';
import { clamp } from './utils.mjs';
import { applyEventToState, describeEvent, detectContradictions, initStoryState, narrativePhaseForStep } from './world.mjs';
import {
  detectSemanticContradictions,
  getFactFrameName,
  isFrameActive,
  applySemanticFactsToState,
  summarizeSemanticFacts
} from './semantic.mjs';

export async function addEvent(session, event) {
  const semanticFacts = Array.isArray(event.semanticFacts) ? event.semanticFacts : [];
  const coreEvent = {
    subject: event.subject,
    action: event.action,
    object: event.object ?? null,
    text: event.text
  };

  const reasons = [
    ...detectContradictions(session, coreEvent),
    ...detectSemanticContradictions(session, coreEvent, semanticFacts)
  ];

  applyEventToState(session.storyState, coreEvent);

  const stepInput = await session.brain.step({ event: coreEvent });
  const state = session.brain.getState();
  const step = state.step - 1;
  const stepTokenId = stepInput?.stepTokenId ?? null;
  if (stepTokenId != null) session.stepTokens.push(stepTokenId);

  const previousStep = step - 1;
  if (session.snapshotCache.state && session.snapshotCache.step === previousStep) {
    applyEventToState(session.snapshotCache.state, coreEvent);
    session.snapshotCache.step = step;
  }

  const semanticStartIndex = session.semanticFacts.length;
  if (semanticFacts.length > 0) {
    for (const fact of semanticFacts) {
      session.semanticFacts.push({ ...fact, step });
    }
    const activeFacts = semanticFacts.filter((fact) => isFrameActive(session, getFactFrameName(fact)));
    if (activeFacts.length > 0) {
      applySemanticFactsToState(session.semanticState, activeFacts);
      session.activeFactsCount += activeFacts.length;
      if (session.semanticCache.state && session.semanticCache.step === previousStep) {
        applySemanticFactsToState(session.semanticCache.state, activeFacts);
        session.semanticCache.step = step;
        session.semanticCache.factIndex = semanticStartIndex + semanticFacts.length - 1;
      }
    }
  }

  const entry = {
    step,
    event: coreEvent,
    text: `${describeEvent(coreEvent)}${summarizeSemanticFacts(semanticFacts)}`,
    reasons,
    locations: state.columns.map((column) => column.location),
    stepTokenId
  };
  session.history.push(entry);

  if (semanticFacts.length > 0) {
    const frames = new Set(
      semanticFacts.map((fact) => getFactFrameName(fact)).filter(Boolean)
    );
    frames.forEach((frame) => {
      if (!session.frameSegments[frame]) session.frameSegments[frame] = [];
      const list = session.frameSegments[frame];
      if (!list.length || list[list.length - 1].step !== step) {
        list.push({ step, locations: entry.locations });
        if (list.length > FRAME_SEGMENT_LIMIT) {
          list.splice(0, list.length - FRAME_SEGMENT_LIMIT);
        }
      }
    });
  }

  if (reasons.length > 0) {
    session.contradictions.push({
      step,
      text: entry.text,
      reasons
    });
  }

  return entry;
}

export function formatStoryText(session) {
  const worldLines = [
    `Content mode: ${session.contentMode}`,
    `World seed: ${session.world.seed}`,
    `Entities: ${session.world.entities.join(', ')}`,
    `Locations: ${session.world.locations.join(', ')}`,
    `Items: ${session.world.items.join(', ')}`,
    `Actions: ${session.world.actions.map((a) => a.id).join(', ')}`
  ];
  const storyLines = session.history.map((entry) => {
    const flag = entry.reasons.length > 0 ? '⚠' : '•';
    const reasons = entry.reasons.length > 0 ? ` [${entry.reasons.join(', ')}]` : '';
    return `${flag} #${entry.step} ${entry.text}${reasons}`;
  });
  if (storyLines.length === 0) storyLines.push('No events yet.');
  return [...worldLines, '', 'Story:', ...storyLines].join('\n');
}

export function formatContradictionsText(session) {
  if (session.contradictions.length === 0) return 'No contradictions detected.';
  return session.contradictions
    .map((entry) => `#${entry.step} ${entry.text} → ${entry.reasons.join(', ')}`)
    .join('\n');
}

function cloneState(state) {
  return {
    entities: Object.fromEntries(Object.entries(state.entities).map(([id, data]) => [id, {
      location: data.location,
      inventory: [...data.inventory],
      alive: data.alive
    }])),
    items: Object.fromEntries(Object.entries(state.items).map(([id, data]) => [id, {
      location: data.location,
      heldBy: data.heldBy
    }]))
  };
}

export function resetSnapshotCache(session) {
  session.snapshotCache = { step: -1, state: initStoryState(session) };
}

export function stateAtStep(session, targetStep) {
  if (session.history.length === 0) {
    return cloneState(initStoryState(session));
  }

  const limit = Math.max(
    0,
    Math.min(session.history.length - 1, Number.isFinite(targetStep) ? targetStep : session.history.length - 1)
  );
  if (!session.snapshotCache.state) resetSnapshotCache(session);

  if (limit < session.snapshotCache.step) {
    resetSnapshotCache(session);
  }

  for (let i = session.snapshotCache.step + 1; i <= limit; i += 1) {
    applyEventToState(session.snapshotCache.state, session.history[i].event);
  }
  session.snapshotCache.step = limit;

  return cloneState(session.snapshotCache.state);
}

export function parseTargetStep(session, stepValue) {
  if (stepValue === undefined || stepValue === null || stepValue === '') {
    return session.history.length - 1;
  }
  const numeric = Number(stepValue);
  if (!Number.isFinite(numeric)) return session.history.length - 1;
  return Math.max(0, Math.min(Math.floor(numeric), session.history.length - 1));
}

export function naiveReplayToStep(session, targetStep) {
  const state = initStoryState(session);
  if (session.history.length === 0) return state;
  const limit = clamp(targetStep, 0, session.history.length - 1);
  for (let i = 0; i <= limit; i += 1) {
    applyEventToState(state, session.history[i].event);
  }
  return state;
}

export function narrativePhaseFor(session, step) {
  return narrativePhaseForStep(session, step ?? session.history.length);
}
