import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { SyntaxKind } from 'ts-morph';
import type {
  CssRuleMatcher,
  DependencyRuleMatcher,
  RuleMatcher,
  ScanRule,
} from '../schema.ts';
import { scanCss, scanCssRules } from './css-scanner.ts';
import { scanPackageJson, scanPackageJsonRules } from './dependency-scanner.ts';
import { scanFiles, scanRepoFiles, type RepoScanStats } from './index.ts';

function makeRule<M extends RuleMatcher>(
  id: string,
  guideId: string,
  matcher: M,
): ScanRule & { readonly matcher: M } {
  return {
    id,
    guideId,
    guideHash: '000000000000',
    summary: `${id} summary`,
    verifierRubric: { keepWhen: ['a'], dropWhen: ['b'] },
    matcher,
  };
}

void test('parse error & unrecoverable exception isolation with deduplicated parseErrorCount (#3587)', async (t) => {
  // cssomnom is CSS-spec error-recovering for ordinary syntax glitches; deep brace nesting
  // triggers an unrecoverable RangeError to exercise per-block CSS parser exception isolation.
  const unrecoverableCss = '.hit {\n' + '{\n'.repeat(3000);
  const cssRule = makeRule<CssRuleMatcher>('test/parse-css', 'css-guide', {
    kind: 'css',
    fastTokens: ['.hit'],
    matchRule: (view) => (view.selectorText === '.hit' ? { message: 'css hit' } : null),
  });
  const depRule = makeRule<DependencyRuleMatcher>('test/parse-dep', 'dep-guide', {
    kind: 'dependency',
    packages: ['legacy-pkg'],
    matchPackage: (pkg) => ({ message: `dep ${pkg}` }),
  });
  const domRule = makeRule('test/parse-dom', 'dom-guide', {
    kind: 'dom',
    selector: 'legacy-el',
    fastTokens: ['legacy-el'],
    matchElement: () => ({ message: 'dom hit' }),
  });
  const jsRule = makeRule('test/parse-js', 'js-guide', {
    kind: 'js',
    fastTokens: ['legacyCall'],
    matchFile: (sf) =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).map((c) => ({
        line: c.getStartLineNumber(),
        message: 'js hit',
      })),
  });
  const throwingDomRule = makeRule('test/throwing-dom', 'dom-guide', {
    kind: 'dom',
    selector: 'legacy-el',
    fastTokens: ['legacy-el'],
    matchElement: () => {
      throw new Error('simulated DOM failure');
    },
  });
  const throwingJsRule = makeRule('test/throwing-js', 'js-guide', {
    kind: 'js',
    fastTokens: ['legacyCall'],
    matchFile: () => {
      throw new Error('simulated JS AST failure');
    },
  });

  await t.test('direct scanner helpers propagate parse errors while scanFiles isolates them', () => {
    assert.throws(() => scanCss('broken.css', unrecoverableCss, [cssRule.matcher]), RangeError);
    assert.throws(() => scanCssRules('broken.css', unrecoverableCss, [cssRule]), RangeError);
    assert.throws(
      () => scanPackageJson('package.json', '{ "dependencies": {', [depRule.matcher]),
      SyntaxError,
    );
    assert.throws(
      () => scanPackageJsonRules('package.json', '{ "dependencies": {', [depRule]),
      SyntaxError,
    );
  });

  await t.test('counts malformed package.json and unrecoverable .css exceptions once per file without aborting remaining files', () => {
    const stats: RepoScanStats = {};
    const findings = scanFiles(
      new Map([
        ['package.json', '{ "dependencies": {'],
        ['src/broken.css', unrecoverableCss],
        ['src/good.css', '.hit { color: red; }'],
        ['apps/web/package.json', '{"dependencies":{"react":"^18.0.0","legacy-pkg":"^1.0.0"}}'],
      ]),
      [cssRule, depRule],
      { stats },
    );

    assert.deepEqual(
      findings.map((f) => f.file).sort(),
      ['apps/web/package.json', 'src/good.css'],
    );
    assert.equal(stats.parseErrorCount, 2);
    assert.equal(stats.scannedFileCount, 4);
  });

  await t.test('multi-block .vue/.html preserves valid findings from unaffected blocks and deduplicates parseErrorCount per file', () => {
    const vueWithTwoBrokenStyles = [
      '<template><legacy-el></legacy-el></template>',
      '<script>legacyCall();</script>',
      `<style>\n${unrecoverableCss}\n</style>`,
      `<style>\n${unrecoverableCss}\n</style>`,
    ].join('\n');

    const htmlWithOneBrokenOneValidStyle = [
      `<style>\n${unrecoverableCss}\n</style>`,
      '<style>\n.hit { color: blue; }\n</style>',
    ].join('\n');

    const stats: RepoScanStats = {};
    const findings = scanFiles(
      new Map([
        ['src/BrokenStyles.vue', vueWithTwoBrokenStyles],
        ['src/MixedStyles.html', htmlWithOneBrokenOneValidStyle],
      ]),
      [domRule, jsRule, cssRule],
      { stats },
    );

    assert.deepEqual(
      findings.map((f) => `${f.file}:${f.ruleId}`).sort(),
      [
        'src/BrokenStyles.vue:test/parse-dom',
        'src/BrokenStyles.vue:test/parse-js',
        'src/MixedStyles.html:test/parse-css',
      ],
    );
    assert.equal(stats.parseErrorCount, 2, 'two broken <style> blocks in one file must count once');
  });

  await t.test('isolates DOM/JS block errors in .vue, .ts, and .tsx files while preserving sibling engine findings', () => {
    const vueContent = [
      '<template><legacy-el></legacy-el></template>',
      '<script>legacyCall();</script>',
      '<style>.hit { color: red; }</style>',
    ].join('\n');
    const tsContent = [
      "import { css } from 'lit';",
      'legacyCall();',
      'export const s = css`.hit { color: red; }`;',
    ].join('\n');
    const tsxContent = [
      "import { css } from 'lit';",
      'export const s = css`.hit { color: red; }`;',
      'export function Card() { legacyCall(); return <legacy-el />; }',
    ].join('\n');

    const stats: RepoScanStats = {};
    const findings = scanFiles(
      new Map([
        ['src/App.vue', vueContent],
        ['src/Card.ts', tsContent],
      ]),
      [throwingDomRule, throwingJsRule, cssRule],
      { stats },
    );
    assert.deepEqual(
      findings.map((f) => `${f.file}:${f.ruleId}`).sort(),
      ['src/App.vue:test/parse-css', 'src/Card.ts:test/parse-css'],
    );
    assert.equal(stats.parseErrorCount, 2);

    // Throwing JSX DOM rule on .tsx must NOT abort JS AST or Lit CSS rules on the same file
    const tsxDomFailStats: RepoScanStats = {};
    const tsxDomFailFindings = scanFiles(
      new Map([['src/Widget.tsx', tsxContent]]),
      [throwingDomRule, jsRule, cssRule],
      { stats: tsxDomFailStats },
    );
    assert.deepEqual(
      tsxDomFailFindings.map((f) => f.ruleId).sort(),
      ['test/parse-css', 'test/parse-js'],
    );
    assert.equal(tsxDomFailStats.parseErrorCount, 1);

    // Throwing JS AST rule on .tsx preserves JSX DOM and Lit CSS findings
    const tsxJsFailStats: RepoScanStats = {};
    const tsxJsFailFindings = scanFiles(
      new Map([['src/Widget.tsx', tsxContent]]),
      [domRule, throwingJsRule, cssRule],
      { stats: tsxJsFailStats },
    );
    assert.deepEqual(
      tsxJsFailFindings.map((f) => f.ruleId).sort(),
      ['test/parse-css', 'test/parse-dom'],
    );
    assert.equal(tsxJsFailStats.parseErrorCount, 1);
  });

  await t.test('scanRepoFiles tracks parseErrorCount across disk files', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'parse-err-repo-'));
    try {
      await mkdir(join(tempDir, 'src'), { recursive: true });
      await writeFile(join(tempDir, 'src', 'broken.css'), unrecoverableCss);
      await writeFile(join(tempDir, 'package.json'), '{ invalid json');
      await writeFile(join(tempDir, 'src', 'valid.css'), '.hit { color: green; }');

      const stats: RepoScanStats = {};
      const findings = await scanRepoFiles(tempDir, [cssRule, depRule], { stats });
      assert.deepEqual(findings.map((f) => f.file), ['src/valid.css']);
      assert.equal(stats.parseErrorCount, 2);
      assert.equal(stats.scannedFileCount, 3);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
