import { vi, describe, it, expect } from 'vitest';

// Mock web-features BEFORE importing replaceMacros
vi.mock('web-features', () => ({
  features: {
    'baseline-high-feature': {
      kind: 'feature',
      name: 'High Feature',
      status: { baseline: 'high', baseline_low_date: '2020-01-01' }
    },
    'baseline-low-feature': {
      kind: 'feature',
      name: 'Low Feature',
      status: { baseline: 'low', baseline_low_date: '2024-01-01' }
    },
    'no-baseline-feature': {
      kind: 'feature',
      name: 'No Baseline Feature',
      status: { baseline: false }
    },
    'split-feature': {
      kind: 'split',
      redirect_targets: ['target1', 'target2']
    }
  }
}));

// Mock baseline.ts BEFORE importing replaceMacros
vi.mock('../data/baseline.ts', () => ({
  getStatusMessage: vi.fn((featureId, bcdKey) => {
    if (bcdKey) {
      if (bcdKey === 'high-bcd') {
        return 'The high-bcd capability has been Baseline since 2015-01-01 (Widely available)';
      }
      if (bcdKey === 'low-bcd') {
        return 'The low-bcd capability has been Baseline since 2024-01-01 (Newly available)';
      }
      if (bcdKey === 'no-baseline-bcd') {
        return 'The no-baseline-bcd capability is not supported across all major browsers';
      }
      return undefined;
    }
    if (featureId === 'baseline-high-feature') {
      return 'High Feature has been Baseline since 2020-01-01 (Widely available)';
    }
    if (featureId === 'baseline-low-feature') {
      return 'Low Feature has been Baseline since 2024-01-01 (Newly available)';
    }
    if (featureId === 'no-baseline-feature') {
      return 'No Baseline Feature is not supported across all major browsers';
    }
    return undefined;
  }),
  validateFeature: vi.fn((id) => {
    if (id === 'non-existent') {
      return { isValid: false, errorMessage: 'Web feature ID "non-existent" not found' };
    }
    if (id === 'split-feature') {
      return { isValid: false, errorMessage: 'is a split record, not a primary feature' };
    }
    return { isValid: true };
  })
}));

import { replaceMacros } from './macros.ts';

describe('replaceMacros', () => {
  describe('BASELINE_STATUS', () => {
    it('replaces macro with widely available status', () => {
      const content = '{{ BASELINE_STATUS("baseline-high-feature") }}';
      const result = replaceMacros(content, 'test.md');
      expect(result).toBe('High Feature has been Baseline since 2020-01-01 (Widely available)');
    });

    it('replaces macro with newly available status', () => {
      const content = "{{ BASELINE_STATUS('baseline-low-feature') }}";
      const result = replaceMacros(content, 'test.md');
      expect(result).toBe('Low Feature has been Baseline since 2024-01-01 (Newly available)');
    });

    it('replaces macro with not supported status', () => {
      const content = '{{ BASELINE_STATUS("no-baseline-feature") }}';
      const result = replaceMacros(content, 'test.md');
      expect(result).toBe('No Baseline Feature is not supported across all major browsers');
    });

    it('throws error for non-existent feature', () => {
      const content = '{{ BASELINE_STATUS("non-existent") }}';
      expect(() => replaceMacros(content, 'test.md')).toThrow('Web feature ID "non-existent" not found');
    });

    it('throws error for non-primary feature', () => {
      const content = '{{ BASELINE_STATUS("split-feature") }}';
      expect(() => replaceMacros(content, 'test.md')).toThrow('is a split record, not a primary feature');
    });
  });

  describe('BASELINE_STATUS (with BCD key)', () => {
    it('replaces macro with widely available status', () => {
      const content = '{{ BASELINE_STATUS("any", "high-bcd") }}';
      const result = replaceMacros(content, 'test.md');
      expect(result).toBe('The high-bcd capability has been Baseline since 2015-01-01 (Widely available)');
    });

    it('replaces macro with newly available status', () => {
      const content = '{{ BASELINE_STATUS("any", "low-bcd") }}';
      const result = replaceMacros(content, 'test.md');
      expect(result).toBe('The low-bcd capability has been Baseline since 2024-01-01 (Newly available)');
    });

    it('replaces macro with not supported status', () => {
      const content = '{{ BASELINE_STATUS("any", "no-baseline-bcd") }}';
      const result = replaceMacros(content, 'test.md');
      expect(result).toBe('The no-baseline-bcd capability is not supported across all major browsers');
    });

    it('throws error for non-existent BCD key', () => {
      const content = '{{ BASELINE_STATUS("any", "missing-bcd") }}';
      expect(() => replaceMacros(content, 'test.md')).toThrow('BCD key "missing-bcd" not found');
    });
  });

  it('supports multiple macros and mixed quotes', () => {
    const content = '{{ BASELINE_STATUS("baseline-high-feature") }} and {{ BASELINE_STATUS("any", "low-bcd") }}';
    const result = replaceMacros(content, 'test.md');
    expect(result).toContain('High Feature has been Baseline since 2020-01-01 (Widely available)');
    expect(result).toContain('The low-bcd capability has been Baseline since 2024-01-01 (Newly available)');
  });
});
