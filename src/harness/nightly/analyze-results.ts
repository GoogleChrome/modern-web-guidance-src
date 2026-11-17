import fs from 'fs';
import { extractJobSummary } from '../../dashboard/summary-extractor.js';
import { formatRatePct } from '../../dashboard/utils.js';
import type { EvalsReport } from '../lib/metrics.ts';

interface GenerationError {
  testName: string;
  runNumber: number;
  message: string;
}

export function formatJobSummary(data: Partial<EvalsReport>): string {
  const summary = extractJobSummary('job', data);
  const totalTrials = summary?.totalTrials ?? 0;
  const infraErrors = summary?.earlyFailureCount ?? 0;
  if (!summary || totalTrials === 0 || infraErrors === totalTrials) return '';

  const { unguidedStats, guidedStats } = summary;
  const unguidedRate = unguidedStats.total > 0
    ? `${Math.round((unguidedStats.passed / unguidedStats.total) * 100)}% (${unguidedStats.passed}/${unguidedStats.total})`
    : 'N/A';
  const guidedRate = guidedStats.total > 0
    ? `${Math.round((guidedStats.passed / guidedStats.total) * 100)}% (${guidedStats.passed}/${guidedStats.total})`
    : 'N/A';
  const leakRate = formatRatePct(summary.unguidedLeakCount ?? 0, summary.unguidedTrialCount ?? 0);
  const errorRate = formatRatePct(infraErrors, totalTrials);

  return [
    `Unguided pass rate: ${unguidedRate}`,
    `Guided pass rate: ${guidedRate}`,
    `Leak rate: ${leakRate}%`,
    `Error rate: ${errorRate}%`,
  ].join('\n');
}

/** @deprecated Use formatJobSummary */
export const formatSuiteSummary = formatJobSummary;

function main(): void {
  const args = process.argv.slice(2);
  const evalsJsonPath = args[0];
  const outputFormat = args[1] || 'json'; // 'json', 'text', 'summary', 'has-data', 'errors-count', 'is-catastrophic-failure'

  if (!evalsJsonPath) {
    console.error('Usage: node analyze-results.ts <path-to-evals.json> [format]');
    process.exit(1);
  }

  if (outputFormat === 'summary') {
    try {
      const summary = formatJobSummary(JSON.parse(fs.readFileSync(evalsJsonPath, 'utf8')) as Partial<EvalsReport>);
      if (summary) console.log(summary);
    } catch {
      // No output when missing or unreadable.
    }
    return;
  }

  if (!fs.existsSync(evalsJsonPath)) {
    if (outputFormat === 'has-data') {
      console.log('false');
    } else if (outputFormat === 'is-catastrophic-failure') {
      console.log('false');
    } else if (outputFormat === 'errors-count') {
      console.log('0');
    } else if (outputFormat === 'text') {
      console.log('❌ Error: evals.json does not exist.');
    } else {
      console.log(JSON.stringify({ hasData: false, isCatastrophicFailure: false, error: 'evals.json does not exist', generationErrors: [] }));
    }
    process.exit(0);
  }

  try {
    const content = fs.readFileSync(evalsJsonPath, 'utf8');
    const data = JSON.parse(content) as Partial<EvalsReport>;

    const results = data.results || {};
    const testNames = Object.keys(results);

    if (testNames.length === 0) {
      if (outputFormat === 'has-data') {
        console.log('false');
      } else if (outputFormat === 'is-catastrophic-failure') {
        console.log('false');
      } else if (outputFormat === 'errors-count') {
        console.log('0');
      } else if (outputFormat === 'text') {
        console.log('⚠️ No evaluation data was generated (0 tasks were run).');
      } else {
        console.log(JSON.stringify({ hasData: false, isCatastrophicFailure: false, error: 'No tasks were run', generationErrors: [] }));
      }
      process.exit(0);
    }

    const generationErrors: GenerationError[] = [];
    let totalTrialsCount = 0;
    let infraErrorsCount = 0;

    for (const testName of testNames) {
      const trials = results[testName] || [];
      for (const trial of trials) {
        totalTrialsCount++;
        const trialChecks = trial.results || [];
        let trialHasInfraError = false;
        for (const check of trialChecks) {
          if (check.isEarlyFailure) {
            trialHasInfraError = true;
            generationErrors.push({
              testName,
              runNumber: trial.runNumber,
              message: check.message || 'Unknown generation error'
            });
          }
        }
        if (trialHasInfraError) {
          infraErrorsCount++;
        }
      }
    }

    const hasData = totalTrialsCount > 0;
    const isCatastrophicFailure = totalTrialsCount > 0 && infraErrorsCount === totalTrialsCount;

    if (outputFormat === 'has-data') {
      console.log(hasData ? 'true' : 'false');
    } else if (outputFormat === 'is-catastrophic-failure') {
      console.log(isCatastrophicFailure ? 'true' : 'false');
    } else if (outputFormat === 'errors-count') {
      console.log(String(generationErrors.length));
    } else if (outputFormat === 'text') {
      if (generationErrors.length > 0) {
        let text = `❌ Generation Errors (Total: ${generationErrors.length}):\n\n`;
        
        // Group errors by their message
        const groups: Record<string, GenerationError[]> = {};
        for (const err of generationErrors) {
          if (!groups[err.message]) {
            groups[err.message] = [];
          }
          groups[err.message].push(err);
        }

        // Output each error group cleanly
        for (const [message, errList] of Object.entries(groups)) {
          text += `  ● "${message}" (occurred on ${errList.length} tasks):\n`;
          
          const maxVisible = 10;
          const visibleList = errList.slice(0, maxVisible);
          visibleList.forEach((err, idx) => {
            text += `    ${idx + 1}. Run ${err.runNumber} - ${err.testName}\n`;
          });

          if (errList.length > maxVisible) {
            text += `    ... and ${errList.length - maxVisible} more tasks experienced this error.\n`;
          }
          text += `\n`;
        }
        
        console.log(text.trimEnd());
      } else {
        console.log('✅ No generation errors detected.');
      }
    } else {
      console.log(JSON.stringify({ hasData, isCatastrophicFailure, generationErrors }, null, 2));
    }

  } catch (err: any) {
    if (outputFormat === 'has-data') {
      console.log('false');
    } else if (outputFormat === 'is-catastrophic-failure') {
      console.log('false');
    } else if (outputFormat === 'errors-count') {
      console.log('0');
    } else if (outputFormat === 'text') {
      console.log(`❌ Error processing results: ${err.message}`);
    } else {
      console.log(JSON.stringify({ hasData: false, isCatastrophicFailure: false, error: `Failed to parse results: ${err.message}`, generationErrors: [] }));
    }
  }
}

if (import.meta.main) {
  main();
}
