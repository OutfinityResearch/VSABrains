import { VSABrains } from '../../src/index.mjs';
import { testCorpus, manualFacts, predicateVocabulary } from './corpus.mjs';
import { allQuestions, categorizeQuestions } from './questions.mjs';
import { Metrics } from '../common/Metrics.mjs';
import { Reporter } from '../common/Reporter.mjs';

export async function runExperiment3(config = {}) {
  const brain = new VSABrains({
    ...(config.brainConfig ?? {}),
    predicateVocabulary,
    extractor: config.extractorEnabled
      ? { enabled: true, predicateVocabulary, llmClient: config.llmClient }
      : { enabled: false }
  });

  for (const doc of testCorpus) {
    await brain.ingest(doc.text, { docId: doc.docId, version: doc.version });
  }

  if (!config.extractorEnabled) {
    for (const fact of manualFacts) {
      await brain.factStore.add(fact);
    }
  }

  const extractionStats = await brain.getFactStats();
  const questions = categorizeQuestions(allQuestions);
  const results = {
    extraction: extractionStats,
    supported: await runCategory(brain, questions.supported),
    unsupported: await runCategory(brain, questions.unsupported),
    adversarial: await runCategory(brain, questions.adversarial),
    conflicting: await runCategory(brain, questions.conflicting),
    multihop: await runCategory(brain, questions.multihop)
  };

  return Reporter.summarize('exp3-rag', results);
}

async function runCategory(brain, questions) {
  const results = [];
  for (const q of questions) {
    const answer = await brain.answer(q.plan ?? q.question);
    results.push({
      question: q.question,
      expected: { verdict: q.expectedVerdict, answer: q.expectedAnswer },
      actual: {
        verdict: answer.verdict,
        answer: answer.text,
        chunks: answer.chunksUsed,
        chain: answer.factChain,
        scores: answer.supportScores
      },
      correct: evaluateAnswer(q, answer)
    });
  }

  return {
    results,
    metrics: Metrics.computeRAGMetrics(results)
  };
}

function evaluateAnswer(question, answer) {
  const verdictMatch = answer.verdict === question.expectedVerdict;
  let answerMatch = true;
  if (question.expectedVerdict === 'supported' && question.expectedAnswer) {
    answerMatch = normalizeAnswer(answer.text) === normalizeAnswer(question.expectedAnswer);
  }
  let refusalMatch = true;
  if (question.expectedVerdict === 'unsupported') {
    refusalMatch = answer.verdict === 'unsupported' || answer.text === null;
  }
  return { verdictMatch, answerMatch, refusalMatch, overall: verdictMatch && answerMatch && refusalMatch };
}

function normalizeAnswer(text) {
  return String(text ?? '').trim().toLowerCase();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await runExperiment3({});
  console.log(JSON.stringify(report, null, 2));
}
