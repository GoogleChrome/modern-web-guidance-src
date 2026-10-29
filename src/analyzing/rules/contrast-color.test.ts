import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  contrastColorCssMatcher,
  contrastColorJsMatcher
} from './contrast-color.ts';
void test('contrast-color: positive brownfield matches', async (t) => {
  await t.test('flags YIQ contrast helper function returning black or white', () => {
    const code = `
      function getContrastYIQ(hexcolor) {
        const r = parseInt(hexcolor.substr(0,2),16);
        const g = parseInt(hexcolor.substr(2,2),16);
        const b = parseInt(hexcolor.substr(4,2),16);
        const yiq = ((r*299)+(g*587)+(b*114))/1000;
        return (yiq >= 128) ? 'black' : 'white';
      }
    `;
    const matches = matchJsRule(contrastColorJsMatcher, 'contrast.js', code);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /contrast-color\(\)/);
  });

  await t.test('flags relative luminance function returning #000 or #fff', () => {
    const code = `
      export const getTextColor = (red, green, blue) => {
        const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        return luminance > 0.5 ? '#000000' : '#ffffff';
      };
    `;
    const matches = matchJsRule(contrastColorJsMatcher, 'luminance.js', code);
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
    const code = `
      function rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
      }
    `;
    const matches = matchJsRule(contrastColorJsMatcher, 'color.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts canvas image processing luminance calculations', () => {
    const code = `
      function getPixelLuminance(ctx, x, y) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const lum = 0.299 * pixel[0] + 0.587 * pixel[1] + 0.114 * pixel[2];
        return lum > 128 ? 'white' : 'black';
      }
    `;
    const matches = matchJsRule(contrastColorJsMatcher, 'canvasProcessor.js', code);
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

  await t.test('exempts outer module/IIFE wrappers and functions that only return luminance numbers or a single fallback color', () => {
    const code = `
      (function () {
        function getLuminance(r, g, b) {
          return 0.299 * r + 0.587 * g + 0.114 * b;
        }
        function getDefaultColor(bg) {
          if (!bg) return 'black';
          const status = 299;
          return status > 200 ? 'white' : '#525c69';
        }
      })();
    `;
    const matches = matchJsRule(contrastColorJsMatcher, 'bundle.js', code);
    assert.equal(matches.length, 0);
  });
});
