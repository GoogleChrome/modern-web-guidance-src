import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildGuidedRetrievalHint, buildTaskRunPrompt, generateTransientPackage } from './run-suite.ts';

test('buildGuidedRetrievalHint and buildTaskRunPrompt append explicit retrieval hint only for guided runs', () => {
  const guideName = 'dialog-focus-management';
  const hint = buildGuidedRetrievalHint(guideName);

  assert.strictEqual(
    hint,
    '\n\nUse the `dialog-focus-management` guide for this task (`npx -y modern-web-guidance@latest retrieve dialog-focus-management`).'
  );

  const guidedPrompt = buildTaskRunPrompt('Build an accessible modal dialog', 'guided', guideName);
  assert.ok(guidedPrompt.includes(hint));
  assert.ok(guidedPrompt.includes("Don't bother doing any manual verification in a browser."));

  const unguidedPrompt = buildTaskRunPrompt('Build an accessible modal dialog', 'unguided', guideName);
  assert.ok(!unguidedPrompt.includes(hint));
  assert.ok(!unguidedPrompt.includes('modern-web-guidance'));
  assert.ok(unguidedPrompt.includes("Don't bother doing any manual verification in a browser."));
});

test('generateTransientPackage embeds promptContent and shims correctly', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-suite-test-'));
  const agentScript = '/tmp/fake-agent.ts';
  const rawPrompt = 'Build an accessible modal dialog';
  const guideName = 'dialog-focus-management';
  const taskName = 'modal-dialog';
  const baseAppDir = '/tmp/fake-base-app';
  const graderPath = path.join(tempDir, 'grader.ts');
  fs.writeFileSync(graderPath, 'export async function grade() { return true; }');

  try {
    // 1. Test guided package generation
    const guidedDir = path.join(tempDir, 'guided');
    const guidedHint = buildGuidedRetrievalHint(guideName);
    const guidedPrompt = buildTaskRunPrompt(rawPrompt, 'guided', guideName);
    generateTransientPackage(
      guidedDir,
      agentScript,
      guidedPrompt,
      'guided',
      baseAppDir,
      taskName,
      guideName,
      graderPath,
      'daily-grind'
    );

    assert.ok(fs.existsSync(path.join(guidedDir, 'grade.mjs')), 'grade.mjs should exist');
    assert.ok(fs.existsSync(path.join(guidedDir, 'run.mjs')), 'run.mjs should exist');
    assert.ok(fs.existsSync(path.join(guidedDir, 'npx')), 'npx wrapper should exist');
    assert.ok(fs.existsSync(path.join(guidedDir, 'pnpx')), 'pnpx wrapper should exist');
    assert.ok(fs.existsSync(path.join(guidedDir, 'pnpm')), 'pnpm wrapper should exist');

    const guidedRunnerContent = fs.readFileSync(path.join(guidedDir, 'run.mjs'), 'utf8');
    assert.ok(
      guidedRunnerContent.includes(JSON.stringify(guidedHint).slice(1, -1)),
      'run.mjs for guided must include the explicit retrieval hint'
    );
    assert.ok(guidedRunnerContent.includes('npx -y modern-web-guidance@latest retrieve dialog-focus-management'));
    assert.ok(guidedRunnerContent.includes('guided'));

    // Check wrapper content matches both modern-web-guidance@latest and modern-web-guidance
    const npxWrapperContent = fs.readFileSync(path.join(guidedDir, 'npx'), 'utf8');
    assert.ok(npxWrapperContent.includes("normalizedArgs[0] === 'modern-web-guidance@latest' || normalizedArgs[0] === 'modern-web-guidance'"));

    // 2. Test unguided package generation
    const unguidedDir = path.join(tempDir, 'unguided');
    const unguidedPrompt = buildTaskRunPrompt(rawPrompt, 'unguided', guideName);
    generateTransientPackage(
      unguidedDir,
      agentScript,
      unguidedPrompt,
      'unguided',
      baseAppDir,
      taskName,
      guideName,
      graderPath,
      'daily-grind'
    );

    const unguidedRunnerContent = fs.readFileSync(path.join(unguidedDir, 'run.mjs'), 'utf8');
    assert.ok(
      !unguidedRunnerContent.includes(JSON.stringify(guidedHint).slice(1, -1)),
      'run.mjs for unguided must NOT include the explicit retrieval hint'
    );
    assert.ok(unguidedRunnerContent.includes('unguided'));
    assert.ok(unguidedRunnerContent.includes(rawPrompt));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
