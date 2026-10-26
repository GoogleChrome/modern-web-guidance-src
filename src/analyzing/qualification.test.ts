import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isGuideQualified,
  QUALIFIED_GUIDE_IDS,
  SUSPENDED_QUALIFIED_GUIDE_IDS,
} from './qualification.ts';

describe('qualification shipping lists', () => {
  it('maintains default shipping guides clearing qualification standard', () => {
    assert.ok(QUALIFIED_GUIDE_IDS.length > 0, 'Must have at least one qualified guide');
    for (const gid of QUALIFIED_GUIDE_IDS) {
      assert.strictEqual(
        isGuideQualified(gid),
        true,
        `Guide ${gid} in QUALIFIED_GUIDE_IDS must return true from isGuideQualified`,
      );
      assert.strictEqual(
        SUSPENDED_QUALIFIED_GUIDE_IDS.includes(gid),
        false,
        `Qualified guide ${gid} must NOT be in SUSPENDED_QUALIFIED_GUIDE_IDS`,
      );
    }
  });

  it('records suspended guides separately from qualified shipping list', () => {
    assert.ok(SUSPENDED_QUALIFIED_GUIDE_IDS.length > 0, 'Must have suspended guides');
    for (const gid of SUSPENDED_QUALIFIED_GUIDE_IDS) {
      assert.strictEqual(
        QUALIFIED_GUIDE_IDS.includes(gid),
        false,
        `Suspended guide ${gid} must NOT be in QUALIFIED_GUIDE_IDS`,
      );
      assert.strictEqual(
        isGuideQualified(gid),
        false,
        `Suspended guide ${gid} must return false from isGuideQualified`,
      );
    }
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
