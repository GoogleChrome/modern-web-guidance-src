import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml } from '../scanners/dom-scanner.ts';
import { progressDomMatcher } from './progress.ts';

void test('progress: positive brownfield matches', async (t) => {
  await t.test('flags determinate <div role="progressbar" aria-valuenow="60">', () => {
    const html = `
      <div class="progress">
        <div class="progress-bar" role="progressbar" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100" style="width: 60%;">
          60%
        </div>
      </div>
    `;
    const matches = scanHtml('upload.html', html, [progressDomMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /<progress/);
  });
});

void test('progress: negative / exempt cases', async (t) => {
  await t.test('exempts native <progress> element', () => {
    const html = `<progress value="60" max="100" role="progressbar" aria-valuenow="60"></progress>`;
    const matches = scanHtml('native.html', html, [progressDomMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts indeterminate role="progressbar" without aria-valuenow (owned by spinner)', () => {
    const html = `<div class="loading-spinner" role="progressbar" aria-label="Loading"></div>`;
    const matches = scanHtml('spinner.html', html, [progressDomMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts circular SVG progress rings (owned by progress-ring)', () => {
    const html = `
      <div class="progress-ring" role="progressbar" aria-valuenow="75">
        <svg><circle stroke-dasharray="100" stroke-dashoffset="25" /></svg>
      </div>
    `;
    const matches = scanHtml('ring.html', html, [progressDomMatcher]);
    assert.equal(matches.length, 0);
  });
});
