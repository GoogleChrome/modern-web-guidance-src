import { describe, it } from 'node:test';
import assert from 'node:assert';

import { resolveFeatureId, getStatus, getBaselineStatus, checkBaseline, getStatusMessage, validateFeature } from './baseline.ts';
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
      assert.strictEqual(getStatusMessage('grid'), 'Grid is Widely. It\'s been Baseline since 2017-10-17.');
    });

    it('returns status message for a BCD key', () => {
      assert.strictEqual(getStatusMessage('grid', 'css.properties.grid-template-columns'), 'The css.properties.grid-template-columns capability is Widely. It\'s been Baseline since 2017-10-17.');
    });

    it('returns status message for a non-Baseline feature', () => {
      assert.strictEqual(getStatusMessage('accelerometer'), 'Accelerometer is Limited.');
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

