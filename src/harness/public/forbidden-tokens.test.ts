import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { forbiddenTokens, forbiddenTokensVersion } from './forbidden-tokens.ts';
import { FAKE_LDAP, OTHER_FAKE_LDAP } from './fixtures/leak-samples.ts';

const me = os.userInfo().username;

describe('forbiddenTokens', () => {
  test('merges explicit, environment and OS user, trimmed and de-duplicated', () => {
    const tokens = forbiddenTokens([FAKE_LDAP], { PUBLIC_EVALS_FORBIDDEN_TOKENS: ` ${OTHER_FAKE_LDAP}, ${FAKE_LDAP} ,ab` });
    assert.deepEqual(tokens, [FAKE_LDAP, OTHER_FAKE_LDAP, me]);
  });

  test('without any list, the OS user is still a token', () => {
    assert.deepEqual(forbiddenTokens([], {}), [me]);
  });

  test('in CI the OS user is omitted and the environment list is required', () => {
    assert.deepEqual(forbiddenTokens([], { CI: 'true', PUBLIC_EVALS_FORBIDDEN_TOKENS: FAKE_LDAP }), [FAKE_LDAP]);
    assert.throws(() => forbiddenTokens([], { CI: 'true' }), /PUBLIC_EVALS_FORBIDDEN_TOKENS/);
    assert.throws(() => forbiddenTokens([], { CI: '1', PUBLIC_EVALS_FORBIDDEN_TOKENS: ' , ' }), /PUBLIC_EVALS_FORBIDDEN_TOKENS/);
  });

  test('CI=false behaves like a workstation', () => {
    assert.deepEqual(forbiddenTokens([], { CI: 'false' }), [me]);
  });

  test('requireList demands the environment list outside CI too', () => {
    assert.throws(() => forbiddenTokens([], {}, { requireList: true }), /PUBLIC_EVALS_FORBIDDEN_TOKENS/);
    assert.deepEqual(forbiddenTokens([], { PUBLIC_EVALS_FORBIDDEN_TOKENS: FAKE_LDAP }, { requireList: true }), [FAKE_LDAP, me]);
  });
});

describe('forbiddenTokensVersion', () => {
  test('reads a non-negative integer, defaulting to 0', () => {
    assert.equal(forbiddenTokensVersion({}), 0);
    assert.equal(forbiddenTokensVersion({ PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION: '3' }), 3);
    assert.equal(forbiddenTokensVersion({ PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION: '-1' }), 0);
    assert.equal(forbiddenTokensVersion({ PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION: 'two' }), 0);
  });
});
