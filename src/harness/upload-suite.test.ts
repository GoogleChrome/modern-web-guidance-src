import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { uploadDirectory } from './upload-suite.ts';
import { generateExportHtml } from './lib/trajectory-export.ts';
import { generateTransientPackage } from './run-suite.ts';

function withTempDir(fn: (dir: string) => Promise<void> | void): Promise<void> | void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-suite-test-'));
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  try {
    const res = fn(dir);
    return res && typeof (res as Promise<void>).then === 'function'
      ? (res as Promise<void>).finally(cleanup)
      : (cleanup(), res);
  } catch (err) {
    cleanup();
    throw err;
  }
}

describe('uploadDirectory fail-closed & staging guard', () => {
  test('redacts text and frontend artifacts via staging without mutating local files', async () => {
    await withTempDir(async (dir) => {
      const taskDir = path.join(dir, 'guide-a', 'task-1', 'run-1', 'guided');
      fs.mkdirSync(taskDir, { recursive: true });

      const fakeKey = `sk-or-v1-${'c'.repeat(48)}`;
      const fakeYa29 = ['ya29', 'r', 'B'.repeat(40)].join('.');
      const hostNeedle = 'host-specific-secret-string-888';

      const files: Record<string, string> = {
        'chat_log.txt': `GEMINI_API_KEY=AIzaSy${'P'.repeat(33)}\n`,
        'agent_stderr.log': `//npm/:_authToken=${fakeYa29}\n`,
        'session-1.jsonl': `${JSON.stringify({ payload: fakeKey })}\n`,
        'modern-web.log': `saw ${hostNeedle}\n`,
        'Page.astro': `---\nconst key = "${fakeKey}";\n---\n`,
        'App.tsx': `export const key = "${fakeKey}";\n`,
      };
      for (const [name, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(taskDir, name), content, 'utf8');
      }

      const benignDb = path.join(taskDir, 'session-1.db');
      fs.writeFileSync(benignDb, `DevSite "apiKey": "AIzaSy${'Q'.repeat(33)}"`, 'utf8');
      fs.writeFileSync(
        path.join(taskDir, 'session-1.html'),
        generateExportHtml(new Uint8Array(fs.readFileSync(benignDb)), 'session-1.db'),
        'utf8',
      );

      const uploaded = new Map<string, string>();
      const fakeBucket = {
        async upload(localPath: string, opts: { destination: string }) {
          uploaded.set(opts.destination, fs.readFileSync(localPath, 'utf8'));
        },
      };

      const stats = await uploadDirectory(fakeBucket, dir, 'suite-1', false, { extraSecrets: [hostNeedle] });
      assert.strictEqual(stats.uploaded, 8);
      assert.strictEqual(stats.redacted, 6);

      const prefix = 'suite-1/guide-a/task-1/run-1/guided';
      assert.ok(!uploaded.get(`${prefix}/chat_log.txt`)?.includes('AIzaSy'));
      assert.ok(!uploaded.get(`${prefix}/agent_stderr.log`)?.includes(fakeYa29));
      assert.ok(!uploaded.get(`${prefix}/session-1.jsonl`)?.includes(fakeKey));
      assert.ok(!uploaded.get(`${prefix}/modern-web.log`)?.includes(hostNeedle));
      assert.ok(!uploaded.get(`${prefix}/Page.astro`)?.includes(fakeKey));
      assert.ok(!uploaded.get(`${prefix}/App.tsx`)?.includes(fakeKey));

      assert.ok(fs.readFileSync(path.join(taskDir, 'chat_log.txt'), 'utf8').includes('AIzaSy'));
      assert.ok(fs.readFileSync(path.join(taskDir, 'Page.astro'), 'utf8').includes(fakeKey));
    });
  });

  test('fails closed before uploading anything when embedded HTML base64 contains secrets', async () => {
    await withTempDir(async (dir) => {
      fs.writeFileSync(path.join(dir, 'evals.json'), '{}', 'utf8');
      const leakyDbBytes = Buffer.from(`SQLite-stub sk-ant-${'d'.repeat(32)}`);
      fs.writeFileSync(
        path.join(dir, 'session-leak.html'),
        generateExportHtml(new Uint8Array(leakyDbBytes), 'session-leak.db'),
        'utf8',
      );

      let uploadCalls = 0;
      const fakeBucket = { async upload() { uploadCalls++; } };

      await assert.rejects(
        () => uploadDirectory(fakeBucket, dir, 'suite-leak', false, { extraSecrets: [] }),
        /Upload blocked: detected credentials/,
      );
      assert.strictEqual(uploadCalls, 0);
    });
  });
});

describe('run.mjs env allowlist isolation', () => {
  test('strips host API keys and arbitrary secrets from both agent wrapper and grader envs', () => {
    return withTempDir((dir) => {
      const graderPath = path.join(dir, 'grader.ts');
      const agentEnvOut = path.join(dir, 'agent-env.json');
      const graderEnvOut = path.join(dir, 'grader-env.json');
      const mockAgent = path.join(dir, 'mock-agent.js');

      fs.writeFileSync(graderPath, '// noop', 'utf8');
      fs.writeFileSync(mockAgent, `import fs from 'fs'; fs.writeFileSync(${JSON.stringify(agentEnvOut)}, JSON.stringify(process.env));`, 'utf8');
      generateTransientPackage(dir, mockAgent, 'prompt', 'unguided', dir, 'task', 'guide', graderPath);
      fs.writeFileSync(path.join(dir, 'grade.mjs'), `import fs from 'fs'; fs.writeFileSync(${JSON.stringify(graderEnvOut)}, JSON.stringify(process.env));`, 'utf8');

      const res = spawnSync(process.execPath, ['run.mjs'], {
        cwd: dir,
        encoding: 'utf8',
        env: {
          ...process.env,
          GEMINI_API_KEY: `AIzaSy${'H'.repeat(33)}`,
          OPENROUTER_API_KEY: `sk-or-v1-${'7'.repeat(48)}`,
          GITHUB_TOKEN: `ghp_${'K'.repeat(36)}`,
          ANTIGRAVITY_MODEL: 'gemini-test-model',
        },
      });
      assert.strictEqual(res.status, 0, res.stderr);

      const agentEnv = JSON.parse(fs.readFileSync(agentEnvOut, 'utf8'));
      const graderEnv = JSON.parse(fs.readFileSync(graderEnvOut, 'utf8'));
      for (const secretVar of ['GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'GITHUB_TOKEN']) {
        assert.strictEqual(agentEnv[secretVar], undefined);
        assert.strictEqual(graderEnv[secretVar], undefined);
      }
      assert.strictEqual(agentEnv.ANTIGRAVITY_MODEL, 'gemini-test-model');
      assert.ok(graderEnv.PATCH_FILE?.endsWith('agent.patch'));
    });
  });
});
