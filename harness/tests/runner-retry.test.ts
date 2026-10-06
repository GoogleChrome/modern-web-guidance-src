import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { generateTransientPackage } from '../run_suite.ts';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'runner-retry-test-'));
}

function removeTempDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// Helper to patch the delay in the generated run.mjs to 1ms
function patchRunnerDelay(targetDir: string) {
  const runMjsPath = path.join(targetDir, 'run.mjs');
  let content = fs.readFileSync(runMjsPath, 'utf8');
  content = content.replace(/setTimeout\(\(\)=>{}, ' \+ delay \+ '\)/g, "setTimeout(()=>{}, 1)");
  fs.writeFileSync(runMjsPath, content, 'utf8');
}

// Helper to write a mock agent script that fails/succeeds according to state
function writeMockAgentScript(targetDir: string) {
  const agentScriptPath = path.join(targetDir, 'mock-agent.js');
  const code = `
import fs from 'fs';
import path from 'path';

const targetDir = process.argv[4];
const stateFile = path.join(targetDir, 'mock-agent-state.json');

let state = { attempts: 0, failAttempts: 0, exitCode: 1 };
if (fs.existsSync(stateFile)) {
  state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
}

state.attempts++;
fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

if (state.attempts <= state.failAttempts) {
  process.exit(state.exitCode);
} else {
  process.exit(0);
}
`;
  fs.writeFileSync(agentScriptPath, code.trim(), 'utf8');
  return agentScriptPath;
}

// Helper to configure the mock agent state
function setMockAgentState(targetDir: string, failAttempts: number, exitCode: number = 1) {
  const stateFile = path.join(targetDir, 'mock-agent-state.json');
  fs.writeFileSync(stateFile, JSON.stringify({ attempts: 0, failAttempts, exitCode }, null, 2), 'utf8');
}

// Helper to read the mock agent state
function getMockAgentState(targetDir: string) {
  const stateFile = path.join(targetDir, 'mock-agent-state.json');
  if (fs.existsSync(stateFile)) {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  }
  return null;
}

test('run.mjs: succeeds on first try without retries', () => {
  const tempDir = createTempDir();
  try {
    const graderPath = path.join(tempDir, 'grader.ts');
    fs.writeFileSync(graderPath, '// mock grader');

    const agentScript = writeMockAgentScript(tempDir);
    setMockAgentState(tempDir, 0); // 0 failures, should succeed immediately

    generateTransientPackage(
      tempDir,
      agentScript,
      'dummy prompt',
      'guided',
      tempDir,
      'test-task',
      'test-guide',
      graderPath
    );

    patchRunnerDelay(tempDir);

    // Overwrite the generated grade.mjs to be a mock that succeeds
    const gradeMjsPath = path.join(tempDir, 'grade.mjs');
    fs.writeFileSync(gradeMjsPath, 'console.log("Mock grader ran"); process.exit(0);', 'utf8');

    // Run the generated run.mjs
    const runResult = spawnSync(process.execPath, ['run.mjs'], { cwd: tempDir, encoding: 'utf8' });

    assert.strictEqual(runResult.status, 0, 'Execution should exit with 0');
    
    // Check state
    const state = getMockAgentState(tempDir);
    assert.ok(state, 'State file should exist');
    assert.strictEqual(state.attempts, 1, 'Should have only attempted once');

    // Check generation_failed.json does not exist
    const failureFile = path.join(tempDir, 'generation_failed.json');
    assert.strictEqual(fs.existsSync(failureFile), false, 'generation_failed.json should not exist');

    // Check runtime.json
    const runtimeFile = path.join(tempDir, 'runtime.json');
    assert.ok(fs.existsSync(runtimeFile), 'runtime.json should exist');
    const runtimeData = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
    assert.strictEqual(runtimeData.agentStatus, 0, 'agentStatus in runtime.json should be 0');
  } finally {
    removeTempDir(tempDir);
  }
});

test('run.mjs: retries on failure and succeeds on subsequent try', () => {
  const tempDir = createTempDir();
  try {
    const graderPath = path.join(tempDir, 'grader.ts');
    fs.writeFileSync(graderPath, '// mock grader');

    const agentScript = writeMockAgentScript(tempDir);
    setMockAgentState(tempDir, 1); // 1 failure, should succeed on 2nd attempt

    generateTransientPackage(
      tempDir,
      agentScript,
      'dummy prompt',
      'guided',
      tempDir,
      'test-task',
      'test-guide',
      graderPath
    );

    patchRunnerDelay(tempDir);

    // Overwrite the generated grade.mjs to be a mock that succeeds
    const gradeMjsPath = path.join(tempDir, 'grade.mjs');
    fs.writeFileSync(gradeMjsPath, 'console.log("Mock grader ran"); process.exit(0);', 'utf8');

    // Run the generated run.mjs
    const runResult = spawnSync(process.execPath, ['run.mjs'], { cwd: tempDir, encoding: 'utf8' });

    assert.strictEqual(runResult.status, 0, 'Execution should exit with 0 after successful retry');
    
    // Check state
    const state = getMockAgentState(tempDir);
    assert.ok(state, 'State file should exist');
    assert.strictEqual(state.attempts, 2, 'Should have attempted twice (1 retry)');

    // Check generation_failed.json does not exist
    const failureFile = path.join(tempDir, 'generation_failed.json');
    assert.strictEqual(fs.existsSync(failureFile), false, 'generation_failed.json should not exist after successful retry');

    // Check runtime.json
    const runtimeFile = path.join(tempDir, 'runtime.json');
    assert.ok(fs.existsSync(runtimeFile), 'runtime.json should exist');
    const runtimeData = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
    assert.strictEqual(runtimeData.agentStatus, 0, 'agentStatus in runtime.json should be 0');
  } finally {
    removeTempDir(tempDir);
  }
});

test('run.mjs: fails permanently after maximum attempts', () => {
  const tempDir = createTempDir();
  try {
    const graderPath = path.join(tempDir, 'grader.ts');
    fs.writeFileSync(graderPath, '// mock grader');

    const agentScript = writeMockAgentScript(tempDir);
    setMockAgentState(tempDir, 5, 42); // 5 failures (exceeds maxAttempts=3), exits with 42

    generateTransientPackage(
      tempDir,
      agentScript,
      'dummy prompt',
      'guided',
      tempDir,
      'test-task',
      'test-guide',
      graderPath
    );

    patchRunnerDelay(tempDir);

    // Overwrite the generated grade.mjs to be a mock that succeeds
    const gradeMjsPath = path.join(tempDir, 'grade.mjs');
    fs.writeFileSync(gradeMjsPath, 'console.log("Mock grader ran"); process.exit(0);', 'utf8');

    // Run the generated run.mjs
    const runResult = spawnSync(process.execPath, ['run.mjs'], { cwd: tempDir, encoding: 'utf8' });

    assert.strictEqual(runResult.status, 42, 'Execution should exit with the agent exit code (42)');
    
    // Check state
    const state = getMockAgentState(tempDir);
    assert.ok(state, 'State file should exist');
    assert.strictEqual(state.attempts, 3, 'Should have attempted exactly 3 times (1 initial + 2 retries)');

    // Check generation_failed.json exists and has correct info
    const failureFile = path.join(tempDir, 'generation_failed.json');
    assert.ok(fs.existsSync(failureFile), 'generation_failed.json should exist after permanent failure');
    const failureData = JSON.parse(fs.readFileSync(failureFile, 'utf8'));
    assert.strictEqual(failureData.exitCode, 42, 'exitCode in generation_failed.json should match agent exit code');
    assert.strictEqual(failureData.agentName, 'mock-agent.js', 'agentName in generation_failed.json should match');
    assert.ok(failureData.stderr, 'stderr should be populated');

    // Check runtime.json
    const runtimeFile = path.join(tempDir, 'runtime.json');
    assert.ok(fs.existsSync(runtimeFile), 'runtime.json should exist');
    const runtimeData = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
    assert.strictEqual(runtimeData.agentStatus, 42, 'agentStatus in runtime.json should be 42');
  } finally {
    removeTempDir(tempDir);
  }
});

test('run.mjs: removes each attempt\'s isolated HOME even when the agent is killed before cleanup', () => {
  const tempDir = createTempDir();
  try {
    const graderPath = path.join(tempDir, 'grader.ts');
    fs.writeFileSync(graderPath, '// mock grader');

    const agentScript = path.join(tempDir, 'mock-agent.js');
    fs.writeFileSync(agentScript, `
import fs from 'fs';
import path from 'path';
const targetDir = process.argv[4];
const homesFile = path.join(targetDir, 'homes.json');
const homes = fs.existsSync(homesFile) ? JSON.parse(fs.readFileSync(homesFile, 'utf8')) : [];
const home = process.env.GD_ISOLATED_HOME;
homes.push(home);
fs.writeFileSync(homesFile, JSON.stringify(homes));
fs.mkdirSync(path.join(home, 'base_app'), { recursive: true });
fs.writeFileSync(path.join(home, 'base_app', 'big.bin'), 'x');
if (homes.length === 1) process.kill(process.pid, 'SIGKILL');
`.trim(), 'utf8');

    generateTransientPackage(tempDir, agentScript, 'dummy prompt', 'guided', tempDir, 'test-task', 'test-guide', graderPath);
    patchRunnerDelay(tempDir);
    fs.writeFileSync(path.join(tempDir, 'grade.mjs'), 'process.exit(0);', 'utf8');

    const runResult = spawnSync(process.execPath, ['run.mjs'], { cwd: tempDir, encoding: 'utf8' });
    assert.strictEqual(runResult.status, 0, 'Execution should succeed on the second attempt');

    const homes: string[] = JSON.parse(fs.readFileSync(path.join(tempDir, 'homes.json'), 'utf8'));
    assert.strictEqual(homes.length, 2, 'Should have attempted twice');
    assert.notStrictEqual(homes[0], homes[1], 'Each attempt should get a fresh HOME');
    for (const home of homes) {
      assert.match(home, /^\/tmp\/ghh-mock-agent\.js-/);
      assert.strictEqual(fs.existsSync(home), false, `${home} should have been removed`);
    }
  } finally {
    removeTempDir(tempDir);
  }
});

test('run.mjs: records TIMEOUT (10m) and exits non-zero when final attempt times out', () => {
  const tempDir = createTempDir();
  try {
    const graderPath = path.join(tempDir, 'grader.ts');
    fs.writeFileSync(graderPath, '// mock grader');

    // Attempt 1 writes a stale generation_failed.json and exits 1; attempts 2 and 3 hang until timeout.
    const agentScript = path.join(tempDir, 'mock-agent.js');
    fs.writeFileSync(agentScript, `
import fs from 'fs';
import path from 'path';
const targetDir = process.argv[4];
const countFile = path.join(targetDir, 'count.txt');
const attempt = fs.existsSync(countFile) ? Number(fs.readFileSync(countFile, 'utf8')) + 1 : 1;
fs.writeFileSync(countFile, String(attempt));
if (attempt === 1) {
  fs.writeFileSync(path.join(targetDir, 'generation_failed.json'), JSON.stringify({ agentName: 'mock-agent.js', exitCode: 1, stderr: 'stale', stdout: '' }));
  process.exit(1);
}
setTimeout(() => {}, 10000);
`.trim(), 'utf8');

    generateTransientPackage(tempDir, agentScript, 'dummy prompt', 'guided', tempDir, 'test-task', 'test-guide', graderPath);
    patchRunnerDelay(tempDir);
    const runMjsPath = path.join(tempDir, 'run.mjs');
    fs.writeFileSync(runMjsPath, fs.readFileSync(runMjsPath, 'utf8').replace('timeout: 600000', 'timeout: 50'));

    const runResult = spawnSync(process.execPath, ['run.mjs'], { cwd: tempDir, encoding: 'utf8' });
    assert.strictEqual(runResult.status, 1, 'Timed-out run.mjs should exit with 1, not 0');

    const failureData = JSON.parse(fs.readFileSync(path.join(tempDir, 'generation_failed.json'), 'utf8'));
    assert.strictEqual(failureData.exitCode, 'TIMEOUT (10m)');
    assert.match(failureData.stderr, /timed out/i);
  } finally {
    removeTempDir(tempDir);
  }
});
