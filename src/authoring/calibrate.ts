/**
 * Calibration loop for one target: every golden solution must pass the grader 100%, but a
 * failing golden only gets the grader changed when the failure is the grader's fault.
 *
 * After each failed attempt, an independent judge classifies every failing (golden, test) pair and
 * must quote its evidence verbatim; `validateVerdicts` checks the quotes deterministically.
 * - `grader_bug`: rewrite the grader with only those failures and their evidence as context.
 * - `golden_missed_requirement`: the solution isn't golden. Keep its patch as a negative fixture,
 *   regenerate it once, and log a guide-clarity finding. All goldens missing the same test, or a
 *   regenerated golden missing again, fails calibration.
 * - `expectation_not_in_guide`: fail calibration; expectations.md is the file to fix.
 * After every grader rewrite, each negative fixture must still fail its test, or the rewrite is
 * reverted (`LOOSENING_BLOCKED`). Every attempt is logged to `<results>/<app>/calibration/log.json`.
 *
 * Every test must also fail on the untouched starting app. A test that passes there
 * goes to the same judge: `already_satisfied` (the base app really meets the requirement, quoted from
 * its source) exempts it as a graded regression check; `vacuous_test` gets the grader rewritten.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { baseAppsDir, resolveGuideResultsDir } from '../core/paths.ts';
import { cGreen, cRed, cYellow } from '../core/colors.ts';
import {
  type SolutionAgent,
  GUIDE_FILE,
  EXPECTATIONS_FILE,
  TASK_FILE,
  GRADER_FILE,
  TARGETS_DIR,
  SOLUTION_PATCH_FILES,
  getActiveSolutionAgents,
  getDefaultSolutionAgent,
  isDisciplineGuide,
} from '../core/guide-validation.ts';
import { testTargetGrader, runPlaywright, collectFailureMessages, type CalibrationResult, type PageLoadResult, type PlaywrightSuite } from '../grading/run-grader.ts';
import { generateTargetGrader } from '../grading/generate-grader.ts';
import { checkGraderSource, GRADER_RULES } from '../core/grader-lint.ts';
import { setupGuideDevWorkDir, runAgent } from '../harness/lib/utils.ts';
import { buildCalibrationJudgePrompt } from './dev-prompts.ts';

/** Verdicts for a golden solution failing a test. */
export const GOLDEN_VERDICTS = ['grader_bug', 'golden_missed_requirement', 'expectation_not_in_guide'] as const;
/** Verdicts for a test passing on the untouched starting app. */
export const STARTING_APP_VERDICTS = ['already_satisfied', 'vacuous_test'] as const;
export type Verdict = typeof GOLDEN_VERDICTS[number] | typeof STARTING_APP_VERDICTS[number];

/** The `agent` of a pair that is a test passing on the untouched starting app rather than a golden failure. */
export const STARTING_APP = 'starting-app';
export type PairSubject = SolutionAgent | typeof STARTING_APP;

export interface FailurePair {
  agent: PairSubject;
  test: string;
  error: string;
}

export interface JudgeVerdict {
  agent: PairSubject;
  test: string;
  verdict: Verdict;
  expectation: string;
  guideQuote?: string;
  patchEvidence?: string;
  graderEvidence?: string;
  appEvidence?: string;
  reason: string;
}

/** The files a judge's quotes must come from. */
export interface VerdictSources {
  guide: string;
  expectations: string;
  grader: string;
  patches: Partial<Record<SolutionAgent, string>>;
  /** The base app's source text, for `appEvidence` quotes. */
  startingApp: string;
}

export type FindingKind =
  | 'GRADER_BUG'
  | 'GUIDE_CLARITY'
  | 'EXPECTATION_NOT_IN_GUIDE'
  | 'REGRESSION_CHECK'
  | 'VACUOUS_TEST'
  | 'LOOSENING_BLOCKED'
  | 'JUDGE_INVALID'
  | 'MAX_ATTEMPTS'
  | 'PAGE_LOAD_FAILURE'
  | 'PAGE_LOAD_WARNING';

export type PageLoadStatus = 'ok' | 'env_warning' | 'broken';

export interface PageLoadIssue {
  agent: PairSubject;
  status: 'env_warning' | 'broken';
  reason: string;
}

export interface CalibrationFinding {
  kind: FindingKind;
  attempt: number;
  agent?: PairSubject;
  test?: string;
  expectation?: string;
  guideQuote?: string;
  reason: string;
  action: string;
}

export interface CalibrationStep {
  findings: CalibrationFinding[];
  /** Goldens to regenerate before the next attempt. */
  regenerate: SolutionAgent[];
  /** Failing pairs whose patch becomes a negative fixture for that test. */
  rejected: Array<FailurePair & { agent: SolutionAgent }>;
  /** Failure context for a grader rewrite, or null when the grader shouldn't change. */
  graderContext: string | null;
  /** Tests judged `already_satisfied` on the starting app: exempt regression checks from now on. */
  exempt: string[];
  /** Why calibration stops, prefixed with the finding kind, or null to continue. */
  abort: string | null;
}

export interface NegativeFixture {
  agent: SolutionAgent;
  test: string;
  patchPath: string;
}

export interface CalibrationOutcome {
  success: boolean;
  attempts: number;
  findings: CalibrationFinding[];
  fixtures: NegativeFixture[];
  /** Tests exempt as regression checks the untouched starting app already satisfies. */
  exempt: string[];
  /** Set when `success` is false: the abort reason followed by the last calibration log. */
  failureDetails?: string;
}

const normalize = (s: string) => s.replaceAll(/\s+/g, ' ').trim();

function addedLines(patch: string): string {
  return normalize(patch.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).map(l => l.slice(1)).join('\n'));
}

function quoteLines(evidence: string): string[] {
  return evidence.split('\n').map(l => normalize(l.replace(/^\s*\+/, ''))).filter(Boolean);
}

/**
 * Checks a judge's raw `verdicts.json` against the failing pairs: exactly one valid verdict per
 * pair, with every required quote found verbatim (whitespace-normalized) in its source file.
 */
export function validateVerdicts(raw: unknown, pairs: FailurePair[], sources: VerdictSources): { verdicts: JudgeVerdict[]; errors: string[] } {
  const list = raw && typeof raw === 'object' && 'verdicts' in raw ? raw.verdicts : undefined;
  if (!Array.isArray(list)) {
    return { verdicts: [], errors: ['verdicts.json must be a JSON object of the form {"verdicts": [...]}.'] };
  }

  const errors: string[] = [];
  const verdicts: JudgeVerdict[] = [];
  const key = (agent: string, test: string) => `${agent}\u0000${test}`;
  const wanted = new Map(pairs.map(p => [key(p.agent, p.test), p]));
  const seen = new Set<string>();
  const guide = normalize(sources.guide);
  const expectations = normalize(sources.expectations);
  const grader = normalize(sources.grader);
  const startingApp = normalize(sources.startingApp);

  for (const [i, entry] of list.entries()) {
    const str = (field: string): string => {
      const v = entry && typeof entry === 'object' ? (entry as Record<string, unknown>)[field] : undefined;
      return typeof v === 'string' ? v : '';
    };
    const label = `verdicts[${i}] (${str('agent')} / "${str('test')}")`;
    const k = key(str('agent'), str('test'));
    const pair = wanted.get(k);
    if (!pair) {
      errors.push(`${label}: not one of the failures in failures.json; copy "agent" and "test" exactly.`);
      continue;
    }
    if (seen.has(k)) {
      errors.push(`${label}: duplicate verdict for this failure.`);
      continue;
    }
    seen.add(k);

    const verdict = str('verdict');
    const allowed: readonly string[] = pair.agent === STARTING_APP ? STARTING_APP_VERDICTS : GOLDEN_VERDICTS;
    if (!allowed.includes(verdict)) {
      errors.push(`${label}: "verdict" must be one of ${allowed.join(', ')}.`);
      continue;
    }
    const before = errors.length;
    const need = (field: string) => {
      if (!normalize(str(field))) errors.push(`${label}: "${field}" is required for ${verdict}.`);
    };
    need('expectation');
    need('reason');
    if (verdict === 'grader_bug' || verdict === 'golden_missed_requirement') need('guideQuote');
    if (verdict === 'grader_bug') {
      need('patchEvidence');
      need('graderEvidence');
    }
    if (verdict === 'already_satisfied') need('appEvidence');
    if (verdict === 'vacuous_test') need('graderEvidence');

    if (str('expectation') && !expectations.includes(normalize(str('expectation')))) {
      errors.push(`${label}: "expectation" is not verbatim text from ${EXPECTATIONS_FILE}.`);
    }
    if (str('guideQuote') && !guide.includes(normalize(str('guideQuote')))) {
      errors.push(`${label}: "guideQuote" is not verbatim text from ${GUIDE_FILE}.`);
    }
    if (normalize(str('patchEvidence')) && pair.agent !== STARTING_APP) {
      const added = addedLines(sources.patches[pair.agent] ?? '');
      const lines = quoteLines(str('patchEvidence'));
      const missing = lines.length > 0 ? lines.filter(l => !added.includes(l)) : [str('patchEvidence')];
      if (missing.length > 0) errors.push(`${label}: "patchEvidence" lines are not added (+) lines of the ${pair.agent} patch: ${missing.map(l => JSON.stringify(l)).join(', ')}`);
    }
    if (normalize(str('graderEvidence'))) {
      const lines = quoteLines(str('graderEvidence'));
      const missing = lines.length > 0 ? lines.filter(l => !grader.includes(l)) : [str('graderEvidence')];
      if (missing.length > 0) errors.push(`${label}: "graderEvidence" lines are not in ${GRADER_FILE}: ${missing.map(l => JSON.stringify(l)).join(', ')}`);
    }
    if (normalize(str('appEvidence'))) {
      const lines = quoteLines(str('appEvidence'));
      const missing = lines.length > 0 ? lines.filter(l => !startingApp.includes(l)) : [str('appEvidence')];
      if (missing.length > 0) errors.push(`${label}: "appEvidence" lines are not in the starting app's source: ${missing.map(l => JSON.stringify(l)).join(', ')}`);
    }
    if (errors.length > before) continue;

    verdicts.push({
      agent: pair.agent,
      test: pair.test,
      verdict: verdict as Verdict,
      expectation: str('expectation'),
      guideQuote: str('guideQuote') || undefined,
      patchEvidence: str('patchEvidence') || undefined,
      graderEvidence: str('graderEvidence') || undefined,
      appEvidence: str('appEvidence') || undefined,
      reason: str('reason'),
    });
  }

  for (const p of pairs) {
    if (!seen.has(key(p.agent, p.test))) errors.push(`Missing verdict for ${p.agent} / "${p.test}".`);
  }
  return { verdicts, errors };
}

const JS_BUILD_BINARIES = new Set([
  'node', 'npm', 'pnpm', 'npx', 'yarn',
  'tsc', 'vite', 'astro', 'esbuild', 'rollup', 'webpack', 'parcel', 'next', 'nuxt', 'statikk',
]);

function extractMissingExternalTool(text: string): string | null {
  if (!text || text.includes('ERR_PNPM_')) return null;
  const match =
    text.match(/(?:^|\n)\s*(?:(?:sh|bash|zsh|dash):\s*(?:line\s*\d+:\s*|\d+:\s*)?)?([a-zA-Z0-9_.+-]+):\s*(?:command )?not found\b/i) ??
    text.match(/(?:^|\n)\s*(?:zsh:\s*)?command not found:\s*([a-zA-Z0-9_.+-]+)/i);
  const cmd = match?.[1]?.toLowerCase();
  if (!cmd || JS_BUILD_BINARIES.has(cmd)) return null;
  return match?.[1] ?? null;
}

/**
 * Classifies a target's page-load check result for calibration:
 * - `ok`: target has no page (`undefined` or `noPage: true`), or the served page loaded with zero
 *   uncaught exceptions, failed script requests, or HTTP >= 400 responses (`ok: true`).
 * - `env_warning`: the page could not be served (`errors` are all `[server] ...`) solely because
 *   `scripts.build` failed due to a missing external toolchain binary on PATH (e.g. `em++: not found`,
 *   exit 127), which is an environment limitation rather than a broken golden.
 * - `broken`: the served page had runtime/script/document errors (`[pageerror]`, `[requestfailed]`,
 *   `[response 4xx/5xx]`, `[document 4xx/5xx]`, `[navigation]`, `[browser]`), or the target server /
 *   JS build failed on its own code.
 */
export function classifyPageLoad(pageLoad: PageLoadResult | undefined): { status: PageLoadStatus; reason: string } {
  if (!pageLoad || pageLoad.noPage || pageLoad.ok) {
    return { status: 'ok', reason: '' };
  }
  const allServerErrors = pageLoad.errors.length > 0 && pageLoad.errors.every(e => e.startsWith('[server]'));
  const missingTool = allServerErrors
    ? extractMissingExternalTool(pageLoad.buildWarning ?? pageLoad.errors.join('\n'))
    : null;
  if (missingTool) {
    return {
      status: 'env_warning',
      reason: `missing external build tool "${missingTool}" in scripts.build`,
    };
  }
  return {
    status: 'broken',
    reason: pageLoad.errors.join('\n') || 'Page failed to load cleanly.',
  };
}

/**
 * Splits a calibration result into judgeable pairs (a golden failing a test, or a non-exempt test
 * passing on the untouched starting app), grader execution failures (crashes, compile errors, no
 * tests run, or forbidden grader lint violations such as `no-fixed-timeout`), and page-load issues
 * (broken golden page loads, which regenerate once and then fail calibration, plus environment and
 * starting-app page-load warnings).
 */
export function collectFailurePairs(
  res: CalibrationResult,
  agents: readonly SolutionAgent[],
  exempt: readonly string[] = [],
  graderSource?: string
): {
  pairs: FailurePair[];
  executionFailures: string[];
  pageLoadFailures: PageLoadIssue[];
  pageLoadWarnings: PageLoadIssue[];
} {
  const pairs: FailurePair[] = [];
  const executionFailures: string[] = [];
  const pageLoadFailures: PageLoadIssue[] = [];
  const pageLoadWarnings: PageLoadIssue[] = [];

  for (const agent of agents) {
    const check = classifyPageLoad(res.solutions[agent]?.pageLoad);
    if (check.status === 'broken') {
      pageLoadFailures.push({ agent, status: 'broken', reason: check.reason });
    } else if (check.status === 'env_warning') {
      pageLoadWarnings.push({ agent, status: 'env_warning', reason: check.reason });
    }
  }
  if (res.startingApp) {
    const startCheck = classifyPageLoad(res.startingApp.pageLoad);
    if (startCheck.status !== 'ok') {
      pageLoadWarnings.push({ agent: STARTING_APP, status: startCheck.status, reason: startCheck.reason });
    }
  }
  const brokenPageLoadAgents = new Set(pageLoadFailures.map(f => f.agent));

  if (!res.success) {
    for (const agent of agents) {
      if (brokenPageLoadAgents.has(agent)) continue;
      const sol = res.solutions[agent];
      if (!sol || sol.passed + sol.failed === 0) {
        executionFailures.push(`${SOLUTION_PATCH_FILES[agent]}: no test results (dev server crash, grader compile error, or no tests ran).`);
      } else if (sol.failed > 0 && sol.failingTests.length === 0) {
        executionFailures.push(`${SOLUTION_PATCH_FILES[agent]}: ${sol.failed} unexpected results without a failing test title.`);
      } else {
        for (const test of sol.failingTests) pairs.push({ agent, test, error: sol.failureMessages?.[test] ?? '' });
      }
    }
    if (res.startingApp) {
      if (res.startingApp.passed + res.startingApp.failed === 0) {
        executionFailures.push('Untouched starting app: no test results (dev server crash, grader compile error, or no tests ran).');
      } else {
        for (const test of res.startingApp.passingTests) {
          if (!exempt.includes(test)) pairs.push({ agent: STARTING_APP, test, error: '' });
        }
      }
    }
  }
  if (graderSource !== undefined) {
    const violations = checkGraderSource(path.join(TARGETS_DIR, 'app', GRADER_FILE), graderSource)
      .filter(v => GRADER_RULES[v.ruleId].calibrationGate);
    for (const v of violations) {
      executionFailures.push(`${GRADER_FILE}:${v.line}:${v.column} [${v.ruleId} / ${GRADER_RULES[v.ruleId].invariant}] ${v.message}: \`${v.snippet}\``);
    }
  }
  return { pairs, executionFailures, pageLoadFailures, pageLoadWarnings };
}

function fence(text: string): string {
  return `\`\`\`\n${text.trim()}\n\`\`\``;
}

function renderGraderContext(graderBugs: JudgeVerdict[], vacuous: JudgeVerdict[], pairs: FailurePair[], executionFailures: string[], errorDetails: string | undefined): string {
  const parts: string[] = [];
  if (vacuous.length > 0) {
    parts.push('#### Tests that pass on the untouched starting app');
    parts.push('Every test must fail on the untouched base app unless the base app already meets the requirement. An independent review found that each test below passes there without the requirement. Make it assert the requirement itself, starting with a presence assertion where the requirement is a negative (call #12).');
    for (const [i, v] of vacuous.entries()) {
      parts.push([
        `${i + 1}. Test: \`${v.test}\``,
        `Expectation: ${v.expectation}`,
        `Grader lines at fault:\n${fence(v.graderEvidence ?? '')}`,
        `Reviewer's reason: ${v.reason}`,
      ].join('\n'));
    }
  }
  if (graderBugs.length > 0) {
    parts.push('#### Judged as grader bugs');
    parts.push('An independent review compared each failure below with `guide.md` and the solution patch, and found that the solution implements the requirement and the test mis-measures it.');
    for (const [i, v] of graderBugs.entries()) {
      const error = pairs.find(p => p.agent === v.agent && p.test === v.test)?.error ?? '';
      parts.push([
        `${i + 1}. Test: \`${v.test}\``,
        `Solution: \`${v.agent === STARTING_APP ? STARTING_APP : SOLUTION_PATCH_FILES[v.agent]}\``,
        `Expectation: ${v.expectation}`,
        `Guide requirement: "${v.guideQuote ?? ''}"`,
        `Solution lines that implement it:\n${fence(v.patchEvidence ?? '')}`,
        `Grader lines at fault:\n${fence(v.graderEvidence ?? '')}`,
        `Reviewer's reason: ${v.reason}`,
        error ? `Error:\n${fence(error)}` : '',
      ].filter(Boolean).join('\n'));
    }
  }
  if (executionFailures.length > 0) {
    parts.push('#### Grader execution failures');
    parts.push(executionFailures.map(f => `- ${f}`).join('\n'));
    if (errorDetails) parts.push(fence(errorDetails));
  }
  return parts.join('\n\n');
}

/**
 * Decides what one failed calibration attempt leads to, from the judge's validated verdicts.
 * Pure: no I/O, so every branch is unit-tested.
 */
export function planCalibrationStep(input: {
  attempt: number;
  agents: readonly SolutionAgent[];
  pairs: FailurePair[];
  executionFailures: string[];
  pageLoadFailures?: readonly PageLoadIssue[];
  pageLoadWarnings?: readonly PageLoadIssue[];
  verdicts: JudgeVerdict[];
  regenerated: ReadonlySet<SolutionAgent>;
  errorDetails?: string;
}): CalibrationStep {
  const { attempt, agents, pairs, executionFailures, verdicts, regenerated } = input;
  const pageLoadFailures = (input.pageLoadFailures ?? []).filter(
    (f): f is PageLoadIssue & { agent: SolutionAgent } => f.agent !== STARTING_APP
  );
  const pageLoadWarnings = input.pageLoadWarnings ?? [];
  const goldenAgents = (v: JudgeVerdict): v is JudgeVerdict & { agent: SolutionAgent } => v.agent !== STARTING_APP;
  const findings: CalibrationFinding[] = [];
  const aborts: string[] = [];
  const byVerdict = (v: Verdict) => verdicts.filter(x => x.verdict === v);
  const finding = (kind: FindingKind, v: JudgeVerdict, action: string): CalibrationFinding =>
    ({ kind, attempt, agent: v.agent, test: v.test, expectation: v.expectation, guideQuote: v.guideQuote, reason: v.reason, action });

  const notInGuide = byVerdict('expectation_not_in_guide');
  for (const v of notInGuide) {
    aborts.push(`EXPECTATION_NOT_IN_GUIDE: "${v.expectation}" (test "${v.test}", ${v.agent}) is not required by ${GUIDE_FILE}. ${v.reason}`);
  }

  for (const f of pageLoadFailures) {
    if (regenerated.has(f.agent)) {
      aborts.push(`PAGE_LOAD_FAILURE: the regenerated ${f.agent} golden still fails to load cleanly: ${f.reason}`);
    }
  }

  const missed = byVerdict('golden_missed_requirement').filter(goldenAgents);
  const sharedMisses = new Set(
    [...new Set(missed.map(v => v.test))].filter(test => agents.every(a => missed.some(v => v.agent === a && v.test === test)))
  );
  for (const v of missed) {
    if (!sharedMisses.has(v.test) && regenerated.has(v.agent)) {
      aborts.push(`GUIDE_CLARITY: the regenerated ${v.agent} golden still misses "${v.expectation}" (test "${v.test}"), which ${GUIDE_FILE} requires: "${v.guideQuote}"`);
    }
  }
  for (const test of sharedMisses) {
    const v = missed.find(x => x.test === test);
    aborts.push(`GUIDE_CLARITY: all ${agents.length} goldens miss "${v?.expectation}" (test "${test}"), which ${GUIDE_FILE} requires: "${v?.guideQuote}"`);
  }
  const abort = aborts.length > 0 ? aborts.join('\n') : null;

  for (const w of pageLoadWarnings) {
    findings.push({
      kind: 'PAGE_LOAD_WARNING',
      attempt,
      agent: w.agent,
      reason: w.reason,
      action: w.agent === STARTING_APP
        ? 'warning only (untouched starting app did not load cleanly)'
        : 'warning only (missing external build tool)',
    });
  }

  for (const v of notInGuide) {
    findings.push(finding('EXPECTATION_NOT_IN_GUIDE', v, `calibration stopped; fix ${EXPECTATIONS_FILE}`));
  }

  const regenerate: SolutionAgent[] = [];
  for (const f of pageLoadFailures) {
    if (regenerated.has(f.agent)) {
      findings.push({
        kind: 'PAGE_LOAD_FAILURE',
        attempt,
        agent: f.agent,
        reason: f.reason,
        action: 'calibration stopped; the regenerated golden still fails to load cleanly',
      });
    } else {
      findings.push({
        kind: 'PAGE_LOAD_FAILURE',
        attempt,
        agent: f.agent,
        reason: f.reason,
        action: abort ? 'calibration stopped' : `${f.agent} golden regenerated`,
      });
      if (!regenerate.includes(f.agent)) regenerate.push(f.agent);
    }
  }

  const exempt: string[] = [];
  for (const v of byVerdict('already_satisfied')) {
    findings.push(finding('REGRESSION_CHECK', v, 'graded as a regression check; exempt from failing on the starting app'));
    exempt.push(v.test);
  }
  const vacuous = byVerdict('vacuous_test');
  for (const v of vacuous) findings.push(finding('VACUOUS_TEST', v, abort ? 'calibration stopped' : `${GRADER_FILE} rewritten`));
  for (const v of missed) {
    if (sharedMisses.has(v.test)) {
      findings.push(finding('GUIDE_CLARITY', v, 'calibration stopped; every golden missed this requirement'));
    } else if (regenerated.has(v.agent)) {
      findings.push(finding('GUIDE_CLARITY', v, 'calibration stopped; the regenerated golden missed it again'));
    } else {
      findings.push(finding('GUIDE_CLARITY', v, abort ? 'calibration stopped' : `${v.agent} golden regenerated`));
      if (!regenerate.includes(v.agent)) regenerate.push(v.agent);
    }
  }

  const graderBugs = byVerdict('grader_bug').filter(goldenAgents).filter(v => !regenerate.includes(v.agent));
  for (const v of graderBugs) findings.push(finding('GRADER_BUG', v, abort ? 'calibration stopped' : `${GRADER_FILE} rewritten`));

  const hasGraderWork = graderBugs.length > 0 || vacuous.length > 0 || executionFailures.length > 0;
  if (!abort && regenerate.length === 0 && !hasGraderWork && exempt.length === 0) {
    throw new Error(`Calibration failed with nothing to act on (attempt ${attempt}): ${input.errorDetails ?? 'no failure details'}`);
  }
  return {
    findings,
    regenerate: abort ? [] : regenerate,
    rejected: missed.map(v => ({ agent: v.agent, test: v.test, error: pairs.find(p => p.agent === v.agent && p.test === v.test)?.error ?? '' })),
    graderContext: !abort && hasGraderWork ? renderGraderContext(graderBugs, vacuous, pairs, executionFailures, executionFailures.length > 0 ? input.errorDetails : undefined) : null,
    exempt,
    abort,
  };
}

/** Everything `runCalibration` touches outside itself, so tests can stub the LLM and Playwright. */
export interface CalibrationDeps {
  /** Runs calibration; `exempt` tests may pass on the starting app (regression checks). */
  testGrader(exempt: readonly string[]): Promise<CalibrationResult>;
  /** Runs the judge and returns the parsed `verdicts.json` (or undefined when it wrote none). */
  judge(pairs: FailurePair[], validationErrors?: string[]): Promise<unknown>;
  readSources(): VerdictSources;
  rewriteGrader(failureContext: string): Promise<void>;
  regenerateGolden(agent: SolutionAgent): Promise<void>;
  /** Copies the agent's current solution patch somewhere stable and returns that path. */
  snapshotPatch(agent: SolutionAgent, attempt: number): string;
  readGrader(): string;
  writeGrader(content: string): void;
  /** Grades a patch with the current grader and returns the failing test titles. */
  runFixture(patchPath: string): Promise<{ failing: string[]; errored: boolean }>;
  log(entry: Record<string, unknown>): void;
}

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);

export async function runCalibration(
  opts: { agents: readonly SolutionAgent[]; maxRetries: number; judgeAgent: string; graderGenerated?: boolean },
  deps: CalibrationDeps
): Promise<CalibrationOutcome> {
  const findings: CalibrationFinding[] = [];
  const fixtures: NegativeFixture[] = [];
  const regenerated = new Set<SolutionAgent>();
  const exempt = new Set<string>();
  let graderWrittenByPipeline = opts.graderGenerated ?? false;
  const fail = (attempt: number, reason: string, res?: CalibrationResult): CalibrationOutcome =>
    ({ success: false, attempts: attempt, findings, fixtures, exempt: [...exempt], failureDetails: res?.errorDetails ? `${reason}\n\n${res.errorDetails}` : reason });

  for (let attempt = 1; ; attempt++) {
    const res = await deps.testGrader([...exempt]);
    const graderBefore = deps.readGrader();
    const { pairs, executionFailures, pageLoadFailures, pageLoadWarnings } = collectFailurePairs(
      res,
      opts.agents,
      [...exempt],
      graderWrittenByPipeline ? graderBefore : undefined
    );
    for (const w of pageLoadWarnings) {
      const label = w.agent === STARTING_APP ? 'untouched starting app' : `${SOLUTION_PATCH_FILES[w.agent]} (${w.agent})`;
      console.warn(cYellow(`⚠️  Page-load warning for ${label}: ${w.reason}`));
    }
    const summary = {
      success: res.success && executionFailures.length === 0 && pageLoadFailures.length === 0,
      solutions: Object.fromEntries(opts.agents.map(a => [
        a,
        {
          passed: res.solutions[a]?.passed,
          failed: res.solutions[a]?.failed,
          failingTests: res.solutions[a]?.failingTests,
          ...(res.solutions[a]?.pageLoad ? { pageLoad: res.solutions[a]?.pageLoad } : {}),
        },
      ])),
      startingApp: res.startingApp,
      exempt: [...exempt],
    };
    if (res.success && executionFailures.length === 0 && pageLoadFailures.length === 0) {
      for (const w of pageLoadWarnings) {
        findings.push({
          kind: 'PAGE_LOAD_WARNING',
          attempt,
          agent: w.agent,
          reason: w.reason,
          action: w.agent === STARTING_APP
            ? 'warning only (untouched starting app did not load cleanly)'
            : 'warning only (missing external build tool)',
        });
      }
      deps.log({
        attempt,
        graderSha: sha(graderBefore),
        result: summary,
        ...(pageLoadWarnings.length > 0 ? { pageLoadWarnings } : {}),
      });
      return { success: true, attempts: attempt, findings, fixtures, exempt: [...exempt] };
    }
    let verdicts: JudgeVerdict[] = [];
    const judgeErrors: string[][] = [];
    if (pairs.length > 0) {
      const sources = deps.readSources();
      let checked = validateVerdicts(await deps.judge(pairs), pairs, sources);
      if (checked.errors.length > 0) {
        judgeErrors.push(checked.errors);
        checked = validateVerdicts(await deps.judge(pairs, checked.errors), pairs, sources);
      }
      if (checked.errors.length > 0) {
        judgeErrors.push(checked.errors);
        findings.push({ kind: 'JUDGE_INVALID', attempt, reason: checked.errors.join('\n'), action: 'calibration stopped' });
        deps.log({ attempt, judgeAgent: opts.judgeAgent, graderSha: sha(graderBefore), result: summary, pairs, judgeErrors });
        return fail(attempt, `JUDGE_INVALID: the calibration judge's verdicts failed validation twice:\n${checked.errors.join('\n')}`, res);
      }
      verdicts = checked.verdicts;
    }

    const step = planCalibrationStep({
      attempt,
      agents: opts.agents,
      pairs,
      executionFailures,
      pageLoadFailures,
      pageLoadWarnings,
      verdicts,
      regenerated,
      errorDetails: res.errorDetails,
    });
    findings.push(...step.findings);
    for (const t of step.exempt) exempt.add(t);
    const snapshots = new Map<SolutionAgent, string>();
    for (const p of step.rejected) {
      if (!snapshots.has(p.agent)) snapshots.set(p.agent, deps.snapshotPatch(p.agent, attempt));
      fixtures.push({ agent: p.agent, test: p.test, patchPath: snapshots.get(p.agent) ?? '' });
    }

    const outOfAttempts = attempt > opts.maxRetries;
    const entry: Record<string, unknown> = {
      attempt, judgeAgent: opts.judgeAgent, graderSha: sha(graderBefore), result: summary, pairs, verdicts,
      judgeErrors, executionFailures,
      ...(pageLoadFailures.length > 0 ? { pageLoadFailures } : {}),
      ...(pageLoadWarnings.length > 0 ? { pageLoadWarnings } : {}),
      regenerate: step.regenerate, newlyExempt: step.exempt, abort: step.abort, rewroteGrader: false,
    };
    if (!step.abort && step.regenerate.length === 0 && !step.graderContext) {
      deps.log(entry);
      return { success: true, attempts: attempt, findings, fixtures, exempt: [...exempt] };
    }
    if (step.abort || outOfAttempts) {
      deps.log(entry);
      if (step.abort) return fail(attempt, step.abort, res);
      findings.push({ kind: 'MAX_ATTEMPTS', attempt, reason: `still failing after ${attempt} attempts`, action: 'calibration stopped' });
      return fail(attempt, `MAX_ATTEMPTS: calibration still fails after ${attempt} attempts.`, res);
    }

    if (step.regenerate.length > 0) {
      console.log(cYellow(`Regenerating golden solution(s) that missed a ${GUIDE_FILE} requirement: ${step.regenerate.join(', ')}`));
      await Promise.all(step.regenerate.map(a => deps.regenerateGolden(a)));
      for (const a of step.regenerate) regenerated.add(a);
    }

    if (step.graderContext) {
      const graderWasWritten = graderWrittenByPipeline;
      console.log(cYellow(`Attempt ${attempt}: rewriting ${GRADER_FILE} for grader-side failures...`));
      await deps.rewriteGrader(step.graderContext);
      entry.rewroteGrader = true;
      graderWrittenByPipeline = true;
      const loosened: NegativeFixture[] = [];
      for (const f of fixtures) {
        const { failing, errored } = await deps.runFixture(f.patchPath);
        if (!errored && !failing.includes(f.test)) loosened.push(f);
      }
      if (loosened.length > 0) {
        deps.writeGrader(graderBefore);
        entry.rewroteGrader = false;
        graderWrittenByPipeline = graderWasWritten;
        for (const f of loosened) {
          findings.push({ kind: 'LOOSENING_BLOCKED', attempt, agent: f.agent, test: f.test, reason: `the rewritten ${GRADER_FILE} no longer fails a rejected ${f.agent} patch on this test (it passes or was renamed)`, action: `${GRADER_FILE} rewrite reverted` });
        }
        console.log(cRed(`Reverted the ${GRADER_FILE} rewrite: it stopped failing ${loosened.length} rejected patch/test pair(s).`));
      } else {
        // A rewritten test may no longer be the one the judge exempted, so exemptions are re-judged.
        exempt.clear();
      }
      entry.graderShaAfter = sha(deps.readGrader());
    }
    deps.log(entry);
  }
}

// ---------------------------------------------------------------------------------------------
// Production wiring
// ---------------------------------------------------------------------------------------------

function calibrationDir(guideDirAbs: string, baseApp: string): string {
  return path.join(resolveGuideResultsDir(guideDirAbs), baseApp, 'calibration');
}

async function runCalibrationJudge(guideDirAbs: string, baseApp: string, pairs: FailurePair[], validationErrors?: string[]): Promise<unknown> {
  const targetDir = path.join(guideDirAbs, TARGETS_DIR, baseApp);
  const agent = getDefaultSolutionAgent();
  const { workDir, tempHome } = setupGuideDevWorkDir(`${baseApp}-judge`);
  try {
    fs.cpSync(path.join(baseAppsDir, baseApp), workDir, { recursive: true, filter: src => !src.includes('node_modules') });
    for (const f of [GUIDE_FILE, EXPECTATIONS_FILE]) fs.copyFileSync(path.join(guideDirAbs, f), path.join(workDir, f));
    for (const f of [TASK_FILE, GRADER_FILE]) fs.copyFileSync(path.join(targetDir, f), path.join(workDir, f));
    const agents = [...new Set(pairs.map(p => p.agent))].filter((a): a is SolutionAgent => a !== STARTING_APP);
    for (const a of agents) {
      fs.mkdirSync(path.dirname(path.join(workDir, SOLUTION_PATCH_FILES[a])), { recursive: true });
      fs.copyFileSync(path.join(targetDir, SOLUTION_PATCH_FILES[a]), path.join(workDir, SOLUTION_PATCH_FILES[a]));
    }
    fs.writeFileSync(path.join(workDir, 'failures.json'), JSON.stringify(pairs.map(p => ({ ...p, patchFile: p.agent === STARTING_APP ? null : SOLUTION_PATCH_FILES[p.agent] })), null, 2));

    const prompt = buildCalibrationJudgePrompt({
      guideFile: GUIDE_FILE,
      expectationsFile: EXPECTATIONS_FILE,
      taskFile: TASK_FILE,
      graderFile: GRADER_FILE,
      patchFiles: agents.map(a => SOLUTION_PATCH_FILES[a]),
      failuresFile: 'failures.json',
      verdictsFile: 'verdicts.json',
      baseApp,
      isDisciplineGuide: isDisciplineGuide(path.basename(guideDirAbs), path.basename(path.dirname(guideDirAbs))),
      validationErrors,
    });
    console.log(`Asking ${agent} to judge ${pairs.length} calibration failure(s) on ${baseApp}...`);
    await runAgent(agent, prompt, workDir, { homeDir: tempHome });

    const verdictsPath = path.join(workDir, 'verdicts.json');
    if (!fs.existsSync(verdictsPath)) {
      console.warn(cYellow(`The calibration judge wrote no verdicts.json for ${baseApp}.`));
      return undefined;
    }
    try {
      return JSON.parse(fs.readFileSync(verdictsPath, 'utf-8'));
    } catch (err) {
      console.warn(cYellow(`The calibration judge's verdicts.json for ${baseApp} is not valid JSON: ${(err as Error).message}`));
      return undefined;
    }
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
  }
}

const SOURCE_EXTENSIONS = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.ts', '.tsx', '.jsx', '.astro', '.vue', '.svelte', '.json', '.md']);

/** Concatenates the base app's source files, so `appEvidence` quotes can be checked verbatim. */
function readStartingAppSource(baseApp: string): string {
  const root = path.join(baseAppsDir, baseApp);
  return fs.readdirSync(root, { recursive: true, encoding: 'utf-8' })
    .filter(rel => !rel.split(path.sep).some(part => part === 'node_modules' || part.startsWith('.')) && SOURCE_EXTENSIONS.has(path.extname(rel)) && !rel.endsWith('lock.json'))
    .sort()
    .map(rel => fs.readFileSync(path.join(root, rel), 'utf-8'))
    .join('\n');
}

async function gradeFixture(targetDir: string, patchPath: string): Promise<{ failing: string[]; errored: boolean }> {
  try {
    const results = await runPlaywright(targetDir, path.join(targetDir, GRADER_FILE), 'ignore', patchPath);
    const failing = (results.suites || []).flatMap((s: PlaywrightSuite) => Object.keys(collectFailureMessages(s)));
    return { failing, errored: Boolean(results.errors?.length) };
  } catch (err) {
    console.warn(cYellow(`Could not grade negative fixture ${patchPath}: ${(err as Error).message}`));
    return { failing: [], errored: true };
  }
}

function createCalibrationDeps(
  guideDirAbs: string,
  baseApp: string,
  opts: { regenerateGolden: (agent: SolutionAgent) => Promise<void>; prContext?: Parameters<typeof generateTargetGrader>[3] }
): CalibrationDeps {
  const targetDir = path.join(guideDirAbs, TARGETS_DIR, baseApp);
  const graderPath = path.join(targetDir, GRADER_FILE);
  const outDir = calibrationDir(guideDirAbs, baseApp);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'rejected'), { recursive: true });
  const logEntries: Record<string, unknown>[] = [];
  const readOptional = (p: string) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '');

  return {
    testGrader: exempt => testTargetGrader(guideDirAbs, baseApp, exempt),
    judge: (pairs, validationErrors) => runCalibrationJudge(guideDirAbs, baseApp, pairs, validationErrors),
    readSources: () => ({
      guide: fs.readFileSync(path.join(guideDirAbs, GUIDE_FILE), 'utf-8'),
      expectations: fs.readFileSync(path.join(guideDirAbs, EXPECTATIONS_FILE), 'utf-8'),
      grader: fs.readFileSync(graderPath, 'utf-8'),
      patches: Object.fromEntries(getActiveSolutionAgents(targetDir).map(a => [a, readOptional(path.join(targetDir, SOLUTION_PATCH_FILES[a]))])),
      startingApp: readStartingAppSource(baseApp),
    }),
    rewriteGrader: context => generateTargetGrader(guideDirAbs, baseApp, context, opts.prContext),
    regenerateGolden: opts.regenerateGolden,
    snapshotPatch: (agent, attempt) => {
      const dest = path.join(outDir, 'rejected', `${agent}-attempt${attempt}.patch`);
      fs.copyFileSync(path.join(targetDir, SOLUTION_PATCH_FILES[agent]), dest);
      return dest;
    },
    readGrader: () => fs.readFileSync(graderPath, 'utf-8'),
    writeGrader: content => fs.writeFileSync(graderPath, content),
    runFixture: patchPath => gradeFixture(targetDir, patchPath),
    log: entry => {
      logEntries.push({ at: new Date().toISOString(), ...entry });
      fs.writeFileSync(path.join(outDir, 'log.json'), JSON.stringify(logEntries, null, 2));
    },
  };
}

/** Calibrates one target with the production judge, grader generator and Playwright runner. */
export async function calibrateTarget(
  guideDirAbs: string,
  baseApp: string,
  opts: { maxRetries: number; regenerateGolden: (agent: SolutionAgent) => Promise<void>; prContext?: Parameters<typeof generateTargetGrader>[3]; graderGenerated?: boolean }
): Promise<CalibrationOutcome> {
  const targetDir = path.join(guideDirAbs, TARGETS_DIR, baseApp);
  const outcome = await runCalibration(
    { agents: getActiveSolutionAgents(targetDir), maxRetries: opts.maxRetries, judgeAgent: getDefaultSolutionAgent(), graderGenerated: opts.graderGenerated },
    createCalibrationDeps(guideDirAbs, baseApp, opts)
  );
  if (outcome.success) {
    console.log(cGreen(`✅ ${baseApp} calibrated successfully on attempt ${outcome.attempts}!`));
  } else {
    console.error(cRed(`❌ ${baseApp} failed calibration after ${outcome.attempts} attempt(s): ${outcome.failureDetails?.split('\n')[0]}`));
  }
  return outcome;
}

const cell = (s: string | undefined) => (s ?? '').replaceAll('|', '\\|').replaceAll(/\s+/g, ' ').trim();

/** Renders calibration findings as a deterministic markdown section (no LLM prose) for report.md. */
export function renderCalibrationFindings(byTarget: ReadonlyMap<string, readonly CalibrationFinding[]>): string {
  const targets = [...byTarget].filter(([, f]) => f.length > 0);
  if (targets.length === 0) return '';
  let md = `## Calibration findings\n\nWritten by \`gd dev\` from the calibration judge's validated verdicts (quotes are checked verbatim against \`${GUIDE_FILE}\`). \`GUIDE_CLARITY\` means a golden solution missed a requirement \`${GUIDE_FILE}\` states; \`GRADER_BUG\` rows justify each grader rewrite.\n`;
  for (const [baseApp, findings] of targets) {
    md += `\n### Target: \`${baseApp}\`\n\n| Attempt | Kind | Golden | Test | Guide quote | Reason | Action |\n|---|---|---|---|---|---|---|\n`;
    for (const f of findings) {
      md += `| ${f.attempt} | \`${f.kind}\` | ${cell(f.agent)} | ${cell(f.test)} | ${f.guideQuote ? `"${cell(f.guideQuote)}"` : ''} | ${cell(f.reason)} | ${cell(f.action)} |\n`;
    }
  }
  return md;
}
