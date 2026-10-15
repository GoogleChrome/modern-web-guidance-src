import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import type { CssRuleMatcher } from '../schema.ts';
import { cssLayoutRule } from './css-layout.ts';

const matcher = cssLayoutRule.matcher as CssRuleMatcher;

void test('css-layout: positive brownfield matches', async (t) => {
  await t.test('flags 16:9 padding-bottom hack', () => {
    const css = `
      .responsive-video {
        position: relative;
        padding-bottom: 56.25%;
        height: 0;
        overflow: hidden;
      }
    `;
    const matches = scanCss('video.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /aspect-ratio: 16 \/ 9/);
  });

  await t.test('flags 16:9 padding-top hack', () => {
    const css = `
      .video-wrapper {
        padding-top: 56.25%;
        position: relative;
      }
    `;
    const matches = scanCss('video-top.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /aspect-ratio: 16 \/ 9/);
  });

  await t.test('flags real-world jsbin help.css fixture', () => {
    const jsbinCss = `
      .embed-container {
        padding-bottom: 56.25%;
        position: relative;
        width: 100%;
        height: 0;
      }
    `;
    const matches = scanCss('help.css', jsbinCss, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags 4:3 padding-bottom hack alongside height: 0', () => {
    const css = `
      .card-media-4x3 {
        padding-bottom: 75%;
        height: 0;
        overflow: hidden;
      }
    `;
    const matches = scanCss('card.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /aspect-ratio: 4 \/ 3/);
  });

  await t.test('flags 4:3 padding-top hack alongside position: relative', () => {
    const css = `
      .slideshow-frame {
        position: relative;
        padding-top: 75%;
      }
    `;
    const matches = scanCss('slideshow.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /aspect-ratio: 4 \/ 3/);
  });
});

void test('css-layout: negative / exempt cases', async (t) => {
  await t.test('exempts stylesheets already using aspect-ratio', () => {
    const css = `
      .modern-video {
        aspect-ratio: 16 / 9;
        width: 100%;
      }
      .legacy-fallback {
        padding-bottom: 56.25%;
        position: relative;
      }
    `;
    const matches = scanCss('modern.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts 75% padding without height: 0 or position: relative', () => {
    const css = `
      .article-section {
        padding-bottom: 75%;
        margin: 0;
      }
    `;
    const matches = scanCss('article.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts rules inside @supports (aspect-ratio: ...)', () => {
    const css = `
      @supports (aspect-ratio: 16 / 9) {
        .embed {
          padding-bottom: 56.25%;
        }
      }
    `;
    const matches = scanCss('supports.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts arbitrary padding percentages', () => {
    const css = `
      .container {
        padding-bottom: 20%;
        padding-top: 10%;
      }
    `;
    const matches = scanCss('container.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });
});
