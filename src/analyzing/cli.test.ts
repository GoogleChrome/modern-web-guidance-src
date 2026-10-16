import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { runAnalyzeCli, type AnalyzeJsonOutput } from './cli.ts';

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

  it('handles empty directory cleanly with 0 findings and exit code 0', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'analyzer-empty-test-'));
    try {
      const resHuman = await runAnalyzeCli([emptyDir]);
      assert.equal(resHuman.exitCode, 0);
      assert.match(resHuman.output, /No modernization opportunities found/);

      const resJson = await runAnalyzeCli([emptyDir, '--json']);
      assert.equal(resJson.exitCode, 0);
      const parsed = JSON.parse(resJson.output) as AnalyzeJsonOutput;
      assert.equal(parsed.totalFindings, 0);
      assert.deepEqual(parsed.guides, []);
      assert.equal(parsed.targetDir, emptyDir);
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
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

      // Check header
      assert.match(res.output, /Modern Web Guidance Analyzer:/);
      assert.match(res.output, /Found \d+ modernization opportunities across \d+ guides:/);

      // Check guide grouping & retrieve command
      assert.match(res.output, /\* \[experimental\] autofill-sign-in-form \(\d+ finding[s]?\)/);
      assert.match(res.output, /Retrieve: npx modern-web-guidance retrieve autofill-sign-in-form/);
      assert.match(res.output, /Summary:/);
      assert.match(res.output, /- login\.html:\d+:/);

      assert.match(
        res.output,
        /\* \[experimental\] animate-to-intrinsic-sizes \(\d+ finding[s]?\)/,
      );
      assert.match(res.output, /Retrieve: npx modern-web-guidance retrieve animate-to-intrinsic-sizes/);
      assert.match(res.output, /- accordion\.css:\d+:/);
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
      assert.ok(guide.phase2Rubric, 'Expected phase2Rubric in guide JSON output (R17)');
      assert.ok(guide.phase2Rubric.keepWhen.length >= 1);
      assert.ok(guide.phase2Rubric.dropWhen.length >= 1);
      assert.equal(guide.tier, 'experimental');
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
      // 1. Create a qualified pattern: jQuery fadeIn -> animate-element-entry-exit
      const animateJs = `function showModal() {
  $('#modal').fadeIn(300);
}`;
      await writeFile(join(testDir, 'animate.js'), animateJs, 'utf8');

      // 2. Create an experimental pattern: requestIdleCallback -> schedule-tasks-by-priority
      const idleJs = `function runIdleTask() {
  requestIdleCallback(() => console.log('idle work'));
}`;
      await writeFile(join(testDir, 'task.js'), idleJs, 'utf8');

      // Default run (QUALIFIED_RULES only - currently empty while judge is unadmitted)
      const resDefault = await runAnalyzeCli([testDir, '--json']);
      assert.equal(resDefault.exitCode, 0);
      const parsedDefault = JSON.parse(resDefault.output) as AnalyzeJsonOutput;
      assert.equal(parsedDefault.totalFindings, 0);
      assert.deepEqual(parsedDefault.guides, []);

      // Opt-in run with --all-rules (or --experimental)
      const resAll = await runAnalyzeCli([testDir, '--all-rules', '--json']);
      assert.equal(resAll.exitCode, 0);
      const parsedAll = JSON.parse(resAll.output) as AnalyzeJsonOutput;
      const allGuideIds = parsedAll.guides.map((g) => g.guideId);

      assert.ok(allGuideIds.includes('animate-element-entry-exit'), 'All-rules includes experimental rule');
      assert.ok(
        allGuideIds.includes('schedule-tasks-by-priority'),
        'All-rules includes experimental rule schedule-tasks-by-priority',
      );

      // Verify --experimental alias also works
      const resExperimental = await runAnalyzeCli([testDir, '--experimental', '--json']);
      assert.equal(resExperimental.exitCode, 0);
      const parsedExp = JSON.parse(resExperimental.output) as AnalyzeJsonOutput;
      assert.ok(
        parsedExp.guides.some((g) => g.guideId === 'schedule-tasks-by-priority'),
        '--experimental alias enables experimental rules',
      );
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});
