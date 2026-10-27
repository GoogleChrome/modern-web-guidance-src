import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  positionAwareTooltipsJsMatcher
} from './position-aware-tooltips.ts';
void test('position-aware-tooltips JS matcher', async (t) => {
  await t.test('flags createPopper and computePosition for tooltip elements', () => {
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
    const matches = matchJsRule(positionAwareTooltipsJsMatcher, 'tooltip.js', code);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts when guarded by CSS.supports("anchor-name", "--a") or CSS.supports("position-anchor", "--a")', () => {
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
    const matches = matchJsRule(positionAwareTooltipsJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts non-tooltip dropdown menus or shadowed local functions', () => {
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
    const matches = matchJsRule(positionAwareTooltipsJsMatcher, 'menu.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts when non-tooltip widget keywords take precedence over tooltip naming in compound contexts', () => {
    const code = `
      import { createPopper } from '@popperjs/core';
      const trigger = document.querySelector('#menu-btn');
      const tooltipDropdownMenu = document.querySelector('#tooltip-dropdown-menu');
      createPopper(trigger, tooltipDropdownMenu, { placement: 'bottom-start' });

      class TooltipDropdownMenuController {
        render() {
          const popup = document.querySelector('#popup');
          createPopper(trigger, popup);
        }
      }
    `;
    const matches = matchJsRule(positionAwareTooltipsJsMatcher, 'compound.js', code);
    assert.equal(matches.length, 0);
  });
});
