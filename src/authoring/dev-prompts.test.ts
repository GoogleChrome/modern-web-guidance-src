import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSolutionPrompt,
  buildZeroPassratePrompt,
  buildTargetGraderPrompt,
  buildTargetTaskPrompt,
  buildDevReportPrompt,
  buildApplyReviewFeedbackPrompt,
} from './dev-prompts.ts';
import { Agents } from '../harness/config.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('buildSolutionPrompt includes instructions and paths', () => {
  const prompt = buildSolutionPrompt({
    guideFile: 'guide.md',
    taskFile: 'task.md',
    workDir: '/tmp/test-sandbox',
  });
  assert.ok(prompt.includes('guide.md'));
  assert.ok(prompt.includes('task.md'));
  assert.ok(prompt.includes('/tmp/test-sandbox'));
  assert.ok(!prompt.includes('expectations.md'));
  assert.ok(prompt.includes('complete the developer task'));
  assert.ok(prompt.includes('Do NOT start dev servers, preview servers, or background processes'));
});

test('buildZeroPassratePrompt includes anti-pattern constraints and genuine expectation violation', () => {
  const prompt = buildZeroPassratePrompt({
    guideFile: 'guide.md',
    expectationsFile: 'expectations.md',
    workDir: '/tmp/test-sandbox',
  });
  assert.ok(prompt.includes('No-Op by Default'));
  assert.ok(prompt.includes('Realistic Baseline'));
  assert.ok(prompt.includes('Never Copy Guide Examples or Plant Anti-Patterns'));
  assert.ok(prompt.includes('Inspect the clean codebase'));
  assert.ok(prompt.includes('Do NOT start dev servers, preview servers, or background processes'));
});

test('buildTargetGraderPrompt includes Option B scoping rules and locked solution patches', () => {
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
    failureContext: 'Some test failed',
  });
  assert.ok(prompt.includes('getTargetFiles'));
  assert.ok(prompt.includes('getCssStyleSheet'));
  assert.ok(prompt.includes('CSSOMNom'));
  assert.ok(prompt.includes('Static Analysis First'));
  assert.ok(prompt.includes('daily-grind'));
  assert.ok(prompt.includes('Jetski CLI Solution'));
  assert.ok(prompt.includes('Claude Code Solution'));
  assert.ok(prompt.includes('Codex CLI Solution'));
  assert.ok(prompt.includes('Utility CSS Flexibility'));
  assert.ok(prompt.includes('LOCKED'));
  assert.ok(prompt.includes('No Patch-Specific Identifier Overfitting'));
  assert.ok(prompt.includes('No Vacuous Guards or `test.skip()`'));
  assert.ok(prompt.includes('npx oxlint'));
});

test('buildTargetGraderPrompt truncates failure context beyond 16 KB', () => {
  const giantError = 'X'.repeat(25_000);
  const prompt = buildTargetGraderPrompt({
    guideFile: 'guide.md',
    expectationsFile: 'expectations.md',
    solutionPatchFiles: {
      [Agents.JETSKI_CLI]: 'patches/jetski-solution.patch',
    },
    zeroPassratePatchFile: 'patches/zero-passrate.patch',
    graderFile: 'grader.ts',
    baseApp: 'daily-grind',
    templateFile: 'template.grader.ts',
    failureContext: giantError,
  });
  assert.ok(prompt.includes('...[truncated 9000 chars]'));
  assert.ok(!prompt.includes('X'.repeat(16_500)));
});

test('buildTargetGraderPrompt includes reviewer feedback block only when comments are provided', () => {
  const baseOpts = {
    guideFile: 'guide.md',
    expectationsFile: 'expectations.md',
    solutionPatchFiles: {
      [Agents.JETSKI_CLI]: 'patches/jetski-solution.patch',
    },
    zeroPassratePatchFile: 'patches/zero-passrate.patch',
    graderFile: 'grader.ts',
    baseApp: 'daily-grind',
    templateFile: 'template.grader.ts',
  };

  const withoutComments = buildTargetGraderPrompt(baseOpts);
  assert.ok(!withoutComments.includes('REVIEWER FEEDBACK'));

  const withComments = buildTargetGraderPrompt({
    ...baseOpts,
    prContext: {
      comments: '- **@micahjo7**: relax assertion on container',
    },
  });
  assert.ok(withComments.includes('REVIEWER FEEDBACK ON PREVIOUS GRADER & EVALUATIONS'));
  assert.ok(withComments.includes('relax assertion on container'));
  assert.ok(withComments.includes('If any reviewer comments above pertain to `grader.ts`'));
  assert.ok(withComments.includes('adhering to `expectations.md`'));
});

test('buildTargetTaskPrompt includes reviewer feedback block only when comments are provided', () => {
  const baseOpts = {
    guideDescription: 'Use View Transitions for smooth page transitions',
    taskFile: 'task.md',
    baseApp: 'daily-grind',
  };

  const withoutComments = buildTargetTaskPrompt(baseOpts);
  assert.ok(!withoutComments.includes('REVIEWER FEEDBACK'));

  const withComments = buildTargetTaskPrompt({
    ...baseOpts,
    prContext: {
      comments: '- **@micahjo7**: adjust phrasing to be more directive',
    },
  });
  assert.ok(withComments.includes('REVIEWER FEEDBACK ON PREVIOUS TASK PROMPT / IMPLEMENTATION'));
  assert.ok(withComments.includes('adjust phrasing to be more directive'));
  assert.ok(withComments.includes('Carefully address any reviewer suggestions regarding the developer prompt in `task.md`'));
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

test('buildTargetGraderPrompt includes discipline scoping only for discipline guides', () => {
  const baseOpts = {
    guideFile: 'guide.md',
    expectationsFile: 'expectations.md',
    solutionPatchFiles: {
      [Agents.JETSKI_CLI]: 'patches/jetski-solution.patch',
    },
    zeroPassratePatchFile: 'patches/zero-passrate.patch',
    graderFile: 'grader.ts',
    baseApp: 'devtools-times',
    templateFile: 'template.grader.ts',
  };

  const disciplinePrompt = buildTargetGraderPrompt({ ...baseOpts, isDisciplineGuide: true });
  assert.ok(disciplinePrompt.includes('discipline guide'));
  assert.ok(disciplinePrompt.includes('Decide relevance from the base application in your workspace'));
  assert.ok(disciplinePrompt.includes('Expectation N: SKIPPED: already satisfied by the base application'));

  const standardPrompt = buildTargetGraderPrompt(baseOpts);
  assert.ok(!standardPrompt.includes('discipline guide'));
});

test('buildTargetGraderPrompt includes expectation coverage and skip manifest rules for all guides', () => {
  const baseOpts = {
    guideFile: 'guide.md',
    expectationsFile: 'expectations.md',
    solutionPatchFiles: {
      [Agents.JETSKI_CLI]: 'patches/jetski-solution.patch',
    },
    zeroPassratePatchFile: 'patches/zero-passrate.patch',
    graderFile: 'grader.ts',
    baseApp: 'devtools-times',
    templateFile: 'template.grader.ts',
  };

  for (const prompt of [
    buildTargetGraderPrompt(baseOpts),
    buildTargetGraderPrompt({ ...baseOpts, failureContext: 'Golden test failed' }),
    buildTargetGraderPrompt({ ...baseOpts, isDisciplineGuide: true }),
  ]) {
    assert.ok(prompt.includes('Skip an expectation only when its precondition is absent from both the target application and the task'));
    assert.ok(prompt.includes('SKIPPED: <missing precondition>'));
    assert.ok(prompt.includes('Do not omit, merge, or skip any applicable expectation'));
  }
});

test('buildSolutionPrompt and buildZeroPassratePrompt include discipline scoping only for discipline guides', () => {
  const baseSolutionOpts = {
    guideFile: 'guide.md',
    taskFile: 'task.md',
    workDir: '/tmp/test-sandbox',
  };

  const disciplineSolutionPrompt = buildSolutionPrompt({ ...baseSolutionOpts, isDisciplineGuide: true });
  assert.ok(disciplineSolutionPrompt.includes('discipline guide'));
  assert.ok(disciplineSolutionPrompt.includes('you do NOT need to implement every pattern'));
  assert.ok(!buildSolutionPrompt(baseSolutionOpts).includes('discipline guide'));

  const baseZeroOpts = {
    guideFile: 'guide.md',
    expectationsFile: 'expectations.md',
    workDir: '/tmp/test-sandbox',
  };

  const disciplineZeroPassratePrompt = buildZeroPassratePrompt({ ...baseZeroOpts, isDisciplineGuide: true });
  assert.ok(disciplineZeroPassratePrompt.includes('discipline guide'));
  assert.ok(disciplineZeroPassratePrompt.includes('you do NOT need to fail every expectation'));
  assert.ok(!buildZeroPassratePrompt(baseZeroOpts).includes('discipline guide'));
});

test('buildTargetTaskPrompt creates clean developer prompt instructions without leaking guide or expectations', () => {
  const baseOpts = {
    guideDescription: 'Apply fluid typography using modern CSS clamp() units across article cards',
    taskFile: 'task.md',
    baseApp: 'daily-grind',
  };
  const prompt = buildTargetTaskPrompt(baseOpts);
  assert.ok(prompt.includes('task.md'));
  assert.ok(prompt.includes('daily-grind'));
  assert.ok(prompt.includes('Grounded in the Application'));
  assert.ok(prompt.includes('Never Copy Description Verbatim'));
  assert.ok(prompt.includes('Preserve High-Level Capability Boundary'));
  assert.ok(prompt.includes('Apply fluid typography using modern CSS clamp() units across article cards'));
  assert.ok(!prompt.includes('guide.md'));
  assert.ok(!prompt.includes('expectations.md'));

  const disciplinePrompt = buildTargetTaskPrompt({ ...baseOpts, isDisciplineGuide: true });
  assert.ok(disciplinePrompt.includes('understand the discipline guidance'));
  assert.ok(!disciplinePrompt.includes('understand the use case'));
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
  assert.ok(prompt.includes('## Summary'));
  assert.ok(prompt.includes('Top-Level Summary'));
  assert.ok(prompt.includes('LOW_GUIDED_PASS_RATE'));
  assert.ok(prompt.includes('HIGH_UNGUIDED_PASS_RATE'));
  assert.ok(prompt.includes('CALIBRATION_FAILED'));
  assert.ok(prompt.includes('Treat `guide.md` as Authoritative over `expectations.md`'));
  assert.ok(prompt.includes('presume `targets/<target>/grader.ts` or `targets/<target>/task.md` is at fault'));
  assert.ok(prompt.includes('daily-grind'));
  assert.ok(prompt.includes('Evaluation Results'));
  assert.ok(prompt.includes('Diagnostic Analysis & Actionable Recommendations'));
  assert.ok(prompt.includes('ROOT-CAUSE DIAGNOSIS RULES'));
  assert.ok(prompt.includes('add the needs-dev-rerun label'));
  assert.ok(prompt.includes('```diff'));
  assert.ok(prompt.includes('DIRECT FILE UPDATES REQUIREMENT'));
});

test('buildDevReportPrompt includes PR context and reviewer feedback instructions when provided', () => {
  const prompt = buildDevReportPrompt({
    guideName: 'dialog',
    targets: [
      {
        baseApp: 'daily-grind',
        flag: 'LOW_GUIDED_PASS_RATE',
        flagDetails: 'Guided pass rate is 50%',
        guidedPassRate: 50,
        unguidedPassRate: 20,
      },
    ],
    prContext: {
      branchCommits: '2657f38 Rename modal-dialog stub to dialog\n2f85978 Add modal-dialog use case stub',
      branchDiff: '+# Dialog\n+Some notes...',
      comments: '- **@LeaVerou** commented:\nOther guides that might be relevant: drag, animate-to-from-top-layer',
    },
  });

  assert.ok(prompt.includes('EXISTING PULL REQUEST & REVIEW CONTEXT'));
  assert.ok(prompt.includes('Branch Commits against main'));
  assert.ok(prompt.includes('2657f38 Rename modal-dialog stub to dialog'));
  assert.ok(prompt.includes('Branch Diff against main'));
  assert.ok(prompt.includes('PR Comments & Reviewer Feedback'));
  assert.ok(prompt.includes('LeaVerou'));
  assert.ok(prompt.includes('Honor reviewer feedback'));
  assert.ok(prompt.includes('without blindly overwriting human-authored changes'));
});

test('buildApplyReviewFeedbackPrompt explains needs-dev-rerun regeneration', () => {
  const prompt = buildApplyReviewFeedbackPrompt({
    guideName: 'dialog',
    comments: 'Please tighten the task',
    rerunMode: 'needs-dev-rerun',
  });
  assert.ok(prompt.includes('`needs-dev-rerun` mode'));
  assert.ok(prompt.includes('the solution patches and `grader.ts` are regenerated from the new task'));
  assert.ok(!prompt.includes('will be wiped'));
});

import { rootDir } from '../core/paths.ts';

test('all reference files and type definitions referenced in grader generation exist on disk', () => {
  const requiredSandboxFiles = [
    path.resolve(rootDir, 'src/grading/template.grader.ts'),
    path.resolve(rootDir, 'src/grading/test-fixture.ts'),
    path.resolve(rootDir, 'src/grading/parser-pattern-library.test.ts'),
    path.resolve(rootDir, 'src/grading/playwright-pattern-library.grader.ts'),
    path.resolve(rootDir, 'node_modules', 'ts-morph', 'lib', 'ts-morph.d.ts'),
    path.resolve(rootDir, 'node_modules', 'linkedom', 'types', 'index.d.ts'),
    path.resolve(rootDir, 'node_modules', 'cssomnom', 'dist', 'CSSOM.d.ts'),
  ];

  for (const filePath of requiredSandboxFiles) {
    assert.ok(
      fs.existsSync(filePath),
      `Required grader reference file must exist on disk: ${filePath}`
    );
  }
});
