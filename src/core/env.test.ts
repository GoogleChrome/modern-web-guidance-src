import test from 'node:test';
import assert from 'node:assert';
import { parseBooleanEnv } from './env.ts';

test('parseBooleanEnv returns defaultValue when value is undefined', () => {
  assert.strictEqual(parseBooleanEnv(undefined, false), false);
  assert.strictEqual(parseBooleanEnv(undefined, true), true);
  assert.strictEqual(parseBooleanEnv(undefined), false);
});

test('parseBooleanEnv recognizes truthy strings', () => {
  for (const truthy of ['1', 'true', 'TRUE', 'True', 'yes', 'YES', 'on', 'ON']) {
    assert.strictEqual(parseBooleanEnv(truthy, false), true, `Expected ${truthy} to be true`);
  }
});

test('parseBooleanEnv recognizes falsy strings', () => {
  for (const falsy of ['0', 'false', 'FALSE', 'False', 'no', 'NO', 'off', 'OFF', '', '   ']) {
    assert.strictEqual(parseBooleanEnv(falsy, true), false, `Expected ${falsy} to be false`);
  }
});

test('parseBooleanEnv returns defaultValue for unrecognized strings', () => {
  assert.strictEqual(parseBooleanEnv('maybe', false), false);
  assert.strictEqual(parseBooleanEnv('maybe', true), true);
  assert.strictEqual(parseBooleanEnv('random_string', false), false);
});
