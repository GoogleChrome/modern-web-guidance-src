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

  await t.test('flags ::-webkit-scrollbar { display: none } and points to scrollbar-width: none', () => {
    const css = `
      .text-prompt {
        cursor: text;
        overflow-x: visible;
      }

      .text-prompt::-webkit-scrollbar {
        display: none;
      }
    `;
    const matches = scanCss('front_end/ui/textPrompt.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 7);
    assert.match(matches[0]?.message ?? '', /scrollbar-width:\s*none/);
  });

  await t.test('flags ::-webkit-scrollbar hiding via zero width or height and points to scrollbar-width: none', () => {
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
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /scrollbar-width:\s*none/);
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

  await t.test('exempts stylesheets already using scrollbar-width: none alongside ::-webkit-scrollbar { display: none }', () => {
    const css = `
      .no-scrollbar {
        scrollbar-width: none;
      }
      .no-scrollbar::-webkit-scrollbar {
        display: none;
        width: 0;
      }
    `;
    const matches = scanCss('modern-none.css', css, [matcher]);
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

  await t.test('exempts image and gradient backgrounds on scrollbar thumb and companion ::-webkit-scrollbar rules', () => {
    const css = `
      .custom::-webkit-scrollbar-thumb {
        background: url('thumb.png') no-repeat;
      }
      ::-webkit-scrollbar {
        width: 10px;
      }
      ::-webkit-scrollbar-thumb {
        background: linear-gradient(to bottom, #888eb0, #7c5dfa);
      }
      .legacy-grad::-webkit-scrollbar-thumb {
        background: -webkit-linear-gradient(top, #888eb0, #7c5dfa);
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #8ed5af;
      }
      .glass::-webkit-scrollbar {
        width: 4px;
      }
      .glass::-webkit-scrollbar-thumb {
        background-color: transparent;
        backdrop-filter: blur(10px);
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

  await t.test('exempts hover-reveal scrollbars (width: 0 with :hover::-webkit-scrollbar) and single-axis >15px or !important dimensions from hidesScrollbar', () => {
    const hoverRevealCss = `
      .card-prompt::-webkit-scrollbar {
        width: 0;
      }
      .card-prompt:hover::-webkit-scrollbar {
        width: 4px;
      }
    `;
    assert.equal(scanCss('cards.css', hoverRevealCss, [matcher]).length, 0);

    const singleAxisLargeCss = `
      .wide-track::-webkit-scrollbar {
        width: 16px;
        height: 0;
      }
    `;
    assert.equal(scanCss('wide.css', singleAxisLargeCss, [matcher]).length, 0);

    const singleAxisImportantCss = `
      .custom-track::-webkit-scrollbar {
        width: 8px !important;
        height: 0;
      }
      .custom-track::-webkit-scrollbar-thumb {
        background: #666 !important;
      }
    `;
    const matches = scanCss('important.css', singleAxisImportantCss, [matcher]);
    assert.equal(matches.length, 2);
    assert.match(matches[0]?.message ?? '', /customize scrollbar appearance/);
  });

  await t.test('exempts standalone :hover thumb rules, :active/:window-inactive states, and inset background-clip thumbs', () => {
    const css = `
      .standalone::-webkit-scrollbar-thumb:hover {
        background: #555;
      }
      ::-webkit-scrollbar-thumb:active {
        background: #333;
      }
      ::-webkit-scrollbar-thumb:window-inactive {
        background: #999;
      }
      .jfk-scrollbar::-webkit-scrollbar-thumb {
        background-color: rgba(0, 0, 0, 0.2);
        background-clip: padding-box;
        border: 4px solid transparent;
      }
      #portfolio::-webkit-scrollbar {
        width: 5px;
      }
      .other-widget::-webkit-scrollbar-thumb {
        background: transparent;
      }
    `;
    const matches = scanCss('states-and-widgets.css', css, [matcher]);
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

  await t.test('exempts bespoke thumb/track shadows, 1px hairline scrollbars, and styled scrollbar-button + track-piece sets', () => {
    const css = `
      #coexpression_legend::-webkit-scrollbar {
        -webkit-appearance: none;
        width: 7px;
      }
      #coexpression_legend::-webkit-scrollbar-thumb {
        border-radius: 4px;
        background-color: rgba(0, 0, 0, .5);
        -webkit-box-shadow: 0 0 1px rgba(255, 255, 255, .5);
      }
      .scrollable::-webkit-scrollbar-thumb {
        background-color: rgba(0, 0, 0, 0.1);
        -webkit-box-shadow: inset 1px 1px 0 rgba(0, 0, 0, 0.10), inset 0 -1px 0 rgba(0, 0, 0, 0.07);
      }
      ul::-webkit-scrollbar {
        width: 10px;
      }
      ul::-webkit-scrollbar-button {
        background: #ebebeb;
        border-radius: 4px;
      }
      ul::-webkit-scrollbar-track-piece {
        background: #ebebeb;
      }
      ul::-webkit-scrollbar-thumb {
        border-radius: 3px;
        background-color: gray;
      }
    `;
    assert.equal(scanCss('bespoke.css', css, [matcher]).length, 0);
  });
});
