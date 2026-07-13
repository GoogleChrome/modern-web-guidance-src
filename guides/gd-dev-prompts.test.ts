import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSolutionPrompt,
  buildBrokenPrompt,
  buildTargetGraderPrompt,
  buildTargetTaskPrompt,
} from './gd-dev-prompts.ts';

test('buildSolutionPrompt includes instructions and paths', () => {
  const prompt = buildSolutionPrompt({
    guideFile: 'guide.md',
    expectationsFile: 'expectations.md',
    workDir: '/tmp/test-sandbox',
  });
  assert.ok(prompt.includes('guide.md'));
  assert.ok(prompt.includes('expectations.md'));
  assert.ok(prompt.includes('/tmp/test-sandbox'));
  assert.ok(prompt.includes('perfectly implements the guidance'));
});

test('buildBrokenPrompt includes anti-pattern constraints', () => {
  const prompt = buildBrokenPrompt({
    guideFile: 'guide.md',
    expectationsFile: 'expectations.md',
    workDir: '/tmp/test-sandbox',
  });
  assert.ok(prompt.includes('must-fail criteria'));
  assert.ok(prompt.includes('subtle, realistic violations'));
  assert.ok(prompt.includes('Do NOT use obvious placeholders'));
});

test('buildTargetGraderPrompt includes Option B scoping rules', () => {
  const prompt = buildTargetGraderPrompt({
    guideFile: 'guide.md',
    expectationsFile: 'expectations.md',
    solutionPatchFile: 'solution.patch',
    brokenPatchFile: 'broken.patch',
    graderFile: 'grader.ts',
    baseApp: 'daily-grind',
  });
  assert.ok(prompt.includes('extractTargetFilesFromPatch'));
  assert.ok(prompt.includes('process.env.PATCH_FILE'));
  assert.ok(prompt.includes('appRoot'));
  assert.ok(prompt.includes('window.getComputedStyle(el)'));
  assert.ok(prompt.includes('daily-grind'));
});

test('buildTargetGraderPrompt formats failure context correctly when provided', () => {
  const prompt = buildTargetGraderPrompt({
    guideFile: 'guide.md',
    expectationsFile: 'expectations.md',
    solutionPatchFile: 'solution.patch',
    brokenPatchFile: 'broken.patch',
    graderFile: 'grader.ts',
    baseApp: 'devtools-times',
    failureContext: 'Golden test failed on assertion getComputedStyle',
  });
  assert.ok(prompt.includes('PREVIOUS FAILURE CONTEXT:'));
  assert.ok(prompt.includes('Golden test failed on assertion getComputedStyle'));
});

test('buildTargetTaskPrompt creates clean developer prompt instructions', () => {
  const prompt = buildTargetTaskPrompt({
    guideFile: 'guide.md',
    taskFile: 'task.md',
    baseApp: 'daily-grind',
  });
  assert.ok(prompt.includes('task.md'));
  assert.ok(prompt.includes('base-app.html'));
  assert.ok(prompt.includes('Do NOT mention the guide itself'));
  assert.ok(prompt.includes('Do NOT name the base app'));
});
