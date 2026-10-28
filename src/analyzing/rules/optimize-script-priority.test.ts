import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { withVirtualSourceFile } from '../scanners/js-scanner.ts';
import { optimizeScriptPriorityMatcher } from './optimize-script-priority.ts';

void test('optimize-script-priority DOM matcher', async (t) => {
  await t.test('flags external <script importance="high|low"> without fetchpriority', () => {
    const html = `
      <head>
        <script src="/js/app.js" async importance="high"></script>
        <script src="/js/tracker.js" defer importance="low"></script>
      </head>
    `;
    const matches = scanHtml('index.html', html, [optimizeScriptPriorityMatcher]);
    assert.equal(matches.length, 2);
    assert.equal(matches[0]?.line, 3);
    assert.equal(matches[1]?.line, 4);
  });

  await t.test('flags JSX <script src="/app.js" importance="low" />', () => {
    const code = `
      export function AnalyticsScript() {
        return <script src="/analytics.js" async importance="low" />;
      }
    `;
    const matches = withVirtualSourceFile('AnalyticsScript.tsx', code, (sourceFile) =>
      scanJsx('AnalyticsScript.tsx', sourceFile, [optimizeScriptPriorityMatcher]),
    );
    assert.equal(matches.length, 1);
  });

  await t.test('exempts <script> with matching fetchpriority or inline <script> without src', () => {
    const html = `
      <head>
        <script src="/js/app.js" async fetchpriority="high"></script>
        <script src="/js/compat.js" type="module" importance="high" fetchpriority="high"></script>
        <script importance="low">console.log("inline");</script>
      </head>
    `;
    const matches = scanHtml('modern.html', html, [optimizeScriptPriorityMatcher]);
    assert.equal(matches.length, 0);
  });
});
