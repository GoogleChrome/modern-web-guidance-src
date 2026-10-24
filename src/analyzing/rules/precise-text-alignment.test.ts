import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  PRECISE_TEXT_ALIGNMENT_GUIDE_HASH,
  preciseTextAlignmentCssMatcher,
  preciseTextAlignmentCssRule,
  preciseTextAlignmentJsMatcher,
  preciseTextAlignmentJsRule,
  preciseTextAlignmentPackageMatcher,
  preciseTextAlignmentPackageRule,
  preciseTextAlignmentRules,
} from './precise-text-alignment.ts';

void test('precise-text-alignment: rule metadata', () => {
  assert.equal(
    preciseTextAlignmentPackageRule.id,
    'precise-text-alignment/package-capsize',
  );
  assert.equal(
    preciseTextAlignmentPackageRule.guideId,
    'precise-text-alignment',
  );
  assert.equal(
    preciseTextAlignmentPackageRule.guideHash,
    PRECISE_TEXT_ALIGNMENT_GUIDE_HASH,
  );
  assert.equal(PRECISE_TEXT_ALIGNMENT_GUIDE_HASH.length, 12);

  assert.equal(
    preciseTextAlignmentJsRule.id,
    'precise-text-alignment/js-capsize',
  );
  assert.equal(
    preciseTextAlignmentCssRule.id,
    'precise-text-alignment/css-leading-trim',
  );
  assert.equal(preciseTextAlignmentRules.length, 3);
});

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
    const project = createInMemoryProject();
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
    const sourceFile = project.createSourceFile('typography.ts', code);
    const matches = preciseTextAlignmentJsMatcher.matchFile(sourceFile, {
      filePath: 'typography.ts',
      fileContent: code,
    });
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

    const project = createInMemoryProject();
    const code = `
      function capsize(opts: { capHeight: number }) { return opts; }
      capsize({ capHeight: 16 });
      const { createStyleObject } = customTheme;
      createStyleObject({ capHeight: 20, lineGap: 4 });
    `;
    const sourceFile = project.createSourceFile('local-capsize.ts', code);
    const jsMatches = preciseTextAlignmentJsMatcher.matchFile(sourceFile, {
      filePath: 'local-capsize.ts',
      fileContent: code,
    });
    assert.equal(jsMatches.length, 0);
  });
});
