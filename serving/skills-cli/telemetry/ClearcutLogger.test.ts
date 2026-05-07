import { describe, it } from 'node:test';
import assert from 'node:assert';
import { detectOS, bucketizeLatency } from './ClearcutLogger.ts';
import { OsType } from './types.js';

describe('detectOS', () => {
  const expectedOS =
    process.platform === 'darwin'
      ? OsType.MACOS
      : process.platform === 'win32'
        ? OsType.WINDOWS
        : process.platform === 'linux'
          ? OsType.LINUX
          : OsType.UNSPECIFIED;

  it('detects current operating system correctly', () => {
    assert.strictEqual(detectOS(), expectedOS);
  });
});

describe('bucketizeLatency', () => {
  it('groups latency into correct discrete buckets', () => {
    assert.strictEqual(bucketizeLatency(25), 50);
    assert.strictEqual(bucketizeLatency(50), 50);
    assert.strictEqual(bucketizeLatency(75), 100);
    assert.strictEqual(bucketizeLatency(249), 250);
    assert.strictEqual(bucketizeLatency(499), 500);
    assert.strictEqual(bucketizeLatency(800), 1000);
    assert.strictEqual(bucketizeLatency(2000), 2500);
    assert.strictEqual(bucketizeLatency(4500), 5000);
    assert.strictEqual(bucketizeLatency(8000), 10000);
    assert.strictEqual(bucketizeLatency(15000), 10000);
  });
});
