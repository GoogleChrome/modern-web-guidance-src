/**
 * EXPECTATIONS EVALUATION MATRIX (DEVTOOLS-TIMES):
 *
 * Expectation 1: SKIPPED - Base application already declares <!DOCTYPE html> and sets lang="en".
 * Expectation 2: SKIPPED - Base application already includes responsive viewport meta without disabling zooming.
 * Expectation 3: TESTED - Base application skips heading levels (<h3> in Footer without preceding <h2>).
 * Expectation 4: SKIPPED - Base application already structures primary regions using <header>, <nav>, <main>, and <footer>.
 * Expectation 5: TESTED - Base application wraps search controls in generic <div> instead of native <search> element.
 * Expectation 6: TESTED - Base application uses <a> with href="#" for triggered actions instead of <button>.
 * Expectation 7: SKIPPED - Base application already sets type="submit" on buttons inside forms.
 * Expectation 8: SKIPPED - Base application already uses <ul> for navigation and reading lists; converting teaser grids to semantic lists is not consistently implemented across all solutions.
 * Expectation 9: TESTED - Base application contains decorative SVG icon elements that lack aria-hidden="true".
 * Expectation 10: SKIPPED - Base application does not contain redundant boolean attribute values.
 * Expectation 11: SKIPPED - Base application already groups captioned images with <figure> and <figcaption>.
 * Expectation 12: SKIPPED - Application does not contain multi-line code block listings.
 * Expectation 13: SKIPPED - Application does not contain block quotations or work citations.
 * Expectation 14: TESTED - Base application LCP hero and featured article images lack fetchpriority="high".
 * Expectation 15: TESTED - Base application contains images (such as site logo) lacking explicit width and height attributes.
 * Expectation 16: TESTED - Base application below-the-fold teaser images lack loading="lazy".
 * Expectation 17: TESTED - Base application teaser and article images lack sizes attribute for responsive image delivery.
 * Expectation 18: TESTED - Base application implements modal overlays using custom <div> containers instead of native <dialog> opened via .showModal().
 * Expectation 19: TESTED - Base application modal overlays do not use <form method="dialog"> or buttons with formmethod="dialog" for native dismissal.
 * Expectation 20: TESTED - Base application flyout menu does not use the native Popover API (popover or popovertarget).
 * Expectation 21: SKIPPED - Base application does not combine popover attributes with .showModal() calls.
 * Expectation 22: SKIPPED - Application does not contain inline disclosure widgets (<details>/<summary>).
 * Expectation 23: SKIPPED - Application does not contain summary disclosure elements.
 * Expectation 24: SKIPPED - Overlays are implemented as native dialogs or popovers rather than custom non-dialog modal drawers requiring inert.
 * Expectation 25: SKIPPED - Base application does not contain positive tabindex values.
 * Expectation 26: TESTED - Base application credential form inputs omit specific autocomplete tokens (current-password, new-password).
 * Expectation 27: TESTED - Base application form inputs lack inputmode attributes for keypad optimization.
 * Expectation 28: SKIPPED - Application does not contain content <video> elements.
 * Expectation 29: SKIPPED - Base application does not set dynamic inline styles via JavaScript; custom properties approach is not shared across all solutions.
 * Expectation 30: SKIPPED - Base application does not use inline HTML event handler attributes.
 */

import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { SyntaxKind } from 'ts-morph';

const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('devtools-times Target Grader', () => {

  // --- STATIC ASSERTIONS (FAST) ---

  test('Expectation 3: Sequential heading hierarchy in Footer or Article sections (h2)', () => {
    const docs = getHtmlDocuments(targetFiles);
    const footerDoc = docs.find(d => d.file.endsWith('Footer.astro'))?.document;
    const articleDoc = docs.find(d => d.file.endsWith('[slug].astro'))?.document;
    const hasH2 = Boolean(
      (footerDoc && footerDoc.querySelectorAll('h2').length > 0) ||
      (articleDoc && articleDoc.querySelectorAll('h2').length > 0)
    );
    expect(hasH2).toBe(true);
  });

  test('Expectation 5: Native <search> element wraps search controls', () => {
    const project = getJsProject(targetFiles);
    const hasSearchElement = project.getSourceFiles().some(sf =>
      sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement).some(el => el.getTagNameNode().getText() === 'search') ||
      sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).some(el => el.getTagNameNode().getText() === 'search')
    );
    expect(hasSearchElement).toBe(true);
  });

  test('Expectation 6: Triggered actions use <button> instead of <a> with href="#"', () => {
    const project = getJsProject(targetFiles);
    const bottomNavFile = project.getSourceFiles().find(sf => sf.getFilePath().endsWith('BottomNav.tsx'));
    const hasNavButton = Boolean(
      bottomNavFile?.getDescendantsOfKind(SyntaxKind.JsxOpeningElement).some(el => el.getTagNameNode().getText() === 'button') ||
      bottomNavFile?.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).some(el => el.getTagNameNode().getText() === 'button')
    );
    expect(hasNavButton).toBe(true);
  });

  test('Expectation 9: Decorative icon elements include aria-hidden="true"', () => {
    const project = getJsProject(targetFiles);
    const bookmarkFile = project.getSourceFiles().find(sf => sf.getFilePath().endsWith('BookmarkButton.tsx'));
    const hasAriaHidden = Boolean(bookmarkFile?.getDescendantsOfKind(SyntaxKind.JsxAttribute).some(attr =>
      attr.getNameNode().getText() === 'aria-hidden' &&
      attr.getInitializer()?.getText().replace(/['"{}]/g, '') === 'true'
    ));
    expect(hasAriaHidden).toBe(true);
  });

  test('Expectation 14: LCP hero image has fetchpriority="high" and no loading="lazy"', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasHeroFetchPriority = docs.some(d => {
      const images = Array.from(d.document.querySelectorAll('Image, img') as unknown as Element[]);
      return images.some(img => img.getAttribute('fetchpriority') === 'high' && img.getAttribute('loading') !== 'lazy');
    });
    expect(hasHeroFetchPriority).toBe(true);
  });

  test('Expectation 15: Explicit width and height attributes on images to prevent CLS', () => {
    const docs = getHtmlDocuments(targetFiles);
    const headerDoc = docs.find(d => d.file.endsWith('Header.astro'))?.document;
    const logoImg = headerDoc?.querySelector('img[src*="logo.svg"]');
    const hasExplicitDimensions = Boolean(
      logoImg?.hasAttribute('width') &&
      logoImg?.hasAttribute('height')
    );
    expect(hasExplicitDimensions).toBe(true);
  });

  test('Expectation 16: Below-the-fold images apply loading="lazy"', () => {
    const docs = getHtmlDocuments(targetFiles);
    const teaserDocs = docs.filter(d =>
      d.file.endsWith('ArticleTeaser.astro') || d.file.endsWith('TopStoryTeaserGrid.astro')
    );
    const hasLazyImage = teaserDocs.some(d => {
      const images = Array.from(d.document.querySelectorAll('Image, img') as unknown as Element[]);
      return images.some(img => {
        const loading = img.getAttribute('loading') ?? '';
        // Accept a static "lazy" or a dynamic expression that can resolve to "lazy",
        // e.g. loading={priority ? "eager" : "lazy"}
        return loading === 'lazy' || /\blazy\b/.test(loading);
      });
    });
    expect(hasLazyImage).toBe(true);
  });

  test('Expectation 17: Responsive image delivery using sizes attribute', () => {
    const docs = getHtmlDocuments(targetFiles);
    const teaserDoc = docs.find(d => d.file.endsWith('ArticleTeaser.astro'))?.document;
    const hasResponsiveImage = Boolean(
      teaserDoc?.querySelectorAll('Image[sizes], Image[widths], Image[srcset], img[sizes], img[srcset], picture').length
    );
    expect(hasResponsiveImage).toBe(true);
  });

  test('Expectation 18: Native <dialog> opened via .showModal() for modal overlays', () => {
    const project = getJsProject(targetFiles);
    const hasShowModal = project.getSourceFiles().some(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression).some(call => {
        const expr = call.getExpression();
        return expr.isKind(SyntaxKind.PropertyAccessExpression) && expr.getName() === 'showModal';
      })
    );
    expect(hasShowModal).toBe(true);
  });

  test('Expectation 19: Dismiss modal dialogs natively using form method="dialog"', () => {
    const project = getJsProject(targetFiles);
    const hasDialogDismiss = project.getSourceFiles().some(sf =>
      sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement).some(el => {
        const tagName = el.getTagNameNode().getText();
        if (tagName === 'form') {
          return el.getAttributes().some(attr =>
            attr.isKind(SyntaxKind.JsxAttribute) &&
            attr.getNameNode().getText().toLowerCase() === 'method' &&
            attr.getInitializer()?.getText().replace(/['"{}]/g, '').toLowerCase() === 'dialog'
          );
        }
        if (tagName === 'button') {
          return el.getAttributes().some(attr =>
            attr.isKind(SyntaxKind.JsxAttribute) &&
            attr.getNameNode().getText().toLowerCase() === 'formmethod' &&
            attr.getInitializer()?.getText().replace(/['"{}]/g, '').toLowerCase() === 'dialog'
          );
        }
        return false;
      })
    );
    expect(hasDialogDismiss).toBe(true);
  });

  test('Expectation 20: Native Popover API (popover or popovertarget) for non-modal menus', () => {
    const project = getJsProject(targetFiles);
    const hasPopover = project.getSourceFiles().some(sf => {
      const hasAttr = sf.getDescendantsOfKind(SyntaxKind.JsxAttribute).some(attr => {
        const name = attr.getNameNode().getText().toLowerCase();
        return name === 'popover' || name === 'popovertarget';
      });
      const hasSpread = sf.getDescendantsOfKind(SyntaxKind.JsxSpreadAttribute).some(spread =>
        spread.getText().toLowerCase().includes('popover')
      );
      return hasAttr || hasSpread;
    });
    expect(hasPopover).toBe(true);
  });

  test('Expectation 26: Credential inputs specify current-password or new-password tokens', () => {
    const project = getJsProject(targetFiles);
    const hasPasswordAutocomplete = project.getSourceFiles().some(sf =>
      sf.getDescendantsOfKind(SyntaxKind.JsxAttribute).some(attr =>
        attr.getNameNode().getText().toLowerCase() === 'autocomplete' &&
        /\b(current-password|new-password)\b/.test(attr.getInitializer()?.getText() ?? '')
      )
    );
    expect(hasPasswordAutocomplete).toBe(true);
  });

  test('Expectation 27: Form inputs pair autocomplete tokens with matching type and inputmode attributes', () => {
    const project = getJsProject(targetFiles);
    const hasInputMode = project.getSourceFiles().some(sf =>
      sf.getDescendantsOfKind(SyntaxKind.JsxAttribute).some(attr =>
        attr.getNameNode().getText().toLowerCase() === 'inputmode'
      )
    );
    const hasSearchType = project.getSourceFiles().some(sf =>
      sf.getDescendantsOfKind(SyntaxKind.JsxAttribute).some(attr =>
        attr.getNameNode().getText().toLowerCase() === 'type' &&
        attr.getInitializer()?.getText().replace(/['"{}]/g, '').toLowerCase() === 'search'
      )
    );
    const hasUsernameAutocomplete = project.getSourceFiles().some(sf =>
      sf.getDescendantsOfKind(SyntaxKind.JsxAttribute).some(attr =>
        attr.getNameNode().getText().toLowerCase() === 'autocomplete' &&
        /\b(username|email)\b/.test(attr.getInitializer()?.getText() ?? '')
      )
    );
    expect(hasInputMode || (hasSearchType && hasUsernameAutocomplete)).toBe(true);
  });

});
