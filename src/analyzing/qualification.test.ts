import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isGuideQualified,
  QUALIFIED_GUIDE_IDS,
  SUSPENDED_QUALIFIED_GUIDE_IDS,
} from './qualification.ts';

describe('qualification shipping lists (O40, O42, O64, O65, O6, D-041, D-042, D-045, D-046, D-048)', () => {
  it('maintains 37 default shipping guides under D-048 graduation criteria', () => {
    assert.strictEqual(QUALIFIED_GUIDE_IDS.length, 37);
    assert.deepStrictEqual(QUALIFIED_GUIDE_IDS, [
      'animate-element-entry-exit',
      'animate-to-intrinsic-sizes',
      'atrule-support-conditionals',
      'autofill-address-form',
      'autofill-sign-in-form',
      'branded-select-styling',
      'calculate-event-differentials',
      'capture-location-agnostic-data',
      'checkbox',
      'custom-text-decorations',
      'customize-scrollbar-color-and-thickness',
      'dark-mode',
      'deliver-optimized-decorative-images',
      'drag',
      'equal-width-text-lines',
      'export-html-media-from-canvas',
      'form-fields-automatically-fit-contents',
      'highlight-text-ranges',
      'improve-next-page-load-performance',
      'improve-text-layout-and-legibility',
      'individual-transform-properties',
      'interactions-in-complex-layouts',
      'language-detection',
      'light-dismiss-a-dialog',
      'platform-controls-dismiss-dialog',
      'prevent-page-scroll-under-modal-dialog',
      'responsive-table',
      'sanitize-untrusted-html',
      'scroll-entry-exit-effects',
      'scroll-position-aware-elements',
      'scroll-progress-indicator',
      'scrollspy',
      'soft-edge-content-fade',
      'state-aware-sticky-headers',
      'styling-web-components',
      'support-global-calendar-systems',
      'switch',
    ]);
  });

  it('records the 2 suspended guides (D-041, D-042, D-048)', () => {
    assert.deepStrictEqual(SUSPENDED_QUALIFIED_GUIDE_IDS, [
      'autofill-highlight-inputs',
      'complex-shapes',
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
      'ime-safe-enter-submit',
      'child-state-based-styling',
      'declarative-dialog-popover-control',
      'size-aware-styling',
      'resolution-optimized-pseudo-elements',
      'optimize-image-priority',
      'select-menu-interaction',
      'lazy-load-video-and-audio',
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
