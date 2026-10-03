import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolveMwgrcPath, readMwgrc, writeMwgrc } from './mwgrc.ts';

describe('mwgrc configuration utility', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mwgrc-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('resolveMwgrcPath finds existing .mwgrc by walking up directories', () => {
    const subDir = path.join(tempDir, 'a', 'b', 'c');
    fs.mkdirSync(subDir, { recursive: true });
    const rootConfig = path.join(tempDir, '.mwgrc');
    fs.writeFileSync(rootConfig, JSON.stringify({ allowOriginTrials: true }));

    assert.strictEqual(resolveMwgrcPath(subDir), rootConfig);
    assert.deepStrictEqual(readMwgrc(subDir), { allowOriginTrials: true });
  });

  test('writeMwgrc stops at .git root, leaves ancestor .mwgrc untouched, preserves keys', () => {
    const ancestorMwgrc = path.join(tempDir, '.mwgrc');
    fs.writeFileSync(ancestorMwgrc, JSON.stringify({ allowOriginTrials: false, ancestor: true }));

    const repoDir = path.join(tempDir, 'my-repo');
    const subDir = path.join(repoDir, 'src', 'components');
    fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(repoDir, '.mwgrc'), JSON.stringify({ existingProp: 'hello' }));

    const writtenPath = writeMwgrc({ allowOriginTrials: true }, subDir);
    assert.strictEqual(writtenPath, path.join(repoDir, '.mwgrc'));
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(writtenPath, 'utf8')), {
      existingProp: 'hello',
      allowOriginTrials: true,
    });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(ancestorMwgrc, 'utf8')), {
      allowOriginTrials: false,
      ancestor: true,
    });
  });

  test('readMwgrc and writeMwgrc throw on malformed JSON and leave content untouched', () => {
    const configFile = path.join(tempDir, '.mwgrc');
    fs.writeFileSync(configFile, 'corrupt content {{{{', 'utf8');

    assert.throws(() => readMwgrc(tempDir));
    assert.throws(() => writeMwgrc({ allowOriginTrials: true }, tempDir));
    assert.strictEqual(fs.readFileSync(configFile, 'utf8'), 'corrupt content {{{{');
  });
});
