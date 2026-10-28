import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { scanHtml } from '../scanners/dom-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  spinnerDomMatcher,
  spinnerJsMatcher,
  spinnerPackageMatcher,
} from './spinner.ts';

void test('spinner: positive brownfield matches', async (t) => {
  await t.test('flags spin.js and react-spinners in package.json', () => {
    const pkgJson = JSON.stringify({
      dependencies: {
        'spin.js': '^4.1.0',
        'react-spinners': '^0.13.8',
      },
    });
    const matches = scanPackageJson('package.json', pkgJson, [
      spinnerPackageMatcher,
    ]);
    assert.equal(matches.length, 2);
  });

  await t.test('flags new Spinner() from spin.js', () => {
    const code = `
      import { Spinner } from 'spin.js';
      const spinner = new Spinner({ lines: 12 }).spin(target);
    `;
    const matches = matchJsRule(spinnerJsMatcher, 'loader.ts', code);
    assert.equal(matches.length, 1);
  });

  await t.test('flags non-semantic <div class="spinner-border"> in DOM', () => {
    const html = `
      <div class="spinner-border" role="status">
        <span class="sr-only">Loading...</span>
      </div>
    `;
    const matches = scanHtml('loading.html', html, [spinnerDomMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /<progress/);
  });

  await t.test('flags indeterminate <div class="spinner" role="progressbar"> without aria-valuenow', () => {
    const html = `<div class="spinner" role="progressbar" aria-label="Loading"></div>`;
    const matches = scanHtml('busy.html', html, [spinnerDomMatcher]);
    assert.equal(matches.length, 1);
  });
});

void test('spinner: negative / exempt cases', async (t) => {
  await t.test('exempts native indeterminate <progress class="loading-spinner">', () => {
    const html = `<progress aria-label="Loading" class="loading-spinner"></progress>`;
    const matches = scanHtml('modern.html', html, [spinnerDomMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts determinate progress bar with aria-valuenow (owned by progress)', () => {
    const html = `<div class="progress-bar" role="progressbar" aria-valuenow="40"></div>`;
    const matches = scanHtml('progress.html', html, [spinnerDomMatcher]);
    assert.equal(matches.length, 0);
  });
});
