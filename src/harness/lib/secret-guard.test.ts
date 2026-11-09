import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  ALLOWED_CHILD_ENV_KEYS,
  ALLOWED_WRAPPER_ENV_KEYS,
  collectHostSecrets,
  copySanitizedNpmrc,
  extractBase64TrajectoryPayloads,
  filterAllowedEnv,
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
        `PI_MODEL=openrouter/test/model\nANTIGRAVITY_MODEL=preset\nGEMINI_API_KEY=AIzaSy${'M'.repeat(33)}\nUNLISTED_TOKEN=secret-1234\n`,
        'utf8',
      );
      const targetEnv: NodeJS.ProcessEnv = { ANTIGRAVITY_MODEL: 'caller-override' };
      const res = loadAllowedEnvFile(envFile, targetEnv);
      assert.strictEqual(targetEnv.PI_MODEL, 'openrouter/test/model');
      assert.strictEqual(targetEnv.ANTIGRAVITY_MODEL, 'caller-override');
      assert.strictEqual(targetEnv.GEMINI_API_KEY, undefined);
      assert.strictEqual(targetEnv.UNLISTED_TOKEN, undefined);
      assert.deepStrictEqual(res.ignored, ['GEMINI_API_KEY', 'UNLISTED_TOKEN']);
    });
  });

  test('loads *_MODEL and *_EFFORT keys while ignoring credential-looking and unlisted keys', () => {
    withTempDir((dir) => {
      const envFile = path.join(dir, '.env');
      fs.writeFileSync(
        envFile,
        'GEMINI_MODEL=gemini-3.1-pro-preview\ngemini_model=gemini-1.5-flash\nCLAUDE_EFFORT=high\nMODEL_API_KEY=secret-key-12345678\nUNLISTED_KEY=some-value\n',
        'utf8',
      );
      const targetEnv: NodeJS.ProcessEnv = {};
      const res = loadAllowedEnvFile(envFile, targetEnv);
      assert.strictEqual(targetEnv.GEMINI_MODEL, 'gemini-3.1-pro-preview');
      assert.strictEqual(targetEnv.gemini_model, 'gemini-1.5-flash');
      assert.strictEqual(targetEnv.CLAUDE_EFFORT, 'high');
      assert.strictEqual(targetEnv.MODEL_API_KEY, undefined);
      assert.strictEqual(targetEnv.UNLISTED_KEY, undefined);
      assert.deepStrictEqual(res.loaded, ['CLAUDE_EFFORT', 'GEMINI_MODEL', 'gemini_model']);
      assert.deepStrictEqual(res.ignored, ['MODEL_API_KEY', 'UNLISTED_KEY']);
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

  test('uses NPM_CONFIG_USERCONFIG as the source for sanitized .npmrc in isolated HOME when set', () => {
    withTempDir((dir) => {
      const customConfigDir = path.join(dir, 'custom-npm');
      fs.mkdirSync(customConfigDir, { recursive: true });
      const customNpmrc = path.join(customConfigDir, '.npmrc');
      const token = `npm_${'K'.repeat(36)}`;
      fs.writeFileSync(
        customNpmrc,
        `registry=http://localhost:4873/\n//npm.pkg.example/:_authToken=${token}\nfetch-retries=5\n`,
        'utf8',
      );

      const prevUserConfig = process.env.NPM_CONFIG_USERCONFIG;
      process.env.NPM_CONFIG_USERCONFIG = customNpmrc;
      let isolated = '';
      try {
        isolated = createIsolatedHome('custom-npmrc-test');
        const isolatedNpmrc = fs.readFileSync(path.join(isolated, '.npmrc'), 'utf8');
        assert.ok(isolatedNpmrc.includes('registry=http://localhost:4873/'), 'Registry should be preserved');
        assert.ok(!isolatedNpmrc.includes(token), '_authToken should be stripped');
        assert.ok(isolatedNpmrc.includes('fetch-retries=5'), 'Safe config should be preserved');
      } finally {
        if (prevUserConfig === undefined) delete process.env.NPM_CONFIG_USERCONFIG;
        else process.env.NPM_CONFIG_USERCONFIG = prevUserConfig;
        if (isolated) fs.rmSync(isolated, { recursive: true, force: true });
      }
    });
  });

  test('uses lowercase npm_config_userconfig as the source for sanitized .npmrc in isolated HOME when set', () => {
    withTempDir((dir) => {
      const customConfigDir = path.join(dir, 'custom-npm-lower');
      fs.mkdirSync(customConfigDir, { recursive: true });
      const customNpmrc = path.join(customConfigDir, '.npmrc');
      const token = `npm_${'L'.repeat(36)}`;
      fs.writeFileSync(
        customNpmrc,
        `registry=http://localhost:4873/\n//npm.pkg.example/:_authToken=${token}\nfetch-retries=5\n`,
        'utf8',
      );

      const prevUserConfig = process.env.NPM_CONFIG_USERCONFIG;
      const prevLowerConfig = process.env.npm_config_userconfig;
      delete process.env.NPM_CONFIG_USERCONFIG;
      process.env.npm_config_userconfig = customNpmrc;
      let isolated = '';
      try {
        isolated = createIsolatedHome('custom-npmrc-lower-test');
        const isolatedNpmrc = fs.readFileSync(path.join(isolated, '.npmrc'), 'utf8');
        assert.ok(isolatedNpmrc.includes('registry=http://localhost:4873/'), 'Registry should be preserved');
        assert.ok(!isolatedNpmrc.includes(token), '_authToken should be stripped');
        assert.ok(isolatedNpmrc.includes('fetch-retries=5'), 'Safe config should be preserved');
      } finally {
        if (prevUserConfig === undefined) delete process.env.NPM_CONFIG_USERCONFIG;
        else process.env.NPM_CONFIG_USERCONFIG = prevUserConfig;
        if (prevLowerConfig === undefined) delete process.env.npm_config_userconfig;
        else process.env.npm_config_userconfig = prevLowerConfig;
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

  test('does not collect *_MODEL or *_EFFORT values from .env while still collecting credential and unlisted keys', () => {
    withTempDir((dir) => {
      const root = path.join(dir, 'root');
      fs.mkdirSync(root, { recursive: true });

      const geminiModel = 'gemini-3.1-pro-preview';
      const geminiModelLower = 'gemini-1.5-flash-lower';
      const effortLevel = 'extended-reasoning-effort';
      const modelApiKey = 'model-api-key-secret-12345';
      const unlistedSecret = 'unlisted-secret-config-value';

      fs.writeFileSync(
        path.join(root, '.env'),
        [
          `GEMINI_MODEL=${geminiModel}`,
          `gemini_model=${geminiModelLower}`,
          `CLAUDE_EFFORT=${effortLevel}`,
          `MODEL_API_KEY=${modelApiKey}`,
          `UNLISTED_CUSTOM_CONFIG=${unlistedSecret}`,
        ].join('\n'),
        'utf8',
      );

      const secrets = collectHostSecrets({ rootDir: root, env: {} });
      assert.strictEqual(secrets.includes(geminiModel), false, 'GEMINI_MODEL value should not be collected as secret');
      assert.strictEqual(secrets.includes(geminiModelLower), false, 'gemini_model value should not be collected as secret');
      assert.strictEqual(secrets.includes(effortLevel), false, '*_EFFORT value should not be collected as secret');
      assert.strictEqual(secrets.includes(modelApiKey), true, 'MODEL_API_KEY value should still be collected as secret');
      assert.strictEqual(secrets.includes(unlistedSecret), true, 'Unlisted config value should still be collected as secret');
    });
  });

  test('collects auth tokens from NPM_CONFIG_USERCONFIG as secret needles', () => {
    withTempDir((dir) => {
      const customConfigDir = path.join(dir, 'custom-npm');
      fs.mkdirSync(customConfigDir, { recursive: true });
      const customNpmrc = path.join(customConfigDir, '.npmrc');
      const token = ['ya29', 'custom', 'C'.repeat(36)].join('.');
      fs.writeFileSync(
        customNpmrc,
        `registry=http://localhost:4873/\n//npm.pkg.example/:_authToken=${token}\n`,
        'utf8',
      );

      const secrets = collectHostSecrets({
        rootDir: dir,
        homeDir: dir,
        env: { NPM_CONFIG_USERCONFIG: customNpmrc },
      });
      assert.strictEqual(secrets.includes(token), true, 'Token from NPM_CONFIG_USERCONFIG should be collected as secret needle');
    });
  });

  test('collects auth tokens from lowercase npm_config_userconfig as secret needles', () => {
    withTempDir((dir) => {
      const customConfigDir = path.join(dir, 'custom-npm-lower');
      fs.mkdirSync(customConfigDir, { recursive: true });
      const customNpmrc = path.join(customConfigDir, '.npmrc');
      const token = ['ya29', 'lower', 'D'.repeat(36)].join('.');
      fs.writeFileSync(
        customNpmrc,
        `registry=http://localhost:4873/\n//npm.pkg.example/:_authToken=${token}\n`,
        'utf8',
      );

      const secrets = collectHostSecrets({
        rootDir: dir,
        homeDir: dir,
        env: { npm_config_userconfig: customNpmrc },
      });
      assert.strictEqual(secrets.includes(token), true, 'Token from npm_config_userconfig should be collected as secret needle');
    });
  });
});

describe('ALLOWED_WRAPPER_ENV_KEYS vs ALLOWED_CHILD_ENV_KEYS', () => {
  test('wrapper allowlist keeps NPM_CONFIG_USERCONFIG and npm_config_userconfig while child allowlist drops them', () => {
    assert.strictEqual(ALLOWED_WRAPPER_ENV_KEYS.has('NPM_CONFIG_USERCONFIG'), true);
    assert.strictEqual(ALLOWED_WRAPPER_ENV_KEYS.has('npm_config_userconfig'), true);
    assert.strictEqual(ALLOWED_CHILD_ENV_KEYS.has('NPM_CONFIG_USERCONFIG'), false);
    assert.strictEqual(ALLOWED_CHILD_ENV_KEYS.has('npm_config_userconfig'), false);

    const sourceEnv = {
      PATH: '/usr/bin',
      NPM_CONFIG_USERCONFIG: '/path/to/.npmrc',
      npm_config_userconfig: '/path/to/.npmrc',
    };

    const wrapperEnv = filterAllowedEnv(sourceEnv, ALLOWED_WRAPPER_ENV_KEYS);
    assert.strictEqual(wrapperEnv.NPM_CONFIG_USERCONFIG, '/path/to/.npmrc');
    assert.strictEqual(wrapperEnv.npm_config_userconfig, '/path/to/.npmrc');

    const childEnv = filterAllowedEnv(sourceEnv, ALLOWED_CHILD_ENV_KEYS);
    assert.strictEqual(childEnv.NPM_CONFIG_USERCONFIG, undefined);
    assert.strictEqual(childEnv.npm_config_userconfig, undefined);
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
