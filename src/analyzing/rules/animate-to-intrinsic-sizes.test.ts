import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import type { CssRuleMatcher } from '../schema.ts';
import { animateToIntrinsicSizesRule } from './animate-to-intrinsic-sizes.ts';

const matcher = animateToIntrinsicSizesRule.matcher as CssRuleMatcher;

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
        overflow: hidden;
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

  await t.test('exempts rules where max-height is percentage-only', () => {
    const css = `
      .sidebar {
        max-height: 100%;
        transition: max-height 0.3s ease;
      }
    `;
    const matches = scanCss('percent.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts rules where max-height is viewport-unit only (vh, dvh, svh)', () => {
    const css = `
      .modal-dialog {
        max-height: 80vh;
        transition: max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }
    `;
    const matches = scanCss('viewport.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts small fixed ceiling <= 50px without 0 declared', () => {
    const css = `
      .small-bar {
        max-height: 30px;
        transition: max-height 0.2s ease;
      }
    `;
    const matches = scanCss('small.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts transition: all with static max-height cap on img/textarea or without overflow: hidden / max-height: 0', () => {
    const css = `
      .sponsor img {
        max-height: 80px;
        transition: all 0.25s ease;
      }
      .gt-header-textarea {
        max-height: 15em;
        resize: vertical;
        transition: all 0.25s ease;
      }
      .picker-frame {
        max-height: 350px;
        opacity: 0;
        transition: all 0.15s ease-out;
      }
    `;
    const matches = scanCss('static-cap.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });
});
