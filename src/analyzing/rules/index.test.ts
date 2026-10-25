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
  it('exports PILOT_RULES containing 98 rules across the 71 active feature guides', async (t) => {
    assert.strictEqual(PILOT_RULES.length, 98);
    assert.strictEqual(ALL_RULES.length, 98);

    const guideIds = new Set(PILOT_RULES.map((r) => r.guideId));
    assert.strictEqual(guideIds.size, 71);
    assert.deepStrictEqual(
      Array.from(guideIds).sort(),
      [
        'anchor-positioning-tab-underline',
        'animate-element-entry-exit',
        'animate-to-from-top-layer',
        'animate-to-intrinsic-sizes',
        'atrule-support-conditionals',
        'autofill-address-form',
        'autofill-payment-form',
        'autofill-sign-in-form',
        'batch-analytics-events',
        'branded-select-styling',
        'break-up-long-tasks',
        'calculate-event-differentials',
        'capture-location-agnostic-data',
        'checkbox',
        'child-state-based-styling',
        'complex-shapes',
        'conditional-async-dependencies',
        'contrast-color',
        'coordinate-global-events',
        'custom-button-actions',
        'custom-select-picker-layouts',
        'custom-text-decorations',
        'customize-scrollbar-color-and-thickness',
        'dark-mode',
        'declarative-dialog-popover-control',
        'defer-work-until-scroll-ends',
        'deliver-optimized-decorative-images',
        'detect-initial-visibility-state',
        'drag',
        'equal-width-text-lines',
        'export-html-media-from-canvas',
        'form-fields-automatically-fit-contents',
        'highlight-text-ranges',
        'ime-safe-enter-submit',
        'improve-next-page-load-performance',
        'improve-text-layout-and-legibility',
        'individual-transform-properties',
        'interactions-in-complex-layouts',
        'interest-triggered-action-previews',
        'interest-triggered-tooltips',
        'language-detection',
        'lazy-load-video-and-audio',
        'light-dismiss-a-dialog',
        'menu',
        'navigation-drawer',
        'optimize-image-priority',
        'platform-controls-dismiss-dialog',
        'position-aware-tooltips',
        'precise-text-alignment',
        'prevent-page-scroll-under-modal-dialog',
        'progress-ring',
        'required-field-feedback',
        'resolution-optimized-pseudo-elements',
        'responsive-table',
        'sanitize-untrusted-html',
        'scroll-completion-effects',
        'scroll-entry-exit-effects',
        'scroll-position-aware-elements',
        'scroll-progress-indicator',
        'scroll-snap-realtime-feedback',
        'scroll-snap-state-sync',
        'scroll-target-on-load',
        'scrollability-affordance-hints',
        'scrollspy',
        'select-menu-interaction',
        'size-aware-styling',
        'soft-edge-content-fade',
        'state-aware-sticky-headers',
        'styling-web-components',
        'support-global-calendar-systems',
        'switch',
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

  it('exports QUALIFIED_GUIDE_IDS and QUALIFIED_RULES with 37 qualified guides and 53 rules (D-048)', async () => {
    assert.strictEqual(QUALIFIED_GUIDE_IDS.length, 37);
    assert.strictEqual(QUALIFIED_RULES.length, 53);
    assert.deepStrictEqual(TERMINAL_QUALIFIED_GUIDE_IDS, QUALIFIED_GUIDE_IDS);
    assert.deepStrictEqual(JSON_QUALIFIED_GUIDE_IDS, QUALIFIED_GUIDE_IDS);
    assert.deepStrictEqual(TERMINAL_QUALIFIED_RULES, QUALIFIED_RULES);
    assert.deepStrictEqual(JSON_QUALIFIED_RULES, QUALIFIED_RULES);

    const qualifiedGuideSet = new Set(QUALIFIED_GUIDE_IDS);
    assert.strictEqual(qualifiedGuideSet.size, 37);
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
