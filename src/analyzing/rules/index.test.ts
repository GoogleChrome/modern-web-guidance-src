import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PILOT_RULES,
  ALL_RULES,
  QUALIFIED_GUIDE_IDS,
  QUALIFIED_RULES,
  TERMINAL_QUALIFIED_GUIDE_IDS,
  TERMINAL_QUALIFIED_RULES,
  JSON_QUALIFIED_GUIDE_IDS,
  JSON_QUALIFIED_RULES,
  POST_SELECTION_TUNED_GUIDE_IDS,
} from './index.ts';

describe('rules/index export registry', () => {
  it('exports PILOT_RULES containing 49 rules across the 37 active feature guides', async (t) => {
    assert.strictEqual(PILOT_RULES.length, 49);
    assert.strictEqual(ALL_RULES.length, 49);

    const guideIds = new Set(PILOT_RULES.map((r) => r.guideId));
    assert.strictEqual(guideIds.size, 37);
    assert.deepStrictEqual(
      Array.from(guideIds).sort(),
      [
        'animate-element-entry-exit',
        'animate-to-intrinsic-sizes',
        'atrule-support-conditionals',
        'autofill-address-form',
        'autofill-sign-in-form',
        'branded-select-styling',
        'break-up-long-tasks',
        'calculate-event-differentials',
        'capture-location-agnostic-data',
        'checkbox',
        'child-state-based-styling',
        'coordinate-global-events',
        'customize-scrollbar-color-and-thickness',
        'dark-mode',
        'declarative-dialog-popover-control',
        'defer-work-until-scroll-ends',
        'detect-initial-visibility-state',
        'drag',
        'equal-width-text-lines',
        'form-fields-automatically-fit-contents',
        'format-human-readable-durations',
        'highlight-text-ranges',
        'ime-safe-enter-submit',
        'improve-next-page-load-performance',
        'individual-transform-properties',
        'language-detection',
        'light-dismiss-a-dialog',
        'manage-recurring-intervals',
        'prevent-page-scroll-under-modal-dialog',
        'resolution-optimized-pseudo-elements',
        'responsive-table',
        'sanitize-untrusted-html',
        'scroll-entry-exit-effects',
        'scroll-position-aware-elements',
        'scrollspy',
        'size-aware-styling',
        'support-global-calendar-systems',
      ].sort(),
    );

    for (const rule of PILOT_RULES) {
      await t.test(`validates rule ${rule.id}`, () => {
        assert.ok(rule.id, 'rule has id');
        assert.ok(rule.guideId, 'rule has guideId');
        assert.ok(rule.guideHash, 'rule has guideHash');
        assert.strictEqual(rule.guideHash.length, 12, 'guideHash is 12 chars');
        assert.ok(rule.summary, 'rule has summary');
        assert.ok(rule.matcher, 'rule has matcher');
        assert.ok(rule.phase2Rubric.keepWhen.length > 0, 'has keepWhen');
        assert.ok(rule.phase2Rubric.dropWhen.length > 0, 'has dropWhen');
      });
    }
  });

  it('exports QUALIFIED_GUIDE_IDS and QUALIFIED_RULES empty while guides are suspended pending D-041/D-042 re-validation (O6, R32.5, R33)', async () => {
    assert.strictEqual(QUALIFIED_GUIDE_IDS.length, 0);
    assert.deepStrictEqual(QUALIFIED_GUIDE_IDS, []);
    assert.deepStrictEqual(TERMINAL_QUALIFIED_GUIDE_IDS, QUALIFIED_GUIDE_IDS);
    assert.deepStrictEqual(JSON_QUALIFIED_GUIDE_IDS, QUALIFIED_GUIDE_IDS);
    assert.deepStrictEqual(TERMINAL_QUALIFIED_RULES, QUALIFIED_RULES);
    assert.deepStrictEqual(JSON_QUALIFIED_RULES, QUALIFIED_RULES);
    assert.strictEqual(QUALIFIED_RULES.length, 0);

    const qualifiedGuideSet = new Set(QUALIFIED_GUIDE_IDS);
    assert.strictEqual(qualifiedGuideSet.size, 0);
  });

  it('exports POST_SELECTION_TUNED_GUIDE_IDS', () => {
    assert.deepStrictEqual(POST_SELECTION_TUNED_GUIDE_IDS, [
      'manage-recurring-intervals',
      'calculate-event-differentials',
      'checkbox',
      'declarative-dialog-popover-control',
    ]);
  });
});
