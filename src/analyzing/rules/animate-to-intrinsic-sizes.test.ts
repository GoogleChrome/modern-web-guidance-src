import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { scanJsSource } from '../scanners/js-scanner.ts';
import type { CssRuleMatcher, JsRuleMatcher } from '../schema.ts';
import {
  animateToIntrinsicSizesJsRule,
  animateToIntrinsicSizesRule,
} from './animate-to-intrinsic-sizes.ts';

const matcher = animateToIntrinsicSizesRule.matcher as CssRuleMatcher;
const jsMatcher = animateToIntrinsicSizesJsRule.matcher as JsRuleMatcher;

void test('animate-to-intrinsic-sizes: positive brownfield matches', async (t) => {
  await t.test('flags rule with transition: max-height', () => {
    const css = `
      .accordion-content {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.4s ease-out;
      }
    `;
    const matches = scanCss('accordion.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /interpolate-size/);
  });

  await t.test('flags rule with transition-property: max-height', () => {
    const css = `
      .collapsible {
        max-height: 500px;
        transition-property: max-height, opacity;
        transition-duration: 0.3s;
      }
    `;
    const matches = scanCss('collapsible.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags rule with transition: all alongside max-height declaration', () => {
    const css = `
      .card-body {
        max-height: 250px;
        transition: all 0.3s ease-in-out;
      }
    `;
    const matches = scanCss('card.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags real-world basisjs-basisjs event-log-entry.css fixture', () => {
    const basisCss = `
      .wrapper {
        position: relative;
        left: 0;
        max-height: 150px;
        opacity: 1;
        transition: max-height .8s ease-in-out, opacity 1s;
      }
      .wrapper_shown-anim {
        max-height: 0;
        opacity: 0;
      }
    `;
    const matches = scanCss('event-log-entry.css', basisCss, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags nested rules inside @media queries', () => {
    const css = `
      @media (min-width: 768px) {
        .nav-menu {
          max-height: 300px;
          transition: max-height 0.5s ease;
        }
      }
    `;
    const matches = scanCss('nav.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
  });
});

void test('animate-to-intrinsic-sizes: negative / exempt cases', async (t) => {
  await t.test('exempts scrollable containers with overflow: auto', () => {
    const css = `
      .scroll-box {
        max-height: 400px;
        overflow: auto;
        transition: max-height 0.2s ease;
      }
    `;
    const matches = scanCss('scroll.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts scrollable containers with overflow-y: scroll', () => {
    const css = `
      .chat-messages {
        max-height: 500px;
        overflow-y: scroll;
        transition: max-height 0.3s ease;
      }
    `;
    const matches = scanCss('chat.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts stylesheets using interpolate-size: allow-keywords', () => {
    const css = `
      :root {
        interpolate-size: allow-keywords;
      }
      .panel {
        max-height: 200px;
        transition: max-height 0.3s;
      }
    `;
    const matches = scanCss('modern.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts stylesheets using calc-size()', () => {
    const css = `
      .badge {
        block-size: calc-size(auto, size + 10px);
        transition: block-size 0.3s ease;
      }
      .panel {
        max-height: 200px;
        transition: max-height 0.3s;
      }
    `;
    const matches = scanCss('modern-calc.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts rules with transition: none', () => {
    const css = `
      .disabled-animation {
        max-height: 100px;
        transition: none;
      }
    `;
    const matches = scanCss('none.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts rules with max-height: none', () => {
    const css = `
      .expanded {
        max-height: none;
        transition: max-height 0.3s;
      }
    `;
    const matches = scanCss('reset.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts rules transitioning unrelated properties without all', () => {
    const css = `
      .card {
        max-height: 300px;
        transition: opacity 0.3s ease, transform 0.3s ease;
      }
    `;
    const matches = scanCss('unrelated.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });
});

void test('animate-to-intrinsic-sizes JS: positive brownfield matches', async (t) => {
  await t.test('flags accordion setting el.style.height = el.scrollHeight + "px"', () => {
    const js = `
      function togglePanel(panel) {
        if (panel.classList.contains('expanded')) {
          panel.style.height = '0px';
        } else {
          panel.style.height = panel.scrollHeight + 'px';
        }
      }
    `;
    const { matches } = scanJsSource('accordion.js', js, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 6);
    assert.match(matches[0]?.message ?? '', /interpolate-size/);
  });

  await t.test('flags assignment with template literal and offsetHeight', () => {
    const js = `
      function expandDrawer(drawer) {
        const h = drawer.offsetHeight;
        drawer.style.maxHeight = \`\${h}px\`;
      }
    `;
    const { matches } = scanJsSource('drawer.js', js, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 4);
  });

  await t.test('flags jQuery .css("height", el.scrollHeight + "px")', () => {
    const js = `
      function expandMenu($menu, el) {
        $menu.css('height', el.scrollHeight + 'px');
      }
    `;
    const { matches } = scanJsSource('menu.js', js, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
  });

  await t.test('flags getBoundingClientRect().height assigned to style.height', () => {
    const js = `
      function openCollapsible(el) {
        const rect = el.getBoundingClientRect();
        el.style.height = rect.height + 'px';
      }
    `;
    const { matches } = scanJsSource('collapsible.js', js, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 4);
  });
});

void test('animate-to-intrinsic-sizes JS: negative / exempt cases', async (t) => {
  await t.test('exempts textarea auto-resize on input event', () => {
    const js = `
      textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
      });
    `;
    const { matches } = scanJsSource('autosize.js', js, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts virtual-scroll viewport calculation', () => {
    const js = `
      function updateVirtualScroll(viewport, scroller, rowHeight, totalItems) {
        const visibleItems = Math.ceil(viewport.scrollTop / rowHeight);
        viewport.style.height = scroller.scrollHeight + 'px';
      }
    `;
    const { matches } = scanJsSource('virtual-scroll.js', js, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts code protected by interpolate-size feature guard', () => {
    const js = `
      if (!CSS.supports('interpolate-size', 'allow-keywords')) {
        panel.style.height = panel.scrollHeight + 'px';
      }
    `;
    const { matches } = scanJsSource('guarded.js', js, [jsMatcher]);
    assert.equal(matches.length, 0);
  });
});
