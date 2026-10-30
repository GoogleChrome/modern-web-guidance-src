import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  elideText,
  formatHumanReadable,
  runAnalyzeCli,
  sampleDiversifiedFindings,
  writeAnalyzeCliResult,
  type AnalyzeCliFinding,
  type AnalyzeCliGuideGroup,
  type AnalyzeJsonOutput,
} from './cli.ts';
import {
  QUALIFIED_GUIDE_IDS,
  QUALIFIED_RULES,
} from './rules/index.ts';
import type { AnalyzerRule } from './schema.ts';

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'analyzer-cli-test-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('runAnalyzeCli', () => {
  it('handles help flags (-h, --help)', async () => {
    const res1 = await runAnalyzeCli(['--help']);
    assert.equal(res1.exitCode, 0);
    assert.match(res1.output, /Usage: modern-web-guidance analyze/);

    const res2 = await runAnalyzeCli(['analyze', '-h']);
    assert.equal(res2.exitCode, 0);
    assert.match(res2.output, /Usage: modern-web-guidance analyze/);
  });

  it('handles non-existent target directory with error and exit code 1', async () => {
    const nonExistentPath = join(tmpdir(), `non-existent-dir-${Date.now()}`);
    const resHuman = await runAnalyzeCli([nonExistentPath]);
    assert.equal(resHuman.exitCode, 1);
    assert.match(resHuman.output, /Error: Target directory not found/);

    const resJson = await runAnalyzeCli([nonExistentPath, '--json']);
    assert.equal(resJson.exitCode, 1);
    assert.ok(resJson.data, 'Expected data payload on --json error');
    const parsed = JSON.parse(resJson.output) as AnalyzeJsonOutput;
    assert.equal(parsed.totalFindings, 0);
    assert.equal(parsed.guides.length, 0);
    assert.match(parsed.error ?? '', /Target directory not found/);

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const origStdoutWrite = process.stdout.write.bind(process.stdout);
    const origStderrWrite = process.stderr.write.bind(process.stderr);
    const origExitCode = process.exitCode;
    try {
      process.stdout.write = ((chunk: string | Uint8Array) => {
        stdoutChunks.push(String(chunk));
        return true;
      }) as typeof process.stdout.write;
      process.stderr.write = ((chunk: string | Uint8Array) => {
        stderrChunks.push(String(chunk));
        return true;
      }) as typeof process.stderr.write;

      assert.equal(writeAnalyzeCliResult(resHuman), 1);
      assert.equal(process.exitCode, 1);
      assert.equal(stdoutChunks.length, 0);
      assert.equal(stderrChunks.length, 1);

      process.exitCode = 0;
      assert.equal(writeAnalyzeCliResult(resJson), 1);
      assert.equal(process.exitCode, 1);
      assert.equal(stdoutChunks.length, 1);
      assert.equal(stderrChunks.length, 1);
    } finally {
      process.stdout.write = origStdoutWrite;
      process.stderr.write = origStderrWrite;
      process.exitCode = origExitCode;
    }
  });

  it('reports zero findings cleanly in default qualified mode', async () => {
    await withTempDir(async (emptyDir) => {
      const resDefault = await runAnalyzeCli([emptyDir]);
      assert.equal(resDefault.exitCode, 0);
      assert.match(
        resDefault.output,
        new RegExp(`0 findings from ${QUALIFIED_GUIDE_IDS.length} qualified guides\\.`),
      );

      const resDefaultJson = await runAnalyzeCli([emptyDir, '--json']);
      assert.equal(resDefaultJson.exitCode, 0);
      const parsedDefault = JSON.parse(resDefaultJson.output) as AnalyzeJsonOutput;
      assert.equal(parsedDefault.totalFindings, 0);
      assert.deepEqual(parsedDefault.guides, []);
      assert.equal(parsedDefault.targetDir, emptyDir);
      assert.equal(parsedDefault.activeRuleCount, QUALIFIED_RULES.length);
      assert.equal(parsedDefault.activeGuideCount, QUALIFIED_GUIDE_IDS.length);
    });
  });

  it('reports zero findings in human-readable output in default mode', () => {
    const reducedZeroOutput = formatHumanReadable('/tmp/project', 0, [], undefined, {
      activeGuideCount: 1,
      isDefaultQualifiedMode: true,
    });
    assert.match(reducedZeroOutput, /0 findings from 1 qualified guide\./);
  });

  it('outputs human-readable grouped summary with retrieveCommand and file:line', async () => {
    await withTempDir(async (testDir) => {
      const htmlContent = `<form action="/login" method="POST">
  <label for="username">Username</label>
  <input type="text" id="username" name="username">
  <label for="password">Password</label>
  <input type="password" id="password" name="password">
  <button type="submit">Sign In</button>
</form>`;
      await writeFile(join(testDir, 'login.html'), htmlContent, 'utf8');

      const cssContent = `.accordion-panel {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease-out;
}
.accordion-panel.open {
  max-height: 500px;
}`;
      await writeFile(join(testDir, 'accordion.css'), cssContent, 'utf8');

      const res = await runAnalyzeCli(['analyze', testDir]);
      assert.equal(res.exitCode, 0);

      assert.match(res.output, /Modern Web Guidance Analyzer —/);
      assert.match(res.output, /Found \d+ modernization opportunities across \d+ guides:/);
      assert.match(
        res.output,
        /Note: Static analysis results are provisional — verify against the Keep\/Drop criteria below\./,
      );

      assert.match(res.output, /\* autofill-sign-in-form \(\d+ findings?\)/);
      assert.doesNotMatch(
        res.output,
        /\n  autofill-sign-in-form \(\d+ findings?\)/,
        'Single-rule guide must omit redundant ruleId subheader',
      );
      assert.match(res.output, /Keep when:/);
      assert.match(res.output, /Drop when:/);
      assert.doesNotMatch(res.output, /\.;/, 'Rubric items should not render double punctuation .;');
      assert.match(res.output, /- login\.html:\d+/);
      assert.match(res.output, /<input type="password"/);

      assert.match(res.output, /\* animate-to-intrinsic-sizes \(\d+ findings?\)/);
      assert.match(res.output, /- accordion\.css:\d+/);
      assert.match(res.output, /\.accordion-panel \{/);

      assert.match(
        res.output,
        /Retrieve a guide: npx modern-web-guidance retrieve <guide-id> \(or pass --json for coding agents\)/,
      );
    });
  });

  it('outputs structured JSON conforming to agent contract with --json', async () => {
    await withTempDir(async (testDir) => {
      const htmlContent = `<form action="/auth" method="POST">
  <input type="text" name="user">
  <input type="password" name="pass">
</form>`;
      await writeFile(join(testDir, 'auth.html'), htmlContent, 'utf8');

      const res = await runAnalyzeCli([testDir, '--json']);
      assert.equal(res.exitCode, 0);

      const parsed = JSON.parse(res.output) as AnalyzeJsonOutput;
      assert.equal(parsed.targetDir, testDir);
      assert.ok(parsed.totalFindings >= 1);
      assert.ok(Array.isArray(parsed.guides));
      assert.ok(parsed.guides.length >= 1);

      const guide = parsed.guides.find((g) => g.guideId === 'autofill-sign-in-form');
      assert.ok(guide, 'Expected autofill-sign-in-form guide in JSON output');
      assert.equal(guide.retrieveCommand, 'npx modern-web-guidance retrieve autofill-sign-in-form');
      assert.equal(guide.count, 1);
      assert.equal(guide.rules.length, 1);

      const ruleGroup = guide.rules[0];
      assert.ok(ruleGroup);
      assert.equal(ruleGroup.ruleId, 'autofill-sign-in-form');
      assert.ok(ruleGroup.summary.length > 0);
      assert.ok(ruleGroup.verifierRubric, 'Expected verifierRubric in rule group JSON output');
      assert.ok(ruleGroup.verifierRubric.keepWhen.length >= 1);
      assert.ok(ruleGroup.verifierRubric.dropWhen.length >= 1);
      assert.equal(ruleGroup.count, ruleGroup.findings.length);

      const finding = ruleGroup.findings[0];
      assert.ok(finding);
      assert.equal(finding.file, 'auth.html');
      assert.ok(typeof finding.line === 'number');
      assert.ok(finding.message.length > 0);
      assert.equal(finding.lineContent, '<input type="password" name="pass">');
    });
  });

  it('filters analysis strictly to specified --guide <guideId>', async () => {
    await withTempDir(async (testDir) => {
      await writeFile(
        join(testDir, 'login.html'),
        `<form action="/login" method="POST">\n  <input type="password" name="password">\n</form>`,
        'utf8',
      );
      await writeFile(
        join(testDir, 'panel.css'),
        `.panel {\n  max-height: 0;\n  transition: max-height 0.25s ease;\n}`,
        'utf8',
      );

      const resCssOnly = await runAnalyzeCli([
        testDir,
        '--guide',
        'animate-to-intrinsic-sizes',
        '--json',
      ]);
      assert.equal(resCssOnly.exitCode, 0);
      const parsedCss = JSON.parse(resCssOnly.output) as AnalyzeJsonOutput;
      assert.deepEqual(parsedCss.guides.map((g) => g.guideId), ['animate-to-intrinsic-sizes']);

      const resHtmlOnly = await runAnalyzeCli([
        testDir,
        '--guide',
        'autofill-sign-in-form',
        '--json',
      ]);
      assert.equal(resHtmlOnly.exitCode, 0);
      const parsedHtml = JSON.parse(resHtmlOnly.output) as AnalyzeJsonOutput;
      assert.deepEqual(parsedHtml.guides.map((g) => g.guideId), ['autofill-sign-in-form']);

      const resNone = await runAnalyzeCli([testDir, '--guide', 'non-matching-guide', '--json']);
      assert.equal(resNone.exitCode, 0);
      const parsedNone = JSON.parse(resNone.output) as AnalyzeJsonOutput;
      assert.equal(parsedNone.totalFindings, 0);
      assert.deepEqual(parsedNone.guides, []);
    });
  });

  it('runs QUALIFIED_RULES by default and rejects unknown flags (--all, --experimental, --jsno)', async () => {
    await withTempDir(async (testDir) => {
      await writeFile(
        join(testDir, 'mask.css'),
        `.icon {\n  -webkit-mask-image: url('icon.svg');\n}`,
        'utf8',
      );

      const resDefault = await runAnalyzeCli([testDir, '--json']);
      assert.equal(resDefault.exitCode, 0);
      const parsedDefault = JSON.parse(resDefault.output) as AnalyzeJsonOutput;
      assert.equal(parsedDefault.totalFindings, 0);
      assert.deepEqual(parsedDefault.guides, []);
      assert.equal(parsedDefault.activeRuleCount, QUALIFIED_RULES.length);

      const resAllHuman = await runAnalyzeCli([testDir, '--all']);
      assert.equal(resAllHuman.exitCode, 1);
      assert.equal(resAllHuman.data, undefined);
      assert.match(resAllHuman.output, /Error: Unknown option '--all'/);

      const resAllJson = await runAnalyzeCli([testDir, '--all', '--json']);
      assert.equal(resAllJson.exitCode, 1);
      assert.ok(resAllJson.data);
      const parsedAllJson = JSON.parse(resAllJson.output) as AnalyzeJsonOutput;
      assert.match(parsedAllJson.error ?? '', /Unknown option '--all'/);

      const resExperimentalHuman = await runAnalyzeCli([testDir, '--experimental']);
      assert.equal(resExperimentalHuman.exitCode, 1);
      assert.match(resExperimentalHuman.output, /Error: Unknown option '--experimental'/);

      const resTypo = await runAnalyzeCli([testDir, '--jsno']);
      assert.equal(resTypo.exitCode, 1);
      assert.equal(resTypo.data, undefined);
      assert.match(resTypo.output, /Error: Unknown option '--jsno'/);
    });
  });

  it('caps terminal findings at 5 per guide and renders overflow summary line', async () => {
    await withTempDir(async (testDir) => {
      for (let i = 1; i <= 8; i++) {
        const html = `<form action="/login${i}" method="POST">\n  <input type="password" name="password">\n</form>`;
        await writeFile(join(testDir, `form${i}.html`), html, 'utf8');
      }

      const res = await runAnalyzeCli([testDir]);
      assert.equal(res.exitCode, 0);
      assert.match(res.output, /\.\.\. and 3 more findings/);

      const resJson = await runAnalyzeCli([testDir, '--json']);
      assert.equal(resJson.exitCode, 0);
      const parsedJson = JSON.parse(resJson.output) as AnalyzeJsonOutput;
      assert.equal(parsedJson.totalFindings, 8);
      assert.equal(parsedJson.guides[0]?.rules[0]?.findings.length, 8);
    });
  });

  describe('helper utilities and formatting', () => {
    it('elideText truncates and elides long lines gracefully', () => {
      assert.equal(elideText('short text', 20), 'short text');
      assert.equal(elideText('a'.repeat(30), 10), 'aaaaaaaaa…');
      assert.equal(elideText('  multiple   whitespace   chars  ', 50), 'multiple whitespace chars');
    });

    it('sampleDiversifiedFindings diversifies findings across files round-robin up to cap', () => {
      const makeFinding = (file: string, id: string): AnalyzeCliFinding => ({
        file,
        line: 1,
        message: id,
        lineContent: 'line',
      });

      const findings: AnalyzeCliFinding[] = [
        makeFinding('a.ts', 'a1'),
        makeFinding('a.ts', 'a2'),
        makeFinding('a.ts', 'a3'),
        makeFinding('b.ts', 'b1'),
        makeFinding('b.ts', 'b2'),
        makeFinding('b.ts', 'b3'),
        makeFinding('c.ts', 'c1'),
        makeFinding('c.ts', 'c2'),
        makeFinding('c.ts', 'c3'),
      ];

      const sampled = sampleDiversifiedFindings(findings, 5);
      assert.deepEqual(
        sampled.map((f) => f.message),
        ['a1', 'b1', 'c1', 'a2', 'b2'],
      );
    });

    it('formatHumanReadable emits ANSI styling when color option is enabled', () => {
      const fixtureGuides: AnalyzeCliGuideGroup[] = [
        {
          guideId: 'autofill-sign-in-form',
          retrieveCommand: 'npx retrieve autofill-sign-in-form',
          count: 1,
          rules: [
            {
              ruleId: 'autofill-sign-in-form',
              summary: 'Autocomplete guidance summary',
              count: 1,
              findings: [
                {
                  file: 'src/login.html',
                  line: 10,
                  message: 'Missing autocomplete',
                  lineContent: '<input type="password">',
                },
              ],
            },
          ],
        },
      ];

      const outputColor = formatHumanReadable('/workspace', 1, fixtureGuides, undefined, {
        color: true,
      });
      assert.ok(outputColor.includes('\u001b['), 'Expected ANSI styling codes in colored output');
      assert.ok(outputColor.includes('autofill-sign-in-form'));

      const outputNoColor = formatHumanReadable('/workspace', 1, fixtureGuides, undefined, {
        color: false,
      });
      assert.ok(!outputNoColor.includes('\u001b['), 'Expected no ANSI escape codes when color=false');
    });

    it('skips docs, examples, demo, test, spec, and fixtures by default with --include-docs-and-tests opt-in', async () => {
      await withTempDir(async (testDir) => {
        const addressHtml = `<form action="/checkout" method="post">
  <label for="street">Street Address</label>
  <input type="text" id="street" name="street_address" required>
  <button type="submit">Continue</button>
</form>`;
        const mkdirAndWrite = async (relPath: string) => {
          const full = join(testDir, relPath);
          await mkdir(join(full, '..'), { recursive: true });
          await writeFile(full, addressHtml, 'utf8');
        };

        await mkdirAndWrite('src/login.html');
        await mkdirAndWrite('docs/sample.html');
        await mkdirAndWrite('examples/demo.html');
        await mkdirAndWrite('demo/page.html');
        await mkdirAndWrite('test/login.html');
        await mkdirAndWrite('spec/login.html');
        await mkdirAndWrite('fixtures/login.html');
        await mkdirAndWrite('src/login.test.html');
        await mkdirAndWrite('src/login.spec.html');
        await mkdirAndWrite('test.html');
        await mkdirAndWrite('docs/bundle.min.js');

        const resJson = await runAnalyzeCli([testDir, '--json']);
        assert.equal(resJson.exitCode, 0);
        const parsed = JSON.parse(resJson.output) as AnalyzeJsonOutput;
        assert.equal(parsed.totalFindings, 1);
        assert.equal(
          parsed.guides[0]?.rules[0]?.findings[0]?.file,
          join('src', 'login.html').replace(/\\/g, '/'),
        );
        assert.equal(parsed.skippedDocsAndTestsCount, 9);

        const resHuman = await runAnalyzeCli([testDir]);
        assert.equal(resHuman.exitCode, 0);
        assert.ok(
          resHuman.output.includes(
            'Skipped 9 docs and test files (pass --include-docs-and-tests to scan).',
          ),
          'Human output must include dim line with skipped count',
        );

        const resIncluded = await runAnalyzeCli([testDir, '--include-docs-and-tests', '--json']);
        assert.equal(resIncluded.exitCode, 0);
        const parsedIncluded = JSON.parse(resIncluded.output) as AnalyzeJsonOutput;
        assert.equal(parsedIncluded.totalFindings, 10);
        assert.equal(parsedIncluded.skippedDocsAndTestsCount, undefined);

        const docsDir = join(testDir, 'docs');
        const resDocs = await runAnalyzeCli([docsDir, '--json']);
        assert.equal(resDocs.exitCode, 0);
        const parsedDocs = JSON.parse(resDocs.output) as AnalyzeJsonOutput;
        assert.equal(parsedDocs.totalFindings, 1);
        assert.equal(parsedDocs.guides[0]?.rules[0]?.findings[0]?.file, 'sample.html');
      });
    });

    it('accurately associates each finding with its own rule summary and rubric in multi-rule guides', async () => {
      await withTempDir(async (testDir) => {
        const ruleA: AnalyzerRule = {
          id: 'test-multirule/package-rule',
          guideId: 'test-multirule',
          guideHash: '111122223333',
          summary: 'Summary for Rule A (package dependency replacement)',
          matcher: {
            kind: 'dependency',
            packages: ['mock-pkg-a'],
            matchPackage: (pkg) => ({ message: `Replace ${pkg} with native feature` }),
          },
          verifierRubric: {
            keepWhen: ['A project declares mock-pkg-a in package.json dependencies'],
            dropWhen: ['The package is unreferenced or unused'],
          },
        };

        const ruleB: AnalyzerRule = {
          id: 'test-multirule/css-rule',
          guideId: 'test-multirule',
          guideHash: '111122223333',
          summary: 'Summary for Rule B (CSS style workaround)',
          matcher: {
            kind: 'css',
            fastTokens: ['.custom-style'],
            matchRule: (rule) =>
              rule.selectorText.includes('.custom-style')
                ? { message: 'Replace .custom-style with modern CSS container queries' }
                : null,
          },
          verifierRubric: {
            keepWhen: ['CSS rule uses .custom-style to simulate responsive tables'],
            dropWhen: ['Stylesheet already uses @container queries'],
          },
        };

        // 1. Only Rule B matches (CSS file present, no package.json dependency)
        await writeFile(join(testDir, 'style.css'), '.custom-style { color: red; }', 'utf8');

        const resBOnly = await runAnalyzeCli([testDir, '--json'], { rules: [ruleA, ruleB] });
        assert.equal(resBOnly.exitCode, 0);
        const parsedBOnly = JSON.parse(resBOnly.output) as AnalyzeJsonOutput;
        assert.equal(parsedBOnly.totalFindings, 1);

        const guideBOnly = parsedBOnly.guides[0];
        assert.ok(guideBOnly);
        assert.equal(guideBOnly.guideId, 'test-multirule');
        assert.equal(guideBOnly.rules.length, 1);
        const ruleGroupBOnly = guideBOnly.rules[0];
        assert.ok(ruleGroupBOnly);
        assert.equal(ruleGroupBOnly.ruleId, 'test-multirule/css-rule');
        assert.equal(ruleGroupBOnly.summary, 'Summary for Rule B (CSS style workaround)');
        assert.deepEqual(ruleGroupBOnly.verifierRubric, ruleB.verifierRubric);
        assert.equal(ruleGroupBOnly.findings[0]?.lineContent, '.custom-style { color: red; }');

        // When only 1 rule fires under a guide, omit the redundant rule subheader
        const resHumanBOnly = await runAnalyzeCli([testDir], { rules: [ruleA, ruleB] });
        assert.ok(!resHumanBOnly.output.includes('  test-multirule/css-rule (1 finding)'));
        assert.ok(resHumanBOnly.output.includes('Summary for Rule B (CSS style workaround)'));
        assert.ok(!resHumanBOnly.output.includes('Summary for Rule A'));
        assert.ok(resHumanBOnly.output.includes('CSS rule uses .custom-style'));

        // 2. Both Rule A and Rule B match (add package.json with mock-pkg-a)
        await writeFile(
          join(testDir, 'package.json'),
          JSON.stringify({ dependencies: { 'mock-pkg-a': '^1.0.0' } }),
          'utf8',
        );

        const resBoth = await runAnalyzeCli([testDir, '--json'], { rules: [ruleA, ruleB] });
        assert.equal(resBoth.exitCode, 0);
        const parsedBoth = JSON.parse(resBoth.output) as AnalyzeJsonOutput;
        assert.equal(parsedBoth.totalFindings, 2);

        const guideBoth = parsedBoth.guides[0];
        assert.ok(guideBoth);
        assert.equal(guideBoth.rules.length, 2);

        const ruleGroupA = guideBoth.rules.find((r) => r.ruleId === 'test-multirule/package-rule');
        const ruleGroupB = guideBoth.rules.find((r) => r.ruleId === 'test-multirule/css-rule');
        assert.ok(ruleGroupA && ruleGroupB);
        assert.equal(ruleGroupA.summary, ruleA.summary);
        assert.deepEqual(ruleGroupA.verifierRubric, ruleA.verifierRubric);
        assert.equal(ruleGroupA.findings.length, 1);
        assert.equal(ruleGroupA.findings[0]?.file, 'package.json');
        assert.equal(ruleGroupB.summary, ruleB.summary);
        assert.deepEqual(ruleGroupB.verifierRubric, ruleB.verifierRubric);
        assert.equal(ruleGroupB.findings.length, 1);
        assert.equal(ruleGroupB.findings[0]?.file, 'style.css');

        // Human output renders multi-rule guide with distinct rule subheaders when >1 rule fires
        const resHumanBoth = await runAnalyzeCli([testDir], { rules: [ruleA, ruleB] });
        assert.ok(resHumanBoth.output.includes('2 findings across 2 rules'));
        assert.ok(resHumanBoth.output.includes('test-multirule/package-rule (1 finding)'));
        assert.ok(resHumanBoth.output.includes('test-multirule/css-rule (1 finding)'));
        assert.ok(resHumanBoth.output.includes('Summary for Rule A'));
        assert.ok(resHumanBoth.output.includes('Summary for Rule B'));

        // 3. Fail fast: a rule without a summary throws an error rather than silent fallback
        const brokenRule: AnalyzerRule = {
          ...ruleA,
          id: 'test-multirule/broken-rule',
          summary: '   ',
        };
        await assert.rejects(
          () => runAnalyzeCli([testDir, '--json'], { rules: [brokenRule] }),
          /Rule "test-multirule\/broken-rule" is missing a required summary string/,
        );
      });
    });
  });
});
