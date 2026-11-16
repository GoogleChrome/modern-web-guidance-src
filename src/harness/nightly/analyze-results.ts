import fs from 'fs';
import { extractJobSummary } from '../../dashboard/summary-extractor.js';
import { isInfraErrorTrial, isUnguidedLeakTrial, parseResultKey } from '../../dashboard/utils.js';
import type { EvalsReport } from '../lib/metrics.ts';

interface GenerationError {
  testName: string;
  runNumber: number;
  message: string;
}

function formatPct(n: number, d: number): number {
  const raw = d > 0 ? (n / d) * 100 : 0;
  return raw > 0 && raw < 1 ? Number(raw.toFixed(1)) : Math.round(raw);
}

export function formatSuiteSummary(data: Partial<EvalsReport>): string {
  let totalTrials = 0;
  let unguidedTrials = 0;
  let leaks = 0;
  let infraErrors = 0;
  for (const [key, runs] of Object.entries(data.results ?? {})) {
    totalTrials += runs.length;
    const isUnguided = key.endsWith(' - unguided');
    if (isUnguided) unguidedTrials += runs.length;
    const guide = isUnguided ? parseResultKey(key)?.guide : undefined;
    for (const r of runs) {
      if (isInfraErrorTrial(r.results)) infraErrors++;
      if (isUnguided && isUnguidedLeakTrial(r, guide)) leaks++;
    }
  }
  if (totalTrials === 0 || infraErrors === totalTrials) return '';
  const s = extractJobSummary('suite', data);
  if (!s) return '';
  const { unguidedStats: u, guidedStats: g } = s;
  const uRate = u.total > 0 ? `${Math.round((u.passed / u.total) * 100)}% (${u.passed}/${u.total})` : 'N/A';
  const gRate = g.total > 0 ? `${Math.round((g.passed / g.total) * 100)}% (${g.passed}/${g.total})` : 'N/A';
  return [
    `Unguided pass rate: ${uRate}`,
    `Guided pass rate: ${gRate}`,
    `Leak rate: ${formatPct(leaks, unguidedTrials)}%`,
    `Error rate: ${formatPct(infraErrors, totalTrials)}%`,
  ].join('\n');
}

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
      const summary = formatSuiteSummary(JSON.parse(fs.readFileSync(evalsJsonPath, 'utf8')) as Partial<EvalsReport>);
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
    let totalRunsCount = 0;
    let earlyFailuresCount = 0;

    for (const testName of testNames) {
      const runs = results[testName] || [];
      for (const run of runs) {
        totalRunsCount++;
        const scenarioChecks = run.results || [];
        let runHasEarlyFailure = false;
        for (const check of scenarioChecks) {
          if (check.isEarlyFailure) {
            runHasEarlyFailure = true;
            generationErrors.push({
              testName,
              runNumber: run.runNumber,
              message: check.message || 'Unknown generation error'
            });
          }
        }
        if (runHasEarlyFailure) {
          earlyFailuresCount++;
        }
      }
    }

    const hasData = totalRunsCount > 0;
    const isCatastrophicFailure = totalRunsCount > 0 && earlyFailuresCount === totalRunsCount;

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
