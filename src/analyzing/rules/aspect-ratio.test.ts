import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { scanHtml } from '../scanners/dom-scanner.ts';
import type { CssRuleMatcher, DomRuleMatcher } from '../schema.ts';
import {
  aspectRatioCssMatcher,
  aspectRatioCssRule,
  aspectRatioDomMatcher,
  aspectRatioDomRule,
  aspectRatioRule,
  aspectRatioRules,
} from './aspect-ratio.ts';

const cssRules: readonly CssRuleMatcher[] = [aspectRatioCssMatcher];
const domRules: readonly DomRuleMatcher[] = [aspectRatioDomMatcher];

describe('aspectRatioCssRule (aspect-ratio/css-padding-hack)', () => {
  it('exports empty aspectRatioRules after retirement while preserving named rules', () => {
    assert.equal(aspectRatioRules.length, 0);
    assert.equal(aspectRatioRule, aspectRatioCssRule);
    assert.equal(aspectRatioCssRule.id, 'aspect-ratio/css-padding-hack');
    assert.equal(aspectRatioDomRule.id, 'aspect-ratio/dom-intrinsic-dimensions');
  });

  it('flags classic padding-bottom: 56.25% + height: 0 hack', () => {
    const css = `
      .video-wrapper {
        position: relative;
        width: 100%;
        height: 0;
        padding-bottom: 56.25%;
      }
      .video-wrapper iframe {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
    `;
    const matches = scanCss('src/video.css', css, cssRules);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  it('flags ::before pseudo-element padding-top percentage hack', () => {
    const css = `
      .aspect-box::before {
        content: "";
        display: block;
        padding-top: 75%;
      }
    `;
    const matches = scanCss('src/aspect.css', css, cssRules);
    assert.equal(matches.length, 1);
  });

  it('flags calc() percentage padding hack with position: relative', () => {
    const css = `
      .ratio-16x9 {
        position: relative;
        padding-top: calc(9 / 16 * 100%);
      }
    `;
    const matches = scanCss('src/ratio.css', css, cssRules);
    assert.equal(matches.length, 1);
  });

  it('ignores normal pixel or rem padding', () => {
    const css = `
      .section {
        padding-top: 24px;
        padding-bottom: 2rem;
      }
    `;
    const matches = scanCss('src/section.css', css, cssRules);
    assert.equal(matches.length, 0);
  });

  it('ignores ordinary flow spacing percentage without aspect-ratio hack signals', () => {
    const css = `
      .article-body {
        padding-bottom: 5%;
      }
    `;
    const matches = scanCss('src/article.css', css, cssRules);
    assert.equal(matches.length, 0);
  });

  it('exempts stylesheets that already declare aspect-ratio', () => {
    const css = `
      .video-wrapper {
        aspect-ratio: 16 / 9;
        padding-bottom: 56.25%;
        height: 0;
      }
    `;
    const matches = scanCss('src/modern.css', css, cssRules);
    assert.equal(matches.length, 0);
  });
});

describe('aspectRatioDomRule (aspect-ratio/dom-intrinsic-dimensions)', () => {
  it('ignores bare <img width="800" height="600"> without responsive height: auto CSS', () => {
    const html = `
      <img src="/hero.jpg" width="800" height="600" alt="Hero">
    `;
    const matches = scanHtml('index.html', html, domRules);
    assert.equal(matches.length, 0);
  });

  it('flags <img width="800" height="600"> when paired with width: 100%; height: auto in the same file', () => {
    const html = `
      <style>
        img {
          max-width: 100%;
          height: auto;
        }
      </style>
      <img src="/hero.jpg" width="800" height="600" alt="Hero">
    `;
    const matches = scanHtml('index.html', html, domRules);
    assert.equal(matches.length, 1);
  });

  it('ignores <img> when document already declares aspect-ratio', () => {
    const html = `
      <style>
        img {
          max-width: 100%;
          height: auto;
          aspect-ratio: attr(width) / attr(height);
        }
      </style>
      <img src="/hero.jpg" width="800" height="600" alt="Hero">
    `;
    const matches = scanHtml('index.html', html, domRules);
    assert.equal(matches.length, 0);
  });
});
