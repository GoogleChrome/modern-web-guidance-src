import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('test command selects reporters without shell expansion and preserves failures', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'guidance-run-tests-'));
  const runner = fileURLToPath(new URL('./run-tests.ts', import.meta.url));
  // Exercise a fresh CLI invocation rather than a nested test-runner worker.
  const baseEnv = { ...process.env };
  delete baseEnv.NODE_TEST_CONTEXT;
  try {
    mkdirSync(join(cwd, 'src'));
    const fixture = join(cwd, 'src', 'fixture.test.ts');
    writeFileSync(fixture, "import { test } from 'node:test'; test('fixture passes', () => {});");

    for (const reporter of [undefined, '', 'spec']) {
      const env = { ...baseEnv };
      if (reporter === undefined) delete env.TEST_REPORTER;
      else env.TEST_REPORTER = reporter;
      const result = spawnSync(process.execPath, [runner, 'src/**/*.test.ts'], { cwd, env, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.error?.message);
      assert.match(result.stdout, reporter === 'spec' ? /fixture passes/ : /\./);
    }

    writeFileSync(fixture, "import { test } from 'node:test'; test('fixture fails', () => { throw new Error('expected failure'); });");
    const result = spawnSync(process.execPath, [runner, 'src/**/*.test.ts'], { cwd, env: baseEnv, encoding: 'utf8' });
    assert.equal(result.status, 1, result.stderr || result.error?.message);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
