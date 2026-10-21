import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  SLIDER_GUIDE_HASH,
  sliderJsMatcher,
  sliderJsRule,
  sliderPackageMatcher,
  sliderPackageRule,
  sliderRules,
} from './slider.ts';

void test('slider: rule metadata', () => {
  assert.equal(sliderPackageRule.id, 'slider/package-slider');
  assert.equal(sliderPackageRule.guideId, 'slider');
  assert.equal(sliderPackageRule.guideHash, SLIDER_GUIDE_HASH);
  assert.equal(SLIDER_GUIDE_HASH.length, 12);

  assert.equal(sliderJsRule.id, 'slider/js-slider');
  assert.equal(sliderJsRule.guideId, 'slider');
  assert.equal(sliderJsRule.guideHash, SLIDER_GUIDE_HASH);

  assert.equal(sliderRules.length, 2);
  assert.ok(sliderPackageRule.phase2Rubric.keepWhen.length >= 1);
  assert.ok(sliderPackageRule.phase2Rubric.dropWhen.length >= 2);
  assert.ok(sliderJsRule.phase2Rubric.keepWhen.length >= 2);
  assert.ok(sliderJsRule.phase2Rubric.dropWhen.length >= 2);
});

void test('slider dependency matcher', async (t) => {
  await t.test('flags nouislider, rc-slider, and ion-rangeslider', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          nouislider: '^15.7.1',
          'rc-slider': '^10.5.0',
          'ion-rangeslider': '^2.3.1',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [sliderPackageMatcher]);
    assert.equal(matches.length, 3);
  });

  await t.test('exempts unrelated packages', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          lodash: '^4.17.21',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [sliderPackageMatcher]);
    assert.equal(matches.length, 0);
  });
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
