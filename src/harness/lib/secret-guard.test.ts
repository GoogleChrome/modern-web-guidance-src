import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  collectHostSecrets,
  copySanitizedNpmrc,
  extractBase64TrajectoryPayloads,
  findSecretLeaks,
  loadAllowedEnvFile,
  sanitizeNpmrc,
  sanitizeTextSecrets,
} from './secret-guard.ts';
import { createIsolatedHome } from './agent-shared.ts';
import { generateExportHtml } from './trajectory-export.ts';

function withTempDir(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-guard-test-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('loadAllowedEnvFile', () => {
  test('loads only allowlisted keys without overwriting existing env or leaking secrets', () => {
    withTempDir((dir) => {
      const envFile = path.join(dir, '.env');
      fs.writeFileSync(
        envFile,
        [
          'PI_MODEL=openrouter/test/model',
          'ANTIGRAVITY_MODEL=preset',
          'ANTIGRAVITY_EFFORT=high',
          'CLAUDE_EFFORT=medium',
          'CODEX_EFFORT=xhigh',
          'JETSKI_EFFORT=max',
          `GEMINI_API_KEY=AIzaSy${'M'.repeat(33)}`,
          'UNLISTED_TOKEN=secret-1234',
        ].join('\n') + '\n',
        'utf8',
      );
      const targetEnv: NodeJS.ProcessEnv = { ANTIGRAVITY_MODEL: 'caller-override' };
      const res = loadAllowedEnvFile(envFile, targetEnv);
      assert.strictEqual(targetEnv.PI_MODEL, 'openrouter/test/model');
      assert.strictEqual(targetEnv.ANTIGRAVITY_MODEL, 'caller-override');
      assert.strictEqual(targetEnv.ANTIGRAVITY_EFFORT, 'high');
      assert.strictEqual(targetEnv.CLAUDE_EFFORT, 'medium');
      assert.strictEqual(targetEnv.CODEX_EFFORT, 'xhigh');
      assert.strictEqual(targetEnv.JETSKI_EFFORT, 'max');
      assert.strictEqual(targetEnv.GEMINI_API_KEY, undefined);
      assert.strictEqual(targetEnv.UNLISTED_TOKEN, undefined);
      assert.deepStrictEqual(res.ignored, ['GEMINI_API_KEY', 'UNLISTED_TOKEN']);
    });
  });
});

describe('sanitizeNpmrc & copySanitizedNpmrc', () => {
  test('strips auth credentials and coupled private registries while preserving public settings', () => {
    const raw = [
      'registry=https://npm.pkg.example/proxy/npm-proxy/',
      `//npm.pkg.example/proxy/npm-proxy/:_authToken=${['ya29', 'r', 'x'.repeat(36)].join('.')}`,
      '//npm.pkg.example/proxy/npm-proxy/:email=user@example.com',
      'always-auth=true',
      '@private-scope:registry=https://registry.pkg.example/team/npm/',
      '//registry.pkg.example/:_password=c2VjcmV0cGFzc3dvcmQ=',
      '//registry.pkg.example/:username=bot',
      '@public-scope:registry=https://registry.npmjs.org/',
      'fetch-timeout=60000',
    ].join('\n');

    const cleaned = sanitizeNpmrc(raw);
    for (const removed of ['_authToken', '_password', 'ya29.', 'npm.pkg.example', 'registry.pkg.example', 'always-auth']) {
      assert.ok(!cleaned.includes(removed), `Expected ${removed} stripped`);
    }
    assert.ok(cleaned.includes('@public-scope:registry=https://registry.npmjs.org/'));
    assert.ok(cleaned.includes('fetch-timeout=60000'));
  });

  test('omits empty destination and copies sanitized .npmrc into isolated HOME', () => {
    withTempDir((dir) => {
      const onlyPrivate = path.join(dir, 'only-private.npmrc');
      const skippedDest = path.join(dir, 'dest.npmrc');
      fs.writeFileSync(onlyPrivate, `registry=https://private.pkg.example/repo/\n//private.pkg.example/repo/:_authToken=npm_${'a'.repeat(36)}\n`, 'utf8');
      copySanitizedNpmrc(onlyPrivate, skippedDest);
      assert.strictEqual(fs.existsSync(skippedDest), false);

      const hostHome = path.join(dir, 'host-home');
      fs.mkdirSync(hostHome, { recursive: true });
      const token = `npm_${'Z'.repeat(36)}`;
      fs.writeFileSync(path.join(hostHome, '.npmrc'), `registry=https://private.pkg.example/npm/\n//private.pkg.example/npm/:_authToken=${token}\nfetch-retries=3\n`, 'utf8');

      const prevHome = process.env.HOME;
      process.env.HOME = hostHome;
      let isolated = '';
      try {
        isolated = createIsolatedHome('npmrc-test');
        const isolatedNpmrc = fs.readFileSync(path.join(isolated, '.npmrc'), 'utf8');
        assert.ok(!isolatedNpmrc.includes(token) && !isolatedNpmrc.includes('private.pkg.example') && isolatedNpmrc.includes('fetch-retries=3'));
      } finally {
        process.env.HOME = prevHome;
        if (isolated) fs.rmSync(isolated, { recursive: true, force: true });
      }
    });
  });
});

describe('collectHostSecrets', () => {
  test('collects env, .env, and .npmrc secrets while ignoring paths, placeholders, and mutated HOME', () => {
    withTempDir((dir) => {
      const root = path.join(dir, 'root');
      const fakeHome = path.join(dir, 'fake-home');
      fs.mkdirSync(root, { recursive: true });
      fs.mkdirSync(fakeHome, { recursive: true });

      const envSecret = `AIzaSy${'E'.repeat(33)}`;
      const npmSecret = ['ya29', 'r', 'Q'.repeat(40)].join('.');
      const customSecret = 'custom-secret-token-value-99';
      fs.writeFileSync(path.join(root, '.env'), `GEMINI_API_KEY=${envSecret}\nPI_MODEL=safe/model\n`, 'utf8');
      fs.writeFileSync(path.join(root, '.npmrc'), `//npm.pkg.example/foo/:_authToken=${npmSecret}\n//example.com/:_authToken=\${NPM_TOKEN}\n`, 'utf8');
      fs.writeFileSync(path.join(fakeHome, '.env'), 'TEST_API_KEY=isolated-fake-home-secret-12345\n', 'utf8');

      const prevHome = process.env.HOME;
      process.env.HOME = fakeHome;
      try {
        const secrets = collectHostSecrets({
          rootDir: root,
          homeDir: root,
          env: { MY_SERVICE_API_KEY: customSecret, GOOGLE_APPLICATION_CREDENTIALS: '/home/user/.config/gcloud/adc.json' },
        });
        assert.ok(secrets.includes(envSecret) && secrets.includes(npmSecret) && secrets.includes(customSecret));
        assert.ok(!secrets.some(s => s.includes('adc.json')) && !secrets.includes('${NPM_TOKEN}'));

        const defaultHomeSecrets = collectHostSecrets({ rootDir: dir, env: {} });
        assert.strictEqual(defaultHomeSecrets.includes('isolated-fake-home-secret-12345'), false);
      } finally {
        process.env.HOME = prevHome;
      }
    });
  });
});

describe('sanitizeTextSecrets & findSecretLeaks', () => {
  test('redacts tokens, npmrc, auth headers, and PEM blocks while keeping JSON valid', () => {
    const fakeSecrets = [
      `AIzaSy${'K'.repeat(33)}`,
      `sk-or-v1-${'f'.repeat(48)}`,
      `sk-ant-${'c'.repeat(32)}`,
      ['ya29', 'r', 'A'.repeat(20), 'B'.repeat(25)].join('.'),
      `1//0${'R'.repeat(40)}`,
      `npm_${'N'.repeat(36)}`,
      `github_pat_${'G'.repeat(36)}`,
      'exact-host-secret-123456',
    ];
    const jsonPayload = JSON.stringify({
      key: fakeSecrets[1],
      pem: `-----BEGIN RSA PRIVATE KEY-----\n${'Q'.repeat(64)}\n${'R'.repeat(32)}=\n-----END RSA PRIVATE KEY-----`,
      dump: `GEMINI_API_KEY=${fakeSecrets[0]}\n//npm.pkg.example/:_authToken=${fakeSecrets[3]}\nAuthorization: Bearer custom-${'T'.repeat(24)}`,
      others: fakeSecrets.slice(2),
    });

    const cleaned = sanitizeTextSecrets(jsonPayload, ['exact-host-secret-123456']);
    assert.doesNotThrow(() => JSON.parse(cleaned));
    for (const secret of fakeSecrets) assert.ok(!cleaned.includes(secret));
    assert.ok(cleaned.includes('Authorization: Bearer [REDACTED]') && !cleaned.includes('BEGIN RSA PRIVATE KEY'));
  });

  test('avoids false positives on data URIs, SpinKit classes, and DevSite docs while catching leaks', () => {
    const cleanTextSamples = [
      `data:image/png;base64,${'A'.repeat(20)}AIzaSy${'B'.repeat(33)}==`,
      '.sk-placeholder-shimmer { animation: sk-cube-grid-scale 1.3s; }',
    ];
    for (const sample of cleanTextSamples) {
      assert.strictEqual(sanitizeTextSecrets(sample), sample);
      assert.deepStrictEqual(findSecretLeaks(sample, []), []);
      assert.deepStrictEqual(findSecretLeaks(Buffer.from(sample, 'utf8'), []), []);
    }
    const benignDoc = `https://developer.chrome.com/docs "apiKey": "AIzaSy${'D'.repeat(33)}" AKIAIOSFODNN7EXAMPLE`;
    assert.deepStrictEqual(findSecretLeaks(Buffer.from(benignDoc, 'utf8'), []), []);

    assert.strictEqual(sanitizeTextSecrets(`token=sk-${'A'.repeat(24)}`), 'token=[REDACTED]');
    assert.ok(findSecretLeaks(`Overriding API key GOOGLE_API_KEY with value AIzaSy${'E'.repeat(33)}`, []).includes('google api key log'));
    assert.ok(findSecretLeaks(Buffer.from(`GEMINI_API_KEY=AIzaSy${'F'.repeat(33)}\n`), []).includes('secret env assignment'));
    assert.ok(findSecretLeaks(Buffer.from('my-private-host-secret-999'), ['my-private-host-secret-999']).includes('host secret'));
  });

  test('preserves <script type="application/base64"> payloads when preserveBase64Scripts is true', () => {
    const fakeDb = Buffer.from(`clean sqlite ${'X'.repeat(40)}`);
    const html = generateExportHtml(new Uint8Array(fakeDb), 'session-clean.db') + `\n<!-- sk-or-v1-${'9'.repeat(48)} -->`;
    const scrubbed = sanitizeTextSecrets(html, [], { preserveBase64Scripts: true });
    assert.ok(!scrubbed.includes('sk-or-v1-'));
    assert.deepStrictEqual(extractBase64TrajectoryPayloads(scrubbed), [fakeDb]);
  });
});
