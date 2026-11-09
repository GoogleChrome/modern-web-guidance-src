import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { calculateMetrics } from '../lib/metrics.ts';
import type { EvalsReport } from '../lib/metrics.ts';
import {
  guideOfResultKey,
  NotPublishableError,
  OverrideError,
  PUBLIC_ASSERTION_FIELDS,
  PUBLIC_RUN_FIELDS,
  PUBLIC_SUITE_FIELDS,
  rebuildEvals,
  withoutGuides,
} from './rebuild-evals.ts';
import type { ResultsByKey } from './rebuild-evals.ts';
import { findLeaks, LeakError } from './scrub.ts';
import { CLOUDTOP_HOST, FAKE_LDAP, REPO_CHECKOUT } from './fixtures/leak-samples.ts';

const FIXTURE_PATH = path.join(import.meta.dirname, 'fixtures', 'nightly-sample.evals.json');
const RELEASED = ['example-model'];

function loadFixture(): EvalsReport {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as EvalsReport;
}

function build(raw: EvalsReport = loadFixture(), extra: Partial<Parameters<typeof rebuildEvals>[1]> = {}) {
  return rebuildEvals(raw, { releasedModels: RELEASED, ...extra });
}

function allChecks(evals: ReturnType<typeof rebuildEvals>) {
  return Object.values(evals.results).flat().flatMap(run => run.results);
}

/** Fields present in the raw fixture that must never appear in public output. */
const PRIVATE_SUITE_FIELDS = ['serving', 'skillVersion', 'cliVersion', 'runCount'];
const PRIVATE_RUN_FIELDS = ['targetFile', 'files'];
const PRIVATE_RUNTIME_FIELDS = ['agentStatus', 'graderStatus'];

describe('rebuildEvals: gating', () => {
  test('rejects a non-public agent', () => {
    const raw = { ...loadFixture(), agent: 'jetski_cli' };
    assert.throws(() => build(raw), NotPublishableError);
  });

  test('rejects a model that is not on the released list', () => {
    assert.throws(() => build(loadFixture(), { releasedModels: ['some-other-model'] }), NotPublishableError);
  });

  test('throws on an excludeGuides typo instead of publishing everything', () => {
    assert.throws(
      () => build(loadFixture(), { excludeGuides: ['securty'] }),
      (err: unknown) => err instanceof OverrideError && /not present in this suite/.test(err.message),
    );
  });
});

describe('rebuildEvals: field allowlists', () => {
  test('keeps only allowlisted suite-level fields', () => {
    const raw = loadFixture();
    const out = build(raw);

    const allowed = new Set<string>([...PUBLIC_SUITE_FIELDS, 'summary', 'stats', 'results']);
    for (const key of Object.keys(out)) {
      assert.ok(allowed.has(key), `unexpected suite field: ${key}`);
    }
    for (const field of PRIVATE_SUITE_FIELDS) {
      assert.ok(field in raw, `fixture should contain ${field} so this test is meaningful`);
      assert.ok(!(field in out), `${field} leaked into public evals`);
    }
  });

  test('keeps only allowlisted run, runtime, tokenUsage and assertion fields', () => {
    const raw = loadFixture();
    const out = build(raw);
    const runAllowed = new Set<string>([...PUBLIC_RUN_FIELDS, 'results', 'runtime', 'tokenUsage']);
    const checkAllowed = new Set<string>(PUBLIC_ASSERTION_FIELDS);

    const rawRuns = Object.values(raw.results).flat();
    for (const field of PRIVATE_RUN_FIELDS) {
      assert.ok(rawRuns.some(r => field in r), `fixture runs should contain ${field} so this test is meaningful`);
    }
    const rawRuntime = rawRuns.find(r => r.runtime)?.runtime as Record<string, unknown>;
    for (const field of PRIVATE_RUNTIME_FIELDS) {
      assert.ok(field in rawRuntime, `fixture runtime should contain ${field} so this test is meaningful`);
    }

    let runs = 0;
    let checks = 0;
    for (const runList of Object.values(out.results)) {
      for (const run of runList) {
        runs++;
        for (const key of Object.keys(run)) {
          assert.ok(runAllowed.has(key), `unexpected run field: ${key}`);
        }
        for (const field of PRIVATE_RUN_FIELDS) {
          assert.ok(!(field in run), `${field} leaked into public run`);
        }
        // Per-guide views group charts by discipline; without it everything shows as "Uncategorized".
        assert.ok(typeof run.discipline === 'string' && run.discipline.length > 0, 'discipline must be published');
        if (run.runtime) {
          assert.deepEqual(Object.keys(run.runtime).sort(), ['agentRuntime', 'graderRuntime'].filter(k => k in run.runtime!));
          for (const field of PRIVATE_RUNTIME_FIELDS) {
            assert.ok(!(field in run.runtime), `${field} leaked into public runtime`);
          }
        }
        if (run.tokenUsage) {
          assert.deepEqual(Object.keys(run.tokenUsage).sort(), ['cached', 'total']);
        }
        for (const check of run.results) {
          checks++;
          for (const key of Object.keys(check)) {
            assert.ok(checkAllowed.has(key), `unexpected assertion field: ${key}`);
          }
        }
      }
    }
    assert.ok(runs > 0 && checks > 0, 'fixture should contain runs and checks');
  });

  test('drops null values rather than publishing them', () => {
    const raw = loadFixture();
    const firstKey = Object.keys(raw.results)[0];
    raw.results[firstKey][0].tokenUsage = null as unknown as undefined;
    const out = build(raw);
    assert.ok(!('tokenUsage' in out.results[firstKey][0]));
  });

  test('carries failure details through for failed checks', () => {
    const failed = allChecks(build()).filter(c => !c.passed);
    assert.ok(failed.some(c => c.error), 'expected a failed check with an error message');
    assert.ok(failed.some(c => c.pageSnapshot), 'expected a failed check with a page snapshot');
    assert.ok(failed.some(c => c.errorLocation?.startsWith('guides/')), 'errorLocation should be repo-relative');
  });
});

describe('rebuildEvals: metrics', () => {
  test('recomputes summary and stats from the published runs', () => {
    const raw = loadFixture();
    const expected = calculateMetrics(raw.results, raw.summary.runsPerTest);
    // Poison the raw aggregates: if any of them were copied through, the output would carry these.
    raw.summary.guidedPassed = 987654;
    raw.summary.unguidedTotal = -1;
    for (const stat of Object.values(raw.stats)) {
      stat.medianPassRate = 4242;
      stat.passedChecks = -7;
    }
    const out = build(raw);
    assert.deepEqual(out.summary, expected.summary);
    assert.deepEqual(out.stats, expected.testStats);
    assert.notEqual(out.summary.guidedPassed, 987654);
    assert.ok(Object.values(out.stats).every(stat => stat.medianPassRate !== 4242 && stat.passedChecks !== -7));
  });

  test('excludeGuides drops the guide and recomputes totals without it', () => {
    const raw = loadFixture();
    const out = build(raw, { excludeGuides: ['security'] });

    const keys = Object.keys(out.results);
    assert.ok(keys.length > 0);
    assert.ok(keys.every(k => !k.includes(' - security - ')), 'security scenarios should be gone');
    assert.ok(Object.keys(out.stats).every(k => !k.includes(' - security - ')), 'security stats should be gone');

    const droppedChecks = Object.entries(raw.results)
      .filter(([k]) => k.includes(' - security - '))
      .flatMap(([, runs]) => runs)
      .flatMap(r => r.results).length;
    const baseline = calculateMetrics(raw.results, raw.summary.runsPerTest).summary;
    assert.ok(droppedChecks > 0);
    assert.equal(
      out.summary.guidedTotal + out.summary.unguidedTotal,
      baseline.guidedTotal + baseline.unguidedTotal - droppedChecks,
    );
  });

  test('does not mutate the input', () => {
    const raw = loadFixture();
    const snapshot = JSON.stringify(raw);
    build(raw, { excludeGuides: ['security'] });
    assert.equal(JSON.stringify(raw), snapshot);
  });
});

describe('rebuildEvals: scrubbing', () => {
  test('output contains no leaks', () => {
    assert.deepEqual(findLeaks(build()), []);
  });

  test('rewrites injected repo paths to repo-relative', () => {
    const raw = loadFixture();
    const firstKey = Object.keys(raw.results)[0];
    raw.results[firstKey][0].results[0].error = `at ${REPO_CHECKOUT}/guides/x/grader.ts:10`;
    const out = build(raw);
    assert.equal(out.results[firstKey][0].results[0].error, 'at guides/x/grader.ts:10');
  });

  test('throws instead of returning output that still identifies a machine', () => {
    const raw = loadFixture();
    const firstKey = Object.keys(raw.results)[0];
    raw.results[firstKey][0].results[0].browserErrors = `failed to reach ${CLOUDTOP_HOST}`;
    assert.throws(() => build(raw), (err: unknown) => err instanceof LeakError && err.leaks[0].name === 'googlers hostname');
  });

  test('throws when a forbidden token appears anywhere', () => {
    const raw = loadFixture();
    const firstKey = Object.keys(raw.results)[0];
    raw.results[firstKey][0].prompt = `Ask ${FAKE_LDAP} for the design doc.`;
    assert.throws(() => build(raw, { forbiddenTokens: [FAKE_LDAP] }), LeakError);
    build(raw);
  });
});

// --- Guide-level overrides ---

const run = { runNumber: 1, results: [{ passed: true, message: 'ok' }] };

const results: ResultsByKey = {
  'task - passkeys - guided': [run],
  'task - passkeys - unguided': [run],
  'daily-grind - security - guided': [run],
  'daily-grind - security - unguided': [run],
  'daily-grind - long-task - guided': [run],
};

describe('guideOfResultKey', () => {
  test('prefers the guideName recorded on the run over parsing the key', () => {
    assert.equal(guideOfResultKey('task - passkeys - guided', [{ ...run, guideName: 'passkeys' }]), 'passkeys');
    assert.equal(guideOfResultKey('weird key', [{ ...run, guideName: 'security' }]), 'security');
  });

  test('falls back to the middle part of the key, even when the guide name ends in -task', () => {
    assert.equal(guideOfResultKey('task - passkeys - guided'), 'passkeys');
    assert.equal(guideOfResultKey('daily-grind - security - unguided', [run]), 'security');
    assert.equal(guideOfResultKey('daily-grind - long-task - guided'), 'long-task');
  });

  test('throws on malformed keys when no run records a guideName', () => {
    assert.throws(() => guideOfResultKey('nonsense'), OverrideError);
    assert.throws(() => guideOfResultKey('a - b', [run]), OverrideError);
  });
});

describe('withoutGuides', () => {
  test('removes both guided and unguided scenarios for the guide', () => {
    const kept = withoutGuides(results, ['security']);
    assert.deepEqual(Object.keys(kept).sort(), [
      'daily-grind - long-task - guided',
      'task - passkeys - guided',
      'task - passkeys - unguided',
    ]);
  });

  test('excludes a guide whose name ends in -task', () => {
    assert.ok(!('daily-grind - long-task - guided' in withoutGuides(results, ['long-task'])));
  });

  test('returns a copy when nothing is excluded', () => {
    const kept = withoutGuides(results, []);
    assert.deepEqual(kept, results);
    assert.notEqual(kept, results);
  });

  test('throws when an excluded guide is not in the suite', () => {
    assert.throws(
      () => withoutGuides(results, ['securty']),
      (err: unknown) => err instanceof OverrideError && /not present in this suite: securty/.test(err.message),
    );
  });

  test('throws on a malformed key rather than keeping it', () => {
    assert.throws(() => withoutGuides({ ...results, 'bad key': [run] }, []), OverrideError);
  });
});
