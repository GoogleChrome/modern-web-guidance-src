import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSStyleRule,
  CSSContainerRule,
  CSSGroupingRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';
import type { Document } from 'linkedom';

// @ts-ignore - package.json omits "type": "module" so nodenext treats .ts as CommonJS
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllRules(rules: Iterable<CSSRule>): CSSRule[] {
  const result: CSSRule[] = [];
  for (const rule of rules) {
    result.push(rule);
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...getAllRules(rule.cssRules));
    }
  }
  return result;
}

function getStyleDeclarationKeys(rule: CSSStyleRule): string[] {
  const keys: string[] = [];
  for (let i = 0; i < rule.style.length; i++) {
    const key = rule.style.item(i);
    if (key) {
      keys.push(key);
    }
  }
  return keys;
}

test.describe('usage-aware-component-variations Target Grader', () => {
  test('Parent container defines a semantic context flag using a CSS custom property', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const styleRules = getAllRules(stylesheet.cssRules).filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule
    );

    const hasContextCustomProperty = styleRules.some((rule) => {
      if (rule.selectorText.trim() === ':root') return false;
      const customProps = getStyleDeclarationKeys(rule).filter((k) => k.startsWith('--'));
      if (customProps.length === 0) return false;

      const setsFeaturedFlag = customProps.some((prop) => {
        const val = rule.style.getPropertyValue(prop).trim();
        return prop.includes('surface') || /\b(featured|promo|highlight|seasonal)\b/i.test(val);
      });
      if (!setsFeaturedFlag) return false;

      const matchesContainerInDom = docs.some((d) => {
        const matchedEls = Array.from(d.document.querySelectorAll(rule.selectorText));
        return matchedEls.some((el) => el.querySelector('.card, .btn') !== null);
      });

      return matchesContainerInDom;
    });

    expect(hasContextCustomProperty).toBe(true);
  });

  test('Container does not set an explicit container-type for style queries', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);
    const styleRules = allRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
    const containerRules = allRules.filter(
      (r): r is CSSContainerRule => r instanceof CSSContainerRule
    );

    const hasContainerStyleRule = containerRules.some((r) =>
      /\bstyle\s*\(/i.test(r.conditionText || r.containerQuery)
    );
    const hasContainerType = styleRules.some((r) => {
      const ct = r.style.getPropertyValue('container-type').trim();
      return ct !== '' && ct !== 'normal';
    });

    expect(hasContainerStyleRule && !hasContainerType).toBe(true);
  });

  test('Component uses @container style() queries without relying on size queries for semantic variation', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const containerRules = getAllRules(stylesheet.cssRules).filter(
      (r): r is CSSContainerRule => r instanceof CSSContainerRule
    );

    const styleQueryRules = containerRules.filter((r) => {
      const cond = r.conditionText || r.containerQuery || '';
      return /\bstyle\s*\(\s*--/i.test(cond) && !/\b(min-width|max-width|inline-size|width)\b/i.test(cond);
    });

    expect(styleQueryRules.length).toBeGreaterThan(0);
  });

  test('Inside @container style() query, card component adapts its visual styling for the featured context', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const containerRules = getAllRules(stylesheet.cssRules).filter(
      (r): r is CSSContainerRule =>
        r instanceof CSSContainerRule &&
        /\bstyle\s*\(\s*--/i.test(r.conditionText || r.containerQuery || '')
    );

    const nestedStyleRules = containerRules
      .flatMap((cr) => getAllRules(cr.cssRules))
      .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    const adaptsCard = nestedStyleRules.some((r) => {
      if (!/\bcard\b/.test(r.selectorText)) return false;
      const keys = getStyleDeclarationKeys(r);
      return keys.some((k) =>
        /^(background|background-color|border|border-color|border-top|box-shadow)$/i.test(k)
      );
    });

    expect(adaptsCard).toBe(true);
  });

  test('Inside @container style() query, button component switches its visual variant for the featured context', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const containerRules = getAllRules(stylesheet.cssRules).filter(
      (r): r is CSSContainerRule =>
        r instanceof CSSContainerRule &&
        /\bstyle\s*\(\s*--/i.test(r.conditionText || r.containerQuery || '')
    );

    const nestedStyleRules = containerRules
      .flatMap((cr) => getAllRules(cr.cssRules))
      .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    const topLevelBtnRule = Array.from(stylesheet.cssRules).find(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule && /^\.btn\b/.test(r.selectorText.trim())
    );
    const defaultBtnBg = topLevelBtnRule
      ? topLevelBtnRule.style.getPropertyValue('background') ||
        topLevelBtnRule.style.getPropertyValue('background-color')
      : '';

    const adaptsButton = nestedStyleRules.some((r) => {
      if (!/\bbtn\b/.test(r.selectorText) || /:hover|:focus/.test(r.selectorText)) return false;
      const bg =
        r.style.getPropertyValue('background').trim() ||
        r.style.getPropertyValue('background-color').trim();
      return bg !== '' && bg !== 'transparent' && bg !== defaultBtnBg.trim();
    });

    expect(adaptsButton).toBe(true);
  });
});
