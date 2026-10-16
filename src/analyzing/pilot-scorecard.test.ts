import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CANARY_CONFIG,
  GITMIRROR_FINAL_SCORECARD_PATH,
  INITIAL_SAMPLE_BATCH,
  MAX_EXTENDED_SAMPLE,
  MAX_SAMPLE_PER_GUIDE,
  SYNTHETIC_CANARY_CARDS,
  buildRulesByIdMap,
  computeRuleSetHash,
  evaluateGuideQualification,
  formatPilotScorecardReport,
  sampleM3SpotcheckDeck,
  samplePhase2DropsDeck,
  stratifiedSampleFindings,
  type PilotScorecardReport,
  type ScorecardSplit,
} from './pilot-scorecard.ts';
import type { AnalyzerFinding, AnalyzerRule } from './schema.ts';
import type { Phase2Verdict } from './phase2.ts';
import { checkCanaries, type JudgeResult, JUDGE_VERSION } from './judge.ts';
import { resolveGitMirrorCacheDir } from './paths.ts';
import { PHASE2_PROMPT_VERSION } from './prompts.ts';
import { computeTelemetryCacheKey, type CardTelemetryRecord } from './telemetry.ts';

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
  it('defines 3 valid synthetic negative canaries', async (t) => {
    assert.strictEqual(SYNTHETIC_CANARY_CARDS.length, 3);
    for (const c of SYNTHETIC_CANARY_CARDS) {
      await t.test(`canary card ${c.cardId}`, () => {
        assert.ok(c.cardId.startsWith('canary-neg-'));
        assert.ok(c.guideId);
        assert.ok(c.codeSnippet.length > 20);
      });
    }
  });

  it('CANARY_CONFIG contains 5 negative controls with non-right expectations', async (t) => {
    assert.strictEqual(CANARY_CONFIG.length, 5);
    for (const c of CANARY_CONFIG) {
      await t.test(`control card ${c.cardId}`, () => {
        assert.notStrictEqual(c.expectedVerdict, 'right');
      });
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
      gitDirty: false,
      ruleSetHash: '2661f572344c',
      splitHash: 'b8af9495f9ec',
      split: 'grading-only',
      gradesHash: 'b6e5d6f718df',
      judgeVersion: 'gemini-3.8-flash:detective-v4-guide-only',
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
    assert.strictEqual(result.tier, 'proven-high-n');
  });

  it('qualifies sample-constrained guides with 16 <= n < 56 when Wilson95 lower >= 0.80 and prec >= 0.95 (clearedHighN80, unmeasured-low-n per R20)', () => {
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
    // Per R20: clearsPrecisionBar strictly requires clearsBar90 (wilson95.lower >= 0.90)
    assert.strictEqual(result.clearsPrecisionBar, false);
    assert.strictEqual(result.tier, 'unmeasured-low-n');
  });

  it('identifies 35 <= n < 56 rules with lower bound < 0.90 as below-bar (O53, DECISIONS.md)', () => {
    // 42/43: 97.7% precision, wilson95.lower = 0.879 < 0.90, n = 43 >= 35
    const qualified = evaluateGuideQualification(42, 43);
    assert.strictEqual(qualified.isSampleConstrained, true);
    assert.strictEqual(qualified.clearedHighN80, true);
    assert.strictEqual(qualified.clearsPrecisionBar, false);
    assert.strictEqual(qualified.clearsScreen80, true);
    assert.strictEqual(qualified.tier, 'below-bar');
    assert.strictEqual(Math.round(qualified.precision * 1000) / 10, 97.7);
    assert.strictEqual(Math.round(qualified.wilson95.lower * 1000) / 1000, 0.879);

    // 39/43: 90.7% point precision (< 0.95), wilson95.lower = 0.784 (< 0.80), 4 FPs (n=43 >= 35 -> below-bar)
    const notQualified = evaluateGuideQualification(39, 43);
    assert.strictEqual(notQualified.isSampleConstrained, true);
    assert.strictEqual(notQualified.clearedHighN80, false);
    assert.strictEqual(notQualified.clearedZeroFpExhaustive, false);
    assert.strictEqual(notQualified.clearsPrecisionBar, false);
    assert.strictEqual(notQualified.tier, 'below-bar');
  });

  it('qualifies sample-constrained guides with low n when all findings sampled and fpCount === 0 (clearedZeroFpExhaustive, unmeasured-low-n per R20)', () => {
    // 6 findings in corpus, all 6 sampled, 6 kept, 6 right, 0 false positives
    // Wilson95 lower bound for 6/6 is ~0.609 (< 0.80), but exhaustive with 0 FP across all repos clears sample-constrained
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
    assert.strictEqual(result.clearsPrecisionBar, false);
    assert.strictEqual(result.tier, 'unmeasured-low-n');
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
    assert.strictEqual(result.tier, 'experimental');
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
    assert.strictEqual(result.tier, 'experimental');
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
    assert.strictEqual(result.tier, 'experimental');
  });

  it('correctly assigns tiers per R20 (proven-high-n vs unmeasured-low-n vs experimental)', () => {
    // 1. proven-high-n: clearsPrecisionBar (clearsBar90: wilson95.lower >= 0.90)
    const proven60 = evaluateGuideQualification(60, 60);
    assert.strictEqual(proven60.clearsPrecisionBar, true);
    assert.strictEqual(proven60.tier, 'proven-high-n');

    // 2. unmeasured-low-n: clearsSampleConstrained but lower bound < 0.90 (R20)
    const unmeasured8 = evaluateGuideQualification(8, 8);
    assert.strictEqual(unmeasured8.clearsPrecisionBar, false);
    assert.strictEqual(unmeasured8.tier, 'unmeasured-low-n');

    const unmeasured1 = evaluateGuideQualification(1, 1);
    assert.strictEqual(unmeasured1.clearsPrecisionBar, false);
    assert.strictEqual(unmeasured1.tier, 'unmeasured-low-n');

    // 3. experimental: !clearsPrecisionBar && !clearsSampleConstrained
    const exp1 = evaluateGuideQualification(26, 29); // ~89.7%, n=29 >= 8, but lower < 0.80
    assert.strictEqual(exp1.clearsPrecisionBar, false);
    assert.strictEqual(exp1.tier, 'experimental');

    const exp2 = evaluateGuideQualification(0, 0);
    assert.strictEqual(exp2.tier, 'experimental');
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

describe('buildRulesByIdMap (multi-rule collision prevention)', () => {
  function makeMockRule(id: string, guideId: string, summary: string): AnalyzerRule {
    return {
      id,
      guideId,
      guideHash: '123456789012',
      summary,
      matcher: {
        kind: 'css',
        matchRule: () => null,
      },
      phase2Rubric: {
        keepWhen: [`Keep for ${id}`],
        dropWhen: [`Drop for ${id}`],
      },
    };
  }

  it('guarantees that ruleId mapping is never overwritten by another rule sharing the same guideId', () => {
    const cssRule = makeMockRule('foo', 'foo', 'CSS rule for foo');
    const jsRule = makeMockRule('foo/js', 'foo', 'JS rule for foo');

    const rulesById = buildRulesByIdMap([cssRule, jsRule]);

    assert.strictEqual(rulesById.get('foo'), cssRule);
    assert.strictEqual(rulesById.get('foo/js'), jsRule);
    assert.strictEqual(rulesById.get('foo')?.summary, 'CSS rule for foo');
    assert.strictEqual(rulesById.get('foo/js')?.summary, 'JS rule for foo');
  });

  it('preserves correct rule mapping regardless of rule order in the array', () => {
    const cssRule = makeMockRule(
      'child-state-based-styling',
      'child-state-based-styling',
      'CSS :has() rule',
    );
    const jsRule = makeMockRule(
      'child-state-based-styling/js-parent-class',
      'child-state-based-styling',
      'JS class toggling rule',
    );

    // Register JS rule before CSS rule
    const rulesById = buildRulesByIdMap([jsRule, cssRule]);

    assert.strictEqual(rulesById.get('child-state-based-styling'), cssRule);
    assert.strictEqual(rulesById.get('child-state-based-styling/js-parent-class'), jsRule);
    assert.deepStrictEqual(
      rulesById.get('child-state-based-styling')?.phase2Rubric.keepWhen,
      ['Keep for child-state-based-styling'],
    );
  });

  it('maps guideId to fallback rule when no rule shares the exact guideId as its id', () => {
    const subRule1 = makeMockRule('bar/a', 'bar', 'Sub-rule A');
    const subRule2 = makeMockRule('bar/b', 'bar', 'Sub-rule B');

    const rulesById = buildRulesByIdMap([subRule1, subRule2]);

    assert.strictEqual(rulesById.get('bar/a'), subRule1);
    assert.strictEqual(rulesById.get('bar/b'), subRule2);
    // Fallback to first rule for 'bar'
    assert.strictEqual(rulesById.get('bar'), subRule1);
  });
});

describe('resolveGitMirrorCacheDir', () => {
  it('resolves analyzer-gitmirror path in homedir cache', () => {
    const dir = resolveGitMirrorCacheDir();
    assert.ok(dir.includes('.cache'));
    assert.ok(dir.endsWith('analyzer-gitmirror'));
  });
});

describe('samplePhase2DropsDeck (R18, R28)', () => {
  it('prioritizes low and medium confidence drops over high confidence drops', () => {
    const findings: AnalyzerFinding[] = [
      {
        cardId: 'card-high-1',
        repo: 'r1',
        commit: 'c1',
        file: 'f1.js',
        line: 1,
        guideId: 'g1',
        ruleId: 'g1/r1',
        guideHash: '123456789012',
        message: 'msg1',
        codeSnippet: 'code1',
        astSlice: '',
      },
      {
        cardId: 'card-medium-1',
        repo: 'r2',
        commit: 'c2',
        file: 'f2.js',
        line: 2,
        guideId: 'g2',
        ruleId: 'g2/r1',
        guideHash: '123456789012',
        message: 'msg2',
        codeSnippet: 'code2',
        astSlice: '',
      },
      {
        cardId: 'card-low-1',
        repo: 'r3',
        commit: 'c3',
        file: 'f3.js',
        line: 3,
        guideId: 'g3',
        ruleId: 'g3/r1',
        guideHash: '123456789012',
        message: 'msg3',
        codeSnippet: 'code3',
        astSlice: '',
      },
    ];

    const verdictsMap = new Map<string, Phase2Verdict>([
      ['card-high-1', { cardId: 'card-high-1', keep: false, reason: 'obvious drop', confidence: 'high' }],
      ['card-medium-1', { cardId: 'card-medium-1', keep: false, reason: 'medium drop', confidence: 'medium' }],
      ['card-low-1', { cardId: 'card-low-1', keep: false, reason: 'uncertain drop', confidence: 'low' }],
    ]);

    const deck = samplePhase2DropsDeck(findings, 2, verdictsMap);
    assert.strictEqual(deck.length, 2);
    // low confidence prioritized first, then medium confidence
    assert.strictEqual(deck[0].cardId, 'card-low-1');
    assert.strictEqual(deck[1].cardId, 'card-medium-1');
    assert.strictEqual(deck[0].phase2Reason, 'uncertain drop');
  });
});

describe('telemetry cache key strictness and version alignment (R17, R18, R28, R29)', () => {
  it('strictly isolates cache keys by prompt version for Phase 2 and Judge', () => {
    const cardId = 'test-card-123';
    const ruleHash = 'abc123rule';
    const guideHash = 'def456guide';

    const p2KeyCurrent = computeTelemetryCacheKey(cardId, ruleHash, guideHash, PHASE2_PROMPT_VERSION);
    const p2KeyStale = computeTelemetryCacheKey(cardId, ruleHash, guideHash, 'phase2-v1');
    assert.notStrictEqual(p2KeyCurrent, p2KeyStale);
    assert.ok(p2KeyCurrent.endsWith(`:${PHASE2_PROMPT_VERSION}`));

    const judgeKeyCurrent = computeTelemetryCacheKey(cardId, '', '', JUDGE_VERSION);
    const judgeKeyStale = computeTelemetryCacheKey(cardId, '', '', 'gemini-3.8-flash:detective-v4-guide-only');
    assert.notStrictEqual(judgeKeyCurrent, judgeKeyStale);
    assert.ok(judgeKeyCurrent.endsWith(`:${JUDGE_VERSION}`));

    // A mock telemetry record with a stale version must not match current prompt version
    const staleRecord: CardTelemetryRecord = {
      cardId,
      repo: 'repo1',
      commit: 'c1',
      file: 'f1.js',
      line: 1,
      guideId: 'g1',
      ruleId: 'r1',
      ruleHash,
      guideHash,
      promptVersion: 'phase2-v1',
      timestamp: new Date().toISOString(),
      phase2: { keep: true, confidence: 'high', reason: 'old reason' },
    };
    assert.notStrictEqual(staleRecord.promptVersion, PHASE2_PROMPT_VERSION);
  });
});

describe('3-way split infrastructure and sequential sampling (R23, O32, O60)', () => {
  it('exports correct constants for 2-stage sequential sampling batches', () => {
    assert.strictEqual(INITIAL_SAMPLE_BATCH, 60);
    assert.strictEqual(MAX_EXTENDED_SAMPLE, 100);
    assert.strictEqual(MAX_SAMPLE_PER_GUIDE, 60);
    assert.ok(GITMIRROR_FINAL_SCORECARD_PATH.endsWith('2026-10-16-gitmirror-final-scorecard.json'));
  });

  it('renders split label in formatPilotScorecardReport', () => {
    const mockReport: PilotScorecardReport = {
      timestamp: '2026-10-16T00:00:00.000Z',
      commit: 'abc1234',
      gitDirty: false,
      ruleSetHash: '2661f572344c',
      splitHash: 'b8af9495f9ec',
      split: 'final',
      gradesHash: 'b6e5d6f718df',
      judgeVersion: 'gemini-3.8-flash:detective-v6-spec22-3233a247',
      guides: [],
      summary: {
        totalDetectableGuides: 1,
        clearedBarCount: 0,
        clearedScreenCount: 0,
        coverage: { value: 0, n: 1, split: 'final' },
        overallPrecision: { value: 0, n: 0, split: 'final, judged' },
        overallRecall: { value: 0, n: 0, split: 'final' },
        pooledHeldoutPrecision: {
          successes: 0,
          total: 0,
          precision: 0,
          wilson95: { proportion: 0, lower: 0, upper: 0, n: 0 },
        },
        judgeStability: null,
        judgeAlpha: 1.0,
        judgeAc1: 1.0,
        canaryTnr: 1.0,
        canaryViolations: [],
      },
      canaries: CANARY_CONFIG,
    };

    const formatted = formatPilotScorecardReport(mockReport);
    assert.ok(formatted.includes('Split Hash:    b8af9495f9ec (final)'));
  });

  it('filters repos by split matching tune (tune + grading-only) and final strictly', () => {
    const repos = [
      { repo: 'r1', split: 'rule-writing', commit: 'c1' },
      { repo: 'r2', split: 'tune', commit: 'c2' },
      { repo: 'r3', split: 'grading-only', commit: 'c3' },
      { repo: 'r4', split: 'final', commit: 'c4' },
    ];

    const filterTune = (split: ScorecardSplit) =>
      repos.filter((r) => {
        if (split === 'tune') return r.split === 'tune' || r.split === 'grading-only';
        if (split === 'grading-only') return r.split === 'grading-only' || r.split === 'tune';
        return r.split === split;
      });

    const tuneRepos = filterTune('tune');
    assert.deepStrictEqual(
      tuneRepos.map((r) => r.repo),
      ['r2', 'r3'],
    );

    const finalRepos = filterTune('final');
    assert.deepStrictEqual(
      finalRepos.map((r) => r.repo),
      ['r4'],
    );
  });

  it('guarantees deterministic prefix preservation when extending sample from 60 to 100', () => {
    const findings: AnalyzerFinding[] = [];
    for (let r = 0; r < 4; r++) {
      for (let i = 0; i < 35; i++) {
        findings.push({
          cardId: `c_${r}_${i}`,
          ruleId: 'test-rule',
          guideId: 'test-guide',
          guideHash: '123456789012',
          repo: `repo-${r}`,
          commit: 'abc1234',
          file: `src/file${i}.ts`,
          line: i + 1,
          message: 'msg',
          codeSnippet: 'code',
          astSlice: 'ast',
        });
      }
    }
    assert.strictEqual(findings.length, 140);

    const sample60 = stratifiedSampleFindings(findings, INITIAL_SAMPLE_BATCH);
    const sample100 = stratifiedSampleFindings(findings, MAX_EXTENDED_SAMPLE);

    assert.strictEqual(sample60.length, 60);
    assert.strictEqual(sample100.length, 100);

    // Initial batch is exact prefix of extended batch
    assert.deepStrictEqual(
      sample100.slice(0, 60).map((f) => f.cardId),
      sample60.map((f) => f.cardId),
    );

    // Extension findings are the remaining 40 items
    const additional = sample100.slice(60);
    assert.strictEqual(additional.length, 40);
    const initialSet = new Set(sample60.map((f) => f.cardId));
    for (const f of additional) {
      assert.strictEqual(initialSet.has(f.cardId), false);
    }
  });
});


