import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CITC_PATH,
  CLOUDTOP_HOME,
  CLOUDTOP_HOST,
  CORP_HOST,
  FAKE_LDAP,
  GOOGLE_EMAIL,
  LINUX_HOME,
  MACOS_HOME,
  OTHER_FAKE_LDAP,
  REPO_CHECKOUT,
  REPO_CHECKOUT_SUFFIXED,
  WINDOWS_HOME,
} from './fixtures/leak-samples.ts';
import { assertClean, findLeaks, LeakError, scrubString, scrubValue } from './scrub.ts';

describe('scrubString', () => {
  test('strips everything up to the repo checkout folder', () => {
    assert.equal(scrubString(`${REPO_CHECKOUT}/guides/passkeys/grader.ts`), 'guides/passkeys/grader.ts');
  });

  test('handles worktree-style checkout names and home-relative prefixes', () => {
    assert.equal(scrubString(`cwd: "${REPO_CHECKOUT_SUFFIXED}"`), 'cwd: ""');
    assert.equal(scrubString(`${LINUX_HOME}/modern-web-guidance-src/src/harness/x.ts`), 'src/harness/x.ts');
    assert.equal(scrubString(`${MACOS_HOME}/dev/modern-web-guidance-src/README.md`), 'README.md');
  });

  test('does not swallow an escaped quote after the path', () => {
    assert.equal(scrubString(`cwd: \\"${REPO_CHECKOUT_SUFFIXED}\\"`), 'cwd: \\"\\"');
  });

  test('rewrites home directories outside the repo to ~', () => {
    assert.equal(scrubString(`${CLOUDTOP_HOME}/.npm/_npx/abc/node_modules`), '~/.npm/_npx/abc/node_modules');
    assert.equal(scrubString(`${LINUX_HOME}/.cache/ms-playwright`), '~/.cache/ms-playwright');
  });

  test('leaves URL routes and mounted drives alone', () => {
    assert.equal(scrubString('http://localhost:3000/home/settings'), 'http://localhost:3000/home/settings');
    assert.equal(scrubString('/mnt/c/Users/x/y'), '/mnt/c/Users/x/y');
    assert.equal(scrubString('see http://x/Users/profile'), 'see http://x/Users/profile');
  });

  test('strips ANSI escape codes', () => {
    assert.equal(scrubString('\u001b[31mExpected: \u001b[32mtrue\u001b[39m'), 'Expected: true');
  });

  test('is idempotent', () => {
    for (const input of [
      `${LINUX_HOME}/modern-web-guidance-src/a.ts and ${LINUX_HOME}/.other`,
      `${REPO_CHECKOUT_SUFFIXED}/x`,
      'guides/passkeys/grader.ts:42',
    ]) {
      const once = scrubString(input);
      assert.equal(scrubString(once), once, input);
    }
  });
});

describe('scrubValue', () => {
  test('scrubs nested strings and object keys, and returns a new object', () => {
    const input = {
      a: [`${LINUX_HOME}/modern-web-guidance-src/a.ts`],
      b: { c: `${MACOS_HOME}/.z` },
      [`${LINUX_HOME}/modern-web-guidance-src/key.ts`]: 1,
      ok: true,
      nil: null,
    };
    const out = scrubValue(input);
    assert.deepEqual(out, { a: ['a.ts'], b: { c: '~/.z' }, 'key.ts': 1, ok: true, nil: null });
    assert.notEqual(out, input);
    assert.equal(input.a[0], `${LINUX_HOME}/modern-web-guidance-src/a.ts`);
  });
});

describe('findLeaks', () => {
  test('reports every pattern with a path', () => {
    const leaks = findLeaks({
      results: [{ error: `at ${CLOUDTOP_HOME}/x.ts` }, { browserErrors: `host ${CLOUDTOP_HOST}` }],
      email: GOOGLE_EMAIL,
      citc: `${CITC_PATH}/`,
    });
    assert.deepEqual(
      leaks.map(l => [l.path, l.name]),
      [
        ['$.results[0].error', 'cloudtop home path'],
        ['$.results[1].browserErrors', 'googlers hostname'],
        ['$.email', 'google email'],
        ['$.citc', 'citc path'],
      ],
    );
  });

  test('matches hostnames and emails regardless of case or subdomain', () => {
    for (const s of [
      CLOUDTOP_HOST.toUpperCase(),
      GOOGLE_EMAIL.toUpperCase(),
      `${FAKE_LDAP}@c.googlers.com`,
      'x.cloud.googlers.com',
      CORP_HOST,
    ]) {
      assert.equal(findLeaks(s).length, 1, s);
    }
  });

  test('flags home-relative paths that are not dot-directories', () => {
    assert.equal(findLeaks('~/mwg/src/x').length, 1);
    assert.equal(findLeaks('~/mwg/src/x')[0].name, 'home-relative non-dotfile');
    assert.deepEqual(findLeaks('~/.npm/_npx and ~/.cache/ms-playwright'), []);
  });

  test('flags escaped and Windows-style home paths', () => {
    for (const s of [
      CLOUDTOP_HOME.replaceAll('/', '\\/'),
      LINUX_HOME.replaceAll('/', '%2F'),
      `${WINDOWS_HOME}\\x`,
    ]) {
      assert.ok(findLeaks(s).length >= 1, s);
    }
  });

  test('flags forbidden tokens on word boundaries, case-insensitively', () => {
    const options = { forbiddenTokens: [FAKE_LDAP, 'ab'] };
    const capitalized = FAKE_LDAP[0].toUpperCase() + FAKE_LDAP.slice(1);
    assert.equal(findLeaks(`run by ${capitalized}`, options).length, 1);
    assert.equal(findLeaks(`github.com/${FAKE_LDAP}/x.git`, options).length, 1);
    assert.equal(findLeaks(`github.com/${FAKE_LDAP}/x.git`, options)[0].name, 'forbidden token');
    assert.deepEqual(findLeaks(`${FAKE_LDAP}s are fine; abc too`, options), []);
  });

  test('flags leaks in object keys', () => {
    assert.equal(findLeaks({ [`${LINUX_HOME}/y`]: 1 }).length, 1);
  });

  test('reports a cloudtop path once, not also as a linux home path', () => {
    assert.equal(findLeaks(`${CLOUDTOP_HOME}/x`).length, 1);
  });

  test('returns nothing for scrubbed output', () => {
    const scrubbed = scrubValue({ e: `${REPO_CHECKOUT}/a.ts`, h: `/home/${OTHER_FAKE_LDAP}/.npm` });
    assert.deepEqual(findLeaks(scrubbed), []);
  });
});

describe('assertClean', () => {
  test('throws a LeakError listing all hits', () => {
    assert.throws(
      () => assertClean({ a: `${LINUX_HOME}/y`, b: GOOGLE_EMAIL }, 'suite-1'),
      (err: unknown) => err instanceof LeakError && err.leaks.length === 2 && err.message.includes('suite-1'),
    );
  });

  test('does not throw for clean input', () => {
    assertClean({ a: 'guides/x/grader.ts', b: '~/.npm' }, 'suite-1');
  });
});
