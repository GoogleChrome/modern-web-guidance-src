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

// Helper to patch the 20-second delay in the generated run.mjs to 1ms
function patchRunnerDelay(targetDir: string) {
  const runMjsPath = path.join(targetDir, 'run.mjs');
  let content = fs.readFileSync(runMjsPath, 'utf8');
  content = content.replace("setTimeout(()=>{}, 20000)", "setTimeout(()=>{}, 1)");
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
