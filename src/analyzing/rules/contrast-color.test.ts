import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  CONTRAST_COLOR_GUIDE_HASH,
  contrastColorCssMatcher,
  contrastColorCssRule,
  contrastColorJsMatcher,
  contrastColorJsRule,
  contrastColorRule,
  contrastColorRules,
} from './contrast-color.ts';

void test('contrast-color: rule metadata', () => {
  assert.equal(contrastColorRule.id, 'contrast-color/js');
  assert.equal(contrastColorRule.guideId, 'contrast-color');
  assert.equal(contrastColorRule.guideHash, CONTRAST_COLOR_GUIDE_HASH);
  assert.equal(CONTRAST_COLOR_GUIDE_HASH.length, 12);
  assert.equal(contrastColorRules.length, 2);
  assert.ok(contrastColorJsRule.verifierRubric.keepWhen.length >= 1);
  assert.ok(contrastColorJsRule.verifierRubric.dropWhen.length >= 2);
  assert.ok(contrastColorCssRule.verifierRubric.keepWhen.length >= 1);
  assert.ok(contrastColorCssRule.verifierRubric.dropWhen.length >= 2);
});

void test('contrast-color: positive brownfield matches', async (t) => {
  await t.test('flags YIQ contrast helper function returning black or white', () => {
    const project = createInMemoryProject();
    const code = `
      function getContrastYIQ(hexcolor) {
        const r = parseInt(hexcolor.substr(0,2),16);
        const g = parseInt(hexcolor.substr(2,2),16);
        const b = parseInt(hexcolor.substr(4,2),16);
        const yiq = ((r*299)+(g*587)+(b*114))/1000;
        return (yiq >= 128) ? 'black' : 'white';
      }
    `;
    const sourceFile = project.createSourceFile('contrast.js', code);
    const matches = contrastColorJsMatcher.matchFile(sourceFile, {
      filePath: 'contrast.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /contrast-color\(\)/);
  });

  await t.test('flags relative luminance function returning #000 or #fff', () => {
    const project = createInMemoryProject();
    const code = `
      export const getTextColor = (red, green, blue) => {
        const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        return luminance > 0.5 ? '#000000' : '#ffffff';
      };
    `;
    const sourceFile = project.createSourceFile('luminance.js', code);
    const matches = contrastColorJsMatcher.matchFile(sourceFile, {
      filePath: 'luminance.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags CSS Relative Color Syntax threshold calculation', () => {
    const css = `
      .badge {
        --threshold: 0.623;
        color: oklch(from var(--badge-bg) max(0, sign(var(--threshold) - l)) 0 h);
      }
    `;
    const matches = scanCss('badge.css', css, [contrastColorCssMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /contrast-color\(\)/);
  });
});

void test('contrast-color: negative / exempt cases', async (t) => {
  await t.test('exempts standard color formatting functions not returning contrast color', () => {
    const project = createInMemoryProject();
    const code = `
      function rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
      }
    `;
    const sourceFile = project.createSourceFile('color.js', code);
    const matches = contrastColorJsMatcher.matchFile(sourceFile, {
      filePath: 'color.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts canvas image processing luminance calculations', () => {
    const project = createInMemoryProject();
    const code = `
      function getPixelLuminance(ctx, x, y) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const lum = 0.299 * pixel[0] + 0.587 * pixel[1] + 0.114 * pixel[2];
        return lum > 128 ? 'white' : 'black';
      }
    `;
    const sourceFile = project.createSourceFile('canvasProcessor.js', code);
    const matches = contrastColorJsMatcher.matchFile(sourceFile, {
      filePath: 'canvasProcessor.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts CSS declaring standard colors', () => {
    const css = `
      .badge {
        color: #ffffff;
        background-color: #2563eb;
      }
    `;
    const matches = scanCss('static.css', css, [contrastColorCssMatcher]);
    assert.equal(matches.length, 0);
  });
});
