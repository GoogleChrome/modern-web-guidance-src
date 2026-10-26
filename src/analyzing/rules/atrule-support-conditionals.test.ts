import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  ATRULE_SUPPORT_CONDITIONALS_GUIDE_HASH,
  atruleSupportConditionalsJsMatcher,
  atruleSupportConditionalsJsRule,
  atruleSupportConditionalsRules,
} from './atrule-support-conditionals.ts';

void test('atrule-support-conditionals: rule metadata', () => {
  assert.equal(ATRULE_SUPPORT_CONDITIONALS_GUIDE_HASH.length, 12);

  assert.equal(
    atruleSupportConditionalsJsRule.id,
    'atrule-support-conditionals/js-modernizr',
  );
  assert.equal(
    atruleSupportConditionalsJsRule.guideId,
    'atrule-support-conditionals',
  );
  assert.equal(
    atruleSupportConditionalsJsRule.guideHash,
    ATRULE_SUPPORT_CONDITIONALS_GUIDE_HASH,
  );

  assert.equal(atruleSupportConditionalsRules.length, 1);
  assert.ok(atruleSupportConditionalsJsRule.verifierRubric.keepWhen.length >= 2);
  assert.ok(atruleSupportConditionalsJsRule.verifierRubric.dropWhen.length >= 2);
});

void test('atrule-support-conditionals JS matcher', async (t) => {
  await t.test('flags CSSRule.*_RULE and stylesheet insertRule("@...") try/catch probes', () => {
    const project = createInMemoryProject();
    const code = `
      const hasKeyframesRule = 'KEYFRAMES_RULE' in CSSRule || Boolean(CSSRule.KEYFRAMES_RULE);
      try {
        sheet.insertRule('@starting-style { .box { opacity: 0; } }', 0);
      } catch (e) {
        enableFallback();
      }
    `;
    const sourceFile = project.createSourceFile('feature.js', code);
    const matches = atruleSupportConditionalsJsMatcher.matchFile(sourceFile, {
      filePath: 'feature.js',
      fileContent: code,
    });
    assert.equal(matches.length, 2);
  });

  await t.test('flags Modernizr.atRule() and imported Modernizr at-rule usage', () => {
    const project = createInMemoryProject();
    const code = `
      import Modernizr from 'modernizr';
      const hasKeyframes = Modernizr.atRule('@keyframes');
      const hasFontFace = Modernizr.fontface;
    `;
    const sourceFile = project.createSourceFile('atrule.js', code);
    const matches = atruleSupportConditionalsJsMatcher.matchFile(sourceFile, {
      filePath: 'atrule.js',
      fileContent: code,
    });
    assert.equal(matches.length, 2);
    assert.match(matches[0]?.message ?? '', /Modernizr\.atRule/);
  });

  await t.test('exempts Modernizr CSS property checks (flexbox, cssgrid, testProp, testAllProps, prefixed)', () => {
    const project = createInMemoryProject();
    const code = `
      const hasPointerEvents = Modernizr.testProp('pointerEvents');
      const hasBoxSizing = Modernizr.testAllProps('boxSizing', 'border-box', true);
      const transformProp = Modernizr.prefixed('transform');
      if (Modernizr.cssanimations && Modernizr.flexbox && Modernizr.cssgrid) {
        enableGridAnimations();
      }
    `;
    const sourceFile = project.createSourceFile('layout.js', code);
    const matches = atruleSupportConditionalsJsMatcher.matchFile(sourceFile, {
      filePath: 'layout.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts non-CSS HTML5 API checks on Modernizr', () => {
    const project = createInMemoryProject();
    const code = `
      if (Modernizr.webgl && Modernizr.canvas && Modernizr.localstorage) {
        initScene();
      }
      if (Modernizr.TouchEvent || Modernizr.websockets) {
        connectSocket();
      }
    `;
    const sourceFile = project.createSourceFile('html5.js', code);
    const matches = atruleSupportConditionalsJsMatcher.matchFile(sourceFile, {
      filePath: 'html5.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
