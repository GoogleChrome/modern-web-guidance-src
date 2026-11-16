import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';
import { SyntaxKind } from 'ts-morph';
import type { AnalyzerRule } from '../schema.ts';
import {
  BUILD_OR_INSTALL_DIR_SEGMENTS,
  DOCS_AND_TESTS_DIR_SEGMENTS,
  hasVendoredLicenseHeader,
  isBuildOrInstallPath,
  isCorpusNonAppPath,
  isDocsOrTestsPath,
  isExcludedCorpusNonAppPath,
  isMinifiedContent,
  isVendoredOrGeneratedPath,
  shouldScanFile,
} from './file-filter.ts';
import { scanRepoFiles } from './index.ts';

const execFileAsync = promisify(execFile);

describe('file-filter vendored and hashed asset exclusions', () => {
  it('excludes unminified vendored library filenames regardless of directory', async (t) => {
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
      await t.test(filePath, () => {
        assert.equal(isExcludedCorpusNonAppPath(filePath), true);
        assert.equal(isVendoredOrGeneratedPath(filePath), true);
        assert.equal(shouldScanFile(filePath), false);
      });
    }
  });

  it('excludes vendored library directory segments', async (t) => {
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
      await t.test(filePath, () => {
        assert.equal(isExcludedCorpusNonAppPath(filePath), true);
        assert.equal(shouldScanFile(filePath), false);
      });
    }
  });

  it('excludes framework-published hashed asset directories (/assets/<hex>/)', async (t) => {
    const hashedAssetPaths = [
      'web/assets/a09b59a8/js/bootstrap.js',
      'public/assets/9f8e7d6c/datepicker.js',
      'assets/1a2b3c4d5e6f/app.css',
    ];

    for (const filePath of hashedAssetPaths) {
      await t.test(filePath, () => {
        assert.equal(isExcludedCorpusNonAppPath(filePath), true);
        assert.equal(shouldScanFile(filePath), false);
      });
    }
  });

  it('does not exclude normal first-party application files', () => {
    assert.equal(isExcludedCorpusNonAppPath('src/components/Modal.tsx'), false);
    assert.equal(shouldScanFile('src/components/Modal.tsx'), true);

    assert.equal(isExcludedCorpusNonAppPath('app/assets/javascripts/application.js'), false);
    assert.equal(shouldScanFile('app/assets/javascripts/application.js'), true);

    assert.equal(isExcludedCorpusNonAppPath('src/styles/aspect-ratio.css'), false);
    assert.equal(shouldScanFile('src/styles/aspect-ratio.css'), true);

    assert.equal(isExcludedCorpusNonAppPath('src/styles/theme.scss'), false);
    assert.equal(shouldScanFile('src/styles/theme.scss'), true);
    assert.equal(shouldScanFile('src/styles/theme.less'), true);

    assert.equal(shouldScanFile('src/styles/theme.min.scss'), false);
    assert.equal(shouldScanFile('src/styles/theme.bundle.scss'), false);
    assert.equal(shouldScanFile('src/styles/theme.min.less'), false);
    assert.equal(shouldScanFile('src/styles/theme.bundle.less'), false);
  });

  it('excludes Coolite Datejs and 2-part versioned license headers (Card 004ac0a9d6f8)', () => {
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

  it('skips docs, examples, demo, test, spec, and fixtures paths and test/spec files', async (t) => {
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
      'testing',
      'e2e',
    ];
    for (const seg of expectedSegments) {
      await t.test(`segment: ${seg}`, () => {
        assert.ok(DOCS_AND_TESTS_DIR_SEGMENTS.has(seg));
        assert.equal(isDocsOrTestsPath(`${seg}/file.ts`), true);
        assert.equal(isDocsOrTestsPath(`sub/${seg}/file.js`), true);
      });
    }

    // Check *_test_runner dir segments and testrunner / tests filenames
    const testRunnerAndTestsFiles = [
      'front_end/legacy_test_runner/test_runner/TestRunner.ts',
      'front_end/legacy_test_runner/helper.ts',
      'front_end/legacy_test_runner/bindings_test_runner/AutomappingTestRunner.js',
      'front_end/legacy_test_runner/console_test_runner/console_test_runner.js',
      'front_end/integration_test_runner.html',
      'front_end/Tests.js',
      'extensions/cxx_debugging/e2e/OptionsPageTests.ts',
      'src/FooTestRunner.ts',
      'src/foo_test_runner.ts',
      'TestRunner.js',
      'BindingsTestRunner.js',
      'console_test_runner.js',
      'run-tests.js',
      'setupTests.js',
      'keeper.tests.ts',
      'tests.js',
      'Scripts/testrunner.ts',
      'src/DOMTests.ts',
    ];
    for (const f of testRunnerAndTestsFiles) {
      await t.test(`test-runner/tests path: ${f}`, () => {
        assert.equal(isDocsOrTestsPath(f), true);
        assert.equal(shouldScanFile(f), false);
        assert.equal(shouldScanFile(f, undefined, { includeDocsAndTests: true }), true);
      });
    }

    // Check *.test.* and *.spec.* file patterns, including standalone test.js/ts and spec.js/ts
    const testSpecFiles = [
      'src/components/button.test.ts',
      'src/components/button.spec.tsx',
      'src/utils.test.js',
      'src/utils.spec.mjs',
      'button.test.jsx',
      'button.spec.ts',
      'test.js',
      'test.ts',
      'spec.js',
      'spec.ts',
      'src/test.js',
      'src/utils/test.ts',
      'lib/spec.js',
    ];
    for (const f of testSpecFiles) {
      await t.test(`test/spec file: ${f}`, () => {
        assert.equal(isDocsOrTestsPath(f), true);
        assert.equal(shouldScanFile(f), false);
        assert.equal(shouldScanFile(f, undefined, { includeDocsAndTests: true }), true);
      });
    }

    // Lookalike names that are not test/spec files
    assert.equal(isDocsOrTestsPath('test-utils.ts'), false);
    assert.equal(isDocsOrTestsPath('src/testing.js'), false);
    assert.equal(isDocsOrTestsPath('special.js'), false);
    assert.equal(isDocsOrTestsPath('contest.js'), false);
    assert.equal(isDocsOrTestsPath('contests.js'), false);
    assert.equal(isDocsOrTestsPath('src/contests.js'), false);
    assert.equal(isDocsOrTestsPath('src/protests.ts'), false);
    assert.equal(isDocsOrTestsPath('src/retests.ts'), false);
    assert.equal(isDocsOrTestsPath('src/latestrunner.ts'), false);
    assert.equal(isDocsOrTestsPath('src/fastestrunner.js'), false);
    assert.equal(isDocsOrTestsPath('src/contestRunner.ts'), false);
    assert.equal(isDocsOrTestsPath('src/CONTESTS.JS'), false);

    // Minified files under docs/test are never scannable even with includeDocsAndTests: true
    assert.equal(
      shouldScanFile('docs/bundle.min.js', undefined, { includeDocsAndTests: true }),
      false,
    );
    assert.equal(
      shouldScanFile('test/vendor.min.css', undefined, { includeDocsAndTests: true }),
      false,
    );

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

  it('filters build, vendor, generated, and corpus non-app paths', () => {
    assert.equal(isVendoredOrGeneratedPath('node_modules/foo/index.js'), true);
    assert.equal(isVendoredOrGeneratedPath('dist/bundle.js'), true);
    assert.equal(isVendoredOrGeneratedPath('vendor/assets/app.js'), true);
    assert.equal(isVendoredOrGeneratedPath('src/utils/math.min.js'), true);
    assert.equal(isVendoredOrGeneratedPath('src/types/index.d.ts'), true);
    assert.equal(isVendoredOrGeneratedPath('.worktrees/feature/index.js'), true);
    assert.equal(isVendoredOrGeneratedPath('.worktree/test.js'), true);
    assert.equal(isVendoredOrGeneratedPath('.venv/lib/python.js'), true);
    assert.equal(isVendoredOrGeneratedPath('venv/lib/python.js'), true);
    assert.equal(isVendoredOrGeneratedPath('.nyc_output/coverage.json'), true);
    assert.equal(isVendoredOrGeneratedPath('test-results/report.html'), true);
    assert.equal(isVendoredOrGeneratedPath('playwright-report/index.html'), true);
    assert.equal(isVendoredOrGeneratedPath('src/components/Dialog.tsx'), false);
    assert.equal(isVendoredOrGeneratedPath('views/login.blade.php'), false);

    for (const p of [
      'docs/3.1/reference/index.html',
      'content/zh-cn/docs/setup.html',
      'website/docs/intro.md',
      'site/pages/index.html',
      'gh-pages/index.html',
    ]) {
      assert.equal(isVendoredOrGeneratedPath(p), false);
      assert.equal(isVendoredOrGeneratedPath(p, { excludeCorpusNonAppDirs: true }), true);
    }
  });

  it('detects minified content and ignores long data URIs or inline SVGs in multi-line files', () => {
    assert.equal(isMinifiedContent('const a = 1;\nconst b = 2;\n'), false);
    assert.equal(isMinifiedContent(`const x = "${'a'.repeat(6000)}";`), true);

    const fileWithDataUri =
      Array.from({ length: 30 }, (_, i) => `.class-${i} { color: red; }`).join('\n') +
      `\n.icon { background-image: url('data:image/svg+xml;utf8,${'a'.repeat(2000)}'); }\n`;
    assert.equal(isMinifiedContent(fileWithDataUri), false);

    const fileWithSvg =
      Array.from({ length: 30 }, (_, i) => `// line ${i}`).join('\n') +
      `\nconst icon = '<svg viewBox="0 0 100 100">${'path '.repeat(500)}</svg>';\n`;
    assert.equal(isMinifiedContent(fileWithSvg), false);

    const minifiedWithEmbeddedDataUri =
      'const a = 1; ' +
      'var x = 0; '.repeat(100) +
      'const data = "data:application/octet-stream;base64,AAAA"; ' +
      'var y = 2; '.repeat(100);
    assert.equal(isMinifiedContent(minifiedWithEmbeddedDataUri), true);
  });

  it('detects third-party license headers with semver and respects ownNames', () => {
    const thirdPartyHeader = `/*!
 * jQuery JavaScript Library v3.6.0
 * https://jquery.com/
 * Includes Sizzle.js
 * Copyright OpenJS Foundation and other contributors
 * Released under the MIT license
 */
(function() { return 1; })();`;

    assert.equal(hasVendoredLicenseHeader(thirdPartyHeader), true);
    assert.equal(hasVendoredLicenseHeader(thirdPartyHeader, { ownNames: ['jquery'] }), false);
    assert.equal(
      hasVendoredLicenseHeader(
        `// Copyright 2026 The Authors. All rights reserved.\nconst x = 10;\n`,
      ),
      false,
    );
  });

  it('rejects files exceeding 1 MB source cap', () => {
    assert.equal(shouldScanFile('src/small.js', 'const x = 1;\n'.repeat(100)), true);
    assert.equal(shouldScanFile('src/bundle.js', 'a'.repeat(1_000_001)), false);
  });
});

describe('file-filter and repository scanning: agent dot-dirs, .gitignore, and walker fallback', () => {
  const scanMeRule: AnalyzerRule = {
    id: 'test-scan-me',
    guideId: 'test-guide',
    guideHash: '0123456789ab',
    summary: 'Flags scanMe calls for file discovery testing',
    verifierRubric: { keepWhen: ['calls'], dropWhen: [] },
    matcher: {
      kind: 'js',
      fastTokens: ['scanMe'],
      matchFile: (sourceFile) => {
        const matches = [];
        for (const descendant of sourceFile.getDescendants()) {
          if (
            descendant.getKind() === SyntaxKind.Identifier &&
            descendant.getText() === 'scanMe'
          ) {
            matches.push({
              line: descendant.getStartLineNumber(),
              message: 'scanMe called',
            });
          }
        }
        return matches;
      },
    },
  };

  async function withTempDir(
    prefix: string,
    fn: (tempDir: string) => Promise<void>,
  ): Promise<void> {
    const tempDir = await mkdtemp(join(tmpdir(), prefix));
    try {
      await fn(tempDir);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  async function initGitRepo(dir: string): Promise<void> {
    await execFileAsync('git', ['init', '-q'], { cwd: dir });
  }

  async function gitCommit(dir: string, message: string): Promise<void> {
    await execFileAsync(
      'git',
      ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', message],
      { cwd: dir },
    );
  }

  it('excludes all dot-directories without hardcoding them in BUILD_OR_INSTALL_DIR_SEGMENTS', async (t) => {
    for (const dir of BUILD_OR_INSTALL_DIR_SEGMENTS) {
      assert.equal(
        dir.startsWith('.'),
        false,
        `BUILD_OR_INSTALL_DIR_SEGMENTS should not hardcode dot-directory ${dir}`,
      );
    }

    const dotDirPaths = [
      '.agents/skills/impeccable/scripts/live-browser.js',
      '.claude/skills/foo.js',
      '.gemini/skills/helper.ts',
      '.cursor/rules/style.js',
      '.codex/skills/runner.js',
      '.antigravitycli/scripts/automation.mjs',
      '.vscode/settings.json',
      '.github/workflows/ci.js',
      '.storybook/preview.js',
      '.vitepress/theme/index.ts',
      'src/.cache/chunk.js',
      './.hidden/secret.js',
    ];

    for (const p of dotDirPaths) {
      await t.test(`excludes ${p}`, () => {
        assert.equal(isVendoredOrGeneratedPath(p), true);
        assert.equal(isBuildOrInstallPath(p), true);
        assert.equal(shouldScanFile(p), false);
      });
    }

    assert.equal(shouldScanFile('src/components/button.tsx'), true);
    // Relative '.' and '..' segments and root dotfiles are not dot-directories
    assert.equal(isBuildOrInstallPath('./src/components/button.tsx'), false);
    assert.equal(shouldScanFile('./src/components/button.tsx'), true);
    assert.equal(isBuildOrInstallPath('../src/components/button.tsx'), false);
    assert.equal(shouldScanFile('../src/components/button.tsx'), true);
    assert.equal(isBuildOrInstallPath('.eslintrc.js'), false);
    assert.equal(shouldScanFile('.eslintrc.js'), true);
    assert.equal(isCorpusNonAppPath('.agents/skills/foo.js'), false);
  });

  it('ignores custom gitignored build directories via git ls-files while scanning untracked non-ignored files', async () => {
    await withTempDir('git-ignore-discovery-', async (tempDir) => {
      await initGitRepo(tempDir);
      await writeFile(join(tempDir, '.gitignore'), 'custom-build-out/\n');
      await mkdir(join(tempDir, 'custom-build-out'), { recursive: true });
      await mkdir(join(tempDir, 'src'), { recursive: true });

      await writeFile(
        join(tempDir, 'custom-build-out', 'leaked.js'),
        'function leak() { scanMe(); }',
      );
      await writeFile(
        join(tempDir, 'src', 'app.js'),
        'function app() { scanMe(); }',
      );

      await execFileAsync('git', ['add', '.gitignore', 'src/app.js'], { cwd: tempDir });
      await gitCommit(tempDir, 'initial commit');

      await writeFile(
        join(tempDir, 'src', 'untracked.js'),
        'function untracked() { scanMe(); }',
      );

      const findings = await scanRepoFiles(tempDir, [scanMeRule]);

      assert.deepEqual(
        findings.map((f) => f.file).sort(),
        ['src/app.js', 'src/untracked.js'],
      );
    });
  });

  it('handles tracked files deleted from disk gracefully without throwing ENOENT', async () => {
    await withTempDir('git-deleted-discovery-', async (tempDir) => {
      await initGitRepo(tempDir);
      await mkdir(join(tempDir, 'src'), { recursive: true });

      await writeFile(
        join(tempDir, 'src', 'deleted.js'),
        'function deleted() { scanMe(); }',
      );
      await writeFile(
        join(tempDir, 'src', 'kept.js'),
        'function kept() { scanMe(); }',
      );

      await execFileAsync('git', ['add', '.'], { cwd: tempDir });
      await gitCommit(tempDir, 'initial commit');

      // Remove tracked file from disk so git ls-files still lists it in the index
      await rm(join(tempDir, 'src', 'deleted.js'));

      const findings = await scanRepoFiles(tempDir, [scanMeRule]);

      assert.deepEqual(findings.map((f) => f.file), ['src/kept.js']);
    });
  });

  it('falls back to filesystem walker in non-git directory while skipping dot-dirs and build output', async () => {
    await withTempDir('non-git-discovery-', async (tempDir) => {
      await mkdir(join(tempDir, 'src'), { recursive: true });
      await mkdir(join(tempDir, 'dist'), { recursive: true });
      await mkdir(join(tempDir, '.agents', 'skills'), { recursive: true });
      await mkdir(join(tempDir, '.custom-cache'), { recursive: true });

      await writeFile(
        join(tempDir, 'src', 'app.js'),
        'function app() { scanMe(); }',
      );
      await writeFile(
        join(tempDir, 'dist', 'bundle.js'),
        'function bundle() { scanMe(); }',
      );
      await writeFile(
        join(tempDir, '.agents', 'skills', 'tool.js'),
        'function tool() { scanMe(); }',
      );
      await writeFile(
        join(tempDir, '.custom-cache', 'cached.js'),
        'function cached() { scanMe(); }',
      );

      const findings = await scanRepoFiles(tempDir, [scanMeRule]);

      assert.deepEqual(findings.map((f) => f.file), ['src/app.js']);
    });
  });

  it('falls back to directory walker when target directory is inside a gitignored folder of enclosing git repo', async () => {
    await withTempDir('git-enclosing-repo-', async (enclosingRepo) => {
      await initGitRepo(enclosingRepo);
      await writeFile(join(enclosingRepo, '.gitignore'), 'tmp/\n');
      await execFileAsync('git', ['add', '.gitignore'], { cwd: enclosingRepo });
      await gitCommit(enclosingRepo, 'init');

      // Create a sub-app inside the gitignored tmp/ directory
      const subAppDir = join(enclosingRepo, 'tmp', 'sub-app');
      await mkdir(subAppDir, { recursive: true });
      await writeFile(
        join(subAppDir, 'app.js'),
        'function subApp() { scanMe(); }',
      );

      // Scanning the sub-app directly must discover and scan app.js via fallback to walker
      const findings = await scanRepoFiles(subAppDir, [scanMeRule]);

      assert.deepEqual(findings.map((f) => f.file), ['app.js']);
    });
  });

  it('skips vendored third_party candidate files from disk reads and maxFiles budget when no dependency rules are active', async () => {
    await withTempDir('vendored-budget-', async (tempDir) => {
      await mkdir(join(tempDir, 'front_end', 'third_party', 'lib'), { recursive: true });
      await mkdir(join(tempDir, 'src'), { recursive: true });

      await writeFile(join(tempDir, 'front_end', 'third_party', 'lib', 'a.js'), 'scanMe();');
      await writeFile(join(tempDir, 'front_end', 'third_party', 'lib', 'b.js'), 'scanMe();');
      await writeFile(join(tempDir, 'front_end', 'third_party', 'lib', 'c.js'), 'scanMe();');
      await writeFile(join(tempDir, 'src', 'app.js'), 'scanMe();');

      // With maxFiles: 1 and no dependency rules, third_party files must not consume the budget.
      const jsOnlyFindings = await scanRepoFiles(tempDir, [scanMeRule], { maxFiles: 1 });
      assert.deepEqual(jsOnlyFindings.map((f) => f.file), ['src/app.js']);

      // With a dependency rule active, checked-in vendored files remain candidates.
      await writeFile(
        join(tempDir, 'front_end', 'third_party', 'lib', 'jquery.fittext.js'),
        '/*! FitText */\n',
      );
      const depRule: AnalyzerRule = {
        id: 'test-fittext',
        guideId: 'test-guide',
        guideHash: '0123456789ab',
        summary: 'Flags vendored fittext',
        verifierRubric: { keepWhen: ['vendored'], dropWhen: [] },
        matcher: { kind: 'dependency', packages: ['jquery-fittext', 'fittext'] },
      };
      const depFindings = await scanRepoFiles(tempDir, [depRule], { maxFiles: 10 });
      assert.deepEqual(
        depFindings.map((f) => f.file),
        ['front_end/third_party/lib/jquery.fittext.js'],
      );
    });
  });
});
