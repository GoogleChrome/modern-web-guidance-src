// Expectations Analysis:
// Expectation 1: TESTED - Validates that :user-invalid and :user-valid are used rather than :invalid and :valid for form validation styling (excluding input[type="range"]).
// Expectation 2: TESTED - Validates that field-sizing: content is applied to multi-line <textarea> elements or auto-growing text inputs.
// Expectation 3: TESTED - Validates that page-level browser UI theming configures color-scheme, accent-color, and ::selection without applying user-select: none to content text elements or their ancestors.
// Expectation 4: TESTED - Validates that custom-styled choice controls use native <select> with appearance: base-select and ::picker(select) or label:has(:checked), and submit actions use <button> rather than <input type="submit">.

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
  test('Form validation styling uses :user-invalid and :user-valid rather than :invalid and :valid (and does not apply field validity styling to input[type="range"] sliders) so error states appear only after user interaction', () => {
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

    // Ensure broad input:user-valid / input:user-invalid selectors exclude range sliders
    const appliesValidityToRangeSlider = styleRules.some((r) => {
      if (!r.selectorText.includes(':user-valid') && !r.selectorText.includes(':user-invalid')) {
        return false;
      }
      return r.selectorText.split(',').some((part) => {
        const s = part.trim();
        const targetsBroadInput = /\binput\s*:user-(valid|invalid)\b/i.test(s) && !/input\[type=/i.test(s);
        const excludesRange = /:not\([^)]*range[^)]*\)/i.test(s);
        return targetsBroadInput && !excludesRange;
      });
    });

    const satisfiesExpectation1 =
      ((hasUserInvalidCss && hasUserValidCss) || hasUserPseudosUtility) &&
      !usesRawInvalidOrValidCss &&
      !usesRawInvalidOrValidUtility &&
      !appliesValidityToRangeSlider;

    expect(satisfiesExpectation1).toBe(true);
  });

  test('Multi-line <textarea> elements (or auto-growing text inputs) use field-sizing: content to size to their content', () => {
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

  test('Page-level browser UI theming configures color-scheme, accent-color, and ::selection without applying user-select: none to content text elements (such as paragraphs or headings) or their ancestors', () => {
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

    const contentTextElements = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, article'))
    );

    const anyContentOrAncestorUnselectable =
      contentTextElements.length === 0 ||
      contentTextElements.some((el) => {
        let current: any = el;
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

    expect(hasBrowserUiTheming && !anyContentOrAncestorUnselectable).toBe(
      true
    );
  });

  test('Custom-styled choice controls keep native form elements by styling <select> with appearance: base-select and ::picker(select) or inline radio and checkbox options with label:has(:checked), and submit actions use <button> rather than <input type="submit">', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const hasBaseSelectAndPicker =
      styleRules.some(
        (r) =>
          /\bselect\b/i.test(r.selectorText) &&
          r.style.getPropertyValue('appearance').trim() === 'base-select'
      ) &&
      styleRules.some((r) => r.selectorText.includes('::picker(select)'));

    const hasCheckedLabelStyling = styleRules.some((r) =>
      /:has\([^)]*:checked/i.test(r.selectorText)
    );

    const hasNativeSubmitButton = docs.some((d) => {
      const buttons = Array.from(d.document.querySelectorAll('form button'));
      const legacyInputButtons = Array.from(
        d.document.querySelectorAll('input[type="submit"], input[type="button"], input[type="reset"]')
      );
      return buttons.length > 0 && legacyInputButtons.length === 0;
    });

    expect((hasBaseSelectAndPicker || hasCheckedLabelStyling) && hasNativeSubmitButton).toBe(true);
  });
});
