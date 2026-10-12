import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';

import {
  findChangedExpectations,
  buildIssue,
  planIssues,
  type ChangedExpectations,
  type ExistingIssue,
} from './expectations-watch.ts';
import { rootDir } from '../core/paths.ts';
import type { GuideInventory } from '../core/guide-validation.ts';

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

function makeGap(overrides: Partial<ChangedExpectations> = {}): ChangedExpectations {
  return { guidePath: 'guides/css/sample-guide', guideName: 'sample-guide', ...overrides };
}

function issueFor(gap: ChangedExpectations, overrides: Partial<ExistingIssue> = {}): ExistingIssue {
  const { title } = buildIssue(gap);
  return { number: 7, title, ...overrides };
}

describe('findChangedExpectations', () => {
  const dir = 'guides/css/sample-guide';
  const expectationsPath = `${dir}/expectations.md`;

  it('flags a guide with evals whose expectations changed', () => {
    const gaps = findChangedExpectations([makeGuide()], [expectationsPath]);
    assert.deepStrictEqual(gaps, [makeGap()]);
  });

  it('ignores a guide without evals', () => {
    assert.deepStrictEqual(findChangedExpectations([makeGuide({ hasGrader: false, hasTask: false })], [expectationsPath]), []);
    assert.deepStrictEqual(findChangedExpectations([makeGuide({ hasGrader: true, hasTask: false })], [expectationsPath]), []);
    assert.deepStrictEqual(findChangedExpectations([makeGuide({ hasGrader: false, hasTask: true })], [expectationsPath]), []);
  });

  it('ignores drafts', () => {
    assert.deepStrictEqual(findChangedExpectations([makeGuide({ draft: true })], [expectationsPath]), []);
    assert.deepStrictEqual(findChangedExpectations([makeGuide({ draft: 'blocked' })], [expectationsPath]), []);
  });

  it('ignores a guide whose expectations did not change', () => {
    assert.deepStrictEqual(findChangedExpectations([makeGuide()], [`${dir}/guide.md`]), []);
  });

  it('does not match another guide with a similar path', () => {
    assert.deepStrictEqual(findChangedExpectations([makeGuide()], ['guides/css/sample-guide-two/expectations.md']), []);
  });

  it('returns nothing when there is no diff', () => {
    assert.deepStrictEqual(findChangedExpectations([makeGuide()], []), []);
  });

  it('ignores changes that also update the evals', () => {
    for (const evalFile of ['grader.ts', 'tasks/task.md', 'targets/daily-grind/grader.ts']) {
      assert.deepStrictEqual(findChangedExpectations([makeGuide()], [expectationsPath, `${dir}/${evalFile}`]), [], evalFile);
    }
  });

  it('does not count evals changed in another guide', () => {
    const gaps = findChangedExpectations([makeGuide()], [expectationsPath, 'guides/css/sample-guide-two/grader.ts']);
    assert.strictEqual(gaps.length, 1);
  });
});

describe('planIssues', () => {
  const gap = makeGap();

  it('files an issue for a new gap', () => {
    assert.deepStrictEqual(planIssues([gap], []), [gap]);
  });

  it('does not duplicate an already open issue', () => {
    assert.deepStrictEqual(planIssues([gap], [issueFor(gap)]), []);
  });

  it('ignores issues for other guides', () => {
    assert.deepStrictEqual(planIssues([gap], [{ number: 99, title: 'Expectations changed for the other-guide guide' }]), [gap]);
  });
});
