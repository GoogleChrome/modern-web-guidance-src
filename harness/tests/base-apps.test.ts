import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

test('devtools-times base app builds successfully', () => {
  const appDir = path.resolve(import.meta.dirname, '../base_apps/devtools-times');
  
  // If node_modules doesn't exist or astro is missing (e.g. dangling symlink), run pnpm install first.
  if (!fs.existsSync(path.join(appDir, 'node_modules')) || !fs.existsSync(path.join(appDir, 'node_modules/astro'))) {
    console.log(`node_modules or astro missing in ${appDir}. Running pnpm install...`);
    try {
      execSync('pnpm install --ignore-workspace', {
        cwd: appDir,
        stdio: 'pipe',
      });
    } catch (err: any) {
      const stdout = err.stdout?.toString() || '';
      const stderr = err.stderr?.toString() || '';
      assert.fail(`pnpm install failed in ${appDir}.\nStdout:\n${stdout}\nStderr:\n${stderr}`);
    }
  }

  // Run pnpm build inside the devtools-times directory.
  try {
    execSync('pnpm build', {
      cwd: appDir,
      stdio: 'pipe',
    });
    assert.ok(true, 'pnpm build succeeded');
  } catch (err: any) {
    const stdout = err.stdout?.toString() || '';
    const stderr = err.stderr?.toString() || '';
    assert.fail(`pnpm build failed in ${appDir}.\nStdout:\n${stdout}\nStderr:\n${stderr}`);
  }
});

test('setupWorkspaceBaseApp copies base app and applies zero-passrate.patch if present without modifying source', async () => {
  const { setupWorkspaceBaseApp } = await import('../run_suite.ts');
  const osTmp = path.join(import.meta.dirname, '../../node_modules/.tmp-test-' + Date.now());
  fs.mkdirSync(osTmp, { recursive: true });

  const mockGuideDir = path.join(osTmp, 'mock-guide');
  const mockTargetsDir = path.join(mockGuideDir, 'targets', 'daily-grind');
  const mockPatchesDir = path.join(mockTargetsDir, 'patches');
  fs.mkdirSync(mockPatchesDir, { recursive: true });

  // Create a valid zero-passrate patch
  const patchContent = 'diff --git a/index.html b/index.html\n--- a/index.html\n+++ b/index.html\n@@ -1,2 +1,3 @@\n+<!-- ZERO_PASSRATE_APPLIED -->\n <!DOCTYPE html>\n <html lang="en">\n';
  fs.writeFileSync(path.join(mockPatchesDir, 'zero-passrate.patch'), patchContent);

  const taskInfo = {
    baseApp: 'daily-grind',
    prompt: 'test prompt',
    guideDir: mockGuideDir
  };

  const runDir = path.join(osTmp, 'run-1');
  const workspaceBaseAppDir = await setupWorkspaceBaseApp(taskInfo, runDir, 'mock-guide', 'daily-grind');

  assert.ok(workspaceBaseAppDir, 'workspaceBaseAppDir should be created');
  assert.ok(fs.existsSync(workspaceBaseAppDir), 'Directory should exist');

  const stagedIndex = fs.readFileSync(path.join(workspaceBaseAppDir, 'index.html'), 'utf8');
  assert.ok(stagedIndex.includes('<!-- ZERO_PASSRATE_APPLIED -->'), 'Staged base app should have zero-passrate.patch applied');

  const sourceAppDir = path.resolve(import.meta.dirname, '../base_apps/daily-grind');
  const sourceIndex = fs.readFileSync(path.join(sourceAppDir, 'index.html'), 'utf8');
  assert.strictEqual(sourceIndex.includes('<!-- ZERO_PASSRATE_APPLIED -->'), false, 'Source harness/base_apps should remain pristine');

  fs.rmSync(osTmp, { recursive: true, force: true });
});

