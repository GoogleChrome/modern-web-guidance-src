/**
 * Expectations status:
 * 1. TESTED: Combined selector and @-rule filtering criteria set a CSS custom property on an ancestor element (:root/html) rather than duplicating descendant style rules.
 * 2. TESTED: Descendant style rules that depend on the combined criteria are applied inside @container style(...) or @container not style(...) blocks keyed off that custom property.
 * 3. TESTED: Stylesheets declare the custom property queried by @container style(...) or @container not style(...) on an ancestor element rather than on target elements themselves.
 */

import {
  test,
  expect,
  getTargetFiles,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';
import {
  closestRule,
  resolveSelector,
  CSSStyleRule,
  CSSMediaRule,
  CSSContainerRule,
  CSSNestedDeclarations,
  type RuleRoot,
} from 'cssomnom';

interface CustomPropertyDeclaration {
  property: string;
  value: string;
  selector: string;
  mediaCondition: string | null;
}

function isAncestorSelector(selector: string): boolean {
  if (!selector) return false;
  return /(?:^|[\s,>+~]|:(?:is|where)\(\s*)(:root\b|html\b|&)/i.test(selector.trim());
}

function getCustomPropertyDeclarations(root: RuleRoot | string[]): CustomPropertyDeclaration[] {
  const decls: CustomPropertyDeclaration[] = [];
  const rules = getRules(root);

  for (const r of rules) {
    if (r instanceof CSSStyleRule || r instanceof CSSNestedDeclarations) {
      const style = r.style;
      if (style) {
        for (let i = 0; i < style.length; i++) {
          const prop = style[i];
          if (prop && prop.startsWith('--')) {
            decls.push({
              property: prop,
              value: style.getPropertyValue(prop).trim(),
              selector: resolveSelector(r) || '',
              mediaCondition: closestRule(r, CSSMediaRule)?.conditionText ?? null,
            });
          }
        }
      }
    }
  }
  return decls;
}

function getQueriedCustomProperties(containerRules: CSSContainerRule[]): Set<string> {
  const props = new Set<string>();
  for (const rule of containerRules) {
    const matches = Array.from(rule.conditionText.matchAll(/style\s*\(\s*(--[a-zA-Z0-9_-]+)/g));
    for (const match of matches) {
      if (match[1]) {
        props.add(match[1]);
      }
    }
  }
  return props;
}

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('selector-atrule-combinations: daily-grind Target Grader', () => {
  test('Expectation 1: Combined @media criteria sets a custom property on an ancestor element', () => {
    const customDecls = getCustomPropertyDeclarations(targetFiles);
    const mediaSetsCustomPropOnAncestor = customDecls.some(
      (d) =>
        d.mediaCondition !== null &&
        /\bprefers-color-scheme\b/i.test(d.mediaCondition) &&
        isAncestorSelector(d.selector)
    );
    expect(mediaSetsCustomPropOnAncestor).toBe(true);
  });

  test('Expectation 1: Root selector criteria sets a custom property on an ancestor element', () => {
    const customDecls = getCustomPropertyDeclarations(targetFiles);
    const selectorSetsCustomPropOnAncestor = customDecls.some(
      (d) =>
        isAncestorSelector(d.selector) &&
        /(:has\(|\[data-|\b(dark|light)\b)/i.test(d.selector)
    );
    expect(selectorSetsCustomPropOnAncestor).toBe(true);
  });

  test('Expectation 2: Stylesheet defines @container style query blocks keyed off a custom property', () => {
    const containerRules = getRules(targetFiles, CSSContainerRule);
    const queriedProps = getQueriedCustomProperties(containerRules);
    expect(queriedProps.size).toBeGreaterThan(0);
  });

  test('Expectation 2: Descendant style rules are applied inside @container style query blocks', () => {
    const containerRules = getRules(targetFiles, CSSContainerRule);
    const hasDescendantRulesInStyleQuery = containerRules.some((cr) => {
      const isStyleQuery = /style\s*\(/i.test(cr.conditionText);
      if (!isStyleQuery) return false;
      const childRules = Array.from(cr.cssRules);
      return childRules.some((r) => r instanceof CSSStyleRule && r.selectorText.trim().length > 0);
    });
    expect(hasDescendantRulesInStyleQuery).toBe(true);
  });

  test('Expectation 3: Queried custom property is declared on an ancestor element', () => {
    const containerRules = getRules(targetFiles, CSSContainerRule);
    const queriedProps = getQueriedCustomProperties(containerRules);
    const customDecls = getCustomPropertyDeclarations(targetFiles);

    const isDeclaredOnAncestor =
      queriedProps.size > 0 &&
      Array.from(queriedProps).some((prop) =>
        customDecls.some((d) => d.property === prop && isAncestorSelector(d.selector))
      );
    expect(isDeclaredOnAncestor).toBe(true);
  });

  test('Expectation 3: Queried custom property is scoped to an ancestor rather than target elements', () => {
    const containerRules = getRules(targetFiles, CSSContainerRule);
    const queriedProps = getQueriedCustomProperties(containerRules);
    const customDecls = getCustomPropertyDeclarations(targetFiles);

    const targetSelectors: string[] = [];
    for (const cr of containerRules) {
      if (/style\s*\(/i.test(cr.conditionText)) {
        for (const r of Array.from(cr.cssRules)) {
          if (r instanceof CSSStyleRule) {
            targetSelectors.push(r.selectorText.trim());
          }
        }
      }
    }

    const properlyScoped =
      queriedProps.size > 0 &&
      Array.from(queriedProps).every((prop) => {
        const declsForProp = customDecls.filter((d) => d.property === prop);
        const hasAncestorDecl = declsForProp.some((d) => isAncestorSelector(d.selector));
        const hasTargetDecl = declsForProp.some(
          (d) =>
            !isAncestorSelector(d.selector) &&
            targetSelectors.some((ts) => d.selector.includes(ts))
        );
        return hasAncestorDecl && !hasTargetDecl;
      });

    expect(properlyScoped).toBe(true);
  });
});
