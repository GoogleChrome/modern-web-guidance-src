import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  improveNextPageLoadPerformanceJsMatcher,
  improveNextPageLoadPerformancePackageMatcher
} from './improve-next-page-load-performance.ts';
void test('improve-next-page-load-performance dependency matcher', async (t) => {
  await t.test('flags instant.page, quicklink, and flying-pages', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          'instant.page': '^5.2.0',
          quicklink: '^2.3.0',
          'flying-pages': '^2.1.2',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      improveNextPageLoadPerformancePackageMatcher,
    ]);
    assert.equal(matches.length, 3);
  });

  await t.test('exempts unrelated dependencies', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          workbox: '^7.0.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      improveNextPageLoadPerformancePackageMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});

void test('improve-next-page-load-performance JS matcher', async (t) => {
  await t.test('flags quicklink.listen(...) and quicklink.prefetch(...)', () => {
    const code = `
      quicklink.listen({ origins: true });
      quicklink.prefetch(['/next-article', '/pricing']);
    `;
    const matches = matchJsRule(improveNextPageLoadPerformanceJsMatcher, 'prefetch.js', code);
    assert.equal(matches.length, 2);
    assert.match(matches[0]?.message ?? '', /Speculation Rules/);
  });

  await t.test('flags imported quicklink default and named imports', () => {
    const code = `
      import quicklink, { listen } from 'quicklink';
      quicklink.prefetch('/pricing');
      listen();
    `;
    const matches = matchJsRule(improveNextPageLoadPerformanceJsMatcher, 'imported-prefetch.js', code);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts when guarded by HTMLScriptElement.supports?.("speculationrules")', () => {
    const code = `
      if (!HTMLScriptElement.supports?.('speculationrules')) {
        quicklink.listen();
      }
      if (HTMLScriptElement.supports?.('speculationrules')) {
        addSpeculationScript();
      } else {
        quicklink.prefetch('/about');
      }
    `;
    const matches = matchJsRule(improveNextPageLoadPerformanceJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts unrelated listen() or prefetch() calls', () => {
    const code = `
      server.listen(3000);
      router.prefetch('/dashboard');
    `;
    const matches = matchJsRule(improveNextPageLoadPerformanceJsMatcher, 'server.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('handles template imports without throwing', () => {
    const code = `
      import { helper } from <%= path %>;
      import quicklink, { listen } from 'quicklink';
      quicklink.prefetch('/pricing');
      listen();
    `;
    const matches = matchJsRule(improveNextPageLoadPerformanceJsMatcher, 'template-import.js', code);
    assert.equal(matches.length, 2);
  });
});
