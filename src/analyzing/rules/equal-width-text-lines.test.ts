import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  equalWidthTextLinesJsMatcher,
} from './equal-width-text-lines.ts';

void test('equal-width-text-lines JS matcher', async (t) => {
  await t.test('flags fitty call', () => {
    const code = `
      fitty('.lockup-line');
    `;
    const matches = matchJsRule(equalWidthTextLinesJsMatcher, 'poster.js', code);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /text-fit/);
  });

  await t.test('flags jQuery .fitText call', () => {
    const code = `
      $("#bigTitle").fitText(0.6);
      $("#underBigTitle").fitText(2.5);
      $header.fitText();
      $('.content').find('.headline').fitText();
      $('.poster .fit-line').fitText(1.2, { minFontSize: '16px', maxFontSize: '72px' });
    `;
    const matches = matchJsRule(equalWidthTextLinesJsMatcher, 'header.js', code);
    assert.equal(matches.length, 5);
  });

  await t.test('exempts when guarded by CSS.supports for text-fit', () => {
    const code = `
      if (!CSS.supports('text-fit', 'grow per-line-all')) {
        fitty('.lockup-line');
      }
    `;
    const matches = matchJsRule(equalWidthTextLinesJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts unrelated function calls and single line options', () => {
    const code = `
      const bounds = map.fitBounds(coords);
      const formatted = formatText(title);
      fitty('.single-line-badge', { multiLine: false });
      fitty('.single-line-heading', { singleLine: true });
      fitty('.one-liner', { maxLines: 1 });
      fitty(slide.querySelectorAll('.r-fit-text'), { minSize: 20, maxSize: 200 });
      Array.from(slide.querySelectorAll('.r-fit-text')).forEach((el) => {
        fitty(el, { minSize: 24, maxSize: 200 });
      });
      canvas.fitText(ctx, 'heading');
      chart.fitText();
      this.fitText();
      function localHelper() {
        function fitText(str) { return str.trim(); }
        fitText('hello');
      }
    `;
    const matches = matchJsRule(equalWidthTextLinesJsMatcher, 'unrelated.js', code);
    assert.equal(matches.length, 0);

    const singleHeadingClamp = `
      $("h1.responsive-headline").fitText(1.2, { minFontSize: '16px', maxFontSize: '30px' });
    `;
    assert.equal(
      matchJsRule(equalWidthTextLinesJsMatcher, 'single-heading.js', singleHeadingClamp).length,
      0,
    );
  });

  await t.test('exempts when guarded by CSS.supports for text-wrap: balance', () => {
    const code = `
      if (!CSS.supports('text-wrap', 'balance')) {
        fitty('.lockup-line');
      }
    `;
    const matches = matchJsRule(equalWidthTextLinesJsMatcher, 'guarded-wrap.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('handles template imports alongside imported fitty without throwing', () => {
    const code = `
      import { helper } from <%= path %>;
      import fitty from 'fitty';
      fitty('.lockup-line');
    `;
    const matches = matchJsRule(equalWidthTextLinesJsMatcher, 'template-import.js', code);
    assert.equal(matches.length, 1);
  });
});
