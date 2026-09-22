/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Regression guards for the telemetry opt-out.
 *
 * Telemetry is enabled by default and is suppressed only by the
 * DISABLE_TELEMETRY env var. Coverage therefore depends on every process that
 * can reach the CLI having that var set. These tests pin the places that
 * provide it so the protection cannot be dropped silently.
 */

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = path.resolve(import.meta.dirname, '../../..');

test('serving test suite runs with telemetry disabled', () => {
  assert.strictEqual(
    process.env.DISABLE_TELEMETRY,
    '1',
    'DISABLE_TELEMETRY must be "1" while the serving tests run, otherwise any ' +
      'test that executes the built CLI will emit real telemetry. Run the ' +
      'suite via `pnpm test` (serving\'s test script sets this).'
  );
});

test('serving test script sets DISABLE_TELEMETRY', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'serving/package.json'), 'utf8')
  );
  assert.match(
    pkg.scripts.test,
    /DISABLE_TELEMETRY=1/,
    'serving/package.json test script must set DISABLE_TELEMETRY=1. This is ' +
      'what protects every test file regardless of its import graph.'
  );
});

test('CI workflow disables telemetry for all jobs', () => {
  const ci = fs.readFileSync(
    path.join(ROOT_DIR, '.github/workflows/ci.yml'),
    'utf8'
  );
  const topLevel = ci.slice(0, ci.indexOf('\njobs:'));
  assert.match(
    topLevel,
    /^\s*DISABLE_TELEMETRY:/m,
    'ci.yml must set DISABLE_TELEMETRY in its top-level env block so no CI ' +
      'job can emit telemetry, regardless of entry point.'
  );
});

test('publish-skills disables telemetry when running dist tests', () => {
  const source = fs.readFileSync(
    path.join(ROOT_DIR, 'serving/skills-cli/publish-skills.ts'),
    'utf8'
  );
  assert.match(
    source,
    /DISABLE_TELEMETRY:\s*'1'/,
    'publish-skills.ts runs the dist tests via execSync outside the pnpm test ' +
      'script, so it must pass DISABLE_TELEMETRY explicitly.'
  );
});
