import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { handleSetAllowVolatileFeatures } from './set-allow-volatile-features.ts';

describe('handleSetAllowVolatileFeatures', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'set-volatile-test-'));
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
      await handleSetAllowVolatileFeatures({ isAgent: true, isTTY: true, askConfirmation, cwd: tempDir }),
      1
    );
    assert.strictEqual(
      await handleSetAllowVolatileFeatures({ isAgent: false, isTTY: false, askConfirmation, cwd: tempDir }),
      1
    );
    assert.strictEqual(asked, false);
    assert.strictEqual(fs.existsSync(path.join(tempDir, '.mwgrc')), false);
  });

  test('creates .mwgrc with allowVolatileFeatures: true when confirmed', async () => {
    let receivedTargetPath = '';
    const code = await handleSetAllowVolatileFeatures({
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
      allowVolatileFeatures: true,
    });
  });

  test('does not create .mwgrc and returns 1 when declined', async () => {
    const code = await handleSetAllowVolatileFeatures({
      isAgent: false,
      isTTY: true,
      askConfirmation: async () => false,
      cwd: tempDir,
    });

    assert.strictEqual(code, 1);
    assert.strictEqual(fs.existsSync(path.join(tempDir, '.mwgrc')), false);
  });
});
