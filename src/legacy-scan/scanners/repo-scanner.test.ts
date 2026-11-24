import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { SyntaxKind } from 'ts-morph';
import type { RuleMatcher, ScanRule } from '../schema.ts';
import {
  DEFAULT_MAX_FILES,
  isPathWithinRoot,
  resolveMaxFiles,
  scanFiles,
  scanRepoFiles,
  type RepoScanStats,
} from './index.ts';

const execFileAsync = promisify(execFile);

function makeTestRule(id: string, guideId: string, matcher: RuleMatcher): ScanRule {
  return {
    id,
    guideId,
    guideHash: '000000000000',
    summary: `${id} summary`,
    verifierRubric: { keepWhen: ['a'], dropWhen: ['b'] },
    matcher,
  };
}

function makeCallRule(
  id: string,
  fastToken: string,
  onSourceFile?: (sf: Parameters<Extract<RuleMatcher, { kind: 'js' }>['matchFile']>[0]) => void,
): ScanRule {
  return makeTestRule(id, 'dialog', {
    kind: 'js',
    fastTokens: [fastToken],
    matchFile: (sf) => {
      onSourceFile?.(sf);
      return sf.getDescendantsOfKind(SyntaxKind.CallExpression).map((c) => ({
        line: c.getStartLineNumber(),
        message: c.getText(),
      }));
    },
  });
}

async function withTempRepo(prefix: string, fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

void test('scanRepoFiles: batched streaming, Project rotation, maxFiles, package.json priority, and modality filtering', async (t) => {
  await t.test('rotates ephemeral Project every 25 AST-parsed files and preserves order across >64-file batches', async () => {
    await withTempRepo('batched-io-repo-', async (tempDir) => {
      await mkdir(join(tempDir, 'src'), { recursive: true });
      await mkdir(join(tempDir, 'test'), { recursive: true });

      for (let i = 0; i < 80; i++) {
        const padded = String(i).padStart(3, '0');
        await writeFile(
          join(tempDir, 'src', `file-${padded}.ts`),
          `export const idx = ${i};\nlegacyTarget(${i});\n`,
        );
      }
      for (let j = 0; j < 10; j++) {
        await writeFile(join(tempDir, 'src', `a-spec-${j}.test.ts`), `legacyTarget(${j});\n`);
      }

      const seenProjects = new Set<unknown>();
      const rule = makeCallRule('test/batched-scan', 'legacyTarget', (sf) => {
        seenProjects.add(sf.getProject());
      });

      const stats: RepoScanStats = {};
      const findings = await scanRepoFiles(tempDir, [rule], { maxFiles: 70, stats });

      assert.equal(findings.length, 70, 'must cap scanned files at maxFiles=70 across 64-file batches');
      assert.equal(seenProjects.size, 3, 'must rotate ephemeral Project every 25 AST-parsed files (25 + 25 + 20 = 3 Projects)');
      assert.equal(stats.skippedDocsAndTestsCount, 10, 'must count all 10 skipped test files before hitting maxFiles');
      assert.equal(stats.scannedFileCount, 70);
      assert.equal(stats.eligibleFileCount, 80);
      assert.equal(stats.truncatedByMaxFiles, true);
      const expectedFiles = Array.from({ length: 70 }, (_, i) => `src/file-${String(i).padStart(3, '0')}.ts`);
      assert.deepEqual(
        findings.map((f) => f.file),
        expectedFiles,
        'must preserve exact lexicographical file ordering across concurrent I/O batches and >25 file Project rotations',
      );
    });
  });

  await t.test('treats maxFiles=0 and Infinity as unlimited, handles exact boundary without truncation, and validates programmatic maxFiles', async () => {
    assert.equal(DEFAULT_MAX_FILES, 5000);
    assert.equal(resolveMaxFiles(undefined), DEFAULT_MAX_FILES);
    assert.equal(resolveMaxFiles(0), Number.POSITIVE_INFINITY);
    assert.equal(resolveMaxFiles(Number.POSITIVE_INFINITY), Number.POSITIVE_INFINITY);
    assert.equal(resolveMaxFiles(250), 250);

    for (const invalid of [-1, -100, 1.5, Number.NaN, Number.NEGATIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => resolveMaxFiles(invalid), RangeError);
    }

    await withTempRepo('max-files-boundary-', async (tempDir) => {
      await mkdir(join(tempDir, 'src'), { recursive: true });
      for (let i = 0; i < 70; i++) {
        const padded = String(i).padStart(3, '0');
        await writeFile(join(tempDir, 'src', `file-${padded}.ts`), `legacyTarget(${i});\n`);
      }
      await writeFile(join(tempDir, 'src', 'z-trailing.test.ts'), 'legacyTarget(999);\n');

      const rule = makeCallRule('test/unlimited-scan', 'legacyTarget');

      const exactStats: RepoScanStats = {};
      const exactFindings = await scanRepoFiles(tempDir, [rule], { maxFiles: 70, stats: exactStats });
      assert.equal(exactFindings.length, 70);
      assert.equal(exactStats.scannedFileCount, 70);
      assert.equal(exactStats.eligibleFileCount, 70);
      assert.equal(exactStats.truncatedByMaxFiles, false);
      assert.equal(exactStats.skippedDocsAndTestsCount, 1);

      const unlimitedStats: RepoScanStats = {};
      const unlimitedFindings = await scanRepoFiles(tempDir, [rule], { maxFiles: 0, stats: unlimitedStats });
      assert.equal(unlimitedFindings.length, 70);
      assert.equal(unlimitedStats.scannedFileCount, 70);
      assert.equal(unlimitedStats.eligibleFileCount, 70);
      assert.equal(unlimitedStats.truncatedByMaxFiles, false);

      await assert.rejects(() => scanRepoFiles(tempDir, [rule], { maxFiles: -5 }), RangeError);
    });
  });

  await t.test('excludes content-rejected files from eligibleFileCount when capped or uncapped', async () => {
    await withTempRepo('content-rejected-cap-', async (tempDir) => {
      await mkdir(join(tempDir, 'src'), { recursive: true });
      await writeFile(join(tempDir, 'src', 'a-minified.js'), `var x=${'a'.repeat(1500)};`);
      for (let i = 1; i <= 4; i++) {
        await writeFile(join(tempDir, 'src', `b-valid-${i}.ts`), `legacyTarget(${i});\n`);
      }

      const rule = makeCallRule('test/content-rejected', 'legacyTarget');

      const cappedStats: RepoScanStats = {};
      const cappedFindings = await scanRepoFiles(tempDir, [rule], { maxFiles: 2, stats: cappedStats });
      assert.deepEqual(
        cappedFindings.map((f) => f.file),
        ['src/b-valid-1.ts', 'src/b-valid-2.ts'],
      );
      assert.equal(cappedStats.scannedFileCount, 2);
      assert.equal(cappedStats.eligibleFileCount, 4);
      assert.equal(cappedStats.truncatedByMaxFiles, true);

      const fullStats: RepoScanStats = {};
      const fullFindings = await scanRepoFiles(tempDir, [rule], { maxFiles: 10, stats: fullStats });
      assert.equal(fullFindings.length, 4);
      assert.equal(fullStats.scannedFileCount, 4);
      assert.equal(fullStats.eligibleFileCount, 4);
      assert.equal(fullStats.truncatedByMaxFiles, false);
    });
  });

  await t.test('prioritizes package.json ahead of alphabetical source files under cap', async () => {
    await withTempRepo('pkg-priority-', async (tempDir) => {
      await mkdir(join(tempDir, 'a-src'), { recursive: true });
      await mkdir(join(tempDir, 'packages', 'web'), { recursive: true });
      await mkdir(join(tempDir, 'docs'), { recursive: true });

      for (let i = 0; i < 10; i++) {
        await writeFile(
          join(tempDir, 'a-src', `file-${String(i).padStart(2, '0')}.ts`),
          `legacyTarget(${i});\n`,
        );
      }
      const pkgBody = (name: string) =>
        JSON.stringify({ name, dependencies: { react: '^18.0.0', 'legacy-pkg': '^1.0.0' } }, null, 2);
      await writeFile(join(tempDir, 'package.json'), pkgBody('root'));
      await writeFile(join(tempDir, 'packages', 'web', 'package.json'), pkgBody('web'));
      await writeFile(join(tempDir, 'docs', 'package.json'), pkgBody('docs-pkg'));

      const depRule = makeTestRule('test/dep-priority', 'perf', {
        kind: 'dependency',
        packages: ['legacy-pkg'],
        matchPackage: (pkg) => ({ message: `found ${pkg}` }),
      });
      const jsRule = makeCallRule('test/js-priority', 'legacyTarget');

      const stats: RepoScanStats = {};
      const findings = await scanRepoFiles(tempDir, [depRule, jsRule], { maxFiles: 3, stats });

      assert.deepEqual(
        findings.map((f) => f.file),
        ['package.json', 'packages/web/package.json', 'a-src/file-00.ts'],
      );
      assert.equal(stats.scannedFileCount, 3);
      assert.equal(stats.eligibleFileCount, 12);
      assert.equal(stats.truncatedByMaxFiles, true);
      assert.equal(stats.skippedDocsAndTestsCount, 1);
    });
  });

  await t.test('filters candidates by active rule modality without dropping Lit CSS or markup', async () => {
    await withTempRepo('modality-filter-', async (tempDir) => {
      await mkdir(join(tempDir, 'src'), { recursive: true });
      await mkdir(join(tempDir, 'vendor'), { recursive: true });

      await writeFile(join(tempDir, 'src', 'style.css'), '.legacy-hit { color: red; }\n');
      await writeFile(join(tempDir, 'src', 'app.scss'), '// comment\n.legacy-hit { color: red; }\n');
      await writeFile(
        join(tempDir, 'src', 'page.html'),
        '<style>\n.legacy-hit { color: red; }\n</style>\n<legacy-el></legacy-el>\n<script>\nlegacyTarget();\n</script>\n',
      );
      await writeFile(
        join(tempDir, 'src', 'Widget.vue'),
        '<script setup>\nlegacyTarget();\n</script>\n<template><legacy-el></legacy-el></template>\n<style>.legacy-hit { color: red; }</style>\n',
      );
      await writeFile(
        join(tempDir, 'src', 'Component.tsx'),
        "import { css } from 'lit';\nexport const s = css`.legacy-hit { color: red; }`;\nexport function C() { legacyTarget(); return <legacy-el />; }\n",
      );
      await writeFile(
        join(tempDir, 'src', 'lit-element.ts'),
        "import { css } from 'lit';\nexport const s = css`.legacy-hit { color: red; }`;\nlegacyTarget();\n",
      );
      await writeFile(
        join(tempDir, 'src', 'helper.js'),
        "import { css } from 'lit';\nexport const s = css`.legacy-hit { color: red; }`;\nlegacyTarget();\n",
      );
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({ name: 'app', dependencies: { react: '^18.0.0', 'legacy-pkg': '^1.0.0' } }),
      );
      await writeFile(join(tempDir, 'vendor', 'jquery.fittext.js'), '/*! jQuery FitText.js 1.2 */\n');
      await writeFile(join(tempDir, 'README.md'), '# ignored markdown\n');

      const cssRule = makeTestRule('mod/css', 'css-guide', {
        kind: 'css',
        fastTokens: ['.legacy-hit'],
        matchRule: (r) => (r.selectorText === '.legacy-hit' ? { message: 'css' } : null),
      });
      const domRule = makeTestRule('mod/dom', 'dom-guide', {
        kind: 'dom',
        selector: 'legacy-el',
        fastTokens: ['legacy-el'],
        matchElement: () => ({ message: 'dom' }),
      });
      const jsRule = makeCallRule('mod/js', 'legacyTarget');
      const depRule = makeTestRule('mod/dep', 'dep-guide', {
        kind: 'dependency',
        packages: ['legacy-pkg', 'jquery-fittext'],
      });

      const cssStats: RepoScanStats = {};
      const cssFindings = await scanRepoFiles(tempDir, [cssRule], { maxFiles: 7, stats: cssStats });
      assert.deepEqual(
        cssFindings.map((f) => f.file).sort(),
        [
          'src/Component.tsx',
          'src/Widget.vue',
          'src/app.scss',
          'src/helper.js',
          'src/lit-element.ts',
          'src/page.html',
          'src/style.css',
        ],
      );
      assert.equal(cssStats.scannedFileCount, 7);
      assert.equal(cssStats.eligibleFileCount, 7);
      assert.equal(cssStats.truncatedByMaxFiles, false);

      const domStats: RepoScanStats = {};
      const domFindings = await scanRepoFiles(tempDir, [domRule], { maxFiles: 3, stats: domStats });
      assert.deepEqual(
        domFindings.map((f) => f.file).sort(),
        ['src/Component.tsx', 'src/Widget.vue', 'src/page.html'],
      );
      assert.equal(domStats.scannedFileCount, 3);
      assert.equal(domStats.eligibleFileCount, 3);
      assert.equal(domStats.truncatedByMaxFiles, false);

      const jsStats: RepoScanStats = {};
      const jsFindings = await scanRepoFiles(tempDir, [jsRule], { maxFiles: 5, stats: jsStats });
      assert.deepEqual(
        jsFindings.map((f) => f.file).sort(),
        ['src/Component.tsx', 'src/Widget.vue', 'src/helper.js', 'src/lit-element.ts', 'src/page.html'],
      );
      assert.equal(jsStats.scannedFileCount, 5);
      assert.equal(jsStats.eligibleFileCount, 5);
      assert.equal(jsStats.truncatedByMaxFiles, false);

      const depStats: RepoScanStats = {};
      const depFindings = await scanRepoFiles(tempDir, [depRule], { maxFiles: 2, stats: depStats });
      assert.deepEqual(
        depFindings.map((f) => f.file),
        ['package.json', 'vendor/jquery.fittext.js'],
      );
      assert.equal(depStats.scannedFileCount, 2);
      assert.equal(depStats.eligibleFileCount, 2);
      assert.equal(depStats.truncatedByMaxFiles, false);
    });
  });

  await t.test('skips bare dotfiles like src/.vue identically in scanFiles and scanRepoFiles', async () => {
    const vueSnippet = '<template><legacy-el></legacy-el></template>';
    const domRule = makeTestRule('dotfile/dom', 'dom-guide', {
      kind: 'dom',
      selector: 'legacy-el',
      fastTokens: ['legacy-el'],
      matchElement: () => ({ message: 'dom' }),
    });

    const inMemoryStats: RepoScanStats = {};
    const inMemoryFindings = scanFiles(
      new Map([
        ['src/.vue', vueSnippet],
        ['src/Valid.vue', vueSnippet],
      ]),
      [domRule],
      { stats: inMemoryStats },
    );
    assert.deepEqual(inMemoryFindings.map((f) => f.file), ['src/Valid.vue']);
    assert.equal(inMemoryStats.scannedFileCount, 1);

    await withTempRepo('dotfile-ext-', async (tempDir) => {
      await mkdir(join(tempDir, 'src'), { recursive: true });
      await writeFile(join(tempDir, 'src', '.vue'), vueSnippet);
      await writeFile(join(tempDir, 'src', 'Valid.vue'), vueSnippet);

      const repoStats: RepoScanStats = {};
      const repoFindings = await scanRepoFiles(tempDir, [domRule], { stats: repoStats });
      assert.deepEqual(repoFindings.map((f) => f.file), ['src/Valid.vue']);
      assert.equal(repoStats.scannedFileCount, 1);
      assert.equal(repoStats.eligibleFileCount, 1);
    });
  });

  await t.test('isPathWithinRoot enforces directory boundaries without prefix or dot-dot bypasses', () => {
    const repo = resolve('/repo');
    assert.equal(isPathWithinRoot(repo, repo), true);
    assert.equal(isPathWithinRoot(resolve(repo, 'src/app.ts'), repo), true);
    assert.equal(isPathWithinRoot(resolve(repo, '..foo.ts'), repo), true);
    assert.equal(isPathWithinRoot(resolve('/repo-other/app.ts'), repo), false);
    assert.equal(isPathWithinRoot(resolve('/etc/passwd'), repo), false);
    assert.equal(isPathWithinRoot(resolve(repo, '..'), repo), false);
    assert.equal(isPathWithinRoot(resolve('/repo/a'), resolve('/')), true);
  });

  await t.test('git mode skips tracked symlinks, untracked symlinks, and external directory symlinks', async () => {
    await withTempRepo('git-symlinks-root-', async (workspace) => {
      const outsideDir = join(workspace, 'outside');
      const repoDir = join(workspace, 'repo');
      await mkdir(join(outsideDir, 'nested'), { recursive: true });
      await mkdir(join(repoDir, 'src'), { recursive: true });

      await writeFile(join(outsideDir, 'secret.ts'), 'legacyTarget("outside");\n');
      await writeFile(join(outsideDir, 'nested', 'deep.ts'), 'legacyTarget("deep-outside");\n');
      await writeFile(join(repoDir, 'src', 'real.ts'), 'legacyTarget("real");\n');
      await writeFile(join(repoDir, 'src', 'untracked.ts'), 'legacyTarget("untracked");\n');
      await writeFile(join(repoDir, '.gitignore'), 'ignored.ts\n');
      await writeFile(join(repoDir, 'ignored.ts'), 'legacyTarget("ignored");\n');

      // Tracked symlinks (mode 120000) to outside and inside files
      await symlink(join(outsideDir, 'secret.ts'), join(repoDir, 'src', 'tracked-outside-link.ts'));
      await symlink(join(repoDir, 'src', 'real.ts'), join(repoDir, 'src', 'tracked-inside-link.ts'));
      // Untracked symlinks to outside file and outside directory
      await symlink(join(outsideDir, 'secret.ts'), join(repoDir, 'src', 'untracked-outside-link.ts'));
      await symlink(outsideDir, join(repoDir, 'linked-outside-dir'));

      await execFileAsync('git', ['init'], { cwd: repoDir });
      await execFileAsync(
        'git',
        ['add', '.gitignore', 'src/real.ts', 'src/tracked-outside-link.ts', 'src/tracked-inside-link.ts'],
        { cwd: repoDir },
      );

      const rule = makeCallRule('test/git-symlinks', 'legacyTarget');
      const stats: RepoScanStats = {};
      const findings = await scanRepoFiles(repoDir, [rule], { stats });

      assert.deepEqual(
        findings.map((f) => f.file).sort(),
        ['src/real.ts', 'src/untracked.ts'],
      );
      assert.equal(stats.scannedFileCount, 2);
      assert.equal(stats.eligibleFileCount, 2);

      // Repo with only untracked files must still enumerate them cleanly
      const untrackedOnlyDir = join(workspace, 'untracked-only');
      await mkdir(untrackedOnlyDir, { recursive: true });
      await execFileAsync('git', ['init'], { cwd: untrackedOnlyDir });
      await writeFile(join(untrackedOnlyDir, 'only.ts'), 'legacyTarget("only");\n');
      const untrackedFindings = await scanRepoFiles(untrackedOnlyDir, [rule]);
      assert.deepEqual(untrackedFindings.map((f) => f.file), ['only.ts']);

      // Repo with only a tracked symlink + excluded file must NOT fall back to directory walk
      const symlinkOnlyDir = join(workspace, 'symlink-only');
      await mkdir(symlinkOnlyDir, { recursive: true });
      await execFileAsync('git', ['init'], { cwd: symlinkOnlyDir });
      await writeFile(join(symlinkOnlyDir, '.git', 'info', 'exclude'), 'ignored.ts\n');
      await writeFile(join(symlinkOnlyDir, 'ignored.ts'), 'legacyTarget("ignored");\n');
      await symlink(join(outsideDir, 'secret.ts'), join(symlinkOnlyDir, 'link.ts'));
      await execFileAsync('git', ['add', 'link.ts'], { cwd: symlinkOnlyDir });
      const symlinkOnlyFindings = await scanRepoFiles(symlinkOnlyDir, [rule]);
      assert.deepEqual(symlinkOnlyFindings, []);
    });
  });

  await t.test('non-git walk skips internal/external file and directory symlinks and circular symlink loops', async () => {
    await withTempRepo('nongit-symlinks-root-', async (workspace) => {
      const outsideDir = join(workspace, 'outside');
      const rootDir = join(workspace, 'scan-root');
      await mkdir(outsideDir, { recursive: true });
      await mkdir(join(rootDir, 'src'), { recursive: true });

      await writeFile(join(outsideDir, 'secret.ts'), 'legacyTarget("outside");\n');
      await writeFile(join(rootDir, 'src', 'app.ts'), 'legacyTarget("inside");\n');

      // File symlinks (outside & inside)
      await symlink(join(outsideDir, 'secret.ts'), join(rootDir, 'src', 'outside-file-link.ts'));
      await symlink(join(rootDir, 'src', 'app.ts'), join(rootDir, 'src', 'inside-file-link.ts'));
      // Directory symlinks (outside, inside, and circular self-loop)
      await symlink(outsideDir, join(rootDir, 'outside-dir-link'));
      await symlink(join(rootDir, 'src'), join(rootDir, 'inside-dir-link'));
      await symlink(rootDir, join(rootDir, 'src', 'loop-to-root'));

      const rule = makeCallRule('test/nongit-symlinks', 'legacyTarget');
      const stats: RepoScanStats = {};
      const findings = await scanRepoFiles(rootDir, [rule], { stats });

      assert.deepEqual(findings.map((f) => f.file), ['src/app.ts']);
      assert.equal(stats.scannedFileCount, 1);
      assert.equal(stats.eligibleFileCount, 1);
    });
  });
});
