import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  elideText,
  extractTargetCodeLine,
  formatHumanReadable,
  runAnalyzeCli,
  sampleDiversifiedFindings,
  type AnalyzeCliFinding,
  type AnalyzeJsonOutput,
} from './cli.ts';
import { ALL_RULES } from './rules/index.ts';

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
    const parsed = JSON.parse(resJson.output) as AnalyzeJsonOutput;
    assert.equal(parsed.totalFindings, 0);
    assert.equal(parsed.guides.length, 0);
    assert.match(parsed.error ?? '', /Target directory not found/);
  });

  it('reports zero findings cleanly in default qualified mode', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'analyzer-empty-test-'));
    try {
      // Default mode with 6 qualified guides
      const resDefault = await runAnalyzeCli([emptyDir]);
      assert.equal(resDefault.exitCode, 0);
      assert.match(resDefault.output, /0 findings from 6 qualified guides \(pass --experimental to include experimental guides\)\./);
      assert.doesNotMatch(resDefault.output, /suspended pending re-validation/);

      const resDefaultJson = await runAnalyzeCli([emptyDir, '--json']);
      assert.equal(resDefaultJson.exitCode, 0);
      const parsedDefault = JSON.parse(resDefaultJson.output) as AnalyzeJsonOutput;
      assert.equal(parsedDefault.totalFindings, 0);
      assert.deepEqual(parsedDefault.guides, []);
      assert.equal(parsedDefault.targetDir, emptyDir);
      assert.equal(parsedDefault.activeRuleCount, 8);
      assert.equal(parsedDefault.activeGuideCount, 6);

      // With --all-rules on an actually empty directory, reports no modernization opportunities found
      const resAllEmpty = await runAnalyzeCli([emptyDir, '--all-rules']);
      assert.equal(resAllEmpty.exitCode, 0);
      assert.match(resAllEmpty.output, /No modernization opportunities found/);
      assert.doesNotMatch(resAllEmpty.output, /provisional and need verification/);
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });

  it('reports zero findings in human-readable output in default mode', () => {
    const reducedZeroOutput = formatHumanReadable('/tmp/project', 0, [], undefined, {
      activeRuleCount: 1,
      activeGuideCount: 1,
      isDefaultQualifiedMode: true,
    });
    assert.match(reducedZeroOutput, /0 findings from 1 qualified guide \(pass --experimental to include experimental guides\)\./);
    assert.doesNotMatch(reducedZeroOutput, /suspended pending re-validation/);
  });

  it('outputs human-readable grouped summary with retrieveCommand and file:line', async () => {
    const testDir = await mkdtemp(join(tmpdir(), 'analyzer-human-test-'));
    try {
      // 1. Create HTML file triggering autofill-sign-in-form
      const htmlContent = `<form action="/login" method="POST">
  <label for="username">Username</label>
  <input type="text" id="username" name="username">
  <label for="password">Password</label>
  <input type="password" id="password" name="password">
  <button type="submit">Sign In</button>
</form>`;
      await writeFile(join(testDir, 'login.html'), htmlContent, 'utf8');

      // 2. Create CSS file triggering animate-to-intrinsic-sizes
      const cssContent = `.accordion-panel {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease-out;
}
.accordion-panel.open {
  max-height: 500px;
}`;
      await writeFile(join(testDir, 'accordion.css'), cssContent, 'utf8');

      const res = await runAnalyzeCli(['analyze', testDir, '--all-rules']);
      assert.equal(res.exitCode, 0);

      // Check header and provisional notice
      assert.match(res.output, /Modern Web Guidance Analyzer —/);
      assert.match(res.output, /Found \d+ modernization opportunities across \d+ guides:/);
      assert.match(
        res.output,
        /Note: Static analysis results are provisional — verify against the Keep\/Drop criteria below\./,
      );

      // Check guide grouping, title line, rubric lines, and code preview
      assert.match(res.output, /\* autofill-sign-in-form \[qualified\] \(\d+ findings?\)/);
      assert.match(res.output, /Keep when:/);
      assert.match(res.output, /Drop when:/);
      assert.match(res.output, /- login\.html:\d+/);
      assert.match(res.output, /<input type="password"/);

      assert.match(
        res.output,
        /\* animate-to-intrinsic-sizes \[experimental\] \(\d+ findings?\)/,
      );
      assert.match(res.output, /- accordion\.css:\d+/);
      assert.match(res.output, /\.accordion-panel \{/);

      // Check single bottom footer
      assert.match(
        res.output,
        /Retrieve a guide: npx modern-web-guidance retrieve <guide-id> \(or pass --json for coding agents\)/,
      );
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('outputs structured JSON conforming to agent contract with --json', async () => {
    const testDir = await mkdtemp(join(tmpdir(), 'analyzer-json-test-'));
    try {
      const htmlContent = `<form action="/auth" method="POST">
  <input type="text" name="user">
  <input type="password" name="pass">
</form>`;
      await writeFile(join(testDir, 'auth.html'), htmlContent, 'utf8');

      const res = await runAnalyzeCli([testDir, '--all-rules', '--json']);
      assert.equal(res.exitCode, 0);

      const parsed = JSON.parse(res.output) as AnalyzeJsonOutput;
      assert.equal(parsed.targetDir, testDir);
      assert.ok(parsed.totalFindings >= 1);
      assert.ok(Array.isArray(parsed.guides));
      assert.ok(parsed.guides.length >= 1);

      const guide = parsed.guides.find((g) => g.guideId === 'autofill-sign-in-form');
      assert.ok(guide, 'Expected autofill-sign-in-form guide in JSON output');
      assert.ok(guide.verifierRubric, 'Expected verifierRubric in guide JSON output (R17)');
      assert.ok(guide.verifierRubric.keepWhen.length >= 1);
      assert.ok(guide.verifierRubric.dropWhen.length >= 1);
      assert.equal(guide.tier, 'qualified');
      assert.equal(guide.retrieveCommand, 'npx modern-web-guidance retrieve autofill-sign-in-form');
      assert.ok(guide.summary.length > 0);
      assert.equal(guide.count, guide.findings.length);

      const finding = guide.findings[0];
      assert.ok(finding);
      assert.equal(finding.ruleId, 'autofill-sign-in-form');
      assert.equal(finding.file, 'auth.html');
      assert.ok(typeof finding.line === 'number');
      assert.ok(finding.message.length > 0);
      assert.ok(finding.codeSnippet.length > 0);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('filters analysis strictly to specified --guide <guideId>', async () => {
    const testDir = await mkdtemp(join(tmpdir(), 'analyzer-filter-test-'));
    try {
      // 1. Create HTML file triggering autofill-sign-in-form
      const htmlContent = `<form action="/login" method="POST">
  <input type="password" name="password">
</form>`;
      await writeFile(join(testDir, 'login.html'), htmlContent, 'utf8');

      // 2. Create CSS file triggering animate-to-intrinsic-sizes
      const cssContent = `.panel {
  max-height: 0;
  transition: max-height 0.25s ease;
}`;
      await writeFile(join(testDir, 'panel.css'), cssContent, 'utf8');

      // Analyze with --guide animate-to-intrinsic-sizes
      const resCssOnly = await runAnalyzeCli([
        testDir,
        '--guide',
        'animate-to-intrinsic-sizes',
        '--json',
      ]);
      assert.equal(resCssOnly.exitCode, 0);
      const parsedCss = JSON.parse(resCssOnly.output) as AnalyzeJsonOutput;
      assert.ok(parsedCss.guides.every((g) => g.guideId === 'animate-to-intrinsic-sizes'));
      assert.ok(parsedCss.guides.length === 1);
      assert.equal(parsedCss.guides[0].guideId, 'animate-to-intrinsic-sizes');

      // Analyze with --guide autofill-sign-in-form
      const resHtmlOnly = await runAnalyzeCli([
        testDir,
        '--guide',
        'autofill-sign-in-form',
        '--json',
      ]);
      assert.equal(resHtmlOnly.exitCode, 0);
      const parsedHtml = JSON.parse(resHtmlOnly.output) as AnalyzeJsonOutput;
      assert.ok(parsedHtml.guides.every((g) => g.guideId === 'autofill-sign-in-form'));
      assert.ok(parsedHtml.guides.length === 1);
      assert.equal(parsedHtml.guides[0].guideId, 'autofill-sign-in-form');

      // Analyze with non-matching guide
      const resNone = await runAnalyzeCli([
        testDir,
        '--guide',
        'non-matching-guide',
        '--json',
      ]);
      assert.equal(resNone.exitCode, 0);
      const parsedNone = JSON.parse(resNone.output) as AnalyzeJsonOutput;
      assert.equal(parsedNone.totalFindings, 0);
      assert.deepEqual(parsedNone.guides, []);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('gates CLI to QUALIFIED_RULES by default and includes experimental rules with --all-rules', async () => {
    const testDir = await mkdtemp(join(tmpdir(), 'analyzer-rules-gate-test-'));
    try {
      // 1. Create a pattern from a suspended guide: autofill-highlight-inputs
      const autofillCss = `input:-webkit-autofill {
  box-shadow: 0 0 0 1000px white inset;
}`;
      await writeFile(join(testDir, 'autofill.css'), autofillCss, 'utf8');

      // 2. Create experimental patterns: break-up-long-tasks, coordinate-global-events
      const yieldJs = `const yieldToMain = () => new Promise(r => setTimeout(r));`;
      await writeFile(join(testDir, 'yield.js'), yieldJs, 'utf8');

      const timezoneJs = `function getLocalTimezoneOffset() {
  const offsetMinutes = new Date().getTimezoneOffset();
  return offsetMinutes * 60 * 1000;
}`;
      await writeFile(join(testDir, 'timezone.js'), timezoneJs, 'utf8');

      // Default run (QUALIFIED_RULES only - 6 guides active; neither suspended nor experimental patterns match default)
      const resDefault = await runAnalyzeCli([testDir, '--json']);
      assert.equal(resDefault.exitCode, 0);
      const parsedDefault = JSON.parse(resDefault.output) as AnalyzeJsonOutput;
      assert.equal(parsedDefault.totalFindings, 0);
      assert.deepEqual(parsedDefault.guides, []);
      assert.equal(parsedDefault.activeRuleCount, 8);
      assert.deepEqual(parsedDefault.suspendedGuides, [
        'autofill-highlight-inputs',
        'complex-shapes',
        'interactions-in-complex-layouts',
        'language-detection',
      ]);
      assert.equal(parsedDefault.statusNotice, undefined);

      // Opt-in run with --all-rules (or --experimental)
      const resAll = await runAnalyzeCli([testDir, '--all-rules', '--json']);
      assert.equal(resAll.exitCode, 0);
      const parsedAll = JSON.parse(resAll.output) as AnalyzeJsonOutput;
      assert.equal(parsedAll.activeRuleCount, ALL_RULES.length);
      assert.equal(parsedAll.activeGuideCount, new Set(ALL_RULES.map((r) => r.guideId)).size);
      const allGuideIds = parsedAll.guides.map((g) => g.guideId);

      assert.ok(
        allGuideIds.includes('break-up-long-tasks'),
        'All-rules includes experimental rule break-up-long-tasks',
      );
      assert.ok(
        allGuideIds.includes('coordinate-global-events'),
        'All-rules includes experimental rule coordinate-global-events',
      );

      // Verify --experimental alias also works
      const resExperimental = await runAnalyzeCli([testDir, '--experimental', '--json']);
      assert.equal(resExperimental.exitCode, 0);
      const parsedExp = JSON.parse(resExperimental.output) as AnalyzeJsonOutput;
      assert.ok(
        parsedExp.guides.some((g) => g.guideId === 'break-up-long-tasks'),
        '--experimental alias enables experimental rules',
      );
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('caps terminal findings at 5 per guide and renders overflow summary line', async () => {
    const testDir = await mkdtemp(join(tmpdir(), 'analyzer-overflow-test-'));
    try {
      // Create 8 files each with an autofill pattern to exceed 5 findings
      for (let i = 1; i <= 8; i++) {
        const html = `<form action="/login${i}" method="POST">
  <input type="password" name="password">
</form>`;
        await writeFile(join(testDir, `form${i}.html`), html, 'utf8');
      }

      const res = await runAnalyzeCli([testDir, '--all-rules']);
      assert.equal(res.exitCode, 0);

      // Terminal output should cap findings at 5 and print overflow line
      assert.match(res.output, /\.\.\. and 3 more findings/);

      // Verify JSON output still has all 8 findings un-truncated
      const resJson = await runAnalyzeCli([testDir, '--all-rules', '--json']);
      assert.equal(resJson.exitCode, 0);
      const parsedJson = JSON.parse(resJson.output) as AnalyzeJsonOutput;
      assert.equal(parsedJson.totalFindings, 8);
      assert.equal(parsedJson.guides[0].findings.length, 8);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('helper utilities and formatting', () => {
    it('elideText truncates and elides long lines gracefully', () => {
      assert.equal(elideText('short text', 20), 'short text');
      assert.equal(
        elideText('a'.repeat(30), 10),
        'aaaaaaaaa…',
      );
      assert.equal(elideText('  multiple   whitespace   chars  ', 50), 'multiple whitespace chars');
    });

    it('extractTargetCodeLine extracts marked target lines and cleans up formatting', () => {
      const snippetWithMarker = `   1 | line 1\n>  2 |   <input type="password" name="pwd">   \n   3 | line 3`;
      assert.equal(
        extractTargetCodeLine(snippetWithMarker, 80),
        '<input type="password" name="pwd">',
      );

      const snippetWithoutMarker = `  42 |    .class { display: none; }   `;
      assert.equal(
        extractTargetCodeLine(snippetWithoutMarker, 80),
        '.class { display: none; }',
      );

      assert.equal(extractTargetCodeLine(''), '');
    });

    it('sampleDiversifiedFindings diversifies max 2 findings per file first up to cap', () => {
      const makeFinding = (file: string, id: string): AnalyzeCliFinding => ({
        ruleId: 'r1',
        file,
        line: 1,
        message: id,
        codeSnippet: '> 1 | line',
      });

      // 3 files with 3 findings each (9 findings total)
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

      const sampled = sampleDiversifiedFindings(findings, 5, 2);
      assert.equal(sampled.length, 5);

      // Round 0 takes a1, b1, c1; Round 1 takes a2, b2 -> total 5
      assert.deepEqual(
        sampled.map((f) => f.message),
        ['a1', 'b1', 'c1', 'a2', 'b2'],
      );
    });

    it('formatHumanReadable emits ANSI styling when color option is enabled', () => {
      const outputColor = formatHumanReadable(
        '/workspace',
        1,
        [
          {
            guideId: 'autofill-sign-in-form',
            tier: 'qualified',
            summary: 'Autocomplete guidance summary',
            retrieveCommand: 'npx retrieve autofill-sign-in-form',
            count: 1,
            findings: [
              {
                ruleId: 'autofill-sign-in-form',
                file: 'src/login.html',
                line: 10,
                message: 'Missing autocomplete',
                codeSnippet: '> 10 | <input type="password">',
              },
            ],
          },
        ],
        undefined,
        { color: true },
      );

      // Should contain ANSI escape codes \u001b[
      assert.ok(outputColor.includes('\u001b['), 'Expected ANSI styling codes in colored output');
      assert.ok(outputColor.includes('autofill-sign-in-form'));
      assert.ok(outputColor.includes('[qualified]'));

      const outputNoColor = formatHumanReadable(
        '/workspace',
        1,
        [
          {
            guideId: 'autofill-sign-in-form',
            tier: 'qualified',
            summary: 'Autocomplete guidance summary',
            retrieveCommand: 'npx retrieve autofill-sign-in-form',
            count: 1,
            findings: [
              {
                ruleId: 'autofill-sign-in-form',
                file: 'src/login.html',
                line: 10,
                message: 'Missing autocomplete',
                codeSnippet: '> 10 | <input type="password">',
              },
            ],
          },
        ],
        undefined,
        { color: false },
      );

      assert.ok(!outputNoColor.includes('\u001b['), 'Expected no ANSI escape codes when color=false');
    });

    it('skips docs, examples, demo, test, spec, and fixtures by default with --include-docs-and-tests opt-in (R64)', async () => {
      const testDir = await mkdtemp(join(tmpdir(), 'analyzer-r64-test-'));
      try {
        const passwordHtml = '<form><input type="password" name="password"></form>';
        const mkdirAndWrite = async (relPath: string) => {
          const full = join(testDir, relPath);
          await mkdir(join(full, '..'), { recursive: true });
          await writeFile(full, passwordHtml, 'utf8');
        };

        // App file (should be scanned)
        await mkdirAndWrite('src/login.html');

        // Docs / example / demo / test / spec / fixtures paths (should be skipped by default)
        await mkdirAndWrite('docs/sample.html');
        await mkdirAndWrite('examples/demo.html');
        await mkdirAndWrite('demo/page.html');
        await mkdirAndWrite('test/login.html');
        await mkdirAndWrite('spec/login.html');
        await mkdirAndWrite('fixtures/login.html');
        await mkdirAndWrite('src/login.test.html');
        await mkdirAndWrite('src/login.spec.html');

        // 1. Default run (--json): only src/login.html is reported, skippedDocsAndTestsCount is 8
        const resJson = await runAnalyzeCli([testDir, '--json']);
        assert.equal(resJson.exitCode, 0);
        const parsed = JSON.parse(resJson.output) as AnalyzeJsonOutput;
        assert.equal(parsed.totalFindings, 1);
        assert.equal(parsed.guides[0]?.findings[0]?.file, join('src', 'login.html').replace(/\\/g, '/'));
        assert.equal(parsed.skippedDocsAndTestsCount, 8);

        // 2. Default human-readable output: includes one dim line reporting skipped count
        const resHuman = await runAnalyzeCli([testDir]);
        assert.equal(resHuman.exitCode, 0);
        assert.ok(
          resHuman.output.includes('Skipped 8 docs and test files (pass --include-docs-and-tests to scan).'),
          'Human output must include dim line with skipped count',
        );

        // 3. Opt-in with --include-docs-and-tests: all 9 files are scanned
        const resIncluded = await runAnalyzeCli([testDir, '--include-docs-and-tests', '--json']);
        assert.equal(resIncluded.exitCode, 0);
        const parsedIncluded = JSON.parse(resIncluded.output) as AnalyzeJsonOutput;
        assert.equal(parsedIncluded.totalFindings, 9);
        assert.equal(parsedIncluded.skippedDocsAndTestsCount, undefined);

        // 4. "Relative to target dir": analyze ./docs still scans docs
        const docsDir = join(testDir, 'docs');
        const resDocs = await runAnalyzeCli([docsDir, '--json']);
        assert.equal(resDocs.exitCode, 0);
        const parsedDocs = JSON.parse(resDocs.output) as AnalyzeJsonOutput;
        assert.equal(parsedDocs.totalFindings, 1);
        assert.equal(parsedDocs.guides[0]?.findings[0]?.file, 'sample.html');
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });
  });
});
