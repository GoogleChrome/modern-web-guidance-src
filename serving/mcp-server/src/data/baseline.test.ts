import { describe, it, expect, vi } from 'vitest';
import { resolveFeatureId, getStatus, getBaselineStatus, checkBaseline } from './baseline.js';

describe('baseline data', () => {
  describe('getBaselineStatus', () => {
    it('returns Baseline since YYYY-MM-DD for known widely available features', () => {
      // grid low_date is 2017-10-17
      expect(getBaselineStatus('grid')).toBe('Baseline since 2017-10-17');
    });

    it('returns aggregate status for split feature', () => {
      // single-color-gradients -> [gradients, conic-gradients]
      // gradients: 2018-09-07 or similar (High)
      // conic-gradients: 2021-11-20 or similar (Newer)
      // Expect the LATER date
      const status = getBaselineStatus('single-color-gradients');
      expect(status).toMatch(/^Baseline since \d{4}-\d{2}-\d{2}$/);
      expect(status).not.toBe('Limited availability');
      // We know it should be at least 2020 if it includes conic-gradients
    });

    it('returns undefined for unknown features', () => {
      expect(getBaselineStatus('non-existent-feature')).toBeUndefined();
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
      // grid is Widely
      expect(checkBaseline('Widely', 'grid')).toBe(true);
      expect(checkBaseline('Newly', 'grid')).toBe(true);
      expect(checkBaseline('Limited', 'grid')).toBe(true);

      // non-existent is Limited
      expect(checkBaseline('Widely', 'non-existent-feature')).toBe(false);
      expect(checkBaseline('Limited', 'non-existent-feature')).toBe(true);
    });

    it('supports case-insensitive standard statuses', () => {
      expect(checkBaseline('widely', 'grid')).toBe(true);
      expect(checkBaseline('baseline newly', 'grid')).toBe(true);
    });

    it('supports Baseline YYYY format', () => {
      // grid low_date is 2017-10-17
      // Baseline 2016 -> cutoff 2017-01-01 -> 2017 > 2017-01-01? No, 2017-10-17 > 2017-01-01.
      // Wait, "Baseline 2025" refers to all features that were AT LEAST Newly available at the start of the following year, January 1, 2026.
      // So Baseline YYYY means baseline_low_date <= (YYYY+1)-01-01.

      // grid low_date: 2017-10-17
      // Baseline 2016 -> cutoff 2017-01-01. 2017-10-17 <= 2017-01-01 is FALSE.
      // Baseline 2017 -> cutoff 2018-01-01. 2017-10-17 <= 2018-01-01 is TRUE.

      expect(checkBaseline('Baseline 2017', 'grid')).toBe(true);
      expect(checkBaseline('Baseline 2016', 'grid')).toBe(false);
    });

    it('supports Baseline Widely available on YYYY-MM-DD format', () => {
      // grid high_date is 2020-04-17

      expect(checkBaseline('Baseline Widely available on 2020-04-17', 'grid')).toBe(true);
      expect(checkBaseline('Baseline Widely available on 2020-04-16', 'grid')).toBe(false);
      expect(checkBaseline('Baseline Widely available on 2024-01-01', 'grid')).toBe(true);
    });

    it('returns false for features without necessary dates', () => {
      // non-existent features don't have dates
      expect(checkBaseline('Baseline 2025', 'non-existent-feature')).toBe(false);
      expect(checkBaseline('Baseline Widely available on 2025-01-01', 'non-existent-feature')).toBe(false);
    });

    it('calculates Widely status relative to current date', () => {
      // grid low_date is 2017-10-17

      // 1. Set date to shortly after release (Newly, not Widely)
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2018-01-01')); // < 30 months after 2017-10-17

      expect(checkBaseline('Widely', 'grid')).toBe(false);
      expect(checkBaseline('Newly', 'grid')).toBe(true);

      // 2. Set date to long after release (Widely)
      vi.setSystemTime(new Date('2022-01-01')); // > 30 months after 2017-10-17
      expect(checkBaseline('Widely', 'grid')).toBe(true);

      vi.useRealTimers();
    });
  });
});
