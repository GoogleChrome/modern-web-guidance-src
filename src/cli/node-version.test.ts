import { describe, it } from 'node:test';
import assert from 'node:assert';
import { checkNodeVersion, formatNodeVersionError, ensureNodeVersion } from './node-version.ts';

describe('node-version check', () => {
  it('identifies Node versions < 22 as unsupported', () => {
    assert.strictEqual(checkNodeVersion('18.20.8'), false);
    assert.strictEqual(checkNodeVersion('20.20.2'), false);
    assert.strictEqual(checkNodeVersion('21.7.3'), false);
  });

  it('identifies Node versions >= 22 as supported', () => {
    assert.strictEqual(checkNodeVersion('22.0.0'), true);
    assert.strictEqual(checkNodeVersion('22.18.0'), true);
    assert.strictEqual(checkNodeVersion('24.0.0'), true);
  });

  it('formats clear error message with current version and upgrade link', () => {
    const msg = formatNodeVersionError('v20.20.2');
    assert.strictEqual(
      msg,
      'modern-web-guidance requires Node.js >= 22 (current: v20.20.2). Please upgrade: https://nodejs.org/'
    );
  });

  it('ensureNodeVersion calls exit(1) and logs error when Node version is < 22', () => {
    let exitCode: number | null = null;
    const errors: string[] = [];
    const origError = console.error;
    console.error = (msg: string) => errors.push(msg);

    try {
      ensureNodeVersion('20.20.2', 'v20.20.2', (code) => {
        exitCode = code;
      });
    } finally {
      console.error = origError;
    }

    assert.strictEqual(exitCode, 1);
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].includes('modern-web-guidance requires Node.js >= 22'));
  });

  it('ensureNodeVersion does not exit when Node version is >= 22', () => {
    let exitCode: number | null = null;
    ensureNodeVersion('22.0.0', 'v22.0.0', (code) => {
      exitCode = code;
    });
    assert.strictEqual(exitCode, null);
  });
});
