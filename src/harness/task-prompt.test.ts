import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getTaskMap } from '../core/guide-validation.ts';
import { generateTransientPackage } from './run-suite.ts';

test('task requirements reach the agent process intact in guided and unguided runs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-prompt-'));
  try {
    const guidesRoot = path.join(dir, 'guides');
    const guideDir = path.join(guidesRoot, 'forms', 'signup');
    const body = '- Add an email input.\n- Add a password input with a "Show password" button.\n  Keep the user\'s value when toggling visibility.\n';
    for (const relativeDir of ['tasks', 'targets/daily-grind']) {
      const taskDir = path.join(guideDir, relativeDir);
      fs.mkdirSync(taskDir, { recursive: true });
      const frontmatter = relativeDir === 'tasks' ? '---\nbase_app: daily-grind\n---\n' : '';
      fs.writeFileSync(path.join(taskDir, 'task.md'), frontmatter + body);
    }
    const agentScript = path.join(dir, 'capture-agent.mjs');
    fs.writeFileSync(agentScript, `import fs from 'node:fs';
import path from 'node:path';
fs.writeFileSync(path.join(process.argv[4], 'received.json'), JSON.stringify({ prompt: process.argv[2], runType: process.argv[3] }));
`);
    const graderPath = path.join(dir, 'grader.ts');
    fs.writeFileSync(graderPath, '// Transport test: grading is stubbed below.');

    const tasks = getTaskMap(guidesRoot);
    assert.equal(tasks.size, 2);
    for (const [key, task] of tasks) {
      for (const runType of ['guided', 'unguided']) {
        const targetDir = path.join(dir, key, runType);
        generateTransientPackage(targetDir, agentScript, task.prompt, runType, dir, 'task', 'signup', graderPath);
        fs.writeFileSync(path.join(targetDir, 'grade.mjs'), 'process.exit(0);');
        const result = spawnSync(process.execPath, ['run.mjs'], {
          cwd: targetDir,
          encoding: 'utf8',
          timeout: 15_000,
        });
        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(targetDir, 'received.json'), 'utf8')), {
          prompt: body.trim(),
          runType,
        });
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
