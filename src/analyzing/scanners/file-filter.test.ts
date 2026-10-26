import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DOCS_AND_TESTS_DIR_SEGMENTS,
  hasVendoredLicenseHeader,
  isDocsOrTestsPath,
  isExcludedCorpusNonAppPath,
  isIgnoredPath,
  isMinifiedContent,
  isVendoredOrGeneratedPath,
  shouldScanFile,
} from './file-filter.ts';

describe('file-filter vendored and hashed asset exclusions (R42, R51)', () => {
  it('excludes unminified vendored library filenames regardless of directory', () => {
    const vendoredFiles = [
      'public/js/bootstrap.js',
      'assets/js/bootstrap.bundle.js',
      'app/assets/javascripts/bootstrap-sprockets.js',
      'static/js/jquery.js',
      'static/js/jquery-ui.js',
      'js/moment.js',
      'js/moment-with-locales.js',
      'js/moment-with-cn.js',
      'js/moment-timezone-with-data.js',
      'lib/dayjs.js',
      'editor/codemirror.js',
      'js/popper.js',
      'js/zepto.js',
      'js/underscore.js',
      'js/lodash.js',
      'js/modernizr.js',
      'js/modernizr.custom.12345.js',
      'js/modernizr-2.8.3.js',
      'js/prism.js',
      'js/highlight.js',
      'js/chosen.jquery.js',
      'js/select2.js',
      'js/select2.full.js',
      'css/chui.android.css',
      'css/chui.ios.css',
      'styles/chui-3.8.5.css',
    ];

    for (const filePath of vendoredFiles) {
      assert.equal(
        isExcludedCorpusNonAppPath(filePath),
        true,
        `expected isExcludedCorpusNonAppPath(${filePath}) to be true`,
      );
      assert.equal(
        isIgnoredPath(filePath),
        true,
        `expected isIgnoredPath(${filePath}) to be true`,
      );
      assert.equal(
        isVendoredOrGeneratedPath(filePath),
        true,
        `expected isVendoredOrGeneratedPath(${filePath}) to be true`,
      );
      assert.equal(
        shouldScanFile(filePath),
        false,
        `expected shouldScanFile(${filePath}) to be false`,
      );
    }
  });

  it('excludes vendored library directory segments', () => {
    const vendoredDirPaths = [
      'src/libs/dayjs/esm/index.js',
      'src/libs/dayjs/plugin/utc.js',
      'static/codemirror/mode/javascript/javascript.js',
      'public/jquery-ui/widgets/dialog.js',
      'public/tinymce/plugins/table/plugin.js',
      'public/ckeditor/plugins/dialog/plugin.js',
      'static/mathjax/es5/tex-mml-chtml.js',
      'docs/dokka/scripts/main.js',
    ];

    for (const filePath of vendoredDirPaths) {
      assert.equal(
        isExcludedCorpusNonAppPath(filePath),
        true,
        `expected isExcludedCorpusNonAppPath(${filePath}) to be true`,
      );
      assert.equal(
        shouldScanFile(filePath),
        false,
        `expected shouldScanFile(${filePath}) to be false`,
      );
    }
  });

  it('excludes framework-published hashed asset directories (/assets/<hex>/)', () => {
    const hashedAssetPaths = [
      'web/assets/a09b59a8/js/bootstrap.js',
      'public/assets/9f8e7d6c/datepicker.js',
      'assets/1a2b3c4d5e6f/app.css',
    ];

    for (const filePath of hashedAssetPaths) {
      assert.equal(
        isExcludedCorpusNonAppPath(filePath),
        true,
        `expected isExcludedCorpusNonAppPath(${filePath}) to be true`,
      );
      assert.equal(
        shouldScanFile(filePath),
        false,
        `expected shouldScanFile(${filePath}) to be false`,
      );
    }
  });

  it('does not exclude normal first-party application files', () => {
    assert.equal(isExcludedCorpusNonAppPath('src/components/Modal.tsx'), false);
    assert.equal(shouldScanFile('src/components/Modal.tsx'), true);

    assert.equal(isExcludedCorpusNonAppPath('app/assets/javascripts/application.js'), false);
    assert.equal(shouldScanFile('app/assets/javascripts/application.js'), true);

    assert.equal(isExcludedCorpusNonAppPath('src/styles/aspect-ratio.css'), false);
    assert.equal(shouldScanFile('src/styles/aspect-ratio.css'), true);
  });

  it('excludes Coolite Datejs and 2-part versioned license headers (Card 004ac0a9d6f8, R51)', () => {
    const cooliteDateJsHeader = [
      '/**',
      ' * @version: 1.0 Alpha-1',
      ' * @author: Coolite Inc. http://www.coolite.com/',
      ' * @date: 2007-12-13',
      ' * @copyright: Copyright (c) 2006-2008, Coolite Inc. (http://www.coolite.com/). All rights reserved.',
      ' * @license: Licensed under The MIT License. See license.txt and http://www.datejs.com/license/.',
      ' */',
      'Date.CultureInfo = { name: "en-US" };',
    ].join('\n');

    assert.equal(hasVendoredLicenseHeader(cooliteDateJsHeader), true);
    assert.equal(shouldScanFile('public/js/date.js', cooliteDateJsHeader), false);

    // Semi-minified Coolite date.js line (2,280 chars/line > 1,200 threshold)
    const semiMinifiedLine = `var DateJs=${'a'.repeat(2280)};`;
    assert.equal(isMinifiedContent(semiMinifiedLine), true);
    assert.equal(shouldScanFile('public/js/date.js', semiMinifiedLine), false);

    // 2-part version with @copyright or Apache license
    const apacheTwoPartHeader = [
      '/*',
      ' * WidgetLib v2.4',
      ' * @copyright 2020 Widget Corp',
      ' * Licensed under the Apache License, Version 2.0',
      ' */',
      'window.WidgetLib = {};',
    ].join('\n');
    assert.equal(hasVendoredLicenseHeader(apacheTwoPartHeader), true);

    // Lighthouse-style first-party Apache 2.0 header without library version marker
    const lighthouseHeaderWithFloatsInBody = [
      '/**',
      ' * @license',
      ' * Copyright 2017 Google LLC',
      ' * SPDX-License-Identifier: Apache-2.0',
      ' */',
      '',
      'export class Logger {',
      '  animation = "fadeInDown 0.3s forwards";',
      '  opacity = 0.26;',
      '}',
    ].join('\n');
    assert.equal(hasVendoredLicenseHeader(lighthouseHeaderWithFloatsInBody), false);
    assert.equal(shouldScanFile('renderer/logger.js', lighthouseHeaderWithFloatsInBody), true);

    // HTML comment format license without version
    const htmlLicenseHeader = [
      '<!--',
      '@license',
      'Copyright 2018 Google LLC',
      'SPDX-License-Identifier: Apache-2.0',
      '-->',
      '<!doctype html>',
      '<html><body>Hello</body></html>',
    ].join('\n');
    assert.equal(hasVendoredLicenseHeader(htmlLicenseHeader), false);
    assert.equal(shouldScanFile('assets/template.html', htmlLicenseHeader), true);
  });

  it('permits multi-line files with large embedded template literals (p90 check)', () => {
    // Normal multi-line code file with 25 lines, where one line has a large template literal
    const normalLines = Array.from({ length: 24 }, (_, i) => `const x${i} = ${i};`);
    const largeTemplateLine = 'const template = `' + '<div class="item">'.repeat(100) + '`;';
    const content = [...normalLines, largeTemplateLine].join('\n');

    assert.equal(isMinifiedContent(content), false);
    assert.equal(shouldScanFile('renderer/components.js', content), true);
  });

  it('correctly classifies build/install vs checked-in vendor directories (Slice C)', () => {
    assert.equal(isVendoredOrGeneratedPath('node_modules/react/index.js'), true);
    assert.equal(isVendoredOrGeneratedPath('dist/bundle.js'), true);
    assert.equal(isVendoredOrGeneratedPath('build/main.js'), true);
    assert.equal(isVendoredOrGeneratedPath('vendor/jquery.fittext.js'), true);
    assert.equal(isVendoredOrGeneratedPath('libs/body-scroll-lock.min.js'), true);

    // shouldScanFile continues to return false for all vendored / minified files
    assert.equal(shouldScanFile('vendor/jquery.fittext.js'), false);
    assert.equal(shouldScanFile('libs/body-scroll-lock.min.js'), false);
    assert.equal(shouldScanFile('node_modules/react/index.js'), false);
    assert.equal(shouldScanFile('dist/bundle.js'), false);
  });

  it('skips docs, examples, demo, test, spec, and fixtures paths and test/spec files (R64)', () => {
    // Check all segments defined in DOCS_AND_TESTS_DIR_SEGMENTS
    const expectedSegments = [
      'docs',
      'doc',
      'examples',
      'example',
      'demo',
      'demos',
      'test',
      'tests',
      '__tests__',
      'spec',
      'specs',
      'fixtures',
      '__fixtures__',
    ];
    for (const seg of expectedSegments) {
      assert.ok(
        DOCS_AND_TESTS_DIR_SEGMENTS.has(seg),
        `expected DOCS_AND_TESTS_DIR_SEGMENTS to contain ${seg}`,
      );
      assert.equal(
        isDocsOrTestsPath(`${seg}/file.ts`),
        true,
        `expected isDocsOrTestsPath(${seg}/file.ts) to be true`,
      );
      assert.equal(
        isDocsOrTestsPath(`sub/${seg}/file.js`),
        true,
        `expected isDocsOrTestsPath(sub/${seg}/file.js) to be true`,
      );
    }

    // Check *.test.* and *.spec.* file patterns
    const testSpecFiles = [
      'src/components/button.test.ts',
      'src/components/button.spec.tsx',
      'src/utils.test.js',
      'src/utils.spec.mjs',
      'button.test.jsx',
      'button.spec.ts',
    ];
    for (const f of testSpecFiles) {
      assert.equal(isDocsOrTestsPath(f), true, `expected isDocsOrTestsPath(${f}) to be true`);
      assert.equal(shouldScanFile(f), false, `expected shouldScanFile(${f}) to be false by default`);
      assert.equal(
        shouldScanFile(f, undefined, { includeDocsAndTests: true }),
        true,
        `expected shouldScanFile(${f}, ..., includeDocsAndTests) to be true`,
      );
    }

    // Non-test, non-docs files relative to target dir are scanned
    assert.equal(isDocsOrTestsPath('src/components/Modal.tsx'), false);
    assert.equal(shouldScanFile('src/components/Modal.tsx'), true);
    assert.equal(isDocsOrTestsPath('app.js'), false);
    assert.equal(shouldScanFile('app.js'), true);

    // "Relative to target dir": if target dir is docs/, a file directly in it has no docs segment
    assert.equal(isDocsOrTestsPath('guide.md'), false);
    assert.equal(isDocsOrTestsPath('index.html'), false);
    // But subdirectories in docs matching excluded segments are still excluded
    assert.equal(isDocsOrTestsPath('examples/button.html'), true);
    assert.equal(isDocsOrTestsPath('demo/index.html'), true);
  });
});
