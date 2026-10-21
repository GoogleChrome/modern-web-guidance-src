import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  POSITION_AWARE_TOOLTIPS_GUIDE_HASH,
  positionAwareTooltipsJsMatcher,
  positionAwareTooltipsJsRule,
  positionAwareTooltipsRules,
} from './position-aware-tooltips.ts';

void test('position-aware-tooltips: rule metadata', () => {
  assert.equal(POSITION_AWARE_TOOLTIPS_GUIDE_HASH.length, 12);

  assert.equal(
    positionAwareTooltipsJsRule.id,
    'position-aware-tooltips/js-popper-tooltip',
  );
  assert.equal(
    positionAwareTooltipsJsRule.guideId,
    'position-aware-tooltips',
  );
  assert.equal(
    positionAwareTooltipsJsRule.guideHash,
    POSITION_AWARE_TOOLTIPS_GUIDE_HASH,
  );

  assert.equal(positionAwareTooltipsRules.length, 1);
  assert.ok(positionAwareTooltipsJsRule.phase2Rubric.keepWhen.length >= 2);
  assert.ok(positionAwareTooltipsJsRule.phase2Rubric.dropWhen.length >= 2);
});

void test('position-aware-tooltips JS matcher', async (t) => {
  await t.test('flags createPopper and computePosition for tooltip elements', () => {
    const project = createInMemoryProject();
    const code = `
      import { createPopper } from '@popperjs/core';
      import { computePosition, flip } from '@floating-ui/dom';

      const button = document.querySelector('#anchor');
      const tooltipEl = document.querySelector('[role="tooltip"]');
      createPopper(button, tooltipEl, { placement: 'top' });

      computePosition(button, tooltipEl, {
        placement: 'top',
        middleware: [flip()],
      });
    `;
    const sourceFile = project.createSourceFile('tooltip.js', code);
    const matches = positionAwareTooltipsJsMatcher.matchFile(sourceFile, {
      filePath: 'tooltip.js',
      fileContent: code,
    });
    assert.equal(matches.length, 2);
  });

  await t.test('exempts when guarded by CSS.supports("anchor-name", "--a") or CSS.supports("position-anchor", "--a")', () => {
    const project = createInMemoryProject();
    const code = `
      import { createPopper } from '@popperjs/core';
      import { computePosition } from '@floating-ui/dom';

      const anchor = document.querySelector('#btn');
      const tooltip = document.querySelector('#tooltip');

      if (!CSS.supports('anchor-name', '--a')) {
        createPopper(anchor, tooltip);
      }

      if (!CSS.supports('position-anchor', '--a')) {
        computePosition(anchor, tooltip);
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = positionAwareTooltipsJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts non-tooltip dropdown menus or shadowed local functions', () => {
    const project = createInMemoryProject();
    const code = `
      import { createPopper } from '@popperjs/core';
      const trigger = document.querySelector('#menu-btn');
      const dropdownMenu = document.querySelector('#dropdown-menu');
      createPopper(trigger, dropdownMenu, { placement: 'bottom-start' });

      function localScope() {
        function computePosition(a, b) { return [a, b]; }
        const tooltip = document.querySelector('#tooltip');
        computePosition(trigger, tooltip);
      }

      function setupWidgets() {
        const tooltipEl = document.querySelector('#other-tooltip');
        const userCardPanel = document.querySelector('#user-card-panel');
        createPopper(trigger, dropdownMenu, { placement: 'bottom' });
        createPopper(trigger, userCardPanel, { placement: 'bottom' });
      }
    `;
    const sourceFile = project.createSourceFile('menu.js', code);
    const matches = positionAwareTooltipsJsMatcher.matchFile(sourceFile, {
      filePath: 'menu.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
