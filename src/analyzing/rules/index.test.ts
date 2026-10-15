import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PILOT_RULES, ALL_RULES } from './index.ts';

describe('rules/index export registry', () => {
  it('exports PILOT_RULES containing all 18 rules across the 16 guides', () => {
    assert.strictEqual(PILOT_RULES.length, 18);
    assert.strictEqual(ALL_RULES.length, 18);

    const guideIds = new Set(PILOT_RULES.map((r) => r.guideId));
    assert.deepStrictEqual(
      Array.from(guideIds).sort(),
      [
        'accessible-error-announcement',
        'animate-element-entry-exit',
        'animate-to-intrinsic-sizes',
        'autofill-sign-in-form',
        'brand-consistent-forms',
        'break-up-long-tasks',
        'calculate-event-differentials',
        'child-state-based-styling',
        'coordinate-global-events',
        'customize-scrollbar-color-and-thickness',
        'declarative-dialog-popover-control',
        'form-fields-automatically-fit-contents',
        'ime-safe-enter-submit',
        'individual-transform-properties',
        'resilient-context-menus-and-nested-dropdowns',
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
});
