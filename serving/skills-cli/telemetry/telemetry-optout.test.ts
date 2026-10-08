/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Regression guards for test-suite telemetry suppression.
 *
 * Every test run via `node --test` (whether through `pnpm test`, CI,
 * `publish-skills.ts`, or a direct `node --test <file>` invocation) sets
 * `NODE_TEST_CONTEXT` in the test process and any child processes it spawns.
 * `ClearcutLogger` inspects `NODE_TEST_CONTEXT` so tests never emit product
 * telemetry without requiring `DISABLE_TELEMETRY=1` across scripts or test files.
 */

import test, { mock } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { ClearcutLogger } from './ClearcutLogger.ts';
import { WatchdogClient } from './WatchdogClient.ts';
import { CommandType } from './types.ts';
import { rootDir } from '../../../lib/paths.ts';

const ROOT_DIR = rootDir;

test('node --test sets NODE_TEST_CONTEXT and suppresses ClearcutLogger by default', async () => {
  assert.ok(
    process.env.NODE_TEST_CONTEXT !== undefined,
    'NODE_TEST_CONTEXT must be set by node --test so ClearcutLogger suppresses telemetry automatically.'
  );

  const savedDisableTelemetry = process.env.DISABLE_TELEMETRY;
  const sendMock = mock.method(WatchdogClient.prototype, 'send', () => {});
  try {
    delete process.env.DISABLE_TELEMETRY;
    const logger = new ClearcutLogger();
    await logger.logToolCommand(50, true, CommandType.LIST);
    assert.strictEqual(
      sendMock.mock.calls.length,
      0,
      'ClearcutLogger must not send telemetry inside node --test even when DISABLE_TELEMETRY is unset.'
    );
  } finally {
    sendMock.mock.restore();
    if (savedDisableTelemetry !== undefined) {
      process.env.DISABLE_TELEMETRY = savedDisableTelemetry;
    }
  }
});

test('root test script quotes recursive glob so nested telemetry tests run', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8')
  );
  assert.match(
    pkg.scripts.test,
    /"[^"]*serving\/\*\*\/\*\.test\.ts"/,
    'root package.json test script must quote recursive .test.ts globs so /bin/sh ' +
      'passes the recursive glob to node --test instead of expanding only ' +
      'one directory level and skipping skills-cli/telemetry/*.test.ts.'
  );
});
