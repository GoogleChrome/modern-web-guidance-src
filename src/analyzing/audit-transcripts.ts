import { readFile, readdir, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { LABELS_DIR, REPOS_CONFIG_PATH } from './paths.ts';
import { isEnoent } from './progress-log.ts';

export type RepoSplit = 'rule-writing' | 'held-out' | 'grading-only' | 'tune' | 'final';

export interface RepoEntry {
  repo: string;
  repoUrl?: string;
  commit?: string;
  split: RepoSplit;
  subpaths?: string[];
  localPath?: string | null;
}

export interface SplitViolation {
  stepIndex: number;
  toolName: string;
  target: string;
  matchedRepo?: string;
  reason: 'grading-only-repo' | 'labels-directory';
  /**
   * 'mention': a message tool (brief, report) named the path; nothing touched disk.
   * 'access': a tool that reads, writes, or runs commands named the path.
   * Both count toward hasSplitViolation; the channel only tells the reviewer where to look first.
   */
  channel: 'access' | 'mention';
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
  /** ISO-8601 timestamp; only steps created at or after it are audited (scopes an audit to "work since the last review"). */
  since?: string;
}

/**
 * Process signals are review prompts for the observer, not split violations:
 * - `hand-edited-generated-artifact`: an edit to PROGRESS.md, progress-history.json, a findings/*.json(l)
 *   run artifact, or a labels/ deck, via edit_file/write_file or inline code in run_command
 *   (`node -e ... writeFileSync`, `sed -i`, `git checkout -- <artifact>`). Only scripts may write these
 *   (GEMINI.md, D-020, O29, O36, O52). A committed script that writes its own outputs is not flagged.
 * - `prompt-edit-after-label-read`: prompts.ts edited after the same agent read Paul's labels or
 *   judge-vs-Paul disagreement cards, so agreement on those cards becomes in-sample (R31, O35).
 *   The label read may precede the --since window: an agent that has seen the labels stays contaminated.
 * - `polling-loop`: a run of status polls with no substantive tool call between them (O44, O62).
 *   Interleaved kills and timers do not break the run.
 * - `git-sweep-commit`: `git commit -a` or `git add .|-A|-u`, which stage files the agent did not
 *   author (O27, O43).
 * - `audit-tool-edit`: an edit to audit-transcripts.ts itself, so the reviewer can check it was not
 *   weakened by the agents it audits.
 * - `split-definition-edit`: an ad hoc edit to repos.json, the GitMirror manifest, or a GitMirror split
 *   directory (GEMINI.md: never change the held-out split without Paul).
 */
export type ProcessSignalKind =
  | 'hand-edited-generated-artifact'
  | 'prompt-edit-after-label-read'
  | 'polling-loop'
  | 'git-sweep-commit'
  | 'audit-tool-edit'
  | 'split-definition-edit';

export interface ProcessSignal {
  kind: ProcessSignalKind;
  stepIndex: number;
  detail: string;
}

export interface TranscriptAuditResult {
  transcriptPath: string;
  totalSteps: number;
  violations: SplitViolation[];
  hasSplitViolation: boolean;
  processSignals: ProcessSignal[];
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
 * Fails loudly on malformed entries: defaulting a missing split to 'rule-writing'
 * would silently whitelist a held-out repo and make the split audit fail open.
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

  return parsed.map((item: unknown, index: number): RepoEntry => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`${reposPath}[${index}]: expected an object`);
    }
    const rec = item as Record<string, unknown>;
    if (typeof rec.repo !== 'string' || rec.repo.length === 0) {
      throw new Error(`${reposPath}[${index}]: missing string 'repo'`);
    }
    if (
      rec.split !== 'rule-writing' &&
      rec.split !== 'held-out' &&
      rec.split !== 'grading-only' &&
      rec.split !== 'tune' &&
      rec.split !== 'final'
    ) {
      throw new Error(
        `${reposPath}[${index}] (${rec.repo}): split must be 'rule-writing', 'held-out', 'grading-only', 'tune', or 'final', got ${JSON.stringify(rec.split)}`,
      );
    }
    return {
      repo: rec.repo,
      split: rec.split,
      repoUrl: typeof rec.repoUrl === 'string' ? rec.repoUrl : undefined,
      commit: typeof rec.commit === 'string' ? rec.commit : undefined,
      subpaths: Array.isArray(rec.subpaths)
        ? rec.subpaths.filter((s): s is string => typeof s === 'string')
        : [],
      localPath: typeof rec.localPath === 'string' ? rec.localPath : null,
    };
  });
}

/**
 * Filters a list of repos to only those in non-rule-writing splits (grading-only, tune, final).
 */
export function extractGradingRepos(repos: RepoEntry[]): RepoEntry[] {
  return repos.filter((r) => r.split !== 'rule-writing');
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

  if (
    normalized.includes('analyzer-gitmirror/held-out') ||
    normalized.includes('analyzer-gitmirror/grading-only') ||
    normalized.includes('analyzer-gitmirror/tune') ||
    normalized.includes('analyzer-gitmirror/final')
  ) {
    return { matched: true, repoName: 'analyzer-gitmirror' };
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
      const channel = MESSAGE_TOOLS.has(call.name) ? 'mention' : 'access';

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
            channel,
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
            channel,
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

/** Lookahead after a path: transcripts embed paths in quoted, escaped (`\"`), or parenthesized text. */
const PATH_END = String.raw`(?=["'\s\\)]|$)`;
/** Run artifacts only scripts may write: PROGRESS.md, progress-history.json, findings/*.json(l), labels/ decks and grades. */
const GENERATED_ARTIFACT_PATH = new RegExp(
  String.raw`analyzer-internal\/(?:PROGRESS\.md|progress-history\.json|(?:findings|labels)\/[^"'\s\\]+\.jsonl?)` + PATH_END,
);
/** The same artifacts named relative to analyzer-internal (e.g. `cd analyzer-internal && git checkout -- findings/x.json`). */
const RELATIVE_ARTIFACT_PATH = new RegExp(
  String.raw`(?:^|[\s"'=\\])(?:PROGRESS\.md|progress-history\.json|(?:findings|labels)\/[^"'\s\\]+\.jsonl?)` + PATH_END,
);
/** Shell edits in place, or restoring a file from git history (`git checkout|restore ... -- <path>`). */
const SHELL_WRITE = /\bsed\s+-i\b|\bgit\b[^;&|\n]*\b(?:checkout|restore)\b[^;&|\n]*\s--\s/;
/** First argument of an inline-code write: `writeFileSync(p, ...)`, `writeFile("x", ...)`, `open(p, "w")`. */
const CODE_WRITE_TARGET = /(?:writeFileSync|writeFile|appendFileSync)\(\s*([^,)]+)|\bopen\(\s*([^,)]+),\s*["'][wa]/g;
const SPLIT_DEFINITION_PATH =
  /analyzer-internal\/repos\.json|analyzer-gitmirror\/(?:manifest\.json|grading-only|tune|final|rule-writing)\b/;
const FILE_MOVE = /\b(?:mv|ln|rm|trash)\s/;
/** `git commit -a`/`--all` or `git add .`/`-A`/`-u` (checked after quoted strings are blanked out). */
const GIT_SWEEP =
  /\bgit\b(?:\s+-C\s+\S+)*\s+(?:commit\b[^;&|\n]*\s-[a-zA-Z]*a[a-zA-Z]*\b|commit\b[^;&|\n]*\s--all\b|add\s+(?:\.|-A|--all|-u|--update)(?=[\s;&|]|$))/;
const QUOTED_STRING = /"[^"\n]*"|'[^'\n]*'/g;
const PROMPTS_FILE_PATH = new RegExp(String.raw`src\/analyzing\/prompts\.ts` + PATH_END);
const AUDIT_TOOL_PATH = new RegExp(String.raw`src\/analyzing\/audit-transcripts(?:\.test)?\.ts` + PATH_END);
const CALIBRATION_DATA_PATH = /analyzer-internal\/labels\/|grades\.paulirish\.jsonl|judge-paul-disagreements/;
const FILE_WRITE_TOOLS = new Set(['edit_file', 'write_file']);
/** Message tools only mention paths in text sent to another agent; they never read or write files. */
const MESSAGE_TOOLS = new Set(['send_message', 'invoke_subagent', 'post_message', 'swarm', 'define_subagent']);
const DIRECT_READ_TOOLS = new Set(['read_file', 'run_command']);
/** Tool calls that only wait on background work: they neither break nor count toward a polling run. */
const WAIT_TOOLS = new Set(['manage_task', 'schedule', 'swarm_wait']);
/**
 * Status polls with no substantive tool call between them that count as a polling loop.
 * 8 catches 8f1cbf70#556 (8 polls, 2 kills, and 2 timers in 25 s), which a per-task count of 10 missed.
 */
const POLLING_LOOP_MIN_POLLS = 8;

/** Transcript args are often JSON string literals (`"\"/path\""`); decode them so paths and commands match. */
function stringArg(call: ToolCall, key: string): string {
  const value = call.args?.[key];
  if (typeof value !== 'string') {
    return '';
  }
  if (!/^"[\s\S]*"$/.test(value)) {
    return value;
  }
  try {
    const decoded: unknown = JSON.parse(value);
    return typeof decoded === 'string' ? decoded : value;
  } catch {
    // A quoted string that is not valid JSON (for example raw newlines); keep the inner text.
    return value.slice(1, -1);
  }
}

/**
 * True when a shell edit or inline code in `cmd` may write a path accepted by `isProtected`.
 * Running a committed script that writes its own outputs has no inline write, so it never counts.
 * A write whose target is a variable may hit any path the command mentions; a string literal names
 * its target, so a literal write elsewhere (e.g. `/tmp/x.sql`) does not count.
 */
function inlineWriteMayHit(cmd: string, isProtected: (path: string) => boolean): boolean {
  if (SHELL_WRITE.test(cmd)) {
    return true;
  }
  return [...cmd.matchAll(CODE_WRITE_TARGET)].some((m) => {
    const target = (m[1] ?? m[2] ?? '').trim();
    return !/^["'`]/.test(target) || isProtected(target);
  });
}

const isGeneratedArtifactPath = (path: string): boolean =>
  GENERATED_ARTIFACT_PATH.test(path) || RELATIVE_ARTIFACT_PATH.test(path);

function writesGeneratedArtifact(call: ToolCall, target: string): boolean {
  if (FILE_WRITE_TOOLS.has(call.name)) {
    return GENERATED_ARTIFACT_PATH.test(target);
  }
  // Relative artifact paths only count when the command names analyzer-internal (e.g. after a cd).
  return (
    call.name === 'run_command' &&
    target.includes('analyzer-internal') &&
    isGeneratedArtifactPath(target) &&
    inlineWriteMayHit(target, isGeneratedArtifactPath)
  );
}

function editsSplitDefinition(call: ToolCall, target: string): boolean {
  if (!SPLIT_DEFINITION_PATH.test(target)) {
    return false;
  }
  return (
    FILE_WRITE_TOOLS.has(call.name) ||
    (call.name === 'run_command' &&
      (FILE_MOVE.test(target) || inlineWriteMayHit(target, (path) => SPLIT_DEFINITION_PATH.test(path))))
  );
}

/** Throws on a step without `created_at`: a window that silently drops steps audits the wrong work. */
function isAtOrAfter(step: TranscriptStep, sinceMs: number): boolean {
  if (typeof step.created_at !== 'string') {
    throw new Error(
      `Step ${String(step.step_index)} has no created_at; cannot scope audit with --since`,
    );
  }
  return Date.parse(step.created_at) >= sinceMs;
}

function parseSince(sinceIso: string): number {
  const sinceMs = Date.parse(sinceIso);
  if (Number.isNaN(sinceMs)) {
    throw new Error(`Invalid --since timestamp: ${JSON.stringify(sinceIso)}`);
  }
  return sinceMs;
}

/**
 * Flags hand-edited run artifacts, prompt edits made after reading calibration labels, polling loops,
 * sweeping commits, edits to this audit tool, and ad hoc split edits. See ProcessSignalKind.
 * With `sinceIso`, only signals inside the window are reported, but label reads before the window
 * still count: the agent has already seen the labels.
 */
export function detectProcessSignals(steps: TranscriptStep[], sinceIso?: string): ProcessSignal[] {
  const sinceMs = sinceIso === undefined ? undefined : parseSince(sinceIso);
  const signals: ProcessSignal[] = [];
  let firstLabelReadStep: number | undefined;
  let poll: { startStep: number; count: number; taskIds: Set<string>; inWindow: boolean } | undefined;

  const endPollRun = (): void => {
    if (poll && poll.inWindow && poll.count >= POLLING_LOOP_MIN_POLLS) {
      signals.push({
        kind: 'polling-loop',
        stepIndex: poll.startStep,
        detail: `${poll.count} status polls of ${[...poll.taskIds].join(', ')} with no work in between`,
      });
    }
    poll = undefined;
  };

  for (const [i, step] of steps.entries()) {
    const stepIndex = step.step_index ?? i;
    const inWindow = sinceMs === undefined || isAtOrAfter(step, sinceMs);
    const report = (kind: ProcessSignalKind, detail: string): void => {
      if (inWindow) {
        signals.push({ kind, stepIndex, detail });
      }
    };

    for (const call of step.tool_calls ?? []) {
      if (WAIT_TOOLS.has(call.name)) {
        if (call.name === 'manage_task' && stringArg(call, 'Action') === 'status') {
          poll ??= { startStep: stepIndex, count: 0, taskIds: new Set(), inWindow: false };
          poll.count++;
          poll.taskIds.add(stringArg(call, 'TaskId'));
          poll.inWindow ||= inWindow;
        }
        continue;
      }
      endPollRun();

      const target = stringArg(call, 'Path') || stringArg(call, 'CommandLine');
      if (DIRECT_READ_TOOLS.has(call.name) && CALIBRATION_DATA_PATH.test(target)) {
        firstLabelReadStep ??= stepIndex;
      }
      if (writesGeneratedArtifact(call, target)) {
        report('hand-edited-generated-artifact', `${call.name}: ${target}`);
      }
      if (editsSplitDefinition(call, target)) {
        report('split-definition-edit', `${call.name}: ${target}`);
      }
      if (call.name === 'run_command' && GIT_SWEEP.test(target.replace(QUOTED_STRING, '""'))) {
        report('git-sweep-commit', target);
      }
      if (!FILE_WRITE_TOOLS.has(call.name)) {
        continue;
      }
      if (AUDIT_TOOL_PATH.test(target)) {
        report('audit-tool-edit', target);
      }
      if (PROMPTS_FILE_PATH.test(target) && firstLabelReadStep !== undefined) {
        report(
          'prompt-edit-after-label-read',
          `${target} edited after reading calibration labels at step ${firstLabelReadStep}`,
        );
      }
    }
  }
  endPollRun();
  return signals;
}

/**
 * Keeps only steps created at or after `sinceIso`, so an observer can audit
 * exactly the work since the previous review. Throws on an unparseable bound or a
 * step without `created_at` rather than silently auditing the wrong window.
 */
export function filterStepsSince(
  steps: TranscriptStep[],
  sinceIso: string,
): TranscriptStep[] {
  const sinceMs = parseSince(sinceIso);
  return steps.filter((step) => isAtOrAfter(step, sinceMs));
}

/**
 * Audits a single transcript (represented as steps or as raw JSONL text).
 */
export function auditTranscript(
  stepsOrContent: TranscriptStep[] | string,
  options?: AuditOptions,
): TranscriptAuditResult {
  const allSteps =
    typeof stepsOrContent === 'string'
      ? parseTranscriptJsonl(stepsOrContent)
      : stepsOrContent;
  const steps = options?.since
    ? filterStepsSince(allSteps, options.since)
    : allSteps;

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
    // The whole transcript, so label reads before the window still taint prompt edits inside it.
    processSignals: detectProcessSignals(allSteps, options?.since),
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
  // No fallback to `[]`: an unreadable repos.json would make every split check pass.
  const repos =
    options?.repos ?? (await loadRepos(options?.reposPath ?? REPOS_CONFIG_PATH));

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

  const repos =
    options?.repos ?? (await loadRepos(options?.reposPath ?? REPOS_CONFIG_PATH));

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
    const mentions = result.violations.filter((v) => v.channel === 'mention').length;
    lines.push(
      `Violations (${result.violations.length}: ${result.violations.length - mentions} access, ${mentions} mention):`,
    );
    for (const v of result.violations) {
      const detail =
        v.reason === 'grading-only-repo'
          ? `grading repo '${v.matchedRepo ?? 'unknown'}'`
          : 'labels directory';
      lines.push(
        `  - Step ${v.stepIndex} [${v.toolName}, ${v.channel}]: ${detail} -> ${v.target}`,
      );
    }
  }

  if (result.processSignals.length > 0) {
    lines.push(`Process Signals (${result.processSignals.length}):`);
    for (const s of result.processSignals) {
      lines.push(`  - Step ${s.stepIndex} [${s.kind}]: ${s.detail}`);
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
 * Accepts `--since <iso>` and `--since=<iso>`; unknown flags throw, because a silently ignored
 * `--since=...` would audit the whole transcript instead of the requested window.
 */
export async function runAuditCli(
  args: string[] = process.argv.slice(2),
): Promise<void> {
  const { values, positionals: targets } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      json: { type: 'boolean' },
      repos: { type: 'string' },
      since: { type: 'string' },
    },
  });
  const isJson = values.json === true;
  const since = values.since;

  if (targets.length === 0) {
    console.error('Usage: node audit-transcripts.ts <file-or-dir...> [--json] [--repos <path>] [--since <iso-timestamp>]');
    process.exitCode = 1;
    return;
  }

  const repos = await loadRepos(values.repos ?? REPOS_CONFIG_PATH);

  for (const target of targets) {
    const resolved = isAbsolute(target) ? target : resolve(target);
    const fileStat = await stat(resolved);
    if (fileStat.isDirectory()) {
      const batchResult = await auditTranscriptDir(resolved, { repos, since });
      if (isJson) {
        console.log(JSON.stringify(batchResult, null, 2));
      } else {
        console.log(formatBatchReport(batchResult));
      }
      if (batchResult.violationCount > 0) {
        process.exitCode = 1;
      }
    } else {
      const result = await auditTranscriptFile(resolved, { repos, since });
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
