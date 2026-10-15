import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PILOT_RULES,
  ALL_RULES,
  QUALIFIED_GUIDE_IDS,
  QUALIFIED_RULES,
  POST_SELECTION_TUNED_GUIDE_IDS,
} from './index.ts';

describe('rules/index export registry', () => {
  it('exports PILOT_RULES containing all 40 rules across the 32 detectable guides', () => {
    assert.strictEqual(PILOT_RULES.length, 40);
    assert.strictEqual(ALL_RULES.length, 40);

    const guideIds = new Set(PILOT_RULES.map((r) => r.guideId));
    assert.strictEqual(guideIds.size, 32);
    assert.deepStrictEqual(
      Array.from(guideIds).sort(),
      [
        'accessible-error-announcement',
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
        'copy-button',
        'css-layout',
        'customize-scrollbar-color-and-thickness',
        'dark-mode',
        'declarative-dialog-popover-control',
        'defer-work-until-scroll-ends',
        'detect-initial-visibility-state',
        'dialog',
        'form-fields-automatically-fit-contents',
        'ime-safe-enter-submit',
        'individual-transform-properties',
        'manage-recurring-intervals',
        'prevent-page-scroll-under-modal-dialog',
        'resilient-context-menus-and-nested-dropdowns',
        'schedule-tasks-by-priority',
        'scrollspy',
        'shadow-dom',
        'size-aware-styling',
        'stack-drill-down',
      ].sort(),
    );

    for (const rule of PILOT_RULES) {
      assert.ok(rule.id, 'rule has id');
      assert.ok(rule.guideId, 'rule has guideId');
      assert.ok(rule.guideHash, 'rule has guideHash');
      assert.strictEqual(rule.guideHash.length, 12, 'guideHash is 12 chars');
      assert.ok(rule.summary, 'rule has summary');
      assert.ok(rule.matcher, 'rule has matcher');
      assert.ok(rule.phase2Rubric.keepWhen.length > 0, 'has keepWhen');
      assert.ok(rule.phase2Rubric.dropWhen.length > 0, 'has dropWhen');
    }
  });

  it('exports QUALIFIED_GUIDE_IDS and QUALIFIED_RULES with 25 guides excluding 7 experimental', () => {
    assert.strictEqual(QUALIFIED_GUIDE_IDS.length, 25);
    const qualifiedGuideSet = new Set(QUALIFIED_GUIDE_IDS);
    assert.strictEqual(qualifiedGuideSet.size, 25);

    const qualifiedRuleGuideIds = new Set(QUALIFIED_RULES.map((r) => r.guideId));
    assert.strictEqual(qualifiedRuleGuideIds.size, 25);
    assert.deepStrictEqual(Array.from(qualifiedRuleGuideIds).sort(), [...QUALIFIED_GUIDE_IDS].sort());

    // Excluded experimental guides
    const experimentalGuides = [
      'customize-scrollbar-color-and-thickness',
      'break-up-long-tasks',
      'detect-initial-visibility-state',
      'schedule-tasks-by-priority',
      'scrollspy',
      'size-aware-styling',
      'defer-work-until-scroll-ends',
    ];
    for (const exp of experimentalGuides) {
      assert.strictEqual(qualifiedGuideSet.has(exp), false, `${exp} should not be in qualified guides`);
    }

    assert.deepStrictEqual(POST_SELECTION_TUNED_GUIDE_IDS, [
      'dialog',
      'manage-recurring-intervals',
      'calculate-event-differentials',
    ]);
  });
});
