/**
 * Expectations status for daily-grind web application:
 *
 * Expectation 1: SKIPPED - The base application already declares <!DOCTYPE html> and lang="en".
 * Expectation 2: SKIPPED - The base application already includes the required viewport meta tag without disabling zooming.
 * Expectation 3: SKIPPED - The base application already uses a single <h1> and sequential non-skipping heading hierarchy.
 * Expectation 4: TESTED - The base application fails to structure regions with proper landmarks (nav outside header, hero outside main, footer links without nav).
 * Expectation 5: SKIPPED - The base application contains no search or filtering controls.
 * Expectation 6: SKIPPED - The base application contains only navigational links pointing to URLs and no triggered action links.
 * Expectation 7: SKIPPED - The base application contains no forms or button elements.
 * Expectation 8: TESTED - The base application uses non-semantic divs for seasonal cards and plain text for footer links instead of list elements.
 * Expectation 9: SKIPPED - The base application contains no <img> or <svg> elements.
 * Expectation 10: SKIPPED - The base application contains no boolean attributes.
 * Expectation 11: SKIPPED - The base application contains no diagrams, code listings, or captioned images.
 * Expectation 12: SKIPPED - The base application contains no code blocks.
 * Expectation 13: SKIPPED - The base application contains no block quotations or citations.
 * Expectation 14: SKIPPED - The base application hero image is a CSS background rather than an <img> element, and solutions vary.
 * Expectation 15: SKIPPED - The base application contains no <img> or <video> elements.
 * Expectation 16: SKIPPED - The base application contains no below-the-fold <img> elements.
 * Expectation 17: SKIPPED - The base application contains no content <img> elements for responsive delivery.
 * Expectation 18: SKIPPED - The base application contains no modal dialogs.
 * Expectation 19: SKIPPED - The base application contains no modal dialogs or dialog dismissal forms.
 * Expectation 20: SKIPPED - The base application contains no transient overlays or popovers.
 * Expectation 21: SKIPPED - The base application contains no popover elements.
 * Expectation 22: SKIPPED - The base application contains no inline disclosure widgets.
 * Expectation 23: SKIPPED - The base application contains no <summary> elements.
 * Expectation 24: SKIPPED - The base application contains no custom non-dialog overlays or off-screen drawers.
 * Expectation 25: SKIPPED - The base application already satisfies this constraint with no positive tabindex attributes.
 * Expectation 26: SKIPPED - The base application contains no credential, contact, or address inputs.
 * Expectation 27: SKIPPED - The base application contains no form inputs.
 * Expectation 28: SKIPPED - The base application contains no video elements.
 * Expectation 29: SKIPPED - The base application contains no JavaScript setting dynamic runtime styles.
 * Expectation 30: SKIPPED - The base application already satisfies this constraint with no inline event handlers.
 */

import {
  test,
  expect,
  getTargetFiles,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('daily-grind Target Grader', () => {
  // --- STATIC ASSERTIONS (FAST) ---

  test('Expectation 4: Site header landmark contains primary navigation', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasHeaderNav = docs.some(d => Boolean(d.document.querySelector('header nav')));
    expect(hasHeaderNav).toBe(true);
  });

  test('Expectation 4: Main landmark contains the primary h1 heading', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasMainH1 = docs.some(d => Boolean(d.document.querySelector('main h1')));
    expect(hasMainH1).toBe(true);
  });

  test('Expectation 4: Main landmark contains the hero section', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasMainHero = docs.some(d => Boolean(d.document.querySelector('main .hero, main section.hero')));
    expect(hasMainHero).toBe(true);
  });

  test('Expectation 4: Footer landmark contains navigation for footer links', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasFooterNav = docs.some(d => Boolean(d.document.querySelector('footer nav')));
    expect(hasFooterNav).toBe(true);
  });

  test('Expectation 8: Seasonal favorites cards container uses a semantic list element', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasListGrid = docs.some(d => Boolean(d.document.querySelector('ul.grid, ol.grid, main ul, main ol')));
    expect(hasListGrid).toBe(true);
  });

  test('Expectation 8: Seasonal favorites cards are structured as list items', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasCardListItems = docs.some(d => d.document.querySelectorAll('ul.grid > li, ol.grid > li, .grid > li, main li').length >= 3);
    expect(hasCardListItems).toBe(true);
  });

  test('Expectation 8: Footer links are structured inside a semantic list element', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasFooterList = docs.some(d => Boolean(d.document.querySelector('footer ul, footer ol')));
    expect(hasFooterList).toBe(true);
  });

  test('Expectation 8: Footer links are structured as individual list items', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasFooterListItems = docs.some(d => d.document.querySelectorAll('footer ul li, footer ol li, footer li').length >= 4);
    expect(hasFooterListItems).toBe(true);
  });
});
