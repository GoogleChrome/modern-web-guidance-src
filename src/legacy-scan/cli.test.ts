import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import {
  CLI_HELP,
  elideText,
  formatHumanReadable,
  runLegacyScanCli,
  sampleDiversifiedFindings,
  writeLegacyScanCliResult,
  type CliFinding,
  type CliGuideGroup,
  type ScanJsonOutput,
} from './cli.ts';
import {
  QUALIFIED_GUIDE_IDS,
  QUALIFIED_RULES,
} from './rules/index.ts';
import { MAX_SOURCE_FILE_BYTES } from './scanners/index.ts';
import type { ScanRule } from './schema.ts';

// Ensure consistent output without ANSI escape codes in tests (https://no-color.org)
process.env.NO_COLOR = '1';

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'legacy-scan-cli-test-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('runLegacyScanCli', () => {
  it('handles help flags (-h, --help)', async () => {
    const res1 = await runLegacyScanCli(['--help']);
    assert.equal(res1.exitCode, 0);
    assert.match(res1.output, /Usage: modern-web-guidance legacy-scan/);
    assert.equal(res1.output, `${CLI_HELP}\n`);

    const res2 = await runLegacyScanCli(['legacy-scan', '-h']);
    assert.equal(res2.exitCode, 0);
    assert.match(res2.output, /Usage: modern-web-guidance legacy-scan/);
    assert.equal(res2.output, `${CLI_HELP}\n`);

    const res3 = await runLegacyScanCli(['analyze', '-h']);
    assert.equal(res3.exitCode, 0);
    assert.match(res3.output, /Usage: modern-web-guidance legacy-scan/);
    assert.equal(res3.output, `${CLI_HELP}\n`);
  });

  it('handles non-existent target path with error and exit code 1', async () => {
    const nonExistentPath = join(tmpdir(), `non-existent-dir-${Date.now()}`);
    const resHuman = await runLegacyScanCli([nonExistentPath]);
    assert.equal(resHuman.exitCode, 1);
    assert.match(resHuman.output, /Error: Target path not found/);

    const resJson = await runLegacyScanCli([nonExistentPath, '--json']);
    assert.equal(resJson.exitCode, 1);
    assert.ok(resJson.data, 'Expected data payload on --json error');
    const parsed = JSON.parse(resJson.output) as ScanJsonOutput;
    assert.equal(parsed.totalFindings, 0);
    assert.equal(parsed.guides.length, 0);
    assert.match(parsed.error ?? '', /Target path not found/);

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

      assert.equal(writeLegacyScanCliResult(resHuman), 1);
      assert.equal(process.exitCode, 1);
      assert.equal(stdoutChunks.length, 0);
      assert.equal(stderrChunks.length, 1);

      process.exitCode = 0;
      assert.equal(writeLegacyScanCliResult(resJson), 1);
      assert.equal(process.exitCode, 1);
      assert.equal(stdoutChunks.length, 1);
      assert.equal(stderrChunks.length, 1);
    } finally {
      process.stdout.write = origStdoutWrite;
      process.stderr.write = origStderrWrite;
      process.exitCode = origExitCode;
    }
  });

  it('rejects single target file exceeding MAX_SOURCE_FILE_BYTES with error and exit code 1', async () => {
    await withTempDir(async (testDir) => {
      const largeFile = join(testDir, 'large.html');
      await writeFile(largeFile, Buffer.alloc(MAX_SOURCE_FILE_BYTES + 10));

      const resHuman = await runLegacyScanCli([largeFile]);
      assert.equal(resHuman.exitCode, 1);
      assert.match(resHuman.output, /Error: Target file exceeds maximum size/);

      const resJson = await runLegacyScanCli([largeFile, '--json']);
      assert.equal(resJson.exitCode, 1);
      assert.ok(resJson.data, 'Expected data payload on --json error');
      const parsed = JSON.parse(resJson.output) as ScanJsonOutput;
      assert.equal(parsed.totalFindings, 0);
      assert.equal(parsed.guides.length, 0);
      assert.match(parsed.error ?? '', /Target file exceeds maximum size/);
    });
  });

  it('reports zero findings cleanly in default qualified mode', async () => {
    await withTempDir(async (emptyDir) => {
      const resDefault = await runLegacyScanCli([emptyDir]);
      assert.equal(resDefault.exitCode, 0);
      assert.match(
        resDefault.output,
        new RegExp(`0 findings from ${QUALIFIED_GUIDE_IDS.length} qualified guides\\.`),
      );
      assert.match(
        resDefault.output,
        new RegExp(
          `Note: legacy-scan covers legacy patterns for ${QUALIFIED_GUIDE_IDS.length} guides \\(~20% of the guidance corpus\\)\\. Use 'modern-web-guidance search <topic>' for general UI/platform guidance\\.`,
        ),
      );

      const resDefaultJson = await runLegacyScanCli([emptyDir, '--json']);
      assert.equal(resDefaultJson.exitCode, 0);
      const parsedDefault = JSON.parse(resDefaultJson.output) as ScanJsonOutput;
      assert.equal(parsedDefault.totalFindings, 0);
      assert.deepEqual(parsedDefault.guides, []);
      assert.deepEqual(parsedDefault.targets, [emptyDir]);
      assert.equal(parsedDefault.activeRuleCount, QUALIFIED_RULES.length);
      assert.equal(parsedDefault.activeGuideCount, QUALIFIED_GUIDE_IDS.length);
      assert.equal(
        parsedDefault.note,
        `No legacy patterns found across ${QUALIFIED_GUIDE_IDS.length} guides (${QUALIFIED_RULES.length} rules; ~20% of the guidance corpus). Use 'search <topic>' for feature-specific guidance.`,
      );
    });
  });

  it('reports zero findings in human-readable output in default mode', () => {
    const reducedZeroOutput = formatHumanReadable('/tmp/project', 0, [], undefined, {
      activeGuideCount: 1,
      isDefaultQualifiedMode: true,
    });
    assert.match(reducedZeroOutput, /0 findings from 1 qualified guide\./);
    assert.match(
      reducedZeroOutput,
      /Note: legacy-scan covers legacy patterns for 1 guide \(~20% of the guidance corpus\)\. Use 'modern-web-guidance search <topic>' for general UI\/platform guidance\./,
    );
  });

  it('accepts --skill-version without errors in both leading and trailing positions', async () => {
    await withTempDir(async (testDir) => {
      const resTrailing = await runLegacyScanCli([testDir, '--skill-version', '2026_01_01-test']);
      assert.equal(resTrailing.exitCode, 0);

      const resLeading = await runLegacyScanCli(['--skill-version', '2026_01_01-test', testDir]);
      assert.equal(resLeading.exitCode, 0);

      const resJson = await runLegacyScanCli([testDir, '--json', '--skill-version', '2026_01_01-test']);
      assert.equal(resJson.exitCode, 0);
      assert.ok(resJson.data);
      assert.equal(resJson.data.totalFindings, 0);
      assert.equal(
        resJson.data.note,
        `No legacy patterns found across ${QUALIFIED_GUIDE_IDS.length} guides (${QUALIFIED_RULES.length} rules; ~20% of the guidance corpus). Use 'search <topic>' for feature-specific guidance.`,
      );
    });
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

      const res = await runLegacyScanCli(['legacy-scan', testDir]);
      assert.equal(res.exitCode, 0);

      assert.match(res.output, /Modern Web Guidance legacy-scan —/);
      assert.match(
        res.output,
        new RegExp(
          `Found \\d+ modernization opportunities across \\d+ guides \\(scanned ${QUALIFIED_GUIDE_IDS.length} guides with deterministic rules; ~20% of the guidance corpus\\):`,
        ),
      );
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
        /Retrieve a guide: npx modern-web-guidance retrieve <guide-id>/,
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

      const res = await runLegacyScanCli([testDir, '--json']);
      assert.equal(res.exitCode, 0);

      const parsed = JSON.parse(res.output) as ScanJsonOutput;
      assert.deepEqual(parsed.targets, [testDir]);
      assert.ok(parsed.totalFindings >= 1);
      assert.equal(
        parsed.note,
        `Checked ${QUALIFIED_GUIDE_IDS.length} guides (${QUALIFIED_RULES.length} deterministic rules; ~20% of the guidance corpus). Finding ${parsed.totalFindings} ${parsed.totalFindings === 1 ? 'item' : 'items'} here only reflects deterministic legacy patterns; use 'search <topic>' for the rest of the catalog.`,
      );
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

      const resCssOnly = await runLegacyScanCli([
        testDir,
        '--guide',
        'animate-to-intrinsic-sizes',
        '--json',
      ]);
      assert.equal(resCssOnly.exitCode, 0);
      const parsedCss = JSON.parse(resCssOnly.output) as ScanJsonOutput;
      assert.deepEqual(parsedCss.guides.map((g) => g.guideId), ['animate-to-intrinsic-sizes']);

      const resHtmlOnly = await runLegacyScanCli([
        testDir,
        '--guide',
        'autofill-sign-in-form',
        '--json',
      ]);
      assert.equal(resHtmlOnly.exitCode, 0);
      const parsedHtml = JSON.parse(resHtmlOnly.output) as ScanJsonOutput;
      assert.deepEqual(parsedHtml.guides.map((g) => g.guideId), ['autofill-sign-in-form']);

      const resNone = await runLegacyScanCli([testDir, '--guide', 'non-matching-guide', '--json']);
      assert.equal(resNone.exitCode, 1);
      assert.ok(resNone.data, 'Expected data payload on --json error');
      assert.equal(resNone.data.totalFindings, 0);
      assert.deepEqual(resNone.data.guides, []);
      assert.match(resNone.data.error ?? '', /Unknown or unsupported legacy-scan guide ID: non-matching-guide/);

      const resNoneHuman = await runLegacyScanCli([testDir, '--guide', 'non-matching-guide']);
      assert.equal(resNoneHuman.exitCode, 1);
      assert.match(resNoneHuman.output, /Error: Unknown or unsupported legacy-scan guide ID: non-matching-guide/);
    });
  });

  it('runs QUALIFIED_RULES by default and rejects unknown flags (--all, --experimental, --jsno)', async () => {
    await withTempDir(async (testDir) => {
      await writeFile(
        join(testDir, 'transform.css'),
        `.card {\n  transform: translateX(10px) rotate(45deg);\n}`,
        'utf8',
      );

      const resDefault = await runLegacyScanCli([testDir, '--json']);
      assert.equal(resDefault.exitCode, 0);
      const parsedDefault = JSON.parse(resDefault.output) as ScanJsonOutput;
      assert.equal(parsedDefault.totalFindings, 0);
      assert.deepEqual(parsedDefault.guides, []);
      assert.equal(parsedDefault.activeRuleCount, QUALIFIED_RULES.length);

      const resAllHuman = await runLegacyScanCli([testDir, '--all']);
      assert.equal(resAllHuman.exitCode, 1);
      assert.equal(resAllHuman.data, undefined);
      assert.match(resAllHuman.output, /Error: Unknown option '--all'/);

      const resAllJson = await runLegacyScanCli([testDir, '--all', '--json']);
      assert.equal(resAllJson.exitCode, 1);
      assert.ok(resAllJson.data);
      const parsedAllJson = JSON.parse(resAllJson.output) as ScanJsonOutput;
      assert.match(parsedAllJson.error ?? '', /Unknown option '--all'/);

      const resExperimentalHuman = await runLegacyScanCli([testDir, '--experimental']);
      assert.equal(resExperimentalHuman.exitCode, 1);
      assert.match(resExperimentalHuman.output, /Error: Unknown option '--experimental'/);

      const resTypo = await runLegacyScanCli([testDir, '--jsno']);
      assert.equal(resTypo.exitCode, 1);
      assert.equal(resTypo.data, undefined);
      assert.match(resTypo.output, /Error: Unknown option '--jsno'/);
    });
  });

  it('skips string option values when resolving targets on parse error', async () => {
    const resSkillVer = await runLegacyScanCli([
      '--skill-version',
      '2026_01_01',
      '--unknown-flag',
      'some/dir',
      '--json',
    ]);
    assert.equal(resSkillVer.exitCode, 1);
    assert.ok(resSkillVer.data);
    const parsedSkillVer = JSON.parse(resSkillVer.output) as ScanJsonOutput;
    assert.deepEqual(parsedSkillVer.targets, ['some/dir']);
    assert.match(parsedSkillVer.error ?? '', /Unknown option '--unknown-flag'/);

    const resTwoPaths = await runLegacyScanCli(['a/dir', '--unknown-flag', 'b/file.html', '--json']);
    assert.equal(resTwoPaths.exitCode, 1);
    assert.deepEqual(resTwoPaths.data?.targets, ['a/dir', 'b/file.html']);

    const resGuide = await runLegacyScanCli([
      '--guide',
      'dialog-focus',
      '--unknown-flag',
      'other/dir',
      '--json',
    ]);
    assert.equal(resGuide.exitCode, 1);
    assert.ok(resGuide.data);
    const parsedGuide = JSON.parse(resGuide.output) as ScanJsonOutput;
    assert.deepEqual(parsedGuide.targets, ['other/dir']);
    assert.match(parsedGuide.error ?? '', /Unknown option '--unknown-flag'/);

    const resNoDir = await runLegacyScanCli([
      '--skill-version',
      '2026_01_01',
      '--unknown-flag',
      '--json',
    ]);
    assert.equal(resNoDir.exitCode, 1);
    assert.ok(resNoDir.data);
    const parsedNoDir = JSON.parse(resNoDir.output) as ScanJsonOutput;
    assert.deepEqual(parsedNoDir.targets, ['.']);

    const resMaxFiles = await runLegacyScanCli([
      '--max-files',
      '250',
      '--unknown-flag',
      'capped/dir',
      '--json',
    ]);
    assert.equal(resMaxFiles.exitCode, 1);
    assert.ok(resMaxFiles.data);
    const parsedMaxFiles = JSON.parse(resMaxFiles.output) as ScanJsonOutput;
    assert.deepEqual(parsedMaxFiles.targets, ['capped/dir']);
    assert.match(parsedMaxFiles.error ?? '', /Unknown option '--unknown-flag'/);
  });

  it('caps terminal findings at 5 per guide and renders overflow summary line', async () => {
    await withTempDir(async (testDir) => {
      for (let i = 1; i <= 8; i++) {
        const html = `<form action="/login${i}" method="POST">\n  <input type="password" name="password">\n</form>`;
        await writeFile(join(testDir, `form${i}.html`), html, 'utf8');
      }

      const res = await runLegacyScanCli([testDir]);
      assert.equal(res.exitCode, 0);
      assert.match(res.output, /\.\.\. and 3 more findings/);

      const resJson = await runLegacyScanCli([testDir, '--json']);
      assert.equal(resJson.exitCode, 0);
      const parsedJson = JSON.parse(resJson.output) as ScanJsonOutput;
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
      const makeFinding = (file: string, id: string): CliFinding => ({
        file,
        line: 1,
        message: id,
        lineContent: 'line',
      });

      const findings: CliFinding[] = [
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
      const fixtureGuides: CliGuideGroup[] = [
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

      const prevForce = process.env.FORCE_COLOR;
      try {
        process.env.FORCE_COLOR = '1';
        const outputEnvNoColor = formatHumanReadable('/workspace', 1, fixtureGuides);
        assert.ok(!outputEnvNoColor.includes('\u001b['), 'Expected NO_COLOR=1 to override FORCE_COLOR=1');
      } finally {
        if (prevForce === undefined) delete process.env.FORCE_COLOR;
        else process.env.FORCE_COLOR = prevForce;
      }
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

        const resJson = await runLegacyScanCli([testDir, '--json']);
        assert.equal(resJson.exitCode, 0);
        const parsed = JSON.parse(resJson.output) as ScanJsonOutput;
        assert.equal(parsed.totalFindings, 1);
        assert.equal(
          parsed.guides[0]?.rules[0]?.findings[0]?.file,
          join('src', 'login.html').replace(/\\/g, '/'),
        );
        assert.equal(parsed.skippedDocsAndTestsCount, 9);

        const resHuman = await runLegacyScanCli([testDir]);
        assert.equal(resHuman.exitCode, 0);
        assert.ok(
          resHuman.output.includes(
            'Skipped 9 docs and test files (pass --include-docs-and-tests to scan).',
          ),
          'Human output must include dim line with skipped count',
        );

        const resIncluded = await runLegacyScanCli([testDir, '--include-docs-and-tests', '--json']);
        assert.equal(resIncluded.exitCode, 0);
        const parsedIncluded = JSON.parse(resIncluded.output) as ScanJsonOutput;
        assert.equal(parsedIncluded.totalFindings, 10);
        assert.equal(parsedIncluded.skippedDocsAndTestsCount, undefined);

        const docsDir = join(testDir, 'docs');
        const resDocs = await runLegacyScanCli([docsDir, '--json']);
        assert.equal(resDocs.exitCode, 0);
        const parsedDocs = JSON.parse(resDocs.output) as ScanJsonOutput;
        assert.equal(parsedDocs.totalFindings, 1);
        assert.equal(parsedDocs.guides[0]?.rules[0]?.findings[0]?.file, 'sample.html');
      });
    });

    it('accurately associates each finding with its own rule summary and rubric in multi-rule guides', async () => {
      await withTempDir(async (testDir) => {
        const ruleA: ScanRule = {
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

        const ruleB: ScanRule = {
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

        const resBOnly = await runLegacyScanCli([testDir, '--json'], { rules: [ruleA, ruleB] });
        assert.equal(resBOnly.exitCode, 0);
        const parsedBOnly = JSON.parse(resBOnly.output) as ScanJsonOutput;
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
        const resHumanBOnly = await runLegacyScanCli([testDir], { rules: [ruleA, ruleB] });
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

        const resBoth = await runLegacyScanCli([testDir, '--json'], { rules: [ruleA, ruleB] });
        assert.equal(resBoth.exitCode, 0);
        const parsedBoth = JSON.parse(resBoth.output) as ScanJsonOutput;
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
        const resHumanBoth = await runLegacyScanCli([testDir], { rules: [ruleA, ruleB] });
        assert.ok(resHumanBoth.output.includes('2 findings across 2 rules'));
        assert.ok(resHumanBoth.output.includes('test-multirule/package-rule (1 finding)'));
        assert.ok(resHumanBoth.output.includes('test-multirule/css-rule (1 finding)'));
        assert.ok(resHumanBoth.output.includes('Summary for Rule A'));
        assert.ok(resHumanBoth.output.includes('Summary for Rule B'));

        // 3. Fail fast: a rule without a summary throws an error rather than silent fallback
        const brokenRule: ScanRule = {
          ...ruleA,
          id: 'test-multirule/broken-rule',
          summary: '   ',
        };
        await assert.rejects(
          () => runLegacyScanCli([testDir, '--json'], { rules: [brokenRule] }),
          /Rule "test-multirule\/broken-rule" is missing a required summary string/,
        );
      });
    });
  });

  it('scans a single file path and returns findings when legacy pattern exists, 0 after modernization', async () => {
    await withTempDir(async (testDir) => {
      const TEST_RULES: readonly ScanRule[] = [
        {
          id: 'test-single-file/form-autofill',
          guideId: 'autofill-sign-in-form',
          guideHash: '1234567890ab',
          summary: 'Add autocomplete attributes to sign-in form inputs',
          matcher: {
            kind: 'dom',
            selector: 'input[type="password"]',
            fastTokens: ['type="password"'],
            matchElement: (el) => {
              if (!el.hasAttribute('autocomplete')) {
                return { message: 'Password input missing autocomplete attribute' };
              }
              return null;
            },
          },
          verifierRubric: {
            keepWhen: ['Sign-in form inputs lack autocomplete attributes'],
            dropWhen: ['Inputs already declare autocomplete attributes'],
          },
        },
      ];

      const filePath = join(testDir, 'SignInForm.html');
      await writeFile(
        filePath,
        '<form action="/login"><input type="password" name="password"><button>Log In</button></form>',
        'utf8',
      );

      // 1. Initial scan on single file returns findings (exitCode 0)
      const resFindings = await runLegacyScanCli([filePath, '--json'], { rules: TEST_RULES });
      assert.equal(resFindings.exitCode, 0);
      assert.ok(resFindings.data, 'Expected JSON data in result');
      const parsedFindings = JSON.parse(resFindings.output) as ScanJsonOutput;
      assert.equal(parsedFindings.totalFindings, 1);
      assert.deepEqual(parsedFindings.targets, [filePath]);
      assert.equal(parsedFindings.guides.length, 1);
      assert.equal(parsedFindings.guides[0]?.guideId, 'autofill-sign-in-form');
      assert.equal(parsedFindings.guides[0]?.rules[0]?.findings[0]?.file, 'SignInForm.html');

      // Human-readable scan on single file also works
      const resHuman = await runLegacyScanCli([filePath], { rules: TEST_RULES });
      assert.equal(resHuman.exitCode, 0);
      assert.match(resHuman.output, /Found 1 modernization opportunity across 1 guide:/);
      assert.match(resHuman.output, /SignInForm\.html:1/);

      // Single file path containing "test" is not skipped by docs/tests filter
      const testFilePath = join(testDir, 'component.test.html');
      await writeFile(
        testFilePath,
        '<form action="/login"><input type="password" name="password"></form>',
        'utf8',
      );
      const resTestFile = await runLegacyScanCli([testFilePath, '--json'], { rules: TEST_RULES });
      assert.equal(resTestFile.exitCode, 0);
      const parsedTestFile = JSON.parse(resTestFile.output) as ScanJsonOutput;
      assert.equal(parsedTestFile.totalFindings, 1);

      // 2. Modernize the file: add autocomplete="current-password"
      await writeFile(
        filePath,
        '<form action="/login"><input type="password" name="password" autocomplete="current-password"><button>Log In</button></form>',
        'utf8',
      );

      // Scan modernized file returns 0 findings
      const resClean = await runLegacyScanCli([filePath, '--json'], { rules: TEST_RULES });
      assert.equal(resClean.exitCode, 0);
      assert.ok(resClean.data, 'Expected JSON data in result');
      const parsedClean = JSON.parse(resClean.output) as ScanJsonOutput;
      assert.equal(parsedClean.totalFindings, 0);
      assert.equal(parsedClean.scannedFileCount, 1);
      assert.deepEqual(parsedClean.guides, []);
    });
  });

  describe('--max-files option, precedence, validation, and truncation reporting', () => {
    it('documents --max-files <count> in CLI_HELP', () => {
      assert.match(CLI_HELP, /--max-files <count>\s+Maximum eligible files to scan \(default: 5000; 0 for unlimited\)/);
    });

    it('rejects invalid --max-files values before filesystem access with exit code 1', async () => {
      const nonExistentDir = join(tmpdir(), `never-touched-${Date.now()}`);
      const invalidValues = [
        '-1',
        '1.5',
        'abc',
        '',
        '+1',
        '1e3',
        '0x10',
        ' 5',
        '5 ',
        '   ',
        String(Number.MAX_SAFE_INTEGER + 1),
      ];

      for (const bad of invalidValues) {
        // `--max-files=<val>` always reaches parseMaxFilesCliOption (even when `<val>` starts with `-`)
        const resHumanEq = await runLegacyScanCli([nonExistentDir, `--max-files=${bad}`]);
        assert.equal(resHumanEq.exitCode, 1, `Expected exitCode 1 for --max-files=${JSON.stringify(bad)}`);
        assert.match(resHumanEq.output, /Error: Invalid --max-files value/);
        assert.doesNotMatch(resHumanEq.output, /Target path not found/);

        const resJsonEq = await runLegacyScanCli([nonExistentDir, `--max-files=${bad}`, '--json']);
        assert.equal(resJsonEq.exitCode, 1);
        assert.ok(resJsonEq.data);
        assert.deepEqual(resJsonEq.data.targets, [nonExistentDir]);
        assert.equal(resJsonEq.data.totalFindings, 0);
        assert.match(resJsonEq.data.error ?? '', /Invalid --max-files value/);

        // Space-separated `--max-files <val>` also fails with exitCode 1 before filesystem access
        const resHumanSpace = await runLegacyScanCli([nonExistentDir, '--max-files', bad]);
        assert.equal(resHumanSpace.exitCode, 1);
        assert.doesNotMatch(resHumanSpace.output, /Target path not found/);

        const resJsonSpace = await runLegacyScanCli([nonExistentDir, '--max-files', bad, '--json']);
        assert.equal(resJsonSpace.exitCode, 1);
        assert.deepEqual(resJsonSpace.data?.targets, [nonExistentDir]);
        assert.doesNotMatch(resJsonSpace.data?.error ?? '', /Target path not found/);
      }

      const missingVal = await runLegacyScanCli([nonExistentDir, '--max-files', '--json']);
      assert.equal(missingVal.exitCode, 1);
      assert.ok(missingVal.data?.error);
    });

    it('enforces precedence: --max-files CLI > programmatic options.maxFiles > default, and supports 0 as unlimited', async () => {
      await withTempDir(async (testDir) => {
        for (let i = 1; i <= 5; i++) {
          await writeFile(
            join(testDir, `form${i}.html`),
            `<form action="/login"><input type="password" name="p${i}"></form>`,
            'utf8',
          );
        }

        // Programmatic options.maxFiles applies when --max-files is omitted
        const resOptCap = await runLegacyScanCli([testDir, '--json'], { maxFiles: 2 });
        assert.equal(resOptCap.exitCode, 0);
        assert.equal(resOptCap.data?.totalFindings, 2);
        assert.equal(resOptCap.data?.scannedFileCount, 2);
        assert.equal(resOptCap.data?.eligibleFileCount, 5);
        assert.equal(resOptCap.data?.truncatedByMaxFiles, true);

        // Explicit --max-files overrides programmatic options.maxFiles (raising or lowering)
        const resCliOverrides = await runLegacyScanCli([testDir, '--max-files', '4', '--json'], {
          maxFiles: 2,
        });
        assert.equal(resCliOverrides.exitCode, 0);
        assert.equal(resCliOverrides.data?.totalFindings, 4);
        assert.equal(resCliOverrides.data?.scannedFileCount, 4);
        assert.equal(resCliOverrides.data?.eligibleFileCount, 5);
        assert.equal(resCliOverrides.data?.truncatedByMaxFiles, true);

        // --max-files 0 overrides programmatic cap and scans all files without truncation
        const resCliUnlimited = await runLegacyScanCli([testDir, '--max-files', '0', '--json'], {
          maxFiles: 2,
        });
        assert.equal(resCliUnlimited.exitCode, 0);
        assert.equal(resCliUnlimited.data?.totalFindings, 5);
        assert.equal(resCliUnlimited.data?.scannedFileCount, 5);
        assert.equal(resCliUnlimited.data?.truncatedByMaxFiles, undefined);
        assert.equal(resCliUnlimited.data?.eligibleFileCount, undefined);

        // Programmatic maxFiles: 0 is also unlimited
        const resOptUnlimited = await runLegacyScanCli([testDir, '--json'], { maxFiles: 0 });
        assert.equal(resOptUnlimited.exitCode, 0);
        assert.equal(resOptUnlimited.data?.totalFindings, 5);
        assert.equal(resOptUnlimited.data?.scannedFileCount, 5);
        assert.equal(resOptUnlimited.data?.truncatedByMaxFiles, undefined);

        // Exact boundary (--max-files 5 on 5 eligible files) must NOT report truncation
        const resExact = await runLegacyScanCli([testDir, '--max-files', '5', '--json']);
        assert.equal(resExact.exitCode, 0);
        assert.equal(resExact.data?.totalFindings, 5);
        assert.equal(resExact.data?.scannedFileCount, 5);
        assert.equal(resExact.data?.truncatedByMaxFiles, undefined);
        assert.equal(resExact.data?.eligibleFileCount, undefined);
        assert.doesNotMatch(resExact.data?.note ?? '', /Partial scan only/);

        // Invalid programmatic options.maxFiles fails fast
        await assert.rejects(() => runLegacyScanCli([testDir], { maxFiles: -1 }), RangeError);
        await assert.rejects(() => runLegacyScanCli([testDir], { maxFiles: 1.5 }), RangeError);
      });
    });

    it('reports honest partial-coverage diagnostics in --json and human output when truncated', async () => {
      await withTempDir(async (testDir) => {
        // First 2 alphabetical files are clean; 3rd-5th have legacy pattern
        await writeFile(join(testDir, 'a-clean.html'), '<p>clean</p>', 'utf8');
        await writeFile(join(testDir, 'b-clean.html'), '<p>clean</p>', 'utf8');
        for (let i = 3; i <= 5; i++) {
          await writeFile(
            join(testDir, `c-legacy-${i}.html`),
            `<form><input type="password" name="p${i}"></form>`,
            'utf8',
          );
        }

        // Default qualified mode, 0 findings in scanned subset (truncated)
        const zeroTruncJson = await runLegacyScanCli([testDir, '--max-files', '2', '--json']);
        assert.equal(zeroTruncJson.exitCode, 0);
        assert.equal(zeroTruncJson.data?.totalFindings, 0);
        assert.equal(zeroTruncJson.data?.scannedFileCount, 2);
        assert.equal(zeroTruncJson.data?.eligibleFileCount, 5);
        assert.equal(zeroTruncJson.data?.truncatedByMaxFiles, true);
        assert.doesNotMatch(zeroTruncJson.data?.note ?? '', /No legacy patterns found/);
        assert.match(zeroTruncJson.data?.note ?? '', /Partial scan only: scanned 2 of 5 eligible files/);
        assert.match(zeroTruncJson.data?.note ?? '', /--max-files 0/);
        assert.match(zeroTruncJson.data?.note ?? '', /subdirectory/);

        const zeroTruncHuman = await runLegacyScanCli([testDir, '--max-files', '2']);
        assert.equal(zeroTruncHuman.exitCode, 0);
        assert.doesNotMatch(zeroTruncHuman.output, /0 findings from \d+ qualified guides/);
        assert.match(zeroTruncHuman.output, /0 findings in scanned subset across \d+ qualified guides\./);
        assert.match(
          zeroTruncHuman.output,
          /Scanned 2 of 5 eligible files \(--max-files cap\)\. Re-run with --max-files 0 or target a subdirectory for full coverage\./,
        );

        // --guide mode with 0 findings in scanned subset (truncated) must still warn via note
        const guideTruncJson = await runLegacyScanCli([
          testDir,
          '--guide',
          'autofill-sign-in-form',
          '--max-files',
          '2',
          '--json',
        ]);
        assert.equal(guideTruncJson.exitCode, 0);
        assert.equal(guideTruncJson.data?.truncatedByMaxFiles, true);
        assert.match(guideTruncJson.data?.note ?? '', /Partial scan only: scanned 2 of 5 eligible files/);
        assert.match(guideTruncJson.data?.note ?? '', /--max-files 0/);

        const guideTruncHuman = await runLegacyScanCli([
          testDir,
          '--guide',
          'autofill-sign-in-form',
          '--max-files',
          '2',
        ]);
        assert.equal(guideTruncHuman.exitCode, 0);
        assert.match(
          guideTruncHuman.output,
          /Scanned 2 of 5 eligible files \(--max-files cap\)\. Re-run with --max-files 0 or target a subdirectory for full coverage\./,
        );

        // >0 findings when truncated (--max-files 3 hits 1 finding out of 5 files)
        const hitTruncJson = await runLegacyScanCli([testDir, '--max-files', '3', '--json']);
        assert.equal(hitTruncJson.exitCode, 0);
        assert.equal(hitTruncJson.data?.totalFindings, 1);
        assert.equal(hitTruncJson.data?.scannedFileCount, 3);
        assert.equal(hitTruncJson.data?.eligibleFileCount, 5);
        assert.equal(hitTruncJson.data?.truncatedByMaxFiles, true);
        assert.match(hitTruncJson.data?.note ?? '', /Partial scan only: scanned 3 of 5 eligible files/);

        const hitTruncHuman = await runLegacyScanCli([testDir, '--max-files', '3']);
        assert.equal(hitTruncHuman.exitCode, 0);
        assert.match(
          hitTruncHuman.output,
          /Scanned 3 of 5 eligible files \(--max-files cap\)\. Re-run with --max-files 0 or target a subdirectory for full coverage\./,
        );
      });

      // Formatted large counts in human output
      const largeOutput = formatHumanReadable('/big-repo', 0, [], undefined, {
        activeGuideCount: 38,
        isDefaultQualifiedMode: true,
        color: false,
        truncation: { scannedFileCount: 5000, eligibleFileCount: 64120 },
      });
      assert.match(
        largeOutput,
        /Scanned 5,000 of 64,120 eligible files \(--max-files cap\)\. Re-run with --max-files 0 or target a subdirectory for full coverage\./,
      );

      // Single-file edge cases: unsupported extension and empty custom rule list both report scannedFileCount: 0
      await withTempDir(async (edgeDir) => {
        const mdPath = join(edgeDir, 'README.md');
        await writeFile(mdPath, '# readme\n', 'utf8');
        const resMd = await runLegacyScanCli([mdPath, '--json'], { rules: [] });
        assert.equal(resMd.exitCode, 0);
        assert.equal(resMd.data?.scannedFileCount, 0);

        const htmlPath = join(edgeDir, 'page.html');
        await writeFile(htmlPath, '<p>ok</p>\n', 'utf8');
        const resEmptyRules = await runLegacyScanCli([htmlPath, '--json'], { rules: [] });
        assert.equal(resEmptyRules.exitCode, 0);
        assert.equal(resEmptyRules.data?.scannedFileCount, 0);

        const resDirEmptyRules = await runLegacyScanCli([edgeDir, '--json'], { rules: [] });
        assert.equal(resDirEmptyRules.exitCode, 0);
        assert.equal(resDirEmptyRules.data?.scannedFileCount, 0);
      });
    });
  });

  describe('multiple target paths', () => {
    const LEGACY_FORM = '<form action="/login"><input type="password" name="password"></form>';
    const JSON_ARGS = ['--guide', 'autofill-sign-in-form', '--json'];

    async function writeLegacyFiles(dir: string, relPaths: readonly string[]): Promise<void> {
      for (const relPath of relPaths) {
        const filePath = join(dir, relPath);
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, LEGACY_FORM, 'utf8');
      }
    }

    function findingFiles(data: ScanJsonOutput | undefined): string[] {
      assert.ok(data, 'Expected JSON data in result');
      return data.guides
        .flatMap((guide) => guide.rules.flatMap((rule) => rule.findings.map((f) => f.file)))
        .sort();
    }

    it('documents [paths...] in CLI_HELP', () => {
      assert.match(CLI_HELP, /legacy-scan \[paths\.\.\.\] \[options\]/);
      assert.match(CLI_HELP, /--max-files <count>.*applies per directory/);
    });

    it('scans every explicit file and lists them in targets', async () => {
      await withTempDir(async (dir) => {
        await writeLegacyFiles(dir, ['a/SignIn.html', 'b/SignIn.html']);
        const fileA = join(dir, 'a/SignIn.html');
        const fileB = join(dir, 'b/SignIn.html');

        const res = await runLegacyScanCli([fileA, fileB, ...JSON_ARGS], { cwd: dir });
        assert.equal(res.exitCode, 0);
        assert.equal(res.data?.totalFindings, 2);
        assert.equal(res.data?.scannedFileCount, 2);
        assert.deepEqual(res.data?.targets, [fileA, fileB]);
        assert.deepEqual(findingFiles(res.data), ['a/SignIn.html', 'b/SignIn.html']);

        const single = await runLegacyScanCli([fileA, ...JSON_ARGS], { cwd: dir });
        assert.equal(single.data?.totalFindings, 1);
        assert.deepEqual(single.data?.targets, [fileA]);
      });
    });

    it('keeps same-named files from different directory targets distinct', async () => {
      await withTempDir(async (dir) => {
        await writeLegacyFiles(dir, ['a/SignIn.html', 'b/SignIn.html']);

        const res = await runLegacyScanCli(['a', 'b', ...JSON_ARGS], { cwd: dir });
        assert.equal(res.exitCode, 0);
        assert.deepEqual(res.data?.targets, ['a', 'b']);
        assert.deepEqual(findingFiles(res.data), ['a/SignIn.html', 'b/SignIn.html']);
      });
    });

    it('scans a directory together with a separate file', async () => {
      await withTempDir(async (dir) => {
        await writeLegacyFiles(dir, ['app/SignIn.html', 'extra.html']);

        const resJson = await runLegacyScanCli(['app', 'extra.html', ...JSON_ARGS], { cwd: dir });
        assert.equal(resJson.exitCode, 0);
        assert.deepEqual(findingFiles(resJson.data), ['app/SignIn.html', 'extra.html']);

        const resHuman = await runLegacyScanCli(['app', 'extra.html'], { cwd: dir });
        assert.equal(resHuman.exitCode, 0);
        assert.match(resHuman.output, /legacy-scan — app, extra\.html/);
        assert.match(resHuman.output, /app\/SignIn\.html:1/);
        assert.match(resHuman.output, /extra\.html:1/);
      });
    });

    it('scans an explicit test file that its parent directory scan skips', async () => {
      await withTempDir(async (dir) => {
        await writeLegacyFiles(dir, ['app/SignIn.html', 'app/SignIn.test.html']);

        const dirOnly = await runLegacyScanCli([dir, ...JSON_ARGS], { cwd: dir });
        assert.deepEqual(findingFiles(dirOnly.data), ['app/SignIn.html']);

        const res = await runLegacyScanCli([dir, join(dir, 'app/SignIn.test.html'), ...JSON_ARGS], { cwd: dir });
        assert.equal(res.exitCode, 0);
        assert.deepEqual(findingFiles(res.data), ['app/SignIn.html', 'app/SignIn.test.html']);
      });
    });

    it('reports each finding once when targets overlap', async () => {
      await withTempDir(async (dir) => {
        await writeLegacyFiles(dir, ['app/SignIn.html', 'extra.html']);

        const res = await runLegacyScanCli([dir, join(dir, 'app'), ...JSON_ARGS], { cwd: dir });
        assert.equal(res.exitCode, 0);
        assert.equal(res.data?.totalFindings, 2);
        assert.deepEqual(findingFiles(res.data), ['app/SignIn.html', 'extra.html']);
      });
    });

    it('keeps findings that overlapping targets report differently for the same file', async () => {
      await withTempDir(async (dir) => {
        // Scanned from the root, libs/aos.js is a vendored library; scanned from libs/, it is source.
        await mkdir(join(dir, 'libs'), { recursive: true });
        await writeFile(join(dir, 'libs/aos.js'), "import AOS from 'aos';\n\n\nAOS.init();\n", 'utf8');
        const findingLines = (data: ScanJsonOutput | undefined): string[] => {
          assert.ok(data, 'Expected JSON data in result');
          return data.guides
            .flatMap((guide) => guide.rules.flatMap((rule) => rule.findings.map((f) => `${f.file}:${f.line}`)))
            .sort();
        };

        const rootFirst = await runLegacyScanCli(['.', 'libs', '--json'], { cwd: dir });
        const libsFirst = await runLegacyScanCli(['libs', '.', '--json'], { cwd: dir });
        assert.deepEqual(findingLines(rootFirst.data), ['libs/aos.js:1', 'libs/aos.js:4']);
        assert.deepEqual(findingLines(libsFirst.data), ['libs/aos.js:1', 'libs/aos.js:4']);
      });
    });

    it('reports cwd-relative paths for a directory whose name starts with two dots', async () => {
      await withTempDir(async (dir) => {
        await writeLegacyFiles(dir, ['..foo/SignIn.html', 'app/SignIn.html']);

        const res = await runLegacyScanCli(['..foo', 'app', ...JSON_ARGS], { cwd: dir });
        assert.equal(res.exitCode, 0);
        assert.deepEqual(findingFiles(res.data), ['..foo/SignIn.html', 'app/SignIn.html']);
      });
    });

    it('treats an exact repeat as a single target', async () => {
      await withTempDir(async (dir) => {
        await writeLegacyFiles(dir, ['app/SignIn.html']);
        const cwd = join(dir, 'app');

        const once = await runLegacyScanCli([dir, ...JSON_ARGS], { cwd });
        const twice = await runLegacyScanCli([dir, dir, ...JSON_ARGS], { cwd });
        assert.equal(once.data?.totalFindings, 1);
        assert.deepEqual(twice.data, once.data);
      });
    });

    it('fails without scanning when a later target is missing', async () => {
      await withTempDir(async (dir) => {
        await writeLegacyFiles(dir, ['SignIn.html']);
        const file = join(dir, 'SignIn.html');
        const missing = join(dir, 'missing.html');

        const resJson = await runLegacyScanCli([file, missing, ...JSON_ARGS]);
        assert.equal(resJson.exitCode, 1);
        assert.equal(resJson.data?.error, `Target path not found: ${missing}`);
        assert.deepEqual(resJson.data?.targets, [file, missing]);
        assert.deepEqual(resJson.data?.guides, []);

        const resHuman = await runLegacyScanCli([file, missing]);
        assert.equal(resHuman.exitCode, 1);
        assert.equal(resHuman.stdout, '');
        assert.equal(resHuman.stderr, `Error: Target path not found: ${missing}\n`);
      });
    });

    it('fails without scanning when a later target file is oversized', async () => {
      await withTempDir(async (dir) => {
        await writeLegacyFiles(dir, ['SignIn.html']);
        const largeFile = join(dir, 'large.html');
        await writeFile(largeFile, Buffer.alloc(MAX_SOURCE_FILE_BYTES + 10));

        const res = await runLegacyScanCli([join(dir, 'SignIn.html'), largeFile, ...JSON_ARGS]);
        assert.equal(res.exitCode, 1);
        assert.match(res.data?.error ?? '', /Target file exceeds maximum size/);
        assert.ok(res.data?.error?.endsWith(largeFile));
        assert.equal(res.data?.totalFindings, 0);
      });
    });

    it('applies --max-files to each directory and sums the counts', async () => {
      await withTempDir(async (dir) => {
        await writeLegacyFiles(dir, ['a/one.html', 'a/two.html', 'b/one.html', 'b/two.html']);

        const res = await runLegacyScanCli(['a', 'b', '--max-files', '1', ...JSON_ARGS], { cwd: dir });
        assert.equal(res.exitCode, 0);
        assert.equal(res.data?.scannedFileCount, 2);
        assert.equal(res.data?.eligibleFileCount, 4);
        assert.equal(res.data?.truncatedByMaxFiles, true);
        assert.deepEqual(findingFiles(res.data), ['a/one.html', 'b/one.html']);

        await writeLegacyFiles(dir, ['c.html']);
        const mixed = await runLegacyScanCli(['a', 'c.html', '--max-files', '1', ...JSON_ARGS], { cwd: dir });
        assert.equal(mixed.exitCode, 0);
        assert.equal(mixed.data?.scannedFileCount, 2);
        assert.equal(mixed.data?.eligibleFileCount, 3);
        assert.equal(mixed.data?.truncatedByMaxFiles, true);
        assert.deepEqual(findingFiles(mixed.data), ['a/one.html', 'c.html']);
      });
    });

    it('reports absolute finding paths for targets outside cwd', async () => {
      await withTempDir(async (dir) => {
        await writeLegacyFiles(dir, ['work/inside.html', 'other/outside.html', 'lib/SignIn.html']);
        const outsideFile = join(dir, 'other/outside.html');
        const outsideDir = join(dir, 'lib');

        const res = await runLegacyScanCli(['inside.html', outsideFile, outsideDir, ...JSON_ARGS], {
          cwd: join(dir, 'work'),
        });
        assert.equal(res.exitCode, 0);
        assert.deepEqual(
          findingFiles(res.data),
          [`${outsideDir}/SignIn.html`, outsideFile, 'inside.html'].map((p) => p.replace(/\\/g, '/')).sort(),
        );
      });
    });
  });
});
