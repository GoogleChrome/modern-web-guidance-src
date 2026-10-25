import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkSequentialStop,
  computeCardId,
  gwetAc1Nominal,
  krippendorffAlphaNominal,
  ppiPlusPlusPrecision,
  sensitivitySpecificity,
  wilsonInterval,
  Z_95,
  Z_SEQUENTIAL_STOPPING,
} from './stats.ts';

describe('computeCardId', () => {
  it('computes 12-char SHA-256 matching spec §2.1 and existing labels', () => {
    // Verified against analyzer-internal/labels/cards/lh-scorecalc.json
    const id1 = computeCardId(
      'lh-scorecalc',
      'a2a9e2bd036758d161c7ec80f20b1c158c069b2f',
      'css-layout',
      'style.css',
      5,
    );
    assert.strictEqual(id1, 'f724500e2ff9');

    // Verified against analyzer-internal/labels/cards/fastmail-overture.json
    const id2 = computeCardId(
      'fastmail-overture',
      '532d7d10d6052eb65e36b8ae9cd2d30ffa5925c8',
      'coordinate-global-events',
      'source/core/Date.js',
      537,
    );
    assert.strictEqual(id2, 'edefed5255eb');

    const id3 = computeCardId(
      'fastmail-overture',
      '532d7d10d6052eb65e36b8ae9cd2d30ffa5925c8',
      'manage-recurring-intervals',
      'source/core/Date.js',
      304,
    );
    assert.strictEqual(id3, '50501ceafbb8');
  });

  it('is deterministic and strictly 12 hex characters', () => {
    const id = computeCardId('my-repo', 'commit-hash', 'guide-x', 'src/file.ts', 42);
    assert.match(id, /^[0-9a-f]{12}$/);
    assert.strictEqual(id, computeCardId('my-repo', 'commit-hash', 'guide-x', 'src/file.ts', 42));
  });
});

describe('wilsonInterval', () => {
  it('handles empty/zero total gracefully', () => {
    const res = wilsonInterval(0, 0);
    assert.deepStrictEqual(res, { proportion: 0, lower: 0, upper: 0, n: 0 });
  });

  it('calculates expected interval for 0 successes', () => {
    const res = wilsonInterval(0, 20, Z_95);
    assert.strictEqual(res.proportion, 0);
    assert.strictEqual(res.lower, 0);
    assert.ok(res.upper > 0 && res.upper < 0.2);
  });

  it('calculates expected interval for 100% successes', () => {
    const res = wilsonInterval(20, 20, Z_95);
    assert.strictEqual(res.proportion, 1);
    assert.strictEqual(res.upper, 1);
    assert.ok(res.lower > 0.8 && res.lower < 1);
  });

  it('calculates standard interval for 95/100', () => {
    const res = wilsonInterval(95, 100, Z_95);
    assert.strictEqual(res.proportion, 0.95);
    assert.strictEqual(res.n, 100);
    assert.ok(res.lower > 0.88 && res.lower < 0.91);
    assert.ok(res.upper > 0.96 && res.upper < 0.99);
  });

  it('wider interval with Z_SEQUENTIAL_STOPPING than Z_95', () => {
    const res95 = wilsonInterval(28, 30, Z_95);
    const resSeq = wilsonInterval(28, 30, Z_SEQUENTIAL_STOPPING);
    assert.ok(resSeq.lower < res95.lower);
    assert.ok(resSeq.upper > res95.upper);
  });
});

describe('checkSequentialStop', () => {
  it('returns continue before 15 grades', () => {
    assert.strictEqual(checkSequentialStop(10, 10, 0.8), 'continue');
    assert.strictEqual(checkSequentialStop(14, 14, 0.8), 'continue');
  });

  it('fails early at 15 grades when upper bound cannot reach target', () => {
    // 5 of 15 (33%) has upper bound ~0.61 with z=2.39, cannot clear 0.8
    assert.strictEqual(checkSequentialStop(5, 15, 0.8), 'fail');
  });

  it('continues at 15 grades when 15/15 is promising but lower bound is under target', () => {
    // 15 of 15 lower bound is ~0.724 < 0.8
    assert.strictEqual(checkSequentialStop(15, 15, 0.8), 'continue');
  });

  it('passes at 30 grades when lower bound clears target', () => {
    // 30 of 30 lower bound is 0.8400 >= 0.8
    assert.strictEqual(checkSequentialStop(30, 30, 0.8), 'pass');
  });

  it('decides at terminal 60 grades', () => {
    // 60 of 60 lower bound is ~0.913 >= 0.9
    assert.strictEqual(checkSequentialStop(60, 60, 0.9), 'pass');
    // 59 of 60 lower bound is ~0.885 >= 0.85
    assert.strictEqual(checkSequentialStop(59, 60, 0.85), 'pass');
    // 50 of 60 lower bound is ~0.69 < 0.9, fails at 60
    assert.strictEqual(checkSequentialStop(50, 60, 0.9), 'fail');
  });

  it('supports custom maxGrades cap (e.g. 100) for extended sequential sampling', () => {
    // 58 of 60: lower bound ~0.859 < 0.9, upper bound ~0.993 > 0.9
    // At default maxGrades=60, 60 grades fails terminally:
    assert.strictEqual(checkSequentialStop(58, 60, 0.9), 'fail');
    // With maxGrades=100, 60 grades continues:
    assert.strictEqual(checkSequentialStop(58, 60, 0.9, 100), 'continue');
    // At 100 grades with 95/100 (lower ~0.87 < 0.9), it fails terminally at 100:
    assert.strictEqual(checkSequentialStop(95, 100, 0.9, 100), 'fail');
    // At 98 of 100, lower bound is ~0.912 >= 0.9:
    assert.strictEqual(checkSequentialStop(98, 100, 0.9, 100), 'pass');
  });
});

describe('krippendorffAlphaNominal', () => {
  it('returns 1 for empty or single matching pair', () => {
    assert.strictEqual(krippendorffAlphaNominal([]), 1);
    assert.strictEqual(krippendorffAlphaNominal([['right', 'right']]), 1);
  });

  it('returns 1 for perfect agreement with multiple categories', () => {
    const pairs: Array<readonly [string, string]> = [
      ['right', 'right'],
      ['right', 'right'],
      ['not-old-pattern', 'not-old-pattern'],
      ['leave-it', 'leave-it'],
    ];
    assert.strictEqual(krippendorffAlphaNominal(pairs), 1);
  });

  it('computes known nominal alpha on paired data', () => {
    // 8 (A,A), 1 (B,B), 1 (A,B) -> expected ~0.627
    const pairs: Array<readonly [string, string]> = [
      ...Array.from({ length: 8 }, () => ['A', 'A'] as const),
      ['B', 'B'],
      ['A', 'B'],
    ];
    const alpha = krippendorffAlphaNominal(pairs);
    assert.ok(Math.abs(alpha - 0.62745) < 0.001, `Expected ~0.627, got ${alpha}`);
  });

  it('is non-positive for complete disagreement', () => {
    const pairs: Array<readonly [string, string]> = [
      ['A', 'B'],
      ['B', 'A'],
      ['A', 'B'],
      ['B', 'A'],
    ];
    const alpha = krippendorffAlphaNominal(pairs);
    assert.ok(alpha <= 0);
  });
});

describe('gwetAc1Nominal', () => {
  it('returns 1 for empty and perfect agreement', () => {
    assert.strictEqual(gwetAc1Nominal([]), 1);
    const pairs: Array<readonly [string, string]> = [
      ['right', 'right'],
      ['right', 'right'],
    ];
    assert.strictEqual(gwetAc1Nominal(pairs), 1);
  });

  it('resists the prevalence paradox under heavily skewed base rates', () => {
    // Simulating grades.paulirish.jsonl distribution:
    // 83 (right, right), 2 (not-old, not-old), 1 (right, unsure)
    const pairs: Array<readonly [string, string]> = [
      ...Array.from({ length: 83 }, () => ['right', 'right'] as const),
      ['not-old-pattern', 'not-old-pattern'],
      ['not-old-pattern', 'not-old-pattern'],
      ['right', 'unsure'],
    ];
    const ac1 = gwetAc1Nominal(pairs);
    // Raw agreement is 85/86 = 98.8%. Gwet's AC1 stays high (> 0.97).
    assert.ok(ac1 > 0.97, `Expected AC1 > 0.97, got ${ac1}`);
  });
});

describe('sensitivitySpecificity', () => {
  it('handles empty input gracefully', () => {
    const res = sensitivitySpecificity([]);
    assert.deepStrictEqual(res, { tpr: 1, tnr: 1, positives: 0, negatives: 0 });
  });

  it('calculates TPR and TNR accurately', () => {
    const pairs = [
      // 3 human positives: 2 judge positive, 1 judge negative (TPR = 2/3)
      { humanRight: true, judgeRight: true },
      { humanRight: true, judgeRight: true },
      { humanRight: true, judgeRight: false },
      // 2 human negatives: 2 judge negative (TNR = 2/2)
      { humanRight: false, judgeRight: false },
      { humanRight: false, judgeRight: false },
    ];

    const res = sensitivitySpecificity(pairs);
    assert.strictEqual(res.positives, 3);
    assert.strictEqual(res.negatives, 2);
    assert.ok(Math.abs(res.tpr - 2 / 3) < 0.0001);
    assert.strictEqual(res.tnr, 1);
  });

  it('calculates canary TNR (all human negatives)', () => {
    const canaries = [
      { humanRight: false, judgeRight: false },
      { humanRight: false, judgeRight: false },
      { humanRight: false, judgeRight: true }, // caught false positive
    ];
    const res = sensitivitySpecificity(canaries);
    assert.strictEqual(res.positives, 0);
    assert.strictEqual(res.negatives, 3);
    assert.ok(Math.abs(res.tnr - 2 / 3) < 0.0001);
    assert.strictEqual(res.tpr, 1);
  });
});

describe('ppiPlusPlusPrecision', () => {
  it('throws an error when human paired sample is empty', () => {
    assert.throws(
      () => ppiPlusPlusPrecision([], []),
      /ppiPlusPlusPrecision requires at least 1 human-labeled paired item/,
    );
  });

  it('recovers population mean when judge is perfectly correlated', () => {
    // Unlabeled judge ratings: 80% positive over 100 items
    const judgeAll = [
      ...Array.from({ length: 80 }, () => true),
      ...Array.from({ length: 20 }, () => false),
    ];
    // Paired sample: perfect agreement between human and judge
    const paired = [
      { humanRight: true, judgeRight: true },
      { humanRight: true, judgeRight: true },
      { humanRight: false, judgeRight: false },
      { humanRight: false, judgeRight: false },
    ];

    const res = ppiPlusPlusPrecision(judgeAll, paired);
    assert.ok(Math.abs(res.lambda - 1) < 0.001, `Expected lambda ~1, got ${res.lambda}`);
    assert.ok(Math.abs(res.estimate - 0.8) < 0.001, `Expected estimate ~0.8, got ${res.estimate}`);
    assert.strictEqual(res.nHuman, 4);
    assert.strictEqual(res.nJudge, 100);
    assert.ok(res.lower < res.estimate);
    assert.ok(res.upper > res.estimate);
  });

  it('falls back to human sample mean when judge is uncorrelated noise', () => {
    const judgeAll = Array.from({ length: 50 }, (_, i) => i % 2 === 0);
    // Paired sample where judge is independent of human
    const paired = [
      { humanRight: true, judgeRight: true },
      { humanRight: true, judgeRight: false },
      { humanRight: false, judgeRight: true },
      { humanRight: false, judgeRight: false },
    ];

    const res = ppiPlusPlusPrecision(judgeAll, paired);
    assert.ok(Math.abs(res.lambda) < 0.001, `Expected lambda ~0, got ${res.lambda}`);
    assert.ok(Math.abs(res.estimate - 0.5) < 0.001, `Expected estimate 0.5, got ${res.estimate}`);
  });
});
