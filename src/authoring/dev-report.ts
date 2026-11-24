import fs from 'node:fs';
import path from 'node:path';
import { createTwoFilesPatch, FILE_HEADERS_ONLY } from 'diff';
import { cGreen, cYellow, cCyan, cBold } from '../core/colors.ts';
import { SUPPORTED_BASE_APPS, getDefaultSolutionAgent, GUIDE_FILE, EXPECTATIONS_FILE, TARGETS_DIR, REPORT_FILE, GRADER_FILE, TASK_FILE } from '../core/guide-validation.ts';
import { resolveGuideResultsDir, rootDir, type GuideResultsInventory } from '../core/paths.ts';
import { setupGuideDevWorkDir, runAgent } from '../harness/lib/utils.ts';
import { buildDevReportPrompt, buildApplyReviewFeedbackPrompt } from './dev-prompts.ts';
import { extractTestTitles } from '../core/grader-coverage.ts';

/** Pass-rate threshold above which an unguided run requires a fix or explanation before merge. */
export const HIGH_UNGUIDED_PASS_RATE_THRESHOLD = 80;

/** File next to `report.md` holding the report agent's suggested edits as one patch. */
export const SUGGESTIONS_PATCH_FILE = 'suggestions.patch';
export const SUGGESTED_EDITS_HEADING = 'Suggested Edits';
const HOW_TO_ACCEPT_SUGGESTIONS = `To accept a suggestion, apply it and push, or ask for it in a review comment. Then add the **\`needs-dev-rerun\`** label: the next \`gd dev-gap\` run applies the edits review comments ask for, then regenerates whatever the changed files require. Edits to the \`description\` in \`guide.md\` regenerate all target artifacts, other edits to \`guide.md\` or \`expectations.md\` keep \`task.md\` and regenerate the patches and \`grader.ts\`, edits to \`task.md\` regenerate the solution patches and \`grader.ts\`, and edits to \`grader.ts\` re-run calibration and agent evaluations.`;
/** Keeps the PR body (which is `report.md`) under GitHub's 65,536-character limit. */
const MAX_EMBEDDED_DIFF_CHARS = 30_000;

export type DevReportFlag =
  | 'CALIBRATION_FAILED'
  | 'INFRASTRUCTURE_ERROR'
  | 'MISSING_GUIDANCE_TOOL'
  | 'MISSING_EXPECTED_GUIDE'
  | 'HIGH_UNGUIDED_PASS_RATE'
  | 'HEALTHY';

export interface TargetEvalSummary {
  baseApp: string;
  flag: DevReportFlag;
  flagDetails: string;
  guidedPassRate: number;
  unguidedPassRate: number | null;
}

/** A guide file whose content differs between two copies of a guide directory. */
export interface GuideFileChange {
  file: string;
  before: string | null;
  after: string | null;
}

function listGuideFiles(root: string, includePatches: boolean): string[] {
  const files = [GUIDE_FILE, EXPECTATIONS_FILE].filter(f => fs.existsSync(path.join(root, f)));
  const targetsRoot = path.join(root, TARGETS_DIR);
  if (!fs.existsSync(targetsRoot)) return files;
  for (const app of fs.readdirSync(targetsRoot, { withFileTypes: true })) {
    if (!app.isDirectory()) continue;
    const appRel = `${TARGETS_DIR}/${app.name}`;
    for (const file of [TASK_FILE, GRADER_FILE]) {
      if (fs.existsSync(path.join(root, appRel, file))) files.push(`${appRel}/${file}`);
    }
    const patchesDir = path.join(root, appRel, 'patches');
    if (includePatches && fs.existsSync(patchesDir)) {
      for (const patch of fs.readdirSync(patchesDir, { withFileTypes: true })) {
        if (patch.isFile()) files.push(`${appRel}/patches/${patch.name}`);
      }
    }
  }
  return files;
}

/**
 * Compares agent-editable guide files in `editedRoot` against `originalRoot`, sorted by path.
 */
export function findChangedGuideFiles(originalRoot: string, editedRoot: string, opts: { includePatches: boolean }): GuideFileChange[] {
  const read = (root: string, file: string) => {
    const p = path.join(root, file);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  };
  const files = new Set([...listGuideFiles(originalRoot, opts.includePatches), ...listGuideFiles(editedRoot, opts.includePatches)]);
  const changes: GuideFileChange[] = [];
  for (const file of [...files].sort()) {
    const before = read(originalRoot, file);
    const after = read(editedRoot, file);
    if (before !== after) changes.push({ file, before, after });
  }
  return changes;
}

/**
 * Copies changed guide files from `fromRoot` onto `toRoot` without touching mtimes of unchanged files.
 */
export function copyChangedGuideFiles(fromRoot: string, toRoot: string): void {
  for (const { file, after } of findChangedGuideFiles(toRoot, fromRoot, { includePatches: true })) {
    if (after === null) continue;
    const dest = path.join(toRoot, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, after);
  }
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
    previousReport?: string;
  }
): Promise<void> {
  if (!prContext.comments?.trim()) return;

  console.log(cCyan(`\n--- Applying Reviewer Feedback to Files ---`));
  const agent = getDefaultSolutionAgent();
  const { workDir, tempHome } = setupGuideDevWorkDir('review-feedback');

  try {
    if (fs.existsSync(path.join(targetDir, GUIDE_FILE))) {
      fs.copyFileSync(path.join(targetDir, GUIDE_FILE), path.join(workDir, GUIDE_FILE));
    }
    if (fs.existsSync(path.join(targetDir, EXPECTATIONS_FILE))) {
      fs.copyFileSync(path.join(targetDir, EXPECTATIONS_FILE), path.join(workDir, EXPECTATIONS_FILE));
    }
    if (fs.existsSync(path.join(targetDir, TARGETS_DIR))) {
      fs.cpSync(path.join(targetDir, TARGETS_DIR), path.join(workDir, 'targets'), { recursive: true });
    }

    const guideName = path.basename(targetDir);
    const prompt = buildApplyReviewFeedbackPrompt({
      guideName,
      comments: prContext.comments,
      branchCommits: prContext.branchCommits,
      branchDiff: prContext.branchDiff,
      rerunMode: prContext.rerunMode,
      suggestedEdits: prContext.previousReport ? extractSuggestedEditsSection(prContext.previousReport) : undefined,
    });

    console.log(cCyan(`Invoking ${agent} to address review comments directly on disk...`));
    await runAgent(agent, prompt, workDir, { homeDir: tempHome });

    copyChangedGuideFiles(workDir, targetDir);
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
  }
}
export function computeDevReportFlag(input: {
  guideName: string;
  hasCalibrationFailure?: boolean;
  calibrationFailureMessage?: string;
  hasEarlyFailure: boolean;
  earlyFailureMessage?: string;
  toolsUsed: string[];
  guidesConsumed: string[];
  guidedPassRate: number;
  unguidedPassRate?: number | null;
}): { flag: DevReportFlag; flagDetails: string } {
  // Priority 0: Grader Calibration Failure
  if (input.hasCalibrationFailure) {
    return {
      flag: 'CALIBRATION_FAILED',
      flagDetails: `Calibration failed: ${input.calibrationFailureMessage || 'Grader failed to calibrate against golden solutions.'}`,
    };
  }

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
      flagDetails: `Guided trial did not invoke modern-web-guidance (tools used: ${input.toolsUsed.length > 0 ? input.toolsUsed.join(', ') : 'none'}).`,
    };
  }

  // Priority 3: Expected Guide Consumed
  if (!input.guidesConsumed.includes(input.guideName)) {
    return {
      flag: 'MISSING_EXPECTED_GUIDE',
      flagDetails: `Guided trial did not consume the expected guide '${input.guideName}' (guides consumed: ${input.guidesConsumed.length > 0 ? input.guidesConsumed.join(', ') : 'none'}).`,
    };
  }

  // Priority 4: High unguided pass rate needs a fix or a note before merge. A low guided rate is never a flag.
  const unguided = input.unguidedPassRate;
  if (typeof unguided === 'number' && unguided >= HIGH_UNGUIDED_PASS_RATE_THRESHOLD) {
    return {
      flag: 'HIGH_UNGUIDED_PASS_RATE',
      flagDetails: `Unguided pass rate is ${unguided}% (at or above the ${HIGH_UNGUIDED_PASS_RATE_THRESHOLD}% threshold) without guidance; needs a fix or a note before merge.`,
    };
  }

  // Priority 5: Healthy
  const unguidedStr = typeof unguided === 'number'
    ? `unguided pass rate is ${unguided}% (below ${HIGH_UNGUIDED_PASS_RATE_THRESHOLD}%)`
    : 'no unguided run';
  return {
    flag: 'HEALTHY',
    flagDetails: `Calibrated, the guided run consumed the expected guide, and ${unguidedStr}. Guided pass rate ${input.guidedPassRate}% is informational.`,
  };
}

/**
 * Extracts and parses evaluation summary for a specific target base app.
 */
export function computeTargetSummary(
  targetDir: string,
  baseApp: string,
  guideInfo?: Partial<GuideResultsInventory>,
  calibrationErrorDetails?: string
): TargetEvalSummary | null {
  if (calibrationErrorDetails) {
    const { flag, flagDetails } = computeDevReportFlag({
      guideName: path.basename(targetDir),
      hasCalibrationFailure: true,
      calibrationFailureMessage: calibrationErrorDetails,
      hasEarlyFailure: false,
      toolsUsed: [],
      guidesConsumed: [],
      guidedPassRate: 0,
    });
    return {
      baseApp,
      flag,
      flagDetails,
      guidedPassRate: 0,
      unguidedPassRate: null,
    };
  }

  const guideResultsDir = resolveGuideResultsDir(targetDir, guideInfo);
  const evalsJsonPath = path.join(guideResultsDir, baseApp, 'evals.json');
  if (!fs.existsSync(evalsJsonPath)) {
    return null;
  }

  const guideName = path.basename(targetDir);
  const json = JSON.parse(fs.readFileSync(evalsJsonPath, 'utf8'));
  const results = json.results || {};
  const stats = json.stats || {};
  const guidedKeys = Object.keys(results).filter(
    k => (k.startsWith(`${baseApp} - `) || k.startsWith(`${baseApp}-`)) && k.endsWith(' - guided')
  );

  if (guidedKeys.length === 0) {
    return null;
  }

  let fallbackSummary: TargetEvalSummary | null = null;

  for (const guidedKey of guidedKeys) {
    const guidedRun = results[guidedKey]?.[0];
    if (!guidedRun) continue;

    const variantName = guidedKey.split(' - ')[0]!;
    const unguidedKey = guidedKey.replace(/ - guided$/, ' - unguided');
    const guidedPassRate = stats[guidedKey]?.medianPassRate ?? json.summary?.guidedPassRate ?? 0;
    const unguidedPassRate = stats[unguidedKey]?.medianPassRate ?? json.summary?.unguidedPassRate ?? null;
    const earlyFailureCheck = guidedRun.results?.find((c: any) => c.isEarlyFailure);

    const { flag, flagDetails: rawFlagDetails } = computeDevReportFlag({
      guideName,
      hasEarlyFailure: Boolean(earlyFailureCheck || stats[guidedKey]?.earlyFailures || json.summary?.guidedEarlyFailures),
      earlyFailureMessage: earlyFailureCheck?.message,
      toolsUsed: guidedRun.guidanceToolsUsed || [],
      guidesConsumed: guidedRun.guidesUsed || [],
      guidedPassRate,
      unguidedPassRate,
    });
    const flagDetails =
      flag !== 'HEALTHY' && variantName !== baseApp
        ? `[${variantName}] ${rawFlagDetails}`
        : rawFlagDetails;

    const summary: TargetEvalSummary = {
      baseApp,
      flag,
      flagDetails,
      guidedPassRate,
      unguidedPassRate,
    };

    if (flag !== 'HEALTHY') {
      return summary;
    }
    fallbackSummary ??= summary;
  }

  return fallbackSummary;
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
    content += `> **Reviewer Next Steps**: Nothing in this report has been applied to the PR. Suggested fixes, if any, are under **${SUGGESTED_EDITS_HEADING}** at the end.\n`;
    content += `> - ${HOW_TO_ACCEPT_SUGGESTIONS}\n`;
    if (summaries.some(s => s.flag === 'HIGH_UNGUIDED_PASS_RATE')) {
      content += `> - A \`HIGH_UNGUIDED_PASS_RATE\` target needs a fix, or a note on the PR saying why the rate is legitimate (for example, the guide adds little lift), before merge.\n`;
    }
    content += `\n`;
  }

  content += `## Summary\n\n`;
  content += `<!-- TODO: Complete overall summary across all targets -->\n\n`;
  content += `---\n\n`;

  for (const s of summaries) {
    content += `## Target: \`${s.baseApp}\` (Status: \`${s.flag}\`)\n\n`;
    content += `### Evaluation Results\n\n`;
    const evalsMdPath = path.join(guideResultsDir, s.baseApp, 'evals.md');
    let nestedEvals = '';
    if (fs.existsSync(evalsMdPath)) {
      const rawEvals = fs.readFileSync(evalsMdPath, 'utf8').trim();
      nestedEvals = rawEvals.replaceAll(/^## /gm, '#### ').replaceAll(/^### /gm, '##### ');
    } else if (s.flag === 'CALIBRATION_FAILED') {
      nestedEvals = `Calibration failed prior to evaluation run:\n\n\`\`\`\n${s.flagDetails}\n\`\`\``;
    }
    content += nestedEvals ? nestedEvals + '\n\n' : '';
    content += `### Diagnostic Analysis & Actionable Recommendations\n\n`;
    content += `<!-- TODO: Complete diagnostics and recommendations for ${s.baseApp} -->\n\n`;
    content += `---\n\n`;
  }

  return content;
}

/**
 * Checks whether a suggested `grader.ts` edit drops active `test()` blocks without changing `expectations.md`.
 */
export function getGraderSuggestionCoverageLoss(input: {
  expectationsChanged: boolean;
  beforeTestCount: number;
  afterTestCount: number;
}): string | null {
  if (input.expectationsChanged) return null;
  if (input.afterTestCount < input.beforeTestCount) {
    return `reduces the number of \`test()\` blocks from ${input.beforeTestCount} to ${input.afterTestCount}`;
  }
  return null;
}

/** Unified diff of one changed file, prefixed by `pathPrefix` (the guide's repo-relative directory). */
export function formatGuideFileDiff(change: GuideFileChange, pathPrefix: string): string {
  return createTwoFilesPatch(
    change.before === null ? '/dev/null' : `a/${pathPrefix}${change.file}`,
    change.after === null ? '/dev/null' : `b/${pathPrefix}${change.file}`,
    change.before ?? '',
    change.after ?? '',
    undefined,
    undefined,
    { headerOptions: FILE_HEADERS_ONLY }
  );
}

/**
 * Builds the `## Suggested Edits` section appended to `report.md`.
 */
export function buildSuggestedEditsSection(
  diffs: ReadonlyArray<{ file: string; diff: string }>,
  coverageWarnings: readonly string[],
  patchDisplayPath: string
): string {
  let section = `\n\n---\n\n## ${SUGGESTED_EDITS_HEADING}\n\n`;
  section += `> [!IMPORTANT]\n`;
  section += `> The report agent suggested these edits. None of them are applied to this PR.\n`;
  section += `> - ${HOW_TO_ACCEPT_SUGGESTIONS}\n`;
  section += `> - On the machine that ran \`gd dev\`, \`git apply ${patchDisplayPath}\` from the repository root applies all of them.\n\n`;
  for (const warning of coverageWarnings) {
    section += `> [!WARNING]\n> ${warning}\n\n`;
  }

  let budget = MAX_EMBEDDED_DIFF_CHARS;
  const omitted: string[] = [];
  for (const { file, diff } of diffs) {
    if (diff.length > budget) {
      omitted.push(file);
      continue;
    }
    budget -= diff.length;
    section += `### \`${file}\`\n\n\`\`\`diff\n${diff.trimEnd()}\n\`\`\`\n\n`;
  }
  if (omitted.length > 0) {
    section += `Not shown here because of the PR body size limit (see \`${patchDisplayPath}\`): ${omitted.map(f => `\`${f}\``).join(', ')}.\n`;
  }
  return section;
}

/** The `## Suggested Edits` section of a previous report, or undefined if absent. */
export function extractSuggestedEditsSection(report: string): string | undefined {
  const start = report.search(new RegExp(`^## ${SUGGESTED_EDITS_HEADING}$`, 'm'));
  return start === -1 ? undefined : report.slice(start).trim();
}

function findGraderCoverageWarnings(changes: readonly GuideFileChange[], originalRoot: string, editedRoot: string): string[] {
  const expectationsChanged = changes.some(c => c.file === EXPECTATIONS_FILE);
  const warnings: string[] = [];
  for (const change of changes) {
    if (!change.file.endsWith(`/${GRADER_FILE}`) || change.before === null || change.after === null) continue;
    const before = path.join(originalRoot, change.file);
    const after = path.join(editedRoot, change.file);
    const loss = getGraderSuggestionCoverageLoss({
      expectationsChanged,
      beforeTestCount: extractTestTitles(before).length,
      afterTestCount: extractTestTitles(after).length,
    });
    if (loss) {
      warnings.push(`**Coverage loss**: the suggested edit to \`${change.file}\` ${loss} without changing \`${EXPECTATIONS_FILE}\`. Don't accept it as is; fix \`${EXPECTATIONS_FILE}\` or \`task.md\` instead.`);
    }
  }
  return warnings;
}

/**
 * Runs the agent-driven evaluation report across all targets for a guide.
 * Workspace edits become `suggestions.patch` + `## Suggested Edits` and are never written to disk.
 */
export async function runDevReport(
  targetDir: string,
  guideInfo?: Partial<GuideResultsInventory>,
  targets: readonly string[] = SUPPORTED_BASE_APPS,
  prContext?: {
    branchCommits?: string;
    branchDiff?: string;
    comments?: string;
  },
  calibrationFailures?: ReadonlyMap<string, string> | Record<string, string>
): Promise<void> {
  console.log(cCyan(`\n--- Running Evaluation Report ---`));

  const guideResultsDir = resolveGuideResultsDir(targetDir, guideInfo);
  const getCalibError = (app: string) => {
    if (!calibrationFailures) return undefined;
    if (calibrationFailures instanceof Map) return calibrationFailures.get(app);
    return (calibrationFailures as Record<string, string>)[app];
  };

  const summaries = targets
    .map(baseApp => computeTargetSummary(targetDir, baseApp, guideInfo, getCalibError(baseApp)))
    .filter((s): s is TargetEvalSummary => s !== null);

  if (summaries.length === 0) {
    console.log(cYellow(`No evaluation results found in ${guideResultsDir}. Skipping report.`));
    return;
  }

  const finalReportPath = path.join(guideResultsDir, REPORT_FILE);
  const suggestionsPath = path.join(guideResultsDir, SUGGESTIONS_PATCH_FILE);
  const initialReportContent = buildInitialDevReport(targetDir, summaries, guideInfo);

  const agent = getDefaultSolutionAgent();
  const { workDir, tempHome } = setupGuideDevWorkDir('report');
  let suggestionCount = 0;

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

    console.log(cCyan(`Invoking ${agent} to write the evaluation report and suggest file edits...`));
    await runAgent(agent, reportPrompt, workDir, { homeDir: tempHome });

    // Workspace edits become suggestions; never mutate guide.md, expectations.md, or targets/ on disk.
    const changes = findChangedGuideFiles(targetDir, workDir, { includePatches: false });
    suggestionCount = changes.length;
    let report = fs.readFileSync(workReportPath, 'utf8');
    fs.mkdirSync(guideResultsDir, { recursive: true });
    if (changes.length > 0) {
      const pathPrefix = `${path.relative(rootDir, targetDir).split(path.sep).join('/')}/`;
      const diffs = changes.map(change => ({ file: `${pathPrefix}${change.file}`, diff: formatGuideFileDiff(change, pathPrefix) }));
      fs.writeFileSync(suggestionsPath, diffs.map(d => d.diff).join(''));
      report += buildSuggestedEditsSection(
        diffs,
        findGraderCoverageWarnings(changes, targetDir, workDir),
        path.relative(rootDir, suggestionsPath).split(path.sep).join('/')
      );
    } else {
      fs.rmSync(suggestionsPath, { force: true });
    }
    fs.writeFileSync(finalReportPath, report);
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
  if (suggestionCount > 0) {
    console.log(`  ${cYellow(`📝 ${suggestionCount} suggested file edit(s), not applied:`)} ${path.relative(process.cwd(), suggestionsPath)}`);
  }
  const relativeGuideDir = path.relative(process.cwd(), targetDir);
  console.log(`\n  ${cCyan('💡 Next step:')} Create a PR with this evaluation report:`);
  console.log(`     ${cBold(`gd pr ${relativeGuideDir}`)}`);
}
