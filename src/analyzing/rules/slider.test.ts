import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  SLIDER_GUIDE_HASH,
  sliderJsMatcher,
  sliderJsRule,
  sliderRules,
} from './slider.ts';

void test('slider: rule metadata', () => {
  assert.equal(SLIDER_GUIDE_HASH.length, 12);

  assert.equal(sliderJsRule.id, 'slider/js-slider');
  assert.equal(sliderJsRule.guideId, 'slider');
  assert.equal(sliderJsRule.guideHash, SLIDER_GUIDE_HASH);

  assert.equal(sliderRules.length, 1);
  assert.ok(sliderJsRule.verifierRubric.keepWhen.length >= 2);
  assert.ok(sliderJsRule.verifierRubric.dropWhen.length >= 2);
});

void test('slider JS matcher', async (t) => {
  await t.test('flags single-handle noUiSlider.create calls (number and 1-element array)', () => {
    const project = createInMemoryProject();
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
    const sourceFile = project.createSourceFile('slider.js', code);
    const matches = sliderJsMatcher.matchFile(sourceFile, {
      filePath: 'slider.js',
      fileContent: code,
    });
    assert.equal(matches.length, 2);
  });

  await t.test('exempts multi-handle range sliders (e.g. start: [20, 80])', () => {
    const project = createInMemoryProject();
    const code = `
      import noUiSlider from 'nouislider';
      noUiSlider.create(priceRangeEl, {
        start: [20, 80],
        connect: true,
        range: { min: 0, max: 100 },
      });
    `;
    const sourceFile = project.createSourceFile('multi-range.js', code);
    const matches = sliderJsMatcher.matchFile(sourceFile, {
      filePath: 'multi-range.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts unrelated .create() calls and local shadowed noUiSlider', () => {
    const project = createInMemoryProject();
    const code = `
      Object.create(null);
      widget.create(el, { start: 10 });
      const { noUiSlider } = localMock;
      noUiSlider.create(el, { start: 50 });
    `;
    const sourceFile = project.createSourceFile('unrelated.js', code);
    const matches = sliderJsMatcher.matchFile(sourceFile, {
      filePath: 'unrelated.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
