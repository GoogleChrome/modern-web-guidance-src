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
  it('exports PILOT_RULES containing 40 rules across the 29 active feature guides (O69, O38 retired 4)', async (t) => {
    assert.strictEqual(PILOT_RULES.length, 40);
    assert.strictEqual(ALL_RULES.length, 40);

    const guideIds = new Set(PILOT_RULES.map((r) => r.guideId));
    assert.strictEqual(guideIds.size, 29);
    assert.deepStrictEqual(
      Array.from(guideIds).sort(),
      [
        'adapt-scrollbar-to-contrast-preferences',
        'animate-element-entry-exit',
        'animate-to-intrinsic-sizes',
        'autofill-address-form',
        'autofill-sign-in-form',
        'brand-consistent-forms',
        'branded-select-styling',
        'break-up-long-tasks',
        'calculate-event-differentials',
        'checkbox',
        'child-state-based-styling',
        'coordinate-global-events',
        'customize-scrollbar-color-and-thickness',
        'dark-mode',
        'declarative-dialog-popover-control',
        'defer-work-until-scroll-ends',
        'drag',
        'form-fields-automatically-fit-contents',
        'format-human-readable-durations',
        'ime-safe-enter-submit',
        'individual-transform-properties',
        'manage-recurring-intervals',
        'prevent-page-scroll-under-modal-dialog',
        'resilient-context-menus-and-nested-dropdowns',
        'sanitize-untrusted-html',
        'schedule-tasks-by-priority',
        'scroll-position-aware-elements',
        'scrollspy',
        'size-aware-styling',
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

  it('exports QUALIFIED_GUIDE_IDS and QUALIFIED_RULES empty while judge is unadmitted (R32.5, R33, O40, O60, O64)', async () => {
    assert.strictEqual(QUALIFIED_GUIDE_IDS.length, 0);
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
