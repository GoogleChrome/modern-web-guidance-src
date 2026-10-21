import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hasVendoredLicenseHeader,
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
  });
});
