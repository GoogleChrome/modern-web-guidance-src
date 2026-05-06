import test from 'node:test';
import assert from 'node:assert';
import { getNextVersion } from './publish-skills.ts';

test('getNextVersion derive from git tag', async () => {
  const mockGetTag = () => 'v0.0.22';
  
  const version = await getNextVersion(mockGetTag);
  assert.strictEqual(version, '0.0.23');
});
