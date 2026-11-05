import test from 'node:test';
import assert from 'node:assert';
import { Agents } from '../harness/config.ts';
import type { SolutionAgent } from '../core/guide-validation.ts';
import type { CalibrationResult } from '../grading/run-grader.ts';
import {
  validateVerdicts,
  classifyPageLoad,
  collectFailurePairs,
  planCalibrationStep,
  runCalibration,
  renderCalibrationFindings,
  STARTING_APP,
  type CalibrationDeps,
  type FailurePair,
  type PairSubject,
  type JudgeVerdict,
  type VerdictSources,
} from './calibrate.ts';

const AGY = Agents.ANTIGRAVITY_CLI as SolutionAgent;
const CLAUDE = Agents.CLAUDE_CODE as SolutionAgent;
const CODEX = Agents.CODEX_CLI as SolutionAgent;
const AGENTS = [AGY, CLAUDE, CODEX];

const DRAG = 'Browser tests > The drag sequence remains active after the pointer leaves the handle';
const OFFSET = 'Browser tests > Repositioning coordinates preserve the pointer offset';

const sources: VerdictSources = {
  guide: '# Drag\n\nCall `setPointerCapture()` on pointerdown so the drag\ncontinues when the pointer leaves the handle.\n\nYou may also add a grab cursor.',
  expectations: '- The drag sequence remains active after the pointer leaves the handle\n- Repositioning coordinates preserve the pointer offset',
  grader: "const dirY = info!.panelRect.top > info!.viewportHeight / 2 ? -1 : 1;\nconst firstY = info!.grabY + dirY * 100;",
  startingApp: '<nav>\n  <a href="/">Home</a>\n</nav>\n<img src="hero.jpg" alt="Latte art">',
  patches: {
    [AGY]: '--- a/app.js\n+++ b/app.js\n@@ -1,1 +1,2 @@\n handle.addEventListener("pointerdown", e => {\n+  handle.setPointerCapture(e.pointerId);\n',
    [CLAUDE]: '+++ b/app.js\n+  handle.setPointerCapture(event.pointerId);\n',
    [CODEX]: '+++ b/app.js\n+  el.onpointermove = move;\n',
  },
};

const graderBug = (agent: SolutionAgent, test = DRAG): JudgeVerdict => ({
  agent,
  test,
  verdict: 'grader_bug',
  expectation: 'The drag sequence remains active after the pointer leaves the handle',
  guideQuote: 'Call `setPointerCapture()` on pointerdown so the drag continues when the pointer leaves the handle.',
  patchEvidence: { [AGY]: '+  handle.setPointerCapture(e.pointerId);', [CLAUDE]: '+  handle.setPointerCapture(event.pointerId);', [CODEX]: '+  el.onpointermove = move;' }[agent],
  graderEvidence: 'const firstY = info!.grabY + dirY * 100;',
  reason: 'The 150px vertical travel hits the viewport clamp.',
});

const missed = (agent: SolutionAgent, test = DRAG): JudgeVerdict => ({
  agent,
  test,
  verdict: 'golden_missed_requirement',
  expectation: 'The drag sequence remains active after the pointer leaves the handle',
  guideQuote: 'Call `setPointerCapture()` on pointerdown so the drag continues when the pointer leaves the handle.',
  reason: 'The patch never captures the pointer.',
});

const notInGuide = (agent: SolutionAgent, test = OFFSET): JudgeVerdict => ({
  agent,
  test,
  verdict: 'expectation_not_in_guide',
  expectation: 'Repositioning coordinates preserve the pointer offset',
  reason: 'guide.md never mentions the pointer offset.',
});

const pair = (agent: PairSubject, test = DRAG): FailurePair => ({ agent, test, error: 'Expected: <= 2\nReceived: 20' });

test('validateVerdicts accepts verbatim evidence, normalizing whitespace and leading + markers', () => {
  const pairs = [pair(AGY), pair(CODEX)];
  const { verdicts, errors } = validateVerdicts({ verdicts: [graderBug(AGY), missed(CODEX)] }, pairs, sources);
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(verdicts.map(v => v.verdict), ['grader_bug', 'golden_missed_requirement']);
});

test('validateVerdicts rejects paraphrased quotes, evidence from context lines and missing required fields', () => {
  const pairs = [pair(AGY), pair(CLAUDE), pair(CODEX)];
  const raw = {
    verdicts: [
      { ...graderBug(AGY), guideQuote: 'Use pointer capture so drags continue.' },
      // a context line (no +) of the agy patch is not evidence of what the solution added
      { ...graderBug(CLAUDE), patchEvidence: 'handle.addEventListener("pointerdown", e => {' },
      { ...graderBug(CODEX), graderEvidence: undefined },
    ],
  };
  const { verdicts, errors } = validateVerdicts(raw, pairs, sources);
  assert.strictEqual(verdicts.length, 0);
  assert.strictEqual(errors.length, 3);
  assert.match(errors[0], /"guideQuote" is not verbatim text from guide\.md/);
  assert.match(errors[1], /"patchEvidence" lines are not added \(\+\) lines of the claude_code patch/);
  assert.match(errors[2], /"graderEvidence" is required for grader_bug/);
  assert.match(validateVerdicts({ verdicts: [{ ...graderBug(AGY), patchEvidence: '+' }] }, [pair(AGY)], sources).errors[0], /"patchEvidence" lines are not added \(\+\) lines/);
  assert.match(validateVerdicts({ verdicts: [{ ...graderBug(AGY), graderEvidence: '+' }] }, [pair(AGY)], sources).errors[0], /"graderEvidence" lines are not in grader\.ts/);
});

test('validateVerdicts requires exactly one valid verdict per failing pair', () => {
  const pairs = [pair(AGY), pair(CLAUDE), pair(CODEX)];
  const raw = {
    verdicts: [
      graderBug(AGY),
      graderBug(AGY),
      { ...graderBug(CLAUDE), test: 'some other test' },
      { ...missed(CLAUDE), verdict: 'flaky' },
    ],
  };
  const { errors } = validateVerdicts(raw, pairs, sources);
  assert.ok(errors.some(e => /duplicate verdict/.test(e)));
  assert.ok(errors.some(e => /not one of the failures in failures\.json/.test(e)));
  assert.ok(errors.some(e => /"verdict" must be one of/.test(e)));
  assert.ok(errors.some(e => e.startsWith(`Missing verdict for ${CODEX}`)));
  assert.match(validateVerdicts(undefined, pairs, sources).errors[0], /must be a JSON object/);
  assert.match(validateVerdicts({ verdicts: 'nope' }, pairs, sources).errors[0], /must be a JSON object/);
});

test('validateVerdicts lets expectation_not_in_guide omit the guide quote but still checks the expectation', () => {
  assert.deepStrictEqual(validateVerdicts({ verdicts: [notInGuide(AGY)] }, [pair(AGY, OFFSET)], sources).errors, []);
  const { errors } = validateVerdicts({ verdicts: [{ ...notInGuide(AGY), expectation: 'Something the file never says' }] }, [pair(AGY, OFFSET)], sources);
  assert.match(errors[0], /"expectation" is not verbatim text from expectations\.md/);
});

function result(failing: Partial<Record<SolutionAgent, string[]>>, extra: Partial<CalibrationResult> = {}): CalibrationResult {
  const solutions = Object.fromEntries(AGENTS.map(a => {
    const tests = failing[a] ?? [];
    return [a, { passed: 5 - tests.length, failed: tests.length, failingTests: tests, failureMessages: Object.fromEntries(tests.map(t => [t, `error for ${t}`])) }];
  }));
  return { success: false, solutions, startingApp: { passed: 0, failed: 5, passingTests: [] }, errorDetails: 'combined log', ...extra };
}

test('collectFailurePairs separates judgeable test failures from grader execution failures', () => {
  const res = result({ [CLAUDE]: [DRAG] }, { startingApp: { passed: 2, failed: 3, passingTests: [OFFSET, 'Images have alt text'] } });
  res.solutions[CODEX] = { passed: 0, failed: 0, failingTests: [] };
  const { pairs, executionFailures } = collectFailurePairs(res, AGENTS, ['Images have alt text']);
  assert.deepStrictEqual(pairs, [
    { agent: CLAUDE, test: DRAG, error: `error for ${DRAG}` },
    { agent: STARTING_APP, test: OFFSET, error: '' },
  ], 'a starting-app pass is judged unless already exempt');
  assert.strictEqual(executionFailures.length, 1);
  assert.match(executionFailures[0], /codex-solution\.patch: no test results/);
  const crashed = collectFailurePairs(result({}, { startingApp: { passed: 0, failed: 0, passingTests: [] } }), AGENTS);
  assert.match(crashed.executionFailures[0], /Untouched starting app: no test results/);
});

const plan = (verdicts: JudgeVerdict[], extra: Partial<Parameters<typeof planCalibrationStep>[0]> = {}) =>
  planCalibrationStep({
    attempt: 1,
    agents: AGENTS,
    pairs: verdicts.map(v => pair(v.agent, v.test)),
    executionFailures: [],
    verdicts,
    regenerated: new Set(),
    ...extra,
  });

test('planCalibrationStep: a shared grader bug (the drag case) rewrites the grader with the evidence, no abort', () => {
  const step = plan([graderBug(AGY), graderBug(CLAUDE), graderBug(CODEX)]);
  assert.strictEqual(step.abort, null);
  assert.deepStrictEqual(step.regenerate, []);
  assert.ok(step.graderContext?.includes('Judged as grader bugs'));
  assert.ok(step.graderContext?.includes('const firstY = info!.grabY + dirY * 100;'));
  assert.ok(step.graderContext?.includes('Received: 20'), 'each pair keeps its own error message');
  assert.deepStrictEqual(step.findings.map(f => f.kind), ['GRADER_BUG', 'GRADER_BUG', 'GRADER_BUG']);
});

test('planCalibrationStep: one golden missing a stated requirement is regenerated and rejected, never fixed in the grader', () => {
  const step = plan([missed(CODEX), graderBug(CLAUDE, OFFSET)]);
  assert.strictEqual(step.abort, null);
  assert.deepStrictEqual(step.regenerate, [CODEX]);
  assert.deepStrictEqual(step.rejected.map(p => [p.agent, p.test]), [[CODEX, DRAG]]);
  assert.ok(step.graderContext?.includes(OFFSET));
  assert.ok(!step.graderContext?.includes(DRAG), 'the missed requirement must not reach the grader rewrite');
  assert.deepStrictEqual(step.findings.map(f => [f.kind, f.action]), [['GUIDE_CLARITY', `${CODEX} golden regenerated`], ['GRADER_BUG', 'grader.ts rewritten']]);
});

test('planCalibrationStep: grader-bug verdicts for a golden being regenerated are dropped', () => {
  const step = plan([missed(CODEX), graderBug(CODEX, OFFSET)]);
  assert.deepStrictEqual(step.regenerate, [CODEX]);
  assert.strictEqual(step.graderContext, null);
});

test('planCalibrationStep: a regenerated golden that misses again fails calibration with GUIDE_CLARITY', () => {
  const step = plan([missed(CODEX)], { regenerated: new Set([CODEX]) });
  assert.match(step.abort ?? '', /^GUIDE_CLARITY: the regenerated codex_cli golden still misses/);
  assert.deepStrictEqual(step.regenerate, []);
  assert.strictEqual(step.graderContext, null);
  assert.deepStrictEqual(step.rejected.map(p => p.agent), [CODEX]);
});

test('planCalibrationStep: every golden missing the same requirement aborts without regenerating', () => {
  const step = plan([missed(AGY), missed(CLAUDE), missed(CODEX)]);
  assert.match(step.abort ?? '', /^GUIDE_CLARITY: all 3 goldens miss/);
  assert.ok(step.abort?.includes('setPointerCapture()'));
  assert.deepStrictEqual(step.regenerate, []);
  assert.strictEqual(step.rejected.length, 3);
});

test('planCalibrationStep: an expectation the guide does not require aborts and leaves the golden and grader alone', () => {
  const step = plan([notInGuide(AGY), graderBug(CLAUDE)]);
  assert.match(step.abort ?? '', /^EXPECTATION_NOT_IN_GUIDE: "Repositioning coordinates preserve the pointer offset"/);
  assert.strictEqual(step.graderContext, null);
  assert.deepStrictEqual(step.regenerate, []);
  assert.deepStrictEqual(step.rejected, []);
  assert.deepStrictEqual(step.findings.map(f => [f.kind, f.action]), [
    ['EXPECTATION_NOT_IN_GUIDE', 'calibration stopped; fix expectations.md'],
    ['GRADER_BUG', 'calibration stopped'],
  ]);
});

test('planCalibrationStep: mixed verdicts on one shared test are handled per golden', () => {
  const step = plan([missed(AGY), graderBug(CLAUDE), graderBug(CODEX)]);
  assert.strictEqual(step.abort, null);
  assert.deepStrictEqual(step.regenerate, [AGY]);
  assert.ok(step.graderContext?.includes('claude-solution.patch'));
});

test('planCalibrationStep: execution failures rewrite the grader without a judge', () => {
  const step = plan([], { executionFailures: ['Untouched starting app: no test results'], errorDetails: 'raw log' });
  assert.ok(step.graderContext?.includes('Grader execution failures'));
  assert.ok(step.graderContext?.includes('raw log'));
  assert.throws(() => plan([]), /nothing to act on/);
});

interface FakeState {
  results: CalibrationResult[];
  judgeOutputs: unknown[];
  grader: string;
  rewrites: string[];
  regenerated: SolutionAgent[];
  fixtureFailing: (grader: string) => string[];
  logs: Record<string, unknown>[];
  judgeCalls: number;
  rewriteTo: string[];
}

function fakeDeps(state: FakeState): CalibrationDeps {
  return {
    testGrader: async () => {
      const next = state.results.shift();
      if (!next) throw new Error('no more fake results');
      return next;
    },
    judge: async () => {
      state.judgeCalls++;
      return state.judgeOutputs.shift();
    },
    readSources: () => sources,
    rewriteGrader: async context => {
      state.rewrites.push(context);
      state.grader = state.rewriteTo.shift() ?? `${state.grader}+rewrite`;
    },
    regenerateGolden: async agent => { state.regenerated.push(agent); },
    snapshotPatch: (agent, attempt) => `/rejected/${agent}-attempt${attempt}.patch`,
    readGrader: () => state.grader,
    writeGrader: content => { state.grader = content; },
    runFixture: async () => ({ failing: state.fixtureFailing(state.grader), errored: false }),
    log: entry => { state.logs.push(entry); },
  };
}

const PASS: CalibrationResult = { success: true, solutions: {}, startingApp: { passed: 0, failed: 5, passingTests: [] } };
const newState = (over: Partial<FakeState>): FakeState => ({
  results: [], judgeOutputs: [], grader: 'v1', rewrites: [], regenerated: [], fixtureFailing: () => [DRAG], logs: [], judgeCalls: 0, rewriteTo: [], ...over,
});

test('runCalibration: drag replay, a shared grader bug is rewritten once and calibration continues', async () => {
  const state = newState({
    results: [result({ [AGY]: [DRAG], [CLAUDE]: [DRAG], [CODEX]: [DRAG] }), PASS],
    judgeOutputs: [{ verdicts: [graderBug(AGY), graderBug(CLAUDE), graderBug(CODEX)] }],
  });
  const out = await runCalibration({ agents: AGENTS, maxRetries: 4, judgeAgent: AGY }, fakeDeps(state));
  assert.strictEqual(out.success, true);
  assert.strictEqual(out.attempts, 2);
  assert.strictEqual(state.rewrites.length, 1);
  assert.deepStrictEqual(state.regenerated, []);
  assert.strictEqual(state.logs[0].judgeAgent, AGY);
  assert.strictEqual(state.logs[0].rewroteGrader, true);
});

test('runCalibration: a golden that missed the guide is regenerated, recorded as a finding, then calibrates', async () => {
  const state = newState({
    results: [result({ [CODEX]: [DRAG] }), PASS],
    judgeOutputs: [{ verdicts: [missed(CODEX)] }],
  });
  const out = await runCalibration({ agents: AGENTS, maxRetries: 4, judgeAgent: AGY }, fakeDeps(state));
  assert.strictEqual(out.success, true);
  assert.deepStrictEqual(state.regenerated, [CODEX]);
  assert.strictEqual(state.rewrites.length, 0, 'the grader must not change for a golden miss');
  assert.deepStrictEqual(out.fixtures, [{ agent: CODEX, test: DRAG, patchPath: `/rejected/${CODEX}-attempt1.patch` }]);
  assert.deepStrictEqual(out.findings.map(f => f.kind), ['GUIDE_CLARITY']);
});

test('runCalibration: a grader rewrite that stops failing a rejected patch is reverted (LOOSENING_BLOCKED)', async () => {
  const state = newState({
    results: [
      result({ [CODEX]: [DRAG] }),
      result({ [CLAUDE]: [OFFSET] }),
      PASS,
    ],
    judgeOutputs: [{ verdicts: [missed(CODEX)] }, { verdicts: [graderBug(CLAUDE, OFFSET)] }],
    rewriteTo: ['v2-loose'],
    // the loosened grader no longer fails the rejected codex patch on DRAG
    fixtureFailing: grader => (grader === 'v2-loose' ? [] : [DRAG]),
  });
  const out = await runCalibration({ agents: AGENTS, maxRetries: 4, judgeAgent: AGY }, fakeDeps(state));
  assert.strictEqual(state.grader, 'v1', 'the loosening rewrite must be reverted');
  assert.ok(out.findings.some(f => f.kind === 'LOOSENING_BLOCKED' && f.agent === CODEX && f.test === DRAG));
  assert.strictEqual(state.logs[1].rewroteGrader, false);
  assert.strictEqual(out.success, true);
});

test('runCalibration: a regenerated golden that misses again fails with GUIDE_CLARITY', async () => {
  const state = newState({
    results: [result({ [CODEX]: [DRAG] }), result({ [CODEX]: [DRAG] })],
    judgeOutputs: [{ verdicts: [missed(CODEX)] }, { verdicts: [missed(CODEX)] }],
  });
  const out = await runCalibration({ agents: AGENTS, maxRetries: 4, judgeAgent: AGY }, fakeDeps(state));
  assert.strictEqual(out.success, false);
  assert.match(out.failureDetails ?? '', /^GUIDE_CLARITY: the regenerated codex_cli golden still misses/);
  assert.ok(out.failureDetails?.includes('combined log'));
  assert.deepStrictEqual(state.regenerated, [CODEX]);
  assert.strictEqual(out.fixtures.length, 2);
});

test('runCalibration: invalid judge output gets one retry, then fails with JUDGE_INVALID', async () => {
  const state = newState({
    results: [result({ [CODEX]: [DRAG] })],
    judgeOutputs: [{ verdicts: [] }, undefined],
  });
  const out = await runCalibration({ agents: AGENTS, maxRetries: 4, judgeAgent: AGY }, fakeDeps(state));
  assert.strictEqual(state.judgeCalls, 2);
  assert.strictEqual(out.success, false);
  assert.match(out.failureDetails ?? '', /^JUDGE_INVALID/);
  assert.strictEqual(state.rewrites.length, 0);
});

test('runCalibration: a corrected retry from the judge is used', async () => {
  const state = newState({
    results: [result({ [CLAUDE]: [DRAG] }), PASS],
    judgeOutputs: [{ verdicts: [{ ...graderBug(CLAUDE), guideQuote: 'paraphrase' }] }, { verdicts: [graderBug(CLAUDE)] }],
  });
  const out = await runCalibration({ agents: AGENTS, maxRetries: 4, judgeAgent: AGY }, fakeDeps(state));
  assert.strictEqual(out.success, true);
  assert.strictEqual(state.judgeCalls, 2);
  assert.strictEqual((state.logs[0].judgeErrors as string[][]).length, 1);
});

test('runCalibration: stops after maxRetries with MAX_ATTEMPTS when grader bugs persist', async () => {
  const failing = () => result({ [CLAUDE]: [DRAG] });
  const state = newState({
    results: [failing(), failing(), failing()],
    judgeOutputs: [{ verdicts: [graderBug(CLAUDE)] }, { verdicts: [graderBug(CLAUDE)] }, { verdicts: [graderBug(CLAUDE)] }],
  });
  const out = await runCalibration({ agents: AGENTS, maxRetries: 2, judgeAgent: AGY }, fakeDeps(state));
  assert.strictEqual(out.success, false);
  assert.strictEqual(out.attempts, 3);
  assert.strictEqual(state.rewrites.length, 2);
  assert.match(out.failureDetails ?? '', /^MAX_ATTEMPTS/);
});

test('renderCalibrationFindings renders an auditable table and nothing when there are no findings', () => {
  assert.strictEqual(renderCalibrationFindings(new Map([['daily-grind', []]])), '');
  const md = renderCalibrationFindings(new Map([['daily-grind', [
    { kind: 'GUIDE_CLARITY' as const, attempt: 1, agent: CODEX, test: 'a | b', guideQuote: 'Call `setPointerCapture()`\non pointerdown', reason: 'missed', action: 'codex_cli golden regenerated' },
  ]]]));
  assert.ok(md.startsWith('## Calibration findings'));
  assert.ok(md.includes('### Target: `daily-grind`'));
  assert.ok(md.includes('| 1 | `GUIDE_CLARITY` | codex_cli | a \\| b | "Call `setPointerCapture()` on pointerdown" | missed | codex_cli golden regenerated |'));
});

const ALT = 'Images have alt text';
const satisfied = (test = ALT): JudgeVerdict => ({
  agent: STARTING_APP,
  test,
  verdict: 'already_satisfied',
  expectation: 'The drag sequence remains active after the pointer leaves the handle',
  appEvidence: '<img src="hero.jpg" alt="Latte art">',
  reason: 'The base app already gives its only image alt text.',
});
const vacuous = (test = ALT): JudgeVerdict => ({
  agent: STARTING_APP,
  test,
  verdict: 'vacuous_test',
  expectation: 'The drag sequence remains active after the pointer leaves the handle',
  graderEvidence: 'const firstY = info!.grabY + dirY * 100;',
  reason: 'The assertion never runs when no panel exists.',
});

test('validateVerdicts: starting-app passes take only already_satisfied or vacuous_test, with verbatim base-app evidence', () => {
  const pairs = [pair(STARTING_APP, ALT)];
  assert.deepStrictEqual(validateVerdicts({ verdicts: [satisfied()] }, pairs, sources).errors, []);
  assert.match(validateVerdicts({ verdicts: [{ ...satisfied(), appEvidence: '<img alt="something else">' }] }, pairs, sources).errors[0], /"appEvidence" lines are not in the starting app's source/);
  assert.match(validateVerdicts({ verdicts: [{ ...satisfied(), appEvidence: undefined }] }, pairs, sources).errors[0], /"appEvidence" is required for already_satisfied/);
  assert.match(validateVerdicts({ verdicts: [{ ...graderBug(CLAUDE), agent: STARTING_APP, test: ALT }] }, pairs, sources).errors[0], /must be one of already_satisfied, vacuous_test/);
  assert.match(validateVerdicts({ verdicts: [{ ...satisfied(), agent: CLAUDE, test: DRAG }] }, [pair(CLAUDE)], sources).errors[0], /must be one of grader_bug, golden_missed_requirement, expectation_not_in_guide/);
});

test('planCalibrationStep: already_satisfied becomes an exempt regression check; vacuous_test rewrites the grader', () => {
  const ok = plan([satisfied()]);
  assert.deepStrictEqual(ok.exempt, [ALT]);
  assert.strictEqual(ok.graderContext, null);
  assert.strictEqual(ok.abort, null);
  assert.deepStrictEqual(ok.findings.map(f => f.kind), ['REGRESSION_CHECK']);

  const bad = plan([vacuous()]);
  assert.deepStrictEqual(bad.exempt, []);
  assert.ok(bad.graderContext?.includes('Tests that pass on the untouched starting app'));
  assert.ok(bad.graderContext?.includes('presence assertion'));
  assert.deepStrictEqual(bad.findings.map(f => f.kind), ['VACUOUS_TEST']);
});

test('runCalibration: converges immediately when a step only confirms already_satisfied exemptions, including after a maxRetries rewrite', async () => {
  const withStart = (passing: string[], failing: Partial<Record<SolutionAgent, string[]>> = {}) =>
    result(failing, { startingApp: { passed: passing.length, failed: 5 - passing.length, passingTests: passing } });

  // Case 1: attempt 1 has only a starting-app pass judged already_satisfied -> converges on attempt 1 without a second run.
  const oneStep = newState({ results: [withStart([ALT])], judgeOutputs: [{ verdicts: [satisfied()] }] });
  const out1 = await runCalibration({ agents: AGENTS, maxRetries: 2, judgeAgent: AGY }, fakeDeps(oneStep));
  assert.strictEqual(out1.success, true);
  assert.strictEqual(out1.attempts, 1);
  assert.deepStrictEqual(out1.exempt, [ALT]);

  // Case 2: attempt 1 exempts ALT alongside a golden regeneration; attempt 2 (=== maxRetries) rewrites the grader and clears
  // exemptions; attempt 3 (=== maxRetries + 1) re-judges ALT as already_satisfied and converges instead of hitting MAX_ATTEMPTS.
  const exemptSeen: string[][] = [];
  const state = newState({
    results: [withStart([ALT], { [CODEX]: [DRAG] }), withStart([ALT], { [CLAUDE]: [DRAG] }), withStart([ALT])],
    judgeOutputs: [{ verdicts: [satisfied(), missed(CODEX)] }, { verdicts: [graderBug(CLAUDE)] }, { verdicts: [satisfied()] }],
  });
  const deps = fakeDeps(state);
  const testGrader = deps.testGrader;
  deps.testGrader = async exempt => { exemptSeen.push([...exempt]); return testGrader(exempt); };
  const out = await runCalibration({ agents: AGENTS, maxRetries: 2, judgeAgent: AGY }, deps);
  assert.strictEqual(out.success, true);
  assert.strictEqual(out.attempts, 3);
  assert.deepStrictEqual(out.exempt, [ALT]);
  assert.deepStrictEqual(exemptSeen, [[], [ALT], []]);
  assert.deepStrictEqual(out.findings.map(f => f.kind), ['REGRESSION_CHECK', 'GUIDE_CLARITY', 'GRADER_BUG', 'REGRESSION_CHECK']);
});

test('collectFailurePairs and runCalibration gate only pipeline-generated or rewritten graders, not untouched existing graders', async () => {
  const graderWithFixedTimeouts = `
import { test, expect } from '../../../src/grading/test-fixture.ts';
test('menu opens', async ({ page }) => {
  await page.waitForTimeout(100);
  await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
  await expect(page.locator('#menu')).toBeVisible();
});
`;
  const cleanGrader = `
import { test, expect, expectNever } from '../../../src/grading/test-fixture.ts';
test('menu opens', async ({ page }) => {
  await expect(page.locator('#menu')).toBeVisible();
  await expectNever(page, () => false, { forMs: 300 });
});
`;

  const { pairs, executionFailures } = collectFailurePairs(PASS, AGENTS, [], graderWithFixedTimeouts);
  assert.deepStrictEqual(pairs, []);
  assert.strictEqual(executionFailures.length, 2);
  assert.match(executionFailures[0], /grader\.ts:\d+:\d+ \[no-fixed-timeout \/ no-fixed-timeout\]/);
  assert.match(executionFailures[1], /grader\.ts:\d+:\d+ \[no-fixed-timeout \/ no-fixed-timeout\]/);

  // 1. An untouched existing grader (graderGenerated not set) is not gated or rewritten when tests pass.
  const untouchedState = newState({
    grader: graderWithFixedTimeouts,
    results: [PASS],
  });
  const untouchedOut = await runCalibration({ agents: AGENTS, maxRetries: 2, judgeAgent: AGY }, fakeDeps(untouchedState));
  assert.strictEqual(untouchedOut.success, true);
  assert.strictEqual(untouchedOut.attempts, 1);
  assert.strictEqual(untouchedState.rewrites.length, 0);

  // 2. A grader generated by the pipeline in this run (graderGenerated: true) IS gated: even when Playwright
  // passes all goldens and fails the starting app (PASS), it triggers a rewrite and skips the calibration judge.
  const state = newState({
    grader: graderWithFixedTimeouts,
    results: [PASS, PASS],
    rewriteTo: [cleanGrader],
  });
  const out = await runCalibration({ agents: AGENTS, maxRetries: 2, judgeAgent: AGY, graderGenerated: true }, fakeDeps(state));
  assert.strictEqual(out.success, true);
  assert.strictEqual(out.attempts, 2);
  assert.strictEqual(state.judgeCalls, 0);
  assert.strictEqual(state.rewrites.length, 1);
  assert.match(state.rewrites[0], /no-fixed-timeout \/ no-fixed-timeout/);
  assert.match(state.rewrites[0], /expectNever\(page, predicate, \{ forMs \}\)/);

  // 3. An initially untouched grader that gets rewritten by the pipeline during calibration IS gated after the rewrite.
  const rewrittenFromExisting = newState({
    grader: cleanGrader,
    results: [result({ [CLAUDE]: [DRAG] }), PASS, PASS],
    judgeOutputs: [{ verdicts: [graderBug(CLAUDE)] }],
    rewriteTo: [graderWithFixedTimeouts, cleanGrader],
  });
  const rewrittenOut = await runCalibration({ agents: AGENTS, maxRetries: 3, judgeAgent: AGY }, fakeDeps(rewrittenFromExisting));
  assert.strictEqual(rewrittenOut.success, true);
  assert.strictEqual(rewrittenOut.attempts, 3);
  assert.strictEqual(rewrittenFromExisting.judgeCalls, 1);
  assert.strictEqual(rewrittenFromExisting.rewrites.length, 2);
  assert.match(rewrittenFromExisting.rewrites[1], /no-fixed-timeout \/ no-fixed-timeout/);

  // 4. If a generated/rewritten grader still keeps a fixed timeout past maxRetries, calibration fails with MAX_ATTEMPTS.
  const unfixedState = newState({
    grader: graderWithFixedTimeouts,
    results: [PASS, PASS],
    rewriteTo: [graderWithFixedTimeouts],
  });
  const failed = await runCalibration({ agents: AGENTS, maxRetries: 1, judgeAgent: AGY, graderGenerated: true }, fakeDeps(unfixedState));
  assert.strictEqual(failed.success, false);
  assert.strictEqual(failed.attempts, 2);
  assert.match(failed.failureDetails ?? '', /^MAX_ATTEMPTS/);
});

test('classifyPageLoad distinguishes clean/noPage, missing external build tool warnings, and broken page loads', () => {
  assert.deepStrictEqual(classifyPageLoad(undefined), { status: 'ok', reason: '' });
  assert.deepStrictEqual(classifyPageLoad({ ok: false, errors: ['[pageerror] boom'], noPage: true }), { status: 'ok', reason: '' });
  assert.deepStrictEqual(classifyPageLoad({ ok: true, errors: [] }), { status: 'ok', reason: '' });
  assert.deepStrictEqual(
    classifyPageLoad({
      ok: true,
      errors: [],
      buildWarning: 'sh: 1: em++: not found\nELIFECYCLE Command failed with exit code 127.',
    }),
    { status: 'ok', reason: '' },
    'a served page with zero runtime errors is clean even when scripts.build had a buildWarning'
  );

  // Runtime errors on a served page count as broken.
  assert.deepStrictEqual(
    classifyPageLoad({
      ok: false,
      errors: ['[pageerror] TypeError: Failed to resolve module specifier "input-switch-polyfill"'],
    }),
    {
      status: 'broken',
      reason: '[pageerror] TypeError: Failed to resolve module specifier "input-switch-polyfill"',
    }
  );
  assert.strictEqual(
    classifyPageLoad({
      ok: false,
      errors: ['[requestfailed] GET http://localhost:3000/app.js: net::ERR_ABORTED'],
    }).status,
    'broken'
  );

  // Server crash or JS build failure is broken, not an env warning.
  assert.strictEqual(
    classifyPageLoad({
      ok: false,
      errors: ["[server] Server failed to start:\nSyntaxError: The requested module '@sd-jwt/core' does not provide an export named 'decodeSdJwtSync'"],
    }).status,
    'broken'
  );
  assert.strictEqual(
    classifyPageLoad({
      ok: false,
      errors: ['[server] Failed to build target app'],
      buildWarning: 'ERR_PNPM_NO_MATCHING_VERSION No matching version found for vite@^8.3.5\nsh: 1: vite: not found',
    }).status,
    'broken'
  );
  assert.strictEqual(
    classifyPageLoad({
      ok: false,
      errors: ['[server] Failed to build target app'],
      buildWarning: 'sh: 1: vite: not found\nCommand failed with exit code 127.',
    }).status,
    'broken'
  );

  // Missing external toolchain binary (e.g. em++ exit 127) where only the server failed to start is an env warning.
  const emccWarn = classifyPageLoad({
    ok: false,
    errors: ['[server] Failed to build target app:\nsh: 1: em++: not found\nServer failed to start'],
    buildWarning: 'Failed to build target app:\nsh: 1: em++: not found\nELIFECYCLE Command failed with exit code 127.',
  });
  assert.deepStrictEqual(emccWarn, {
    status: 'env_warning',
    reason: 'missing external build tool "em++" in scripts.build',
  });

  // If the page was served despite buildWarning and threw a runtime pageerror, it is still broken.
  assert.strictEqual(
    classifyPageLoad({
      ok: false,
      errors: ['[pageerror] ReferenceError: Module is not defined'],
      buildWarning: 'sh: 1: em++: not found\nELIFECYCLE Command failed with exit code 127.',
    }).status,
    'broken'
  );
});

test('runCalibration: a golden that passes 100% of grader tests with a broken pageLoad regenerates once without calling the judge, then fails if still broken', async () => {
  const brokenPass = (): CalibrationResult => ({
    success: true,
    solutions: {
      [AGY]: { passed: 5, failed: 0, failingTests: [], pageLoad: { ok: true, errors: [] } },
      [CLAUDE]: { passed: 5, failed: 0, failingTests: [], pageLoad: { ok: true, errors: [] } },
      [CODEX]: {
        passed: 5,
        failed: 0,
        failingTests: [],
        pageLoad: { ok: false, errors: ['[pageerror] TypeError: Failed to execute parseFromString on DOMParser'] },
      },
    },
    startingApp: { passed: 0, failed: 5, passingTests: [], pageLoad: { ok: true, errors: [] } },
  });

  // 1. Regenerates once and succeeds when the regenerated golden loads cleanly.
  const recoverState = newState({ results: [brokenPass(), PASS] });
  const recoverOut = await runCalibration({ agents: AGENTS, maxRetries: 2, judgeAgent: AGY }, fakeDeps(recoverState));
  assert.strictEqual(recoverOut.success, true);
  assert.strictEqual(recoverOut.attempts, 2);
  assert.strictEqual(recoverState.judgeCalls, 0, 'broken pageLoad is deterministic and skips the LLM judge');
  assert.deepStrictEqual(recoverState.regenerated, [CODEX]);
  assert.strictEqual(recoverState.rewrites.length, 0);
  assert.deepStrictEqual(
    recoverOut.findings.map(f => [f.kind, f.agent, f.action]),
    [['PAGE_LOAD_FAILURE', CODEX, `${CODEX} golden regenerated`]]
  );

  // 2. If the regenerated golden still fails to load cleanly, calibration aborts with PAGE_LOAD_FAILURE.
  const stillBrokenState = newState({ results: [brokenPass(), brokenPass()] });
  const stillBrokenOut = await runCalibration({ agents: AGENTS, maxRetries: 2, judgeAgent: AGY }, fakeDeps(stillBrokenState));
  assert.strictEqual(stillBrokenOut.success, false);
  assert.strictEqual(stillBrokenOut.attempts, 2);
  assert.strictEqual(stillBrokenState.judgeCalls, 0);
  assert.deepStrictEqual(stillBrokenState.regenerated, [CODEX]);
  assert.match(stillBrokenOut.failureDetails ?? '', /^PAGE_LOAD_FAILURE: the regenerated codex_cli golden still fails to load cleanly:/);
  assert.deepStrictEqual(
    stillBrokenOut.findings.map(f => [f.kind, f.action]),
    [
      ['PAGE_LOAD_FAILURE', `${CODEX} golden regenerated`],
      ['PAGE_LOAD_FAILURE', 'calibration stopped; the regenerated golden still fails to load cleanly'],
    ]
  );
});

test('runCalibration: environment build warnings and starting-app pageLoad errors are reported as warnings without failing calibration', async () => {
  const warnPass: CalibrationResult = {
    success: true,
    solutions: {
      [AGY]: { passed: 5, failed: 0, failingTests: [], pageLoad: { ok: true, errors: [] } },
      [CLAUDE]: { passed: 5, failed: 0, failingTests: [], pageLoad: { ok: true, errors: [] } },
      [CODEX]: {
        passed: 5,
        failed: 0,
        failingTests: [],
        pageLoad: {
          ok: false,
          errors: ['[server] Failed to build target app\nServer failed to start'],
          buildWarning: 'sh: 1: em++: not found\nELIFECYCLE Command failed with exit code 127.',
        },
      },
    },
    startingApp: {
      passed: 0,
      failed: 5,
      passingTests: [],
      pageLoad: { ok: false, errors: ['[pageerror] TypeError: Cannot read properties of undefined'] },
    },
  };

  const state = newState({ results: [warnPass] });
  const out = await runCalibration({ agents: AGENTS, maxRetries: 2, judgeAgent: AGY }, fakeDeps(state));
  assert.strictEqual(out.success, true);
  assert.strictEqual(out.attempts, 1);
  assert.deepStrictEqual(state.regenerated, []);
  assert.deepStrictEqual(
    out.findings.map(f => [f.kind, f.agent, f.action]),
    [
      ['PAGE_LOAD_WARNING', CODEX, 'warning only (missing external build tool)'],
      ['PAGE_LOAD_WARNING', STARTING_APP, 'warning only (untouched starting app did not load cleanly)'],
    ]
  );
});
