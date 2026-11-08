import test from 'node:test';
import assert from 'node:assert';
import { gitExec } from '../core/git-utils.ts';
import { initGitRepo } from '../core/patch-utils.ts';

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

const NULL_GIT_CONFIG = process.platform === 'win32' ? 'NUL' : '/dev/null';

function isolateGitEnv(t: import('node:test').TestContext): void {
  const prevNoSystem = process.env.GIT_CONFIG_NOSYSTEM;
  const prevGlobal = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  process.env.GIT_CONFIG_GLOBAL = NULL_GIT_CONFIG;
  t.after(() => {
    if (prevNoSystem === undefined) delete process.env.GIT_CONFIG_NOSYSTEM;
    else process.env.GIT_CONFIG_NOSYSTEM = prevNoSystem;
    if (prevGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = prevGlobal;
  });
}

test('devCli.commitStepArtifacts commits modified guide files when on a feature branch', async (t) => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');
  const { devCli } = await import('./dev.ts');
  isolateGitEnv(t);

  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-step-repo-'));
  const origCwd = process.cwd();

  t.after(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpRepo, { recursive: true, force: true });
  });

  process.chdir(tmpRepo);
  initGitRepo(tmpRepo);
  gitExec(['checkout', '-q', '-b', 'gd-dev/sample-guide'], { cwd: tmpRepo, isolated: true, stdio: 'ignore' });

  const guideDir = path.join(tmpRepo, 'guides', 'css', 'sample-guide');
  fs.mkdirSync(guideDir, { recursive: true });
  fs.writeFileSync(path.join(guideDir, 'guide.md'), '# Initial Guide\n');

  // Commits newly created files
  const committed = devCli.commitStepArtifacts(guideDir, 'feat(guide): generate sample-guide evaluations and artifacts');
  assert.strictEqual(committed, true);

  const log = gitExec(['log', '-1', '--pretty=%B'], { cwd: tmpRepo, isolated: true }).trim();
  assert.strictEqual(log, 'feat(guide): generate sample-guide evaluations and artifacts');

  // Does not create empty commit when nothing changed
  const committedAgain = devCli.commitStepArtifacts(guideDir, 'fix(guide): post-report recommendations');
  assert.strictEqual(committedAgain, false);

  // Commits post-report edits when files are modified
  fs.writeFileSync(path.join(guideDir, 'guide.md'), '# Updated Guide\n');
  const committedEdits = devCli.commitStepArtifacts(guideDir, 'fix(guide): apply post-evaluation report recommendations for sample-guide');
  assert.strictEqual(committedEdits, true);

  const secondLog = gitExec(['log', '-1', '--pretty=%B'], { cwd: tmpRepo, isolated: true }).trim();
  assert.strictEqual(secondLog, 'fix(guide): apply post-evaluation report recommendations for sample-guide');
});

test('devCli.commitStepArtifacts returns false when not on a gd-dev/ branch', async (t) => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');
  const { devCli } = await import('./dev.ts');
  isolateGitEnv(t);

  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-step-non-dev-repo-'));
  const origCwd = process.cwd();

  t.after(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpRepo, { recursive: true, force: true });
  });

  process.chdir(tmpRepo);
  initGitRepo(tmpRepo);
  gitExec(['checkout', '-q', '-b', 'feat/my-feature'], { cwd: tmpRepo, isolated: true, stdio: 'ignore' });

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
  isolateGitEnv(t);

  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-rerun-repo-'));
  t.after(() => fs.rmSync(tmpRepo, { recursive: true, force: true }));
  const run = (args: string[]) => gitExec(args, { cwd: tmpRepo, isolated: true, stdio: 'ignore' });
  run(['init', '-q', '-b', 'main']);
  run(['config', 'user.name', 'Test']);
  run(['config', 'user.email', 'test@example.com']);

  const guideDir = path.join(tmpRepo, 'guides', 'css', 'sample-guide');
  const targetDir = path.join(guideDir, 'targets', 'daily-grind');
  const patches = ['antigravity', 'claude', 'codex'].map(f => `targets/daily-grind/patches/${f}-solution.patch`);
  fs.mkdirSync(path.join(targetDir, 'patches'), { recursive: true });
  const write = (rel: string, content: string) => fs.writeFileSync(path.join(guideDir, rel), content);
  const exists = (rel: string) => fs.existsSync(path.join(guideDir, rel));

  write('guide.md', '---\ndescription: Original description.\n---\n# Guide\n');
  write('expectations.md', '- Expectation one\n');
  write('targets/daily-grind/task.md', '- original task\n');
  write('targets/daily-grind/grader.ts', '// grader\n');
  write('targets/daily-grind/patches/zero-passrate.patch', '');
  for (const p of patches) write(p, `${p}\n`);
  run(['add', '-A']);
  run(['commit', '-q', '-m', 'feat(guide): generate sample-guide evaluations and artifacts']);

  return { run, write, exists, patches, tmpRepo, guideDir, targetDir };
}

test('applyTargetRerun does nothing when nothing changed or only grader.ts changed', async (t) => {
  const { applyTargetRerun } = await import('./dev.ts');
  const { run, write, exists, patches, guideDir, targetDir } = await setupRerunRepo(t);

  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'none');
  write('targets/daily-grind/grader.ts', '// hand-tuned grader\n');
  run(['commit', '-q', '-am', 'fix: tune grader']);
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'none');
  assert.ok(patches.every(exists) && exists('targets/daily-grind/grader.ts'));
});

test('applyTargetRerun regenerates solutions and grader after a task.md edit, only once', async (t) => {
  const { applyTargetRerun } = await import('./dev.ts');
  const { run, write, exists, patches, guideDir, targetDir } = await setupRerunRepo(t);

  write('targets/daily-grind/task.md', '- task with more scope\n');
  run(['commit', '-q', '-am', 'fix: revise task']);
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'regenerate-solutions');
  assert.ok(exists('targets/daily-grind/task.md') && exists('targets/daily-grind/patches/zero-passrate.patch'));
  assert.ok(!exists('targets/daily-grind/grader.ts') && !patches.some(exists));

  // Once the rerun regenerates and commits them, the earlier task edit no longer counts.
  write('targets/daily-grind/grader.ts', '// new grader\n');
  for (const p of patches) write(p, `${p} v2\n`);
  run(['add', '-A']);
  run(['commit', '-q', '-m', 'feat(guide): regenerate']);
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'none');
});

test('applyTargetRerun keeps task.md and regenerates patches and grader after a guide body or expectations.md edit', async (t) => {
  const { applyTargetRerun } = await import('./dev.ts');
  const { run, write, exists, patches, guideDir, targetDir } = await setupRerunRepo(t);

  write('guide.md', '---\ndescription: Original description.\n---\n# Guide with updated body\n');
  run(['commit', '-q', '-am', 'content: clarify guide body']);
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'regenerate-patches');
  assert.ok(exists('targets/daily-grind/task.md'));
  assert.ok(!exists('targets/daily-grind/grader.ts') && !exists('targets/daily-grind/patches/zero-passrate.patch') && !patches.some(exists));

  write('targets/daily-grind/grader.ts', '// new grader\n');
  write('targets/daily-grind/patches/zero-passrate.patch', 'v2\n');
  for (const p of patches) write(p, `${p} v2\n`);
  run(['add', '-A']);
  run(['commit', '-q', '-m', 'feat(guide): regenerate']);
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'none');

  write('expectations.md', '- Expectation one\n- Expectation two\n');
  run(['commit', '-q', '-am', 'content: add expectation']);
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'regenerate-patches');
  assert.ok(exists('targets/daily-grind/task.md'));
  assert.ok(!exists('targets/daily-grind/grader.ts') && !exists('targets/daily-grind/patches/zero-passrate.patch') && !patches.some(exists));
});

test('applyTargetRerun wipes the target when guide.md description changes', async (t) => {
  const { applyTargetRerun } = await import('./dev.ts');
  const { run, write, exists, guideDir, targetDir } = await setupRerunRepo(t);

  write('guide.md', '---\ndescription: Updated description with new scope.\n---\n# Guide\n');
  run(['commit', '-q', '-am', 'content: revise description']);
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'regenerate-all');
  assert.ok(!exists('targets/daily-grind') && exists('guide.md') && exists('expectations.md'));
});

test('applyTargetRerun detects edits merged in from main', async (t) => {
  const { applyTargetRerun } = await import('./dev.ts');
  const { run, write, exists, patches, guideDir, targetDir } = await setupRerunRepo(t);

  run(['checkout', '-q', '-b', 'gd-dev/sample-guide']);
  run(['checkout', '-q', 'main']);
  write('targets/daily-grind/task.md', '- grounded task\n');
  run(['commit', '-q', '-am', 'guides: ground task prompts']);
  run(['checkout', '-q', 'gd-dev/sample-guide']);
  run(['merge', '-q', '--no-edit', 'main']);
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'regenerate-solutions');

  write('targets/daily-grind/grader.ts', '// grader v2\n');
  for (const p of patches) write(p, `${p} v2\n`);
  run(['add', '-A']);
  run(['commit', '-q', '-m', 'feat(guide): regenerate solutions']);

  run(['checkout', '-q', 'main']);
  write('guide.md', '---\ndescription: Original description.\n---\n# Guide body edit on main\n');
  run(['commit', '-q', '-am', 'guides: format guide body']);
  run(['checkout', '-q', 'gd-dev/sample-guide']);
  run(['merge', '-q', '--no-edit', 'main']);
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'regenerate-patches');
  assert.ok(exists('targets/daily-grind/task.md'));

  write('targets/daily-grind/grader.ts', '// grader v3\n');
  write('targets/daily-grind/patches/zero-passrate.patch', 'v3\n');
  for (const p of patches) write(p, `${p} v3\n`);
  run(['add', '-A']);
  run(['commit', '-q', '-m', 'feat(guide): regenerate patches']);

  run(['checkout', '-q', 'main']);
  write('guide.md', '---\ndescription: Description edit on main.\n---\n# Guide body edit on main\n');
  run(['commit', '-q', '-am', 'guides: revise description']);
  run(['checkout', '-q', 'gd-dev/sample-guide']);
  run(['merge', '-q', '--no-edit', 'main']);
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'regenerate-all');
  assert.ok(!exists('targets/daily-grind'));
});

test('applyTargetRerun detects uncommitted review-feedback edits even when patches were rewritten with newer mtimes', async (t) => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { applyTargetRerun } = await import('./dev.ts');
  const { run, write, exists, patches, guideDir, targetDir } = await setupRerunRepo(t);

  // Mirrors the review-feedback step: task.md is edited, then targets/ is copied back, rewriting
  // the unchanged patches with fresh mtimes.
  write('targets/daily-grind/task.md', '- edited from review feedback\n');
  for (const p of patches) write(p, `${p}\n`);
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'regenerate-solutions');

  write('targets/daily-grind/grader.ts', '// grader v2\n');
  for (const p of patches) write(p, `${p}\n`);
  run(['add', '-A']);
  run(['commit', '-q', '-m', 'feat(guide): regenerate solutions']);

  // Uncommitted guide.md body edit with clean committed patches -> keep task.md, regenerate patches + grader.
  write('guide.md', '---\ndescription: Original description.\n---\n# Guide body edited from review feedback\n');
  for (const p of patches) write(p, `${p}\n`);
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'regenerate-patches');
  assert.ok(exists('targets/daily-grind/task.md'));
  assert.ok(!exists('targets/daily-grind/grader.ts') && !exists('targets/daily-grind/patches/zero-passrate.patch') && !patches.some(exists));

  write('targets/daily-grind/grader.ts', '// grader v2\n');
  write('targets/daily-grind/patches/zero-passrate.patch', '');
  for (const p of patches) write(p, `${p}\n`);

  // Uncommitted guide.md description edit with clean committed patches -> wipe target.
  write('guide.md', '---\ndescription: Description edited from review feedback.\n---\n# Guide\n');
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'regenerate-all');
  assert.ok(!exists('targets/daily-grind'));

  // Restore committed target artifacts, then make a solution patch dirty -> description history cannot be trusted -> wipe target.
  run(['checkout', '-q', '--', '.']);
  const past = new Date(Date.now() - 60_000);
  for (const p of patches) {
    write(p, `${p} dirty\n`);
    fs.utimesSync(path.join(guideDir, p), past, past);
  }
  write('expectations.md', '- Expectation one\n- Expectation two\n');
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'regenerate-all');
  assert.ok(!exists('targets/daily-grind'));
});

test('applyTargetRerun falls back to modification times and full target wipe outside a git repo', async (t) => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');
  const { applyTargetRerun } = await import('./dev.ts');

  const guideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-rerun-nogit-'));
  t.after(() => fs.rmSync(guideDir, { recursive: true, force: true }));
  const targetDir = path.join(guideDir, 'targets', 'daily-grind');
  fs.mkdirSync(path.join(targetDir, 'patches'), { recursive: true });
  const past = new Date(Date.now() - 60_000);
  fs.writeFileSync(path.join(guideDir, 'guide.md'), '---\ndescription: Same description.\n---\n# Guide\n');
  for (const f of ['expectations.md', 'targets/daily-grind/patches/claude-solution.patch']) {
    fs.writeFileSync(path.join(guideDir, f), 'x\n');
  }
  for (const f of ['guide.md', 'expectations.md', 'targets/daily-grind/patches/claude-solution.patch']) {
    fs.utimesSync(path.join(guideDir, f), past, past);
  }
  fs.writeFileSync(path.join(targetDir, 'task.md'), '- edited task\n');
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'regenerate-solutions');

  // When guide.md or expectations.md is newer outside git, description history cannot be determined -> wipe target.
  fs.writeFileSync(path.join(guideDir, 'targets/daily-grind/patches/claude-solution.patch'), 'x\n');
  fs.utimesSync(path.join(guideDir, 'targets/daily-grind/patches/claude-solution.patch'), past, past);
  fs.utimesSync(path.join(targetDir, 'task.md'), past, past);
  fs.writeFileSync(path.join(guideDir, 'expectations.md'), '- Updated expectation\n');
  assert.strictEqual(applyTargetRerun(guideDir, targetDir), 'regenerate-all');
  assert.strictEqual(fs.existsSync(targetDir), false);
});

test('changedSince and findStaleTargets detect when expectations.md is modified after grader.ts', async (t) => {
  const { changedSince, findStaleTargets } = await import('./dev.ts');
  const { run, write, tmpRepo, guideDir } = await setupRerunRepo(t);
  const expPath = `${guideDir}/expectations.md`;
  const graderPath = `${guideDir}/targets/daily-grind/grader.ts`;
  const graderRel = 'guides/css/sample-guide/targets/daily-grind/grader.ts';

  // Initially committed together -> not stale
  assert.strictEqual(changedSince([expPath], [graderPath]), false);
  assert.strictEqual(findStaleTargets(tmpRepo).has(graderRel), false);

  // Content author commits a new expectation without touching grader.ts -> stale
  write('expectations.md', '- Expectation one\n- Expectation two\n');
  run(['commit', '-q', '-am', 'content: add second expectation']);
  assert.strictEqual(changedSince([expPath], [graderPath]), true);
  assert.strictEqual(findStaleTargets(tmpRepo).has(graderRel), true);

  // Grader is subsequently updated -> no longer stale
  write('targets/daily-grind/grader.ts', '// updated grader\n');
  run(['commit', '-q', '-am', 'test: update grader']);
  assert.strictEqual(changedSince([expPath], [graderPath]), false);
  assert.strictEqual(findStaleTargets(tmpRepo).has(graderRel), false);
});
