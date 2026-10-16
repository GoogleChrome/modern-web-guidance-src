import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { WORKTREE_ROOT } from './paths.ts';
import {
  deriveQualifiedGuideIds,
  JSON_QUALIFIED_GUIDE_IDS,
  QUALIFIED_GUIDE_IDS,
  TERMINAL_QUALIFIED_GUIDE_IDS,
} from './qualification.ts';

describe('qualification shipping lists (O40, O42, O64, O65)', () => {
  it('ships empty default qualification lists while judge is not admitted on unseen labels', () => {
    assert.deepStrictEqual(TERMINAL_QUALIFIED_GUIDE_IDS, []);
    assert.deepStrictEqual(JSON_QUALIFIED_GUIDE_IDS, []);
    assert.deepStrictEqual(QUALIFIED_GUIDE_IDS, []);
  });

  it('guarantees shipping lists cannot contradict final scorecard (O64)', async () => {
    const finalScorecardPath = join(
      WORKTREE_ROOT,
      'analyzer-internal/findings/2026-10-16-gitmirror-final-scorecard.json',
    );
    const raw = await readFile(finalScorecardPath, 'utf8');
    const scorecard = JSON.parse(raw) as {
      guides: Array<{
        guideId: string;
        totalFindings: number;
        precision: number;
        wilson95: { lower: number };
        phase1Findings?: number;
        phase1Precision?: number;
        phase1Wilson95?: { lower: number };
      }>;
    };

    // Find all guides that failed the final held-out bar (wilson95.lower < 0.90)
    const failedOnFinal = scorecard.guides.filter((g) => g.wilson95.lower < 0.90);
    const failedGuideIds = new Set(failedOnFinal.map((g) => g.guideId));

    // animate-element-entry-exit is known to have failed final (46/58 = 79.3%, lower bound 0.672)
    assert.ok(
      failedGuideIds.has('animate-element-entry-exit'),
      'animate-element-entry-exit must be recognized as having failed final',
    );

    // Verify that NO failed guide is in shipping qualification lists
    for (const gid of failedGuideIds) {
      assert.strictEqual(
        TERMINAL_QUALIFIED_GUIDE_IDS.includes(gid),
        false,
        `Failing guide "${gid}" must NOT be in TERMINAL_QUALIFIED_GUIDE_IDS`,
      );
      assert.strictEqual(
        JSON_QUALIFIED_GUIDE_IDS.includes(gid),
        false,
        `Failing guide "${gid}" must NOT be in JSON_QUALIFIED_GUIDE_IDS`,
      );
    }
  });

  it('deriveQualifiedGuideIds returns empty lists when judge is unadmitted', () => {
    const derived = deriveQualifiedGuideIds({
      judgeAdmitted: false,
      judgeAlpha: -0.099,
      guides: [
        {
          guideId: 'individual-transform-properties',
          totalFindings: 95,
          precision: 0.989,
          wilson95: { proportion: 0.989, lower: 0.943, upper: 0.998, n: 95 },
          phase1Findings: 97,
          phase1Precision: 0.979,
          phase1Wilson95: { proportion: 0.979, lower: 0.928, upper: 0.994, n: 97 },
        },
      ],
    });
    assert.deepStrictEqual(derived.terminalQualified, []);
    assert.deepStrictEqual(derived.jsonQualified, []);
  });

  it('deriveQualifiedGuideIds qualifies only guides clearing 0.90 LB at n>=35 when judge is admitted', () => {
    const derived = deriveQualifiedGuideIds({
      judgeAdmitted: true,
      judgeAlpha: 0.75,
      guides: [
        {
          guideId: 'individual-transform-properties',
          totalFindings: 95,
          precision: 0.989,
          wilson95: { proportion: 0.989, lower: 0.943, upper: 0.998, n: 95 },
          phase1Findings: 97,
          phase1Precision: 0.979,
          phase1Wilson95: { proportion: 0.979, lower: 0.928, upper: 0.994, n: 97 },
        },
        {
          guideId: 'animate-element-entry-exit',
          totalFindings: 58,
          precision: 0.793,
          wilson95: { proportion: 0.793, lower: 0.672, upper: 0.878, n: 58 },
          phase1Findings: 58,
          phase1Precision: 0.759,
          phase1Wilson95: { proportion: 0.759, lower: 0.646, upper: 0.852, n: 58 },
        },
      ],
    });
    assert.deepStrictEqual(derived.terminalQualified, ['individual-transform-properties']);
    assert.deepStrictEqual(derived.jsonQualified, ['individual-transform-properties']);
  });
});
