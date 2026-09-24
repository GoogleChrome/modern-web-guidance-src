/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Regression guards for the telemetry opt-out on the eval path.
 *
 * `gd eval` is protected by the import-time side effect in harness/config.ts,
 * which sets DISABLE_TELEMETRY for the gd process. Every descendant -- the
 * pnpm workspace runner, the agent CLI, the npx shim, and finally the bundled
 * modern-web CLI -- inherits it from there.
 *
 * That protection has two halves, and both are guarded below:
 *   1. importing harness/config.ts actually sets the var, and
 *   2. the gd entry point actually imports harness/config.ts.
 *
 * Breaking either one silently re-enables telemetry for all eval runs.
 */

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const HARNESS_DIR = path.resolve(import.meta.dirname, '..');
const ROOT_DIR = path.resolve(HARNESS_DIR, '..');

test('importing harness/config.ts disables telemetry', () => {
  // This must run in a child process with DISABLE_TELEMETRY explicitly
  // removed. Asserting in-process would be a false positive: CI sets the var
  // globally, so the assertion would pass even if config.ts stopped setting it.
  const childEnv = { ...process.env };
  delete childEnv.DISABLE_TELEMETRY;

  const configUrl = pathToFileURL(path.join(HARNESS_DIR, 'config.ts')).href;
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--input-type=module',
      '-e',
      `await import(${JSON.stringify(configUrl)});` +
        `process.stdout.write(String(process.env.DISABLE_TELEMETRY));`,
    ],
    { env: childEnv, encoding: 'utf8' }
  );

  assert.strictEqual(
    result.status,
    0,
    `Failed to import harness/config.ts: ${result.stderr}`
  );
  assert.strictEqual(
    result.stdout.trim(),
    '1',
    'Importing harness/config.ts must set DISABLE_TELEMETRY=1. Every eval ' +
      'run relies on this side effect to keep the modern-web CLI from ' +
      'emitting telemetry.'
  );
});

test('gd entry point imports harness/config.ts', () => {
  const source = fs.readFileSync(path.join(ROOT_DIR, 'bin/gd.ts'), 'utf8');
  assert.match(
    source,
    /import\s+.*\bfrom\s+'\.\.\/harness\/config\.ts'/,
    "bin/gd.ts must import harness/config.ts so its telemetry opt-out side " +
      'effect runs before any eval work begins.'
  );
});
