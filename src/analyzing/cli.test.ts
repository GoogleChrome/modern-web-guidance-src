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
import {
  ALL_RULES,
  QUALIFIED_GUIDE_IDS,
  QUALIFIED_RULES,
} from './rules/index.ts';
import type { AnalyzerRule } from './schema.ts';

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
      // Default mode with qualified guides
      const resDefault = await runAnalyzeCli([emptyDir]);
      assert.equal(resDefault.exitCode, 0);
      assert.match(
        resDefault.output,
        new RegExp(`0 findings from ${QUALIFIED_GUIDE_IDS.length} qualified guides \\(pass --experimental to include experimental guides\\)\\.`),
      );

      const resDefaultJson = await runAnalyzeCli([emptyDir, '--json']);
      assert.equal(resDefaultJson.exitCode, 0);
      const parsedDefault = JSON.parse(resDefaultJson.output) as AnalyzeJsonOutput;
      assert.equal(parsedDefault.totalFindings, 0);
      assert.deepEqual(parsedDefault.guides, []);
      assert.equal(parsedDefault.targetDir, emptyDir);
      assert.equal(parsedDefault.activeRuleCount, QUALIFIED_RULES.length);
      assert.equal(parsedDefault.activeGuideCount, QUALIFIED_GUIDE_IDS.length);

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
      assert.ok(guide.verifierRubric, 'Expected verifierRubric in guide JSON output');
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
      // 1. Create a pattern from an experimental guide: complex-shapes
      const maskCss = `.icon {\n  -webkit-mask-image: url('icon.svg');\n}`;
      await writeFile(join(testDir, 'mask.css'), maskCss, 'utf8');

      // 2. Create experimental patterns: break-up-long-tasks, coordinate-global-events
      const yieldJs = `const yieldToMain = () => new Promise(r => setTimeout(r));`;
      await writeFile(join(testDir, 'yield.js'), yieldJs, 'utf8');

      const timezoneJs = `function getLocalTimezoneOffset() {
  const offsetMinutes = new Date().getTimezoneOffset();
  return offsetMinutes * 60 * 1000;
}`;
      await writeFile(join(testDir, 'timezone.js'), timezoneJs, 'utf8');

      // Default run (QUALIFIED_RULES only; experimental patterns do not match default)
      const resDefault = await runAnalyzeCli([testDir, '--json']);
      assert.equal(resDefault.exitCode, 0);
      const parsedDefault = JSON.parse(resDefault.output) as AnalyzeJsonOutput;
      assert.equal(parsedDefault.totalFindings, 0);
      assert.deepEqual(parsedDefault.guides, []);
      assert.equal(parsedDefault.activeRuleCount, QUALIFIED_RULES.length);
      assert.equal(parsedDefault.statusNotice, undefined);

      // Opt-in run with --all-rules (or --experimental)
      const resAll = await runAnalyzeCli([testDir, '--all-rules', '--json']);
      assert.equal(resAll.exitCode, 0);
      const parsedAll = JSON.parse(resAll.output) as AnalyzeJsonOutput;
      assert.equal(parsedAll.activeRuleCount, ALL_RULES.length);
      assert.equal(parsedAll.activeGuideCount, new Set(ALL_RULES.map((r) => r.guideId)).size);
      const allGuideIds = parsedAll.guides.map((g) => g.guideId);

      assert.ok(
        allGuideIds.includes('complex-shapes'),
        'All-rules includes experimental rule complex-shapes',
      );
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

    it('skips docs, examples, demo, test, spec, and fixtures by default with --include-docs-and-tests opt-in', async () => {
      const testDir = await mkdtemp(join(tmpdir(), 'analyzer-r64-test-'));
      try {
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
        await mkdirAndWrite('test.html'); // Standalone test.* at root

        // Minified file under docs/ should NOT be counted in skipped count (scanner ignores minified anyway)
        await mkdirAndWrite('docs/bundle.min.js');

        // 1. Default run (--json): only src/login.html is reported, skippedDocsAndTestsCount is 9
        const resJson = await runAnalyzeCli([testDir, '--json']);
        assert.equal(resJson.exitCode, 0);
        const parsed = JSON.parse(resJson.output) as AnalyzeJsonOutput;
        assert.equal(parsed.totalFindings, 1);
        assert.equal(parsed.guides[0]?.findings[0]?.file, join('src', 'login.html').replace(/\\/g, '/'));
        assert.equal(parsed.skippedDocsAndTestsCount, 9);

        // 2. Default human-readable output: includes one dim line reporting skipped count
        const resHuman = await runAnalyzeCli([testDir]);
        assert.equal(resHuman.exitCode, 0);
        assert.ok(
          resHuman.output.includes('Skipped 9 docs and test files (pass --include-docs-and-tests to scan).'),
          'Human output must include dim line with skipped count',
        );

        // 3. Opt-in with --include-docs-and-tests: all 10 scannable files are scanned
        const resIncluded = await runAnalyzeCli([testDir, '--include-docs-and-tests', '--json']);
        assert.equal(resIncluded.exitCode, 0);
        const parsedIncluded = JSON.parse(resIncluded.output) as AnalyzeJsonOutput;
        assert.equal(parsedIncluded.totalFindings, 10);
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

    it('accurately associates each finding with its own rule summary and rubric in multi-rule guides', async () => {
      const testDir = await mkdtemp(join(tmpdir(), 'analyzer-multirule-test-'));
      try {
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
            matchRule: (rule) => {
              if (rule.selectorText.includes('.custom-style')) {
                return { message: 'Replace .custom-style with modern CSS container queries' };
              }
              return null;
            },
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
        // Must show Rule B's summary and rubric, NOT Rule A's!
        assert.equal(guideBOnly.summary, 'Summary for Rule B (CSS style workaround)');
        assert.deepEqual(guideBOnly.verifierRubric, ruleB.verifierRubric);
        assert.equal(guideBOnly.findings[0]?.summary, 'Summary for Rule B (CSS style workaround)');
        assert.deepEqual(guideBOnly.findings[0]?.verifierRubric, ruleB.verifierRubric);

        const resHumanBOnly = await runAnalyzeCli([testDir], { rules: [ruleA, ruleB] });
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
        assert.ok(guideBoth.rules && guideBoth.rules.length === 2);

        const ruleGroupA = guideBoth.rules.find((r) => r.ruleId === 'test-multirule/package-rule');
        const ruleGroupB = guideBoth.rules.find((r) => r.ruleId === 'test-multirule/css-rule');
        assert.ok(ruleGroupA && ruleGroupB);
        assert.equal(ruleGroupA.summary, ruleA.summary);
        assert.deepEqual(ruleGroupA.verifierRubric, ruleA.verifierRubric);
        assert.equal(ruleGroupB.summary, ruleB.summary);
        assert.deepEqual(ruleGroupB.verifierRubric, ruleB.verifierRubric);

        // Every finding in findings array has its own rule's summary and rubric
        const findingA = guideBoth.findings.find((f) => f.ruleId === 'test-multirule/package-rule');
        const findingB = guideBoth.findings.find((f) => f.ruleId === 'test-multirule/css-rule');
        assert.ok(findingA && findingB);
        assert.equal(findingA.summary, ruleA.summary);
        assert.deepEqual(findingA.verifierRubric, ruleA.verifierRubric);
        assert.equal(findingB.summary, ruleB.summary);
        assert.deepEqual(findingB.verifierRubric, ruleB.verifierRubric);

        // Human output renders multi-rule guide with distinct rule blocks
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
          summary: '   ', // whitespace / empty
        };
        await assert.rejects(
          async () => {
            await runAnalyzeCli([testDir, '--json'], { rules: [brokenRule] });
          },
          /Rule "test-multirule\/broken-rule" is missing a required summary string/,
        );
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });
  });
});
