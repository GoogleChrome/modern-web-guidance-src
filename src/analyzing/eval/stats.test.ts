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
    assert.strictEqual(
      computeCardId('lh-scorecalc', 'a2a9e2bd036758d161c7ec80f20b1c158c069b2f', 'css-layout', 'style.css', 5),
      'f724500e2ff9',
    );
    assert.strictEqual(
      computeCardId('fastmail-overture', '532d7d10d6052eb65e36b8ae9cd2d30ffa5925c8', 'coordinate-global-events', 'source/core/Date.js', 537),
      'edefed5255eb',
    );
    assert.strictEqual(
      computeCardId('fastmail-overture', '532d7d10d6052eb65e36b8ae9cd2d30ffa5925c8', 'manage-recurring-intervals', 'source/core/Date.js', 304),
      '50501ceafbb8',
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
    assert.strictEqual(checkSequentialStop(10, 10, 0.8), 'continue');
    assert.strictEqual(checkSequentialStop(14, 14, 0.8), 'continue');
    assert.strictEqual(checkSequentialStop(5, 15, 0.8), 'fail');
    assert.strictEqual(checkSequentialStop(15, 15, 0.8), 'continue');
    assert.strictEqual(checkSequentialStop(30, 30, 0.8), 'pass');

    assert.strictEqual(checkSequentialStop(60, 60, 0.9), 'pass');
    assert.strictEqual(checkSequentialStop(59, 60, 0.85), 'pass');
    assert.strictEqual(checkSequentialStop(50, 60, 0.9), 'fail');

    assert.strictEqual(checkSequentialStop(58, 60, 0.9), 'fail');
    assert.strictEqual(checkSequentialStop(58, 60, 0.9, 100), 'continue');
    assert.strictEqual(checkSequentialStop(95, 100, 0.9, 100), 'fail');
    assert.strictEqual(checkSequentialStop(98, 100, 0.9, 100), 'pass');
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
