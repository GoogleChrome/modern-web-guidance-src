/*
 * Expectation 1: TESTED - Page content is placed within semantic HTML landmarks (<header>, <nav>, <main>, <footer>)
 * Expectation 2: SKIPPED: already satisfied by the base application
 * Expectation 3: TESTED - Repeated, contiguous groups of items use semantic list elements (<ul> or <ol>)
 * Expectation 4: TESTED - A skip link is provided before repeated navigation targeting main content or a programmatically focusable heading
 * Expectation 5: SKIPPED: no data tables in the base application or task
 * Expectation 6: SKIPPED: already satisfied by the base application
 * Expectation 7: SKIPPED: no <summary> or <details> elements in the base application or task
 * Expectation 8: SKIPPED: already satisfied by the base application
 * Expectation 9: SKIPPED: already satisfied by the base application
 * Expectation 10: SKIPPED: already satisfied by the base application
 * Expectation 11: SKIPPED: no form controls or <label> elements in the base application or task
 * Expectation 12: SKIPPED: no dialogs, groups, or heading-labeled duplicate landmarks in the base application or task
 * Expectation 13: TESTED - Identical-looking interactive controls ("View Details" links) are disambiguated using visually hidden text, aria-label, aria-labelledby, or aria-describedby
 * Expectation 14: SKIPPED: already satisfied by the base application
 * Expectation 15: SKIPPED: already satisfied by the base application
 * Expectation 16: SKIPPED: already satisfied by the base application
 * Expectation 17: SKIPPED: already satisfied by the base application
 * Expectation 18: SKIPPED: already satisfied by the base application
 * Expectation 19: SKIPPED: no <iframe> elements in the base application or task
 * Expectation 20: SKIPPED: no <iframe> elements in the base application or task
 * Expectation 21: TESTED - Custom keyboard focus styles use :focus-visible paired with outline and outline-offset
 * Expectation 22: SKIPPED: already satisfied by the base application
 * Expectation 23: TESTED - Interactive targets meet a minimum size of 24px by 24px using min-inline-size, min-block-size, or padding
 * Expectation 24: SKIPPED: already satisfied by the base application
 * Expectation 25: SKIPPED: already satisfied by the base application
 * Expectation 26: SKIPPED: already satisfied by the base application
 * Expectation 27: SKIPPED: no toggle buttons or custom toggleable controls in the base application or task
 * Expectation 28: SKIPPED: no <img> elements in the base application or task
 * Expectation 29: SKIPPED: no inline <svg> elements in the base application or task
 * Expectation 30: SKIPPED: no <video> elements in the base application or task
 * Expectation 31: SKIPPED: no form inputs or validation hints in the base application or task
 * Expectation 32: SKIPPED: no personal data form inputs in the base application or task
 * Expectation 33: SKIPPED: no forms or dynamic form validation in the base application or task
 * Expectation 34: SKIPPED: no dynamic status updates or live regions in the base application or task
 * Expectation 35: SKIPPED: no live regions or inert DOM subtrees in the base application or task
 * Expectation 36: SKIPPED: no modal dialogs in the base application or task
 * Expectation 37: SKIPPED: no custom non-dialog modal overlays or drawers in the base application or task
 */

import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { getCascadedStyle, CSSStyleRule, type CSSStyleSheet } from 'cssomnom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function normalizeWhitespace(text: string): string {
  return text
    .split('\n')
    .join(' ')
    .split('\r')
    .join(' ')
    .split('\t')
    .join(' ')
    .split(' ')
    .filter(Boolean)
    .join(' ');
}

function getAccessibleName(doc: Document, el: Element): string {
  const labelledBy = el.getAttribute('aria-labelledby')?.trim();
  if (labelledBy) {
    const ids = labelledBy.split(' ').filter(Boolean);
    const parts = ids
      .map((id) => {
        const refEl = doc.getElementById(id);
        return refEl ? normalizeWhitespace(refEl.textContent || '') : '';
      })
      .filter(Boolean);
    if (parts.length === ids.length && parts.length > 0) {
      return parts.join(' ');
    }
  }

  const ariaLabel = el.getAttribute('aria-label')?.trim();
  if (ariaLabel) {
    return normalizeWhitespace(ariaLabel);
  }

  return normalizeWhitespace(el.textContent || '');
}

function getAccessibleDescription(doc: Document, el: Element): string {
  const describedBy = el.getAttribute('aria-describedby')?.trim();
  if (describedBy) {
    const ids = describedBy.split(' ').filter(Boolean);
    const parts = ids
      .map((id) => {
        const refEl = doc.getElementById(id);
        return refEl ? normalizeWhitespace(refEl.textContent || '') : '';
      })
      .filter(Boolean);
    if (parts.length === ids.length && parts.length > 0) {
      return parts.join(' ');
    }
  }

  const ariaDescription = el.getAttribute('aria-description')?.trim();
  if (ariaDescription) {
    return normalizeWhitespace(ariaDescription);
  }

  return '';
}

test.describe('Accessibility Target Grader', () => {
  test('Expectation 1: Places all page content within semantic HTML landmarks (<header>, <nav>, <main>, <footer>)', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const landmarkTags = new Set(['HEADER', 'NAV', 'MAIN', 'ASIDE', 'FOOTER']);
    const ignoredTopLevelTags = new Set(['SCRIPT', 'STYLE', 'TEMPLATE']);

    const allValidLandmarks =
      docs.length > 0 &&
      docs.every(({ document }) => {
        const bodyChildren = Array.from(document.body?.children || []) as Element[];
        if (bodyChildren.length === 0) return false;

        const allChildrenInLandmarks = bodyChildren.every((child) => {
          const tag = child.tagName.toUpperCase();
          if (ignoredTopLevelTags.has(tag)) return true;
          if (tag === 'A' && (child.getAttribute('href') || '').startsWith('#')) return true;
          return landmarkTags.has(tag);
        });

        const mains = document.querySelectorAll('main');
        const hasSingleMainWithHeroHeading =
          mains.length === 1 && Boolean(document.querySelector('main h1'));
        const hasHeaderNav = Boolean(document.querySelector('header nav'));
        const hasFooterNav = Boolean(document.querySelector('footer nav'));

        const navElements = Array.from(document.querySelectorAll('nav')) as Element[];
        const navNames = navElements
          .map((nav) => getAccessibleName(document, nav).toLowerCase())
          .filter(Boolean);
        const hasDistinctNavNames =
          navElements.length >= 2 &&
          navNames.length === navElements.length &&
          new Set(navNames).size === navElements.length;

        return (
          allChildrenInLandmarks &&
          hasSingleMainWithHeroHeading &&
          hasHeaderNav &&
          hasFooterNav &&
          hasDistinctNavNames
        );
      });

    expect(allValidLandmarks).toBe(true);
  });

  test('Expectation 3: Uses semantic list elements (<ul> or <ol>) for repeated, contiguous groups of items', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const hasSemanticLists =
      docs.length > 0 &&
      docs.every(({ document }) => {
        const headerNavItems = document.querySelectorAll('header nav ul > li > a, header nav ol > li > a');
        const footerNavItems = document.querySelectorAll('footer ul > li > a, footer ol > li > a');
        return headerNavItems.length >= 5 && footerNavItems.length >= 4;
      });

    expect(hasSemanticLists).toBe(true);
  });

  test('Expectation 4: Provides a skip link before repeated content targeting the main container or its first meaningful element made programmatically focusable', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const hasValidSkipLink =
      docs.length > 0 &&
      docs.every(({ document }) => {
        const allLinks = Array.from(document.querySelectorAll('a[href]')) as Element[];
        if (allLinks.length === 0) return false;

        const firstLink = allLinks[0];
        const href = firstLink.getAttribute('href') || '';
        if (!href.startsWith('#') || href.length <= 1) return false;

        const targetId = href.slice(1);
        const targetEl = document.getElementById(targetId) as Element | null;
        if (!targetEl) return false;

        const focusableSelector =
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';
        const targetContainsFocusable = Boolean(targetEl.querySelector(focusableSelector));
        const targetHasMinusOneTabindex = targetEl.getAttribute('tabindex') === '-1';

        const targetIsValid = targetContainsFocusable
          ? !targetHasMinusOneTabindex
          : targetHasMinusOneTabindex;

        const containersWithMinusOne = Array.from(
          document.querySelectorAll('[tabindex="-1"]'),
        ) as Element[];
        const noFocusableContainerHasMinusOne = containersWithMinusOne.every(
          (el) => !el.querySelector(focusableSelector),
        );

        return targetIsValid && noFocusableContainerHasMinusOne;
      });

    expect(hasValidSkipLink).toBe(true);
  });

  test('Expectation 13: Disambiguates identical-looking interactive controls in a view using visually hidden text, aria-label, aria-labelledby, or aria-describedby', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const areControlsDisambiguated =
      docs.length > 0 &&
      docs.every(({ document }) => {
        const cardLinks = Array.from(document.querySelectorAll('.card a[href]')) as Element[];
        if (cardLinks.length < 3) return false;

        const keys = cardLinks.map((link) => {
          const name = getAccessibleName(document, link);
          const desc = getAccessibleDescription(document, link);
          return { name, key: `${name} || ${desc}` };
        });

        const allPreserveVisibleText = keys.every(({ name }) => name.includes('View Details'));
        const allHaveAdditionalContext = keys.every(
          ({ name, key }) => name !== 'View Details' || !key.endsWith('|| '),
        );
        const uniqueKeys = new Set(keys.map((k) => k.key));

        return (
          allPreserveVisibleText &&
          allHaveAdditionalContext &&
          uniqueKeys.size === cardLinks.length
        );
      });

    expect(areControlsDisambiguated).toBe(true);
  });

  test('Expectation 21: Defines custom keyboard focus styles using :focus-visible paired with outline and outline-offset rather than :focus', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);

    const styleRules = rules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
    const hasFocusVisibleWithOutlineAndOffset = styleRules.some((rule) => {
      if (!rule.selectorText.includes(':focus-visible')) return false;
      const outline = rule.style.getPropertyValue('outline').trim();
      const outlineWidth = rule.style.getPropertyValue('outline-width').trim();
      const outlineStyle = rule.style.getPropertyValue('outline-style').trim();
      const outlineOffset = rule.style.getPropertyValue('outline-offset').trim();

      const hasOutline =
        (outline !== '' && outline !== 'none' && outline !== '0') ||
        (outlineWidth !== '' && outlineWidth !== '0' && outlineStyle !== 'none');
      const hasOffset =
        outlineOffset !== '' && outlineOffset !== '0' && outlineOffset !== '0px';

      return hasOutline && hasOffset;
    });

    expect(hasFocusVisibleWithOutlineAndOffset).toBe(true);
  });

  test('Expectation 23: Ensures interactive targets meet a minimum size of 24px by 24px using min-inline-size and min-block-size or padding', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);

    const styleRules = rules.filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
    const hasExplicitMinTargetRule = styleRules.some((rule) => {
      const minBlock = Number.parseFloat(rule.style.getPropertyValue('min-block-size'));
      const minInline = Number.parseFloat(rule.style.getPropertyValue('min-inline-size'));
      return minBlock >= 24 || minInline >= 24;
    });

    const allLinksMeetTargetSize =
      hasExplicitMinTargetRule &&
      docs.length > 0 &&
      docs.every(({ document }) => {
        const navAndFooterLinks = Array.from(
          document.querySelectorAll('nav a[href], footer a[href], .btn'),
        ) as Element[];
        if (navAndFooterLinks.length === 0) return false;

        return navAndFooterLinks.every((link) => {
          const cascaded = getCascadedStyle(link, rules);
          const minBlock = Number.parseFloat(
            cascaded.getPropertyValue('min-block-size') ||
              cascaded.getPropertyValue('min-height'),
          );
          const minInline = Number.parseFloat(
            cascaded.getPropertyValue('min-inline-size') ||
              cascaded.getPropertyValue('min-width'),
          );
          const padding =
            cascaded.getPropertyValue('padding').trim() ||
            cascaded.getPropertyValue('padding-block').trim() ||
            cascaded.getPropertyValue('padding-top').trim();

          return minBlock >= 24 || minInline >= 24 || (padding !== '' && padding !== '0' && padding !== '0px');
        });
      });

    expect(allLinksMeetTargetSize).toBe(true);
  });
});
