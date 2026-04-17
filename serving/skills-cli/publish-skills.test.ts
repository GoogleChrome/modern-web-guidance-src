import test from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';
import { getNextVersion, _internal } from './publish-skills.ts';
import fs from 'node:fs/promises';
import path from 'node:path';

test('getNextVersion derive from git tag', async () => {
  // Mock getLatestGitTag to return a tag
  const mockGetTag = mock.method(_internal, 'getLatestGitTag', () => {
    return 'v0.0.22';
  });

  try {
    const version = await getNextVersion();
    assert.strictEqual(version, '0.0.23');
  } finally {
    mockGetTag.mock.restore();
  }
});

test('getNextVersion fallback to package.json', async () => {
  // Mock getLatestGitTag to fail (no tags)
  const mockGetTag = mock.method(_internal, 'getLatestGitTag', () => {
    throw new Error('fatal: No names found, cannot describe anything.');
  });

  // Mock fs.readFile to return a version from package.json
  const mockReadFile = mock.method(fs, 'readFile', async (p: string | any) => {
    if (typeof p === 'string' && p.includes('package.json')) {
      return JSON.stringify({ version: '0.0.24' });
    }
    throw new Error(`Unexpected file read: ${p}`);
  });

  try {
    const version = await getNextVersion();
    assert.strictEqual(version, '0.0.25');
  } finally {
    mockGetTag.mock.restore();
    mockReadFile.mock.restore();
  }
});
