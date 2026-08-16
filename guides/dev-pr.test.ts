import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { determinePrLabels } from './lib/dev-pr.ts';

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
