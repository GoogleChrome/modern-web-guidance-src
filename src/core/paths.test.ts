import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  rootDir,
  guidesDir,
  featuresDir,
  baseAppsDir,
  outDir,
  resultsDir,
  suitesDir,
  dashboardDir,
  getGuideResultsDir,
  resolveGuideResultsDir,
} from './paths.ts';

describe('paths.ts exports', () => {
  test('exports correct absolute paths relative to rootDir', () => {
    assert.equal(guidesDir, path.join(rootDir, 'guides'));
    assert.equal(featuresDir, path.join(rootDir, 'features'));
    assert.equal(baseAppsDir, path.join(rootDir, 'src/harness/base-apps'));
    assert.equal(outDir, path.join(rootDir, 'out'));
    assert.equal(resultsDir, path.join(rootDir, 'results'));
    assert.equal(suitesDir, path.join(rootDir, 'results/suites'));
    assert.equal(dashboardDir, path.join(rootDir, 'src/dashboard'));
  });

  test('getGuideResultsDir constructs path correctly with name', () => {
    assert.equal(
      getGuideResultsDir({ category: 'css', name: 'scrollspy' }),
      path.join(resultsDir, 'guides', 'css', 'scrollspy')
    );
    assert.throws(
      () => getGuideResultsDir({ category: 'forms' } as any),
      /missing name/
    );
  });

  test('resolveGuideResultsDir resolves from guideInfo or targetDir', () => {
    assert.equal(
      resolveGuideResultsDir('/tmp/some-dir', { category: 'css', name: 'scrollspy' }),
      path.join(resultsDir, 'guides', 'css', 'scrollspy')
    );
    assert.equal(
      resolveGuideResultsDir(path.join(guidesDir, 'forms', 'input-address')),
      path.join(resultsDir, 'guides', 'forms', 'input-address')
    );
  });
});
