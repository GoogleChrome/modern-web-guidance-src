import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  preciseTextAlignmentCssMatcher,
  preciseTextAlignmentJsMatcher,
  preciseTextAlignmentPackageMatcher
} from './precise-text-alignment.ts';
void test('precise-text-alignment dependency matcher', async (t) => {
  await t.test('flags capsize package', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          capsize: '^1.2.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      preciseTextAlignmentPackageMatcher,
    ]);
    assert.equal(matches.length, 1);
  });

  await t.test('exempts unrelated packages', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          clsx: '^2.0.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      preciseTextAlignmentPackageMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});

void test('precise-text-alignment JS and CSS matchers', async (t) => {
  await t.test('flags createStyleObject and capsize calls', () => {
    const code = `
      import { createStyleObject } from '@capsizecss/core';
      import capsize from 'capsize';

      const headingStyles = createStyleObject({
        capHeight: 24,
        lineGap: 8,
        fontMetrics: interMetrics,
      });
      const badgeStyles = capsize({
        fontSize: 16,
        leading: 20,
        fontMetrics: robotoMetrics,
      });
    `;
    const matches = matchJsRule(preciseTextAlignmentJsMatcher, 'typography.ts', code);
    assert.equal(matches.length, 2);
  });

  await t.test('flags legacy draft leading-trim CSS declarations without text-box-trim', () => {
    const css = `
      .badge {
        leading-trim: both;
        text-edge: cap alphabetic;
      }
    `;
    const matches = scanCss('badge.css', css, [preciseTextAlignmentCssMatcher]);
    assert.equal(matches.length, 1);
  });

  await t.test('exempts CSS rules that already declare standard text-box or text-box-trim and local capsize functions', () => {
    const css = `
      .badge {
        leading-trim: both;
        text-box: trim-both cap alphabetic;
      }
    `;
    const matches = scanCss('modern-badge.css', css, [
      preciseTextAlignmentCssMatcher,
    ]);
    assert.equal(matches.length, 0);
    const code = `
      function capsize(opts: { capHeight: number }) { return opts; }
      capsize({ capHeight: 16 });
      const { createStyleObject } = customTheme;
      createStyleObject({ capHeight: 20, lineGap: 4 });
    `;
    const jsMatches = matchJsRule(preciseTextAlignmentJsMatcher, 'local-capsize.ts', code);
    assert.equal(jsMatches.length, 0);
  });

  await t.test('exempts React Native precomputeValues and files that already define CSS leading-trim / --cap-height-scale, while still flagging unrelated fallback branches', () => {
    const rnCode = `
      import { precomputeValues } from '@capsizecss/core';
      const values = precomputeValues({ fontSize: 16, fontMetrics: interMetrics });
    `;
    assert.equal(
      matchJsRule(preciseTextAlignmentJsMatcher, 'typography.native.js', rnCode).length,
      0,
    );

    const pluginCode = `
      import { createStyleObject } from '@capsizecss/core';
      export function setup({ mode = 'modern' } = {}) {
        if (mode === 'classic') {
          return createStyleObject({ fontMetrics: config, fontSize: 16, leading: 24 });
        }
        return { '--cap-height-scale': '0.72' };
      }
    `;
    assert.equal(
      matchJsRule(preciseTextAlignmentJsMatcher, 'plugin.ts', pluginCode).length,
      0,
    );

    const fallbackThemeCode = `
      import capsize from 'capsize';
      export function getHeadingStyle(useFallbackTheme: boolean) {
        if (useFallbackTheme) {
          return capsize({ fontMetrics: robotoMetrics, fontSize: 16, leading: 24 });
        }
        return {};
      }
    `;
    assert.equal(
      matchJsRule(preciseTextAlignmentJsMatcher, 'theme.ts', fallbackThemeCode).length,
      1,
    );
  });
});
