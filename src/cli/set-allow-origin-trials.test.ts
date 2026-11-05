import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { handleSetAllowOriginTrials } from './set-allow-origin-trials.ts';

describe('handleSetAllowOriginTrials', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'set-ot-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('refused when isAgent or !isTTY with no file created', async () => {
    let asked = false;
    const askConfirmation = async () => {
      asked = true;
      return true;
    };

    assert.strictEqual(
      await handleSetAllowOriginTrials({ isAgent: true, isTTY: true, askConfirmation, cwd: tempDir }),
      1
    );
    assert.strictEqual(
      await handleSetAllowOriginTrials({ isAgent: false, isTTY: false, askConfirmation, cwd: tempDir }),
      1
    );
    assert.strictEqual(asked, false);
    assert.strictEqual(fs.existsSync(path.join(tempDir, '.mwgrc')), false);
  });

  test('creates .mwgrc with allowOriginTrials: true when confirmed', async () => {
    let receivedTargetPath = '';
    const code = await handleSetAllowOriginTrials({
      isAgent: false,
      isTTY: true,
      askConfirmation: async (targetPath) => {
        receivedTargetPath = targetPath;
        return true;
      },
      cwd: tempDir,
    });

    assert.strictEqual(code, 0);
    const mwgrcPath = path.join(tempDir, '.mwgrc');
    assert.strictEqual(receivedTargetPath, mwgrcPath);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(mwgrcPath, 'utf8')), {
      allowOriginTrials: true,
    });
  });

  test('does not create .mwgrc and returns 1 when declined', async () => {
    const code = await handleSetAllowOriginTrials({
      isAgent: false,
      isTTY: true,
      askConfirmation: async () => false,
      cwd: tempDir,
    });

    assert.strictEqual(code, 1);
    assert.strictEqual(fs.existsSync(path.join(tempDir, '.mwgrc')), false);
  });

  test('allows Cursor, Kiro, and Replit integrated terminals when isTTY is true', async () => {
    for (const env of [
      { CURSOR_TRACE_ID: 'xyz-123' },
      { TERM_PROGRAM: 'kiro' },
      { REPL_ID: 'repl-123' },
    ]) {
      const code = await handleSetAllowOriginTrials({
        isTTY: true,
        env,
        askConfirmation: async () => true,
        cwd: tempDir,
      });
      assert.strictEqual(code, 0, `Expected interactive terminal with ${JSON.stringify(env)} to succeed`);
    }
    assert.deepStrictEqual(
      JSON.parse(fs.readFileSync(path.join(tempDir, '.mwgrc'), 'utf8')),
      { allowOriginTrials: true },
    );
  });

  test('refuses strong agent signals even inside IDE terminals', async () => {
    for (const env of [
      { CURSOR_TRACE_ID: 'xyz-123', CURSOR_EXTENSION_HOST_ROLE: 'agent-exec' },
      { CURSOR_AGENT: '1' },
      { CURSOR_TRACE_ID: 'xyz-123', CLAUDECODE: '1' },
    ]) {
      const code = await handleSetAllowOriginTrials({
        isTTY: true,
        env,
        askConfirmation: async () => true,
        cwd: tempDir,
      });
      assert.strictEqual(code, 1, `Expected agent env ${JSON.stringify(env)} to be blocked`);
    }
    assert.strictEqual(fs.existsSync(path.join(tempDir, '.mwgrc')), false);
  });
});
