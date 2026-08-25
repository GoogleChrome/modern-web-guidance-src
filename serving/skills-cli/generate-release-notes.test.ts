import test from 'node:test';
import assert from 'node:assert';
import { generateFallbackReleaseNotes, type EvalSummaryItem } from './generate-release-notes.ts';

test('generateFallbackReleaseNotes formats guide updates with correct guideName from dist path', () => {
  const changedFiles = [
    'skills/modern-web-guidance/guides/css/size-aware-styling.md',
    'skills/modern-web-guidance/guides/javascript/async-clipboard.md',
  ];
  const evalSummary: EvalSummaryItem[] = [];

  const notes = generateFallbackReleaseNotes('v0.1.0', '0.1.1', evalSummary, changedFiles);

  assert.ok(notes.includes('# Release Notes: `v0.1.1`'));
  assert.ok(notes.includes('### 📖 Guidance & Web Platform Updates'));
  assert.ok(notes.includes('* **size-aware-styling**: Updates and improvements to web platform guidance.'));
  assert.ok(notes.includes('* **async-clipboard**: Updates and improvements to web platform guidance.'));
  assert.ok(!notes.includes('**css**'));
  assert.ok(!notes.includes('**javascript**'));
});

test('generateFallbackReleaseNotes formats guide updates from source path (guide.md)', () => {
  const changedFiles = [
    'guides/css/size-aware-styling/guide.md',
  ];
  const evalSummary: EvalSummaryItem[] = [];

  const notes = generateFallbackReleaseNotes('v0.1.0', '0.1.1', evalSummary, changedFiles);

  assert.ok(notes.includes('* **size-aware-styling**: Updates and improvements to web platform guidance.'));
  assert.ok(!notes.includes('* **guide**:'));
});

test('generateFallbackReleaseNotes includes agent ecosystem and eval summary tables', () => {
  const changedFiles = [
    '.claude-plugin/plugin.json',
  ];
  const evalSummary: EvalSummaryItem[] = [
    {
      agent: 'antigravity',
      model: 'gemini-3.7-flash',
      taskCount: 130,
      assertionCount: 1112,
      unguidedPassRate: 64,
      guidedPassRate: 90,
    },
  ];

  const notes = generateFallbackReleaseNotes('v0.1.0', '0.1.1', evalSummary, changedFiles);

  assert.ok(notes.includes('### 🚀 Agent Ecosystem'));
  assert.ok(notes.includes('### 📊 Benchmark Evaluations'));
  assert.ok(notes.includes('| **antigravity** (gemini-3.7-flash) | 130 / 1112 | 64% → **90%** | **+26pp** |'));
});
