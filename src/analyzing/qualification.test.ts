import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isGuideQualified,
  QUALIFIED_GUIDE_IDS,
  SUSPENDED_QUALIFIED_GUIDE_IDS,
} from './qualification.ts';

describe('qualification shipping lists (O40, O42, O64, O65, O6, D-041, D-042, D-045, D-046, D-048)', () => {
  it('maintains 15 default shipping guides under D-048 graduation criteria', () => {
    assert.strictEqual(QUALIFIED_GUIDE_IDS.length, 15);
    assert.deepStrictEqual(QUALIFIED_GUIDE_IDS, [
      'autofill-address-form',
      'autofill-payment-form',
      'autofill-sign-in-form',
      'branded-select-styling',
      'checkbox',
      'custom-text-decorations',
      'equal-width-text-lines',
      'form-fields-automatically-fit-contents',
      'ime-safe-enter-submit',
      'prevent-page-scroll-under-modal-dialog',
      'responsive-table',
      'scroll-entry-exit-effects',
      'scrollspy',
      'select-menu-interaction',
      'styling-web-components',
    ]);
  });

  it('records the 4 suspended guides (D-041, D-042, D-048)', () => {
    assert.deepStrictEqual(SUSPENDED_QUALIFIED_GUIDE_IDS, [
      'autofill-highlight-inputs',
      'complex-shapes',
      'interactions-in-complex-layouts',
      'language-detection',
    ]);
  });

  it('guarantees shipping lists cannot include ungraduated or suspended guides (O64, D-048)', () => {
    const nonGraduated = [
      'autofill-highlight-inputs',
      'complex-shapes',
      'coordinate-global-events',
      'break-up-long-tasks',
      'detect-initial-visibility-state',
      'defer-work-until-scroll-ends',
      'child-state-based-styling',
      'declarative-dialog-popover-control',
      'size-aware-styling',
      'resolution-optimized-pseudo-elements',
      'optimize-image-priority',
      'lazy-load-video-and-audio',
      'interactions-in-complex-layouts',
      'language-detection',
      'individual-transform-properties',
      'dark-mode',
      'calculate-event-differentials',
    ];
    for (const gid of nonGraduated) {
      assert.strictEqual(
        QUALIFIED_GUIDE_IDS.includes(gid),
        false,
        `Non-graduated guide "${gid}" must NOT be in QUALIFIED_GUIDE_IDS`,
      );
      assert.strictEqual(
        isGuideQualified(gid),
        false,
        `Non-graduated guide "${gid}" must NOT be isGuideQualified`,
      );
    }
    assert.strictEqual(isGuideQualified('responsive-table'), true);
  });
});
