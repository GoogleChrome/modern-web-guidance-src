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

  await t.test('exempts vertical sliders, pips, tooltips, formatters, non-linear ranges, and library docs', () => {
    const code = `
      noUiSlider.create(el1, {
        start: [75],
        orientation: 'vertical',
        range: { min: [0], max: [100] },
      });
      noUiSlider.create(el2, {
        start: [20],
        range: { min: [60, 60], '30%': [3600, 3600], max: 31536000 },
        pips: { mode: 'values', values: [60, 3600], density: 4 },
      });
      noUiSlider.create(el3, {
        start: 0,
        tooltips: true,
        range: { min: 0, max: 150 },
        format: { to: (v) => v, from: (v) => v },
      });
    `;
    assert.equal(matchJsRule(sliderJsMatcher, 'advanced-sliders.js', code).length, 0);

    const docCode = `
      noUiSlider.create(rangeSlider, {
        start: [4000],
        range: { min: [2000], max: [10000] },
      });
    `;
    assert.equal(
      matchJsRule(sliderJsMatcher, 'documentation/slider-values/range.js', docCode).length,
      0,
    );
  });
});
