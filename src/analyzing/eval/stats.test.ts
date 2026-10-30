import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkSequentialStop,
  computeCardId,
  gwetAc1Nominal,
  krippendorffAlphaNominal,
  sensitivitySpecificity,
  wilsonInterval,
  Z_95,
  Z_SEQUENTIAL_STOPPING,
} from './stats.ts';

describe('computeCardId', () => {
  it('computes deterministic 12-char SHA-256 matching canonical labels', () => {
    const cases = [
      { repo: 'lh-scorecalc', commit: 'a2a9e2bd036758d161c7ec80f20b1c158c069b2f', guide: 'css-layout', file: 'style.css', line: 5, expected: 'f724500e2ff9' },
      { repo: 'fastmail-overture', commit: '532d7d10d6052eb65e36b8ae9cd2d30ffa5925c8', guide: 'coordinate-global-events', file: 'source/core/Date.js', line: 537, expected: 'edefed5255eb' },
      { repo: 'fastmail-overture', commit: '532d7d10d6052eb65e36b8ae9cd2d30ffa5925c8', guide: 'manage-recurring-intervals', file: 'source/core/Date.js', line: 304, expected: '50501ceafbb8' },
    ];
    assert.deepStrictEqual(
      cases.map((c) => computeCardId(c.repo, c.commit, c.guide, c.file, c.line)),
      cases.map((c) => c.expected),
    );

    const id = computeCardId('my-repo', 'commit-hash', 'guide-x', 'src/file.ts', 42);
    assert.match(id, /^[0-9a-f]{12}$/);
    assert.strictEqual(id, computeCardId('my-repo', 'commit-hash', 'guide-x', 'src/file.ts', 42));
  });
});

describe('wilsonInterval', () => {
  it('calculates intervals across boundary and standard proportions', () => {
    assert.deepStrictEqual(wilsonInterval(0, 0), { proportion: 0, lower: 0, upper: 0, n: 0 });

    const zero = wilsonInterval(0, 20, Z_95);
    assert.strictEqual(zero.proportion, 0);
    assert.strictEqual(zero.lower, 0);
    assert.ok(zero.upper > 0 && zero.upper < 0.2);

    const full = wilsonInterval(20, 20, Z_95);
    assert.strictEqual(full.proportion, 1);
    assert.strictEqual(full.upper, 1);
    assert.ok(full.lower > 0.8 && full.lower < 1);

    const std = wilsonInterval(95, 100, Z_95);
    assert.strictEqual(std.proportion, 0.95);
    assert.strictEqual(std.n, 100);
    assert.ok(std.lower > 0.88 && std.lower < 0.91);
    assert.ok(std.upper > 0.96 && std.upper < 0.99);

    const res95 = wilsonInterval(28, 30, Z_95);
    const resSeq = wilsonInterval(28, 30, Z_SEQUENTIAL_STOPPING);
    assert.ok(resSeq.lower < res95.lower);
    assert.ok(resSeq.upper > res95.upper);
  });
});

describe('checkSequentialStop', () => {
  it('enforces sequential stopping boundaries and custom maxGrades caps', () => {
    const cases = [
      { successes: 10, total: 10, target: 0.8, expected: 'continue' },
      { successes: 14, total: 14, target: 0.8, expected: 'continue' },
      { successes: 5, total: 15, target: 0.8, expected: 'fail' },
      { successes: 15, total: 15, target: 0.8, expected: 'continue' },
      { successes: 30, total: 30, target: 0.8, expected: 'pass' },
      { successes: 60, total: 60, target: 0.9, expected: 'pass' },
      { successes: 59, total: 60, target: 0.85, expected: 'pass' },
      { successes: 50, total: 60, target: 0.9, expected: 'fail' },
      { successes: 58, total: 60, target: 0.9, expected: 'fail' },
      { successes: 58, total: 60, target: 0.9, maxGrades: 100, expected: 'continue' },
      { successes: 95, total: 100, target: 0.9, maxGrades: 100, expected: 'fail' },
      { successes: 98, total: 100, target: 0.9, maxGrades: 100, expected: 'pass' },
    ];

    assert.deepStrictEqual(
      cases.map((c) => checkSequentialStop(c.successes, c.total, c.target, c.maxGrades)),
      cases.map((c) => c.expected),
    );
  });
});

describe('krippendorffAlphaNominal & gwetAc1Nominal', () => {
  it('computes Krippendorff nominal alpha across agreement regimes', () => {
    assert.strictEqual(krippendorffAlphaNominal([]), 1);
    assert.strictEqual(krippendorffAlphaNominal([['right', 'right']]), 1);
    assert.strictEqual(
      krippendorffAlphaNominal([
        ['right', 'right'],
        ['not-old-pattern', 'not-old-pattern'],
        ['leave-it', 'leave-it'],
      ]),
      1,
    );

    const alpha = krippendorffAlphaNominal([
      ...Array.from({ length: 8 }, () => ['A', 'A'] as const),
      ['B', 'B'],
      ['A', 'B'],
    ]);
    assert.ok(Math.abs(alpha - 0.62745) < 0.001, `Expected ~0.627, got ${alpha}`);

    const discordant = krippendorffAlphaNominal([
      ['A', 'B'],
      ['B', 'A'],
      ['A', 'B'],
      ['B', 'A'],
    ]);
    assert.ok(discordant <= 0);
  });

  it('computes Gwet AC1 and resists the prevalence paradox under skewed base rates', () => {
    assert.strictEqual(gwetAc1Nominal([]), 1);
    assert.strictEqual(gwetAc1Nominal([['right', 'right'], ['right', 'right']]), 1);

    const ac1 = gwetAc1Nominal([
      ...Array.from({ length: 83 }, () => ['right', 'right'] as const),
      ['not-old-pattern', 'not-old-pattern'],
      ['not-old-pattern', 'not-old-pattern'],
      ['right', 'unsure'],
    ]);
    assert.ok(ac1 > 0.97, `Expected AC1 > 0.97, got ${ac1}`);
  });
});

describe('sensitivitySpecificity', () => {
  it('calculates TPR and TNR accurately across empty, mixed, and negative-only sets', () => {
    assert.deepStrictEqual(sensitivitySpecificity([]), {
      tpr: 1,
      tnr: 1,
      positives: 0,
      negatives: 0,
    });

    const mixed = sensitivitySpecificity([
      { humanRight: true, judgeRight: true },
      { humanRight: true, judgeRight: true },
      { humanRight: true, judgeRight: false },
      { humanRight: false, judgeRight: false },
      { humanRight: false, judgeRight: false },
    ]);
    assert.strictEqual(mixed.positives, 3);
    assert.strictEqual(mixed.negatives, 2);
    assert.ok(Math.abs(mixed.tpr - 2 / 3) < 0.0001);
    assert.strictEqual(mixed.tnr, 1);

    const canaries = sensitivitySpecificity([
      { humanRight: false, judgeRight: false },
      { humanRight: false, judgeRight: false },
      { humanRight: false, judgeRight: true },
    ]);
    assert.strictEqual(canaries.positives, 0);
    assert.strictEqual(canaries.negatives, 3);
    assert.ok(Math.abs(canaries.tnr - 2 / 3) < 0.0001);
    assert.strictEqual(canaries.tpr, 1);
  });
});
