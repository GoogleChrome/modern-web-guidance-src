import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import type { CssRuleMatcher } from '../schema.ts';
import {
  COMPLEX_SHAPES_GUIDE_HASH,
  complexShapesRule,
  complexShapesRules,
} from './complex-shapes.ts';

const matcher = complexShapesRule.matcher as CssRuleMatcher;

void test('complex-shapes: rule metadata', () => {
  assert.equal(complexShapesRule.id, 'complex-shapes');
  assert.equal(complexShapesRule.guideId, 'complex-shapes');
  assert.equal(complexShapesRule.guideHash, COMPLEX_SHAPES_GUIDE_HASH);
  assert.equal(COMPLEX_SHAPES_GUIDE_HASH.length, 12);
  assert.equal(complexShapesRules.length, 1);
  assert.ok(complexShapesRule.phase2Rubric.keepWhen.length > 0);
  assert.ok(complexShapesRule.phase2Rubric.dropWhen.length >= 2);
});

void test('complex-shapes: positive brownfield matches', async (t) => {
  await t.test('flags orphaned -webkit-mask-image and -webkit-mask-size', () => {
    const css = `
      .icon-mask {
        -webkit-mask-image: url("shape.svg");
        -webkit-mask-size: contain;
      }
    `;
    const matches = scanCss('icons.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /mask-image/);
  });

  await t.test('flags -webkit-mask shorthand without standard mask', () => {
    const css = `
      .badge {
        -webkit-mask: url("star.png") no-repeat center;
      }
    `;
    const matches = scanCss('badges.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });
});

void test('complex-shapes: negative / exempt cases', async (t) => {
  await t.test('exempts rules declaring standard mask-image alongside -webkit-mask-image', () => {
    const css = `
      .shaped-element {
        -webkit-mask-image: url('mask.svg');
        -webkit-mask-size: cover;
        mask-image: url('mask.svg');
        mask-size: cover;
      }
    `;
    const matches = scanCss('modern-mask.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts rules declaring standard mask shorthand', () => {
    const css = `
      .shaped-element {
        -webkit-mask-image: url('mask.svg');
        mask: url('mask.svg') no-repeat;
      }
    `;
    const matches = scanCss('modern-shorthand.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts Safari border-radius overflow workaround with -webkit-radial-gradient', () => {
    const css = `
      .dropdown-content {
        -webkit-mask-image: -webkit-radial-gradient(circle, white 100%, black 100%);
      }
    `;
    const matches = scanCss('safari-bug.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts Safari border-radius overflow workaround with unprefixed radial-gradient', () => {
    const css = `
      .dropdown-content {
        -webkit-mask-image: radial-gradient(white, black);
      }
    `;
    const matches = scanCss('safari-bug-unprefixed.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts clip-path styling without mask properties', () => {
    const css = `
      .polygon-cut {
        clip-path: polygon(0 0, 100% 0, 100% 80%, 0 100%);
      }
    `;
    const matches = scanCss('clip.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });
});
