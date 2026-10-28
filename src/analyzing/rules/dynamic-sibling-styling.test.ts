import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { scanJsSource } from '../scanners/js-scanner.ts';
import type { CssRuleMatcher, JsRuleMatcher } from '../schema.ts';
import {
  dynamicSiblingStylingCssRule,
  dynamicSiblingStylingJsRule,
} from './dynamic-sibling-styling.ts';

if (
  dynamicSiblingStylingJsRule.matcher.kind !== 'js' ||
  dynamicSiblingStylingCssRule.matcher.kind !== 'css'
) {
  throw new Error('Expected JS and CSS matchers');
}
const jsMatcher: JsRuleMatcher = dynamicSiblingStylingJsRule.matcher;
const cssMatcher: CssRuleMatcher = dynamicSiblingStylingCssRule.matcher;

void test('dynamic-sibling-styling: JS positive and negative cases', async (t) => {
  await t.test('flags JS loop injecting --sibling-index and --sibling-count via style.setProperty', () => {
    const code = `
      const items = document.querySelectorAll('.swatch');
      items.forEach((item, index) => {
        item.style.setProperty('--sibling-index', index + 1);
        item.style.setProperty('--sibling-count', items.length);
      });
    `;
    const { matches } = scanJsSource('sibling-vars.js', code, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 4);
    assert.match(matches[0]?.message ?? '', /sibling-index\(\)/);
  });

  await t.test('exempts JS loop guarded by CSS.supports("top: calc(sibling-index() * 1px)")', () => {
    const code = `
      if (!CSS.supports('top: calc(sibling-index() * 1px)')) {
        const items = document.querySelectorAll('.item');
        items.forEach((item, index) => {
          item.style.setProperty('--sibling-index', index + 1);
          item.style.setProperty('--sibling-count', items.length);
        });
      }
    `;
    const { matches } = scanJsSource('fallback.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts complex loop setting unrelated custom properties and DOM mutations', () => {
    const code = `
      for (let i = 0; i < metrics.length; i++) {
        const el = document.createElement('g');
        el.style.setProperty('--i', i);
        el.style.setProperty('--metric-color', metrics[i].color);
        container.appendChild(el);
      }
    `;
    const { matches } = scanJsSource('gauge.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });
});

void test('dynamic-sibling-styling/css: CSS positive and negative cases', async (t) => {
  await t.test('flags >= 3 consecutive :nth-child(N) rules assigning sequential --i', () => {
    const css = `
      .orb:nth-child(1) { --i: 1; }
      .orb:nth-child(2) { --i: 2; }
      .orb:nth-child(3) { --i: 3; }
    `;
    const matches = scanCss('orbs.css', css, [cssMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('exempts :nth-child rules setting animation-delay (owned by dynamic-sibling-animations)', () => {
    const css = `
      .orb:nth-child(1) { animation-delay: 0.1s; }
      .orb:nth-child(2) { animation-delay: 0.2s; }
      .orb:nth-child(3) { animation-delay: 0.3s; }
    `;
    const matches = scanCss('delays.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });
});
