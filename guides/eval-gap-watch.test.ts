import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';

import {
  hasEvals,
  findMissingEvals,
  findChangedExpectations,
  buildMarker,
  parseMarker,
  buildIssue,
  planIssues,
  type Gap,
  type ExistingIssue,
} from './eval-gap-watch.ts';
import { rootDir } from '../lib/paths.ts';
import type { GuideInventory } from '../lib/guide-validation.ts';

const GUIDE_DIR = path.join(rootDir, 'guides', 'css', 'sample-guide');

function makeGuide(overrides: Partial<GuideInventory> = {}): GuideInventory {
  return {
    dir: GUIDE_DIR,
    name: 'sample-guide',
    hasGuide: true,
    hasExpectations: true,
    expectationsEmpty: false,
    hasGrader: true,
    hasTask: true,
    draft: false,
    ...overrides,
  } as GuideInventory;
}

function makeGap(overrides: Partial<Gap> = {}): Gap {
  return { kind: 'missing-evals', guidePath: 'guides/css/sample-guide', guideName: 'sample-guide', ...overrides };
}

function issueFor(gap: Gap, overrides: Partial<ExistingIssue> = {}): ExistingIssue {
  const { title, body } = buildIssue(gap);
  return { number: 7, body, state: 'OPEN', title, ...overrides };
}

describe('hasEvals', () => {
  it('requires both a grader and a task', () => {
    assert.strictEqual(hasEvals(makeGuide()), true);
    assert.strictEqual(hasEvals(makeGuide({ hasGrader: false })), false);
    assert.strictEqual(hasEvals(makeGuide({ hasTask: false })), false);
  });
});

describe('findMissingEvals', () => {
  it('flags a guide with guidance and expectations but no evals', () => {
    const gaps = findMissingEvals([makeGuide({ hasGrader: false, hasTask: false })]);
    assert.deepStrictEqual(gaps, [makeGap()]);
  });

  it('ignores a guide that already has evals', () => {
    assert.deepStrictEqual(findMissingEvals([makeGuide()]), []);
  });

  it('ignores drafts', () => {
    assert.deepStrictEqual(findMissingEvals([makeGuide({ draft: true, hasGrader: false, hasTask: false })]), []);
    assert.deepStrictEqual(findMissingEvals([makeGuide({ draft: 'blocked', hasGrader: false, hasTask: false })]), []);
  });

  it('ignores guides with no guidance or no expectations', () => {
    assert.deepStrictEqual(findMissingEvals([makeGuide({ hasGuide: false, hasGrader: false, hasTask: false })]), []);
    assert.deepStrictEqual(findMissingEvals([makeGuide({ hasExpectations: false, hasGrader: false, hasTask: false })]), []);
    assert.deepStrictEqual(findMissingEvals([makeGuide({ expectationsEmpty: true, hasGrader: false, hasTask: false })]), []);
  });

  it('includes discipline guides', () => {
    const gaps = findMissingEvals([makeGuide({ isDisciplineGuide: true, hasGrader: false, hasTask: false })]);
    assert.strictEqual(gaps.length, 1);
  });

  it('flags a guide that has a grader but no task', () => {
    assert.strictEqual(findMissingEvals([makeGuide({ hasTask: false })]).length, 1);
  });
});

describe('findChangedExpectations', () => {
  const expectationsPath = 'guides/css/sample-guide/expectations.md';

  it('flags a guide with evals whose expectations changed', () => {
    const gaps = findChangedExpectations([makeGuide()], [expectationsPath]);
    assert.deepStrictEqual(gaps, [makeGap({ kind: 'expectations-changed' })]);
  });

  it('ignores a guide without evals', () => {
    assert.deepStrictEqual(findChangedExpectations([makeGuide({ hasGrader: false, hasTask: false })], [expectationsPath]), []);
  });

  it('ignores a guide whose expectations did not change', () => {
    assert.deepStrictEqual(findChangedExpectations([makeGuide()], ['guides/css/sample-guide/guide.md']), []);
  });

  it('does not match another guide with a similar path', () => {
    assert.deepStrictEqual(findChangedExpectations([makeGuide()], ['guides/css/sample-guide-two/expectations.md']), []);
  });

  it('returns nothing when there is no diff', () => {
    assert.deepStrictEqual(findChangedExpectations([makeGuide()], []), []);
  });
});

describe('markers', () => {
  it('round-trips both kinds', () => {
    for (const kind of ['missing-evals', 'expectations-changed'] as const) {
      assert.deepStrictEqual(parseMarker(buildMarker(kind, 'guides/a/b')), { kind, guidePath: 'guides/a/b' });
    }
  });

  it('returns null without a marker', () => {
    assert.strictEqual(parseMarker('a normal issue body'), null);
  });

  it('is embedded in the issue body', () => {
    const gap = makeGap();
    assert.deepStrictEqual(parseMarker(buildIssue(gap).body), { kind: gap.kind, guidePath: gap.guidePath });
  });

  it('gives the two kinds different titles', () => {
    assert.notStrictEqual(
      buildIssue(makeGap({ kind: 'missing-evals' })).title,
      buildIssue(makeGap({ kind: 'expectations-changed' })).title
    );
  });
});

describe('planIssues', () => {
  const gap = makeGap();

  it('files an issue for a new gap', () => {
    const plan = planIssues([gap], []);
    assert.deepStrictEqual(plan.toCreate, [gap]);
    assert.deepStrictEqual(plan.toClose, []);
  });

  it('does not duplicate an already open issue', () => {
    const plan = planIssues([gap], [issueFor(gap)]);
    assert.deepStrictEqual(plan.toCreate, []);
    assert.deepStrictEqual(plan.toClose, []);
  });

  it('refiles when the previous issue was closed', () => {
    const plan = planIssues([gap], [issueFor(gap, { state: 'CLOSED' })]);
    assert.deepStrictEqual(plan.toCreate, [gap]);
  });

  it('closes a missing-evals issue once evals land', () => {
    const plan = planIssues([], [issueFor(gap)]);
    assert.strictEqual(plan.toClose.length, 1);
    assert.strictEqual(plan.toClose[0].number, 7);
  });

  it('leaves expectations-changed issues for a human to close', () => {
    const changed = makeGap({ kind: 'expectations-changed' });
    assert.deepStrictEqual(planIssues([], [issueFor(changed)]).toClose, []);
  });

  it('ignores issues without a marker', () => {
    const plan = planIssues([], [{ number: 99, body: 'unrelated', state: 'OPEN', title: 'Other' }]);
    assert.deepStrictEqual(plan.toClose, []);
  });

  it('keeps the two kinds independent for one guide', () => {
    const changed = makeGap({ kind: 'expectations-changed' });
    const plan = planIssues([changed], [issueFor(gap, { number: 1 })]);
    assert.deepStrictEqual(plan.toCreate, [changed]);
    assert.strictEqual(plan.toClose[0].number, 1);
  });
});
