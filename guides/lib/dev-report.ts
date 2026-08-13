import fs from 'node:fs';
import path from 'node:path';
import { cGreen, cYellow, cCyan, cBold } from '../../lib/colors.ts';
import { SUPPORTED_BASE_APPS, getDefaultSolutionAgent, GUIDE_FILE, EXPECTATIONS_FILE, TARGETS_DIR, REPORT_FILE, TEST_APP_RESULTS_DIR } from '../../lib/guide-validation.ts';
import { setupGuideDevWorkDir, runAgent } from './utils.ts';
import { buildDevReportPrompt } from '../gd-dev-prompts.ts';

export type DevReportFlag =
  | 'INFRASTRUCTURE_ERROR'
  | 'MISSING_GUIDANCE_TOOL'
  | 'MISSING_EXPECTED_GUIDE'
  | 'LOW_GUIDED_PASS_RATE'
  | 'HEALTHY';

export interface TargetEvalSummary {
  baseApp: string;
  flag: DevReportFlag;
  flagDetails: string;
  guidedPassRate: number;
  unguidedPassRate: number | null;
}

/**
 * Computes deterministic diagnostic flag for an evaluation run in strict priority order.
 */
export function computeDevReportFlag(input: {
  guideName: string;
  hasEarlyFailure: boolean;
  earlyFailureMessage?: string;
  toolsUsed: string[];
  guidesConsumed: string[];
  guidedPassRate: number;
}): { flag: DevReportFlag; flagDetails: string } {
  // Priority 1: Infrastructure / Transient Errors
  if (input.hasEarlyFailure) {
    return {
      flag: 'INFRASTRUCTURE_ERROR',
      flagDetails: `Execution failure: ${input.earlyFailureMessage || 'Agent crashed or test execution failed prematurely.'}`,
    };
  }

  // Priority 2: Guidance Tool Used
  if (!input.toolsUsed.some(t => t.includes('modern-web-guidance'))) {
    return {
      flag: 'MISSING_GUIDANCE_TOOL',
      flagDetails: `Guided run did not invoke modern-web-guidance (tools used: ${input.toolsUsed.length > 0 ? input.toolsUsed.join(', ') : 'none'}).`,
    };
  }

  // Priority 3: Expected Guide Consumed
  if (!input.guidesConsumed.includes(input.guideName)) {
    return {
      flag: 'MISSING_EXPECTED_GUIDE',
      flagDetails: `Guided run did not consume the expected guide '${input.guideName}' (guides consumed: ${input.guidesConsumed.length > 0 ? input.guidesConsumed.join(', ') : 'none'}).`,
    };
  }

  // Priority 4: Guided Pass Rate >= 90%
  if (input.guidedPassRate < 90) {
    return {
      flag: 'LOW_GUIDED_PASS_RATE',
      flagDetails: `Guided pass rate is ${input.guidedPassRate}% (below 90% threshold).`,
    };
  }

  // Priority 5: Healthy
  return {
    flag: 'HEALTHY',
    flagDetails: `Guided pass rate is ${input.guidedPassRate}% (≥ 90%) and expected guide was consumed.`,
  };
}

/**
 * Extracts and parses evaluation summary for a specific target base app.
 */
export function computeTargetSummary(targetDir: string, baseApp: string): TargetEvalSummary | null {
  const evalsJsonPath = path.join(targetDir, TEST_APP_RESULTS_DIR, baseApp, 'evals.json');
  if (!fs.existsSync(evalsJsonPath)) {
    return null;
  }

  const guideName = path.basename(targetDir);
  const json = JSON.parse(fs.readFileSync(evalsJsonPath, 'utf8'));
  const results = json.results || {};
  const guidedKey = Object.keys(results).find(k => k.includes(baseApp) && k.endsWith('- guided'));
  const guidedRun = guidedKey ? results[guidedKey]?.[0] : null;

  if (!guidedRun) {
    return null;
  }

  const guidedPassRate = json.summary?.guidedPassRate ?? 0;
  const { flag, flagDetails } = computeDevReportFlag({
    guideName,
    hasEarlyFailure: !!json.summary?.guidedEarlyFailures,
    earlyFailureMessage: guidedRun.results?.find((c: any) => c.isEarlyFailure)?.message,
    toolsUsed: guidedRun.guidanceToolsUsed || [],
    guidesConsumed: guidedRun.guidesUsed || [],
    guidedPassRate,
  });

  return {
    baseApp,
    flag,
    flagDetails,
    guidedPassRate,
    unguidedPassRate: json.summary?.unguidedPassRate ?? null,
  };
}

/**
 * Builds the initial report document with interleaved target evals and diagnostic placeholders.
 */
export function buildInitialDevReport(targetDir: string, summaries: TargetEvalSummary[]): string {
  const guideName = path.basename(targetDir);
  let content = `# Evaluation Report: ${guideName}\n\n`;

  for (const s of summaries) {
    content += `## Target: \`${s.baseApp}\` (Status: \`${s.flag}\`)\n\n`;
    content += `### Evaluation Results\n\n`;
    const evalsMdPath = path.join(targetDir, TEST_APP_RESULTS_DIR, s.baseApp, 'evals.md');
    const rawEvals = fs.existsSync(evalsMdPath) ? fs.readFileSync(evalsMdPath, 'utf8').trim() : '';
    const nestedEvals = rawEvals.replaceAll(/^## /gm, '#### ').replaceAll(/^### /gm, '##### ');
    content += nestedEvals + '\n\n';
    content += `### Diagnostic Analysis & Actionable Recommendations\n\n`;
    content += `<!-- TODO: Complete diagnostics and recommendations for ${s.baseApp} -->\n\n`;
    content += `---\n\n`;
  }

  return content;
}

/**
 * Runs the agent-driven evaluation report generation phase across all targets for a guide.
 */
export async function runDevReport(targetDir: string): Promise<void> {
  console.log(cCyan(`\n--- Running Evaluation Report ---`));

  const summaries = SUPPORTED_BASE_APPS
    .map(baseApp => computeTargetSummary(targetDir, baseApp))
    .filter((s): s is TargetEvalSummary => s !== null);

  if (summaries.length === 0) {
    console.log(cYellow(`No evaluation results found in ${path.join(targetDir, TEST_APP_RESULTS_DIR)}. Skipping report.`));
    return;
  }

  const targetAppResultsDir = path.join(targetDir, TEST_APP_RESULTS_DIR);
  const finalReportPath = path.join(targetAppResultsDir, REPORT_FILE);

  const initialReportContent = buildInitialDevReport(targetDir, summaries);

  const agent = getDefaultSolutionAgent();
  const workDir = setupGuideDevWorkDir('report');

  try {
    // Copy guide.md, expectations.md, targets, and test-app-results to report sandbox
    if (fs.existsSync(path.join(targetDir, GUIDE_FILE))) {
      fs.copyFileSync(path.join(targetDir, GUIDE_FILE), path.join(workDir, GUIDE_FILE));
    }
    if (fs.existsSync(path.join(targetDir, EXPECTATIONS_FILE))) {
      fs.copyFileSync(path.join(targetDir, EXPECTATIONS_FILE), path.join(workDir, EXPECTATIONS_FILE));
    }
    if (fs.existsSync(path.join(targetDir, TARGETS_DIR))) {
      fs.cpSync(path.join(targetDir, TARGETS_DIR), path.join(workDir, 'targets'), { recursive: true });
    }
    if (fs.existsSync(targetAppResultsDir)) {
      fs.cpSync(targetAppResultsDir, path.join(workDir, TEST_APP_RESULTS_DIR), { recursive: true });
    }

    // Seed report.md with initial interleaved content
    const workReportPath = path.join(workDir, REPORT_FILE);
    fs.writeFileSync(workReportPath, initialReportContent);

    const guideName = path.basename(targetDir);
    const reportPrompt = buildDevReportPrompt({
      guideName,
      targets: summaries,
    });

    console.log(cCyan(`Invoking ${agent} to perform qualitative evaluation report...`));
    await runAgent(agent, reportPrompt, workDir);

    fs.copyFileSync(workReportPath, finalReportPath);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
  }

  // Print console report summary
  console.log(`\n${cBold('Evaluation Report Summary:')}`);
  for (const s of summaries) {
    const isHealthy = s.flag === 'HEALTHY';
    const flagColor = isHealthy ? cGreen : cYellow;
    const icon = isHealthy ? '✅' : '⚠️ ';
    const unguidedStr = s.unguidedPassRate !== null ? `unguided: ${s.unguidedPassRate}% | ` : '';
    console.log(`  ${icon} ${cBold(s.baseApp)}: ${flagColor(s.flag)} (${unguidedStr}guided: ${s.guidedPassRate}%)`);
  }
  console.log(`\n  ${cGreen('📄 Full Evaluation Report:')} ${path.relative(process.cwd(), finalReportPath)}`);
  const relativeGuideDir = path.relative(process.cwd(), targetDir);
  console.log(`\n  ${cCyan('💡 Next step:')} Create a PR with this evaluation report:`);
  console.log(`     ${cBold(`gd pr ${relativeGuideDir}`)}`);
}
