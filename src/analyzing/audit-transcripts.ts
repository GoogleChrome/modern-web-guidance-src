import { readFile, readdir, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { LABELS_DIR, REPOS_CONFIG_PATH } from './paths.ts';
import { isEnoent } from './progress-log.ts';

export interface RepoEntry {
  repo: string;
  repoUrl?: string;
  commit?: string;
  split: 'rule-writing' | 'grading-only' | string;
  subpaths?: string[];
  localPath?: string | null;
}

export interface SplitViolation {
  stepIndex: number;
  toolName: string;
  target: string;
  matchedRepo?: string;
  reason: 'grading-only-repo' | 'labels-directory';
}

export interface ToolFrictionSummary {
  totalToolCalls: number;
  commandsRun: number;
  toolErrors: number;
  retries: number;
  toolCounts: Record<string, number>;
  errorToolCounts: Record<string, number>;
}

export interface ModelTierSummary {
  tierCounts: Record<string, number>;
  subagentInvocations: number;
}

export interface ToolCall {
  name: string;
  args?: Record<string, unknown>;
}

export interface TranscriptStep {
  step_index?: number;
  source?: string;
  type?: string;
  status?: string;
  created_at?: string;
  content?: string;
  thinking?: string;
  tool_calls?: ToolCall[];
  error?: unknown;
  model?: string;
  model_tier?: string;
}

export interface AuditOptions {
  repos?: RepoEntry[];
  reposPath?: string;
  labelsDir?: string;
  transcriptPath?: string;
}

export interface TranscriptAuditResult {
  transcriptPath: string;
  totalSteps: number;
  violations: SplitViolation[];
  hasSplitViolation: boolean;
  toolFriction: ToolFrictionSummary;
  modelTier: ModelTierSummary;
}

export interface AuditBatchResult {
  auditedCount: number;
  cleanCount: number;
  violationCount: number;
  results: TranscriptAuditResult[];
  aggregateFriction: {
    totalToolCalls: number;
    totalCommandsRun: number;
    totalToolErrors: number;
    totalRetries: number;
  };
}

/**
 * Escapes regex special characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Loads and validates repository entries from repos.json.
 */
export async function loadRepos(
  reposPath: string = REPOS_CONFIG_PATH,
): Promise<RepoEntry[]> {
  const content = await readFile(reposPath, 'utf8');
  const parsed: unknown = JSON.parse(content);
  if (!Array.isArray(parsed)) {
    throw new Error(
      `Expected repos configuration to be an array, got ${typeof parsed}`,
    );
  }

  const entries: RepoEntry[] = [];
  for (const item of parsed) {
    if (typeof item === 'object' && item !== null) {
      const rec = item as Record<string, unknown>;
      const repo = typeof rec.repo === 'string' ? rec.repo : '';
      const split =
        typeof rec.split === 'string' ? rec.split : 'rule-writing';
      const repoUrl =
        typeof rec.repoUrl === 'string' ? rec.repoUrl : undefined;
      const commit =
        typeof rec.commit === 'string' ? rec.commit : undefined;
      const subpaths = Array.isArray(rec.subpaths)
        ? rec.subpaths.filter((s): s is string => typeof s === 'string')
        : [];
      const localPath =
        typeof rec.localPath === 'string' ? rec.localPath : null;

      if (repo.length > 0) {
        entries.push({ repo, split, repoUrl, commit, subpaths, localPath });
      }
    }
  }

  return entries;
}

/**
 * Filters a list of repos to only those in the grading-only split.
 */
export function extractGradingRepos(repos: RepoEntry[]): RepoEntry[] {
  return repos.filter((r) => r.split === 'grading-only');
}

/**
 * Parses lines of JSONL into typed TranscriptStep objects.
 */
export function parseTranscriptJsonl(jsonlContent: string): TranscriptStep[] {
  const lines = jsonlContent.split('\n');
  const steps: TranscriptStep[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.length === 0) {
      continue;
    }
    try {
      const step: unknown = JSON.parse(trimmed);
      if (typeof step === 'object' && step !== null) {
        steps.push(step as TranscriptStep);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to parse transcript line ${i + 1}: ${msg}`);
    }
  }

  return steps;
}

/**
 * Determines whether a given text references the internal labels directory.
 */
export function isLabelsViolation(
  text: string,
  labelsDir: string = LABELS_DIR,
): boolean {
  const normalized = text.trim();
  if (
    normalized.includes('analyzer-internal/labels') ||
    normalized.includes('analyzer-internal/labels/') ||
    normalized.includes('labels/grades.') ||
    normalized.includes('grades.paulirish.jsonl')
  ) {
    return true;
  }

  if (labelsDir && normalized.includes(labelsDir)) {
    return true;
  }

  return false;
}

/**
 * Determines whether a text references a path belonging to a grading-only repo.
 */
export function isGradingRepoMatch(
  text: string,
  gradingRepos: RepoEntry[],
): { matched: boolean; repoName?: string } {
  const normalized = text.trim();

  // Reading repos.json itself is allowed; it does not constitute reading repo content
  if (normalized === 'repos.json' || normalized.endsWith('/repos.json')) {
    return { matched: false };
  }

  for (const repo of gradingRepos) {
    // 1. Check explicit localPath if defined
    if (repo.localPath) {
      if (normalized.includes(repo.localPath)) {
        return { matched: true, repoName: repo.repo };
      }
      const home = process.env.HOME;
      if (home && repo.localPath.startsWith('~/')) {
        const expanded = repo.localPath.replace(/^~/, home);
        if (normalized.includes(expanded)) {
          return { matched: true, repoName: repo.repo };
        }
      }
    }

    // 2. Check repo name in path context
    const escaped = escapeRegex(repo.repo);
    const segmentPattern = new RegExp(
      `(?:^|[\\/\\\\'"\\s\`])${escaped}(?:[\\/\\\\'"\\s\`.:]|$|\\/)`,
      'i',
    );

    if (segmentPattern.test(normalized)) {
      if (
        !normalized.endsWith('repos.json') &&
        !normalized.includes('/repos.json')
      ) {
        return { matched: true, repoName: repo.repo };
      }
      if (
        normalized.includes(`/${repo.repo}/`) ||
        normalized.includes(`\\${repo.repo}\\`)
      ) {
        return { matched: true, repoName: repo.repo };
      }
    }
  }

  return { matched: false };
}

/**
 * Determines whether a file path points to a *.test.ts unit test file inside src/analyzing/.
 */
export function isAnalyzingTestFilePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.includes('src/analyzing/') && normalized.endsWith('.test.ts');
}

/**
 * Determines whether a tool call is writing, editing, or reading a *.test.ts file inside src/analyzing/.
 */
export function isAnalyzingTestFileToolCall(call: ToolCall): boolean {
  if (!call.args || typeof call.args !== 'object') {
    return false;
  }
  const targetPath = (
    call.args.Path ??
    call.args.path ??
    call.args.FilePath ??
    call.args.filepath ??
    call.args.targetPath ??
    call.args.NotebookPath
  ) as unknown;
  if (typeof targetPath === 'string' && isAnalyzingTestFilePath(targetPath)) {
    return true;
  }
  return false;
}

/**
 * Checks all tool calls in a transcript for split-isolation violations.
 */
export function checkSplitViolations(
  steps: TranscriptStep[],
  gradingRepos: RepoEntry[],
  labelsDir: string = LABELS_DIR,
): SplitViolation[] {
  const violations: SplitViolation[] = [];

  for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
    const step = steps[stepIdx];
    const stepIndex = step.step_index ?? stepIdx;
    const toolCalls = step.tool_calls;
    if (!Array.isArray(toolCalls)) {
      continue;
    }

    for (const call of toolCalls) {
      if (!call.args || typeof call.args !== 'object') {
        continue;
      }

      const isTestToolCall = isAnalyzingTestFileToolCall(call);

      for (const argVal of Object.values(call.args)) {
        if (typeof argVal !== 'string') {
          continue;
        }

        if (isLabelsViolation(argVal, labelsDir)) {
          violations.push({
            stepIndex,
            toolName: call.name,
            target: argVal,
            reason: 'labels-directory',
          });
        }

        // Exempt tool calls writing/editing/reading *.test.ts inside src/analyzing/ from flagging mock repo strings
        if (isTestToolCall) {
          continue;
        }

        const match = isGradingRepoMatch(argVal, gradingRepos);
        if (match.matched) {
          violations.push({
            stepIndex,
            toolName: call.name,
            target: argVal,
            matchedRepo: match.repoName,
            reason: 'grading-only-repo',
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Inspects a step to determine whether it represents a tool execution error.
 */
function isToolErrorStep(step: TranscriptStep): boolean {
  if (step.status === 'ERROR') {
    return true;
  }
  if (step.error !== undefined && step.error !== null) {
    return true;
  }

  if (typeof step.content === 'string') {
    const content = step.content;
    if (/Command exited with code [1-9]\d*/.test(content)) {
      return true;
    }
    if (/Command failed with exit code/i.test(content)) {
      return true;
    }
    if (/^ToolError:/m.test(content)) {
      return true;
    }
    if (/^Fatal [a-zA-Z0-9_-]+ error:/m.test(content)) {
      return true;
    }
    if (/Tool execution was canceled/i.test(content)) {
      return true;
    }
    if (/Error: (?:ENOTDIR|ENOENT|EACCES|EPERM)\b/.test(content)) {
      return true;
    }
  }

  return false;
}

/**
 * Summarizes tool friction across transcript steps:
 * counts of tool errors, retries, and commands run.
 */
export function summarizeToolFriction(
  steps: TranscriptStep[],
): ToolFrictionSummary {
  let commandsRun = 0;
  let totalToolCalls = 0;
  let toolErrors = 0;
  let retries = 0;

  const toolCounts: Record<string, number> = {};
  const errorToolCounts: Record<string, number> = {};

  let lastToolCallKey: string | null = null;
  let lastToolName: string | null = null;
  let lastCallFailed = false;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    if (Array.isArray(step.tool_calls) && step.tool_calls.length > 0) {
      for (const call of step.tool_calls) {
        totalToolCalls++;
        const toolName = call.name;
        toolCounts[toolName] = (toolCounts[toolName] ?? 0) + 1;

        if (toolName === 'run_command') {
          commandsRun++;
        }

        const callKey = `${toolName}:${JSON.stringify(call.args ?? {})}`;

        if (lastCallFailed) {
          retries++;
        } else if (lastToolCallKey !== null && lastToolCallKey === callKey) {
          retries++;
        }

        lastToolCallKey = callKey;
        lastToolName = toolName;
        lastCallFailed = false;
      }
    }

    if (isToolErrorStep(step)) {
      toolErrors++;
      lastCallFailed = true;
      if (lastToolName) {
        errorToolCounts[lastToolName] =
          (errorToolCounts[lastToolName] ?? 0) + 1;
      }
    }
  }

  return {
    totalToolCalls,
    commandsRun,
    toolErrors,
    retries,
    toolCounts,
    errorToolCounts,
  };
}

/**
 * Summarizes model tier utilization and subagent invocations.
 */
export function summarizeModelTiers(
  steps: TranscriptStep[],
): ModelTierSummary {
  const tierCounts: Record<string, number> = {};
  let subagentInvocations = 0;

  for (const step of steps) {
    if (typeof step.model === 'string' && step.model.length > 0) {
      const tier = step.model.toLowerCase();
      tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
    }
    if (
      typeof step.model_tier === 'string' &&
      step.model_tier.length > 0
    ) {
      const tier = step.model_tier.toLowerCase();
      tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
    }

    if (Array.isArray(step.tool_calls)) {
      for (const call of step.tool_calls) {
        if (call.name === 'invoke_subagent') {
          subagentInvocations++;
          const modelArg =
            call.args?.Model ?? call.args?.model;
          const tier =
            typeof modelArg === 'string' && modelArg.length > 0
              ? modelArg.toLowerCase()
              : 'inherit';
          tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
        }
      }
    }
  }

  return {
    tierCounts,
    subagentInvocations,
  };
}

/**
 * Audits a single transcript (represented as steps or as raw JSONL text).
 */
export function auditTranscript(
  stepsOrContent: TranscriptStep[] | string,
  options?: AuditOptions,
): TranscriptAuditResult {
  const steps =
    typeof stepsOrContent === 'string'
      ? parseTranscriptJsonl(stepsOrContent)
      : stepsOrContent;

  const gradingRepos = options?.repos
    ? extractGradingRepos(options.repos)
    : [];

  const violations = checkSplitViolations(
    steps,
    gradingRepos,
    options?.labelsDir,
  );

  const toolFriction = summarizeToolFriction(steps);
  const modelTier = summarizeModelTiers(steps);

  return {
    transcriptPath: options?.transcriptPath ?? 'inline',
    totalSteps: steps.length,
    violations,
    hasSplitViolation: violations.length > 0,
    toolFriction,
    modelTier,
  };
}

/**
 * Audits a transcript file on disk.
 */
export async function auditTranscriptFile(
  filePath: string,
  options?: AuditOptions,
): Promise<TranscriptAuditResult> {
  const resolvedPath = resolve(filePath);
  const content = await readFile(resolvedPath, 'utf8');

  let repos = options?.repos;
  if (!repos) {
    const reposPath = options?.reposPath ?? REPOS_CONFIG_PATH;
    try {
      repos = await loadRepos(reposPath);
    } catch {
      repos = [];
    }
  }

  return auditTranscript(content, {
    ...options,
    repos,
    transcriptPath: resolvedPath,
  });
}

/**
 * Recursively collects .jsonl transcript files within a directory.
 */
async function collectJsonlFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await collectJsonlFiles(fullPath);
        results.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        results.push(fullPath);
      }
    }
  } catch (err: unknown) {
    if (!isEnoent(err)) {
      throw err;
    }
  }
  return results;
}

/**
 * Audits all .jsonl transcript files in a directory and aggregates metrics.
 */
export async function auditTranscriptDir(
  dirPath: string,
  options?: AuditOptions,
): Promise<AuditBatchResult> {
  const files = await collectJsonlFiles(resolve(dirPath));
  const results: TranscriptAuditResult[] = [];

  let repos = options?.repos;
  if (!repos) {
    const reposPath = options?.reposPath ?? REPOS_CONFIG_PATH;
    try {
      repos = await loadRepos(reposPath);
    } catch {
      repos = [];
    }
  }

  for (const file of files) {
    const res = await auditTranscriptFile(file, { ...options, repos });
    results.push(res);
  }

  const cleanCount = results.filter((r) => !r.hasSplitViolation).length;
  const violationCount = results.filter((r) => r.hasSplitViolation).length;

  const aggregateFriction = {
    totalToolCalls: results.reduce(
      (sum, r) => sum + r.toolFriction.totalToolCalls,
      0,
    ),
    totalCommandsRun: results.reduce(
      (sum, r) => sum + r.toolFriction.commandsRun,
      0,
    ),
    totalToolErrors: results.reduce(
      (sum, r) => sum + r.toolFriction.toolErrors,
      0,
    ),
    totalRetries: results.reduce(
      (sum, r) => sum + r.toolFriction.retries,
      0,
    ),
  };

  return {
    auditedCount: results.length,
    cleanCount,
    violationCount,
    results,
    aggregateFriction,
  };
}

/**
 * Formats a single transcript audit result for human reading.
 */
export function formatAuditReport(result: TranscriptAuditResult): string {
  const lines: string[] = [];
  lines.push(`Audit Report: ${result.transcriptPath}`);
  lines.push(`Total Steps: ${result.totalSteps}`);
  lines.push(
    `Split Isolation: ${result.hasSplitViolation ? 'FAILED (Violations Detected)' : 'PASSED (Clean)'}`,
  );

  if (result.violations.length > 0) {
    lines.push(`Violations (${result.violations.length}):`);
    for (const v of result.violations) {
      const detail =
        v.reason === 'grading-only-repo'
          ? `grading repo '${v.matchedRepo ?? 'unknown'}'`
          : 'labels directory';
      lines.push(
        `  - Step ${v.stepIndex} [${v.toolName}]: accessed ${detail} -> ${v.target}`,
      );
    }
  }

  const f = result.toolFriction;
  lines.push('Tool Friction Summary:');
  lines.push(`  - Total Tool Calls: ${f.totalToolCalls}`);
  lines.push(`  - Commands Run:     ${f.commandsRun}`);
  lines.push(`  - Tool Errors:      ${f.toolErrors}`);
  lines.push(`  - Retries:          ${f.retries}`);

  const m = result.modelTier;
  lines.push('Model Tier Summary:');
  lines.push(`  - Subagents:        ${m.subagentInvocations}`);
  const tiers = Object.entries(m.tierCounts)
    .map(([tier, count]) => `${tier}: ${count}`)
    .join(', ');
  lines.push(`  - Tiers:            ${tiers.length > 0 ? tiers : 'none recorded'}`);

  return lines.join('\n');
}

/**
 * Formats a batch audit result for human reading.
 */
export function formatBatchReport(batch: AuditBatchResult): string {
  const lines: string[] = [];
  lines.push(`Transcript Batch Audit Summary`);
  lines.push(`Audited Transcripts:  ${batch.auditedCount}`);
  lines.push(`Clean Transcripts:    ${batch.cleanCount}`);
  lines.push(`Violating Transcripts:${batch.violationCount}`);
  lines.push('Aggregate Tool Friction:');
  lines.push(`  - Total Tool Calls: ${batch.aggregateFriction.totalToolCalls}`);
  lines.push(`  - Commands Run:     ${batch.aggregateFriction.totalCommandsRun}`);
  lines.push(`  - Tool Errors:      ${batch.aggregateFriction.totalToolErrors}`);
  lines.push(`  - Retries:          ${batch.aggregateFriction.totalRetries}`);
  return lines.join('\n');
}

/**
 * Command-line interface runner for transcript auditing.
 */
export async function runAuditCli(
  args: string[] = process.argv.slice(2),
): Promise<void> {
  let isJson = false;
  let reposPath: string | undefined;
  const targets: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') {
      isJson = true;
    } else if (arg === '--repos' && i + 1 < args.length) {
      reposPath = args[++i];
    } else if (!arg.startsWith('--')) {
      targets.push(arg);
    }
  }

  if (targets.length === 0) {
    console.error('Usage: node audit-transcripts.ts <file-or-dir...> [--json] [--repos <path>]');
    process.exitCode = 1;
    return;
  }

  const repos = await loadRepos(reposPath ?? REPOS_CONFIG_PATH);

  for (const target of targets) {
    const resolved = isAbsolute(target) ? target : resolve(target);
    const fileStat = await stat(resolved);
    if (fileStat.isDirectory()) {
      const batchResult = await auditTranscriptDir(resolved, { repos });
      if (isJson) {
        console.log(JSON.stringify(batchResult, null, 2));
      } else {
        console.log(formatBatchReport(batchResult));
      }
      if (batchResult.violationCount > 0) {
        process.exitCode = 1;
      }
    } else {
      const result = await auditTranscriptFile(resolved, { repos });
      if (isJson) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatAuditReport(result));
      }
      if (result.hasSplitViolation) {
        process.exitCode = 1;
      }
    }
  }
}

// Module execution guard
if (import.meta.main || (process.argv[1] && resolve(process.argv[1]) === import.meta.filename)) {
  runAuditCli().catch((err: unknown) => {
    console.error('Audit failed with error:', err);
    process.exitCode = 1;
  });
}
