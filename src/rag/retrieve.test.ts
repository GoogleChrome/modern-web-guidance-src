import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import child_process from 'node:child_process';
import { retrieveUseCase, OriginTrialGateError } from './retrieve.ts';
import { searchUseCases } from './search.ts';

const cliPath = path.resolve(import.meta.dirname, '../cli/modern-web.ts');

function runCli(args: string[], options: { cwd: string }): child_process.SpawnSyncReturns<string> {
  return child_process.spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH ?? '',
      HOME: options.cwd,
      DISABLE_TELEMETRY: '1',
    },
  });
}

describe('retrieveUseCase and Origin Trial gate', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retrieve-ot-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('rejects un-opted-in Origin Trial guide with CAUTION message', async () => {
    await assert.rejects(
      () => retrieveUseCase('agentic-forms', { cwd: tempDir }),
      (err: unknown) => {
        assert.ok(err instanceof OriginTrialGateError);
        assert.ok(err.message.includes('> [!CAUTION]'));
        assert.ok(err.message.includes('declarative-webmcp'));
        assert.ok(err.message.includes('https://chromestatus.com/feature/5117755740913664'));
        assert.ok(err.message.includes('npx modern-web-guidance set-allow-origin-trials'));
        return true;
      }
    );
  });

  test('succeeds on Origin Trial guides when .mwgrc has allowOriginTrials: true', async () => {
    fs.writeFileSync(path.join(tempDir, '.mwgrc'), JSON.stringify({ allowOriginTrials: true }));
    const guide = await retrieveUseCase('agentic-forms', { cwd: tempDir });
    assert.ok(guide.length > 0);
  });

  test('succeeds on regular non-OT guides without .mwgrc', async () => {
    const guide = await retrieveUseCase('accessible-error-announcement', { cwd: tempDir });
    assert.ok(guide.length > 0);
  });

  test('CLI retrieve comma-separated IDs prints non-OT guide, gates OT guide, without unhandled stack trace', () => {
    const res = runCli(['retrieve', 'accessible-error-announcement,agentic-forms'], { cwd: tempDir });

    assert.strictEqual(res.status, 1);
    assert.ok(res.stdout.includes('# Accessible Error Announcement'));
    assert.ok(res.stderr.includes('> [!CAUTION]'));
    assert.ok(!res.stderr.includes('at retrieveUseCase'));
  });

  test('CLI list includes Origin Trial guides when .mwgrc is absent', () => {
    const res = runCli(['list'], { cwd: tempDir });

    assert.strictEqual(res.status, 0);
    const ids = (JSON.parse(res.stdout) as Array<{ id: string }>).map((u) => u.id);
    assert.ok(ids.includes('agentic-forms'));
    assert.ok(ids.includes('apply-webgl-shaders'));
  });

  test('searchUseCases discovers Origin Trial guides when .mwgrc is absent', async () => {
    const results = await searchUseCases('declarative webmcp agentic forms');
    assert.ok(results.map((r) => r.id).includes('agentic-forms'));
  });
});
