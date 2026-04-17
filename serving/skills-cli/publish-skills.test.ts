import test from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';
import { getNextVersion } from './publish-skills.ts';
import fs from 'node:fs/promises';

test('getNextVersion derive from git tag', async () => {
  const mockGetTag = () => 'v0.0.22';
  
  const version = await getNextVersion(mockGetTag);
  assert.strictEqual(version, '0.0.23');
});

test('getNextVersion fallback to package.json', async () => {
  const mockGetTag = () => {
    throw new Error('fatal: No names found, cannot describe anything.');
  };

  // Mock fs.readFile to return a version from package.json
  const mockReadFile = mock.method(fs, 'readFile', async (p: string | any) => {
    if (typeof p === 'string' && p.includes('package.json')) {
      return JSON.stringify({ version: '0.0.24' });
    }
    throw new Error(`Unexpected file read: ${p}`);
  });

  try {
    const version = await getNextVersion(mockGetTag);
    assert.strictEqual(version, '0.0.25');
  } finally {
    mockReadFile.mock.restore();
  }
});
