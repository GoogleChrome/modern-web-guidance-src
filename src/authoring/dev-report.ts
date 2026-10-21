import fs from 'node:fs';
import path from 'node:path';
import { cGreen, cYellow, cCyan, cBold, cRed } from '../core/colors.ts';
import { SUPPORTED_BASE_APPS, getDefaultSolutionAgent, GUIDE_FILE, EXPECTATIONS_FILE, TARGETS_DIR, REPORT_FILE, GRADER_FILE } from '../core/guide-validation.ts';
import { resolveGuideResultsDir, type GuideResultsInventory } from '../core/paths.ts';
import { setupGuideDevWorkDir, runAgent } from '../harness/lib/utils.ts';
import { buildDevReportPrompt, buildApplyReviewFeedbackPrompt } from './dev-prompts.ts';
import { testGrader } from '../grading/run-grader.ts';

export type DevReportFlag =
  | 'INFRASTRUCTURE_ERROR'
  | 'MISSING_GUIDANCE_TOOL'
  | 'MISSING_EXPECTED_GUIDE'
  | 'LOW_GUIDED_PASS_RATE'
  | 'HIGH_UNGUIDED_PASS_RATE'
  | 'HEALTHY';

export interface TargetEvalSummary {
  baseApp: string;
  flag: DevReportFlag;
  flagDetails: string;
  guidedPassRate: number;
  unguidedPassRate: number | null;
}

/**
 * Applies pull request review feedback directly to the guide, expectations, and target files
 * before target generation and evaluation calibration run.
 */
export async function applyPrReviewFeedback(
  targetDir: string,
  prContext: {
    branchCommits?: string;
    branchDiff?: string;
    comments?: string;
    rerunMode?: string;
  }
): Promise<void> {
  if (!prContext.comments?.trim()) return;

  console.log(cCyan(`\n--- Applying Reviewer Feedback to Files ---`));
  const agent = getDefaultSolutionAgent();
  const { workDir, tempHome } = setupGuideDevWorkDir('review-feedback');

  const shouldTouchTargets = prContext.rerunMode !== 'needs-eval-gen';

  try {
    if (fs.existsSync(path.join(targetDir, GUIDE_FILE))) {
      fs.copyFileSync(path.join(targetDir, GUIDE_FILE), path.join(workDir, GUIDE_FILE));
    }
    if (fs.existsSync(path.join(targetDir, EXPECTATIONS_FILE))) {
      fs.copyFileSync(path.join(targetDir, EXPECTATIONS_FILE), path.join(workDir, EXPECTATIONS_FILE));
    }
    if (shouldTouchTargets && fs.existsSync(path.join(targetDir, TARGETS_DIR))) {
      fs.cpSync(path.join(targetDir, TARGETS_DIR), path.join(workDir, 'targets'), { recursive: true });
    }

    const guideName = path.basename(targetDir);
    const prompt = buildApplyReviewFeedbackPrompt({
      guideName,
      comments: prContext.comments,
      branchCommits: prContext.branchCommits,
      branchDiff: prContext.branchDiff,
      rerunMode: prContext.rerunMode,
    });

    console.log(cCyan(`Invoking ${agent} to address review comments directly on disk...`));
    await runAgent(agent, prompt, workDir, { homeDir: tempHome });

    // Sync modified files back to targetDir
    const workGuide = path.join(workDir, GUIDE_FILE);
    if (fs.existsSync(workGuide)) {
      fs.copyFileSync(workGuide, path.join(targetDir, GUIDE_FILE));
    }
    const workExp = path.join(workDir, EXPECTATIONS_FILE);
    if (fs.existsSync(workExp)) {
      fs.copyFileSync(workExp, path.join(targetDir, EXPECTATIONS_FILE));
    }
    if (shouldTouchTargets) {
      const workTargets = path.join(workDir, 'targets');
      if (fs.existsSync(workTargets)) {
        fs.cpSync(workTargets, path.join(targetDir, TARGETS_DIR), { recursive: true });
      }
    }
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
  }
}
export function computeDevReportFlag(input: {
  guideName: string;
  hasEarlyFailure: boolean;
  earlyFailureMessage?: string;
  toolsUsed: string[];
  guidesConsumed: string[];
  guidedPassRate: number;
  unguidedPassRate?: number | null;
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

  // Priority 5: Unguided Pass Rate === 100%
  if (input.unguidedPassRate === 100) {
    return {
      flag: 'HIGH_UNGUIDED_PASS_RATE',
      flagDetails: `Unguided pass rate is 100% (unguided agent passed all checks without guidance).`,
    };
  }

  // Priority 6: Healthy
  return {
    flag: 'HEALTHY',
    flagDetails: `Guided pass rate is ${input.guidedPassRate}% (≥ 90%) and expected guide was consumed.`,
  };
}

/**
 * Extracts and parses evaluation summary for a specific target base app.
 */
export function computeTargetSummary(targetDir: string, baseApp: string, guideInfo?: Partial<GuideResultsInventory>): TargetEvalSummary | null {
  const guideResultsDir = resolveGuideResultsDir(targetDir, guideInfo);
  const evalsJsonPath = path.join(guideResultsDir, baseApp, 'evals.json');
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
  const unguidedPassRate = json.summary?.unguidedPassRate ?? null;
  const { flag, flagDetails } = computeDevReportFlag({
    guideName,
    hasEarlyFailure: !!json.summary?.guidedEarlyFailures,
    earlyFailureMessage: guidedRun.results?.find((c: any) => c.isEarlyFailure)?.message,
    toolsUsed: guidedRun.guidanceToolsUsed || [],
    guidesConsumed: guidedRun.guidesUsed || [],
    guidedPassRate,
    unguidedPassRate,
  });

  return {
    baseApp,
    flag,
    flagDetails,
    guidedPassRate,
    unguidedPassRate,
  };
}

/**
 * Builds the initial report document with interleaved target evals and diagnostic placeholders.
 */
export function buildInitialDevReport(targetDir: string, summaries: TargetEvalSummary[], guideInfo?: Partial<GuideResultsInventory>): string {
  const guideName = path.basename(targetDir);
  const guideResultsDir = resolveGuideResultsDir(targetDir, guideInfo);
  let content = `# Evaluation Report: ${guideName}\n\n`;

  const anyUnhealthy = summaries.some(s => s.flag !== 'HEALTHY');
  if (anyUnhealthy) {
    content += `> [!NOTE]\n`;
    content += `> **Reviewer Next Steps**: If any targets are flagged or require adjustments, recommended fixes have already been applied directly to the files in this PR.\n`;
    content += `> - For edits to \`guide.md\` or \`expectations.md\`: review the changes, then add the **\`needs-eval-gen\`** label to regenerate solutions, tasks, and graders on the next \`gd dev-gap\` run.\n`;
    content += `> - For edits to \`targets/\` (\`task.md\` or \`grader.ts\`): review the changes, then add the **\`needs-eval-run\`** label to re-run calibration and agent evaluations.\n\n`;
  }

  content += `## Summary\n\n`;
  content += `<!-- TODO: Complete overall summary across all targets -->\n\n`;
  content += `---\n\n`;

  for (const s of summaries) {
    content += `## Target: \`${s.baseApp}\` (Status: \`${s.flag}\`)\n\n`;
    content += `### Evaluation Results\n\n`;
    const evalsMdPath = path.join(guideResultsDir, s.baseApp, 'evals.md');
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
export async function runDevReport(
  targetDir: string,
  guideInfo?: Partial<GuideResultsInventory>,
  targets: readonly string[] = SUPPORTED_BASE_APPS,
  prContext?: {
    branchCommits?: string;
    branchDiff?: string;
    comments?: string;
  }
): Promise<void> {
  console.log(cCyan(`\n--- Running Evaluation Report ---`));

  const guideResultsDir = resolveGuideResultsDir(targetDir, guideInfo);
  const summaries = targets
    .map(baseApp => computeTargetSummary(targetDir, baseApp, guideInfo))
    .filter((s): s is TargetEvalSummary => s !== null);

  if (summaries.length === 0) {
    console.log(cYellow(`No evaluation results found in ${guideResultsDir}. Skipping report.`));
    return;
  }

  const finalReportPath = path.join(guideResultsDir, REPORT_FILE);
  const initialReportContent = buildInitialDevReport(targetDir, summaries, guideInfo);

  const agent = getDefaultSolutionAgent();
  const { workDir, tempHome } = setupGuideDevWorkDir('report');
  const initialGraders = new Map<string, string>();
  for (const s of summaries) {
    const graderPath = path.join(targetDir, TARGETS_DIR, s.baseApp, GRADER_FILE);
    if (fs.existsSync(graderPath)) {
      initialGraders.set(s.baseApp, fs.readFileSync(graderPath, 'utf8'));
    }
  }

  try {
    // Copy guide.md, expectations.md, targets, and results to report sandbox
    if (fs.existsSync(path.join(targetDir, GUIDE_FILE))) {
      fs.copyFileSync(path.join(targetDir, GUIDE_FILE), path.join(workDir, GUIDE_FILE));
    }
    if (fs.existsSync(path.join(targetDir, EXPECTATIONS_FILE))) {
      fs.copyFileSync(path.join(targetDir, EXPECTATIONS_FILE), path.join(workDir, EXPECTATIONS_FILE));
    }
    if (fs.existsSync(path.join(targetDir, TARGETS_DIR))) {
      fs.cpSync(path.join(targetDir, TARGETS_DIR), path.join(workDir, 'targets'), { recursive: true });
    }
    if (fs.existsSync(guideResultsDir)) {
      fs.cpSync(guideResultsDir, path.join(workDir, 'results'), { recursive: true });
    }

    // Seed report.md with initial interleaved content
    const workReportPath = path.join(workDir, REPORT_FILE);
    fs.writeFileSync(workReportPath, initialReportContent);

    const guideName = path.basename(targetDir);
    const reportPrompt = buildDevReportPrompt({
      guideName,
      targets: summaries,
      prContext,
    });

    console.log(cCyan(`Invoking ${agent} to perform qualitative evaluation report and apply recommended file updates...`));
    await runAgent(agent, reportPrompt, workDir, { homeDir: tempHome });

    fs.copyFileSync(workReportPath, finalReportPath);

    // Sync any modified guide, expectations, and target files back to targetDir
    const workGuideFile = path.join(workDir, GUIDE_FILE);
    if (fs.existsSync(workGuideFile)) {
      fs.copyFileSync(workGuideFile, path.join(targetDir, GUIDE_FILE));
    }
    const workExpFile = path.join(workDir, EXPECTATIONS_FILE);
    if (fs.existsSync(workExpFile)) {
      fs.copyFileSync(workExpFile, path.join(targetDir, EXPECTATIONS_FILE));
    }
    const workTargetsDir = path.join(workDir, 'targets');
    if (fs.existsSync(workTargetsDir)) {
      fs.cpSync(workTargetsDir, path.join(targetDir, TARGETS_DIR), { recursive: true });
    }

    // Verify calibration if report agent modified any targets/<target>/grader.ts
    for (const s of summaries) {
      const graderPath = path.join(targetDir, TARGETS_DIR, s.baseApp, GRADER_FILE);
      const originalGraderPath = path.join(workDir, 'targets', s.baseApp, GRADER_FILE);
      if (fs.existsSync(graderPath) && fs.existsSync(originalGraderPath)) {
        const originalContent = initialGraders.get(s.baseApp);
        const newContent = fs.readFileSync(graderPath, 'utf8');
        if (originalContent && originalContent !== newContent) {
          console.log(cCyan(`\nValidating calibration for modified ${s.baseApp} grader...`));
          const calib = await testGrader(path.join(targetDir, TARGETS_DIR, s.baseApp));
          if (!calib.success) {
            console.warn(cRed(`⚠️  Modified ${s.baseApp} grader failed calibration: ${calib.errorDetails || 'Unknown error'}. Reverting grader.ts changes.`));
            fs.writeFileSync(graderPath, originalContent);
            if (fs.existsSync(finalReportPath)) {
              const revertWarning = `\n\n> [!WARNING]\n> **Grader Modification Reverted**: The report agent's proposed adjustments to \`targets/${s.baseApp}/${GRADER_FILE}\` failed calibration testing (${calib.errorDetails || 'calibration failure'}) and were automatically reverted on disk.\n`;
              fs.appendFileSync(finalReportPath, revertWarning);
            }
          } else {
            console.log(cGreen(`✅ Modified ${s.baseApp} grader passed calibration!`));
          }
        }
      }
    }
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
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
