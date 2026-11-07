import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  interestTriggeredTooltipsJsMatcher
} from './interest-triggered-tooltips.ts';
void test('interest-triggered-tooltips JS matcher', async (t) => {
  await t.test('flags global and imported tippy() hover tooltips', () => {
    const code = `
      import tippy from 'tippy.js';
      tippy('#help-btn', { content: 'Helpful info', placement: 'top' });
      window.tippy('[data-tippy-content]');
    `;
    const matches = matchJsRule(interestTriggeredTooltipsJsMatcher, 'tooltips.js', code);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts interactive or click-triggered tippy menus', () => {
    const code = `
      import tippy from 'tippy.js';
      tippy('#user-menu', {
        content: menuElement,
        interactive: true,
        trigger: 'click',
      });
    `;
    const matches = matchJsRule(interestTriggeredTooltipsJsMatcher, 'menu.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts tippy calls with followCursor, allowHTML, lifecycle hooks, or dynamic content callbacks (Area 2.3)', () => {
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
    const matches = matchJsRule(interestTriggeredTooltipsJsMatcher, 'advanced-tippy.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts when guarded by interestfor feature detection or local tippy function', () => {
    const code = `
      if (!('interestForElement' in HTMLButtonElement.prototype) && !('interestfor' in HTMLElement.prototype)) {
        tippy('#btn', { content: 'Fallback' });
      }
      function localScope() {
        function tippy(el, opts) { return [el, opts]; }
        tippy('#other', { content: 'Local' });
      }
    `;
    const matches = matchJsRule(interestTriggeredTooltipsJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts tippy calls with plugin options or render callbacks', () => {
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
    const matches = matchJsRule(interestTriggeredTooltipsJsMatcher, 'plugins.js', code);
    assert.equal(matches.length, 0);
  });
});
