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
  getCssStyleSheet,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSStyleRule,
  CSSMediaRule,
  CSSContainerRule,
  CSSNestedDeclarations,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';

interface CustomPropertyDeclaration {
  property: string;
  value: string;
  selector: string;
  mediaCondition: string | null;
}

function getFullSelector(rule: CSSRule): string {
  const parts: string[] = [];
  let curr: CSSRule | null = rule;
  while (curr) {
    if (curr instanceof CSSStyleRule) {
      parts.unshift(curr.selectorText);
    }
    curr = curr.parentRule;
  }
  return parts.join(' ');
}

function getEnclosingMediaCondition(rule: CSSRule): string | null {
  let curr: CSSRule | null = rule;
  while (curr) {
    if (curr instanceof CSSMediaRule) {
      return curr.conditionText;
    }
    curr = curr.parentRule;
  }
  return null;
}

function isAncestorSelector(selector: string): boolean {
  if (!selector) return false;
  return /(^|[\s,>+~])(:root\b|html\b|&)/i.test(selector.trim());
}

function extractAllRules(stylesheet: CSSStyleSheet): CSSRule[] {
  const rules: CSSRule[] = [];
  function walk(rule: CSSRule) {
    rules.push(rule);
    if ('cssRules' in rule && (rule as { cssRules?: Iterable<CSSRule> }).cssRules) {
      for (const child of Array.from((rule as { cssRules: Iterable<CSSRule> }).cssRules)) {
        walk(child);
      }
    }
  }
  for (const r of Array.from(stylesheet.cssRules)) {
    walk(r);
  }
  return rules;
}

function getCustomPropertyDeclarations(stylesheet: CSSStyleSheet): CustomPropertyDeclaration[] {
  const decls: CustomPropertyDeclaration[] = [];
  const rules = extractAllRules(stylesheet);

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
              selector: getFullSelector(r),
              mediaCondition: getEnclosingMediaCondition(r),
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
    const stylesheet = getCssStyleSheet(targetFiles);
    const customDecls = getCustomPropertyDeclarations(stylesheet);
    const mediaSetsCustomPropOnAncestor = customDecls.some(
      (d) =>
        d.mediaCondition !== null &&
        /\bprefers-color-scheme\b/i.test(d.mediaCondition) &&
        isAncestorSelector(d.selector)
    );
    expect(mediaSetsCustomPropOnAncestor).toBe(true);
  });

  test('Expectation 1: Root selector criteria sets a custom property on an ancestor element', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const customDecls = getCustomPropertyDeclarations(stylesheet);
    const selectorSetsCustomPropOnAncestor = customDecls.some(
      (d) =>
        isAncestorSelector(d.selector) &&
        /(:has\(|\[data-|\b(dark|light)\b)/i.test(d.selector)
    );
    expect(selectorSetsCustomPropOnAncestor).toBe(true);
  });

  test('Expectation 2: Stylesheet defines @container style query blocks keyed off a custom property', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = extractAllRules(stylesheet);
    const containerRules = allRules.filter((r): r is CSSContainerRule => r instanceof CSSContainerRule);
    const queriedProps = getQueriedCustomProperties(containerRules);
    expect(queriedProps.size).toBeGreaterThan(0);
  });

  test('Expectation 2: Descendant style rules are applied inside @container style query blocks', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = extractAllRules(stylesheet);
    const containerRules = allRules.filter((r): r is CSSContainerRule => r instanceof CSSContainerRule);
    const hasDescendantRulesInStyleQuery = containerRules.some((cr) => {
      const isStyleQuery = /style\s*\(/i.test(cr.conditionText);
      if (!isStyleQuery) return false;
      const childRules = Array.from(cr.cssRules);
      return childRules.some((r) => r instanceof CSSStyleRule && r.selectorText.trim().length > 0);
    });
    expect(hasDescendantRulesInStyleQuery).toBe(true);
  });

  test('Expectation 3: Queried custom property is declared on an ancestor element', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = extractAllRules(stylesheet);
    const containerRules = allRules.filter((r): r is CSSContainerRule => r instanceof CSSContainerRule);
    const queriedProps = getQueriedCustomProperties(containerRules);
    const customDecls = getCustomPropertyDeclarations(stylesheet);

    const isDeclaredOnAncestor =
      queriedProps.size > 0 &&
      Array.from(queriedProps).some((prop) =>
        customDecls.some((d) => d.property === prop && isAncestorSelector(d.selector))
      );
    expect(isDeclaredOnAncestor).toBe(true);
  });

  test('Expectation 3: Queried custom property is scoped to an ancestor rather than target elements', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = extractAllRules(stylesheet);
    const containerRules = allRules.filter((r): r is CSSContainerRule => r instanceof CSSContainerRule);
    const queriedProps = getQueriedCustomProperties(containerRules);
    const customDecls = getCustomPropertyDeclarations(stylesheet);

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
