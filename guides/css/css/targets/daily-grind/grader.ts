/**
 * Expectations Summary:
 * Expectation 1: TESTED - The base application uses physical directional properties for layout spacing and sizing instead of CSS logical properties.
 * Expectation 2: TESTED - The base application lacks explicit @layer priority zone declarations to manage cascade specificity.
 * Expectation 3: SKIPPED - The base application does not contain container elements styled conditionally on child or input states.
 * Expectation 4: SKIPPED - The base application does not contain :has() selectors or nested :has() constructs.
 * Expectation 5: TESTED - The base application defines interactive element states without using :is() or :where() selector grouping.
 * Expectation 6: TESTED - The base application does not use :not() to exclude irrelevant element or pseudo-class states.
 * Expectation 7: SKIPPED - The base application does not contain nested component subtrees requiring scoped subtree exclusion.
 * Expectation 8: TESTED - The base application applies global wildcard reset declarations outside of a low-priority @layer reset block.
 */

import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSStyleRule,
  CSSGroupingRule,
  CSSLayerBlockRule,
  CSSLayerStatementRule,
  type CSSRule,
} from 'cssomnom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule) {
      result.push(...getAllStyleRules(Array.from(rule.cssRules)));
    }
  }
  return result;
}

function findWildcardOutsideReset(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const wildcards: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSLayerBlockRule && rule.name.trim() === 'reset') {
      continue;
    }
    if (rule instanceof CSSStyleRule && rule.selectorText.trim() === '*') {
      wildcards.push(rule);
    }
    if (rule instanceof CSSGroupingRule) {
      wildcards.push(...findWildcardOutsideReset(Array.from(rule.cssRules)));
    }
  }
  return wildcards;
}

test.describe('CSS: Modern Architecture - Daily Grind Grader', () => {

  test('Expectation 1: The implementation uses CSS logical properties for layout spacing and sizing', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllStyleRules(Array.from(stylesheet.cssRules));
    const logicalSpacingProps = [
      'margin-inline', 'margin-inline-start', 'margin-inline-end',
      'margin-block', 'margin-block-start', 'margin-block-end',
      'padding-inline', 'padding-inline-start', 'padding-inline-end',
      'padding-block', 'padding-block-start', 'padding-block-end',
      'inline-size', 'min-inline-size', 'max-inline-size',
      'block-size', 'min-block-size', 'max-block-size',
      'inset-inline', 'inset-inline-start', 'inset-inline-end',
      'inset-block', 'inset-block-start', 'inset-block-end',
    ];
    const hasLogicalProperties = rules.some(rule => {
      for (let i = 0; i < rule.style.length; i++) {
        const prop = rule.style[i];
        if (logicalSpacingProps.includes(prop) || /-(inline|block)/.test(prop)) {
          return true;
        }
      }
      return false;
    });
    expect(hasLogicalProperties).toBe(true);
  });

  test('Expectation 2: The implementation declares explicit @layer priority zones to manage cascade specificity', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const hasLayerStatement = Array.from(stylesheet.cssRules).some(
      rule => rule instanceof CSSLayerStatementRule && rule.nameList.length >= 2
    );
    expect(hasLayerStatement).toBe(true);
  });

  test('Expectation 5: The implementation uses :is() or :where() to group selectors or fallbacks', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllStyleRules(Array.from(stylesheet.cssRules));
    const hasIsOrWhere = rules.some(rule => /:(is|where)\(/.test(rule.selectorText));
    expect(hasIsOrWhere).toBe(true);
  });

  test('Expectation 6: The implementation uses :not() to exclude irrelevant states or targets', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllStyleRules(Array.from(stylesheet.cssRules));
    const hasNotSelector = rules.some(rule => /:not\(/.test(rule.selectorText));
    expect(hasNotSelector).toBe(true);
  });

  test('Expectation 8: Global wildcard reset declarations are encapsulated inside a low-priority @layer reset block', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const unlayeredWildcards = findWildcardOutsideReset(Array.from(stylesheet.cssRules));
    const hasResetLayer = Array.from(stylesheet.cssRules).some(
      r => (r instanceof CSSLayerStatementRule && r.nameList.includes('reset')) ||
           (r instanceof CSSLayerBlockRule && r.name.trim() === 'reset')
    );
    const isWildcardProperlyScoped = hasResetLayer && unlayeredWildcards.length === 0;
    expect(isWildcardProperlyScoped).toBe(true);
  });

});
