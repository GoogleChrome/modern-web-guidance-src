import assert from 'node:assert/strict';
import test from 'node:test';
import { Project } from 'ts-morph';
import { isProtectedByFeatureGuard } from './ast-helpers.ts';

test('isProtectedByFeatureGuard: bare variable and negative early-return guards', async (t) => {
  const project = new Project({ useInMemoryFileSystem: true });

  await t.test('bare variable null-check does NOT guard subsequent code', () => {
    const source = project.createSourceFile(
      'nullCheck.ts',
      `
      function processElement(container: HTMLElement | null) {
        if (!container) return;
        legacyResizeObserverPolyfill(container);
      }
      `,
      { overwrite: true },
    );

    const callNode = source.getDescendants().find((n) => n.getText().startsWith('legacyResizeObserverPolyfill'));
    assert.ok(callNode);

    // 'container' as a CSS keyword token must NOT match bare variable !container
    assert.equal(
      isProtectedByFeatureGuard(callNode, ['container', 'container-type']),
      false,
      'if (!container) return must not falsely suppress findings as a feature guard',
    );
  });

  await t.test('negative modern feature check does NOT guard subsequent code', () => {
    const source = project.createSourceFile(
      'negativeScheduler.ts',
      `
      function scheduleWork() {
        if (!window.scheduler) return;
        legacyTaskYield();
      }
      `,
      { overwrite: true },
    );

    const callNode = source.getDescendants().find((n) => n.getText().startsWith('legacyTaskYield'));
    assert.ok(callNode);

    // Negative check if (!window.scheduler) return exits when missing, so subsequent code
    // runs when window.scheduler IS present (not a legacy fallback)
    assert.equal(
      isProtectedByFeatureGuard(callNode, ['scheduler', 'window.scheduler']),
      false,
      'if (!window.scheduler) return must not treat subsequent code as guarded fallback',
    );
  });

  await t.test('positive modern feature check DOES guard subsequent fallback code', () => {
    const source = project.createSourceFile(
      'positiveScheduler.ts',
      `
      function scheduleWork() {
        if (window.scheduler) return;
        legacyTaskYield();
      }
      `,
      { overwrite: true },
    );

    const callNode = source.getDescendants().find((n) => n.getText().startsWith('legacyTaskYield'));
    assert.ok(callNode);

    // Positive check if (window.scheduler) return exits when supported, so subsequent code
    // runs when window.scheduler is falsy (legitimate guarded fallback)
    assert.equal(
      isProtectedByFeatureGuard(callNode, ['scheduler', 'window.scheduler']),
      true,
      'if (window.scheduler) return must guard subsequent legacy fallback code',
    );
  });
});
