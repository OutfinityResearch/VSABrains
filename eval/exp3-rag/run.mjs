import { VSABrains } from '../../src/index.mjs';
import { testCorpus, manualFacts, predicateVocabulary } from './corpus.mjs';
import { allQuestions, categorizeQuestions } from './questions.mjs';
import { Metrics } from '../common/Metrics.mjs';
import { Reporter } from '../common/Reporter.mjs';

export async function runExperiment3(config = {}) {
  const extractorEnabled = config.extractorEnabled ?? true;
  const llmClient = config.llmClient ?? makeDeterministicLLMClient();
  const brain = new VSABrains({
    ...(config.brainConfig ?? {}),
    predicateVocabulary,
    extractor: extractorEnabled
      ? { enabled: true, predicateVocabulary, llmClient }
      : { enabled: false }
  });

  for (const doc of testCorpus) {
    await brain.ingest(doc.text, { docId: doc.docId, version: doc.version });
  }

  if (!extractorEnabled) {
    for (const fact of manualFacts) {
      await brain.factStore.add(fact);
    }
  }

  const extractionStats = await brain.getFactStats();
  let extractionConsistency = null;
  if (extractorEnabled && brain.factExtractor) {
    const sampleText = testCorpus[0]?.text ?? '';
    extractionConsistency = await brain.factExtractor.consistencyCheck(sampleText, 3);
  }
  const predicateCoverage = computePredicateCoverage(extractionStats, predicateVocabulary);
  const questions = categorizeQuestions(allQuestions);
  const results = {
    extraction: extractionStats,
    extractionConsistency,
    predicateCoverage,
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

function makeDeterministicLLMClient() {
  return {
    async complete(prompt) {
      const text = extractTextFromPrompt(prompt);
      const facts = [];

      const v2Match = /session tokens expire after 15 minutes/i.exec(text);
      const v1Match = /session tokens expire after 30 minutes/i.exec(text);

      if (v2Match) {
        facts.push({
          span: { start: v2Match.index, end: v2Match.index + v2Match[0].length },
          subject: 'session_token',
          predicate: 'expires_after',
          object: '15 minutes',
          source: { docId: 'spec-auth-v2', chunkId: 'c2' }
        });
      }
      if (v1Match) {
        facts.push({
          span: { start: v1Match.index, end: v1Match.index + v1Match[0].length },
          subject: 'session_token',
          predicate: 'expires_after',
          object: '30 minutes',
          source: { docId: 'spec-auth-v1', chunkId: 'c1' }
        });
      }

      return { content: JSON.stringify(facts) };
    }
  };
}

function extractTextFromPrompt(prompt) {
  const marker = 'Text:';
  const idx = prompt.lastIndexOf(marker);
  if (idx === -1) return prompt;
  return prompt.slice(idx + marker.length).trim();
}

function computePredicateCoverage(extractionStats, vocabulary) {
  const total = extractionStats.totalFacts ?? 0;
  if (total === 0) return 0;
  const allowed = new Set(Object.keys(vocabulary ?? {}));
  let covered = 0;
  for (const [pred, count] of Object.entries(extractionStats.byPredicate ?? {})) {
    if (allowed.has(pred)) covered += count;
  }
  return covered / total;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await runExperiment3({});
  Reporter.print(report);
}
