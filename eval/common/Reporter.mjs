import fs from 'node:fs/promises';

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

const STRIP_ANSI = /\x1b\[[0-9;]*m/g;

function color(text, tone) {
  return `${ANSI[tone] ?? ''}${text}${ANSI.reset}`;
}

function stripAnsi(text) {
  return String(text).replace(STRIP_ANSI, '');
}

function padCell(value, width) {
  const raw = String(value);
  const len = stripAnsi(raw).length;
  if (len >= width) return raw;
  return `${raw}${' '.repeat(width - len)}`;
}

function formatTable(headers, rows) {
  const widths = headers.map((h, i) => {
    let w = stripAnsi(h).length;
    for (const row of rows) {
      w = Math.max(w, stripAnsi(row[i] ?? '').length);
    }
    return w;
  });

  const line = (cells) => cells.map((cell, i) => padCell(cell ?? '', widths[i])).join('  ');
  const separator = widths.map((w) => '-'.repeat(w)).join('  ');

  return [
    line(headers.map((h) => color(h, 'bold'))),
    separator,
    ...rows.map((row) => line(row))
  ].join('\n');
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return value.toLocaleString();
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(3);
}

function formatMetric(value) {
  if (!Number.isFinite(value)) return '—';
  if (value >= 0 && value <= 1) return formatPercent(value);
  return formatNumber(value);
}

function formatSpeedup(value) {
  if (!Number.isFinite(value)) return '—';
  const label = `${value.toFixed(2)}x`;
  if (value >= 1.2) return color(label, 'green');
  if (value >= 1.0) return color(label, 'yellow');
  return color(label, 'red');
}

export const Reporter = {
  summarize(experimentName, results) {
    return {
      experiment: experimentName,
      timestamp: new Date().toISOString(),
      results,
      summary: this.generateSummary(results),
      passedCriteria: this.checkCriteria(experimentName, results)
    };
  },

  generateSummary(results) {
    if (!results) return 'No results.';
    return 'Evaluation completed.';
  },

  checkCriteria(experimentName, results) {
    const criteria = [];

    if (experimentName === 'exp1-alignment') {
      const top1 = results?.scenarioA?.top1Acc ?? 0;
      const top5 = results?.scenarioA?.top5Acc ?? 0;
      criteria.push({ criterion: 'top1Acc', passed: top1 > 0.85, actual: top1, target: 0.85 });
      criteria.push({ criterion: 'top5Acc', passed: top5 > 0.95, actual: top5, target: 0.95 });

      if (results?.scenarioB?.consensusGain != null) {
        criteria.push({
          criterion: 'consensusGain',
          passed: results.scenarioB.consensusGain > 0.05,
          actual: results.scenarioB.consensusGain,
          target: 0.05
        });
      }

      const noiseBase = results?.scenarioA?.top1Acc ?? 0;
      const noiseAcc = results?.scenarioC?.top1Acc ?? 0;
      const noiseRobustness = noiseBase > 0 ? noiseAcc / noiseBase : 0;
      criteria.push({
        criterion: 'noiseRobustness',
        passed: noiseRobustness > 0.9,
        actual: noiseRobustness,
        target: 0.9
      });

      const ambiguous = results?.scenarioD?.top1Acc ?? 0;
      criteria.push({
        criterion: 'ambiguousDisambiguation',
        passed: ambiguous > 0.7,
        actual: ambiguous,
        target: 0.7
      });
    }

    if (experimentName === 'exp2-narrative') {
      const acc = results?.baseline?.accuracies?.[0]?.accuracy ?? 0;
      criteria.push({ criterion: 'stateAccuracy', passed: acc > 0.85, actual: acc, target: 0.85 });

      const coref = results?.coref?.corefResolution ?? 0;
      criteria.push({ criterion: 'corefResolution', passed: coref > 0.9, actual: coref, target: 0.9 });

      const motifAcc = results?.motifs?.accuracies?.[0]?.accuracy ?? 0;
      criteria.push({ criterion: 'motifHandling', passed: motifAcc > 0.75, actual: motifAcc, target: 0.75 });

      const timeLoc = results?.timeLocalization?.timeLocAccuracy ?? 0;
      criteria.push({ criterion: 'timeLocAccuracy', passed: timeLoc > 0.8, actual: timeLoc, target: 0.8 });

      const conflict = results?.conflictDetection?.detectionRate ?? 0;
      criteria.push({ criterion: 'conflictDetection', passed: conflict > 0.9, actual: conflict, target: 0.9 });
    }

    if (experimentName === 'exp3-rag') {
      const supportedPrecision = results?.supported?.metrics?.supportedPrecision ?? 0;
      criteria.push({ criterion: 'supportedPrecision', passed: supportedPrecision > 0.95, actual: supportedPrecision, target: 0.95 });

      const supportedRecall = results?.supported?.metrics?.supportedRecall ?? 0;
      criteria.push({ criterion: 'supportedRecall', passed: supportedRecall > 0.85, actual: supportedRecall, target: 0.85 });

      const refusalAccuracy = results?.unsupported?.metrics?.refusalAccuracy ?? 0;
      criteria.push({ criterion: 'refusalAccuracy', passed: refusalAccuracy > 0.9, actual: refusalAccuracy, target: 0.9 });

      const advRefusal = results?.adversarial?.metrics?.refusalAccuracy ?? 0;
      criteria.push({ criterion: 'adversarialRefusal', passed: advRefusal > 0.8, actual: advRefusal, target: 0.8 });

      const conflictPrecision = results?.conflicting?.metrics?.conflictPrecision ?? 0;
      const conflictRecall = results?.conflicting?.metrics?.conflictRecall ?? 0;
      criteria.push({ criterion: 'conflictPrecision', passed: conflictPrecision > 0.85, actual: conflictPrecision, target: 0.85 });
      criteria.push({ criterion: 'conflictRecall', passed: conflictRecall > 0.8, actual: conflictRecall, target: 0.8 });

      const hallucination = results?.supported?.metrics?.hallucinationRate ?? 0;
      criteria.push({ criterion: 'hallucinationRate', passed: hallucination < 0.05, actual: hallucination, target: 0.05 });

      const extractionConsistency = results?.extractionConsistency?.jaccardAvg ?? null;
      if (extractionConsistency != null) {
        criteria.push({ criterion: 'extractionConsistency', passed: extractionConsistency >= 0.8, actual: extractionConsistency, target: 0.8 });
      }

      const predicateCoverage = results?.predicateCoverage ?? null;
      if (predicateCoverage != null) {
        criteria.push({ criterion: 'predicateCoverage', passed: predicateCoverage >= 1.0, actual: predicateCoverage, target: 1.0 });
      }
    }

    if (experimentName === 'exp4-consensus') {
      const gain = results?.consensus?.consensusGainOverSingle ?? 0;
      criteria.push({ criterion: 'consensusGainOverSingle', passed: gain > 0.05, actual: gain, target: 0.05 });

      const baselineGain = results?.consensus?.consensusGainOverBaseline ?? 0;
      criteria.push({ criterion: 'consensusGainOverBaseline', passed: baselineGain > 0.05, actual: baselineGain, target: 0.05 });
    }

    return criteria;
  },

  async exportJSON(report, path) {
    await fs.writeFile(path, JSON.stringify(report, null, 2));
  },

  async exportMarkdown(report, path) {
    const content = `# ${report.experiment}\n\n${report.summary}\n`;
    await fs.writeFile(path, content);
  },

  print(report) {
    if (!report) {
      console.log(color('No report to display.', 'red'));
      return;
    }

    const header = `${report.experiment ?? 'experiment'}`.replace(/_/g, ' ');
    console.log(color(`\n=== ${header} ===`, 'cyan'));
    if (report.timestamp) console.log(color(`Timestamp: ${report.timestamp}`, 'dim'));
    if (report.summary) console.log(`${report.summary}`);

    if (report.experiment === 'exp5-performance') {
      return this.printExp5(report);
    }
    if (report.experiment === 'exp6-literature') {
      return this.printExp6(report);
    }

    const criteria = report.passedCriteria ?? [];
    if (criteria.length > 0) {
      const rows = criteria.map((c) => {
        const status = c.passed ? color('PASS', 'green') : color('FAIL', 'red');
        return [
          c.criterion ?? 'criterion',
          formatMetric(c.target),
          formatMetric(c.actual),
          status
        ];
      });
      console.log('\nCriteria');
      console.log(formatTable(['Criterion', 'Target', 'Actual', 'Status'], rows));
    }

    const metricsTable = this.buildMetricsTable(report.experiment, report.results ?? {});
    if (metricsTable) {
      console.log('\nKey Metrics');
      console.log(metricsTable);
    }

    const note = this.explain(report.experiment);
    if (note) {
      console.log(color(`\nNote: ${note}`, 'dim'));
    }
  },

  buildMetricsTable(experimentName, results) {
    if (!results) return null;
    if (experimentName === 'exp1-alignment') {
      const rows = [
        ['Scenario A top1', formatMetric(results?.scenarioA?.top1Acc)],
        ['Scenario A top5', formatMetric(results?.scenarioA?.top5Acc)],
        ['Scenario B consensus', formatMetric(results?.scenarioB?.consensusAcc)],
        ['Scenario B best column', formatMetric(results?.scenarioB?.bestColumnAcc)],
        ['Scenario B gain', formatMetric(results?.scenarioB?.consensusGain)],
        ['Scenario C noise top1', formatMetric(results?.scenarioC?.top1Acc)],
        ['Scenario D ambiguous top1', formatMetric(results?.scenarioD?.top1Acc)]
      ];
      return formatTable(['Metric', 'Value'], rows);
    }

    if (experimentName === 'exp2-narrative') {
      const rows = [
        ['State accuracy', formatMetric(results?.baseline?.accuracies?.[0]?.accuracy)],
        ['Coref resolution', formatMetric(results?.coref?.corefResolution)],
        ['Motif handling', formatMetric(results?.motifs?.accuracies?.[0]?.accuracy)],
        ['Time localization', formatMetric(results?.timeLocalization?.timeLocAccuracy)],
        ['Conflict detection', formatMetric(results?.conflictDetection?.detectionRate)]
      ];
      return formatTable(['Metric', 'Value'], rows);
    }

    if (experimentName === 'exp3-rag') {
      const rows = [
        ['Supported precision', formatMetric(results?.supported?.metrics?.supportedPrecision)],
        ['Supported recall', formatMetric(results?.supported?.metrics?.supportedRecall)],
        ['Refusal accuracy', formatMetric(results?.unsupported?.metrics?.refusalAccuracy)],
        ['Adversarial refusal', formatMetric(results?.adversarial?.metrics?.refusalAccuracy)],
        ['Conflict precision', formatMetric(results?.conflicting?.metrics?.conflictPrecision)],
        ['Conflict recall', formatMetric(results?.conflicting?.metrics?.conflictRecall)],
        ['Hallucination rate', formatMetric(results?.supported?.metrics?.hallucinationRate)],
        ['Extraction consistency', formatMetric(results?.extractionConsistency?.jaccardAvg)],
        ['Predicate coverage', formatMetric(results?.predicateCoverage)]
      ];
      return formatTable(['Metric', 'Value'], rows);
    }

    if (experimentName === 'exp4-consensus') {
      const rows = [
        ['Consensus gain vs single', formatMetric(results?.consensus?.consensusGainOverSingle)],
        ['Consensus gain vs baseline', formatMetric(results?.consensus?.consensusGainOverBaseline)]
      ];
      return formatTable(['Metric', 'Value'], rows);
    }

    return null;
  },

  printExp5(report) {
    const config = report.config ?? {};
    const ingest = report.ingest ?? {};
    const queries = report.queries ?? {};
    const localization = report.localization ?? {};

    console.log('\nIngestion');
    console.log(formatTable(
      ['Facts', 'Seconds', 'Facts/sec'],
      [[
        formatNumber(ingest.facts),
        formatNumber(ingest.ingestSeconds),
        formatNumber(ingest.factsPerSecond)
      ]]
    ));

    console.log('\nReplay Queries');
    console.log(formatTable(
      ['Queries', 'Naive (s)', 'VSA (s)', 'Speedup', 'Mismatches'],
      [[
        formatNumber(queries.totalQueries),
        formatNumber(queries.naiveSeconds),
        formatNumber(queries.vsaSeconds),
        formatSpeedup(queries.speedup),
        formatNumber(queries.mismatches)
      ]]
    ));

    console.log('\nReplay Steps');
    console.log(formatTable(
      ['Avg Naive Steps', 'Avg VSA Steps', 'Step Reduction'],
      [[
        formatNumber(queries.avgNaiveSteps),
        formatNumber(queries.avgReplaySteps),
        formatSpeedup(queries.stepReduction)
      ]]
    ));

    const perTypeRows = Object.entries(queries.perType ?? {}).map(([type, data]) => ([
      type,
      formatNumber(data.count),
      formatNumber(data.naiveAvgMs),
      formatNumber(data.vsaAvgMs),
      formatSpeedup(data.speedup)
    ]));
    if (perTypeRows.length > 0) {
      console.log('\nPer-Query Type (ms)');
      console.log(formatTable(['Type', 'Count', 'Naive', 'VSA', 'Speedup'], perTypeRows));
    }

    console.log('\nLocalization');
    console.log(formatTable(
      ['Window', 'Runs', 'Naive (s)', 'VSA (s)', 'Speedup', 'Work Ratio'],
      [[
        formatNumber(localization.windowSize),
        formatNumber(localization.perfRuns),
        formatNumber(localization.naiveSeconds),
        formatNumber(localization.vsaSeconds),
        formatSpeedup(localization.speedup),
        formatNumber(localization.workRatio)
      ]]
    ));

    console.log('\nConfig');
    console.log(formatTable(
      ['Facts', 'Queries', 'Columns', 'Checkpoint'],
      [[
        formatNumber(config.facts),
        formatNumber(config.queriesCount),
        formatNumber(config.numColumns),
        formatNumber(config.checkpointInterval)
      ]]
    ));

    if (Number.isFinite(queries.speedup) && queries.speedup < 1 && Number.isFinite(queries.stepReduction) && queries.stepReduction > 1.5) {
      console.log(color('Note: Replay steps are reduced, but fixed overhead dominates at this fact count.', 'yellow'));
    }
  },

  printExp6(report) {
    const rows = [[
      formatNumber(report.facts),
      formatNumber(report.queries),
      formatNumber(report.naiveMs),
      formatNumber(report.indexedMs),
      formatSpeedup(report.speedup)
    ]];
    console.log('\nSemantic Query Proxy');
    console.log(formatTable(['Facts', 'Queries', 'Naive (ms)', 'Indexed (ms)', 'Speedup'], rows));
  },

  printTable(title, headers, rows, note) {
    if (title) console.log(color(`\n${title}`, 'cyan'));
    console.log(formatTable(headers, rows));
    if (note) console.log(color(note, 'dim'));
  },

  explain(experimentName) {
    const notes = {
      'exp1-alignment': 'Higher Top-1/Top-5 means better localization; consensus gain should be positive.',
      'exp2-narrative': 'Accuracy and coreference show whether the narrative state stays coherent over time.',
      'exp3-rag': 'Precision/recall indicate grounded answers; hallucination rate should stay low.',
      'exp4-consensus': 'Positive gains show multi-column voting beats single-column baselines.',
      'exp5-performance': 'Speedup compares replay-with-checkpoints vs full replay from step 0.',
      'exp6-literature': 'Speedup compares indexed semantic spaces vs naive scans.'
    };
    return notes[experimentName] ?? null;
  }
};
