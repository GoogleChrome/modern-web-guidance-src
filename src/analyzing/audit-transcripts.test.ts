import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  auditTranscript,
  auditTranscriptDir,
  auditTranscriptFile,
  checkSplitViolations,
  detectProcessSignals,
  extractGradingRepos,
  filterStepsSince,
  formatAuditReport,
  formatBatchReport,
  isGradingRepoMatch,
  isLabelsViolation,
  loadRepos,
  parseTranscriptJsonl,
  type RepoEntry,
  summarizeModelTiers,
  summarizeToolFriction,
  type ToolCall,
  type TranscriptStep,
} from './audit-transcripts.ts';

const MOCK_REPOS: RepoEntry[] = [
  {
    repo: '2048',
    split: 'rule-writing',
    localPath: null,
  },
  {
    repo: 'asciiflow',
    split: 'rule-writing',
    localPath: null,
  },
  {
    repo: 'lighthouse-2020',
    split: 'grading-only',
    subpaths: ['clients', 'lighthouse-cli'],
    localPath: null,
  },
  {
    repo: 'timeline-viewer',
    split: 'grading-only',
    subpaths: [],
    localPath: null,
  },
  {
    repo: 'trajectoryview',
    split: 'grading-only',
    subpaths: [],
    localPath: '~/.cache/analyzer-repos/trajectoryview-pinned',
  },
  {
    repo: 'tastejs-todomvc',
    split: 'tune',
    localPath: null,
  },
  {
    repo: 'final-eval-repo',
    split: 'final',
    localPath: null,
  },
];

describe('parseTranscriptJsonl', () => {
  it('parses valid jsonl steps and filters empty lines', () => {
    const raw = `
      {"step_index":0,"source":"SYSTEM","type":"SYSTEM_MESSAGE"}

      {"step_index":1,"source":"MODEL","type":"PLANNER_RESPONSE","tool_calls":[{"name":"read_file","args":{"Path":"foo.ts"}}]}
    `.trim();

    const steps = parseTranscriptJsonl(raw);
    assert.strictEqual(steps.length, 2);
    assert.strictEqual(steps[0]?.step_index, 0);
    assert.strictEqual(steps[1]?.step_index, 1);
    assert.strictEqual(steps[1]?.tool_calls?.[0]?.name, 'read_file');
  });

  it('throws descriptive error on malformed JSON', () => {
    const raw = '{"step_index": 0}\n{not-json}';
    assert.throws(() => parseTranscriptJsonl(raw), /Failed to parse transcript line 2/);
  });
});

describe('isLabelsViolation', () => {
  it('identifies references to analyzer-internal labels directory', () => {
    assert.strictEqual(
      isLabelsViolation('/path/to/guidance/analyzer-internal/labels/grades.paulirish.jsonl'),
      true,
    );
    assert.strictEqual(
      isLabelsViolation('cat analyzer-internal/labels/cards/sample.json'),
      true,
    );
    assert.strictEqual(
      isLabelsViolation('labels/grades.paulirish.jsonl'),
      true,
    );
  });

  it('allows references outside the labels directory', () => {
    assert.strictEqual(isLabelsViolation('analyzer-internal/repos.json'), false);
    assert.strictEqual(isLabelsViolation('analyzer-internal/PLAN.md'), false);
    assert.strictEqual(isLabelsViolation('analyzer-internal/findings/research.md'), false);
    assert.strictEqual(isLabelsViolation('src/analyzing/stats.ts'), false);
  });
});

describe('isGradingRepoMatch', () => {
  const gradingRepos = extractGradingRepos(MOCK_REPOS);

  it('matches paths containing grading-only repo names', () => {
    const res1 = isGradingRepoMatch(
      '/home/user/.cache/analyzer-repos/lighthouse-2020/package.json',
      gradingRepos,
    );
    assert.strictEqual(res1.matched, true);
    assert.strictEqual(res1.repoName, 'lighthouse-2020');

    const res2 = isGradingRepoMatch(
      'cat ~/.cache/analyzer-repos/timeline-viewer/index.html',
      gradingRepos,
    );
    assert.strictEqual(res2.matched, true);
    assert.strictEqual(res2.repoName, 'timeline-viewer');
  });

  it('matches explicit localPath', () => {
    const res = isGradingRepoMatch(
      'cat ~/.cache/analyzer-repos/trajectoryview-pinned/index.ts',
      gradingRepos,
    );
    assert.strictEqual(res.matched, true);
    assert.strictEqual(res.repoName, 'trajectoryview');
  });

  it('does not match rule-writing repos', () => {
    const res1 = isGradingRepoMatch(
      '/home/user/.cache/analyzer-repos/2048/index.html',
      gradingRepos,
    );
    assert.strictEqual(res1.matched, false);

    const res2 = isGradingRepoMatch(
      'grep -rn "canvas" ~/.cache/analyzer-repos/asciiflow',
      gradingRepos,
    );
    assert.strictEqual(res2.matched, false);
  });

  it('allows reading repos.json without false positive', () => {
    const res1 = isGradingRepoMatch('repos.json', gradingRepos);
    assert.strictEqual(res1.matched, false);

    const res2 = isGradingRepoMatch(
      '/home/user/code/guidance/analyzer-internal/repos.json',
      gradingRepos,
    );
    assert.strictEqual(res2.matched, false);
  });

  it('matches tune and final split repos and gitmirror paths', () => {
    const resTune = isGradingRepoMatch(
      '/home/user/.cache/analyzer-repos/tastejs-todomvc/index.html',
      gradingRepos,
    );
    assert.strictEqual(resTune.matched, true);
    assert.strictEqual(resTune.repoName, 'tastejs-todomvc');

    const resFinal = isGradingRepoMatch(
      '/home/user/.cache/analyzer-repos/final-eval-repo/app.js',
      gradingRepos,
    );
    assert.strictEqual(resFinal.matched, true);
    assert.strictEqual(resFinal.repoName, 'final-eval-repo');

    const resGmGrading = isGradingRepoMatch(
      'cat ~/.cache/analyzer-gitmirror/grading-only/some-repo/index.ts',
      gradingRepos,
    );
    assert.strictEqual(resGmGrading.matched, true);
    assert.strictEqual(resGmGrading.repoName, 'analyzer-gitmirror');

    const resGmTune = isGradingRepoMatch(
      'cat ~/.cache/analyzer-gitmirror/tune/some-repo/index.ts',
      gradingRepos,
    );
    assert.strictEqual(resGmTune.matched, true);
    assert.strictEqual(resGmTune.repoName, 'analyzer-gitmirror');

    const resGmFinal = isGradingRepoMatch(
      'cat ~/.cache/analyzer-gitmirror/final/some-repo/index.ts',
      gradingRepos,
    );
    assert.strictEqual(resGmFinal.matched, true);
    assert.strictEqual(resGmFinal.repoName, 'analyzer-gitmirror');
  });
});

describe('checkSplitViolations', () => {
  const gradingRepos = extractGradingRepos(MOCK_REPOS);

  it('reports zero violations for clean rule-writing transcript', () => {
    const steps: TranscriptStep[] = [
      {
        step_index: 0,
        type: 'PLANNER_RESPONSE',
        tool_calls: [
          {
            name: 'read_file',
            args: { Path: '/home/user/.cache/analyzer-repos/2048/index.html' },
          },
        ],
      },
      {
        step_index: 1,
        type: 'PLANNER_RESPONSE',
        tool_calls: [
          {
            name: 'run_command',
            args: { CommandLine: 'grep -rn "dialog" ~/.cache/analyzer-repos/asciiflow' },
          },
        ],
      },
    ];

    const violations = checkSplitViolations(steps, gradingRepos);
    assert.strictEqual(violations.length, 0);
  });

  it('detects grading repo access in read_file and run_command', () => {
    const steps: TranscriptStep[] = [
      {
        step_index: 2,
        type: 'PLANNER_RESPONSE',
        tool_calls: [
          {
            name: 'read_file',
            args: { Path: '/home/user/.cache/analyzer-repos/lighthouse-2020/client.js' },
          },
        ],
      },
      {
        step_index: 4,
        type: 'PLANNER_RESPONSE',
        tool_calls: [
          {
            name: 'run_command',
            args: { CommandLine: 'cat ~/.cache/analyzer-repos/trajectoryview-pinned/index.ts' },
          },
        ],
      },
    ];

    const violations = checkSplitViolations(steps, gradingRepos);
    assert.strictEqual(violations.length, 2);
    assert.strictEqual(violations[0]?.matchedRepo, 'lighthouse-2020');
    assert.strictEqual(violations[0]?.reason, 'grading-only-repo');
    assert.strictEqual(violations[1]?.matchedRepo, 'trajectoryview');
    assert.strictEqual(violations[1]?.reason, 'grading-only-repo');
  });

  it('detects labels directory access', () => {
    const steps: TranscriptStep[] = [
      {
        step_index: 3,
        type: 'PLANNER_RESPONSE',
        tool_calls: [
          {
            name: 'read_file',
            args: { Path: 'analyzer-internal/labels/grades.paulirish.jsonl' },
          },
        ],
      },
    ];

    const violations = checkSplitViolations(steps, gradingRepos);
    assert.strictEqual(violations.length, 1);
    assert.strictEqual(violations[0]?.reason, 'labels-directory');
  });

  it('exempts tool calls on test files inside src/analyzing/ from mock repo split violations', () => {
    const steps: TranscriptStep[] = [
      {
        step_index: 10,
        type: 'PLANNER_RESPONSE',
        tool_calls: [
          {
            name: 'write_file',
            args: {
              Path: '/usr/local/google/home/paulirish/code/guidance/.worktrees/analyzer/src/analyzing/audit-transcripts.test.ts',
              Content: "const repo = 'lighthouse-2020';",
            },
          },
          {
            name: 'read_file',
            args: {
              Path: 'src/analyzing/stats.test.ts',
            },
          },
          {
            name: 'edit_file',
            args: {
              Path: '/workspace/src/analyzing/judge.test.ts',
              Target: 'foo',
              Replacement: "'timeline-viewer'",
            },
          },
        ],
      },
    ];

    const violations = checkSplitViolations(steps, gradingRepos);
    assert.strictEqual(violations.length, 0);
  });
});

describe('summarizeToolFriction', () => {
  it('computes commands run, tool calls, errors, and retries correctly', () => {
    const steps: TranscriptStep[] = [
      // Step 0: command that succeeds
      {
        step_index: 0,
        type: 'PLANNER_RESPONSE',
        tool_calls: [
          { name: 'run_command', args: { CommandLine: 'git status' } },
        ],
      },
      {
        step_index: 1,
        type: 'GENERIC',
        status: 'DONE',
        content: 'On branch main\nnothing to commit',
      },
      // Step 2: command that fails with code 1
      {
        step_index: 2,
        type: 'PLANNER_RESPONSE',
        tool_calls: [
          { name: 'run_command', args: { CommandLine: 'tsc --noEmit' } },
        ],
      },
      {
        step_index: 3,
        type: 'GENERIC',
        status: 'DONE',
        content: 'Command exited with code 1.\nError: bad syntax',
      },
      // Step 4: retry after error
      {
        step_index: 4,
        type: 'PLANNER_RESPONSE',
        tool_calls: [
          { name: 'run_command', args: { CommandLine: 'tsc --noEmit --skipLibCheck' } },
        ],
      },
      {
        step_index: 5,
        type: 'GENERIC',
        status: 'DONE',
        content: 'Command exited with code 0.',
      },
      // Step 6: read_file
      {
        step_index: 6,
        type: 'PLANNER_RESPONSE',
        tool_calls: [
          { name: 'read_file', args: { Path: 'src/index.ts' } },
        ],
      },
      {
        step_index: 7,
        type: 'GENERIC',
        status: 'DONE',
        content: 'export const hello = "world";',
      },
      // Step 8: duplicate call to read_file (retry / redundant action)
      {
        step_index: 8,
        type: 'PLANNER_RESPONSE',
        tool_calls: [
          { name: 'read_file', args: { Path: 'src/index.ts' } },
        ],
      },
      {
        step_index: 9,
        type: 'GENERIC',
        status: 'DONE',
        content: 'export const hello = "world";',
      },
    ];

    const friction = summarizeToolFriction(steps);

    assert.strictEqual(friction.totalToolCalls, 5);
    assert.strictEqual(friction.commandsRun, 3);
    assert.strictEqual(friction.toolErrors, 1);
    // 1 retry after error (step 4) + 1 duplicate retry (step 8) = 2 retries
    assert.strictEqual(friction.retries, 2);
    assert.strictEqual(friction.toolCounts['run_command'], 3);
    assert.strictEqual(friction.toolCounts['read_file'], 2);
    assert.strictEqual(friction.errorToolCounts['run_command'], 1);
  });
});

describe('summarizeModelTiers', () => {
  it('tracks subagent invocations and extracts model tiers', () => {
    const steps: TranscriptStep[] = [
      {
        step_index: 0,
        type: 'PLANNER_RESPONSE',
        tool_calls: [
          {
            name: 'invoke_subagent',
            args: { Role: 'Researcher', Model: 'flash', Prompt: 'Do research' },
          },
        ],
      },
      {
        step_index: 1,
        type: 'PLANNER_RESPONSE',
        tool_calls: [
          {
            name: 'invoke_subagent',
            args: { Role: 'Judge', Model: 'pro', Prompt: 'Evaluate' },
          },
        ],
      },
      {
        step_index: 2,
        type: 'PLANNER_RESPONSE',
        tool_calls: [
          {
            name: 'invoke_subagent',
            args: { Role: 'Worker', Prompt: 'Inherit default' },
          },
        ],
      },
    ];

    const summary = summarizeModelTiers(steps);
    assert.strictEqual(summary.subagentInvocations, 3);
    assert.strictEqual(summary.tierCounts['flash'], 1);
    assert.strictEqual(summary.tierCounts['pro'], 1);
    assert.strictEqual(summary.tierCounts['inherit'], 1);
  });
});

describe('auditTranscript and formatAuditReport', () => {
  it('audits a clean transcript successfully', () => {
    const jsonl = [
      JSON.stringify({
        step_index: 0,
        type: 'PLANNER_RESPONSE',
        tool_calls: [{ name: 'read_file', args: { Path: 'src/analyzing/stats.ts' } }],
      }),
      JSON.stringify({
        step_index: 1,
        type: 'GENERIC',
        status: 'DONE',
        content: 'content of file',
      }),
    ].join('\n');

    const result = auditTranscript(jsonl, { repos: MOCK_REPOS });
    assert.strictEqual(result.hasSplitViolation, false);
    assert.strictEqual(result.violations.length, 0);
    assert.strictEqual(result.toolFriction.totalToolCalls, 1);
    assert.strictEqual(result.toolFriction.toolErrors, 0);

    const report = formatAuditReport(result);
    assert.match(report, /Split Isolation: PASSED/);
  });

  it('detects violations and formats violation report', () => {
    const jsonl = [
      JSON.stringify({
        step_index: 0,
        type: 'PLANNER_RESPONSE',
        tool_calls: [
          {
            name: 'read_file',
            args: { Path: '/home/user/.cache/analyzer-repos/lighthouse-2020/file.js' },
          },
        ],
      }),
    ].join('\n');

    const result = auditTranscript(jsonl, { repos: MOCK_REPOS });
    assert.strictEqual(result.hasSplitViolation, true);
    assert.strictEqual(result.violations.length, 1);

    const report = formatAuditReport(result);
    assert.match(report, /Split Isolation: FAILED/);
    assert.match(report, /lighthouse-2020/);
  });
});

describe('disk operations: auditTranscriptFile and auditTranscriptDir', () => {
  it('reads and audits jsonl files and directories', async () => {
    const testDir = join(tmpdir(), `audit-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const file1 = join(testDir, 'clean.jsonl');
      const file2 = join(testDir, 'violation.jsonl');

      await writeFile(
        file1,
        JSON.stringify({
          step_index: 0,
          type: 'PLANNER_RESPONSE',
          tool_calls: [{ name: 'run_command', args: { CommandLine: 'git status' } }],
        }),
      );

      await writeFile(
        file2,
        JSON.stringify({
          step_index: 0,
          type: 'PLANNER_RESPONSE',
          tool_calls: [
            {
              name: 'read_file',
              args: { Path: 'analyzer-internal/labels/grades.paulirish.jsonl' },
            },
          ],
        }),
      );

      const res1 = await auditTranscriptFile(file1, { repos: MOCK_REPOS });
      assert.strictEqual(res1.hasSplitViolation, false);

      const res2 = await auditTranscriptFile(file2, { repos: MOCK_REPOS });
      assert.strictEqual(res2.hasSplitViolation, true);

      const batch = await auditTranscriptDir(testDir, { repos: MOCK_REPOS });
      assert.strictEqual(batch.auditedCount, 2);
      assert.strictEqual(batch.cleanCount, 1);
      assert.strictEqual(batch.violationCount, 1);

      const batchReport = formatBatchReport(batch);
      assert.match(batchReport, /Audited Transcripts:\s+2/);
      assert.match(batchReport, /Clean Transcripts:\s+1/);
      assert.match(batchReport, /Violating Transcripts:\s*1/);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});

describe('fail-fast repo loading (no fail-open split audit)', () => {
  async function withReposFile(
    entries: unknown,
    fn: (reposPath: string) => Promise<void>,
  ): Promise<void> {
    const dir = join(tmpdir(), `audit-repos-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(dir, { recursive: true });
    try {
      const reposPath = join(dir, 'repos.json');
      await writeFile(reposPath, JSON.stringify(entries));
      await fn(reposPath);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  it('rejects an entry with a missing split instead of defaulting it to rule-writing', async () => {
    await withReposFile([{ repo: 'held-out-app' }], async (reposPath) => {
      await assert.rejects(loadRepos(reposPath), /held-out-app\): split must be/);
    });
  });

  it('rejects an entry with an unknown split value', async () => {
    await withReposFile([{ repo: 'x', split: 'grading' }], async (reposPath) => {
      await assert.rejects(loadRepos(reposPath), /got "grading"/);
    });
  });

  it('auditTranscriptFile throws when repos.json cannot be loaded rather than auditing against zero repos', async () => {
    const dir = join(tmpdir(), `audit-missing-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    try {
      const transcript = join(dir, 't.jsonl');
      await writeFile(
        transcript,
        JSON.stringify({
          step_index: 0,
          type: 'PLANNER_RESPONSE',
          tool_calls: [{ name: 'read_file', args: { Path: '/x/.cache/analyzer-repos/lighthouse-2020/a.js' } }],
        }),
      );
      await assert.rejects(
        auditTranscriptFile(transcript, { reposPath: join(dir, 'does-not-exist.json') }),
        /ENOENT/,
      );
      await assert.rejects(
        auditTranscriptDir(dir, { reposPath: join(dir, 'does-not-exist.json') }),
        /ENOENT/,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('detectProcessSignals', () => {
  const ROOT = '/repo/.worktrees/analyzer';
  function steps(...calls: ToolCall[]): TranscriptStep[] {
    return calls.map((call, i) => ({ step_index: i, type: 'PLANNER_RESPONSE', tool_calls: [call] }));
  }
  const signalSummary = (s: TranscriptStep[]): string[] =>
    detectProcessSignals(s).map((sig) => `${sig.stepIndex}:${sig.kind}`);

  it('flags tool-level edits to PROGRESS.md and findings run artifacts', () => {
    const s = steps(
      { name: 'edit_file', args: { Path: `"${ROOT}/analyzer-internal/PROGRESS.md"` } },
      { name: 'edit_file', args: { Path: `${ROOT}/analyzer-internal/findings/judge-calibration-latest.json` } },
      { name: 'write_file', args: { Path: `${ROOT}/analyzer-internal/findings/card-telemetry.jsonl` } },
    );
    assert.deepStrictEqual(signalSummary(s), [
      '0:hand-edited-generated-artifact',
      '1:hand-edited-generated-artifact',
      '2:hand-edited-generated-artifact',
    ]);
  });

  it('does not flag script-written artifacts, hand-written findings reports, or reads', () => {
    const s = steps(
      { name: 'run_command', args: { CommandLine: `node src/analyzing/progress-log.ts > ${ROOT}/analyzer-internal/PROGRESS.md` } },
      { name: 'write_file', args: { Path: `${ROOT}/analyzer-internal/findings/2026-10-16-observer-2.md` } },
      { name: 'read_file', args: { Path: `${ROOT}/analyzer-internal/findings/card-telemetry.jsonl` } },
    );
    assert.deepStrictEqual(signalSummary(s), []);
  });

  it('flags prompts.ts edits only after the agent itself read labels or disagreement cards', () => {
    const promptEdit: ToolCall = { name: 'edit_file', args: { Path: `${ROOT}/src/analyzing/prompts.ts` } };
    const s = steps(
      promptEdit,
      { name: 'send_message', args: { Message: 'see analyzer-internal/labels/grades.paulirish.jsonl' } },
      promptEdit,
      { name: 'read_file', args: { Path: `${ROOT}/analyzer-internal/findings/2026-10-16-judge-paul-disagreements.md` } },
      promptEdit,
    );
    assert.deepStrictEqual(signalSummary(s), ['4:prompt-edit-after-label-read']);
  });

  it('flags a run of status polls on one task but not a shorter or interrupted run', () => {
    const poll = (taskId: string): ToolCall => ({ name: 'manage_task', args: { Action: 'status', TaskId: taskId } });
    const tenPolls = Array.from({ length: 10 }, () => poll('task-1'));
    const ninePolls = Array.from({ length: 9 }, () => poll('task-2'));
    const s = steps(
      ...tenPolls,
      ...ninePolls,
      ...Array.from({ length: 5 }, () => poll('task-3')),
      { name: 'run_command', args: { CommandLine: 'git status' } },
      ...Array.from({ length: 5 }, () => poll('task-3')),
    );
    assert.deepStrictEqual(signalSummary(s), ['0:polling-loop']);
  });

  it('includes process signals in the audit report without failing split isolation', () => {
    const jsonl = JSON.stringify({
      step_index: 7,
      type: 'PLANNER_RESPONSE',
      tool_calls: [{ name: 'edit_file', args: { Path: `${ROOT}/analyzer-internal/PROGRESS.md` } }],
    });
    const result = auditTranscript(jsonl, { repos: MOCK_REPOS });
    assert.strictEqual(result.hasSplitViolation, false);
    assert.match(formatAuditReport(result), /Step 7 \[hand-edited-generated-artifact\]/);
  });
});

describe('filterStepsSince (audit window scoping)', () => {
  const steps: TranscriptStep[] = [
    {
      step_index: 0,
      created_at: '2026-10-15T23:00:00Z',
      type: 'PLANNER_RESPONSE',
      tool_calls: [{ name: 'read_file', args: { Path: '/x/.cache/analyzer-repos/lighthouse-2020/old.js' } }],
    },
    {
      step_index: 1,
      created_at: '2026-10-16T02:00:00Z',
      type: 'PLANNER_RESPONSE',
      tool_calls: [{ name: 'read_file', args: { Path: 'analyzer-internal/labels/grades.paulirish.jsonl' } }],
    },
  ];

  it('keeps only steps at or after the bound', () => {
    assert.deepStrictEqual(
      filterStepsSince(steps, '2026-10-16T01:15:00Z').map((s) => s.step_index),
      [1],
    );
  });

  it('scopes auditTranscript violations to the window', () => {
    const windowed = auditTranscript(steps, { repos: MOCK_REPOS, since: '2026-10-16T01:15:00Z' });
    assert.deepStrictEqual(
      windowed.violations.map((v) => [v.stepIndex, v.reason]),
      [[1, 'labels-directory']],
    );
    assert.strictEqual(windowed.totalSteps, 1);
  });

  it('throws on an unparseable bound or a step without created_at', () => {
    assert.throws(() => filterStepsSince(steps, 'yesterday'), /Invalid --since timestamp/);
    assert.throws(
      () => filterStepsSince([{ step_index: 7, type: 'GENERIC' }], '2026-10-16T00:00:00Z'),
      /Step 7 has no created_at/,
    );
  });
});

describe('real repos.json integration test', () => {
  it('loads real repos.json and extracts grading-only repos', async () => {
    const realRepos = await loadRepos();
    assert.ok(realRepos.length > 50);

    const grading = extractGradingRepos(realRepos);
    assert.strictEqual(grading.length, 93);

    // Verify key repos are present
    const names = new Set(grading.map((r) => r.repo));
    assert.ok(names.has('lighthouse-2020'));
    assert.ok(names.has('timeline-viewer'));
    assert.ok(names.has('trajectoryview'));

    // Simulated transcript accessing a real grading repo
    const simulated = [
      JSON.stringify({
        step_index: 0,
        type: 'PLANNER_RESPONSE',
        tool_calls: [
          {
            name: 'read_file',
            args: { Path: '/home/paulirish/.cache/analyzer-repos/timeline-viewer/index.html' },
          },
        ],
      }),
    ].join('\n');

    const audit = auditTranscript(simulated, { repos: realRepos });
    assert.strictEqual(audit.hasSplitViolation, true);
    assert.strictEqual(audit.violations[0]?.matchedRepo, 'timeline-viewer');
  });
});
