import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  INTEREST_TRIGGERED_TOOLTIPS_GUIDE_HASH,
  interestTriggeredTooltipsJsMatcher,
  interestTriggeredTooltipsJsRule,
  interestTriggeredTooltipsRules,
} from './interest-triggered-tooltips.ts';

void test('interest-triggered-tooltips: rule metadata', () => {
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
  assert.ok(interestTriggeredTooltipsJsRule.phase2Rubric.keepWhen.length >= 2);
  assert.ok(interestTriggeredTooltipsJsRule.phase2Rubric.dropWhen.length >= 2);
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

  await t.test('exempts tippy calls with followCursor, allowHTML, lifecycle hooks, or dynamic content callbacks (Area 2.3)', () => {
    const project = createInMemoryProject();
    const code = `
      import tippy from 'tippy.js';
      tippy('#chart-canvas', { content: 'Coords', followCursor: true });
      tippy('#async-card', {
        content: 'Loading...',
        onShow(instance) { fetchDetails(instance); },
      });
      tippy('#dynamic', {
        content: (ref) => ref.getAttribute('data-label'),
      });
    `;
    const sourceFile = project.createSourceFile('advanced-tippy.js', code);
    const matches = interestTriggeredTooltipsJsMatcher.matchFile(sourceFile, {
      filePath: 'advanced-tippy.js',
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

  await t.test('exempts tippy calls with plugin options or render callbacks', () => {
    const project = createInMemoryProject();
    const code = `
      import tippy from 'tippy.js';
      tippy('#btn-plugin', {
        content: 'Plugins',
        plugins: [somePlugin],
      });
      tippy('#btn-render', {
        render(instance) {
          const popper = document.createElement('div');
          return { popper };
        },
      });
    `;
    const sourceFile = project.createSourceFile('plugins.js', code);
    const matches = interestTriggeredTooltipsJsMatcher.matchFile(sourceFile, {
      filePath: 'plugins.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
