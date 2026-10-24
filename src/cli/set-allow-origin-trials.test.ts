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
    const code = await handleSetAllowOriginTrials({
      isAgent: false,
      isTTY: true,
      askConfirmation: async () => true,
      cwd: tempDir,
    });

    assert.strictEqual(code, 0);
    const mwgrcPath = path.join(tempDir, '.mwgrc');
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
});
