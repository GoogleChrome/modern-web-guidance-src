import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import type { CssRuleMatcher } from '../schema.ts';
import { individualTransformPropertiesRule } from './individual-transform-properties.ts';

const matcher = individualTransformPropertiesRule.matcher as CssRuleMatcher;

void test('individual-transform-properties: positive brownfield matches', async (t) => {
  await t.test('flags compound transform on hover state', () => {
    const css = `
      .card:hover {
        transform: translateY(-5px) scale(1.05);
      }
    `;
    const matches = scanCss('card.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /individual translate, rotate, or scale/);
  });

  await t.test('flags compound translateX and translateY on active state class', () => {
    const css = `
      .dropdown.open {
        transform: translateX(-50%) translateY(8px);
      }
    `;
    const matches = scanCss('dropdown.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags keyframe step combining multiple transform functions', () => {
    const css = `
      @keyframes float {
        0%, 100% {
          transform: translateY(0) rotate(0deg);
        }
        50% {
          transform: translateY(-10px) rotate(5deg);
        }
      }
    `;
    const matches = scanCss('animation.css', css, [matcher]);
    assert.equal(matches.length, 2);
  });

  await t.test('flags hover rule transitioning scale with stylesheet transition', () => {
    const css = `
      .button {
        transition: transform 0.2s ease-in-out;
      }
      .button:hover {
        transform: scale(1.1);
      }
    `;
    const matches = scanCss('button.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 5);
    assert.match(matches[0]?.message ?? '', /scale or rotate property/);
  });

  await t.test('flags hover rule transitioning rotate with local transition', () => {
    const css = `
      .icon:hover {
        transition: transform 0.3s ease;
        transform: rotate(180deg);
      }
    `;
    const matches = scanCss('icon.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });
});

void test('individual-transform-properties: negative / exempt cases', async (t) => {
  await t.test('exempts static single centering transform on base element', () => {
    const css = `
      .modal {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
    `;
    const matches = scanCss('modal.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts static scale without hover or transition', () => {
    const css = `
      .thumbnail {
        transform: scale(0.9);
      }
    `;
    const matches = scanCss('thumb.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts stylesheets already using scale property', () => {
    const css = `
      .badge {
        scale: 1;
      }
      .badge:hover {
        transform: translateY(-2px) scale(1.1);
      }
    `;
    const matches = scanCss('modern.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts stylesheets already using translate property', () => {
    const css = `
      .menu {
        translate: 0 0;
      }
      .menu:hover {
        transform: translateX(10px) rotate(5deg);
      }
    `;
    const matches = scanCss('modern-translate.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts transforms with matrix3d or perspective', () => {
    const css = `
      .cube:hover {
        transform: perspective(600px) rotateY(45deg);
      }
      .matrix:hover {
        transform: matrix(1, 0, 0, 1, 10, 20);
      }
    `;
    const matches = scanCss('3d.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts transforms with skew', () => {
    const css = `
      .slanted:hover {
        transform: skewX(10deg) translateX(5px);
      }
    `;
    const matches = scanCss('skew.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });
});
