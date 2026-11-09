import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CITC_PATH,
  CLOUDTOP_HOME,
  CLOUDTOP_HOST,
  COG_PATH,
  CORP_HOST,
  FAKE_GITHUB_TOKEN,
  FAKE_GOOGLE_API_KEY,
  FAKE_LDAP,
  FAKE_OAUTH_TOKEN,
  FAKE_PRIVATE_KEY_BODY,
  FAKE_SK_KEY,
  GOOGLE_EMAIL,
  LINUX_HOME,
  MACOS_HOME,
  OTHER_FAKE_LDAP,
  PRIVATE_KEY_HEADER,
  REPO_CHECKOUT,
  REPO_CHECKOUT_SUFFIXED,
  UNC_HOME,
  WINDOWS_HOME,
  WINDOWS_HOME_FORWARD,
  WINDOWS_HOME_JSON,
  WSL_HOME,
} from './fixtures/leak-samples.ts';
import { assertClean, findLeaks, harvestUserSegments, harvestUserSegmentsIn, LeakError, REPO_CHECKOUT_NAMES, scrubString, scrubValue } from './scrub.ts';

describe('scrubString', () => {
  test('strips everything up to the repo checkout folder', () => {
    assert.equal(scrubString(`${REPO_CHECKOUT}/guides/passkeys/grader.ts`), 'guides/passkeys/grader.ts');
  });

  test('handles worktree-style checkout names without swallowing surrounding punctuation', () => {
    assert.equal(scrubString(`cwd: "${REPO_CHECKOUT_SUFFIXED}"`), 'cwd: ""');
    assert.equal(scrubString(`cwd: (${REPO_CHECKOUT})`), 'cwd: ()');
    assert.equal(scrubString(`${LINUX_HOME}/modern-web-guidance-src/src/harness/x.ts`), 'src/harness/x.ts');
    assert.equal(scrubString(`${MACOS_HOME}/dev/modern-web-guidance-src/README.md`), 'README.md');
  });

  test('does not swallow an escaped quote after the path', () => {
    assert.equal(scrubString(`cwd: \\"${REPO_CHECKOUT_SUFFIXED}\\"`), 'cwd: \\"\\"');
  });

  test('strips every checkout folder name in REPO_CHECKOUT_NAMES', () => {
    assert.deepEqual(REPO_CHECKOUT_NAMES, ['modern-web-guidance-src', 'guidance']);
    assert.equal(scrubString(`${MACOS_HOME}/code/guidance/src/harness/x.ts`), 'src/harness/x.ts');
    assert.equal(scrubString(`${LINUX_HOME}/code/guidance-2/guides/a/guide.md`), 'guides/a/guide.md');
    assert.deepEqual(findLeaks(scrubString(`${MACOS_HOME}/code/guidance/src/harness/x.ts`)), []);
    // A checkout folder outside the list is not stripped and fails closed.
    assert.ok(findLeaks(scrubString(`${MACOS_HOME}/code/mwg/src/harness/x.ts`)).length > 0);
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

  test('leaves relative imports that merely contain /home alone, and does not flag them', () => {
    for (const input of [
      "import Home from './home/Home'",
      'open ./home/Home.tsx',
      'http://localhost:3000/home/settings',
      'see http://x/Users/profile',
    ]) {
      assert.equal(scrubString(input), input);
      assert.deepEqual(findLeaks(input), [], input);
    }
  });

  test('app routes that start with /home or /Users are left alone by the rewrite but fail closed', () => {
    for (const input of ['href="/home/about"', '<a href="/Users/profile">']) {
      assert.equal(scrubString(input), input);
      assert.deepEqual(findLeaks(input).map(leak => leak.name), ['home path'], input);
    }
  });

  test('a non-home path that looks like one is rewritten and then fails closed', () => {
    const scrubbed = scrubString('GET /Users/42/profile');
    assert.equal(scrubbed, 'GET ~/profile');
    assert.deepEqual(findLeaks(scrubbed).map(leak => leak.name), ['home-relative non-dotfile']);
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
        ['$.results[0].error', 'home path'],
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

  test('does not mistake regex syntax for a home-relative path', () => {
    // JSON Pointer escaping as agents write it: a negated class and a global replace.
    assert.deepEqual(findLeaks(String.raw`/^(?:[^~/]|~0|~1)*$/.test(p) && s.replace(/~/g, '~0')`), []);
  });

  test('flags escaped and Windows-style home paths', () => {
    for (const s of [
      CLOUDTOP_HOME.replaceAll('/', '\\/'),
      LINUX_HOME.replaceAll('/', '%2F'),
      `${WINDOWS_HOME}\\x`,
      `${WINDOWS_HOME_FORWARD}/x`,
      `file:///${WINDOWS_HOME_FORWARD}/x`,
      `{"cwd":"${WINDOWS_HOME_JSON}\\\\x"}`,
      WINDOWS_HOME.toLowerCase(),
      `${WSL_HOME}/x`,
      `${UNC_HOME}\\\\x`,
    ]) {
      assert.ok(findLeaks(s).some(leak => leak.name === 'windows home path' || leak.name === 'escaped home path'), s);
    }
  });

  test('flags a bare home directory with nothing after the user', () => {
    for (const s of [`HOME=${CLOUDTOP_HOME}`, `{"cwd":"${LINUX_HOME}"}`, `Error: ENOENT ${MACOS_HOME}`, `in \`${LINUX_HOME}\``]) {
      assert.deepEqual(findLeaks(s).map(leak => leak.name), ['home path'], s);
      assert.deepEqual(findLeaks(scrubString(s)).map(leak => leak.name), ['home path'], `after scrubbing: ${s}`);
    }
  });

  test('the Emscripten virtual-FS home is neither rewritten nor a leak', () => {
    // Emscripten hard-codes `/home/web_user`, so every cpp-on-the-web patch carries it.
    for (const s of ['/home/web_user', "FS.mkdir('/home/web_user/data')", 'cwd: /home/web_user/src/main.cpp', 'PATH=/opt/bin:/home/web_user/bin']) {
      assert.equal(scrubString(s), s, s);
      assert.deepEqual(findLeaks(s), [], s);
    }
  });

  test('bare home directories of generic accounts are not leaks, with or without trailing prose punctuation', () => {
    for (const s of ['HOME=/home/runner', '(cwd /home/web_user)', '{cwd: /home/web_user}', 'C:\\Users\\runner', '\\\\home\\\\web_user']) {
      assert.deepEqual(findLeaks(scrubString(s)), [], s);
    }
  });

  test('anything inside another generic home is rewritten or flagged, so a name after it fails closed', () => {
    assert.equal(scrubString('npm cache /home/runner/.npm'), 'npm cache ~/.npm');
    for (const s of [
      `/home/runner/work/${FAKE_LDAP}/x`,
      `/Users/user/${FAKE_LDAP}/x`,
      `/home/web_user)/${FAKE_LDAP}/x`,
      `PATH=/opt/bin:/home/runner/work/${FAKE_LDAP}/x`,
      `C:\\Users\\runner\\work\\${FAKE_LDAP}\\x`,
      `/mnt/c/Users/user/${FAKE_LDAP}/x`,
      `\\\\home\\\\runner\\\\${FAKE_LDAP}`,
    ]) {
      assert.ok(findLeaks(scrubString(s)).length > 0, s);
    }
  });

  test('cloudtop and CitC paths are still rewritten or flagged even under a generic account name', () => {
    assert.equal(scrubString('/usr/local/google/home/runner/x'), '~/x');
    for (const s of ['/usr/local/google/home/runner/x', '/google/src/cloud/root/ws/x']) {
      assert.ok(findLeaks(s).length > 0, s);
    }
  });

  test('a colon before a home directory does not make it safe', () => {
    for (const s of [`PATH=/opt/bin:${LINUX_HOME}/bin`, `scp host:${LINUX_HOME}/x .`]) {
      assert.ok(findLeaks(s).length > 0, s);
      assert.ok(findLeaks(scrubString(s)).length > 0, `after scrubbing: ${s}`);
    }
  });

  test('flags credential shapes without flagging PEM parser code', () => {
    const cases: [string, string][] = [
      [`key=${FAKE_GOOGLE_API_KEY}`, 'google api key'],
      [`Authorization: Bearer ${FAKE_SK_KEY}`, 'secret key'],
      [`token ${FAKE_OAUTH_TOKEN}`, 'oauth token'],
      [`GH_TOKEN=${FAKE_GITHUB_TOKEN}`, 'github token'],
      [`${PRIVATE_KEY_HEADER}\n${FAKE_PRIVATE_KEY_BODY}`, 'private key'],
      [`+${PRIVATE_KEY_HEADER}\n+${FAKE_PRIVATE_KEY_BODY}`, 'private key'],
      [`${PRIVATE_KEY_HEADER}\\n${FAKE_PRIVATE_KEY_BODY}`, 'private key'],
    ];
    for (const [input, name] of cases) {
      assert.deepEqual(findLeaks(input).map(leak => leak.name), [name], input);
    }
    assert.deepEqual(findLeaks('task-abcdefghijklmnopqrstuvwxyz and ghp_short'), []);
    assert.deepEqual(findLeaks('pem += `-----BEGIN PRIVATE KEY-----\\n${privB64}\\n-----END PRIVATE KEY-----`;'), []);
    assert.deepEqual(findLeaks('trimmed.match(/-----BEGIN PRIVATE KEY-----([\\s\\S]+?)-----END PRIVATE KEY-----/)'), []);
  });

  test('flags CitC and Cog workspace paths', () => {
    assert.deepEqual(findLeaks(`${CITC_PATH}/google3`).map(leak => leak.name), ['citc path']);
    assert.deepEqual(findLeaks(`${COG_PATH}/google3`).map(leak => leak.name), ['citc path']);
  });

  test('flags forbidden tokens on word boundaries, case-insensitively', () => {
    const options = { forbiddenTokens: [FAKE_LDAP] };
    const capitalized = FAKE_LDAP[0].toUpperCase() + FAKE_LDAP.slice(1);
    assert.equal(findLeaks(`run by ${capitalized}`, options).length, 1);
    assert.equal(findLeaks(`github.com/${FAKE_LDAP}/x.git`, options).length, 1);
    assert.equal(findLeaks(`github.com/${FAKE_LDAP}/x.git`, options)[0].name, 'forbidden token');
    assert.deepEqual(findLeaks(`${FAKE_LDAP}s are fine; abc too`, options), []);
  });

  test('flags leaks in object keys', () => {
    assert.equal(findLeaks({ [`${LINUX_HOME}/y`]: 1 }).length, 1);
  });

  test('reports a cloudtop path once', () => {
    assert.equal(findLeaks(`${CLOUDTOP_HOME}/x`).length, 1);
  });

  test('returns nothing for scrubbed output', () => {
    const scrubbed = scrubValue({ e: `${REPO_CHECKOUT}/a.ts`, h: `/home/${OTHER_FAKE_LDAP}/.npm` });
    assert.deepEqual(findLeaks(scrubbed), []);
  });
});

describe('harvestUserSegments', () => {
  test('collects the user segment of every home, CitC and Windows path shape across strings and JSON', () => {
    const text = [
      `${CLOUDTOP_HOME}/.npm`,
      `cwd=${LINUX_HOME}`,
      `/Users/${OTHER_FAKE_LDAP}/x`,
      `${WINDOWS_HOME}\\x`,
      `${WSL_HOME}/y`,
      `${UNC_HOME}\\\\z`,
      `${COG_PATH}/google3`,
    ].join(' ');
    assert.deepEqual(harvestUserSegments(text).sort(), [OTHER_FAKE_LDAP, FAKE_LDAP].sort());
    assert.deepEqual(
      harvestUserSegmentsIn({ [`/home/thirduser/.npm`]: [`${CLOUDTOP_HOME}/x`] }).sort(),
      [FAKE_LDAP, 'thirduser'].sort(),
    );
  });

  test('ignores generic container accounts, non-token segments, and non-home paths', () => {
    assert.deepEqual(
      harvestUserSegments('/home/runner/.npm /home/node/.cache /home/web_user/x /Users/ubuntu/x /home/ab/x /Users/42/x ./home/Home http://h/home/settings'),
      [],
    );
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
