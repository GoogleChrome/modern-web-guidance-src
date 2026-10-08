import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  rootDir,
  guidesDir,
  featuresDir,
  harnessDir,
  baseAppsDir,
  outDir,
  resultsDir,
  suitesDir,
  dashboardDir,
  evalViewDir,
  getGuideResultsDir,
} from './paths.ts';

describe('paths.ts exports', () => {
  test('exports correct absolute paths relative to rootDir', () => {
    assert.equal(guidesDir, path.join(rootDir, 'guides'));
    assert.equal(featuresDir, path.join(rootDir, 'features'));
    assert.equal(harnessDir, path.join(rootDir, 'harness'));
    assert.equal(baseAppsDir, path.join(rootDir, 'harness/base_apps'));
    assert.equal(outDir, path.join(rootDir, 'out'));
    assert.equal(resultsDir, path.join(rootDir, 'results'));
    assert.equal(suitesDir, path.join(rootDir, 'results/suites'));
    assert.equal(dashboardDir, path.join(rootDir, 'eval-view'));
    assert.equal(evalViewDir, dashboardDir);
  });

  test('getGuideResultsDir constructs path correctly with slug or name', () => {
    assert.equal(
      getGuideResultsDir({ category: 'css', slug: 'scrollspy' }),
      path.join(resultsDir, 'guides', 'css', 'scrollspy')
    );
    assert.equal(
      getGuideResultsDir({ category: 'forms', name: 'input-address' }),
      path.join(resultsDir, 'guides', 'forms', 'input-address')
    );
    assert.throws(
      () => getGuideResultsDir({ category: 'forms' } as any),
      /missing slug\/name/
    );
  });
});
