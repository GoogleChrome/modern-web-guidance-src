import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import {
  resolutionOptimizedPseudoElementsCssMatcher
} from './resolution-optimized-pseudo-elements.ts';
void test('resolution-optimized-pseudo-elements: positive matches', async (t) => {
  await t.test('flags ::before with -webkit-image-set in content', () => {
    const css = `
      .icon-button::before {
        content: -webkit-image-set(
          url("icon-1x.png") 1x,
          url("icon-2x.png") 2x
        );
      }
    `;
    const matches = scanCss('icon.css', css, [
      resolutionOptimizedPseudoElementsCssMatcher,
    ]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /image-set\(\)/);
  });

  await t.test('flags :after and ::after with -webkit-image-set in background-image or background', () => {
    const css = `
      .external-link:after {
        content: "";
        background-image: -webkit-image-set(url("ext.png") 1x, url("ext@2x.png") 2x);
      }
      .badge::after {
        content: "";
        background: -webkit-image-set(url("badge.png") 1x, url("badge@2x.png") 2x) no-repeat;
      }
    `;
    const matches = scanCss('links.css', css, [
      resolutionOptimizedPseudoElementsCssMatcher,
    ]);
    assert.equal(matches.length, 2);
  });
});

void test('resolution-optimized-pseudo-elements: negative / exempt cases', async (t) => {
  await t.test('exempts pseudo-element rule that includes unprefixed image-set()', () => {
    const css = `
      .icon-button::before {
        content: -webkit-image-set(url("icon-1x.png") 1x, url("icon-2x.png") 2x);
        content: image-set(
          url("icon-1x.avif") type("image/avif") 1x,
          url("icon-2x.avif") type("image/avif") 2x
        );
      }
    `;
    const matches = scanCss('paired.css', css, [
      resolutionOptimizedPseudoElementsCssMatcher,
    ]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts non-pseudo-element selectors using -webkit-image-set()', () => {
    const css = `
      .hero-banner {
        background-image: -webkit-image-set(url("hero.jpg") 1x, url("hero@2x.jpg") 2x);
      }
    `;
    const matches = scanCss('hero.css', css, [
      resolutionOptimizedPseudoElementsCssMatcher,
    ]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts pseudo-elements using plain url() without -webkit-image-set()', () => {
    const css = `
      .icon-button::before {
        content: url("icon.svg");
      }
      @media (min-resolution: 2dppx) {
        .icon-button::before {
          width: 16px;
          height: 16px;
          background-image: url("icon@2x.png");
          background-size: contain;
        }
      }
    `;
    const matches = scanCss('svg.css', css, [
      resolutionOptimizedPseudoElementsCssMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});
