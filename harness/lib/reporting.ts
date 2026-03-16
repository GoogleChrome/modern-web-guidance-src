import fs from 'fs';
import path from 'path';
import type { Metrics, RunResult, ScenarioCheck } from './metrics.ts';

export function generateMarkdownReport(metrics: Metrics, allResults: Record<string, RunResult[]>): string {
  const { summary, testStats, sortedKeys } = metrics;
  let md = '# Evaluation Results\n\n';

  md += `
| Group | Pass Rate | Test Runs |
|---|---|---|
| **Unguided** | ${summary.unguidedPassRate}% (${summary.unguidedPassed}/${summary.unguidedTotal}) | ${summary.runsPerTest} |
| **Guided** | ${summary.guidedPassRate}% (${summary.guidedPassed}/${summary.guidedTotal}) | ${summary.runsPerTest} |

`;

  // Generate detailed sections for each test
  for (const name of sortedKeys) {
    const runs = allResults[name];
    const stats = testStats[name];
    
    md += `## ${name.toUpperCase()} (Median: ${stats.medianPassRate}%)\n\n`;
    md += `**Pass rates across runs:** ${stats.runPassRates.join('%, ')}%\n\n`;

    // Show the median run's detailed results
    const medianRunIndex = runs.findIndex((run: RunResult) => {
      const checks = run.results;
      const passCount = checks.filter((c: ScenarioCheck) => c.passed).length;
      const totalCount = checks.length;
      const rate = Math.round((passCount / totalCount) * 100);
      return rate === stats.medianPassRate;
    });

    const displayRun = medianRunIndex >= 0 ? runs[medianRunIndex] : runs[0];
    const checks = displayRun.results;
    const groupPass = checks.filter((c: ScenarioCheck) => c.passed).length;
    const groupTotal = checks.length;

    md += `### Run ${displayRun.runNumber} Details (${groupPass}/${groupTotal})\n\n`;

    const tableHeader = '| Status | Expectation |\n|---|---|\n';
    let tableRows = '';

    checks.forEach((check: ScenarioCheck) => {
      const symbol = check.passed ? '✅' : '❌';
      const safeMessage = (check.message || '').replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
      tableRows += `| ${symbol} | ${safeMessage} |\n`;
    });

    md += tableHeader + tableRows + '\n';
  }

  return md;
}

export function generateJsonReport(metrics: Metrics, allResults: Record<string, RunResult[]>, timestamp: string, runCount: number, agent: string, enableSkills: boolean) {
  return {
    summary: metrics.summary,
    results: allResults,
    stats: metrics.testStats,
    timestamp,
    runCount,
    agent,
    enableSkills
  };
}

export function saveReports(resultsDir: string, markdown: string, json: any) {
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(path.join(resultsDir, 'evals.md'), markdown);
  fs.writeFileSync(path.join(resultsDir, 'evals.json'), JSON.stringify(json, null, 2));
}
