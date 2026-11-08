import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import type { CssRuleMatcher } from '../schema.ts';
import { dynamicSiblingStylingCssRule } from './dynamic-sibling-styling.ts';

if (dynamicSiblingStylingCssRule.matcher.kind !== 'css') {
  throw new Error('Expected CSS matcher');
}
const cssMatcher: CssRuleMatcher = dynamicSiblingStylingCssRule.matcher;

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

  await t.test('flags >= 4 sequential :nth-child(N) rules on z-index, order, or transform with single varying numeric token', () => {
    const zIndexCss = `
      .path li:nth-child(1) { z-index: 10; }
      .path li:nth-child(2) { z-index: 9; }
      .path li:nth-child(3) { z-index: 8; }
      .path li:nth-child(4) { z-index: 7; }
    `;
    const zMatches = scanCss('stack.css', zIndexCss, [cssMatcher]);
    assert.equal(zMatches.length, 1);
    assert.equal(zMatches[0]?.line, 2);

    const rotateCss = `
      #spinner > div:nth-child(1) { transform: rotate( 22.5deg); }
      #spinner > div:nth-child(2) { transform: rotate( 67.5deg); }
      #spinner > div:nth-child(3) { transform: rotate(112.5deg); }
      #spinner > div:nth-child(4) { transform: rotate(157.5deg); }
    `;
    const rotateMatches = scanCss('spinner.css', rotateCss, [cssMatcher]);
    assert.equal(rotateMatches.length, 1);
    assert.equal(rotateMatches[0]?.line, 2);

    const compoundTransformCss = `
      .dot-row:nth-of-type(1) { transform: translateY(-50%) rotate(0deg); }
      .dot-row:nth-of-type(2) { transform: translateY(-50%) rotate(8deg); }
      .dot-row:nth-of-type(3) { transform: translateY(-50%) rotate(16deg); }
      .dot-row:nth-of-type(4) { transform: translateY(-50%) rotate(24deg); }
    `;
    assert.equal(scanCss('dots.css', compoundTransformCss, [cssMatcher]).length, 1);

    const paddedNthCss = `
      .item:nth-child( 1 ) { --i: 1; }
      .item:nth-child( 2 ) { --i: 2; }
      .item:nth-child( 3 ) { --i: 3; }
    `;
    assert.equal(scanCss('padded.css', paddedNthCss, [cssMatcher]).length, 1);
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

  await t.test('exempts combinator, pseudo-element, or short (<4) non-custom-property :nth-child rules', () => {
    const combinatorCss = `
      .tabs input:nth-child(1):checked ~ .slider { transform: translateX(0%); }
      .tabs input:nth-child(2):checked ~ .slider { transform: translateX(100%); }
      .tabs input:nth-child(3):checked ~ .slider { transform: translateX(200%); }
      .tabs input:nth-child(4):checked ~ .slider { transform: translateX(300%); }
      li:nth-child(1) span { order: 1; }
      li:nth-child(2) span { order: 2; }
      li:nth-child(3) span { order: 3; }
      li:nth-child(4) span { order: 4; }
    `;
    assert.equal(scanCss('combinators.css', combinatorCss, [cssMatcher]).length, 0);

    const shortZIndexCss = `
      .item:nth-child(1) { z-index: 1; }
      .item:nth-child(2) { z-index: 2; }
      .item:nth-child(3) { z-index: 3; }
    `;
    assert.equal(scanCss('short.css', shortZIndexCss, [cssMatcher]).length, 0);

    const mixedPseudoCss = `
      .item:nth-child(1) { --i: 1; }
      .item:nth-of-type(2) { --i: 2; }
      .item:nth-child(3) { --i: 3; }
    `;
    assert.equal(scanCss('mixed.css', mixedPseudoCss, [cssMatcher]).length, 0);
  });
});
