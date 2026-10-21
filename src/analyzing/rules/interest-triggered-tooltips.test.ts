import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  INTEREST_TRIGGERED_TOOLTIPS_GUIDE_HASH,
  interestTriggeredTooltipsJsMatcher,
  interestTriggeredTooltipsJsRule,
  interestTriggeredTooltipsPackageMatcher,
  interestTriggeredTooltipsPackageRule,
  interestTriggeredTooltipsRules,
} from './interest-triggered-tooltips.ts';

void test('interest-triggered-tooltips: rule metadata', () => {
  assert.equal(
    interestTriggeredTooltipsPackageRule.id,
    'interest-triggered-tooltips/package-tooltip',
  );
  assert.equal(
    interestTriggeredTooltipsPackageRule.guideId,
    'interest-triggered-tooltips',
  );
  assert.equal(
    interestTriggeredTooltipsPackageRule.guideHash,
    INTEREST_TRIGGERED_TOOLTIPS_GUIDE_HASH,
  );
  assert.equal(INTEREST_TRIGGERED_TOOLTIPS_GUIDE_HASH.length, 12);

  assert.equal(
    interestTriggeredTooltipsJsRule.id,
    'interest-triggered-tooltips/js-tooltip',
  );
  assert.equal(
    interestTriggeredTooltipsJsRule.guideId,
    'interest-triggered-tooltips',
  );
  assert.equal(
    interestTriggeredTooltipsJsRule.guideHash,
    INTEREST_TRIGGERED_TOOLTIPS_GUIDE_HASH,
  );

  assert.equal(interestTriggeredTooltipsRules.length, 1);
  assert.ok(interestTriggeredTooltipsPackageRule.phase2Rubric.keepWhen.length >= 1);
  assert.ok(interestTriggeredTooltipsPackageRule.phase2Rubric.dropWhen.length >= 2);
  assert.ok(interestTriggeredTooltipsJsRule.phase2Rubric.keepWhen.length >= 2);
  assert.ok(interestTriggeredTooltipsJsRule.phase2Rubric.dropWhen.length >= 2);
});

void test('interest-triggered-tooltips dependency matcher', async (t) => {
  await t.test('flags tippy.js, @tippyjs/react, floating-vue, and v-tooltip', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          'tippy.js': '^6.3.7',
          '@tippyjs/react': '^4.2.6',
          'floating-vue': '^2.0.0',
          'v-tooltip': '^2.1.3',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      interestTriggeredTooltipsPackageMatcher,
    ]);
    assert.equal(matches.length, 4);
  });

  await t.test('exempts unrelated packages', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          vue: '^3.4.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      interestTriggeredTooltipsPackageMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});

void test('interest-triggered-tooltips JS matcher', async (t) => {
  await t.test('flags global and imported tippy() hover tooltips', () => {
    const project = createInMemoryProject();
    const code = `
      import tippy from 'tippy.js';
      tippy('#help-btn', { content: 'Helpful info', placement: 'top' });
      window.tippy('[data-tippy-content]');
    `;
    const sourceFile = project.createSourceFile('tooltips.js', code);
    const matches = interestTriggeredTooltipsJsMatcher.matchFile(sourceFile, {
      filePath: 'tooltips.js',
      fileContent: code,
    });
    assert.equal(matches.length, 2);
  });

  await t.test('exempts interactive or click-triggered tippy menus', () => {
    const project = createInMemoryProject();
    const code = `
      import tippy from 'tippy.js';
      tippy('#user-menu', {
        content: menuElement,
        interactive: true,
        trigger: 'click',
      });
    `;
    const sourceFile = project.createSourceFile('menu.js', code);
    const matches = interestTriggeredTooltipsJsMatcher.matchFile(sourceFile, {
      filePath: 'menu.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts when guarded by interestfor feature detection or local tippy function', () => {
    const project = createInMemoryProject();
    const code = `
      if (!('interestForElement' in HTMLButtonElement.prototype) && !('interestfor' in HTMLElement.prototype)) {
        tippy('#btn', { content: 'Fallback' });
      }
      function localScope() {
        function tippy(el, opts) { return [el, opts]; }
        tippy('#other', { content: 'Local' });
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = interestTriggeredTooltipsJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
