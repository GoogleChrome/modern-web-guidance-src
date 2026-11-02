import test from 'node:test';
import assert from 'node:assert';
import { parsePassRates } from '../harness/lib/utils.ts';

test('parsePassRates parses multi-dimensional base-app scores correctly', () => {
  const output = `
Some generation logs...
Running agent test for target: daily-grind
=== Test Suite Starting with ID: size-aware-styling-daily-grind ===
...
Grading unguided...
  unguided: 1/4 checks passed (25%)
Grading guided...
  guided: 3/4 checks passed (75%)
Agent test results:
  Base app (zero-passrate): 0/4 checks passed (0%)
  Unguided:                 1/4 checks passed (25%)
  Guided:                   3/4 checks passed (75%)
  Guide impact:             +50% (vs unguided)
  Guides consumed:          [size-aware-styling, container-queries]

Running agent test for target: devtools-times
=== Test Suite Starting with ID: size-aware-styling-devtools-times ===
...
Grading unguided...
  unguided: 2/4 checks passed (50%)
Grading guided...
  guided: 4/4 checks passed (100%)
Agent test results:
  Base app (zero-passrate): 0/4 checks passed (0%)
  Unguided:                 2/4 checks passed (50%)
  Guided:                   4/4 checks passed (100%)
  Guide impact:             +50% (vs unguided)
  Guides consumed:          [size-aware-styling]
`;

  const parsed = parsePassRates(output);
  assert.deepStrictEqual(parsed, {
    'daily-grind': {
      unguided: '25',
      guided: '75',
      guidesConsumed: ['size-aware-styling', 'container-queries']
    },
    'devtools-times': {
      unguided: '50',
      guided: '100',
      guidesConsumed: ['size-aware-styling']
    }
  });
});

test('parsePassRates parses legacy single-page outputs correctly (fallback to demo)', () => {
  const output = `
Some generation logs...
=== Test Suite Starting with ID: legacy-same-document-transitions ===
...
Grading unguided...
  unguided: 0/4 checks passed (0%)
Grading guided...
  guided: 2/4 checks passed (50%)
Agent test results:
  Base app (zero-passrate): 0/4 checks passed (0%)
  Unguided:                 0/4 checks passed (0%)
  Guided:                   2/4 checks passed (50%)
  Guide impact:             +50% (vs unguided)
  Guides consumed:          [same-document-transitions]
`;

  const parsed = parsePassRates(output);
  assert.deepStrictEqual(parsed, {
    'demo': {
      unguided: '0',
      guided: '50',
      guidesConsumed: ['same-document-transitions']
    }
  });
});

test('setupGuideDevWorkDir conditionally copies credentials based on GD_DEV_USE_JETSKI', async (t) => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');
  const { setupGuideDevWorkDir } = await import('../harness/lib/utils.ts');
  const { cleanupIsolatedHome } = await import('../harness/lib/agent-shared.ts');

  const originalHome = process.env.HOME;
  const originalGdUseJetski = process.env.GD_DEV_USE_JETSKI;
  const originalJetskiDir = process.env.JETSKI_DIR;

  const mockHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-home-'));
  const mockGemini = path.join(mockHome, '.gemini');
  const mockJetski = path.join(mockGemini, 'jetski');
  const mockAgy = path.join(mockGemini, 'antigravity-cli');
  fs.mkdirSync(mockJetski, { recursive: true });
  fs.mkdirSync(mockAgy, { recursive: true });

  fs.writeFileSync(path.join(mockJetski, 'installation_id'), 'mock-jetski-id');
  fs.writeFileSync(path.join(mockAgy, 'antigravity-oauth-token'), 'mock-agy-token');

  process.env.HOME = mockHome;

  t.after(() => {
    process.env.HOME = originalHome;
    if (originalGdUseJetski === undefined) {
      delete process.env.GD_DEV_USE_JETSKI;
    } else {
      process.env.GD_DEV_USE_JETSKI = originalGdUseJetski;
    }
    if (originalJetskiDir === undefined) {
      delete process.env.JETSKI_DIR;
    } else {
      process.env.JETSKI_DIR = originalJetskiDir;
    }
    fs.rmSync(mockHome, { recursive: true, force: true });
  });

  // 1. Without GD_DEV_USE_JETSKI (default Antigravity CLI mode)
  delete process.env.GD_DEV_USE_JETSKI;
  delete process.env.JETSKI_DIR;
  const { tempHome: agyTempHome } = setupGuideDevWorkDir('test-dev-agy');

  assert.ok(fs.existsSync(path.join(agyTempHome, '.gemini', 'antigravity-cli', 'settings.json')), 'Antigravity CLI settings should be written');
  assert.ok(fs.existsSync(path.join(agyTempHome, '.gemini', 'antigravity-cli', 'antigravity-oauth-token')), 'Antigravity CLI token should be copied');
  assert.strictEqual(fs.existsSync(path.join(agyTempHome, '.gemini', 'jetski', 'installation_id')), false, 'Jetski credentials should not be copied');
  assert.strictEqual(process.env.JETSKI_DIR, undefined, 'JETSKI_DIR should not be set');

  cleanupIsolatedHome(agyTempHome);

  // Restore HOME to mockHome before second run
  process.env.HOME = mockHome;

  // 2. With GD_DEV_USE_JETSKI=1 (Jetski CLI mode)
  process.env.GD_DEV_USE_JETSKI = '1';
  delete process.env.JETSKI_DIR;
  const { tempHome: jetskiTempHome } = setupGuideDevWorkDir('test-dev-jetski');

  assert.ok(fs.existsSync(path.join(jetskiTempHome, '.gemini', 'jetski', 'installation_id')), 'Jetski credentials should be copied');
  assert.strictEqual(fs.existsSync(path.join(jetskiTempHome, '.gemini', 'antigravity-cli', 'settings.json')), false, 'Antigravity CLI settings should not be written');
  assert.strictEqual(process.env.JETSKI_DIR, path.join(jetskiTempHome, '.gemini', 'jetski'), 'JETSKI_DIR should be set');

  cleanupIsolatedHome(jetskiTempHome);
});

test('collectPlaywrightErrors correctly parses nested suites, deduplicates errors, and ignores passing tests', async () => {
  const { collectPlaywrightErrors } = await import('../grading/run-grader.ts');

  const mockReport = {
    suites: [
      {
        title: 'Root Suite',
        suites: [
          {
            title: 'Nested Suite',
            specs: [
              {
                title: 'Passing Spec',
                ok: true,
                tests: [{ results: [{ status: 'passed' }] }]
              },
              {
                title: 'Failing Spec 1',
                ok: false,
                tests: [
                  {
                    results: [
                      {
                        status: 'failed',
                        error: { message: 'Expected foo but received bar', stack: 'at line 10' },
                        errors: [{ message: 'Expected foo but received bar', stack: 'at line 10' }]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  const parsed = collectPlaywrightErrors(mockReport);
  assert.strictEqual(parsed, 'Test: Root Suite > Nested Suite > Failing Spec 1\nError: Expected foo but received bar\nStack: at line 10');

  // Verify graceful handling of null/empty results
  assert.strictEqual(collectPlaywrightErrors(null), '');
  assert.strictEqual(collectPlaywrightErrors({}), '');
});

test('exciseOldEvalArtifacts removes tasks folder, grader.ts, and negative-demo.html when they exist while keeping demo.html', async (t) => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');
  const { exciseOldEvalArtifacts } = await import('./dev.ts');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-dev-excision-test-'));

  t.after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Create old artifacts
  const tasksDir = path.join(tmpDir, 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, 'task.md'), '# Task');
  fs.writeFileSync(path.join(tmpDir, 'grader.ts'), 'export const grader = true;');
  fs.writeFileSync(path.join(tmpDir, 'demo.html'), '<html><body>Demo</body></html>');
  fs.writeFileSync(path.join(tmpDir, 'negative-demo.html'), '<html><body>Negative Demo</body></html>');

  // Create non-old artifacts that should NOT be excised
  fs.writeFileSync(path.join(tmpDir, 'guide.md'), '# Guide');
  fs.writeFileSync(path.join(tmpDir, 'expectations.md'), '# Expectations');

  // Run excision
  exciseOldEvalArtifacts(tmpDir);

  // Assert old artifacts were deleted
  assert.strictEqual(fs.existsSync(tasksDir), false, 'tasks directory should be excised');
  assert.strictEqual(fs.existsSync(path.join(tmpDir, 'grader.ts')), false, 'grader.ts should be excised');
  assert.strictEqual(fs.existsSync(path.join(tmpDir, 'negative-demo.html')), false, 'negative-demo.html should be excised');

  // Assert demo.html and non-old artifacts remain intact
  assert.strictEqual(fs.existsSync(path.join(tmpDir, 'demo.html')), true, 'demo.html should remain intact');
  assert.strictEqual(fs.existsSync(path.join(tmpDir, 'guide.md')), true, 'guide.md should remain');
  assert.strictEqual(fs.existsSync(path.join(tmpDir, 'expectations.md')), true, 'expectations.md should remain');
});

test('exciseOldEvalArtifacts handles directory when old artifacts do not exist', async (t) => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');
  const { exciseOldEvalArtifacts } = await import('./dev.ts');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-dev-excision-empty-test-'));

  t.after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  fs.writeFileSync(path.join(tmpDir, 'guide.md'), '# Guide');

  // Should not throw
  assert.doesNotThrow(() => {
    exciseOldEvalArtifacts(tmpDir);
  });

  assert.strictEqual(fs.existsSync(path.join(tmpDir, 'guide.md')), true);
});

test('devCli.commitStepArtifacts commits modified guide files when on a feature branch', async (t) => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');
  const { execSync } = await import('node:child_process');
  const { devCli } = await import('./dev.ts');

  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-step-repo-'));
  const origCwd = process.cwd();

  t.after(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpRepo, { recursive: true, force: true });
  });

  process.chdir(tmpRepo);
  execSync('git init && git config user.name "Test" && git config user.email "test@example.com"', { stdio: 'ignore' });
  execSync('git commit --allow-empty -m "initial commit"', { stdio: 'ignore' });
  execSync('git checkout -b gd-dev/sample-guide', { stdio: 'ignore' });

  const guideDir = path.join(tmpRepo, 'guides', 'css', 'sample-guide');
  fs.mkdirSync(guideDir, { recursive: true });
  fs.writeFileSync(path.join(guideDir, 'guide.md'), '# Initial Guide\n');

  // Commits newly created files
  const committed = devCli.commitStepArtifacts(guideDir, 'feat(guide): generate sample-guide evaluations and artifacts');
  assert.strictEqual(committed, true);

  const log = execSync('git log -1 --pretty=%B', { encoding: 'utf-8' }).trim();
  assert.strictEqual(log, 'feat(guide): generate sample-guide evaluations and artifacts');

  // Does not create empty commit when nothing changed
  const committedAgain = devCli.commitStepArtifacts(guideDir, 'fix(guide): post-report recommendations');
  assert.strictEqual(committedAgain, false);

  // Commits post-report edits when files are modified
  fs.writeFileSync(path.join(guideDir, 'guide.md'), '# Updated Guide\n');
  const committedEdits = devCli.commitStepArtifacts(guideDir, 'fix(guide): apply post-evaluation report recommendations for sample-guide');
  assert.strictEqual(committedEdits, true);

  const secondLog = execSync('git log -1 --pretty=%B', { encoding: 'utf-8' }).trim();
  assert.strictEqual(secondLog, 'fix(guide): apply post-evaluation report recommendations for sample-guide');
});

test('devCli.commitStepArtifacts returns false when not on a gd-dev/ branch', async (t) => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');
  const { execSync } = await import('node:child_process');
  const { devCli } = await import('./dev.ts');

  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-step-non-dev-repo-'));
  const origCwd = process.cwd();

  t.after(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpRepo, { recursive: true, force: true });
  });

  process.chdir(tmpRepo);
  execSync('git init && git config user.name "Test" && git config user.email "test@example.com"', { stdio: 'ignore' });
  execSync('git commit --allow-empty -m "initial commit"', { stdio: 'ignore' });
  execSync('git checkout -b feat/my-feature', { stdio: 'ignore' });

  const guideDir = path.join(tmpRepo, 'guides', 'css', 'sample-guide');
  fs.mkdirSync(guideDir, { recursive: true });
  fs.writeFileSync(path.join(guideDir, 'guide.md'), '# Initial Guide\n');

  const committed = devCli.commitStepArtifacts(guideDir, 'feat(guide): test commit');
  assert.strictEqual(committed, false);
});

test('extractGuideDescription extracts description frontmatter correctly and throws on missing description', async () => {
  const { extractGuideDescription } = await import('./dev.ts');

  const validGuide = `---
title: View Transitions
description: Smoothly animate between views using the document View Transitions API.
---
# Content here
`;
  assert.strictEqual(
    extractGuideDescription(validGuide),
    'Smoothly animate between views using the document View Transitions API.'
  );

  const missingDescGuide = `---
title: View Transitions
---
# Content here
`;
  assert.throws(
    () => extractGuideDescription(missingDescGuide),
    /Missing or empty 'description' frontmatter in guide\.md/
  );

  const emptyDescGuide = `---
title: View Transitions
description: "   "
---
# Content here
`;
  assert.throws(
    () => extractGuideDescription(emptyDescGuide),
    /Missing or empty 'description' frontmatter in guide\.md/
  );
});

async function setupRerunRepo(t: import('node:test').TestContext) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');
  const { execSync } = await import('node:child_process');

  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-rerun-repo-'));
  t.after(() => fs.rmSync(tmpRepo, { recursive: true, force: true }));
  const run = (cmd: string) => execSync(cmd, { cwd: tmpRepo, stdio: 'ignore' });
  run('git init -q -b main && git config user.name "Test" && git config user.email "test@example.com"');

  const guideDir = path.join(tmpRepo, 'guides', 'css', 'sample-guide');
  const targetDir = path.join(guideDir, 'targets', 'daily-grind');
  const patches = ['antigravity', 'claude', 'codex'].map(f => `targets/daily-grind/patches/${f}-solution.patch`);
  fs.mkdirSync(path.join(targetDir, 'patches'), { recursive: true });
  const write = (rel: string, content: string) => fs.writeFileSync(path.join(guideDir, rel), content);
  const exists = (rel: string) => fs.existsSync(path.join(guideDir, rel));

  write('guide.md', '# Guide\n');
  write('expectations.md', '- Expectation one\n');
  write('targets/daily-grind/task.md', '- original task\n');
  write('targets/daily-grind/grader.ts', '// grader\n');
  write('targets/daily-grind/patches/zero-passrate.patch', '');
  for (const p of patches) write(p, `${p}\n`);
  run('git add -A && git commit -q -m "feat(guide): generate sample-guide evaluations and artifacts"');

  return { run, write, exists, patches, guideDir, targetDir };
}

test('applyTargetRerun does nothing when nothing changed or only grader.ts changed', async (t) => {
  const { applyTargetRerun } = await import('./dev.ts');
  const { run, write, exists, patches, guideDir, targetDir } = await setupRerunRepo(t);

  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'none');
  write('targets/daily-grind/grader.ts', '// hand-tuned grader\n');
  run('git commit -q -am "fix: tune grader"');
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'none');
  assert.ok(patches.every(exists) && exists('targets/daily-grind/grader.ts'));
});

test('applyTargetRerun regenerates solutions and grader after a task.md edit, only once', async (t) => {
  const { applyTargetRerun } = await import('./dev.ts');
  const { run, write, exists, patches, guideDir, targetDir } = await setupRerunRepo(t);

  write('targets/daily-grind/task.md', '- task with more scope\n');
  run('git commit -q -am "fix: revise task"');
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'regenerate-solutions');
  assert.ok(exists('targets/daily-grind/task.md') && exists('targets/daily-grind/patches/zero-passrate.patch'));
  assert.ok(!exists('targets/daily-grind/grader.ts') && !patches.some(exists));

  // Once the rerun regenerates and commits them, the earlier task edit no longer counts.
  write('targets/daily-grind/grader.ts', '// new grader\n');
  for (const p of patches) write(p, `${p} v2\n`);
  run('git add -A && git commit -q -m "feat(guide): regenerate"');
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'none');
});

test('applyTargetRerun wipes the target after a guide.md or expectations.md edit', async (t) => {
  const { applyTargetRerun } = await import('./dev.ts');
  const { run, write, exists, guideDir, targetDir } = await setupRerunRepo(t);

  write('expectations.md', '- Expectation one\n- Expectation two\n');
  run('git commit -q -am "content: add expectation"');
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'regenerate-all');
  assert.ok(!exists('targets/daily-grind') && exists('guide.md') && exists('expectations.md'));
});

test('applyTargetRerun detects task.md edits merged in from main', async (t) => {
  const { applyTargetRerun } = await import('./dev.ts');
  const { run, write, guideDir, targetDir } = await setupRerunRepo(t);

  run('git checkout -q -b gd-dev/sample-guide && git checkout -q main');
  write('targets/daily-grind/task.md', '- grounded task\n');
  run('git commit -q -am "guides: ground task prompts"');
  run('git checkout -q gd-dev/sample-guide && git merge -q --no-edit main');
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'regenerate-solutions');
});

test('applyTargetRerun detects uncommitted task.md edits even when patches were rewritten with newer mtimes', async (t) => {
  const { applyTargetRerun } = await import('./dev.ts');
  const { write, patches, guideDir, targetDir } = await setupRerunRepo(t);

  // Mirrors the review-feedback step: task.md is edited, then targets/ is copied back, rewriting
  // the unchanged patches with fresh mtimes.
  write('targets/daily-grind/task.md', '- edited from review feedback\n');
  for (const p of patches) write(p, `${p}\n`);
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'regenerate-solutions');
});

test('applyTargetRerun falls back to modification times outside a git repo', async (t) => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');
  const { applyTargetRerun } = await import('./dev.ts');

  const guideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-rerun-nogit-'));
  t.after(() => fs.rmSync(guideDir, { recursive: true, force: true }));
  const targetDir = path.join(guideDir, 'targets', 'daily-grind');
  fs.mkdirSync(path.join(targetDir, 'patches'), { recursive: true });
  const past = new Date(Date.now() - 60_000);
  for (const f of ['guide.md', 'expectations.md', 'targets/daily-grind/patches/claude-solution.patch']) {
    fs.writeFileSync(path.join(guideDir, f), 'x\n');
    fs.utimesSync(path.join(guideDir, f), past, past);
  }
  fs.writeFileSync(path.join(targetDir, 'task.md'), '- edited task\n');
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'regenerate-solutions');
});

test('changedSince detects when expectations.md is modified after grader.ts', async (t) => {
  const { changedSince } = await import('./dev.ts');
  const { run, write, guideDir } = await setupRerunRepo(t);
  const expPath = `${guideDir}/expectations.md`;
  const graderPath = `${guideDir}/targets/daily-grind/grader.ts`;

  // Initially committed together -> not stale
  assert.strictEqual(changedSince([expPath], [graderPath]), false);

  // Content author commits a new expectation without touching grader.ts -> stale
  write('expectations.md', '- Expectation one\n- Expectation two\n');
  run('git commit -q -am "content: add second expectation"');
  assert.strictEqual(changedSince([expPath], [graderPath]), true);

  // Grader is subsequently updated -> no longer stale
  write('targets/daily-grind/grader.ts', '// updated grader\n');
  run('git commit -q -am "test: update grader"');
  assert.strictEqual(changedSince([expPath], [graderPath]), false);
});
