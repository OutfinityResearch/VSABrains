import {
  LIT_THEMES,
  LIT_MOTIFS,
  LIT_TONES,
  LIT_CONFLICTS,
  LIT_PLOT_TURNS,
  LIT_EMOTIONS,
  CHAT_SENTIMENTS,
  CHAT_POLITENESS,
  CHAT_PERSUASION,
  CHAT_RESOLUTION,
  DEFAULT_STORY_EVENTS
} from './constants.mjs';
import { makeRng, pick } from './utils.mjs';
import { detectContradictions, narrativePhaseForStep } from './world.mjs';
import { detectSemanticContradictions } from './semantic.mjs';
import { addEvent } from './state.mjs';
import { clampStoryCount } from './session.mjs';

export function randomEvent(session, rng, allowAbsurd = true) {
  const subject = pick(rng, session.world.entities);
  const action = pick(rng, session.world.actions).id;
  const actionDef = session.world.actions.find((a) => a.id === action) ?? { objectType: 'none' };

  let object = null;
  if (actionDef.objectType === 'location') {
    object = pick(rng, session.world.locations);
  }
  if (actionDef.objectType === 'item') {
    object = pick(rng, session.world.items);
  }
  if (actionDef.objectType === 'entity') {
    const options = session.world.entities.filter((id) => id !== subject);
    object = options.length > 0 ? pick(rng, options) : pick(rng, session.world.entities);
  }

  if (allowAbsurd && rng() < 0.2) {
    const deadEntities = Object.entries(session.storyState.entities)
      .filter(([, data]) => data.alive === false)
      .map(([id]) => id);
    if (deadEntities.length > 0) {
      const absurdAction = pick(rng, ['moves_to', 'picks_up', 'drops']);
      let absurdObject = null;
      if (absurdAction === 'moves_to') absurdObject = pick(rng, session.world.locations);
      if (absurdAction === 'picks_up' || absurdAction === 'drops') absurdObject = pick(rng, session.world.items);
      return {
        subject: pick(rng, deadEntities),
        action: absurdAction,
        object: absurdObject
      };
    }
  }

  return { subject, action, object };
}

export function safeEvent(session, rng) {
  const entities = session.world.entities;
  const items = session.world.items;
  const locations = session.world.locations;

  const subject = pick(rng, entities);
  const entity = session.storyState.entities[subject];
  if (!entity) return { subject, action: 'enters', object: pick(rng, locations) };

  if (entity.alive === false) {
    return { subject, action: 'revives', object: null };
  }

  const roll = rng();
  if (roll < 0.35) {
    return { subject, action: 'moves_to', object: pick(rng, locations) };
  }
  if (roll < 0.6) {
    const available = items.filter((id) => {
      const item = session.storyState.items[id];
      return item && item.heldBy == null;
    });
    if (available.length > 0) {
      return { subject, action: 'picks_up', object: pick(rng, available) };
    }
    return { subject, action: 'moves_to', object: pick(rng, locations) };
  }
  if (entity.inventory.length > 0) {
    return { subject, action: 'drops', object: pick(rng, entity.inventory) };
  }
  return { subject, action: 'enters', object: pick(rng, locations) };
}

function makeFact(frame, payload = {}) {
  return { frame, ...payload };
}

function ensureLiteratureContext(session, rng) {
  if (!session.litContext) {
    session.litContext = {
      theme: pick(rng, LIT_THEMES),
      motif: pick(rng, LIT_MOTIFS),
      tone: pick(rng, LIT_TONES),
      conflict: pick(rng, LIT_CONFLICTS),
      plotTurn: pick(rng, LIT_PLOT_TURNS)
    };
  }
  const ctx = session.litContext;
  const step = session.history.length;
  if (step > 0 && step % 50 === 0) {
    ctx.theme = pick(rng, LIT_THEMES);
    ctx.motif = pick(rng, LIT_MOTIFS);
    ctx.tone = pick(rng, LIT_TONES);
    ctx.conflict = pick(rng, LIT_CONFLICTS);
    ctx.plotTurn = pick(rng, LIT_PLOT_TURNS);
  }
  return ctx;
}

function ensureChatContext(session, rng) {
  if (!session.chatContext) {
    session.chatContext = {
      topic: pick(rng, session.world.items),
      sentiment: pick(rng, CHAT_SENTIMENTS),
      politeness: pick(rng, CHAT_POLITENESS),
      persuasion: pick(rng, CHAT_PERSUASION),
      resolution: pick(rng, CHAT_RESOLUTION)
    };
  }
  const ctx = session.chatContext;
  const step = session.history.length;
  if (step > 0 && step % 60 === 0) {
    ctx.topic = pick(rng, session.world.items);
    ctx.sentiment = pick(rng, CHAT_SENTIMENTS);
    ctx.politeness = pick(rng, CHAT_POLITENESS);
    ctx.persuasion = pick(rng, CHAT_PERSUASION);
    ctx.resolution = pick(rng, CHAT_RESOLUTION);
  }
  return ctx;
}

function generateLiteratureEvent(session, rng, allowAbsurd = true) {
  const step = session.history.length;
  const subject = pick(rng, session.world.entities);
  const target = pick(rng, session.world.entities.filter((id) => id !== subject));
  const location = pick(rng, session.world.locations);
  const item = pick(rng, session.world.items);
  const phase = narrativePhaseForStep(session, step);
  const ctx = ensureLiteratureContext(session, rng);

  const beat = pick(rng, [
    'scene_move',
    'confession',
    'accusation',
    'betrayal',
    'vow',
    'secret',
    'consolation',
    'threat',
    'reveal'
  ]);

  const emotion = pick(rng, LIT_EMOTIONS);
  const tone = rng() < 0.25 ? pick(rng, LIT_TONES) : ctx.tone;
  const theme = rng() < 0.25 ? pick(rng, LIT_THEMES) : ctx.theme;
  const conflict = rng() < 0.2 ? pick(rng, LIT_CONFLICTS) : ctx.conflict;
  const motif = rng() < 0.25 ? pick(rng, LIT_MOTIFS) : ctx.motif;
  const plotTurn = rng() < 0.3 ? pick(rng, LIT_PLOT_TURNS) : ctx.plotTurn;

  const facts = [
    makeFact('emotionState', { kind: 'entity', subject, value: emotion, weight: 2 }),
    makeFact('toneStyle', { kind: 'tag', value: tone, weight: 2 }),
    makeFact('themeTags', { kind: 'tag', value: theme, weight: 3 }),
    makeFact('conflictType', { kind: 'tag', value: conflict, weight: 2 }),
    makeFact('motifRecurrence', { kind: 'tag', value: motif, weight: 2 }),
    makeFact('plotTurns', { kind: 'tag', value: plotTurn, weight: 2 }),
    makeFact('narrativePhase', { kind: 'tag', value: phase, weight: 2 }),
    makeFact('symbolismType', { kind: 'tag', value: pick(rng, ['mirror', 'storm', 'threshold', 'flame']), weight: 1 }),
    makeFact('moralTheme', { kind: 'tag', value: pick(rng, ['duty', 'desire', 'betrayal', 'redemption']), weight: 1 }),
    makeFact('imageryDensity', { kind: 'tag', value: pick(rng, ['sparse', 'lush', 'surreal']), weight: 1 }),
    makeFact('voiceRegister', { kind: 'tag', value: pick(rng, ['intimate', 'formal', 'lyrical']), weight: 1 }),
    makeFact('predictedEmotion', { kind: 'tag', value: pick(rng, ['melancholy', 'wonder', 'tension', 'hope']), weight: 1 }),
    makeFact('emotionalAftertaste', { kind: 'tag', value: pick(rng, ['bittersweet', 'uneasy', 'uplifted']), weight: 1 }),
    makeFact('tensionLevel', { kind: 'level', delta: rng() < 0.5 ? 1 : -1 }),
    makeFact('characterArc', { kind: 'entity', subject, value: rng() < 0.5 ? 'rising' : 'falling' }),
    makeFact('narratorReliability', { kind: 'tag', value: rng() < 0.8 ? 'reliable' : 'unreliable' }),
    makeFact('powerBalance', { kind: 'relation', subject, object: target, value: rng() < 0.5 ? 2 : -2 }),
    makeFact('goalState', { kind: 'tag', value: pick(rng, ['seek_truth', 'protect', 'escape', 'reconcile']), weight: 1 })
  ];

  if (rng() < 0.4) {
    facts.push(makeFact('emotionState', { kind: 'entity', subject: target, value: pick(rng, LIT_EMOTIONS), weight: 1 }));
  }

  if (beat === 'scene_move') {
    return {
      subject,
      action: 'moves_to',
      object: location,
      text: `${subject} moves to the ${location}, under a ${tone} mood.`,
      semanticFacts: facts
    };
  }

  if (beat === 'confession') {
    facts.push(makeFact('dialogueAct', { kind: 'entity', subject, value: 'confess' }));
    facts.push(makeFact('trustRelation', { kind: 'relation', subject, object: target, value: 2 }));
    facts.push(makeFact('stanceAgreement', { kind: 'stance', subject, object: theme, value: 'agree' }));
    return {
      subject,
      action: 'confesses_to',
      object: target,
      text: `${subject} confesses to ${target} about the ${theme}.`,
      semanticFacts: facts
    };
  }

  if (beat === 'accusation') {
    facts.push(makeFact('hostilityRelation', { kind: 'relation', subject, object: target, value: 3 }));
    facts.push(makeFact('dialogueAct', { kind: 'entity', subject, value: 'accuse' }));
    return {
      subject,
      action: 'accuses',
      object: target,
      text: `${subject} accuses ${target} near the ${location}.`,
      semanticFacts: facts
    };
  }

  if (beat === 'betrayal') {
    facts.push(makeFact('hostilityRelation', { kind: 'relation', subject, object: target, value: 5 }));
    facts.push(makeFact('conflictEscalation', { kind: 'level', delta: 2 }));
    facts.push(makeFact('secretState', { kind: 'entity', subject, value: 'holds_secret' }));
    return {
      subject,
      action: 'betrays',
      object: target,
      text: `${subject} betrays ${target}, deepening the conflict.`,
      semanticFacts: facts
    };
  }

  if (beat === 'vow') {
    facts.push(makeFact('allianceRelation', { kind: 'relation', subject, object: target, value: 'ally' }));
    facts.push(makeFact('dominanceMoves', { kind: 'entity', subject, value: 'yield' }));
    facts.push(makeFact('stanceAgreement', { kind: 'stance', subject, object: theme, value: 'agree' }));
    return {
      subject,
      action: 'vows_to',
      object: target,
      text: `${subject} vows loyalty to ${target}.`,
      semanticFacts: facts
    };
  }

  if (beat === 'secret') {
    facts.push(makeFact('secretState', { kind: 'entity', subject, value: 'holds_secret' }));
    facts.push(makeFact('deceptionSignals', { kind: 'entity', subject, value: 'high' }));
    return {
      subject,
      action: 'picks_up',
      object: item,
      text: `${subject} hides the ${item} without telling anyone.`,
      semanticFacts: facts
    };
  }

  if (beat === 'consolation') {
    facts.push(makeFact('emotionState', { kind: 'entity', subject: target, value: pick(rng, LIT_EMOTIONS) }));
    facts.push(makeFact('intimacyRelation', { kind: 'relation', subject, object: target, value: 2 }));
    return {
      subject,
      action: 'consoles',
      object: target,
      text: `${subject} consoles ${target} in the ${location}.`,
      semanticFacts: facts
    };
  }

  if (beat === 'threat') {
    facts.push(makeFact('conflictEscalation', { kind: 'level', delta: 2 }));
    facts.push(makeFact('dominanceMoves', { kind: 'entity', subject, value: 'assert' }));
    return {
      subject,
      action: 'threatens',
      object: target,
      text: `${subject} threatens ${target} about the ${theme}.`,
      semanticFacts: facts
    };
  }

  if (beat === 'reveal') {
    facts.push(makeFact('secretState', { kind: 'tag', value: 'revealed' }));
    facts.push(makeFact('plotTurns', { kind: 'tag', value: 'reveal' }));
    return {
      subject,
      action: 'reveals_to',
      object: target,
      text: `${subject} reveals a secret to ${target}.`,
      semanticFacts: facts
    };
  }

  if (allowAbsurd && rng() < 0.05) {
    return {
      subject: pick(rng, session.world.entities),
      action: 'dies',
      object: null,
      text: `${subject} collapses suddenly.`,
      semanticFacts: facts
    };
  }

  return {
    subject,
    action: 'moves_to',
    object: location,
    text: `${subject} moves to the ${location}.`,
    semanticFacts: facts
  };
}

function generateChatEvent(session, rng, allowAbsurd = true) {
  const step = session.history.length;
  const subject = pick(rng, session.world.entities);
  const target = pick(rng, session.world.entities.filter((id) => id !== subject));
  const ctx = ensureChatContext(session, rng);
  const topic = ctx.topic;
  const phase = narrativePhaseForStep(session, step);

  const sentiment = ctx.sentiment;
  const politeness = ctx.politeness;
  const persuasion = ctx.persuasion;
  const resolution = ctx.resolution;

  const facts = [
    makeFact('emotionState', { kind: 'entity', subject, value: sentiment, weight: 2 }),
    makeFact('themeTags', { kind: 'tag', value: topic, weight: 3 }),
    makeFact('politenessLevel', { kind: 'tag', value: politeness, weight: 2 }),
    makeFact('persuasionTactic', { kind: 'tag', value: persuasion, weight: 2 }),
    makeFact('narrativePhase', { kind: 'tag', value: phase, weight: 2 }),
    makeFact('beliefState', { kind: 'tag', value: pick(rng, ['uncertain', 'confident', 'skeptical']), weight: 1 }),
    makeFact('evidenceStrength', { kind: 'tag', value: pick(rng, ['low', 'medium', 'high']), weight: 1 }),
    makeFact('uncertaintyLevel', { kind: 'tag', value: pick(rng, ['low', 'moderate', 'high']), weight: 1 }),
    makeFact('conflictEscalation', { kind: 'level', delta: sentiment === 'frustrated' ? 2 : 0 }),
    makeFact('speakerTurns', { kind: 'tag', value: subject, weight: 2 }),
    makeFact('goalState', { kind: 'tag', value: pick(rng, ['align', 'decide', 'clarify', 'de-escalate']) }),
    makeFact('planProgress', { kind: 'tag', value: pick(rng, ['follow_up', 'assign_owner', 'next_step']) })
  ];

  const beat = pick(rng, ['ask', 'assert', 'agree', 'disagree', 'apology', 'insult', 'share', 'moderate']);

  if (beat === 'ask') {
    facts.push(makeFact('dialogueAct', { kind: 'entity', subject, value: 'ask' }));
    return {
      subject,
      action: 'asks',
      object: topic,
      text: `${subject}: Could we revisit the ${topic}?`,
      semanticFacts: facts
    };
  }

  if (beat === 'assert') {
    facts.push(makeFact('dialogueAct', { kind: 'entity', subject, value: 'assert' }));
    return {
      subject,
      action: 'says',
      object: topic,
      text: `${subject}: The ${topic} needs a clear owner.`,
      semanticFacts: facts
    };
  }

  if (beat === 'agree') {
    facts.push(makeFact('stanceAgreement', { kind: 'stance', subject, object: topic, value: 'agree' }));
    return {
      subject,
      action: 'agrees',
      object: topic,
      text: `${subject}: I agree on the ${topic}.`,
      semanticFacts: facts
    };
  }

  if (beat === 'disagree') {
    facts.push(makeFact('stanceAgreement', { kind: 'stance', subject, object: topic, value: 'disagree' }));
    facts.push(makeFact('conflictEscalation', { kind: 'level', delta: 1 }));
    return {
      subject,
      action: 'disagrees',
      object: topic,
      text: `${subject}: I disagree about the ${topic}.`,
      semanticFacts: facts
    };
  }

  if (beat === 'apology') {
    facts.push(makeFact('dialogueAct', { kind: 'entity', subject, value: 'apologize' }));
    return {
      subject,
      action: 'apologizes',
      object: null,
      text: `${subject}: Sorry for the confusion.`,
      semanticFacts: facts
    };
  }

  if (beat === 'insult') {
    facts.push(makeFact('dialogueAct', { kind: 'entity', subject, value: 'insult' }));
    facts.push(makeFact('hostilityRelation', { kind: 'relation', subject, object: target, value: 3 }));
    return {
      subject,
      action: 'insults',
      object: target,
      text: `${subject}: ${target}, that makes no sense.`,
      semanticFacts: facts
    };
  }

  if (beat === 'share') {
    facts.push(makeFact('dialogueAct', { kind: 'entity', subject, value: 'share' }));
    facts.push(makeFact('evidenceStrength', { kind: 'tag', value: 'medium' }));
    return {
      subject,
      action: 'shares',
      object: topic,
      text: `${subject}: Sharing notes on the ${topic}.`,
      semanticFacts: facts
    };
  }

  if (beat === 'moderate') {
    facts.push(makeFact('dominanceMoves', { kind: 'entity', subject, value: 'assert' }));
    facts.push(makeFact('narratorReliability', { kind: 'tag', value: resolution === 'resolved' ? 'reliable' : 'biased' }));
    return {
      subject,
      action: 'moderates',
      object: target,
      text: `${subject}: Let's keep this constructive.`,
      semanticFacts: facts
    };
  }

  if (allowAbsurd && rng() < 0.05) {
    return {
      subject,
      action: 'leaves',
      object: null,
      text: `${subject} leaves the channel abruptly.`,
      semanticFacts: facts
    };
  }

  return {
    subject,
    action: 'says',
    object: topic,
    text: `${subject}: Noted on the ${topic}.`,
    semanticFacts: facts
  };
}

export function generateEventByMode(session, rng, allowAbsurd = true) {
  if (session.contentMode === 'literature') {
    return generateLiteratureEvent(session, rng, allowAbsurd);
  }
  if (session.contentMode === 'chat') {
    return generateChatEvent(session, rng, allowAbsurd);
  }
  return randomEvent(session, rng, allowAbsurd);
}

export async function generateEvents(session, count, seed, allowAbsurd = true) {
  const rng = makeRng(seed ?? Date.now());
  const total = clampStoryCount(count, DEFAULT_STORY_EVENTS);
  session.targetLength = Math.max(total, session.history.length + total);
  for (let i = 0; i < total; i += 1) {
    if (allowAbsurd) {
      await addEvent(session, generateEventByMode(session, rng, true));
      continue;
    }
    let attempts = 0;
    let event = generateEventByMode(session, rng, false);
    let reasons = [
      ...detectContradictions(session, event),
      ...detectSemanticContradictions(session, event, event.semanticFacts ?? [])
    ];
    while (reasons.length > 0 && attempts < 12) {
      event = generateEventByMode(session, rng, false);
      reasons = [
        ...detectContradictions(session, event),
        ...detectSemanticContradictions(session, event, event.semanticFacts ?? [])
      ];
      attempts += 1;
    }
    await addEvent(session, event);
  }
}
