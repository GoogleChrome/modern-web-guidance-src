import { describe, it } from 'node:test';
import assert from 'node:assert';

import { resolveFeatureId, getStatus, getBaselineStatus, checkBaseline, getStatusMessage, validateFeature } from './baseline.js';
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
      expect(getStatusMessage('non-existent')).toBeUndefined();
      expect(getStatusMessage('grid', 'unknown.key')).toBeUndefined();
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
        errorMessage: 'Web feature ID "non-existent-feature" not found in web-features package'
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
      expect(resolveFeatureId('grid')).toEqual(['grid']);
    });

    it('returns empty array for unknown feature', () => {
      expect(resolveFeatureId('unknown-feature-xyz')).toEqual([]);
    });

    it('resolves moved feature ID', () => {
      expect(resolveFeatureId('numeric-seperators')).toEqual(['numeric-separators']);
    });

    it('resolves split feature ID', () => {
      const resolved = resolveFeatureId('single-color-gradients');
      expect(resolved).toContain('gradients');
      expect(resolved).toContain('conic-gradients');
      expect(resolved.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getStatus', () => {
    it('gets status for known bcd key', () => {
      const status = getStatus('grid', 'css.properties.grid-template-columns');
      expect(status).toBeDefined();
      expect(status?.baseline).toBeDefined();
    });

    it('gets status without feature ID (slow path)', () => {
      const status = getStatus(undefined, 'css.properties.grid-template-columns');
      expect(status).toBeDefined();
    });

    it('returns undefined for unknown key', () => {
      const status = getStatus('grid', 'unknown.key.xyz');
      expect(status).toBeUndefined();
    });
  });

  describe('checkBaseline', () => {
    it('supports standard statuses', () => {
      expect(checkBaseline('Widely', 'grid')).toBe(true);
      expect(checkBaseline('Newly', 'grid')).toBe(true);
      expect(checkBaseline('Limited', 'grid')).toBe(true);

      expect(checkBaseline('Widely', 'non-existent-feature')).toBe(false);
      expect(checkBaseline('Limited', 'non-existent-feature')).toBe(true);
    });

    it('supports case-insensitive standard statuses', () => {
      expect(checkBaseline('widely', 'grid')).toBe(true);
      expect(checkBaseline('baseline newly', 'grid')).toBe(true);
    });

    it('supports Baseline YYYY format', () => {
      expect(checkBaseline('Baseline 2017', 'grid')).toBe(true);
      expect(checkBaseline('Baseline 2016', 'grid')).toBe(false);
    });

    it('supports Baseline Widely available on YYYY-MM-DD format', () => {
      expect(checkBaseline('Baseline Widely available on 2020-04-17', 'grid')).toBe(true);
      expect(checkBaseline('Baseline Widely available on 2020-04-16', 'grid')).toBe(false);
      expect(checkBaseline('Baseline Widely available on 2024-01-01', 'grid')).toBe(true);
    });

    it('returns false for features without necessary dates', () => {
      expect(checkBaseline('Baseline 2025', 'non-existent-feature')).toBe(false);
      expect(checkBaseline('Baseline Widely available on 2025-01-01', 'non-existent-feature')).toBe(false);
    });

  });
});
