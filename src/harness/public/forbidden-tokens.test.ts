import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { forbiddenTokens, forbiddenTokensVersion } from './forbidden-tokens.ts';
import { FAKE_LDAP, FAKE_OS_USER, OTHER_FAKE_LDAP } from './fixtures/leak-samples.ts';

const osUser = FAKE_OS_USER;

describe('forbiddenTokens', () => {
  test('merges CLI flag, environment variable, and OS user without blanks or duplicates', () => {
    const tokens = forbiddenTokens([' ' + FAKE_LDAP, ''], { PUBLIC_EVALS_FORBIDDEN_TOKENS: `${FAKE_LDAP}, ${OTHER_FAKE_LDAP} ,` }, { osUser });
    assert.deepEqual(tokens, [FAKE_LDAP, OTHER_FAKE_LDAP, FAKE_OS_USER]);
  });

  test('falls back to the OS user alone outside CI', () => {
    assert.deepEqual(forbiddenTokens([], {}, { osUser }), [FAKE_OS_USER]);
  });

  test('refuses tokens shorter than 3 characters or oddly shaped instead of dropping them', () => {
    assert.throws(() => forbiddenTokens(['ab'], {}, { osUser }), /at least 3 characters[^:]*: ab/);
    assert.throws(() => forbiddenTokens([], { PUBLIC_EVALS_FORBIDDEN_TOKENS: `${FAKE_LDAP},x` }, { osUser }), /at least 3 characters[^:]*: x/);
    assert.throws(() => forbiddenTokens(['a b'], {}, { osUser }), /: a b/);
    assert.throws(() => forbiddenTokens(['.name'], {}, { osUser }), /: \.name/);
    assert.deepEqual(forbiddenTokens(['first.last-2_x'], { CI: '1', PUBLIC_EVALS_FORBIDDEN_TOKENS: FAKE_LDAP }), ['first.last-2_x', FAKE_LDAP]);
  });

  test('in CI the OS user is omitted and the environment list is required', () => {
    assert.throws(() => forbiddenTokens([], { CI: 'true' }, { osUser }), /PUBLIC_EVALS_FORBIDDEN_TOKENS/);
    assert.throws(() => forbiddenTokens([FAKE_LDAP], { CI: '1', PUBLIC_EVALS_FORBIDDEN_TOKENS: ' , ' }, { osUser }), /PUBLIC_EVALS_FORBIDDEN_TOKENS/);
    assert.deepEqual(forbiddenTokens([], { CI: 'true', PUBLIC_EVALS_FORBIDDEN_TOKENS: `${FAKE_LDAP},${OTHER_FAKE_LDAP}` }, { osUser }), [FAKE_LDAP, OTHER_FAKE_LDAP]);
  });

  test('CI=false is treated as local', () => {
    assert.deepEqual(forbiddenTokens([], { CI: 'false' }, { osUser }), [FAKE_OS_USER]);
  });

  test('requireList enforces the environment list outside CI too', () => {
    assert.throws(() => forbiddenTokens([], {}, { requireList: true, osUser }), /PUBLIC_EVALS_FORBIDDEN_TOKENS/);
    assert.deepEqual(forbiddenTokens([], { PUBLIC_EVALS_FORBIDDEN_TOKENS: FAKE_LDAP }, { requireList: true, osUser }), [FAKE_LDAP, FAKE_OS_USER]);
  });
});

describe('forbiddenTokensVersion', () => {
  test('defaults to 0 when unset or blank and parses decimal integers', () => {
    assert.equal(forbiddenTokensVersion({}), 0);
    assert.equal(forbiddenTokensVersion({ PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION: '  ' }), 0);
    assert.equal(forbiddenTokensVersion({ PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION: '0' }), 0);
    assert.equal(forbiddenTokensVersion({ PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION: ' 42 ' }), 42);
  });

  test('refuses negative, fractional, non-decimal, or non-numeric values', () => {
    for (const bad of ['-1', '1.5', '0x10', '1e2', 'two']) {
      assert.throws(() => forbiddenTokensVersion({ PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION: bad }), /non-negative integer/, bad);
    }
  });
});
