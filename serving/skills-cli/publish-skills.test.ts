import test from 'node:test';
import assert from 'node:assert';
import { getNextVersion, incrementVersion } from './publish-skills.ts';

test('getNextVersion derive from git tag', async () => {
  const mockGetTag = () => 'v0.0.22';
  
  const version = await getNextVersion(mockGetTag);
  assert.strictEqual(version, '0.0.23');
});

test('incrementVersion correctly increments patch version', () => {
  assert.strictEqual(incrementVersion('0.0.188'), '0.0.189');
  assert.strictEqual(incrementVersion('1.2.3'), '1.2.4');
});


