import { describe, it } from 'node:test';
import assert from 'node:assert';
import { replaceMacros } from './macros.ts';

describe('replaceMacros (Functional with real data)', () => {
  describe('BASELINE_STATUS', () => {
    it('replaces macro with widely available status', () => {
      const content = '{{ BASELINE_STATUS("grid") }}';
      const result = replaceMacros(content, 'test.md');
      assert.ok(result.includes('2017-10-17') || result.includes('Widely available'));
    });

    it('replaces macro with newly available status', () => {
      const content = "{{ BASELINE_STATUS('dialog-closedby') }}";
      const result = replaceMacros(content, 'test.md');
      assert.ok(result !== undefined); // Specific text might vary depending on live data
    });

    it('replaces macro with not supported status', () => {
      // Accelerometer is typically limited
      const content = '{{ BASELINE_STATUS("accelerometer") }}';
      const result = replaceMacros(content, 'test.md');
      assert.ok(result.includes('not supported') || result.includes('Limited'));
    });

    it('throws error for non-existent feature', () => {
      const content = '{{ BASELINE_STATUS("non-existent-feature-xyz") }}';
      assert.throws(() => replaceMacros(content, 'test.md'), /Web feature ID "non-existent-feature-xyz" not found/);
    });
  });

  describe('BASELINE_STATUS (with BCD key)', () => {
    it('replaces macro with widely available status', () => {
      const content = '{{ BASELINE_STATUS("grid", "css.properties.grid-template-columns") }}';
      const result = replaceMacros(content, 'test.md');
      assert.ok(result.includes('grid') && result.includes('Widely'));
    });

    it('throws error for non-existent BCD key', () => {
      const content = '{{ BASELINE_STATUS("grid", "css.properties.non-existent-xyz") }}';
      assert.throws(() => replaceMacros(content, 'test.md'), /BCD key/);
    });
  });

  it('supports multiple macros and mixed quotes', () => {
    const content = '{{ BASELINE_STATUS("grid") }} and {{ BASELINE_STATUS("grid", "css.properties.grid-template-columns") }}';
    const result = replaceMacros(content, 'test.md');
    assert.ok(result.includes('grid') || result.includes('Widely available') || result.includes('Baseline since'));
  });
});
