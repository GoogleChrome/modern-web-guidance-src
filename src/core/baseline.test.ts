import { describe, it } from 'node:test';
import assert from 'node:assert';

import { resolveFeatureId, getStatus, getBaselineStatus, checkBaseline, getStatusMessage, validateFeature, getFeatureGroups, getOwnedFeatureToGroups, pendingFeatures } from './baseline.ts';
describe('baseline data', () => {
  describe('getBaselineStatus', () => {
    it('returns Baseline since YYYY-MM-DD for known widely available features', () => {
      assert.strictEqual(getBaselineStatus('grid'), 'Baseline since 2017-10-17');
    });

    it('returns aggregate status for split feature', () => {
      const status = getBaselineStatus('single-color-gradients');
      assert.match(status!, /^Baseline since \d{4}-\d{2}-\d{2}$/);
      assert.notStrictEqual(status, 'Limited');
    });

    it('returns undefined for unknown features', () => {
      assert.strictEqual(getBaselineStatus('non-existent-feature'), undefined);
    });
  });

  describe('getStatusMessage', () => {
    it('returns status message for a feature', () => {
      assert.strictEqual(
        getStatusMessage('grid'),
        "Baseline status for Grid: Widely available. It's been Baseline since 2017-10-17.\nSupported by: Chrome 57 (Mar 2017), Edge 16 (Oct 2017), Firefox 52 (Mar 2017), Safari 10.1 (Mar 2017), and Safari iOS 10.3 (Mar 2017)."
      );
    });

    it('returns status message for a BCD key', () => {
      assert.strictEqual(
        getStatusMessage('grid', 'css.properties.grid-template-columns'),
        "Baseline status for the css.properties.grid-template-columns capability: Widely available. It's been Baseline since 2017-10-17.\nSupported by: Chrome 57 (Mar 2017), Edge 16 (Oct 2017), Firefox 52 (Mar 2017), Safari 10.1 (Mar 2017), and Safari iOS 10.3 (Mar 2017)."
      );
    });

    it('returns status message explicitly isolating mobile target when mobile support diverges', () => {
      assert.strictEqual(
        getStatusMessage('popover'),
        "Baseline status for Popover: Newly available. It's been Baseline since 2025-01-27.\nSupported by: Chrome 116 (Aug 2023), Edge 116 (Aug 2023), Firefox 125 (Apr 2024), Safari 17 (Sep 2023), and Safari iOS 18.3 (Jan 2025)."
      );
    });

    it('returns status message for a non-Baseline feature', () => {
      assert.strictEqual(
        getStatusMessage('accelerometer'),
        "Browser support for Accelerometer: Limited availability.\nSupported by: Chrome 91 (May 2021) and Edge 91 (May 2021).\nUnsupported in: Firefox and Safari."
      );
    });

    it('distinguishes partial anchor-positioning support from full support', () => {
      const message = getStatusMessage('anchor-positioning')!;
      assert.match(message, /Limited availability/);
      assert.match(message, /\nSupported by: Safari 27\./);
      assert.match(message, /\nPartially supported by: Chrome, Edge, and Firefox\./);
      assert.doesNotMatch(message, /Unsupported in:/);
    });

    it('reports partial support when no browser supports the whole feature', () => {
      const message = getStatusMessage('display-contents')!;
      assert.match(message, /\nPartially supported by: Chrome, Edge, Firefox, and Safari\./);
      assert.doesNotMatch(message, /not natively supported|Unsupported in:/);
    });

    it('still identifies unsupported browsers alongside partial support', () => {
      const message = getStatusMessage('network-information')!;
      assert.match(message, /\nPartially supported by: Chrome and Edge\./);
      assert.match(message, /\nUnsupported in: Firefox and Safari\./);
      assert.doesNotMatch(message, /not natively supported/);
    });

    it('keeps individual capabilities separate from whole-feature partial support', () => {
      const message = getStatusMessage('anchor-positioning', 'css.properties.anchor-name')!;
      assert.match(message, /Baseline status for the css\.properties\.anchor-name capability: Newly available/);
      assert.match(message, /Supported by: Chrome 125/);
      assert.doesNotMatch(message, /Partially supported by:|Unsupported in:/);
    });

    it('returns status message for a zero-support feature', () => {
      assert.strictEqual(
        getStatusMessage('declarative-webmcp'),
        "Form-associated WebMCP attributes is not natively supported by any major browser yet."
      );
    });

    it('returns undefined for unknown features or keys', () => {
      assert.strictEqual(getStatusMessage('non-existent'), undefined);
      assert.strictEqual(getStatusMessage('grid', 'unknown.key'), undefined);
    });
  });



  describe('validateFeature', () => {
    it('returns valid for a standard feature', () => {
      assert.deepStrictEqual(validateFeature('grid'), { isValid: true });
    });

    it('returns error for a non-existent feature', () => {
      assert.deepStrictEqual(validateFeature('non-existent-feature'), {
        isValid: false,
        error: 'not_found',
        errorMessage: 'Web feature ID "non-existent-feature" not found in web-features package. Use "gd baselinestatus <keyword>" to find the correct ID.'
      });
    });

    it('returns error and suggestion for a moved feature', () => {
      const result = validateFeature('numeric-seperators');
      assert.deepStrictEqual(result, {
        isValid: false,
        error: 'invalid_kind',
        kind: 'moved',
        suggestion: 'numeric-separators',
        errorMessage: 'Web feature ID "numeric-seperators" is a moved record, not a primary feature (It has been moved to "numeric-separators")'
      });
    });

    it('returns error and suggestion for a split feature', () => {
      const result = validateFeature('single-color-gradients');
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.error, 'invalid_kind');
      assert.strictEqual(result.kind, 'split');
      assert.ok(result.suggestion!.includes('gradients')); // It might contain multiple targets
      assert.ok(result.errorMessage!.includes('is a split record, not a primary feature'));
    });

    it('returns valid for a registered pending temporary feature ID', () => {
      pendingFeatures['tmp-mock-feature'] = {
        issue: 'https://github.com/web-platform-dx/web-features/issues/99999'
      };
      try {
        assert.deepStrictEqual(validateFeature('tmp-mock-feature'), { isValid: true });
      } finally {
        delete pendingFeatures['tmp-mock-feature'];
      }
    });

    it('returns error for an unregistered temporary feature ID', () => {
      const result = validateFeature('tmp-pending-feature-xyz');
      assert.deepStrictEqual(result, {
        isValid: false,
        error: 'unregistered_temp_feature',
        errorMessage: 'Temporary web feature ID "tmp-pending-feature-xyz" is not registered in features/pending-web-features.json. Please register it with an upstream issue link.'
      });
    });
  });

  describe('getFeatureGroups', () => {
    it('includes ancestor groups for web-features entries', () => {
      assert.ok(getFeatureGroups('scroll-markers').includes('scrolling'));
    });

    it('reads groups from pending temporary feature entries', () => {
      pendingFeatures['tmp-mock-grouped'] = {
        issue: 'https://github.com/web-platform-dx/web-features/issues/99999',
        group: 'scrolling'
      };
      try {
        assert.deepStrictEqual(getFeatureGroups('tmp-mock-grouped'), ['scrolling']);
      } finally {
        delete pendingFeatures['tmp-mock-grouped'];
      }
    });

    it('returns empty array for pending entries without a group', () => {
      pendingFeatures['tmp-mock-ungrouped'] = {
        issue: 'https://github.com/web-platform-dx/web-features/issues/99998'
      };
      try {
        assert.deepStrictEqual(getFeatureGroups('tmp-mock-ungrouped'), []);
      } finally {
        delete pendingFeatures['tmp-mock-ungrouped'];
      }
    });
  });

  describe('getOwnedFeatureToGroups', () => {
    it('includes pending temporary features in owned groups', () => {
      pendingFeatures['tmp-mock-grouped'] = {
        issue: 'https://github.com/web-platform-dx/web-features/issues/99999',
        group: 'scrolling'
      };
      pendingFeatures['tmp-mock-ungrouped'] = {
        issue: 'https://github.com/web-platform-dx/web-features/issues/99998'
      };
      try {
        const result = getOwnedFeatureToGroups(new Set(['scrolling']));
        assert.deepStrictEqual(result['tmp-mock-grouped'], ['scrolling']);
        assert.strictEqual(result['tmp-mock-ungrouped'], undefined);
      } finally {
        delete pendingFeatures['tmp-mock-grouped'];
        delete pendingFeatures['tmp-mock-ungrouped'];
      }
    });
  });

  describe('resolveFeatureId', () => {
    it('resolves simple feature ID', () => {
      assert.deepStrictEqual(resolveFeatureId('grid'), ['grid']);
    });

    it('returns empty array for unknown feature', () => {
      assert.deepStrictEqual(resolveFeatureId('unknown-feature-xyz'), []);
    });

    it('resolves moved feature ID', () => {
      assert.deepStrictEqual(resolveFeatureId('numeric-seperators'), ['numeric-separators']);
    });

    it('resolves split feature ID', () => {
      const resolved = resolveFeatureId('single-color-gradients');
      assert.ok(resolved.includes('gradients'));
      assert.ok(resolved.includes('conic-gradients'));
      assert.ok(resolved.length >= 2);
    });
  });

  describe('getStatus', () => {
    it('gets status for known bcd key', () => {
      const status = getStatus('grid', 'css.properties.grid-template-columns');
      assert.ok(status !== undefined);
      assert.ok(status?.baseline !== undefined);
    });

    it('gets status without feature ID (slow path)', () => {
      const status = getStatus(undefined, 'css.properties.grid-template-columns');
      assert.ok(status !== undefined);
    });

    it('returns undefined for unknown key', () => {
      const status = getStatus('grid', 'unknown.key.xyz');
      assert.strictEqual(status, undefined);
    });
  });

  describe('checkBaseline', () => {
    it('supports standard statuses', () => {
      assert.strictEqual(checkBaseline('Widely', 'grid'), true);
      assert.strictEqual(checkBaseline('Newly', 'grid'), true);
      assert.strictEqual(checkBaseline('Limited', 'grid'), true);

      assert.strictEqual(checkBaseline('Widely', 'non-existent-feature'), false);
      assert.strictEqual(checkBaseline('Limited', 'non-existent-feature'), true);
    });

    it('supports case-insensitive standard statuses', () => {
      assert.strictEqual(checkBaseline('widely', 'grid'), true);
      assert.strictEqual(checkBaseline('baseline newly', 'grid'), true);
    });

    it('supports Baseline YYYY format', () => {
      assert.strictEqual(checkBaseline('Baseline 2017', 'grid'), true);
      assert.strictEqual(checkBaseline('Baseline 2016', 'grid'), false);
    });

    it('supports Baseline Widely available on YYYY-MM-DD format', () => {
      assert.strictEqual(checkBaseline('Baseline Widely available on 2020-04-17', 'grid'), true);
      assert.strictEqual(checkBaseline('Baseline Widely available on 2020-04-16', 'grid'), false);
      assert.strictEqual(checkBaseline('Baseline Widely available on 2024-01-01', 'grid'), true);
    });

    it('returns false for features without necessary dates', () => {
      assert.strictEqual(checkBaseline('Baseline 2025', 'non-existent-feature'), false);
      assert.strictEqual(checkBaseline('Baseline Widely available on 2025-01-01', 'non-existent-feature'), false);
    });

  });
});

