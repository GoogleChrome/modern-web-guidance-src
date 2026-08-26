import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSolutionPrompt,
  buildZeroPassratePrompt,
  buildTargetGraderPrompt,
  buildTargetTaskPrompt,
  buildDevReportPrompt,
} from './gd-dev-prompts.ts';
import { Agents } from '../harness/config.ts';

test('buildSolutionPrompt includes instructions and paths', () => {
  const prompt = buildSolutionPrompt({
    guideFile: 'guide.md',
    expectationsFile: 'expectations.md',
    workDir: '/tmp/test-sandbox',
  });
  assert.ok(prompt.includes('guide.md'));
  assert.ok(prompt.includes('expectations.md'));
  assert.ok(prompt.includes('/tmp/test-sandbox'));
  assert.ok(prompt.includes('perfectly implement the guidance'));
});

test('buildZeroPassratePrompt includes anti-pattern constraints', () => {
  const prompt = buildZeroPassratePrompt({
    guideFile: 'guide.md',
    expectationsFile: 'expectations.md',
    workDir: '/tmp/test-sandbox',
  });
  assert.ok(prompt.includes('No-Op by Default'));
  assert.ok(prompt.includes('Realistic Baseline'));
  assert.ok(prompt.includes('Inspect the clean codebase'));
});

test('buildTargetGraderPrompt includes Option B scoping rules', () => {
  const prompt = buildTargetGraderPrompt({
    guideFile: 'guide.md',
    expectationsFile: 'expectations.md',
    solutionPatchFiles: {
      [Agents.JETSKI_CLI]: 'patches/jetski-solution.patch',
      [Agents.CLAUDE_CODE]: 'patches/claude-solution.patch',
      [Agents.CODEX_CLI]: 'patches/codex-solution.patch',
    },
    zeroPassratePatchFile: 'patches/zero-passrate.patch',
    graderFile: 'grader.ts',
    baseApp: 'daily-grind',
    templateFile: 'template.grader.ts',
  });
  assert.ok(prompt.includes('getTargetFiles'));
  assert.ok(prompt.includes('Static Analysis First'));
  assert.ok(prompt.includes('daily-grind'));
  assert.ok(prompt.includes('Jetski CLI Solution'));
  assert.ok(prompt.includes('Claude Code Solution'));
  assert.ok(prompt.includes('Codex CLI Solution'));
});

test('buildTargetGraderPrompt formats failure context correctly when provided', () => {
  const prompt = buildTargetGraderPrompt({
    guideFile: 'guide.md',
    expectationsFile: 'expectations.md',
    solutionPatchFiles: {
      [Agents.JETSKI_CLI]: 'patches/jetski-solution.patch',
      [Agents.CLAUDE_CODE]: 'patches/claude-solution.patch',
      [Agents.CODEX_CLI]: 'patches/codex-solution.patch',
    },
    zeroPassratePatchFile: 'patches/zero-passrate.patch',
    graderFile: 'grader.ts',
    baseApp: 'devtools-times',
    templateFile: 'template.grader.ts',
    failureContext: 'Golden test failed on assertion getComputedStyle',
  });
  assert.ok(prompt.includes('PREVIOUS FAILURE CONTEXT'));
  assert.ok(prompt.includes('Golden test failed on assertion getComputedStyle'));
});

test('buildTargetTaskPrompt creates clean developer prompt instructions', () => {
  const prompt = buildTargetTaskPrompt({
    guideFile: 'guide.md',
    taskFile: 'task.md',
    baseApp: 'daily-grind',
  });
  assert.ok(prompt.includes('task.md'));
  assert.ok(prompt.includes('codebase files'));
  assert.ok(prompt.includes('Do NOT name the guide itself'));
  assert.ok(prompt.includes('Write the prompt as a developer talking'));
});

test('buildDevReportPrompt creates comprehensive diagnostic prompt with flags and inputs', () => {
  const prompt = buildDevReportPrompt({
    guideName: 'size-aware-styling',
    targets: [
      {
        baseApp: 'daily-grind',
        flag: 'LOW_GUIDED_PASS_RATE',
        flagDetails: 'Guided pass rate is 75% (below 90% threshold)',
        guidedPassRate: 75,
        unguidedPassRate: 50,
      },
    ],
  });

  assert.ok(prompt.includes('size-aware-styling'));
  assert.ok(prompt.includes('report.md'));
  assert.ok(prompt.includes('LOW_GUIDED_PASS_RATE'));
  assert.ok(prompt.includes('daily-grind'));
  assert.ok(prompt.includes('Evaluation Results'));
  assert.ok(prompt.includes('Diagnostic Analysis & Actionable Recommendations'));
  assert.ok(prompt.includes('ROOT-CAUSE DIAGNOSIS RULES'));
});
