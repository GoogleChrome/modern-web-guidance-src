/**
 * Expectations status:
 * Expectation 1: TESTED - Interactive elements require custom keyboard focus styles using :focus-visible paired with outline and outline-offset.
 * Expectation 2: SKIPPED - The base application does not remove default focus outlines (contains no outline: none).
 * Expectation 3: TESTED - Interactive navigation and footer links in the base application do not meet the minimum 24px by 24px touch target size.
 * Expectation 4: SKIPPED - The application contains no scrollable containers or custom gesture handlers applying touch-action: none.
 */

import { pathToFileURL } from 'node:url';
import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { CSSStyleRule, getCascadedStyle, type CSSStyleSheet, type CSSRule } from 'cssomnom';
import type { Document } from 'linkedom';

const testFileUrl = typeof __filename !== 'undefined'
  ? pathToFileURL(__filename).href
  : pathToFileURL(process.cwd() + '/grader.ts').href;
const targetFiles: string[] = getTargetFiles(testFileUrl);

function getAllStyleRules(rules: CSSRule[]): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if ('cssRules' in rule && (rule as any).cssRules) {
      result.push(...getAllStyleRules(Array.from((rule as any).cssRules)));
    }
  }
  return result;
}

function parseSizeToPx(value: string): number {
  const trimmed = value.trim();
  const pxMatch = trimmed.match(/^([\d.]+)px$/);
  if (pxMatch) return parseFloat(pxMatch[1]);
  const remMatch = trimmed.match(/^([\d.]+)rem$/);
  if (remMatch) return parseFloat(remMatch[1]) * 16;
  const emMatch = trimmed.match(/^([\d.]+)em$/);
  if (emMatch) return parseFloat(emMatch[1]) * 16;
  return 0;
}

function hasMinimumInlineSize(element: any, rules: CSSRule[]): boolean {
  const cascaded = getCascadedStyle(element, rules);
  const minInline = cascaded.getPropertyValue('min-inline-size') || cascaded.getPropertyValue('min-width');
  if (minInline && parseSizeToPx(minInline) >= 24) return true;

  const paddingInline = cascaded.getPropertyValue('padding-inline');
  if (paddingInline && parseSizeToPx(paddingInline) * 2 >= 24) return true;

  const paddingLeft = cascaded.getPropertyValue('padding-left');
  const paddingRight = cascaded.getPropertyValue('padding-right');
  if (paddingLeft && paddingRight && (parseSizeToPx(paddingLeft) + parseSizeToPx(paddingRight)) >= 24) return true;

  const padding = cascaded.getPropertyValue('padding');
  if (padding) {
    const parts = padding.trim().split(/\s+/);
    const horizontalVal = parts.length > 1 ? parts[1] : parts[0];
    if (parseSizeToPx(horizontalVal) * 2 >= 24) return true;
  }

  const classAttr = element.getAttribute('class') || '';
  if (/\b(min-w-\[?2[4-9]px\]?|min-w-6|min-w-8|w-6|w-8|size-6|size-8|px-[3-9]|p-[3-9])\b/.test(classAttr)) {
    return true;
  }
  return false;
}

function hasMinimumBlockSize(element: any, rules: CSSRule[]): boolean {
  const cascaded = getCascadedStyle(element, rules);
  const minBlock = cascaded.getPropertyValue('min-block-size') || cascaded.getPropertyValue('min-height');
  if (minBlock && parseSizeToPx(minBlock) >= 24) return true;

  const paddingBlock = cascaded.getPropertyValue('padding-block');
  if (paddingBlock && parseSizeToPx(paddingBlock) * 2 >= 24) return true;

  const paddingTop = cascaded.getPropertyValue('padding-top');
  const paddingBottom = cascaded.getPropertyValue('padding-bottom');
  if (paddingTop && paddingBottom && (parseSizeToPx(paddingTop) + parseSizeToPx(paddingBottom)) >= 24) return true;

  const padding = cascaded.getPropertyValue('padding');
  if (padding) {
    const parts = padding.trim().split(/\s+/);
    const verticalVal = parts[0];
    if (parseSizeToPx(verticalVal) * 2 >= 24) return true;
  }

  const classAttr = element.getAttribute('class') || '';
  if (/\b(min-h-\[?2[4-9]px\]?|min-h-6|min-h-8|h-6|h-8|size-6|size-8|py-[3-9]|p-[3-9])\b/.test(classAttr)) {
    return true;
  }
  return false;
}

test.describe('Accessibility Target Grader - Daily Grind', () => {

  // --- STATIC ASSERTIONS ---

  test('defines custom keyboard focus styles using :focus-visible selector', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = getAllStyleRules(Array.from(stylesheet.cssRules));
    const hasFocusVisibleSelector = rules.some((rule) => rule.selectorText.includes(':focus-visible'));
    expect(hasFocusVisibleSelector).toBe(true);
  });

  test('pairs :focus-visible with an outline declaration', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = getAllStyleRules(Array.from(stylesheet.cssRules));
    const hasOutline = rules
      .filter((rule) => rule.selectorText.includes(':focus-visible'))
      .some((rule) => {
        const style = rule.style;
        return Boolean(
          style.getPropertyValue('outline') ||
          style.getPropertyValue('outline-style') ||
          style.getPropertyValue('outline-width')
        );
      });
    expect(hasOutline).toBe(true);
  });

  test('pairs :focus-visible with outline-offset for visible focus separation', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = getAllStyleRules(Array.from(stylesheet.cssRules));
    const hasOutlineOffset = rules
      .filter((rule) => rule.selectorText.includes(':focus-visible'))
      .some((rule) => Boolean(rule.style.getPropertyValue('outline-offset')));
    expect(hasOutlineOffset).toBe(true);
  });

  test('ensures interactive navigation links meet minimum inline size of 24px using min-inline-size or padding', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = getAllStyleRules(Array.from(stylesheet.cssRules));

    const navLinks = docs.flatMap((d) => Array.from(d.document.querySelectorAll('nav a')));
    const satisfiesMinInline = navLinks.length > 0 && navLinks.every((link) => hasMinimumInlineSize(link, rules));
    expect(satisfiesMinInline).toBe(true);
  });

  test('ensures interactive navigation links meet minimum block size of 24px using min-block-size or padding', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = getAllStyleRules(Array.from(stylesheet.cssRules));

    const navLinks = docs.flatMap((d) => Array.from(d.document.querySelectorAll('nav a')));
    const satisfiesMinBlock = navLinks.length > 0 && navLinks.every((link) => hasMinimumBlockSize(link, rules));
    expect(satisfiesMinBlock).toBe(true);
  });

  test('ensures interactive footer links meet minimum inline size of 24px using min-inline-size or padding', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = getAllStyleRules(Array.from(stylesheet.cssRules));

    const footerLinks = docs.flatMap((d) => Array.from(d.document.querySelectorAll('.footer-links a, footer a')));
    const satisfiesMinInline = footerLinks.length > 0 && footerLinks.every((link) => hasMinimumInlineSize(link, rules));
    expect(satisfiesMinInline).toBe(true);
  });

  test('ensures interactive footer links meet minimum block size of 24px using min-block-size or padding', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = getAllStyleRules(Array.from(stylesheet.cssRules));

    const footerLinks = docs.flatMap((d) => Array.from(d.document.querySelectorAll('.footer-links a, footer a')));
    const satisfiesMinBlock = footerLinks.length > 0 && footerLinks.every((link) => hasMinimumBlockSize(link, rules));
    expect(satisfiesMinBlock).toBe(true);
  });
});
