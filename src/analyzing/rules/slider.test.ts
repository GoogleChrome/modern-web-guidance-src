import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  sliderJsMatcher
} from './slider.ts';
void test('slider JS matcher', async (t) => {
  await t.test('flags single-handle noUiSlider.create calls (number and 1-element array)', () => {
    const code = `
      import noUiSlider from 'nouislider';
      noUiSlider.create(volumeEl, {
        start: 70,
        range: { min: 0, max: 100 },
      });
      window.noUiSlider.create(brightnessEl, {
        start: [50],
        range: { min: 0, max: 100 },
      });
    `;
    const matches = matchJsRule(sliderJsMatcher, 'slider.js', code);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts multi-handle range sliders (e.g. start: [20, 80])', () => {
    const code = `
      import noUiSlider from 'nouislider';
      noUiSlider.create(priceRangeEl, {
        start: [20, 80],
        connect: true,
        range: { min: 0, max: 100 },
      });
    `;
    const matches = matchJsRule(sliderJsMatcher, 'multi-range.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts unrelated .create() calls and local shadowed noUiSlider', () => {
    const code = `
      Object.create(null);
      widget.create(el, { start: 10 });
      const { noUiSlider } = localMock;
      noUiSlider.create(el, { start: 50 });
    `;
    const matches = matchJsRule(sliderJsMatcher, 'unrelated.js', code);
    assert.equal(matches.length, 0);
  });
});
