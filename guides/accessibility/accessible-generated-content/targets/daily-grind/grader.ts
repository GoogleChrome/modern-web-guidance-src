import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { CSSStyleRule, type CSSStyleSheet, type CSSRule } from 'cssomnom';

import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const currentFilePath =
  typeof __filename !== 'undefined'
    ? __filename
    : path.resolve(process.cwd(), 'grader.ts');
const targetFiles: string[] = getTargetFiles(pathToFileURL(currentFilePath).href);

interface ParsedContent {
  primary: string;
  alt: string | null;
}

interface PseudoElementWithAlt {
  rule: CSSStyleRule;
  primary: string;
  alt: string;
}

const PSEUDO_ELEMENT_REGEX = /(::|:)(before|after)\b/i;

function getAllStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const styleRules: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      styleRules.push(rule);
    }
    if ('cssRules' in rule && (rule as any).cssRules) {
      styleRules.push(...getAllStyleRules((rule as any).cssRules));
    }
  }
  return styleRules;
}

function parseContentValue(contentValue: string): ParsedContent {
  const trimmed = contentValue.trim();
  let inDoubleQuote = false;
  let inSingleQuote = false;
  let inUrl = false;
  let slashIndex = -1;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    const prevChar = i > 0 ? trimmed[i - 1] : '';

    if (char === '"' && !inSingleQuote && prevChar !== '\\') {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === "'" && !inDoubleQuote && prevChar !== '\\') {
      inSingleQuote = !inSingleQuote;
    } else if (!inDoubleQuote && !inSingleQuote) {
      if (!inUrl && trimmed.substring(i).toLowerCase().startsWith('url(')) {
        inUrl = true;
      } else if (inUrl && char === ')') {
        inUrl = false;
      } else if (!inUrl && char === '/') {
        slashIndex = i;
      }
    }
  }

  if (slashIndex === -1) {
    return { primary: trimmed, alt: null };
  }

  const primary = trimmed.substring(0, slashIndex).trim();
  const rawAlt = trimmed.substring(slashIndex + 1).trim();

  let alt = rawAlt;
  if (
    (alt.startsWith('"') && alt.endsWith('"')) ||
    (alt.startsWith("'") && alt.endsWith("'"))
  ) {
    alt = alt.substring(1, alt.length - 1);
  }

  return { primary, alt };
}

function getHostSelectors(selectorText: string): string[] {
  return selectorText
    .split(',')
    .map((part) =>
      part
        .replace(/(::|:)(before|after)\b/gi, '')
        .replace(/:(hover|focus|active|focus-visible|focus-within|visited)\b/gi, '')
        .trim()
    )
    .filter(Boolean);
}

function getPseudoElementRulesWithAlt(sheet: CSSStyleSheet): PseudoElementWithAlt[] {
  const allRules = getAllStyleRules(sheet.cssRules);
  const results: PseudoElementWithAlt[] = [];

  for (const rule of allRules) {
    if (!PSEUDO_ELEMENT_REGEX.test(rule.selectorText)) continue;
    const content = rule.style.getPropertyValue('content');
    if (!content) continue;
    const parsed = parseContentValue(content);
    if (parsed && parsed.alt !== null) {
      results.push({
        rule,
        primary: parsed.primary,
        alt: parsed.alt,
      });
    }
  }

  return results;
}

function getHostElementsForRules(
  rulesWithAlt: PseudoElementWithAlt[],
  docs: Array<{ file: string; document: any }>
): any[] {
  const elements: any[] = [];
  for (const { rule } of rulesWithAlt) {
    const hostSelectors = getHostSelectors(rule.selectorText);
    for (const selector of hostSelectors) {
      for (const { document } of docs) {
        try {
          const matched = document.querySelectorAll(selector);
          elements.push(...Array.from(matched));
        } catch {
          // If selector is not directly queryable in linkedom, ignore safely
        }
      }
    }
  }
  return elements;
}

function hasAccessibleLabel(element: any): boolean {
  const text = element.textContent?.trim() || '';
  if (text.length > 0) return true;

  const ariaLabel = element.getAttribute?.('aria-label')?.trim() || '';
  if (ariaLabel.length > 0) return true;

  const ariaLabelledBy = element.getAttribute?.('aria-labelledby')?.trim() || '';
  if (ariaLabelledBy.length > 0) return true;

  const title = element.getAttribute?.('title')?.trim() || '';
  if (title.length > 0) return true;

  const alt = element.getAttribute?.('alt')?.trim() || '';
  if (alt.length > 0) return true;

  return false;
}

function isValidAltSyntax(
  item: PseudoElementWithAlt,
  docs: Array<{ file: string; document: any }>
): boolean {
  const isImage = /url\s*\(/i.test(item.primary);

  // If alt text is empty: must NOT be an image (never url(...) / "")
  if (item.alt === '') {
    return !isImage;
  }

  // If alt text is non-empty:
  // 1. Must differ from primary content value
  const unquotedPrimary = item.primary.replace(/^['"]|['"]$/g, '').trim();
  if (item.alt.trim() === unquotedPrimary) {
    return false;
  }

  // 2. Must not duplicate host element's DOM text
  const hostSelectors = getHostSelectors(item.rule.selectorText);
  const normalizedAlt = item.alt.toLowerCase().trim();

  for (const selector of hostSelectors) {
    for (const { document } of docs) {
      try {
        const matched = Array.from(document.querySelectorAll(selector));
        for (const el of matched as any[]) {
          const hostText = (el.textContent?.trim() || '').toLowerCase();
          if (hostText.length > 0 && hostText === normalizedAlt) {
            return false;
          }
        }
      } catch {
        // Ignore unparseable selectors
      }
    }
  }

  return true;
}

test.describe('accessible-generated-content Target Grader', () => {
  test('Stylesheets define ::before or ::after pseudo-element rules using content alternative text syntax to silence decorative text', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rulesWithAlt = getPseudoElementRulesWithAlt(stylesheet);
    const decorativeSilencedRules = rulesWithAlt.filter(
      (r) => r.alt === '' && !/url\s*\(/i.test(r.primary)
    );
    expect(decorativeSilencedRules.length).toBeGreaterThan(0);
  });

  test('Elements styled with pseudo-elements using alternative text convey meaningful label or state through DOM text or ARIA attributes', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs = getHtmlDocuments(targetFiles);
    const rulesWithAlt = getPseudoElementRulesWithAlt(stylesheet);
    const hostElements = getHostElementsForRules(rulesWithAlt, docs);

    const allHaveAccessibleContent =
      hostElements.length > 0 && hostElements.every((el) => hasAccessibleLabel(el));
    expect(allHaveAccessibleContent).toBe(true);
  });

  test('Every pseudo-element content declaration using alternative text silences non-image decorative text with empty alt or specifies valid non-duplicative alt text', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs = getHtmlDocuments(targetFiles);
    const rulesWithAlt = getPseudoElementRulesWithAlt(stylesheet);

    const allValid =
      rulesWithAlt.length > 0 &&
      rulesWithAlt.every((item) => isValidAltSyntax(item, docs));
    expect(allValid).toBe(true);
  });
});
