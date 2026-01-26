import { Vocabulary } from '../../src/util/Vocabulary.mjs';
import { hashCombineU32 } from '../../src/util/hash.mjs';

export function makeExp2Vocabulary() {
  return new Vocabulary({ mode: 'dynamic', maxSize: 100000 });
}

export function makeCorefState() {
  return { lastEntityId: null };
}

function resolveSubjectEntityId(event, corefState) {
  if (event.subject !== 'P') return event.subject;
  const resolved = event.resolvedSubject ?? corefState.lastEntityId;
  if (!resolved) {
    throw new Error('Coreference failed: subject="P" but no resolvedSubject and corefState.lastEntityId is null');
  }
  return resolved;
}

export function eventToTokens(event, vocab, corefState) {
  if (event.action === 'SCENE_RESET') {
    corefState.lastEntityId = null;
    return [vocab.id('EV:scene_reset')];
  }

  const subjectEntityId = resolveSubjectEntityId(event, corefState);
  corefState.lastEntityId = subjectEntityId;

  const subject = vocab.id(`S:${subjectEntityId}`);
  const predicate = vocab.id(`P:${event.action}`);
  const object = event.object == null ? vocab.id('O:∅') : vocab.id(`O:${event.object}`);
  return [subject, predicate, object];
}

export function eventToStepInput(event, vocab, corefState) {
  const eventTokenIds = eventToTokens(event, vocab, corefState);
  const stepTokenId = hashCombineU32(eventTokenIds);
  const writeTokenIds = [stepTokenId];
  return { stepTokenId, writeTokenIds, event };
}

export function queryToQuestion(q) {
  return `STATE? time=${q.time} entity=${q.entity} attribute=${q.attribute}`;
}
