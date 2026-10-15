import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  CANARY_CONFIG,
  SYNTHETIC_CANARY_CARDS,
  computeRuleSetHash,
  evaluateGuideQualification,
  formatPilotScorecardReport,
  runPilotScorecard,
  sampleM3SpotcheckDeck,
  stratifiedSampleFindings,
  type PilotScorecardReport,
} from './pilot-scorecard.ts';
import type { AnalyzerFinding, AnalyzerRule } from './schema.ts';
import { checkCanaries, type JudgeResult } from './judge.ts';

describe('computeRuleSetHash', () => {
  it('computes a deterministic 12-character hex hash from rule files', async () => {
    const hash1 = await computeRuleSetHash();
    const hash2 = await computeRuleSetHash();
    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 12);
    assert.match(hash1, /^[0-9a-f]{12}$/);
  });
});

describe('stratifiedSampleFindings', () => {
  function makeFinding(id: string, repo: string, file: string, line: number): AnalyzerFinding {
    return {
      cardId: id,
      ruleId: 'test-rule',
      guideId: 'test-guide',
      guideHash: '123456789012',
      repo,
      commit: 'abc1234',
      file,
      line,
      message: 'test message',
      codeSnippet: 'const x = 1;',
      astSlice: 'const x = 1;',
    };
  }

  it('preserves all findings when total is <= targetCount', () => {
    const findings = [
      makeFinding('c1', 'repo-a', 'file1.ts', 10),
      makeFinding('c2', 'repo-b', 'file2.ts', 20),
    ];
    const sampled = stratifiedSampleFindings(findings, 60);
    assert.strictEqual(sampled.length, 2);
    assert.deepStrictEqual(sampled, findings);
  });

  it('stratifies evenly across repositories when findings exceed targetCount', () => {
    // 3 repos with 30 findings each (90 total)
    const findings: AnalyzerFinding[] = [];
    for (const repo of ['repo-1', 'repo-2', 'repo-3']) {
      for (let i = 1; i <= 30; i++) {
        findings.push(makeFinding(`${repo}-c${i}`, repo, `src/file${i}.ts`, i));
      }
    }

    const sampled = stratifiedSampleFindings(findings, 60);
    assert.strictEqual(sampled.length, 60);

    // Each repo should have contributed exactly 20 findings
    const countByRepo = new Map<string, number>();
    for (const f of sampled) {
      countByRepo.set(f.repo, (countByRepo.get(f.repo) ?? 0) + 1);
    }

    assert.strictEqual(countByRepo.get('repo-1'), 20);
    assert.strictEqual(countByRepo.get('repo-2'), 20);
    assert.strictEqual(countByRepo.get('repo-3'), 20);
  });

  it('is completely deterministic regardless of initial findings array order', () => {
    const findings: AnalyzerFinding[] = [
      makeFinding('c3', 'repo-b', 'src/z.ts', 30),
      makeFinding('c1', 'repo-a', 'src/b.ts', 10),
      makeFinding('c4', 'repo-b', 'src/a.ts', 5),
      makeFinding('c2', 'repo-a', 'src/a.ts', 20),
    ];

    const sampled1 = stratifiedSampleFindings(findings, 2);
    const sampled2 = stratifiedSampleFindings([...findings].reverse(), 2);

    assert.strictEqual(sampled1.length, 2);
    assert.strictEqual(sampled2.length, 2);
    assert.deepStrictEqual(
      sampled1.map((f) => f.cardId),
      sampled2.map((f) => f.cardId),
    );
  });
});

describe('canary definitions and validation', () => {
  it('defines 3 valid synthetic negative canaries', () => {
    assert.strictEqual(SYNTHETIC_CANARY_CARDS.length, 3);
    for (const c of SYNTHETIC_CANARY_CARDS) {
      assert.ok(c.cardId.startsWith('canary-neg-'));
      assert.ok(c.guideId);
      assert.ok(c.codeSnippet.length > 20);
    }
  });

  it('CANARY_CONFIG contains 5 negative controls with non-right expectations', () => {
    assert.strictEqual(CANARY_CONFIG.length, 5);
    for (const c of CANARY_CONFIG) {
      assert.notStrictEqual(c.expectedVerdict, 'right');
    }
  });

  it('verifies 100% Canary TNR when judge rejects all canaries', () => {
    const results: JudgeResult[] = [
      {
        cardId: '2547b2ba6d74',
        verdict: 'not-old-pattern',
        facts: {
          matches_before_syntax: false,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: false,
          reasoning: 'fp',
          verdict: 'not-old-pattern',
        },
      },
      {
        cardId: '7f2a96f62a4c',
        verdict: 'not-old-pattern',
        facts: {
          matches_before_syntax: false,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: false,
          reasoning: 'fp',
          verdict: 'not-old-pattern',
        },
      },
      {
        cardId: 'canary-neg-already-modern',
        verdict: 'not-old-pattern',
        facts: {
          matches_before_syntax: false,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: false,
          reasoning: 'already modern',
          verdict: 'not-old-pattern',
        },
      },
      {
        cardId: 'canary-neg-shadowed-global',
        verdict: 'not-old-pattern',
        facts: {
          matches_before_syntax: false,
          has_fallback_or_feature_guard: false,
          modern_feature_applies_here: false,
          reasoning: 'shadowed',
          verdict: 'not-old-pattern',
        },
      },
      {
        cardId: 'canary-neg-feature-guarded',
        verdict: 'leave-it',
        facts: {
          matches_before_syntax: true,
          has_fallback_or_feature_guard: true,
          modern_feature_applies_here: false,
          reasoning: 'guarded',
          verdict: 'leave-it',
        },
      },
    ];

    const check = checkCanaries(results, CANARY_CONFIG);
    assert.strictEqual(check.passed, true);
    assert.strictEqual(check.tnr, 1.0);
    assert.strictEqual(check.violations.length, 0);
  });
});

describe('formatPilotScorecardReport', () => {
  it('formats terminal summary cleanly without errors', () => {
    const mockReport: PilotScorecardReport = {
      timestamp: '2026-10-15T00:00:00.000Z',
      commit: 'abc1234',
      ruleSetHash: '2661f572344c',
      splitHash: 'b8af9495f9ec',
      gradesHash: 'b6e5d6f718df',
      judgeVersion: 'gemini-3.8-flash:detective-v3-direct',
      guides: [
        {
          guideId: 'autofill-sign-in-form',
          ruleIds: ['autofill-sign-in-form'],
          phase1TotalYield: 24,
          phase1SampledCount: 24,
          phase2KeptCount: 20,
          phase2DroppedCount: 4,
          judgeJudgedCount: 20,
          judgeRightCount: 19,
          judgeFalsePositiveCount: 1,
          precision: 0.95,
          wilson80: { proportion: 0.95, lower: 0.88, upper: 0.98, n: 20 },
          wilson95: { proportion: 0.95, lower: 0.76, upper: 0.99, n: 20 },
          sequentialStopDecision: 'pass',
          clearsPrecisionBar: true,
          clearsBar90: true,
          clearsScreen80: true,
          recall: {
            labeledPositivesTotal: 1,
            phase1Recalled: 0,
            phase2Recalled: 0,
            phase1RecallRate: 0,
            phase2RecallRate: 0,
          },
        },
      ],
      summary: {
        totalDetectableGuides: 5,
        clearedBarCount: 1,
        clearedScreenCount: 1,
        coverage: { value: 0.2, n: 5, split: 'grading-only' },
        overallPrecision: {
          value: 0.95,
          lower: 0.91,
          upper: 0.98,
          n: 85,
          split: 'grading-only',
        },
        overallRecall: {
          value: 0.8333,
          lower: 0.6,
          upper: 0.94,
          n: 18,
          split: 'grading-only',
        },
        pooledHeldoutPrecision: {
          successes: 19,
          total: 20,
          precision: 0.95,
          wilson95: { proportion: 0.95, lower: 0.76, upper: 0.99, n: 20 },
        },
        judgeStability: 0.98,
        judgeAlpha: 0.222,
        judgeAc1: 0.863,
        canaryTnr: 1.0,
        canaryViolations: [],
      },
      canaries: CANARY_CONFIG,
    };

    const formatted = formatPilotScorecardReport(mockReport);
    assert.ok(formatted.includes('PILOT SCORECARD REPORT'));
    assert.ok(formatted.includes('autofill-sign-in-form'));
    assert.ok(formatted.includes('Coverage:'));
    assert.ok(formatted.includes('Canary TNR = 100.0%'));
  });
});

describe('evaluateGuideQualification (G7 sample-constrained criteria)', () => {
  it('qualifies high-n guides via standard bar (clearsBar90)', () => {
    // 60 evaluations with 59 right (seqDecision = pass / wilson95.lower >= 0.90)
    const result = evaluateGuideQualification({
      p1Total: 100,
      p1Sampled: 60,
      p2KeptCount: 60,
      rightCount: 59,
    });
    assert.strictEqual(result.isSampleConstrained, false);
    assert.strictEqual(result.clearsBar90, true);
    assert.strictEqual(result.clearedHighN80, false);
    assert.strictEqual(result.clearedZeroFpExhaustive, false);
    assert.strictEqual(result.clearsPrecisionBar, true);
  });

  it('qualifies sample-constrained guides with 16 <= n < 35 when Wilson95 lower >= 0.80 and prec >= 0.95 (clearedHighN80)', () => {
    // 20 evaluations with 20 right: precision = 1.0, Wilson95 lower is ~0.838 >= 0.80
    const result = evaluateGuideQualification({
      p1Total: 25,
      p1Sampled: 20,
      p2KeptCount: 20,
      rightCount: 20,
    });
    assert.strictEqual(result.isSampleConstrained, true);
    assert.strictEqual(result.clearedHighN80, true);
    assert.strictEqual(result.clearedZeroFpExhaustive, false);
    assert.strictEqual(result.clearsSampleConstrained, true);
    assert.strictEqual(result.clearsScreen80, true);
    assert.strictEqual(result.clearsPrecisionBar, true);
  });

  it('qualifies sample-constrained guides with low n when all findings sampled and fpCount === 0 (clearedZeroFpExhaustive)', () => {
    // 6 findings in corpus, all 6 sampled, 6 kept, 6 right, 0 false positives
    // Wilson95 lower bound for 6/6 is ~0.609 (< 0.80), but exhaustive with 0 FP across all repos clears G7
    const result = evaluateGuideQualification({
      p1Total: 6,
      p1Sampled: 6,
      p2KeptCount: 6,
      rightCount: 6,
    });
    assert.strictEqual(result.isSampleConstrained, true);
    assert.strictEqual(result.clearedHighN80, false);
    assert.strictEqual(result.clearedZeroFpExhaustive, true);
    assert.strictEqual(result.clearsSampleConstrained, true);
    assert.strictEqual(result.clearsScreen80, true);
    assert.strictEqual(result.clearsPrecisionBar, true);
  });

  it('does NOT qualify low n guides with zero FPs if findings were not exhaustively sampled (p1Sampled < p1Total)', () => {
    // 20 findings in corpus, but only 5 sampled; 5 right. Wilson lower < 0.80 and not exhaustive
    const result = evaluateGuideQualification({
      p1Total: 20,
      p1Sampled: 5,
      p2KeptCount: 5,
      rightCount: 5,
    });
    assert.strictEqual(result.isSampleConstrained, true);
    assert.strictEqual(result.clearedHighN80, false);
    assert.strictEqual(result.clearedZeroFpExhaustive, false);
    assert.strictEqual(result.clearsSampleConstrained, false);
    assert.strictEqual(result.clearsPrecisionBar, false);
  });

  it('does NOT qualify sample-constrained guides if fpCount > 0 and Wilson lower < 0.80', () => {
    // 10 findings sampled exhaustively, but 1 FP (9 right): Wilson lower is ~0.595 (< 0.80) and fp > 0
    const result = evaluateGuideQualification({
      p1Total: 10,
      p1Sampled: 10,
      p2KeptCount: 10,
      rightCount: 9,
    });
    assert.strictEqual(result.isSampleConstrained, true);
    assert.strictEqual(result.clearedHighN80, false);
    assert.strictEqual(result.clearedZeroFpExhaustive, false);
    assert.strictEqual(result.clearsSampleConstrained, false);
    assert.strictEqual(result.clearsPrecisionBar, false);
  });

  it('does NOT qualify when p2KeptCount is 0', () => {
    const result = evaluateGuideQualification({
      p1Total: 0,
      p1Sampled: 0,
      p2KeptCount: 0,
      rightCount: 0,
    });
    assert.strictEqual(result.clearedZeroFpExhaustive, false);
    assert.strictEqual(result.clearsPrecisionBar, false);
  });
});

describe('sampleM3SpotcheckDeck', () => {
  function makeFinding(id: string, guideId: string, ruleId: string): AnalyzerFinding {
    return {
      cardId: id,
      ruleId,
      guideId,
      guideHash: '123456789012',
      repo: 'repo-sample',
      commit: 'abc1234',
      file: 'src/file.ts',
      line: 42,
      message: 'test message',
      codeSnippet: 'const x = 1;',
      astSlice: 'const x = 1;',
    };
  }

  it('samples up to 10 cards deterministically and shapes them as CalibrationDeckItems', () => {
    const findings: AnalyzerFinding[] = [];
    for (let i = 0; i < 20; i++) {
      findings.push(makeFinding(`card-${String(i).padStart(3, '0')}`, 'new-guide', 'new-rule'));
    }

    const deck1 = sampleM3SpotcheckDeck(findings, 10);
    const deck2 = sampleM3SpotcheckDeck(findings, 10);

    assert.equal(deck1.length, 10);
    assert.deepEqual(
      deck1.map((c) => c.cardId),
      deck2.map((c) => c.cardId),
    );

    const first = deck1[0];
    assert.ok(first.cardId);
    assert.equal(first.guideId, 'new-guide');
    assert.equal(first.phase2Decision, 'keep');
    assert.ok(first.findings && first.findings.length === 1);
    assert.equal(first.findings[0]?.tool, 'modern-web-guidance-analyzer');
  });

  it('prefers novel rules over pilot rules when available', () => {
    const pilotFinding = makeFinding('card-pilot', 'autofill-sign-in-form', 'autofill-rule');
    const novelFinding = makeFinding('card-novel', 'novel-m3-guide', 'novel-rule');

    const deck = sampleM3SpotcheckDeck([pilotFinding, novelFinding], 10);
    assert.equal(deck.length, 1);
    assert.equal(deck[0].cardId, 'card-novel');
    assert.equal(deck[0].guideId, 'novel-m3-guide');
  });

  it('handles empty findings gracefully', () => {
    const deck = sampleM3SpotcheckDeck([]);
    assert.deepEqual(deck, []);
  });
});
