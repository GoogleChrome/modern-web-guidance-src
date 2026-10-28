import assert from 'node:assert/strict';
import test from 'node:test';
import { withVirtualSourceFile } from '../scanners/js-scanner.ts';
import { identifyHeavyScriptsMatcher } from './identify-heavy-scripts.ts';

function runMatcher(code: string, filePath = 'perf.ts') {
  return withVirtualSourceFile(filePath, code, (sourceFile) =>
    identifyHeavyScriptsMatcher.matchFile(sourceFile, {
      filePath,
      fileContent: code,
    }),
  );
}

void test('identify-heavy-scripts JS matcher', async (t) => {
  await t.test("flags PerformanceObserver observing 'longtask' via type or entryTypes", () => {
    const code = `
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.log('Long task:', entry.duration, entry.attribution);
        }
      });
      observer.observe({ type: 'longtask', buffered: true });

      const obs2 = new window.PerformanceObserver((list) => {
        console.log(list.getEntries());
      });
      obs2.observe({ entryTypes: ['longtask'] });
    `;
    const matches = runMatcher(code);
    assert.equal(matches.length, 2);
    assert.equal(matches[0]?.line, 7);
    assert.equal(matches[1]?.line, 12);
  });

  await t.test("exempts files already observing 'long-animation-frame' or guarded by feature detection", () => {
    const loafCode = `
      const observer = new PerformanceObserver((list) => {
        console.log(list.getEntries());
      });
      observer.observe({ type: 'long-animation-frame', buffered: true });
    `;
    assert.equal(runMatcher(loafCode).length, 0);

    const fallbackCode = `
      if ('PerformanceLongAnimationFrameTiming' in window) {
        const loafObserver = new PerformanceObserver( reportLoaf );
        loafObserver.observe({ type: 'long-animation-frame', buffered: true });
      } else {
        const ltObserver = new PerformanceObserver( reportLongTask );
        ltObserver.observe({ type: 'longtask', buffered: true });
      }
    `;
    assert.equal(runMatcher(fallbackCode).length, 0);
  });

  await t.test('exempts non-PerformanceObserver .observe() calls and unrelated entry types', () => {
    const code = `
      const po = new PerformanceObserver(() => {});
      po.observe({ type: 'largest-contentful-paint', buffered: true });

      const customTracker = { observe(opts: unknown) { return opts; } };
      customTracker.observe({ type: 'longtask' });
    `;
    const matches = runMatcher(code, 'other.ts');
    assert.equal(matches.length, 0);
  });
});
