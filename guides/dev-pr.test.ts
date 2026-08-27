import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  determinePrLabels,
  computeLabelDiff,
  runDevPr,
  devPrCli,
  type DevPrLabel,
} from './lib/dev-pr.ts';

describe('determinePrLabels', () => {
  it('detects gd-dev-content when guide.md is recommended', () => {
    const report = `# Evaluation Report: size-aware-styling

## Target: \`daily-grind\` (Status: \`LOW_GUIDED_PASS_RATE\`)

### Evaluation Results
Summary data...

### Diagnostic Analysis & Actionable Recommendations

#### Root Cause Analysis:
- **Issue Flagged**: \`LOW_GUIDED_PASS_RATE\` (Guided pass rate is 50%)
The guide lacks Safari fallback examples.

#### Actionable Recommendations:
- \`guide.md\`: Add fallback syntax example for Safari.
*(Note: After modifying source files, delete the targets/ directory and run gd dev to regenerate all target artifacts)*
`;

    const labels = determinePrLabels(report);
    assert.deepEqual(labels, ['gd-dev-content']);
  });

  it('detects gd-dev-content when expectations.md is recommended with path prefix', () => {
    const report = `# Evaluation Report: size-aware-styling

## Target: \`daily-grind\` (Status: \`LOW_GUIDED_PASS_RATE\`)

### Diagnostic Analysis & Actionable Recommendations

#### Actionable Recommendations:
- \`guides/css/size-aware-styling/expectations.md\`: Relax computed style check.
`;

    const labels = determinePrLabels(report);
    assert.deepEqual(labels, ['gd-dev-content']);
  });

  it('detects gd-dev-eval when grader.ts or task.md is recommended', () => {
    const report = `# Evaluation Report: size-aware-styling

## Target: \`devtools-times\` (Status: \`LOW_GUIDED_PASS_RATE\`)

### Diagnostic Analysis & Actionable Recommendations

#### Actionable Recommendations:
- \`targets/devtools-times/grader.ts\`: Update selector logic for container queries.
- \`targets/devtools-times/task.md\`: Clarify prompt keywords.
`;

    const labels = determinePrLabels(report);
    assert.deepEqual(labels, ['gd-dev-eval']);
  });

  it('detects both gd-dev-content and gd-dev-eval across different targets', () => {
    const report = `# Evaluation Report: size-aware-styling

## Target: \`daily-grind\` (Status: \`LOW_GUIDED_PASS_RATE\`)

### Diagnostic Analysis & Actionable Recommendations

#### Actionable Recommendations:
- \`guide.md\`: Update fallback guidance.

---

## Target: \`devtools-times\` (Status: \`MISSING_GUIDANCE_TOOL\`)

### Diagnostic Analysis & Actionable Recommendations

#### Actionable Recommendations:
- \`targets/devtools-times/task.md\`: Rephrase task prompt to trigger guidance.
`;

    const labels = determinePrLabels(report);
    assert.ok(labels.includes('gd-dev-content'));
    assert.ok(labels.includes('gd-dev-eval'));
    assert.equal(labels.length, 2);
  });

  it('returns empty array when all targets are healthy', () => {
    const report = `# Evaluation Report: size-aware-styling

## Target: \`daily-grind\` (Status: \`HEALTHY\`)

### Diagnostic Analysis & Actionable Recommendations

#### Root Cause Analysis:
- **Issue Flagged**: \`HEALTHY\` (100% pass rate)
Target is healthy.

#### Actionable Recommendations:
- None (target is healthy and verified).

---

## Target: \`devtools-times\` (Status: \`HEALTHY\`)

### Diagnostic Analysis & Actionable Recommendations

#### Actionable Recommendations:
- None (target is healthy and verified).
`;

    const labels = determinePrLabels(report);
    assert.deepEqual(labels, []);
  });

  it('handles clean backticks and plain file bullet formats', () => {
    const report = `# Evaluation Report: test

## Target: \`app-1\` (Status: \`LOW_GUIDED_PASS_RATE\`)

### Diagnostic Analysis & Actionable Recommendations

#### Actionable Recommendations:
- \`guide.md\`: Update guide
- targets/app-1/grader.ts: Update grader
`;

    const labels = determinePrLabels(report);
    assert.ok(labels.includes('gd-dev-content'));
    assert.ok(labels.includes('gd-dev-eval'));
  });
});

describe('computeLabelDiff', () => {
  it('computes labels to add and remove correctly', () => {
    // 1. Initial creation (no labels on PR yet)
    const diff1 = computeLabelDiff(['gd-dev-content'], []);
    assert.deepEqual(diff1.addLabels, ['gd-dev-content']);
    assert.deepEqual(diff1.removeLabels, []);

    // 2. Guide fixed, eval issue found (content removed, eval added, custom PR label preserved)
    const diff2 = computeLabelDiff(['gd-dev-eval'], [{ name: 'gd-dev-content' }, { name: 'category:css' }]);
    assert.deepEqual(diff2.addLabels, ['gd-dev-eval']);
    assert.deepEqual(diff2.removeLabels, ['gd-dev-content']);

    // 3. All issues resolved (all gd-dev labels removed)
    const diff3 = computeLabelDiff([], [{ name: 'gd-dev-content' }, { name: 'gd-dev-eval' }, { name: 'enhancement' }]);
    assert.deepEqual(diff3.addLabels, []);
    assert.deepEqual(diff3.removeLabels, ['gd-dev-content', 'gd-dev-eval']);
  });
});

describe('runDevPr', () => {
  let originalDevPrCli: typeof devPrCli;

  beforeEach(() => {
    originalDevPrCli = { ...devPrCli };
    devPrCli.getCurrentBranch = () => 'feat/test-branch';
    devPrCli.commitChanges = () => {};
    devPrCli.pushBranch = () => {};
  });

  afterEach(() => {
    Object.assign(devPrCli, originalDevPrCli);
  });

  it('creates a new draft PR when no PR exists for branch', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-pr-test-'));
    const resultsDir = path.join(tempDir, 'test-app-results');
    fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(
      path.join(resultsDir, 'report.md'),
      '# Report\n## Target: `test-app`\n#### Actionable Recommendations:\n- `guide.md`: Fix guide\n'
    );

    let prCreated = false;
    let prTitleArg = '';
    let prLabelsArg: DevPrLabel[] = [];

    devPrCli.viewPr = () => null;
    devPrCli.createPr = (title, _bodyPath, labels) => {
      prCreated = true;
      prTitleArg = title;
      prLabelsArg = labels;
      return 'https://github.com/GoogleChrome/modern-web-guidance-src/pull/101';
    };

    try {
      const success = await runDevPr(tempDir);
      assert.equal(success, true);
      assert.equal(prCreated, true);
      assert.equal(prTitleArg, `gd dev output for ${path.basename(tempDir)}`);
      assert.deepEqual(prLabelsArg, ['gd-dev-content']);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('updates an existing PR description and labels when a PR already exists', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-pr-test-'));
    const resultsDir = path.join(tempDir, 'test-app-results');
    fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(
      path.join(resultsDir, 'report.md'),
      '# Report\n## Target: `test-app`\n#### Actionable Recommendations:\n- `targets/app/grader.ts`: Fix grader\n'
    );

    let prUpdated = false;
    let updatedPrNumber = 0;
    let addedLabels: DevPrLabel[] = [];
    let removedLabels: DevPrLabel[] = [];

    devPrCli.viewPr = () => ({
      number: 42,
      url: 'https://github.com/GoogleChrome/modern-web-guidance-src/pull/42',
      state: 'OPEN',
      labels: [{ name: 'gd-dev-content' }, { name: 'category:css' }],
    });

    devPrCli.editPr = (prNumber, _bodyPath, addLabels, removeLabels) => {
      prUpdated = true;
      updatedPrNumber = prNumber;
      addedLabels = addLabels;
      removedLabels = removeLabels;
    };

    try {
      const success = await runDevPr(tempDir);
      assert.equal(success, true);
      assert.equal(prUpdated, true);
      assert.equal(updatedPrNumber, 42);
      assert.deepEqual(addedLabels, ['gd-dev-eval']);
      assert.deepEqual(removedLabels, ['gd-dev-content']);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('refuses to update when existing PR is closed or merged', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-pr-test-'));
    const resultsDir = path.join(tempDir, 'test-app-results');
    fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(
      path.join(resultsDir, 'report.md'),
      '# Report\n## Target: `test-app`\n#### Actionable Recommendations:\n- None\n'
    );

    let called = false;

    devPrCli.viewPr = () => ({
      number: 42,
      url: 'https://github.com/GoogleChrome/modern-web-guidance-src/pull/42',
      state: 'MERGED',
      labels: [],
    });
    devPrCli.editPr = () => { called = true; };

    try {
      const success = await runDevPr(tempDir);
      assert.equal(success, false);
      assert.equal(called, false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('automatically creates a new branch if currently on main', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-pr-test-'));
    const resultsDir = path.join(tempDir, 'test-app-results');
    fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(
      path.join(resultsDir, 'report.md'),
      '# Report\n## Target: `test-app`\n#### Actionable Recommendations:\n- `guide.md`: Fix guide\n'
    );

    let createdBranch = '';
    let current = 'main';

    devPrCli.getCurrentBranch = () => current;
    devPrCli.createAndCheckoutBranch = (branchName: string) => {
      createdBranch = branchName;
      current = branchName;
    };
    devPrCli.viewPr = () => null;
    devPrCli.createPr = () => 'https://github.com/GoogleChrome/modern-web-guidance-src/pull/105';

    try {
      const success = await runDevPr(tempDir);
      assert.equal(success, true);
      assert.equal(createdBranch, `gd-dev/${path.basename(tempDir)}`);
      assert.equal(current, `gd-dev/${path.basename(tempDir)}`);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns false when no evaluation report is found', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-pr-test-'));
    try {
      const success = await runDevPr(tempDir);
      assert.equal(success, false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns false when gh pr create throws an error', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-pr-test-'));
    const resultsDir = path.join(tempDir, 'test-app-results');
    fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(
      path.join(resultsDir, 'report.md'),
      '# Report\n## Target: `test-app`\n#### Actionable Recommendations:\n- None\n'
    );

    devPrCli.viewPr = () => null;
    devPrCli.createPr = () => {
      throw new Error('GraphQL authentication error');
    };

    try {
      const success = await runDevPr(tempDir);
      assert.equal(success, false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns false when gh pr edit throws an error', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-pr-test-'));
    const resultsDir = path.join(tempDir, 'test-app-results');
    fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(
      path.join(resultsDir, 'report.md'),
      '# Report\n## Target: `test-app`\n#### Actionable Recommendations:\n- None\n'
    );

    devPrCli.viewPr = () => ({
      number: 42,
      url: 'https://github.com/GoogleChrome/modern-web-guidance-src/pull/42',
      state: 'OPEN',
      labels: [],
    });
    devPrCli.editPr = () => {
      throw new Error('gh pr edit network timeout');
    };

    try {
      const success = await runDevPr(tempDir);
      assert.equal(success, false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

