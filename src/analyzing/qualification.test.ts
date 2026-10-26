import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isGuideQualified,
  QUALIFIED_GUIDE_IDS,
  SUSPENDED_QUALIFIED_GUIDE_IDS,
} from './qualification.ts';

describe('qualification shipping lists', () => {
  it('maintains 6 default shipping guides under Static Matcher Precision >= 90.0% at n >= 20', () => {
    assert.strictEqual(QUALIFIED_GUIDE_IDS.length, 6);
    assert.deepStrictEqual(QUALIFIED_GUIDE_IDS, [
      'autofill-address-form',
      'autofill-sign-in-form',
      'form-fields-automatically-fit-contents',
      'responsive-table',
      'scroll-entry-exit-effects',
      'scrollspy',
    ]);
  });

  it('records the 4 suspended guides', () => {
    assert.deepStrictEqual(SUSPENDED_QUALIFIED_GUIDE_IDS, [
      'autofill-highlight-inputs',
      'complex-shapes',
      'interactions-in-complex-layouts',
      'language-detection',
    ]);
  });

  it('guarantees shipping lists cannot include experimental or suspended guides', () => {
    const nonQualified = [
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
      'styling-web-components',
      'custom-text-decorations',
      'checkbox',
      'equal-width-text-lines',
      'prevent-page-scroll-under-modal-dialog',
      'autofill-payment-form',
      'select-menu-interaction',
      'branded-select-styling',
      'ime-safe-enter-submit',
    ];
    for (const gid of nonQualified) {
      assert.strictEqual(
        QUALIFIED_GUIDE_IDS.includes(gid),
        false,
        `Experimental guide "${gid}" must NOT be in QUALIFIED_GUIDE_IDS`,
      );
      assert.strictEqual(
        isGuideQualified(gid),
        false,
        `Experimental guide "${gid}" must NOT be isGuideQualified`,
      );
    }
    assert.strictEqual(isGuideQualified('responsive-table'), true);
  });
});
