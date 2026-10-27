import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import type { Document } from 'linkedom';
import {
  CSSStyleRule,
  CSSMediaRule,
  CSSGroupingRule,
  CSSNestedDeclarations,
  type CSSRule,
  type CSSStyleDeclaration,
  type CSSStyleSheet,
} from 'cssomnom';

// @ts-ignore
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

function getAllStyleDeclarations(rules: Iterable<CSSRule>): CSSStyleDeclaration[] {
  const decls: CSSStyleDeclaration[] = [];
  for (const rule of getAllRules(rules)) {
    if (rule instanceof CSSStyleRule || rule instanceof CSSNestedDeclarations) {
      decls.push(rule.style);
    }
  }
  return decls;
}

test.describe('progress Target Grader', () => {
  test('Uses the semantic <progress> element', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const progressElements = docs.flatMap((d) => Array.from(d.document.querySelectorAll('progress')));
    expect(progressElements.length).toBeGreaterThan(0);
  });

  test('Determinate progress bar sets the value attribute and a valid scale', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const determinateBars = docs.flatMap((d) => Array.from(d.document.querySelectorAll('progress[value]')));
    const hasValidDeterminate =
      determinateBars.length > 0 &&
      determinateBars.every((el) => {
        const val = Number(el.getAttribute('value'));
        const maxAttr = el.getAttribute('max');
        const max = maxAttr !== null ? Number(maxAttr) : 1;
        return !Number.isNaN(val) && !Number.isNaN(max) && max > 0 && val >= 0 && val <= max;
      });
    expect(hasValidDeterminate).toBe(true);
  });

  test('Indeterminate progress bar state is achieved by omitting the value attribute', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const indeterminateBars = docs.flatMap((d) => Array.from(d.document.querySelectorAll('progress:not([value])')));
    expect(indeterminateBars.length).toBeGreaterThan(0);
  });

  test('Each progress bar is associated with a descriptive label', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const progressWithDocs = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('progress')).map((el) => ({ el, doc: d.document })),
    );
    const allLabeled =
      progressWithDocs.length > 0 &&
      progressWithDocs.every(({ el, doc }) => {
        const ariaLabel = el.getAttribute('aria-label')?.trim();
        if (ariaLabel) return true;

        const ariaLabelledBy = el.getAttribute('aria-labelledby')?.trim();
        if (ariaLabelledBy) {
          const ids = ariaLabelledBy.split(/\s+/);
          if (ids.some((id) => Boolean(doc.getElementById(id)?.textContent?.trim()))) {
            return true;
          }
        }

        const id = el.getAttribute('id')?.trim();
        if (id) {
          const explicitLabel = Array.from(doc.querySelectorAll('label[for]')).find(
            (l) => l.getAttribute('for') === id,
          );
          if (explicitLabel && Boolean(explicitLabel.textContent?.trim())) {
            return true;
          }
        }

        const parentLabel = el.closest('label');
        if (parentLabel && Boolean(parentLabel.textContent?.trim())) {
          return true;
        }

        return false;
      });
    expect(allLabeled).toBe(true);
  });

  test('<progress> element does not include fallback text content inside the element', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const progressElements = docs.flatMap((d) => Array.from(d.document.querySelectorAll('progress')));
    const hasNoFallbackText =
      progressElements.length > 0 && progressElements.every((el) => (el.textContent ?? '').trim() === '');
    expect(hasNoFallbackText).toBe(true);
  });

  test('Custom styles normalize the element using appearance: none and border: 0', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);
    const styleRules = allRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    const hasAppearanceNone =
      styleRules.some((r) => /\bnone\b/i.test(r.style.getPropertyValue('appearance'))) ||
      docs.some((d) => Boolean(d.document.querySelector('progress.appearance-none, progress[class*="appearance-none"]')));

    const hasZeroBorder =
      styleRules.some((r) => {
        const border = r.style.getPropertyValue('border');
        const borderWidth = r.style.getPropertyValue('border-width');
        const borderStyle = r.style.getPropertyValue('border-style');
        return (
          /\b(0(px|rem|em)?|none)\b/i.test(border) ||
          /\b0(px|rem|em)?\b/i.test(borderWidth) ||
          /\bnone\b/i.test(borderStyle)
        );
      }) ||
      docs.some((d) => Boolean(d.document.querySelector('progress.border-0, progress.border-none')));

    expect(hasAppearanceNone && hasZeroBorder).toBe(true);
  });

  test('Custom styles are provided for browser-specific pseudo-elements using separate -webkit- and -moz- selector rules', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);
    const styleRules = allRules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

    const hasWebkitBar = styleRules.some(
      (r) =>
        r.selectorText.includes('::-webkit-progress-bar') &&
        !r.selectorText.includes('-moz-') &&
        r.style.length > 0,
    );
    const hasWebkitValue = styleRules.some(
      (r) =>
        r.selectorText.includes('::-webkit-progress-value') &&
        !r.selectorText.includes('-moz-') &&
        r.style.length > 0,
    );
    const hasMozBar = styleRules.some(
      (r) =>
        r.selectorText.includes('::-moz-progress-bar') &&
        !r.selectorText.includes('-webkit-') &&
        r.style.length > 0,
    );
    const hasNoGroupedVendorRules = styleRules.every(
      (r) => !(r.selectorText.includes('-webkit-') && r.selectorText.includes('-moz-')),
    );

    expect(hasWebkitBar && hasWebkitValue && hasMozBar && hasNoGroupedVendorRules).toBe(true);
  });

  test('Custom indeterminate animation respects prefers-reduced-motion: reduce by slowing down or dampening rather than disabling', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = getAllRules(stylesheet.cssRules);
    const mediaRules = allRules.filter(
      (r): r is CSSMediaRule =>
        r instanceof CSSMediaRule &&
        r.conditionText.includes('prefers-reduced-motion') &&
        r.conditionText.includes('reduce'),
    );

    const adjustsAnimationWithoutDisabling = mediaRules.some((mediaRule) => {
      const decls = getAllStyleDeclarations(mediaRule.cssRules);
      if (mediaRule.parentRule instanceof CSSStyleRule) {
        for (const child of Array.from(mediaRule.cssRules)) {
          if (child instanceof CSSNestedDeclarations) {
            decls.push(child.style);
          }
        }
      }

      return decls.some((style) => {
        for (let i = 0; i < style.length; i++) {
          const prop = style.item(i);
          const val = style.getPropertyValue(prop).trim();
          const isAnimationRelated =
            prop.includes('animation') || prop.includes('duration') || prop.startsWith('--');
          const hasPositiveDuration = /[1-9]\d*(\.\d+)?m?s\b|0\.\d*[1-9]\d*m?s\b/i.test(val);
          const isDisabled = /\bnone\b/i.test(val) || /^0(m?s)?$/i.test(val);
          if (isAnimationRelated && hasPositiveDuration && !isDisabled) {
            return true;
          }
        }
        return false;
      });
    });

    expect(adjustsAnimationWithoutDisabling).toBe(true);
  });
});
