import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import type { CssRuleMatcher } from '../schema.ts';
import {
  dynamicSiblingAnimationsCssRule,
} from './dynamic-sibling-animations.ts';

if (dynamicSiblingAnimationsCssRule.matcher.kind !== 'css') {
  throw new Error('Expected CSS matcher');
}
const cssMatcher: CssRuleMatcher = dynamicSiblingAnimationsCssRule.matcher;

void test('dynamic-sibling-animations: CSS positive matches', async (t) => {
  await t.test('flags >= 3 consecutive :nth-child(N) rules setting only animation-delay', () => {
    const css = `
      .list-item {
        animation: fade-in 0.4s ease both;
      }
      .list-item:nth-child(1) {
        animation-delay: 0.1s;
      }
      .list-item:nth-child(2) {
        animation-delay: 0.2s;
      }
      .list-item:nth-child(3) {
        animation-delay: 0.3s;
      }
    `;
    const matches = scanCss('stagger.css', css, [cssMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 5);
    assert.match(matches[0]?.message ?? '', /sibling-index\(\)/);
  });
});

void test('dynamic-sibling-animations: CSS negative / exempt cases', async (t) => {
  await t.test('exempts :nth-child rules that also set per-child color or position', () => {
    const css = `
      .spinner div:nth-child(1) { top: 5%; left: 50%; animation-delay: -0.8s; color: red; }
      .spinner div:nth-child(2) { top: 15%; left: 70%; animation-delay: -0.7s; color: blue; }
      .spinner div:nth-child(3) { top: 35%; left: 85%; animation-delay: -0.6s; color: green; }
    `;
    const matches = scanCss('spinner.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts :nth-child rules setting --i custom properties (owned by dynamic-sibling-styling)', () => {
    const css = `
      .card:nth-child(1) { --i: 1; }
      .card:nth-child(2) { --i: 2; }
      .card:nth-child(3) { --i: 3; }
    `;
    const matches = scanCss('vars.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts stylesheet already using sibling-index()', () => {
    const css = `
      .item {
        animation-delay: calc(sibling-index() * 0.1s);
      }
    `;
    const matches = scanCss('modern.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });
});
