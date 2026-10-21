import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  IMPROVE_NEXT_PAGE_LOAD_PERFORMANCE_GUIDE_HASH,
  improveNextPageLoadPerformanceJsMatcher,
  improveNextPageLoadPerformanceJsRule,
  improveNextPageLoadPerformancePackageMatcher,
  improveNextPageLoadPerformancePackageRule,
  improveNextPageLoadPerformanceRules,
} from './improve-next-page-load-performance.ts';

void test('improve-next-page-load-performance: rule metadata', () => {
  assert.equal(
    improveNextPageLoadPerformancePackageRule.id,
    'improve-next-page-load-performance/package-prefetch',
  );
  assert.equal(
    improveNextPageLoadPerformancePackageRule.guideId,
    'improve-next-page-load-performance',
  );
  assert.equal(
    improveNextPageLoadPerformancePackageRule.guideHash,
    IMPROVE_NEXT_PAGE_LOAD_PERFORMANCE_GUIDE_HASH,
  );
  assert.equal(IMPROVE_NEXT_PAGE_LOAD_PERFORMANCE_GUIDE_HASH.length, 12);

  assert.equal(
    improveNextPageLoadPerformanceJsRule.id,
    'improve-next-page-load-performance/js-quicklink',
  );
  assert.equal(
    improveNextPageLoadPerformanceJsRule.guideId,
    'improve-next-page-load-performance',
  );
  assert.equal(
    improveNextPageLoadPerformanceJsRule.guideHash,
    IMPROVE_NEXT_PAGE_LOAD_PERFORMANCE_GUIDE_HASH,
  );

  assert.equal(improveNextPageLoadPerformanceRules.length, 2);
  assert.ok(
    improveNextPageLoadPerformancePackageRule.phase2Rubric.keepWhen.length >= 1,
  );
  assert.ok(
    improveNextPageLoadPerformancePackageRule.phase2Rubric.dropWhen.length >= 2,
  );
  assert.ok(
    improveNextPageLoadPerformanceJsRule.phase2Rubric.keepWhen.length >= 1,
  );
  assert.ok(
    improveNextPageLoadPerformanceJsRule.phase2Rubric.dropWhen.length >= 2,
  );
});

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
    const project = createInMemoryProject();
    const code = `
      quicklink.listen({ origins: true });
      quicklink.prefetch(['/next-article', '/pricing']);
    `;
    const sourceFile = project.createSourceFile('prefetch.js', code);
    const matches = improveNextPageLoadPerformanceJsMatcher.matchFile(
      sourceFile,
      {
        filePath: 'prefetch.js',
        fileContent: code,
      },
    );
    assert.equal(matches.length, 2);
    assert.match(matches[0]?.message ?? '', /Speculation Rules/);
  });

  await t.test('flags imported quicklink default and named imports', () => {
    const project = createInMemoryProject();
    const code = `
      import quicklink, { listen } from 'quicklink';
      quicklink.prefetch('/pricing');
      listen();
    `;
    const sourceFile = project.createSourceFile('imported-prefetch.js', code);
    const matches = improveNextPageLoadPerformanceJsMatcher.matchFile(
      sourceFile,
      {
        filePath: 'imported-prefetch.js',
        fileContent: code,
      },
    );
    assert.equal(matches.length, 2);
  });

  await t.test('exempts when guarded by HTMLScriptElement.supports?.("speculationrules")', () => {
    const project = createInMemoryProject();
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
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = improveNextPageLoadPerformanceJsMatcher.matchFile(
      sourceFile,
      {
        filePath: 'guarded.js',
        fileContent: code,
      },
    );
    assert.equal(matches.length, 0);
  });

  await t.test('exempts unrelated listen() or prefetch() calls', () => {
    const project = createInMemoryProject();
    const code = `
      server.listen(3000);
      router.prefetch('/dashboard');
    `;
    const sourceFile = project.createSourceFile('server.js', code);
    const matches = improveNextPageLoadPerformanceJsMatcher.matchFile(
      sourceFile,
      {
        filePath: 'server.js',
        fileContent: code,
      },
    );
    assert.equal(matches.length, 0);
  });
});
