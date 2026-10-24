import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import type { CssRuleMatcher } from '../schema.ts';
import {
  DELIVER_OPTIMIZED_DECORATIVE_IMAGES_GUIDE_HASH,
  deliverOptimizedDecorativeImagesRule,
  deliverOptimizedDecorativeImagesRules,
} from './deliver-optimized-decorative-images.ts';

const matcher = deliverOptimizedDecorativeImagesRule.matcher as CssRuleMatcher;

void test('deliver-optimized-decorative-images: rule metadata', () => {
  assert.equal(deliverOptimizedDecorativeImagesRule.id, 'deliver-optimized-decorative-images');
  assert.equal(deliverOptimizedDecorativeImagesRule.guideId, 'deliver-optimized-decorative-images');
  assert.equal(deliverOptimizedDecorativeImagesRule.guideHash, DELIVER_OPTIMIZED_DECORATIVE_IMAGES_GUIDE_HASH);
  assert.equal(DELIVER_OPTIMIZED_DECORATIVE_IMAGES_GUIDE_HASH.length, 12);
  assert.equal(deliverOptimizedDecorativeImagesRules.length, 1);
  assert.ok(deliverOptimizedDecorativeImagesRule.phase2Rubric.keepWhen.length > 0);
  assert.ok(deliverOptimizedDecorativeImagesRule.phase2Rubric.dropWhen.length >= 2);
});

void test('deliver-optimized-decorative-images: positive brownfield matches', async (t) => {
  await t.test('flags background-image with -webkit-image-set without standard image-set', () => {
    const css = `
      .badge {
        background-image: -webkit-image-set(
          url("badge@1x.png") 1x,
          url("badge@2x.png") 2x
        );
      }
    `;
    const matches = scanCss('badge.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /image-set\(\)/);
  });

  await t.test('flags content property with -webkit-image-set', () => {
    const css = `
      .icon::before {
        content: -webkit-image-set(url("icon.png") 1x, url("icon@2x.png") 2x);
      }
    `;
    const matches = scanCss('icon.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });
});

void test('deliver-optimized-decorative-images: negative / exempt cases', async (t) => {
  await t.test('exempts rule pairing -webkit-image-set with standard image-set', () => {
    const css = `
      .badge {
        background-image: -webkit-image-set(
          url("badge@1x.png") 1x,
          url("badge@2x.png") 2x
        );
        background-image: image-set(
          url("badge@1x.png") 1x,
          url("badge@2x.png") 2x
        );
      }
    `;
    const matches = scanCss('paired.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts standard image-set without vendor prefix', () => {
    const css = `
      .gallery-item {
        background-image: image-set(
          url("gallery.avif") type("image/avif") 1x,
          url("gallery.jpg") type("image/jpeg") 1x
        );
      }
    `;
    const matches = scanCss('modern.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts regular background-image url without image-set', () => {
    const css = `
      .hero {
        background-image: url("hero.jpg");
        background-size: cover;
      }
    `;
    const matches = scanCss('hero.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });
});
