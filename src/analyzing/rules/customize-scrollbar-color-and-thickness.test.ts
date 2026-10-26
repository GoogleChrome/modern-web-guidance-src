import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import type { CssRuleMatcher } from '../schema.ts';
import { customizeScrollbarColorAndThicknessRule } from './customize-scrollbar-color-and-thickness.ts';

const matcher = customizeScrollbarColorAndThicknessRule.matcher as CssRuleMatcher;

void test('customize-scrollbar-color-and-thickness: positive brownfield matches', async (t) => {
  await t.test('flags ::-webkit-scrollbar with custom width when thumb is styled', () => {
    const css = `
      .custom-scroll::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .custom-scroll::-webkit-scrollbar-thumb {
        background: #555;
      }
    `;
    const matches = scanCss('scrollbar.css', css, [matcher]);
    assert.equal(matches.length, 2);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /scrollbar-color/);
  });

  await t.test('flags ::-webkit-scrollbar-thumb background customization', () => {
    const css = `
      .panel::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 4px;
      }
    `;
    const matches = scanCss('panel.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags real-world asciiflow toolbar.module.css fixture', () => {
    const asciiflowCss = `
      .exportPreview::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .exportPreview::-webkit-scrollbar-track {
        background: var(--color-bg);
      }
      .exportPreview::-webkit-scrollbar-thumb {
        background: var(--color-border);
        border: 1px solid var(--color-bg);
      }
    `;
    const matches = scanCss('toolbar.module.css', asciiflowCss, [matcher]);
    assert.equal(matches.length, 2);
  });

  await t.test('flags global scrollbar pseudo-elements when thumb is styled', () => {
    const css = `
      ::-webkit-scrollbar {
        width: 12px;
      }
      ::-webkit-scrollbar-thumb {
        background-color: darkgrey;
        outline: 1px solid slategrey;
      }
    `;
    const matches = scanCss('global.css', css, [matcher]);
    assert.equal(matches.length, 2);
  });
});

void test('customize-scrollbar-color-and-thickness: negative / exempt cases', async (t) => {
  await t.test('exempts stylesheets already using scrollbar-width', () => {
    const css = `
      .scroll-container {
        scrollbar-width: thin;
      }
      .scroll-container::-webkit-scrollbar {
        width: 6px;
      }
      .scroll-container::-webkit-scrollbar-thumb {
        background: #333;
      }
    `;
    const matches = scanCss('modern-width.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts stylesheets already using scrollbar-color', () => {
    const css = `
      :root {
        scrollbar-color: #6969dd #e0e0e0;
      }
      ::-webkit-scrollbar {
        width: 10px;
      }
      ::-webkit-scrollbar-thumb {
        background: #6969dd;
      }
    `;
    const matches = scanCss('modern-color.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts rules that only hide scrollbars via display: none', () => {
    const css = `
      .hide-scroll::-webkit-scrollbar {
        display: none;
      }
    `;
    const matches = scanCss('hide.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts rules that set width: 0 or height: 0 to hide scrollbars', () => {
    const css = `
      .hide-scroll::-webkit-scrollbar {
        width: 0;
        height: 0px;
      }
      .hide-scroll::-webkit-scrollbar-thumb {
        background: transparent;
      }
    `;
    const matches = scanCss('hide-dimensions.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts thumb rules that set background: transparent or none', () => {
    const css = `
      ::-webkit-scrollbar-thumb {
        background: transparent;
        background-color: none;
      }
    `;
    const matches = scanCss('transparent-thumb.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts ::-webkit-scrollbar when stylesheet has no thumb styling', () => {
    const css = `
      .container::-webkit-scrollbar {
        width: 10px;
      }
    `;
    const matches = scanCss('no-thumb.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts rules that only set border-radius or box-shadow without color/thickness', () => {
    const css = `
      .panel::-webkit-scrollbar-thumb {
        border-radius: 4px;
        box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.3);
      }
    `;
    const matches = scanCss('panel.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts rules inside @supports not (scrollbar-width: ...)', () => {
    const css = `
      @supports not (scrollbar-width: thin) {
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-thumb {
          background: #888;
        }
      }
    `;
    const matches = scanCss('supports.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts rules inside a reset stylesheet', () => {
    const css = `
      ::-webkit-scrollbar {
        width: 8px;
      }
      ::-webkit-scrollbar-thumb {
        background: #999;
      }
    `;
    const matches = scanCss('reset.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts scrollbar reset keywords like auto, inherit, and initial', () => {
    const css = `
      .panel::-webkit-scrollbar {
        width: auto;
        height: auto;
      }
      .panel::-webkit-scrollbar-thumb {
        background: inherit;
      }
    `;
    const matches = scanCss('panel.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts non-scrollbar pseudo-elements like button and corner', () => {
    const css = `
      ::-webkit-scrollbar-button {
        width: 10px;
        height: 10px;
      }
      ::-webkit-scrollbar-corner {
        background: #333;
      }
      ::-webkit-scrollbar-thumb {
        background: #888;
      }
    `;
    const matches = scanCss('buttons.css', css, [matcher]);
    // Only the thumb should match, not button or corner
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 9);
  });

  await t.test('exempts image backgrounds on scrollbar thumb', () => {
    const css = `
      .custom::-webkit-scrollbar-thumb {
        background: url('thumb.png') no-repeat;
      }
    `;
    const matches = scanCss('image.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts userchrome.css user agent overrides', () => {
    const css = `
      ::-webkit-scrollbar {
        width: 8px;
      }
      ::-webkit-scrollbar-thumb {
        background: #999;
      }
    `;
    const matches = scanCss('userchrome.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts unrelated CSS rules', () => {
    const css = `
      .card {
        overflow: auto;
        border: 1px solid #ccc;
      }
    `;
    const matches = scanCss('card.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });
});
