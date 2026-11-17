import fs from 'fs';
import path from 'path';
import type { Metrics, TrialResult, TrialCheck, EvalsReport } from './metrics.ts';
import type { ReasoningEffort } from './reasoning-effort.ts';

function pickDisplayTrial(trials: TrialResult[] | undefined, medianPassRate: number): TrialResult | undefined {
  if (!trials || trials.length === 0) return undefined;
  const medianTrialIndex = trials.findIndex((trial: TrialResult) => {
    const checks = trial.results;
    const passCount = checks.filter((c: TrialCheck) => c.passed).length;
    const totalCount = checks.length;
    const rate = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;
    return rate === medianPassRate;
  });
  return medianTrialIndex >= 0 ? trials[medianTrialIndex] : trials[0];
}

function escapeMarkdownCell(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatPassRates(trialPassRates: number[] | undefined): string {
  return trialPassRates && trialPassRates.length > 0 ? `${trialPassRates.join('%, ')}%` : 'N/A';
}

export function generateMarkdownReport(metrics: Metrics, allResults: Record<string, TrialResult[]>): string {
  const { summary, testStats, sortedKeys } = metrics;
  let md = `| Group | Pass Rate | Trials |
|---|---|---|
| **Unguided** | ${summary.unguidedPassRate}% (${summary.unguidedPassed}/${summary.unguidedTotal}) | ${summary.runsPerTest} |
| **Guided** | ${summary.guidedPassRate}% (${summary.guidedPassed}/${summary.guidedTotal}) | ${summary.runsPerTest} |

`;

  const seenPrefixes = new Set<string>();
  const prefixes: string[] = [];
  for (const name of sortedKeys) {
    const prefix = name.replace(/ - (guided|unguided)$/, '');
    if (!seenPrefixes.has(prefix)) {
      seenPrefixes.add(prefix);
      prefixes.push(prefix);
    }
  }

  for (const prefix of prefixes) {
    const unguidedKey = `${prefix} - unguided`;
    const guidedKey = `${prefix} - guided`;
    const unguidedStats = testStats[unguidedKey];
    const guidedStats = testStats[guidedKey];
    const unguidedDisplay = unguidedStats ? pickDisplayTrial(allResults[unguidedKey], unguidedStats.medianPassRate) : undefined;
    const guidedDisplay = guidedStats ? pickDisplayTrial(allResults[guidedKey], guidedStats.medianPassRate) : undefined;

    md += `## ${prefix.toUpperCase()}\n\n`;

    const activeStats = [
      unguidedStats ? { label: 'Unguided', stats: unguidedStats } : null,
      guidedStats ? { label: 'Guided', stats: guidedStats } : null,
    ].filter((x): x is { label: string; stats: NonNullable<typeof unguidedStats> } => x !== null);

    const hasEmptyPassRates = activeStats.some(s => s.stats.runPassRates.length === 0);
    if (summary.runsPerTest > 1 || hasEmptyPassRates) {
      if (activeStats.length === 1) {
        md += `**Pass rates across trials:** ${formatPassRates(activeStats[0].stats.runPassRates)}\n\n`;
      } else if (activeStats.length > 1) {
        const parts = activeStats.map(
          s => `${s.label}: ${formatPassRates(s.stats.runPassRates)} (Median: ${s.stats.medianPassRate}%)`
        );
        md += `**Pass rates across trials:** ${parts.join(' | ')}\n\n`;
      }
    }

    if (guidedDisplay?.guidesUsed && guidedDisplay.guidesUsed.length > 0) {
      md += `**Guides Consumed:** ${guidedDisplay.guidesUsed.join(', ')}\n\n`;
    }
    if (guidedDisplay?.guidanceToolsUsed && guidedDisplay.guidanceToolsUsed.length > 0) {
      md += `**Tools Used:** ${guidedDisplay.guidanceToolsUsed.join(', ')}\n\n`;
    }

    if (unguidedDisplay && guidedDisplay) {
      const uChecks = unguidedDisplay.results;
      const gChecks = guidedDisplay.results;
      const uPass = uChecks.filter((c: TrialCheck) => c.passed).length;
      const gPass = gChecks.filter((c: TrialCheck) => c.passed).length;

      const rows = new Map<string, { message: string; unguided?: TrialCheck; guided?: TrialCheck }>();
      uChecks.forEach((check: TrialCheck, idx: number) => {
        const key = check.message || check.id || `u-${idx}`;
        rows.set(key, { message: check.message || '', unguided: check });
      });
      gChecks.forEach((check: TrialCheck, idx: number) => {
        const key = check.message || check.id || `g-${idx}`;
        const existing = rows.get(key);
        if (existing && !existing.guided) {
          existing.guided = check;
        } else {
          rows.set(`${key}#g-${idx}`, { message: check.message || '', guided: check });
        }
      });

      md += `| Unguided (${uPass}/${uChecks.length}) | Guided (${gPass}/${gChecks.length}) | Expectation |\n`;
      md += `|:---:|:---:|---|\n`;
      for (const row of rows.values()) {
        const uSym = row.unguided ? (row.unguided.passed ? '✅' : '❌') : '—';
        const gSym = row.guided ? (row.guided.passed ? '✅' : '❌') : '—';
        md += `| ${uSym} | ${gSym} | ${escapeMarkdownCell(row.message)} |\n`;
      }
      md += '\n';
    } else {
      const singleDisplay = guidedDisplay || unguidedDisplay;
      const singleLabel = guidedDisplay ? 'Guided' : 'Unguided';
      if (singleDisplay) {
        const checks = singleDisplay.results;
        const passCount = checks.filter((c: TrialCheck) => c.passed).length;
        md += `| ${singleLabel} (${passCount}/${checks.length}) | Expectation |\n`;
        md += `|:---:|---|\n`;
        for (const check of checks) {
          const sym = check.passed ? '✅' : '❌';
          md += `| ${sym} | ${escapeMarkdownCell(check.message || '')} |\n`;
        }
        md += '\n';
      }
    }
  }

  return md;
}

/**
 * Skills (CLI) is the only supported serving approach. The field is retained in
 * the report shape so the dashboard can keep comparing against historical jobs
 * that were produced by now-removed approaches (`mcp`, `skills`).
 */
const SERVING = 'skills_cli';

export function generateJsonReport(
  metrics: Metrics,
  allResults: Record<string, TrialResult[]>,
  timestamp: string,
  trialCount: number,
  agent: string,
  model: string,
  totalRuntime?: number,
  skillVersion?: string,
  cliVersion?: string,
  reasoningEffort?: ReasoningEffort,
): EvalsReport {
  return {
    summary: metrics.summary,
    results: allResults,
    stats: metrics.testStats,
    timestamp,
    runCount: trialCount,
    agent,
    serving: SERVING,
    model,
    ...(reasoningEffort ? { reasoningEffort } : {}),
    totalRuntime,
    skillVersion,
    cliVersion
  };
}

export function saveReports(resultsDir: string, markdown: string, json: EvalsReport) {
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(path.join(resultsDir, 'evals.md'), markdown);
  fs.writeFileSync(path.join(resultsDir, 'evals.json'), JSON.stringify(json, null, 2));
}
