// Expectations Analysis:
// Expectation 1: TESTED - Validates that :user-invalid and :user-valid are used rather than :invalid and :valid for form validation styling.
// Expectation 2: TESTED - Validates that field-sizing: content is applied to auto-growing text inputs or <textarea> elements.
// Expectation 3: TESTED - Validates that user-select: none is not applied to <p> elements or their ancestors while browser-generated UI theming is configured.

import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  getCascadedStyle,
  CSSStyleRule,
  CSSGroupingRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';
import type { Document } from 'linkedom';

// @ts-ignore - package.json omits "type": "module", causing tsc nodenext to treat .ts as CommonJS
const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...collectStyleRules(rule.cssRules));
    }
  }
  return result;
}

test.describe('browser-ui-theming Target Grader', () => {
  test('Expectation 1: Uses :user-invalid and :user-valid rather than :invalid and :valid for form validation styling', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const hasUserInvalidCss = styleRules.some(
      (r) =>
        r.selectorText.includes(':user-invalid') &&
        (r.style.getPropertyValue('border').trim().length > 0 ||
          r.style.getPropertyValue('border-color').trim().length > 0 ||
          r.style.getPropertyValue('background').trim().length > 0 ||
          r.style.getPropertyValue('background-color').trim().length > 0 ||
          r.style.getPropertyValue('outline').trim().length > 0)
    );
    const hasUserValidCss = styleRules.some(
      (r) =>
        r.selectorText.includes(':user-valid') &&
        (r.style.getPropertyValue('border').trim().length > 0 ||
          r.style.getPropertyValue('border-color').trim().length > 0 ||
          r.style.getPropertyValue('background').trim().length > 0 ||
          r.style.getPropertyValue('background-color').trim().length > 0 ||
          r.style.getPropertyValue('outline').trim().length > 0)
    );
    const hasUserPseudosUtility = docs.some((d) =>
      Boolean(
        d.document.querySelector('[class*="user-invalid:"]') &&
          d.document.querySelector('[class*="user-valid:"]')
      )
    );

    const usesRawInvalidOrValidCss = styleRules.some((r) =>
      /(?<![-\w]):(invalid|valid)\b/.test(r.selectorText)
    );
    const usesRawInvalidOrValidUtility = docs.some((d) =>
      Array.from(d.document.querySelectorAll('[class]')).some((el) =>
        /(?:^|\s)(?:invalid|valid):/.test(el.getAttribute('class') || '')
      )
    );

    const satisfiesExpectation1 =
      ((hasUserInvalidCss && hasUserValidCss) || hasUserPseudosUtility) &&
      !usesRawInvalidOrValidCss &&
      !usesRawInvalidOrValidUtility;

    expect(satisfiesExpectation1).toBe(true);
  });

  test('Expectation 2: Uses field-sizing: content on auto-growing text inputs or <textarea> elements', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const hasFieldSizingInCss = styleRules.some(
      (r) =>
        /\b(textarea|input)\b/i.test(r.selectorText) &&
        r.style.getPropertyValue('field-sizing').trim() === 'content'
    );
    const hasFieldSizingUtility = docs.some((d) =>
      Boolean(
        d.document.querySelector(
          'textarea[class*="field-sizing-content"], input[class*="field-sizing-content"]'
        )
      )
    );

    expect(hasFieldSizingInCss || hasFieldSizingUtility).toBe(true);
  });

  test('Expectation 3: Configures browser UI theming without applying user-select: none to <p> elements or their ancestors', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = Array.from(stylesheet.cssRules);
    const styleRules = collectStyleRules(allRules);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const hasBrowserUiTheming =
      styleRules.some((r) =>
        /\b(light|dark)\b/i.test(r.style.getPropertyValue('color-scheme'))
      ) &&
      styleRules.some(
        (r) => r.style.getPropertyValue('accent-color').trim().length > 0
      ) &&
      styleRules.some((r) => r.selectorText.includes('::selection'));

    const paragraphs = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('p'))
    );

    const anyParagraphOrAncestorUnselectable =
      paragraphs.length === 0 ||
      paragraphs.some((p) => {
        let current: any = p;
        while (current && current.nodeType === 1) {
          const cascaded = getCascadedStyle(current, allRules);
          const userSelect =
            cascaded.getPropertyValue('user-select').trim() ||
            cascaded.getPropertyValue('-webkit-user-select').trim();
          if (userSelect === 'none') return true;
          if (current.classList?.contains('select-none')) return true;
          current = current.parentElement;
        }
        return false;
      });

    expect(hasBrowserUiTheming && !anyParagraphOrAncestorUnselectable).toBe(
      true
    );
  });
});
