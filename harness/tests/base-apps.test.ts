import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

test('devtools-times base app builds successfully', () => {
  const appDir = path.resolve(import.meta.dirname, '../base_apps/devtools-times');
  
  // If node_modules doesn't exist, run pnpm install first to ensure dependencies are present.
  if (!fs.existsSync(path.join(appDir, 'node_modules'))) {
    console.log(`node_modules missing in ${appDir}. Running pnpm install...`);
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
