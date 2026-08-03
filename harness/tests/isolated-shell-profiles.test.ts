import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { setupIsolatedShellProfiles, createIsolatedHome, cleanupIsolatedHome } from '../lib/agent-shared.ts';

const PROFILE_FILES = ['.bashrc', '.bash_profile', '.zshrc', '.zprofile', '.profile'];

test('setupIsolatedShellProfiles creates all expected profile files with PATH export', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-profiles-'));
  const mockTargetDir = '/mock/target/dir';

  try {
    setupIsolatedShellProfiles(tempDir, mockTargetDir);

    for (const file of PROFILE_FILES) {
      const filePath = path.join(tempDir, file);
      assert.ok(fs.existsSync(filePath), `${file} should be created in home directory`);
      const content = fs.readFileSync(filePath, 'utf8');
      assert.strictEqual(content, `export PATH="${mockTargetDir}:$PATH"\n`, `${file} should contain correct PATH export`);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('createIsolatedHome automatically calls setupIsolatedShellProfiles when targetDir is provided', () => {
  const mockTargetDir = '/mock/auto/dir';
  let homeDir = '';

  try {
    homeDir = createIsolatedHome('test-profiles-auto', mockTargetDir);
    assert.ok(fs.existsSync(homeDir), 'Isolated home should be created');

    for (const file of PROFILE_FILES) {
      const filePath = path.join(homeDir, file);
      assert.ok(fs.existsSync(filePath), `${file} should exist in isolated home when targetDir is passed`);
      const content = fs.readFileSync(filePath, 'utf8');
      assert.strictEqual(content, `export PATH="${mockTargetDir}:$PATH"\n`);
    }
  } finally {
    if (homeDir) cleanupIsolatedHome(homeDir);
  }
});

test('createIsolatedHome does NOT create profile files when targetDir is omitted', () => {
  let homeDir = '';

  try {
    homeDir = createIsolatedHome('test-profiles-omitted');
    assert.ok(fs.existsSync(homeDir), 'Isolated home should be created');

    for (const file of PROFILE_FILES) {
      const filePath = path.join(homeDir, file);
      assert.strictEqual(fs.existsSync(filePath), false, `${file} should NOT exist when targetDir is omitted`);
    }
  } finally {
    if (homeDir) cleanupIsolatedHome(homeDir);
  }
});

test('login shell in isolated HOME correctly prepends targetDir to PATH and executes shim binary', { skip: process.platform === 'win32' }, () => {
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-target-bin-'));
  let homeDir = '';

  try {
    // Create a mock executable binary inside targetDir
    const mockBinName = 'mock-intercepted-tool';
    const mockBinPath = path.join(targetDir, mockBinName);
    fs.writeFileSync(mockBinPath, '#!/bin/sh\necho "intercepted-by-profile"\n', { mode: 0o755 });
    fs.chmodSync(mockBinPath, 0o755);

    // Create isolated home configured with our targetDir
    homeDir = createIsolatedHome('test-shell-exec', targetDir);

    // Test with bash login shell (-l triggers profile evaluation and path_helper reset on macOS)
    const bashResult = spawnSync('bash', ['-l', '-c', mockBinName], {
      env: { ...process.env, HOME: homeDir },
      encoding: 'utf8',
      timeout: 5000,
    });

    assert.strictEqual(bashResult.status, 0, `bash login shell should succeed: ${bashResult.stderr}`);
    assert.strictEqual(bashResult.stdout.trim(), 'intercepted-by-profile', 'bash login shell should execute mock tool from targetDir');

    // If on macOS, also verify zsh login shell (-l triggers zprofile evaluation and path_helper reset)
    if (process.platform === 'darwin') {
      const zshResult = spawnSync('zsh', ['-l', '-c', mockBinName], {
        env: { ...process.env, HOME: homeDir },
        encoding: 'utf8',
        timeout: 5000,
      });
      assert.strictEqual(zshResult.status, 0, `zsh login shell should succeed: ${zshResult.stderr}`);
      assert.strictEqual(zshResult.stdout.trim(), 'intercepted-by-profile', 'zsh login shell should execute mock tool from targetDir');
    }
  } finally {
    if (homeDir) cleanupIsolatedHome(homeDir);
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
});
