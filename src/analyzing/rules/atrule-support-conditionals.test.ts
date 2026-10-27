import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  atruleSupportConditionalsJsMatcher
} from './atrule-support-conditionals.ts';
void test('atrule-support-conditionals JS matcher', async (t) => {
  await t.test('flags CSSRule.*_RULE and stylesheet insertRule("@...") try/catch probes', () => {
    const code = `
      const hasKeyframesRule = 'KEYFRAMES_RULE' in CSSRule || Boolean(CSSRule.KEYFRAMES_RULE);
      try {
        sheet.insertRule('@starting-style { .box { opacity: 0; } }', 0);
      } catch (e) {
        enableFallback();
      }
    `;
    const matches = matchJsRule(atruleSupportConditionalsJsMatcher, 'feature.js', code);
    assert.equal(matches.length, 2);
  });

  await t.test('flags Modernizr.atRule() and imported Modernizr at-rule usage', () => {
    const code = `
      import Modernizr from 'modernizr';
      const hasKeyframes = Modernizr.atRule('@keyframes');
      const hasFontFace = Modernizr.fontface;
    `;
    const matches = matchJsRule(atruleSupportConditionalsJsMatcher, 'atrule.js', code);
    assert.equal(matches.length, 2);
    assert.match(matches[0]?.message ?? '', /Modernizr\.atRule/);
  });

  await t.test('exempts Modernizr CSS property checks (flexbox, cssgrid, testProp, testAllProps, prefixed)', () => {
    const code = `
      const hasPointerEvents = Modernizr.testProp('pointerEvents');
      const hasBoxSizing = Modernizr.testAllProps('boxSizing', 'border-box', true);
      const transformProp = Modernizr.prefixed('transform');
      if (Modernizr.cssanimations && Modernizr.flexbox && Modernizr.cssgrid) {
        enableGridAnimations();
      }
    `;
    const matches = matchJsRule(atruleSupportConditionalsJsMatcher, 'layout.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts non-CSS HTML5 API checks on Modernizr', () => {
    const code = `
      if (Modernizr.webgl && Modernizr.canvas && Modernizr.localstorage) {
        initScene();
      }
      if (Modernizr.TouchEvent || Modernizr.websockets) {
        connectSocket();
      }
    `;
    const matches = matchJsRule(atruleSupportConditionalsJsMatcher, 'html5.js', code);
    assert.equal(matches.length, 0);
  });
});
